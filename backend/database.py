from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = "sqlite:///./bande_rythmo.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from models import Clip, Subtitle, Take, Boucle, Export  # noqa: F401
    Base.metadata.create_all(bind=engine)
    from sqlalchemy import text
    with engine.connect() as conn:
        cols = [r[1] for r in conn.execute(text("PRAGMA table_info(clips)")).fetchall()]
        if "source_path" not in cols:
            conn.execute(text("ALTER TABLE clips ADD COLUMN source_path TEXT"))
        if "status" not in cols:
            conn.execute(text("ALTER TABLE clips ADD COLUMN status TEXT NOT NULL DEFAULT 'todo'"))
            conn.execute(text(
                "UPDATE clips SET status = 'dubbing' "
                "WHERE clip_id IN (SELECT DISTINCT clip_id FROM subtitles)"
            ))
        # Source fps for SMPTE display + DetX export. Backfill 25 (PAL).
        if "fps" not in cols:
            conn.execute(text("ALTER TABLE clips ADD COLUMN fps REAL NOT NULL DEFAULT 25.0"))
        sub_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(subtitles)")).fetchall()]
        if "words" not in sub_cols:
            conn.execute(text("ALTER TABLE subtitles ADD COLUMN words TEXT"))
        # Pro BR line flags. SQLite stores BOOLEAN as INTEGER (0/1).
        if "off" not in sub_cols:
            conn.execute(text("ALTER TABLE subtitles ADD COLUMN off INTEGER NOT NULL DEFAULT 0"))
        if "dos" not in sub_cols:
            conn.execute(text("ALTER TABLE subtitles ADD COLUMN dos INTEGER NOT NULL DEFAULT 0"))
        if "ambiance" not in sub_cols:
            conn.execute(text("ALTER TABLE subtitles ADD COLUMN ambiance INTEGER NOT NULL DEFAULT 0"))
        if "plan_cut" not in sub_cols:
            conn.execute(text("ALTER TABLE subtitles ADD COLUMN plan_cut REAL"))
        conn.commit()

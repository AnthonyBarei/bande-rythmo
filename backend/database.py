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
    from models import Clip, Subtitle, Take  # noqa: F401
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
        conn.commit()

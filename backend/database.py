from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = "sqlite:///./bande_rythmo.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


@event.listens_for(engine, "connect")
def _sqlite_pragmas(dbapi_conn, _):
    # WAL: readers don't block writers — required once jobs + UI hit the DB
    # concurrently. busy_timeout: wait instead of "database is locked".
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL")
    cur.execute("PRAGMA busy_timeout=5000")
    cur.execute("PRAGMA synchronous=NORMAL")
    cur.execute("PRAGMA foreign_keys=ON")
    cur.close()


SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db(bind=None):
    from models import (  # noqa: F401
        Project, Source, ProjectRole, Meta,
        Clip, Subtitle, Take, Boucle, Export, LexiconEntry, User, UserSession, AuthToken,
    )
    bind = bind or engine
    Base.metadata.create_all(bind=bind)
    from sqlalchemy import text
    with bind.connect() as conn:
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
        # Scene-change timecodes (JSON array of seconds). Null until detected.
        if "scene_cuts" not in cols:
            conn.execute(text("ALTER TABLE clips ADD COLUMN scene_cuts TEXT"))
        # Project/folder grouping (free-text, nullable).
        if "project" not in cols:
            conn.execute(text("ALTER TABLE clips ADD COLUMN project TEXT"))
        # Projects (PROJECTS_PLAN P1). SQLite allows REFERENCES on ADD COLUMN when the default is NULL.
        if "project_id" not in cols:
            conn.execute(text("ALTER TABLE clips ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE CASCADE"))
        if "source_id" not in cols:
            conn.execute(text("ALTER TABLE clips ADD COLUMN source_id TEXT REFERENCES sources(id) ON DELETE SET NULL"))
        if "br_offset" not in cols:
            conn.execute(text("ALTER TABLE clips ADD COLUMN br_offset REAL NOT NULL DEFAULT 0"))
        if "ui_state" not in cols:
            conn.execute(text("ALTER TABLE clips ADD COLUMN ui_state TEXT"))
        lex_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(lexicon)")).fetchall()]
        if "project_id" not in lex_cols:
            conn.execute(text("ALTER TABLE lexicon ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE CASCADE"))
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
        if "note" not in sub_cols:
            conn.execute(text("ALTER TABLE subtitles ADD COLUMN note TEXT"))
        if "hidden" not in sub_cols:
            conn.execute(text("ALTER TABLE subtitles ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0"))
        if "take" not in sub_cols:
            conn.execute(text("ALTER TABLE subtitles ADD COLUMN take INTEGER NOT NULL DEFAULT 0"))
        take_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(takes)")).fetchall()]
        if "best" not in take_cols:
            conn.execute(text("ALTER TABLE takes ADD COLUMN best INTEGER NOT NULL DEFAULT 0"))
        if "lead" not in take_cols:
            conn.execute(text("ALTER TABLE takes ADD COLUMN lead REAL NOT NULL DEFAULT 0"))
        # FK indexes — list/lookup endpoints filter on clip_id constantly.
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_subtitles_clip_id ON subtitles (clip_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_takes_clip_id ON takes (clip_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_boucles_clip_id ON boucles (clip_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_exports_clip_id ON exports (clip_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_clips_project_id ON clips (project_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_clips_source_id ON clips (source_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_lexicon_project_id ON lexicon (project_id)"))
        conn.commit()
    from services.project_migration import migrate_projects
    migrate_projects(bind)

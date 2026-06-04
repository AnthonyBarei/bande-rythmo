from sqlalchemy import Column, String, Float, Integer, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Clip(Base):
    __tablename__ = "clips"

    clip_id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    source_filename = Column(String, nullable=False, default="")
    source_path = Column(String, nullable=True)
    start = Column(Float, nullable=False)
    end = Column(Float, nullable=False)
    segment_path = Column(String, nullable=False)
    thumbnail_path = Column(String, nullable=True)
    status = Column(String, nullable=False, default="todo")
    # Source frame rate (detected via ffprobe at import) — used for SMPTE TC
    # readouts and DetX <lipsync timecode> emission. Defaults to 25 (PAL).
    fps = Column(Float, nullable=False, default=25.0)
    # JSON array of scene-change timecodes (seconds), detected via ffmpeg at
    # import or on-demand. Feeds the BR canvas + nav timeline plan-cut markers.
    scene_cuts = Column(String, nullable=True)
    # Optional project/folder grouping (free-text). Null = ungrouped.
    project = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.now)

    subtitles = relationship(
        "Subtitle",
        back_populates="clip",
        cascade="all, delete-orphan",
        order_by="Subtitle.order_index",
    )
    boucles = relationship(
        "Boucle",
        back_populates="clip",
        cascade="all, delete-orphan",
        order_by="Boucle.number",
    )


class Subtitle(Base):
    __tablename__ = "subtitles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    clip_id = Column(String, ForeignKey("clips.clip_id", ondelete="CASCADE"), nullable=False)
    order_index = Column(Integer, nullable=False, default=0)
    start = Column(Float, nullable=False)
    end = Column(Float, nullable=False)
    character = Column(String, default="")
    text = Column(String, nullable=False, default="")
    # JSON array of {w, start, end, signs?: [{i,type,t0,t1}]}.
    # `signs` (optional) = per-character détection markers (labiale/semi/…).
    words = Column(String, nullable=True)
    # Pro BR line flags — drawn under the line on-screen and serialised to DetX.
    off = Column(Boolean, nullable=False, default=False)        # hors-champ → continuous trait
    dos = Column(Boolean, nullable=False, default=False)        # bouche non vue → dotted trait
    ambiance = Column(Boolean, nullable=False, default=False)   # ambiance ON/OFF (non-dialogue)
    plan_cut = Column(Float, nullable=True)                     # change-of-plan timecode within line
    note = Column(String, nullable=True)                        # free-text annotation per réplique

    clip = relationship("Clip", back_populates="subtitles")


class Boucle(Base):
    """Recording loop (boucle) — studio planning unit, ≈1 minute each.
    Numbered contiguously per clip; drives the croisillé export grid."""
    __tablename__ = "boucles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    clip_id = Column(String, ForeignKey("clips.clip_id", ondelete="CASCADE"), nullable=False)
    number = Column(Integer, nullable=False)
    start = Column(Float, nullable=False)
    end = Column(Float, nullable=False)

    clip = relationship("Clip", back_populates="boucles")


class Export(Base):
    """Persisted export artifact. Created when a job finishes successfully.
    Lets users re-download past exports + audit what was produced."""
    __tablename__ = "exports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    clip_id = Column(String, ForeignKey("clips.clip_id", ondelete="CASCADE"), nullable=False)
    format = Column(String, nullable=False)        # srt|ass|detx|mp4|gif|mp3|wav|croisille
    path = Column(String, nullable=False)          # local file path under exports/
    filename = Column(String, nullable=False)      # download filename
    media_type = Column(String, nullable=False, default="application/octet-stream")
    size_bytes = Column(Integer, nullable=False, default=0)
    quality = Column(String, nullable=True)        # MP4 only: draft|standard|youtube
    params = Column(String, nullable=True)         # JSON snapshot of ExportRequest knobs
    created_at = Column(DateTime, default=datetime.now)


class Take(Base):
    __tablename__ = "takes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    clip_id = Column(String, ForeignKey("clips.clip_id", ondelete="CASCADE"), nullable=False)
    character = Column(String, default="")
    subtitle_index = Column(Integer, nullable=True)
    audio_path = Column(String, nullable=False)
    duration = Column(Float, nullable=False, default=0.0)
    label = Column(String, default="")
    created_at = Column(DateTime, default=datetime.now)


class LexiconEntry(Base):
    """Dubbing lexicon term — translation/pronunciation glossary so adapters
    keep terms consistent. Scoped by project ('' = global)."""
    __tablename__ = "lexicon"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project = Column(String, nullable=False, default="")   # '' = global
    term = Column(String, nullable=False)                  # source word/name
    translation = Column(String, nullable=True)            # agreed rendering
    phonetic = Column(String, nullable=True)               # pronunciation hint
    note = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.now)

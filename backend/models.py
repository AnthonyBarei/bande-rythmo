from sqlalchemy import Column, String, Float, Integer, ForeignKey, DateTime
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
    created_at = Column(DateTime, default=datetime.now)

    subtitles = relationship(
        "Subtitle",
        back_populates="clip",
        cascade="all, delete-orphan",
        order_by="Subtitle.order_index",
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

    clip = relationship("Clip", back_populates="subtitles")

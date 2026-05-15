"""
One-shot migration: clips.json -> bande_rythmo.db

Run from backend/ with venv active:
    python migrate_clips_json.py [path/to/clips.json]

Defaults to clips.json in the same directory.
Skips clips already in DB (by clip_id). Safe to re-run.
"""
import json
import os
import sys
from datetime import datetime

from database import init_db, SessionLocal
from models import Clip, Subtitle

CLIPS_FILE = sys.argv[1] if len(sys.argv) > 1 else "clips.json"

if not os.path.exists(CLIPS_FILE):
    print(f"Not found: {CLIPS_FILE}")
    sys.exit(1)

with open(CLIPS_FILE, encoding="utf-8") as f:
    data = json.load(f)

init_db()
db = SessionLocal()

inserted = 0
skipped = 0

for clip_id, c in data.items():
    if db.query(Clip).filter(Clip.clip_id == clip_id).first():
        skipped += 1
        continue

    created_at = datetime.now()
    if c.get("created_at"):
        try:
            created_at = datetime.fromisoformat(c["created_at"])
        except ValueError:
            pass

    clip = Clip(
        clip_id=clip_id,
        name=c.get("name") or f"Clip {clip_id[:6]}",
        source_filename="",
        start=float(c.get("start", 0)),
        end=float(c.get("end", 0)),
        segment_path=c.get("segment_path", ""),
        thumbnail_path=c.get("thumbnail_path"),
        created_at=created_at,
    )
    db.add(clip)
    db.flush()

    for i, s in enumerate(c.get("subtitles") or []):
        db.add(Subtitle(
            clip_id=clip_id,
            order_index=i,
            start=float(s.get("start", 0)),
            end=float(s.get("end", 0)),
            character=s.get("character", ""),
            text=s.get("text", ""),
        ))

    inserted += 1

db.commit()
db.close()

print(f"Done. Inserted: {inserted}, skipped (already exist): {skipped}")

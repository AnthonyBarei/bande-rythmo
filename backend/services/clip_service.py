import json
import os
from datetime import datetime

CLIPS_FILE = "clips.json"


def _load():
    if not os.path.exists(CLIPS_FILE):
        return {}
    with open(CLIPS_FILE, encoding="utf-8") as f:
        return json.load(f)


def _save(data):
    with open(CLIPS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def create_clip(clip_id, name, video_id, start, end, segment_path, thumbnail_path):
    data = _load()
    data[clip_id] = {
        "clip_id": clip_id,
        "name": name,
        "video_id": video_id,
        "start": start,
        "end": end,
        "segment_path": segment_path,
        "thumbnail_path": thumbnail_path,
        "subtitles": [],
        "created_at": datetime.now().isoformat(),
    }
    _save(data)
    return data[clip_id]


def list_clips():
    return sorted(_load().values(), key=lambda c: c["created_at"], reverse=True)


def get_clip(clip_id):
    return _load().get(clip_id)


def update_subtitles(clip_id, subtitles):
    data = _load()
    if clip_id not in data:
        return None
    data[clip_id]["subtitles"] = subtitles
    _save(data)
    return data[clip_id]


def update_name(clip_id, name):
    data = _load()
    if clip_id not in data:
        return None
    data[clip_id]["name"] = name
    _save(data)
    return data[clip_id]


def delete_clip(clip_id):
    data = _load()
    if clip_id not in data:
        return False
    clip = data.pop(clip_id)
    _save(data)
    # Clean up files
    for path_key in ("segment_path", "thumbnail_path"):
        p = clip.get(path_key)
        if p and os.path.exists(p):
            try:
                os.remove(p)
            except OSError:
                pass
    return True

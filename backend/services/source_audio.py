"""A source's audio tracks for the browser. Chrome plays only a file's default
audio track (no HTMLMediaElement.audioTracks) and stays silent on AC3/EAC3/DTS,
so other tracks are extracted once — all in one ffmpeg pass — to
sources/{id}_a{n}.m4a and played next to the muted video."""
import json
import logging
import os
import re

log = logging.getLogger("br.sources")

BROWSER_SAFE = {"aac", "mp3"}
REMUX_FILE = re.compile(r"^([0-9a-fA-F-]{8,64})_(?:v\d+_)?a\d+\.(?:m4a|mp4)(?:\.part)?$")


def remux_path(source_id: str, index: int) -> str:
    return f"sources/{source_id}_a{index}.m4a"


def audio_streams(src) -> list[dict]:
    try:
        return (json.loads(src.streams) if src.streams else {}).get("audio_streams") or []
    except (ValueError, TypeError):
        return []


def track_states(src) -> list[dict]:
    """Per track: `direct` = the video element plays it as is (default track,
    browser-safe codec); `ready` = playable now (direct or extracted)."""
    out = []
    for s in audio_streams(src):
        idx = s.get("relative_index", 0)
        codec = (s.get("codec") or "").lower()
        direct = idx == 0 and codec in BROWSER_SAFE
        out.append({
            "index": idx, "label": s.get("label"), "codec": codec, "language": s.get("language"),
            "direct": direct, "ready": direct or os.path.isfile(remux_path(src.id, idx)),
        })
    return out


def extract_command(path: str, source_id: str, tracks: list[dict]) -> list[str]:
    """One read of the source, one output per track (.part, renamed when done).
    AAC/MP3 are copied, anything else becomes AAC 192k."""
    probe = ["-probesize", "5M", "-analyzeduration", "5M"] if path.startswith("http") else []
    cmd = ["ffmpeg", "-y", "-progress", "pipe:1", "-nostats", *probe, "-i", path]
    for t in tracks:
        codec = ["-c:a", "copy"] if t["codec"] in BROWSER_SAFE else ["-c:a", "aac", "-b:a", "192k"]
        cmd += ["-map", f"0:a:{t['index']}", "-vn", *codec, "-f", "mp4", remux_path(source_id, t["index"]) + ".part"]
    return cmd


def prune_stray_remuxes(known_ids: set[str]) -> int:
    """Remuxed audio of sources that no longer exist (pre-project registry ids,
    deleted sources), and any half-written `.part` (no job survives a restart).
    Only files named like a remux are touched — never videos."""
    if not os.path.isdir("sources"):
        return 0
    removed = 0
    for name in os.listdir("sources"):
        m = REMUX_FILE.match(name)
        if m and (m.group(1) not in known_ids or name.endswith(".part")):
            try:
                os.remove(os.path.join("sources", name))
                removed += 1
            except OSError:
                log.warning("stray remux %s not removed (in use?) — retried next startup", name, exc_info=True)
    return removed

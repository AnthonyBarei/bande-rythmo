"""Choicer Voicer dub pack — folder/ZIP dropped into packs_voice.

Layout (Godot ConfigFile, CRLF, the reference community packs actually load):

    Mon Pack/
      _pack_info.ini
      icon.png
      dub_video.ogv          Theora + silent Vorbis track (Godot)
      _backing_track.mp3     optional — clip bed (instrumental / replacement)
      01_voix_bonjour.ogg    original voice of the line
      01_voix_bonjour.txt    caption, image, dub_timestamps, dub_characters
      01_voix_bonjour.png

Audio model (Choicer Voicer): the game plays each line's sample — or the
player's recording — at its dub_timestamp over dub_video, and plays
_backing_track (music & effects, no voices) alongside. Unselected characters
fall back to their original sample. As in a pro dubbing deliverable (M&E +
new voices), the original dialogue never lives in the bed: dub_video.ogv
carries a silent Vorbis track (container layout kept identical to the
reference packs), so the only voices heard are the per-line clips.
"""

from __future__ import annotations

import json
import logging
import os
import re
import shutil
import subprocess
import unicodedata
import zipfile
from pathlib import Path
from typing import Any, Callable, Optional

from services.ffmpeg_service import run_ffmpeg_with_progress
from services.jobs import CancelledJobError

log = logging.getLogger("br.dubpack")

MAX_CLIP_S = 60.0
MIN_CLIP_S = 0.05

ProgressCb = Optional[Callable[[float, str], None]]
CancelCb = Optional[Callable[[], bool]]
RegisterCb = Optional[Callable[[Any], None]]


def ini_value(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int) and not isinstance(value, bool):
        return str(value)
    if isinstance(value, float):
        # Godot reads "0" as an int; timestamps must stay floats.
        return f"{value:.3f}"
    if isinstance(value, (list, tuple)):
        return "[" + ", ".join(ini_value(v) for v in value) + "]"
    text = str(value)
    text = text.replace("\\", "\\\\").replace('"', '\\"')
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\n", "\\n")
    return f'"{text}"'


def write_ini(path: Path, data: dict, section: str = "data",
              keep_empty: tuple = ()) -> None:
    lines = [f"[{section}]", ""]
    for key, value in data.items():
        empty = value is None or (isinstance(value, (list, tuple, str)) and len(value) == 0)
        if empty and key not in keep_empty:
            continue
        lines.append(f"{key}={ini_value('' if value is None else value)}")
    path.write_text("\r\n".join(lines) + "\r\n", encoding="utf-8", newline="")


def ascii_slug(text: str, max_len: int = 28) -> str:
    text = unicodedata.normalize("NFKD", text or "")
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^A-Za-z0-9]+", "-", text).strip("-").lower()
    return text[:max_len].strip("-")


_FORBIDDEN = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
_WIN_RESERVED = {
    "CON", "PRN", "AUX", "NUL",
    *(f"COM{i}" for i in range(1, 10)),
    *(f"LPT{i}" for i in range(1, 10)),
}


def safe_folder_name(name: str, fallback: str = "Dub Pack") -> str:
    cleaned = _FORBIDDEN.sub("", name or "")
    cleaned = "".join(
        ch for ch in unicodedata.normalize("NFC", cleaned)
        if ch.isalnum() or ch in " -_.,'()[]&+!"
    )
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .")
    if cleaned.upper().split(".")[0] in _WIN_RESERVED:
        cleaned = f"{cleaned} pack"
    return cleaned[:80].strip(" .") or fallback


def clip_basename(index: int, text: str, character: str, width: int) -> str:
    who = ascii_slug(character, 14) or "voix"
    words = ascii_slug(text, 26) or "replique"
    return f"{index:0{width}d}_{who}_{words}".strip("_")


def prepare_lines(subs: list, media_end: Optional[float] = None) -> list[dict]:
    """Drop empty/tiny cues. Refuse cues the game will reject (> 60 s).

    `media_end` (seconds): cues are clamped to it; a cue starting at/after it
    has nothing to cut and is dropped instead of yielding an empty clip."""
    lines = []
    too_long = []
    for i, s in enumerate(subs, start=1):
        start = float(s.get("start") or 0)
        end = float(s.get("end") or 0)
        if media_end is not None:
            end = min(end, media_end)
        dur = end - start
        text = (s.get("text") or "").strip()
        if dur <= MIN_CLIP_S or not text:
            continue
        if dur > MAX_CLIP_S:
            too_long.append(f"réplique {i} ({dur:.1f} s)")
            continue
        lines.append({
            "start": start,
            "end": end,
            "character": (s.get("character") or "").strip() or "Voix",
            "text": text,
        })
    if too_long:
        raise ValueError(
            "Choicer Voicer refuse les clips de plus de 60 s : "
            + ", ".join(too_long)
            + ". Découpe-les avant d'exporter."
        )
    if not lines:
        if media_end is not None and subs:
            raise ValueError(
                "Aucune réplique exportable : toutes tombent après la fin de la vidéo "
                f"({media_end:.2f} s), sont vides ou de durée nulle."
            )
        raise ValueError("Aucune réplique exportable (texte vide ou durée nulle).")
    lines.sort(key=lambda ln: ln["start"])
    return lines


def _ffmpeg(cmd: list, duration_s: float, on_progress, is_cancelled, register_process) -> None:
    rc = run_ffmpeg_with_progress(
        cmd, max(duration_s, 0.1),
        on_progress=on_progress,
        is_cancelled=is_cancelled,
        register_process=register_process,
    )
    if rc == -1 or (is_cancelled and is_cancelled()):
        raise CancelledJobError()
    if rc != 0:
        raise RuntimeError(f"ffmpeg a retourné {rc}")


def _seek(start: float, duration: float, source: str) -> list:
    """Fast keyframe seek, then a short accurate trim so the cut matches the cue."""
    pre = max(0.0, start - 2.0)
    fine = start - pre
    return [
        "-ss", f"{pre:.3f}", "-i", source,
        "-ss", f"{fine:.3f}", "-t", f"{duration:.3f}",
    ]


def probe_media(path: str) -> tuple[float, bool]:
    """(duration in seconds — 0 when unknown, has an audio stream)."""
    proc = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", path],
        capture_output=True, text=True,
    )
    try:
        data = json.loads(proc.stdout or "{}")
        duration = float(data.get("format", {}).get("duration") or 0)
    except (ValueError, TypeError):
        log.warning("ffprobe: unreadable output for %s", path)
        return 0.0, False
    has_audio = any(s.get("codec_type") == "audio" for s in data.get("streams", []))
    return duration, has_audio


def media_end(media_s: float, in_point: Optional[float]) -> Optional[float]:
    """Media end on the (range-shifted) timeline, None when the duration is unknown."""
    if media_s <= 0:
        return None
    return max(0.0, media_s - (in_point or 0.0))


def build_dubpack(
    *,
    segment: str,
    subs: list,
    title: str,
    out_zip: str,
    bed_path: Optional[str] = None,
    in_point: Optional[float] = None,
    out_point: Optional[float] = None,
    video_height: int = 720,
    on_progress: ProgressCb = None,
    is_cancelled: CancelCb = None,
    register_process: RegisterCb = None,
) -> dict:
    """Assemble a Choicer Voicer pack and zip it. `subs` are clip-absolute.

    A custom range shifts timestamps so the exported OGV starts at 0.
    """
    shift = 0.0
    window = None
    if in_point is not None and out_point is not None and out_point > in_point:
        shift = float(in_point)
        window = (float(in_point), float(out_point))
        ranged = []
        for s in subs:
            if s.get("end", 0) <= window[0] or s.get("start", 0) >= window[1]:
                continue
            ranged.append({
                **s,
                "start": max(0.0, float(s["start"]) - shift),
                "end": max(0.0, min(float(s["end"]), window[1]) - shift),
            })
        subs = ranged

    pack_name = safe_folder_name(title)
    staging = Path(out_zip).with_suffix("")
    pack_dir = staging / pack_name
    if staging.exists():
        shutil.rmtree(staging)
    pack_dir.mkdir(parents=True)

    def report(pct: float, label: str):
        if on_progress:
            on_progress(pct, label)
        if is_cancelled and is_cancelled():
            raise CancelledJobError()

    try:
        media_s, has_audio = probe_media(segment)
        end_s = media_end(media_s, shift)
        duration_s = (window[1] - window[0]) if window else media_s
        if window and end_s is not None:
            duration_s = min(duration_s, end_s)
        lines = prepare_lines(subs, media_end=end_s)
        if duration_s <= 0:
            duration_s = max(ln["end"] for ln in lines) + 0.5

        report(0.02, "Encodage OGV")
        video_out = pack_dir / "dub_video.ogv"
        vcmd = ["ffmpeg", "-y"]
        if window:
            vcmd += _seek(window[0], duration_s, segment)
        else:
            vcmd += ["-i", segment]
        # Silent audio of the exact picture length — never the original voices.
        vcmd += [
            "-f", "lavfi", "-t", f"{duration_s:.3f}", "-i", "anullsrc=r=44100:cl=stereo",
            "-map", "0:v:0", "-map", "1:a:0",
            "-vf", f"scale=-2:{int(video_height)}:flags=lanczos",
            "-c:v", "libtheora", "-q:v", "7",
            "-pix_fmt", "yuv420p",
            "-c:a", "libvorbis", "-q:a", "1",
            "-shortest",
            str(video_out),
        ]
        def _video_progress(p, _eta):
            if on_progress:
                on_progress(0.02 + 0.40 * p, "Encodage OGV")

        _ffmpeg(
            vcmd, duration_s,
            on_progress=_video_progress,
            is_cancelled=is_cancelled,
            register_process=register_process,
        )

        if bed_path and os.path.isfile(bed_path):
            report(0.44, "Fond sonore")
            bed_out = pack_dir / "_backing_track.mp3"
            bcmd = ["ffmpeg", "-y"]
            if window:
                bcmd += _seek(window[0], duration_s, bed_path)
            else:
                bcmd += ["-i", bed_path]
            bcmd += ["-vn", "-c:a", "libmp3lame", "-q:a", "2", str(bed_out)]
            _ffmpeg(bcmd, duration_s, on_progress=None, is_cancelled=is_cancelled,
                    register_process=register_process)

        width = 3 if len(lines) >= 100 else 2
        used: set[str] = set()
        report(0.48, "Découpe des répliques")
        for idx, line in enumerate(lines, start=1):
            base = clip_basename(idx, line["text"], line["character"], width)
            while base in used:
                base = f"{base}-b"
            used.add(base)
            src_start = line["start"] + shift
            dur = line["end"] - line["start"]

            ogg = pack_dir / f"{base}.ogg"
            if has_audio:
                acmd = ["ffmpeg", "-y", *_seek(src_start, dur, segment), "-vn"]
            else:
                acmd = ["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
                        "-t", f"{dur:.3f}"]
            acmd += ["-c:a", "libvorbis", "-q:a", "5", str(ogg)]
            _ffmpeg(acmd, dur, on_progress=None, is_cancelled=is_cancelled,
                    register_process=register_process)

            png = pack_dir / f"{base}.png"
            at = src_start + dur / 2
            icmd = [
                "ffmpeg", "-y", "-ss", f"{at:.3f}", "-i", segment,
                "-frames:v", "1", "-vf", "scale=640:-2", str(png),
            ]
            _ffmpeg(icmd, 0.2, on_progress=None, is_cancelled=is_cancelled,
                    register_process=register_process)

            write_ini(pack_dir / f"{base}.txt", {
                "caption": line["text"],
                "image": png.name,
                "dub_timestamps": [round(line["start"], 3)],
                "dub_characters": [line["character"]],
            })
            report(0.48 + 0.40 * idx / len(lines), f"Réplique {idx}/{len(lines)}")

        icon_at = lines[0]["start"] + shift + min(0.2, (lines[0]["end"] - lines[0]["start"]) / 2)
        icon = pack_dir / "icon.png"
        _ffmpeg(
            ["ffmpeg", "-y", "-ss", f"{icon_at:.3f}", "-i", segment,
             "-frames:v", "1", "-vf", "scale=320:-2", str(icon)],
            0.2, on_progress=None, is_cancelled=is_cancelled,
            register_process=register_process,
        )
        write_ini(pack_dir / "_pack_info.ini", {
            "title": (title or pack_name).strip() or pack_name,
            "icon": "icon.png",
            "readme": "Exporté depuis Bande Rythmo",
        }, keep_empty=("readme",))

        report(0.92, "Création du ZIP")
        if os.path.exists(out_zip):
            os.remove(out_zip)
        with zipfile.ZipFile(out_zip, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
            for item in sorted(pack_dir.rglob("*")):
                if item.is_file():
                    zf.write(item, arcname=str(Path(pack_name) / item.relative_to(pack_dir)))
        return {
            "pack_name": pack_name,
            "clips": len(lines),
            "filename": f"{pack_name}.zip",
        }
    finally:
        shutil.rmtree(staging, ignore_errors=True)

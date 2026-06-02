import json
import subprocess
import os
import time
from typing import Callable, List, Optional


def run_ffmpeg_with_progress(
    cmd: List[str],
    duration_s: float,
    on_progress: Optional[Callable[[float, Optional[float]], None]] = None,
    is_cancelled: Optional[Callable[[], bool]] = None,
    register_process: Optional[Callable[[subprocess.Popen], None]] = None,
) -> int:
    """Run ffmpeg with -progress pipe:1 and stream fraction-complete + ETA.

    cmd must already contain "-progress", "pipe:1", "-nostats" (callers can omit
    the user's own progress flags). duration_s is total expected output time.
    on_progress(pct, eta_s): pct in [0,1], eta in seconds (or None if unknown).
    is_cancelled(): polled; True → kill process and return early (-1).
    register_process(p): receives the Popen so caller can kill from elsewhere.
    Returns ffmpeg return code (or -1 if cancelled).
    """
    full = list(cmd)
    # Make sure progress flags are present.
    if "-progress" not in full:
        # Insert right after "ffmpeg" + global flags — put before output is fine.
        full = [full[0], "-progress", "pipe:1", "-nostats"] + full[1:]

    proc = subprocess.Popen(
        full,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        bufsize=1,
        universal_newlines=True,
    )
    if register_process is not None:
        try:
            register_process(proc)
        except Exception:
            pass

    start_t = time.time()
    out_time_s = 0.0
    try:
        for raw in proc.stdout:
            if is_cancelled and is_cancelled():
                proc.kill()
                proc.wait(timeout=5)
                return -1
            line = raw.strip()
            if not line or "=" not in line:
                continue
            key, _, val = line.partition("=")
            if key == "out_time_ms":
                try:
                    out_time_s = int(val) / 1_000_000.0
                except ValueError:
                    continue
            elif key == "out_time_us":
                try:
                    out_time_s = int(val) / 1_000_000.0
                except ValueError:
                    continue
            elif key == "out_time":
                # HH:MM:SS.micro format
                try:
                    h, m, s = val.split(":")
                    out_time_s = int(h) * 3600 + int(m) * 60 + float(s)
                except ValueError:
                    continue
            elif key == "progress" and val == "end":
                if on_progress:
                    on_progress(1.0, 0.0)
                break
            else:
                continue
            if duration_s > 0 and on_progress:
                pct = max(0.0, min(1.0, out_time_s / duration_s))
                elapsed = time.time() - start_t
                eta = (elapsed / pct - elapsed) if pct > 0.02 else None
                on_progress(pct, eta)
        proc.wait()
        return proc.returncode
    finally:
        try:
            proc.stdout.close()
        except Exception:
            pass


def probe_fps(path: str) -> float:
    """Return source video frame rate (e.g. 23.976, 25, 29.97). 25.0 fallback."""
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-select_streams", "v:0",
             "-show_entries", "stream=r_frame_rate", "-of",
             "default=noprint_wrappers=1:nokey=1", path],
            capture_output=True, timeout=10,
        )
        raw = (result.stdout or b"").decode(errors="replace").strip()
        if "/" in raw:
            num, den = raw.split("/", 1)
            return float(num) / float(den) if float(den) else 25.0
        return float(raw) if raw else 25.0
    except Exception:
        return 25.0


def probe_streams(path: str) -> dict:
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", path],
        capture_output=True,
    )
    data = json.loads(result.stdout or b"{}")
    video_streams, audio_streams = [], []
    for s in data.get("streams", []):
        codec_type = s.get("codec_type", "")
        codec_name = s.get("codec_name", "unknown").upper()
        tags = s.get("tags", {})
        parts = [codec_name]
        if s.get("width"):
            parts.append(f"{s['width']}x{s['height']}")
        if tags.get("language"):
            parts.append(tags["language"])
        if tags.get("title"):
            parts.append(tags["title"])
        label = " · ".join(parts)
        if codec_type == "video":
            video_streams.append({"relative_index": len(video_streams), "label": label})
        elif codec_type == "audio":
            audio_streams.append({"relative_index": len(audio_streams), "label": label})
    return {"video_streams": video_streams, "audio_streams": audio_streams}


def extract_segment(source: str, start: float, end: float, output: str,
                    video_stream: int = None, audio_stream: int = None):
    # -ss after -i = sample-accurate seek (avoids keyframe-snap 0-1s drift at clip head)
    map_args = []
    if video_stream is not None or audio_stream is not None:
        map_args += ["-map", f"0:v:{video_stream if video_stream is not None else 0}"]
        map_args += ["-map", f"0:a:{audio_stream if audio_stream is not None else 0}"]

    cmd = [
        "ffmpeg", "-y",
        "-i", source,
        "-ss", str(start),
        "-t", str(end - start),
        *map_args,
        "-c:v", "libx264",
        "-crf", "18",
        "-preset", "fast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-avoid_negative_ts", "make_zero",
        "-movflags", "+faststart",
        output,
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def extract_thumbnail(video_path: str, output_path: str, time: float = 1.0):
    cmd = [
        "ffmpeg", "-y",
        "-ss", str(max(0, time)),
        "-i", video_path,
        "-frames:v", "1",
        "-q:v", "3",
        "-vf", "scale=320:-1",
        output_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def export_gif(video_path: str, output_path: str, fps: int = 12, scale: int = 480,
               ss: float = None, duration: float = None):
    palette = output_path.replace(".gif", "_palette.png")
    seek = ["-ss", str(ss)] if ss is not None else []
    trim = ["-t", str(duration)] if duration is not None else []
    cmd1 = [
        "ffmpeg", "-y", *seek, "-i", video_path, *trim,
        "-vf", f"fps={fps},scale={scale}:-1:flags=lanczos,palettegen=stats_mode=diff",
        palette,
    ]
    subprocess.run(cmd1, check=True, capture_output=True)
    cmd2 = [
        "ffmpeg", "-y", *seek, "-i", video_path, "-i", palette, *trim,
        "-lavfi", f"fps={fps},scale={scale}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer",
        output_path,
    ]
    subprocess.run(cmd2, check=True, capture_output=True)
    if os.path.exists(palette):
        try:
            os.remove(palette)
        except OSError:
            pass


def burn_subtitles(video: str, ass_path: str, output: str):
    # Use relative path with forward slashes — avoids Windows drive-letter colon
    # breaking ffmpeg's filter option parser (ass=C\:/... mis-parses as separate options)
    rel_ass = ass_path.replace("\\", "/")
    cmd = [
        "ffmpeg", "-y",
        "-i", video,
        "-vf", f"ass={rel_ass}",
        "-c:v", "libx264",
        "-crf", "16",
        "-preset", "slow",
        "-pix_fmt", "yuv420p",
        "-bf", "0",
        "-c:a", "copy",
        output,
    ]
    result = subprocess.run(cmd, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.decode(errors="replace"))

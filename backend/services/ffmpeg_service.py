import subprocess
import os


def extract_segment(source: str, start: float, end: float, output: str):
    # -ss after -i = sample-accurate seek (avoids keyframe-snap 0-1s drift at clip head)
    cmd = [
        "ffmpeg", "-y",
        "-i", source,
        "-ss", str(start),
        "-t", str(end - start),
        "-c:v", "libx264",
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
        "-c:a", "copy",
        output,
    ]
    result = subprocess.run(cmd, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.decode(errors="replace"))

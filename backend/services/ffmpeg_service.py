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


def export_gif(video_path: str, output_path: str, fps: int = 12, scale: int = 480):
    palette = output_path.replace(".gif", "_palette.png")
    cmd1 = [
        "ffmpeg", "-y", "-i", video_path,
        "-vf", f"fps={fps},scale={scale}:-1:flags=lanczos,palettegen=stats_mode=diff",
        palette,
    ]
    subprocess.run(cmd1, check=True, capture_output=True)
    cmd2 = [
        "ffmpeg", "-y",
        "-i", video_path, "-i", palette,
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
    abs_ass = os.path.abspath(ass_path).replace("\\", "/")
    if ":" in abs_ass:
        drive, rest = abs_ass.split(":", 1)
        abs_ass = f"{drive}\\:{rest}"
    cmd = [
        "ffmpeg", "-y",
        "-i", video,
        "-vf", f"ass={abs_ass}",
        "-c:a", "copy",
        output,
    ]
    subprocess.run(cmd, check=True, capture_output=True)

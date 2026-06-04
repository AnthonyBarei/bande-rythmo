"""AI vocal separation — isolate VO (vocals) from the music/FX bed.

Uses Demucs (htdemucs, two-stems) if installed. Demucs is an optional heavy
dependency (model weights download on first run): `pip install demucs`. When
absent, separation_status() reports unavailable and separate() raises so the
route can return a clear message instead of failing opaquely.
"""
import importlib.util
import os
import subprocess
import sys


class VocalSeparationUnavailable(Exception):
    pass


def separation_status() -> dict:
    available = importlib.util.find_spec("demucs") is not None
    return {"available": available, "engine": "demucs" if available else None}


def separate(audio_path: str, out_dir: str, model: str = "htdemucs",
             on_progress=None, is_cancelled=None) -> dict:
    """Split `audio_path` into vocals + accompaniment (two-stems) under out_dir.
    Returns {vocals, no_vocals} paths. Raises VocalSeparationUnavailable if
    Demucs isn't installed."""
    if importlib.util.find_spec("demucs") is None:
        raise VocalSeparationUnavailable(
            "Demucs n'est pas installé. Installez-le côté backend : "
            "pip install demucs"
        )
    os.makedirs(out_dir, exist_ok=True)
    # Two-stems = vocals vs no_vocals; -o outdir; CPU is fine for short clips.
    cmd = [
        sys.executable, "-m", "demucs",
        "--two-stems", "vocals",
        "-n", model,
        "-o", out_dir,
        audio_path,
    ]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            text=True, bufsize=1)
    for line in proc.stdout:
        if is_cancelled and is_cancelled():
            proc.kill()
            proc.wait(timeout=5)
            raise VocalSeparationUnavailable("Annulé")
        if on_progress:
            # Demucs prints a percentage progress bar; surface it loosely.
            line = line.strip()
            if "%" in line:
                try:
                    pct = float(line.split("%")[0].split()[-1]) / 100.0
                    on_progress(max(0.0, min(1.0, pct)), None)
                except (ValueError, IndexError):
                    pass
    proc.wait()
    if proc.returncode != 0:
        raise VocalSeparationUnavailable(f"Demucs a échoué (code {proc.returncode})")

    # Demucs writes out_dir/<model>/<track_name>/{vocals,no_vocals}.wav
    base = os.path.splitext(os.path.basename(audio_path))[0]
    stem_dir = os.path.join(out_dir, model, base)
    vocals = os.path.join(stem_dir, "vocals.wav")
    no_vocals = os.path.join(stem_dir, "no_vocals.wav")
    return {"vocals": vocals, "no_vocals": no_vocals}

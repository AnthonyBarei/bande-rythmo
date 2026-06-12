"""Dub mixing — place recorded takes over the (ducked) source audio.

Closes the dubbing loop: record takes → mix → export a dubbed MP4.
Pure ffmpeg filter_complex, list-form args (no shell).

Audio bed precedence:
  segments/{clip_id}_bed.wav  (uploaded replacement / Demucs stem)  >  segment's own audio.
"""

import os
import subprocess

SEGMENTS_DIR = "segments"


def bed_path(clip_id: str) -> str:
    return os.path.join(SEGMENTS_DIR, f"{clip_id}_bed.wav")


def has_bed(clip_id: str) -> bool:
    return os.path.isfile(bed_path(clip_id))


def make_bed_from_file(clip_id: str, src_path: str):
    """Normalize any uploaded audio file to a 48 kHz stereo WAV bed."""
    out = bed_path(clip_id)
    cmd = [
        "ffmpeg", "-y", "-i", src_path,
        "-vn", "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le",
        out,
    ]
    proc = subprocess.run(cmd, capture_output=True)
    if proc.returncode != 0 or not os.path.isfile(out):
        raise RuntimeError("Conversion audio échouée (format non supporté ?)")
    return out


def mix_dub(
    segment_path: str,
    out_path: str,
    entries: list,            # [{path, at, gain_db}] — at = seconds into clip
    duck_db: float | None,    # negative dB applied to bed; None = mute the bed
    clip_id: str | None = None,
    loudnorm: bool = True,
):
    """Render segment video + mixed dub audio → MP4 (video stream copied)."""
    use_bed = clip_id is not None and has_bed(clip_id)

    inputs = ["-i", segment_path]
    if use_bed:
        inputs += ["-i", bed_path(clip_id)]
    for e in entries:
        inputs += ["-i", e["path"]]

    base_idx = 1 if use_bed else 0          # input index carrying the bed audio
    first_take = base_idx + 1

    parts = []
    mix_ins = []
    if duck_db is not None:
        parts.append(f"[{base_idx}:a]volume={duck_db}dB[bed]")
        mix_ins.append("[bed]")
    # duck_db None → bed muted: simply not fed into amix.

    for i, e in enumerate(entries):
        idx = first_take + i
        delay_ms = max(0, int(round(float(e.get("at", 0)) * 1000)))
        gain = float(e.get("gain_db", 0))
        # adelay needs one value per channel; 'all=1' covers mono and stereo.
        parts.append(
            f"[{idx}:a]aresample=48000,adelay={delay_ms}:all=1,volume={gain}dB[t{i}]"
        )
        mix_ins.append(f"[t{i}]")

    if not mix_ins:
        raise ValueError("Aucune piste à mixer")

    if len(mix_ins) == 1:
        mix = f"{mix_ins[0]}anull[premix]"
    else:
        # normalize=0: keep absolute levels, we control gains explicitly.
        mix = f"{''.join(mix_ins)}amix=inputs={len(mix_ins)}:duration=first:normalize=0[premix]"
    parts.append(mix)

    if loudnorm:
        parts.append("[premix]loudnorm=I=-16:TP=-1.5:LRA=11[mix]")
    else:
        parts.append("[premix]anull[mix]")

    # apad+shortest: takes may end after the video; pad bed then cut at video end.
    cmd = [
        "ffmpeg", "-y", *inputs,
        "-filter_complex", ";".join(parts),
        "-map", "0:v", "-map", "[mix]",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        out_path,
    ]
    proc = subprocess.run(cmd, capture_output=True)
    if proc.returncode != 0 or not os.path.isfile(out_path):
        tail = (proc.stderr or b"").decode(errors="replace")[-400:]
        raise RuntimeError(f"Mixage ffmpeg échoué: {tail}")
    return out_path

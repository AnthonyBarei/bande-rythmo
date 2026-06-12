import asyncio
import json
import os
import shutil
import struct
import subprocess
import tempfile
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Any, Dict, List

from database import get_db, SessionLocal
from services.clip_service import (
    create_clip, delete_clip, get_clip,
    list_clips, update_name, update_status, update_subtitles,
    update_boucles, update_fps, update_scene_cuts, update_project,
)
from services.ffmpeg_service import extract_segment, extract_thumbnail, probe_streams, probe_fps, detect_scene_cuts, make_proxy
from services.jobs import create_job, raise_if_cancelled, CancelledJobError, JobStartResponse
from services.subtitle_import_service import parse_subtitle_file
from services.vocal_service import separate as separate_vocals, separation_status, VocalSeparationUnavailable

router = APIRouter()


class UpdateSubtitlesRequest(BaseModel):
    subtitles: List[Dict[str, Any]]


class UpdateBouclesRequest(BaseModel):
    boucles: List[Dict[str, Any]]


class RenameRequest(BaseModel):
    name: str


class ProjectRequest(BaseModel):
    project: str = ""


class StatusRequest(BaseModel):
    status: str


class FpsRequest(BaseModel):
    fps: float


class ProbeLocalRequest(BaseModel):
    path: str


class BatchLocalClip(BaseModel):
    name: str = ""
    start: float
    end: float
    video_stream: int | None = None
    audio_stream: int | None = None


class BatchLocalRequest(BaseModel):
    path: str
    source_filename: str = ""
    clips: List[BatchLocalClip]


def _copy_upload(src, dst_path: str):
    with open(dst_path, 'wb') as dst:
        shutil.copyfileobj(src, dst)


@router.post("/batch")
async def create_batch(
    file: UploadFile = File(...),
    clips_json: str = Form(...),
    db: Session = Depends(get_db),
):
    clips_data = json.loads(clips_json)
    if not clips_data:
        raise HTTPException(400, "No clips provided")

    ext = os.path.splitext(file.filename or "video.mp4")[1] or ".mp4"
    source_filename = file.filename or "video"
    tmp_path = None
    extracted = []
    source_fps = 25.0

    try:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        # Source fps once per upload — passed to every clip carved out of it.
        source_fps = await asyncio.to_thread(probe_fps, tmp_path)

        for c in clips_data:
            clip_id = str(uuid.uuid4())
            segment_path = f"segments/{clip_id}.mp4"
            thumb_path = f"thumbnails/{clip_id}.jpg"
            video_stream = c.get("video_stream")
            audio_stream = c.get("audio_stream")

            await asyncio.to_thread(
                extract_segment, tmp_path, float(c["start"]), float(c["end"]), segment_path,
                video_stream, audio_stream,
            )

            try:
                mid = (float(c["end"]) - float(c["start"])) / 2
                await asyncio.to_thread(extract_thumbnail, segment_path, thumb_path, mid)
            except Exception:
                thumb_path = None

            extracted.append({
                "clip_id": clip_id,
                "name": (c.get("name") or "").strip() or f"Clip {clip_id[:6]}",
                "start": float(c["start"]),
                "end": float(c["end"]),
                "segment_path": segment_path,
                "thumbnail_path": thumb_path,
            })

    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    return [
        create_clip(
            db, e["clip_id"], e["name"], source_filename,
            e["start"], e["end"], e["segment_path"], e["thumbnail_path"],
            fps=source_fps,
        )
        for e in extracted
    ]


@router.post("/batch-local-job", response_model=JobStartResponse)
async def create_batch_local_job(req: BatchLocalRequest):
    """Job-mode batch clip cut from a local/HTTP source.
    Per-clip progress: pct = (i + sub_pct) / total. Cancel = job.cancel_event.
    Worker owns its own DB session — request session is closed by the time
    the BG task runs."""
    if not req.path.startswith("http") and not os.path.isfile(req.path):
        raise HTTPException(400, f"File not found: {req.path}")
    if not req.clips:
        raise HTTPException(400, "No clips provided")

    source_filename = req.source_filename or os.path.basename(req.path)
    total = len(req.clips)
    clips_data = [c.dict() for c in req.clips]
    path = req.path
    job = create_job("import-batch", title=f"Découpe {total} clip{'s' if total > 1 else ''}")

    def worker():
        db = SessionLocal()
        try:
            job.update(stage="Analyse source (fps)", pct=0.02)
            raise_if_cancelled(job)
            source_fps = probe_fps(path)

            results = []
            for i, c in enumerate(clips_data):
                raise_if_cancelled(job)
                base = i / total
                stride = 1.0 / total
                clip_id = str(uuid.uuid4())
                segment_path = f"segments/{clip_id}.mp4"
                thumb_path = f"thumbnails/{clip_id}.jpg"

                job.update(stage=f"Extraction clip {i+1}/{total}", pct=base + stride * 0.10)
                extract_segment(path, c["start"], c["end"], segment_path,
                                c.get("video_stream"), c.get("audio_stream"))
                raise_if_cancelled(job)

                job.update(stage=f"Vignette clip {i+1}/{total}", pct=base + stride * 0.85)
                try:
                    mid = (c["end"] - c["start"]) / 2
                    extract_thumbnail(segment_path, thumb_path, mid)
                except Exception:
                    thumb_path = None

                row = create_clip(
                    db, clip_id, c["name"].strip() or f"Clip {clip_id[:6]}",
                    source_filename, c["start"], c["end"], segment_path, thumb_path,
                    source_path=path, fps=source_fps,
                )
                results.append(row)

            job.done({"clips": results, "count": len(results)})
        except CancelledJobError:
            pass
        except Exception as e:
            job.fail(str(e))
        finally:
            db.close()

    asyncio.get_running_loop().run_in_executor(None, worker)
    return {"job_id": job.id}


@router.post("/probe-local")
async def probe_streams_local(req: ProbeLocalRequest):
    if not req.path.startswith("http") and not os.path.isfile(req.path):
        raise HTTPException(400, f"File not found: {req.path}")
    return await asyncio.to_thread(probe_streams, req.path)


@router.post("/batch-local")
async def create_batch_local(req: BatchLocalRequest, db: Session = Depends(get_db)):
    if not req.path.startswith("http") and not os.path.isfile(req.path):
        raise HTTPException(400, f"File not found: {req.path}")
    if not req.clips:
        raise HTTPException(400, "No clips provided")

    source_filename = req.source_filename or os.path.basename(req.path)
    extracted = []
    source_fps = await asyncio.to_thread(probe_fps, req.path)

    for c in req.clips:
        clip_id = str(uuid.uuid4())
        segment_path = f"segments/{clip_id}.mp4"
        thumb_path = f"thumbnails/{clip_id}.jpg"

        await asyncio.to_thread(
            extract_segment, req.path, c.start, c.end, segment_path,
            c.video_stream, c.audio_stream,
        )

        try:
            mid = (c.end - c.start) / 2
            await asyncio.to_thread(extract_thumbnail, segment_path, thumb_path, mid)
        except Exception:
            thumb_path = None

        extracted.append({
            "clip_id": clip_id,
            "name": c.name.strip() or f"Clip {clip_id[:6]}",
            "start": c.start,
            "end": c.end,
            "segment_path": segment_path,
            "thumbnail_path": thumb_path,
        })

    return [
        create_clip(
            db, e["clip_id"], e["name"], source_filename,
            e["start"], e["end"], e["segment_path"], e["thumbnail_path"],
            source_path=req.path,
            fps=source_fps,
        )
        for e in extracted
    ]


@router.get("/")
async def list_all(db: Session = Depends(get_db)):
    return list_clips(db)


@router.get("/{clip_id}")
async def get_one(clip_id: str, db: Session = Depends(get_db)):
    clip = get_clip(db, clip_id)
    if not clip:
        raise HTTPException(404, "Clip not found")
    return clip


@router.put("/{clip_id}/subtitles")
async def set_subtitles(clip_id: str, req: UpdateSubtitlesRequest, db: Session = Depends(get_db)):
    clip = update_subtitles(db, clip_id, req.subtitles)
    if not clip:
        raise HTTPException(404, "Clip not found")
    return clip


@router.post("/{clip_id}/import-subtitles")
async def import_subtitles(
    clip_id: str,
    file: UploadFile = File(...),
    mode: str = Form("replace"),   # "replace" | "append"
    db: Session = Depends(get_db),
):
    """Import subtitles from SRT / ASS / SSA / VTT.
    mode=replace clears existing subs; mode=append merges and re-sorts."""
    clip = get_clip(db, clip_id)
    if not clip:
        raise HTTPException(404, "Clip not found")

    raw = await file.read()
    # Try UTF-8, fall back to latin-1 (common in older SRT files)
    try:
        content = raw.decode('utf-8')
    except UnicodeDecodeError:
        content = raw.decode('latin-1', errors='replace')

    parsed = parse_subtitle_file(file.filename or "import.srt", content)
    if not parsed:
        raise HTTPException(422, "No subtitles found in file — check format (SRT/ASS/VTT)")

    if mode == "append":
        existing = clip.get("subtitles") or []
        merged = list(existing) + [
            {"start": s["start"], "end": s["end"],
             "character": s.get("character", ""),
             "text": s["text"], "words": None,
             "off": False, "dos": False, "ambiance": False, "plan_cut": None}
            for s in parsed
        ]
        merged.sort(key=lambda x: x["start"])
        # Re-number order_index
        for i, sub in enumerate(merged):
            sub["order_index"] = i
        updated = update_subtitles(db, clip_id, merged)
    else:
        subs = [
            {"start": s["start"], "end": s["end"],
             "character": s.get("character", ""),
             "text": s["text"], "words": None,
             "off": False, "dos": False, "ambiance": False, "plan_cut": None,
             "order_index": i}
            for i, s in enumerate(parsed)
        ]
        updated = update_subtitles(db, clip_id, subs)

    return {
        "ok": True,
        "imported": len(parsed),
        "mode": mode,
        "clip": updated,
    }


@router.put("/{clip_id}/boucles")
async def set_boucles(clip_id: str, req: UpdateBouclesRequest, db: Session = Depends(get_db)):
    clip = update_boucles(db, clip_id, req.boucles)
    if not clip:
        raise HTTPException(404, "Clip not found")
    return clip


@router.post("/{clip_id}/proxy", response_model=JobStartResponse)
async def make_clip_proxy(clip_id: str, height: int = 720):
    """Generate a 720p (default) proxy for smooth scrubbing of large segments.
    Job-mode: poll /api/jobs/{id}. Output → segments/{clip_id}_proxy.mp4."""
    segment = f"segments/{clip_id}.mp4"
    if not os.path.isfile(segment):
        raise HTTPException(404, "Segment file missing")
    output = f"segments/{clip_id}_proxy.mp4"
    job = create_job("proxy", title=f"Proxy {height}p")

    def worker():
        try:
            job.update(stage=f"Encodage proxy {height}p", pct=0.02)
            raise_if_cancelled(job)
            def on_prog(pct, eta):
                job.update(stage=f"Encodage proxy {height}p", pct=0.02 + 0.96 * pct, eta=eta)
            rc = make_proxy(
                segment, output, height,
                on_progress=on_prog,
                is_cancelled=lambda: job.cancelled,
                register_process=lambda p: setattr(job, "process", p),
            )
            if rc == -1 or job.cancelled:
                return
            if rc != 0:
                job.fail(f"ffmpeg returned {rc}")
                return
            job.done({"proxy_path": output, "clip_id": clip_id})
        except CancelledJobError:
            pass
        except Exception as e:
            job.fail(str(e))

    asyncio.get_running_loop().run_in_executor(None, worker)
    return {"job_id": job.id}


@router.delete("/{clip_id}/proxy")
async def delete_clip_proxy(clip_id: str):
    output = f"segments/{clip_id}_proxy.mp4"
    if os.path.isfile(output):
        try:
            os.remove(output)
        except OSError:
            pass
    return {"ok": True}


@router.get("/vocal-separation/status")
async def vocal_status():
    """Is Demucs available for vocal separation (UI gates the feature)."""
    return separation_status()


@router.post("/{clip_id}/separate-vocals", response_model=JobStartResponse)
async def separate_clip_vocals(clip_id: str):
    """Isolate vocals (VO) from the music/FX bed via Demucs. Job-mode.
    Outputs under segments/stems/; result paths returned in the job."""
    segment = f"segments/{clip_id}.mp4"
    if not os.path.isfile(segment):
        raise HTTPException(404, "Segment file missing")
    if not separation_status()["available"]:
        raise HTTPException(503, "Demucs n'est pas installé (pip install demucs)")
    job = create_job("vocals", title="Séparation vocale")

    def worker():
        try:
            job.update(stage="Séparation (Demucs)", pct=0.05)
            out_dir = "segments/stems"

            def on_prog(pct, eta):
                job.update(stage="Séparation (Demucs)", pct=0.05 + 0.92 * pct, eta=eta)

            res = separate_vocals(segment, out_dir,
                                  on_progress=on_prog,
                                  is_cancelled=lambda: job.cancelled)
            if job.cancelled:
                return
            # Expose web paths (segments/ is statically mounted).
            job.done({
                "vocals": res["vocals"].replace("\\", "/"),
                "no_vocals": res["no_vocals"].replace("\\", "/"),
                "clip_id": clip_id,
            })
        except VocalSeparationUnavailable as e:
            job.fail(str(e))
        except CancelledJobError:
            pass
        except Exception as e:
            job.fail(str(e))

    asyncio.get_running_loop().run_in_executor(None, worker)
    return {"job_id": job.id}


# ── Audio bed (Phase 1 — dubbed export) ─────────────────────────────────────
# segments/{clip_id}_bed.wav replaces the segment's own audio as the mix base.

@router.post("/{clip_id}/replace-audio")
async def replace_audio(clip_id: str, audio: UploadFile = File(...), db: Session = Depends(get_db)):
    """Upload an audio file (wav/mp3/m4a/...) to use as the clip's audio bed."""
    from services.mix_service import make_bed_from_file
    if not get_clip(db, clip_id):
        raise HTTPException(404, "Clip not found")
    ext = os.path.splitext(audio.filename or "audio.wav")[1] or ".wav"
    tmp = f"segments/{clip_id}_bed_upload{ext}"
    try:
        with open(tmp, "wb") as dst:
            shutil.copyfileobj(audio.file, dst)
        await asyncio.to_thread(make_bed_from_file, clip_id, tmp)
    except RuntimeError as exc:
        raise HTTPException(400, str(exc))
    finally:
        if os.path.isfile(tmp):
            try:
                os.remove(tmp)
            except OSError:
                pass
    return {"ok": True, "has_bed": True}


class UseStemRequest(BaseModel):
    stem: str = "no_vocals"   # 'no_vocals' (instrumental) | 'vocals'


@router.post("/{clip_id}/use-stem")
async def use_stem_as_bed(clip_id: str, req: UseStemRequest, db: Session = Depends(get_db)):
    """Promote a Demucs stem (from separate-vocals) to the clip's audio bed."""
    from services.mix_service import make_bed_from_file
    if req.stem not in ("vocals", "no_vocals"):
        raise HTTPException(400, "stem must be 'vocals' or 'no_vocals'")
    if not get_clip(db, clip_id):
        raise HTTPException(404, "Clip not found")
    stem_path = os.path.join("segments", "stems", "htdemucs", clip_id, f"{req.stem}.wav")
    if not os.path.isfile(stem_path):
        raise HTTPException(404, "Stem introuvable — lancez d'abord la séparation vocale")
    await asyncio.to_thread(make_bed_from_file, clip_id, stem_path)
    return {"ok": True, "has_bed": True, "stem": req.stem}


@router.delete("/{clip_id}/audio-bed")
async def delete_audio_bed(clip_id: str):
    """Back to the segment's original audio."""
    p = f"segments/{clip_id}_bed.wav"
    if os.path.isfile(p):
        try:
            os.remove(p)
        except OSError:
            raise HTTPException(500, "Impossible de supprimer la piste")
    return {"ok": True, "has_bed": False}


@router.post("/{clip_id}/detect-scenes")
async def detect_scenes(clip_id: str, threshold: float = 0.4, db: Session = Depends(get_db)):
    """Detect scene-change timecodes in the clip segment and persist them.
    threshold 0..1 — higher = fewer/harder cuts (default 0.4)."""
    clip = get_clip(db, clip_id)
    if not clip:
        raise HTTPException(404, "Clip not found")
    segment = f"segments/{clip_id}.mp4"
    if not os.path.isfile(segment):
        raise HTTPException(404, "Segment file missing")
    cuts = await asyncio.to_thread(detect_scene_cuts, segment, threshold)
    updated = update_scene_cuts(db, clip_id, cuts)
    return {"ok": True, "count": len(cuts), "scene_cuts": cuts, "clip": updated}


@router.delete("/{clip_id}/scenes")
async def clear_scenes(clip_id: str, db: Session = Depends(get_db)):
    updated = update_scene_cuts(db, clip_id, [])
    if not updated:
        raise HTTPException(404, "Clip not found")
    return {"ok": True, "clip": updated}


@router.put("/{clip_id}/fps")
async def set_fps(clip_id: str, req: FpsRequest, db: Session = Depends(get_db)):
    if req.fps <= 0:
        raise HTTPException(400, "fps must be positive")
    clip = update_fps(db, clip_id, req.fps)
    if not clip:
        raise HTTPException(404, "Clip not found")
    return clip


@router.put("/{clip_id}/project")
async def set_project(clip_id: str, req: ProjectRequest, db: Session = Depends(get_db)):
    clip = update_project(db, clip_id, req.project)
    if not clip:
        raise HTTPException(404, "Clip not found")
    return clip


@router.put("/{clip_id}/name")
async def rename(clip_id: str, req: RenameRequest, db: Session = Depends(get_db)):
    clip = update_name(db, clip_id, req.name)
    if not clip:
        raise HTTPException(404, "Clip not found")
    return clip


@router.put("/{clip_id}/status")
async def set_status(clip_id: str, req: StatusRequest, db: Session = Depends(get_db)):
    clip = update_status(db, clip_id, req.status)
    if not clip:
        raise HTTPException(404, "Clip not found or invalid status")
    return clip


@router.delete("/{clip_id}")
async def delete(clip_id: str, db: Session = Depends(get_db)):
    if not delete_clip(db, clip_id):
        raise HTTPException(404, "Clip not found")
    return {"ok": True}


@router.get("/{clip_id}/waveform")
async def get_waveform(clip_id: str, samples: int = 400):
    path = f"segments/{clip_id}.mp4"
    if not os.path.exists(path):
        raise HTTPException(404, "Segment not found")

    sr = 8000
    cmd = ["ffmpeg", "-i", path, "-vn", "-ac", "1", "-ar", str(sr), "-f", "s16le", "pipe:1"]
    result = await asyncio.to_thread(subprocess.run, cmd, capture_output=True, timeout=30)
    data = result.stdout
    if not data or len(data) < 2:
        return {"samples": [], "duration": 0.0, "onsets": []}

    n = len(data) // 2
    raw = struct.unpack(f"{n}h", data)
    duration = n / sr

    chunk = max(1, n // samples)
    peaks = []
    for i in range(0, n - chunk + 1, chunk):
        seg = raw[i: i + chunk]
        peaks.append(round(max(abs(s) for s in seg) / 32768.0, 3))

    onsets = []
    threshold = 1800
    release = 600
    min_gap = int(0.15 * sr)
    win = int(0.005 * sr)
    in_sound = False
    last_idx = -min_gap
    hop = max(1, win)
    for i in range(0, n, hop):
        seg = raw[i: i + hop]
        amp = max(abs(s) for s in seg) if seg else 0
        if not in_sound and amp > threshold and (i - last_idx) > min_gap:
            onsets.append(round(i / sr, 3))
            last_idx = i
            in_sound = True
        elif in_sound and amp < release:
            in_sound = False

    return {"samples": peaks, "duration": round(duration, 3), "onsets": onsets, "sample_rate": sr}

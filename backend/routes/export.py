from fastapi import APIRouter, Depends, HTTPException, File, Form, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Any, Dict, List, Optional

from database import get_db
from services.clip_service import get_clip
from services.subtitle_service import (
    export_srt, export_ass, export_ass_karaoke, export_detx, export_croisille,
)
from services.ffmpeg_service import burn_subtitles, export_gif, run_ffmpeg_with_progress, h264_encoder_args, available_hw_encoders
from services.br_renderer import render_br_video
from services.jobs import create_job, raise_if_cancelled, CancelledJobError, JobStartResponse
from services.export_service import record_export, list_exports, get_export, delete_export
from database import SessionLocal
import asyncio
import logging
import uuid
import os
import json
import subprocess

log = logging.getLogger("br.export")

router = APIRouter()


class Sign(BaseModel):
    i: int
    type: str
    t0: float
    t1: float


class Word(BaseModel):
    w: str
    start: float
    end: float
    signs: Optional[List[Sign]] = None


class Subtitle(BaseModel):
    start: float
    end: float
    character: str = ""
    text: str
    words: Optional[List[Word]] = None
    off: bool = False
    dos: bool = False
    ambiance: bool = False
    plan_cut: Optional[float] = None


class Boucle(BaseModel):
    number: int = 1
    start: float
    end: float


class ExportRequest(BaseModel):
    subtitles: List[Subtitle] = []
    boucles: List[Boucle] = []
    segment_id: str
    format: str  # "srt" | "ass" | "ass-karaoke" | "detx" | "mp4" | "gif" | "mp3" | "wav" | "croisille"
    in_point: float = None
    out_point: float = None
    px_per_sec: float = 180.0
    br_offset: float = 0.0
    canvas_w: int = 1200   # canvas coordinate width (CSS px) — used to scale pxPerSec to video px
    canvas_h: int = 64     # canvas coordinate height = numTracks * H_TRACK
    br_font: str = "atkinson"   # BR font picker id — keeps export WYSIWYG with preview
    br_style: str = "classique"  # rythmo style: classique | neon | minimal
    detection_burn: bool = False  # burn graphite détection signs into MP4 — pro option, default off
    # Quality preset — trades render time for fidelity.
    #   draft    : supersample 2, preset fast,   crf 23  (≈3× faster, preview-quality)
    #   standard : supersample 3, preset medium, crf 21  (default — balanced)
    #   youtube  : supersample 4, preset slow,   crf 19  (final upload — slowest)
    quality: str = "standard"
    gpu: str = "off"   # off | auto | nvenc | qsv | amf — HW-accelerated H.264 encode




def _trim_subs_to_range(subs: list, a: float, b: float) -> list:
    """Keep subs overlapping [a,b], clamp to it, shift so a → 0. Words + sign
    timespans shift too. plan_cut kept only if inside the range."""
    out = []
    for s in subs:
        if s["end"] <= a or s["start"] >= b:
            continue
        ns = dict(s)
        ns["start"] = max(0.0, s["start"] - a)
        ns["end"] = max(0.0, min(s["end"], b) - a)
        words = s.get("words")
        if words:
            nw = []
            for w in words:
                if w["end"] <= a or w["start"] >= b:
                    continue
                ww = dict(w)
                ww["start"] = max(0.0, w["start"] - a)
                ww["end"] = max(0.0, min(w["end"], b) - a)
                if w.get("signs"):
                    ww["signs"] = [
                        {**sg, "t0": max(0.0, sg["t0"] - a), "t1": max(0.0, sg["t1"] - a)}
                        for sg in w["signs"]
                    ]
                nw.append(ww)
            ns["words"] = nw or None
        pc = s.get("plan_cut")
        ns["plan_cut"] = (pc - a) if (pc is not None and a <= pc <= b) else None
        out.append(ns)
    return out


class DubEntry(BaseModel):
    take_id: int
    at: Optional[float] = None      # seconds into clip; default = subtitle.start
    gain_db: float = 0.0


class DubMixRequest(BaseModel):
    segment_id: str
    entries: List[DubEntry]
    duck_db: Optional[float] = -12.0  # bed attenuation; ignored if mute_bed
    mute_bed: bool = False
    loudnorm: bool = True


@router.post("/mp4-dubbed")
async def export_mp4_dubbed(req: DubMixRequest, db: Session = Depends(get_db)):
    """Mix recorded takes over the (ducked/muted) source audio → dubbed MP4.

    Take placement: explicit `at`, else the start of the take's réplique
    (subtitle_index), else 0. Video stream is copied (fast, lossless)."""
    from models import Take
    from services.mix_service import mix_dub

    segment = f"segments/{req.segment_id}.mp4"
    if not os.path.exists(segment):
        raise HTTPException(404, "Segment not found")
    if not req.entries:
        raise HTTPException(400, "Aucune prise sélectionnée")

    clip_row = get_clip(db, req.segment_id) or {}
    subs = clip_row.get("subtitles") or []

    entries = []
    for e in req.entries:
        take = db.query(Take).filter(Take.id == e.take_id).first()
        if not take or take.clip_id != req.segment_id:
            raise HTTPException(404, f"Prise {e.take_id} introuvable pour ce clip")
        if not os.path.isfile(take.audio_path):
            raise HTTPException(404, f"Fichier audio manquant pour la prise {e.take_id}")
        at = e.at
        if at is None and take.subtitle_index is not None and take.subtitle_index < len(subs):
            at = subs[take.subtitle_index]["start"]
        entries.append({"path": take.audio_path, "at": at or 0.0, "gain_db": e.gain_db})

    export_id = str(uuid.uuid4())
    output = f"exports/{export_id}_dubbed.mp4"
    duck = None if req.mute_bed else (req.duck_db if req.duck_db is not None else -12.0)
    try:
        await asyncio.to_thread(
            mix_dub, segment, output, entries,
            duck, clip_id=req.segment_id, loudnorm=req.loudnorm,
        )
    except (RuntimeError, ValueError) as exc:
        log.error("dub mix failed for clip %s: %s", req.segment_id, exc)
        raise HTTPException(500, "Mixage échoué — vérifiez les prises sélectionnées")

    try:
        record_export(db, clip_id=req.segment_id, format="mp4-dubbed", path=output,
                      filename="clip_double.mp4", media_type="video/mp4",
                      params={"takes": len(entries), "duck_db": duck, "loudnorm": req.loudnorm})
    except Exception:
        log.exception("export history write failed (mp4-dubbed, clip %s)", req.segment_id)
    return FileResponse(output, filename="clip_double.mp4", media_type="video/mp4")


@router.post("/export")
async def export(req: ExportRequest, db: Session = Depends(get_db)):
    export_id = str(uuid.uuid4())
    segment = f"segments/{req.segment_id}.mp4"
    # Clip carries fps for SMPTE/DetX accuracy and boucles for croisillé.
    clip_row = get_clip(db, req.segment_id) or {}
    clip_fps = float(clip_row.get("fps") or 25.0)

    if req.format == "gif":
        if not os.path.exists(segment):
            raise HTTPException(404, "Segment not found")
        output = f"exports/{export_id}.gif"
        ss = req.in_point if req.in_point is not None else None
        dur = (req.out_point - req.in_point) if (req.in_point is not None and req.out_point is not None) else None
        await asyncio.to_thread(export_gif, segment, output, 12, 480, ss, dur)
        try:
            record_export(db, clip_id=req.segment_id, format="gif",
                          path=output, filename="clip.gif", media_type="image/gif")
        except Exception:
            log.exception("export history write failed (gif, clip %s)", req.segment_id)
        return FileResponse(output, filename="clip.gif", media_type="image/gif")

    subs = [
        {
            "start": s.start, "end": s.end, "character": s.character, "text": s.text,
            "words": [
                {
                    "w": w.w, "start": w.start, "end": w.end,
                    "signs": [sg.dict() for sg in w.signs] if w.signs else None,
                }
                for w in s.words
            ] if s.words else None,
            "off": s.off, "dos": s.dos, "ambiance": s.ambiance, "plan_cut": s.plan_cut,
        }
        for s in req.subtitles
    ]

    # Custom time-range: keep subs overlapping [in,out], clamp + shift to 0.
    # Applies to every subtitle format (SRT/ASS/DetX/croisillé).
    if req.in_point is not None and req.out_point is not None and req.out_point > req.in_point:
        subs = _trim_subs_to_range(subs, req.in_point, req.out_point)

    def _persist(fmt: str, path: str, filename: str, media_type: str):
        try:
            record_export(db, clip_id=req.segment_id, format=fmt,
                          path=path, filename=filename, media_type=media_type)
        except Exception:
            log.exception("export history write failed (%s, clip %s)", fmt, req.segment_id)

    if req.format == "srt":
        path = f"exports/{export_id}.srt"
        export_srt(subs, path)
        _persist("srt", path, "bande_rythmo.srt", "text/plain")
        return FileResponse(path, filename="bande_rythmo.srt", media_type="text/plain")

    elif req.format == "ass":
        path = f"exports/{export_id}.ass"
        export_ass(subs, path)
        _persist("ass", path, "bande_rythmo.ass", "text/plain")
        return FileResponse(path, filename="bande_rythmo.ass", media_type="text/plain")

    elif req.format == "ass-karaoke":
        path = f"exports/{export_id}.ass"
        export_ass_karaoke(subs, path)
        _persist("ass-karaoke", path, "bande_rythmo_karaoke.ass", "text/plain")
        return FileResponse(path, filename="bande_rythmo_karaoke.ass", media_type="text/plain")

    elif req.format == "detx":
        path = f"exports/{export_id}.detx"
        export_detx(subs, path, fps=clip_fps, video_path=segment)
        _persist("detx", path, "bande_rythmo.detx", "application/xml")
        return FileResponse(path, filename="bande_rythmo.detx", media_type="application/xml")

    elif req.format == "croisille":
        path = f"exports/{export_id}_croisille.html"
        boucles = [b.dict() for b in (req.boucles or [])]
        if not boucles:
            boucles = clip_row.get("boucles", []) or []
        export_croisille(subs, boucles, path, title=clip_row.get("name", "Bande Rythmo"), fps=clip_fps)
        _persist("croisille", path, "croisille.html", "text/html")
        return FileResponse(path, filename="croisille.html", media_type="text/html")

    elif req.format == "mp4":
        if not os.path.exists(segment):
            raise HTTPException(404, "Segment not found")

        # Probe video dimensions, fps, and duration
        probe = await asyncio.to_thread(
            subprocess.run,
            ["ffprobe", "-v", "quiet", "-print_format", "json",
             "-show_streams", "-show_format", segment],
            capture_output=True,
        )
        vw, vh, fps_str, duration_s = 1920, 1080, "24/1", 0.0
        try:
            data = json.loads(probe.stdout)
            vs = next(s for s in data["streams"] if s.get("codec_type") == "video")
            vw = vs["width"]
            vh = vs["height"]
            fps_str = vs.get("r_frame_rate", "24/1")
            duration_s = float(vs.get("duration", 0) or 0)
            if duration_s <= 0:
                duration_s = float(data.get("format", {}).get("duration", 0) or 0)
        except Exception:
            log.warning("ffprobe failed for %s — using fallback dimensions", segment, exc_info=True)

        # Parse fps fraction (e.g. "24000/1001" → 23.976)
        try:
            num, den = fps_str.split("/")
            fps = float(num) / float(den)
        except Exception:
            fps = 24.0

        if duration_s <= 0:
            duration_s = 60.0

        # Export at 60fps — matches standard 60Hz displays, so the scrolling BR
        # has no display-cadence judder on playback. Source picture frames are
        # resampled up by ffmpeg (-r); the BR strip is rendered natively at 60.
        export_fps = 60.0 if fps <= 60 else fps

        # Scale canvas units → video pixels
        scale = vw / max(req.canvas_w, 1)
        px_per_sec_video = req.px_per_sec * scale
        br_h_video = max(40, int(req.canvas_h * scale))
        # Ensure even height (required by yuv420p)
        if br_h_video % 2 != 0:
            br_h_video += 1

        strip_path = f"exports/{export_id}_strip.mkv"
        output = f"exports/{export_id}_rythmo.mp4"

        try:
            await asyncio.to_thread(
                render_br_video,
                subs, vw, br_h_video,
                px_per_sec_video, export_fps, duration_s,
                strip_path,
                req.br_offset,
                br_font=req.br_font,
                style=req.br_style,
            )
        except Exception as e:
            raise HTTPException(500, f"br_renderer error: {str(e)}")

        # Stack the BR band BELOW the picture (vstack) — the movie image stays
        # full, never covered. The movie+band composite is then letterboxed into
        # a standard 1920×1080 frame: scaled to fit (nothing cropped/distorted),
        # black bars fill the remainder → plays everywhere, predictable size.
        # Both inputs forced onto an identical export_fps grid + pixel format
        # before vstack: without the fps match, vstack mispairs the two streams
        # (different timebases) and ~1/3 of the 60fps BR frames duplicate →
        # scroll judders; vstack also requires identical width + pixel format.
        # -bf 0 disables B-frames — prevents ghosting/smear on scrolling text.
        cmd = [
            "ffmpeg", "-y",
            "-i", segment,
            "-i", strip_path,
            "-filter_complex",
            f"[0:v]fps={export_fps},format=yuv420p[bg];"
            f"[1:v]fps={export_fps},format=yuv420p[s];"
            f"[bg][s]vstack=inputs=2:shortest=1,"
            f"scale=1920:1080:force_original_aspect_ratio=decrease,"
            f"pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1",
            "-c:v", "libx264",
            "-crf", "21",
            "-preset", "slow",
            "-pix_fmt", "yuv420p",
            "-bf", "0",
            "-r", str(export_fps),
            "-c:a", "copy",
            output,
        ]
        result = await asyncio.to_thread(subprocess.run, cmd, capture_output=True)
        if result.returncode != 0:
            raise HTTPException(500, f"ffmpeg overlay error: {result.stderr.decode(errors='replace')}")

        return FileResponse(output, filename="bande_rythmo.mp4", media_type="video/mp4")

    elif req.format in ("mp3", "wav"):
        if not os.path.exists(segment):
            raise HTTPException(404, "Segment not found")
        ext = req.format
        output = f"exports/{export_id}.{ext}"
        cmd = ["ffmpeg", "-y"]
        if req.in_point is not None:
            cmd += ["-ss", str(req.in_point)]
        cmd += ["-i", segment, "-vn"]
        if req.in_point is not None and req.out_point is not None:
            cmd += ["-t", str(req.out_point - req.in_point)]
        if ext == "mp3":
            cmd += ["-c:a", "libmp3lame", "-q:a", "2"]
        else:
            cmd += ["-c:a", "pcm_s16le"]
        cmd.append(output)
        await asyncio.to_thread(subprocess.run, cmd, check=True, capture_output=True)
        media = "audio/mpeg" if ext == "mp3" else "audio/wav"
        _persist(ext, output, f"clip.{ext}", media)
        return FileResponse(output, filename=f"clip.{ext}", media_type=media)

    else:
        raise HTTPException(400, "format must be srt, ass, ass-karaoke, detx, mp4, gif, mp3, or wav")


@router.post("/gif-job", response_model=JobStartResponse)
async def export_gif_job(req: ExportRequest, db: Session = Depends(get_db)):
    """GIF export (two-pass palette) wrapped as a cancellable job.
    Returns {job_id}; result file is fetched via /api/jobs/{id}/result."""
    if req.format != "gif":
        raise HTTPException(400, "gif-job only accepts format=gif")

    segment = f"segments/{req.segment_id}.mp4"
    if not os.path.exists(segment):
        raise HTTPException(404, "Segment not found")

    job = create_job("export-gif", title="Export GIF")
    export_id = str(uuid.uuid4())
    in_point = req.in_point
    out_point = req.out_point

    def worker():
        try:
            ss = in_point if in_point is not None else None
            dur = (out_point - in_point) if (in_point is not None and out_point is not None) else None
            duration_s = dur if dur and dur > 0 else 10.0

            output = f"exports/{export_id}.gif"
            palette = output.replace(".gif", "_palette.png")
            seek = ["-ss", str(ss)] if ss is not None else []
            trim = ["-t", str(dur)] if dur is not None else []

            # Pass 1: palette generation.
            job.update(stage="Génération palette", pct=0.05)
            raise_if_cancelled(job)
            cmd1 = [
                "ffmpeg", "-y", "-progress", "pipe:1", "-nostats",
                *seek, "-i", segment, *trim,
                "-vf", "fps=12,scale=480:-1:flags=lanczos,palettegen=stats_mode=diff",
                palette,
            ]
            rc = run_ffmpeg_with_progress(
                cmd1, duration_s,
                on_progress=lambda p, eta: job.update(stage="Génération palette", pct=0.05 + 0.40 * p, eta=eta),
                is_cancelled=lambda: job.cancelled,
                register_process=lambda p: setattr(job, "process", p),
            )
            if rc == -1 or job.cancelled: return
            if rc != 0: job.fail(f"palette pass returned {rc}"); return

            # Pass 2: encode with palette.
            job.update(stage="Encodage GIF", pct=0.45)
            cmd2 = [
                "ffmpeg", "-y", "-progress", "pipe:1", "-nostats",
                *seek, "-i", segment, "-i", palette, *trim,
                "-lavfi", "fps=12,scale=480:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer",
                output,
            ]
            rc = run_ffmpeg_with_progress(
                cmd2, duration_s,
                on_progress=lambda p, eta: job.update(stage="Encodage GIF", pct=0.45 + 0.55 * p, eta=eta),
                is_cancelled=lambda: job.cancelled,
                register_process=lambda p: setattr(job, "process", p),
            )
            if rc == -1 or job.cancelled: return
            if rc != 0: job.fail(f"encode pass returned {rc}"); return

            try: os.remove(palette)
            except OSError: pass

            db = SessionLocal()
            try:
                record_export(
                    db, clip_id=req.segment_id, format="gif",
                    path=output, filename="clip.gif",
                    media_type="image/gif",
                    params={"in_point": req.in_point, "out_point": req.out_point},
                )
            finally:
                db.close()

            job.done({
                "kind": "file",
                "path": output,
                "filename": "clip.gif",
                "media_type": "image/gif",
            })
        except CancelledJobError:
            pass
        except Exception as e:
            job.fail(str(e))

    asyncio.get_running_loop().run_in_executor(None, worker)
    return {"job_id": job.id}


@router.post("/mp4-job", response_model=JobStartResponse)
async def export_mp4_job(req: ExportRequest, db: Session = Depends(get_db)):
    """MP4 burn with progress + cancel. Returns {job_id}; client polls /api/jobs/{id}
    and fetches the file via /api/jobs/{id}/result when status=done."""
    if req.format != "mp4":
        raise HTTPException(400, "mp4-job only accepts format=mp4")

    segment = f"segments/{req.segment_id}.mp4"
    if not os.path.exists(segment):
        raise HTTPException(404, "Segment not found")

    clip_row = get_clip(db, req.segment_id) or {}
    job = create_job("export-mp4", title="Export MP4")
    export_id = str(uuid.uuid4())

    # Snapshot the request (Pydantic objects don't cross threads safely after the request ends).
    subs_data = [
        {
            "start": s.start, "end": s.end, "character": s.character, "text": s.text,
            "words": [
                {
                    "w": w.w, "start": w.start, "end": w.end,
                    "signs": [sg.dict() for sg in w.signs] if w.signs else None,
                }
                for w in s.words
            ] if s.words else None,
            "off": s.off, "dos": s.dos, "ambiance": s.ambiance, "plan_cut": s.plan_cut,
        }
        for s in req.subtitles
    ]
    px_per_sec = req.px_per_sec
    br_offset = req.br_offset
    canvas_w = req.canvas_w
    canvas_h = req.canvas_h
    br_font = req.br_font
    br_style = req.br_style

    # Quality preset — single source of truth for render + encode knobs.
    QUALITY_PRESETS = {
        "draft":    {"supersample": 2, "x264_preset": "fast",   "crf": "23"},
        "standard": {"supersample": 3, "x264_preset": "medium", "crf": "21"},
        "youtube":  {"supersample": 4, "x264_preset": "slow",   "crf": "19"},
    }
    qp = QUALITY_PRESETS.get((req.quality or "standard").lower(), QUALITY_PRESETS["standard"])

    def worker():
        try:
            job.update(stage="Probe vidéo", pct=0.02)
            raise_if_cancelled(job)

            probe = subprocess.run(
                ["ffprobe", "-v", "quiet", "-print_format", "json",
                 "-show_streams", "-show_format", segment],
                capture_output=True,
            )
            vw, vh, fps_str, duration_s = 1920, 1080, "24/1", 0.0
            try:
                data = json.loads(probe.stdout)
                vs = next(s for s in data["streams"] if s.get("codec_type") == "video")
                vw = vs["width"]
                vh = vs["height"]
                fps_str = vs.get("r_frame_rate", "24/1")
                duration_s = float(vs.get("duration", 0) or 0)
                if duration_s <= 0:
                    duration_s = float(data.get("format", {}).get("duration", 0) or 0)
            except Exception:
                log.warning("ffprobe failed for %s (mp4 job) — fallback metrics", segment, exc_info=True)
            try:
                num, den = fps_str.split("/")
                src_fps = float(num) / float(den)
            except Exception:
                src_fps = 24.0
            if duration_s <= 0:
                duration_s = 60.0

            # Custom time-range — trim subs to [in,out], render only that span;
            # the segment input is seeked/limited in the vstack cmd below.
            range_ss = None
            if req.in_point is not None and req.out_point is not None and req.out_point > req.in_point:
                range_ss = req.in_point
                duration_s = req.out_point - req.in_point
                subs_local = _trim_subs_to_range(subs_data, req.in_point, req.out_point)
            else:
                subs_local = subs_data

            export_fps = 60.0 if src_fps <= 60 else src_fps
            scale = vw / max(canvas_w, 1)
            px_per_sec_video = px_per_sec * scale
            br_h_video = max(40, int(canvas_h * scale))
            if br_h_video % 2 != 0:
                br_h_video += 1

            strip_path = f"exports/{export_id}_strip.mkv"
            output = f"exports/{export_id}_rythmo.mp4"

            # Stage 1: render BR strip (no internal progress hook — estimated 0 → 0.45).
            job.update(stage="Rendu bande rythmo", pct=0.05)
            raise_if_cancelled(job)
            render_br_video(
                subs_local, vw, br_h_video,
                px_per_sec_video, export_fps, duration_s,
                strip_path, br_offset,
                br_font=br_font, style=br_style,
                supersample=qp["supersample"],
                detection_burn=req.detection_burn,
            )
            raise_if_cancelled(job)
            job.update(stage="Encodage final", pct=0.45)

            # Stage 2: ffmpeg vstack + encode → live progress via -progress pipe.
            # HW encoder when requested+usable; libx264 fallback. -bf 0 kept on
            # all paths (no B-frames → no ghosting on the scrolling text).
            venc_args, venc_name = h264_encoder_args(req.gpu, qp["crf"], qp["x264_preset"])
            # Seek/limit the segment input to the export range (strip is already
            # rendered for exactly [in,out]). -ss before -i = fast keyframe seek.
            seg_in = (["-ss", str(range_ss), "-t", str(duration_s)] if range_ss is not None else [])
            cmd = [
                "ffmpeg", "-y",
                "-progress", "pipe:1", "-nostats",
                *seg_in,
                "-i", segment,
                "-i", strip_path,
                "-filter_complex",
                f"[0:v]fps={export_fps},format=yuv420p[bg];"
                f"[1:v]fps={export_fps},format=yuv420p[s];"
                f"[bg][s]vstack=inputs=2:shortest=1,"
                f"scale=1920:1080:force_original_aspect_ratio=decrease,"
                f"pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1",
                *venc_args,
                "-pix_fmt", "yuv420p",
                "-bf", "0",
                "-r", str(export_fps),
                "-c:a", "copy",
                output,
            ]

            def on_prog(pct: float, eta):
                # Map ffmpeg pct [0,1] → overall [0.45, 1.00].
                job.update(stage="Encodage final", pct=0.45 + 0.55 * pct, eta=eta)

            def cancelled() -> bool:
                return job.cancelled

            rc = run_ffmpeg_with_progress(
                cmd, duration_s,
                on_progress=on_prog,
                is_cancelled=cancelled,
                register_process=lambda p: setattr(job, "process", p),
            )
            if rc == -1 or job.cancelled:
                return
            if rc != 0:
                job.fail(f"ffmpeg returned {rc}")
                return

            # Persist to exports table so the user can re-download later.
            db = SessionLocal()
            try:
                record_export(
                    db, clip_id=req.segment_id, format="mp4",
                    path=output, filename="bande_rythmo.mp4",
                    media_type="video/mp4", quality=req.quality,
                    params={"px_per_sec": px_per_sec, "br_offset": br_offset,
                            "canvas_w": canvas_w, "canvas_h": canvas_h,
                            "br_font": br_font, "br_style": br_style,
                            "detection_burn": req.detection_burn},
                )
            finally:
                db.close()

            job.done({
                "kind": "file",
                "path": output,
                "filename": "bande_rythmo.mp4",
                "media_type": "video/mp4",
            })
        except CancelledJobError:
            pass
        except Exception as e:
            job.fail(str(e))

    asyncio.get_running_loop().run_in_executor(None, worker)
    return {"job_id": job.id}


@router.get("/hw-encoders")
async def hw_encoders():
    """Which HW H.264 encoders are usable on this machine (for the export UI).
    Maps ffmpeg names → short ids the frontend picker uses."""
    avail = await asyncio.to_thread(available_hw_encoders)
    return {
        "nvenc": "h264_nvenc" in avail,
        "qsv": "h264_qsv" in avail,
        "amf": "h264_amf" in avail,
        "any": len(avail) > 0,
    }


@router.get("/list")
async def list_exports_route(clip_id: str = None, db: Session = Depends(get_db)):
    """List persisted exports, optionally filtered by clip_id (most recent first)."""
    return list_exports(db, clip_id)


@router.get("/download/{export_id}")
async def download_export(export_id: int, db: Session = Depends(get_db)):
    """Re-download a previously produced export."""
    e = get_export(db, export_id)
    if not e:
        raise HTTPException(404, "Export not found")
    if not os.path.exists(e.path):
        raise HTTPException(410, "Export file missing on disk")
    return FileResponse(e.path, filename=e.filename, media_type=e.media_type)


@router.delete("/{export_id}")
async def delete_export_route(export_id: int, db: Session = Depends(get_db)):
    if not delete_export(db, export_id):
        raise HTTPException(404, "Export not found")
    return {"ok": True}


@router.post("/mp4-canvas")
async def export_mp4_canvas(
    segment_id: str = Form(...),
    overlay: UploadFile = File(...),
):
    export_id = str(uuid.uuid4())
    segment = f"segments/{segment_id}.mp4"
    if not os.path.exists(segment):
        raise HTTPException(404, "Segment not found")

    # Save canvas overlay
    overlay_path = f"exports/{export_id}_overlay.webm"
    with open(overlay_path, "wb") as f:
        f.write(await overlay.read())

    # Get video width via ffprobe
    probe = await asyncio.to_thread(
        subprocess.run,
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", segment],
        capture_output=True,
    )
    vw, fps = 1280, "30/1"
    try:
        data = json.loads(probe.stdout)
        vs = next(s for s in data["streams"] if s.get("codec_type") == "video")
        vw = vs["width"]
        fps = vs.get("r_frame_rate", "30/1")
    except Exception:
        log.warning("ffprobe failed (canvas overlay) — fallback 1280/30fps", exc_info=True)

    output = f"exports/{export_id}_canvas_rythmo.mp4"
    # Normalize overlay timestamps then convert to CFR matching video fps.
    # setpts=PTS-STARTPTS removes gaps/offsets from MediaRecorder VFR webm before
    # the fps filter selects frames — prevents inconsistent frame selection (jump artifacts).
    filter_complex = (
        f"[1:v]setpts=PTS-STARTPTS,fps={fps},scale={vw}:-2[br];"
        f"[0:v][br]overlay=0:main_h-overlay_h:shortest=1"
    )
    cmd = [
        "ffmpeg", "-y",
        "-i", segment,
        "-i", overlay_path,
        "-filter_complex", filter_complex,
        "-c:v", "libx264",
        "-crf", "16",
        "-preset", "slow",
        "-pix_fmt", "yuv420p",
        "-bf", "0",          # no B-frames — prevents ghosting/smear on scrolling text
        "-c:a", "copy",
        output,
    ]
    result = await asyncio.to_thread(subprocess.run, cmd, capture_output=True)
    if result.returncode != 0:
        raise HTTPException(500, f"ffmpeg: {result.stderr.decode(errors='replace')}")

    return FileResponse(output, filename="bande_rythmo_canvas.mp4", media_type="video/mp4")

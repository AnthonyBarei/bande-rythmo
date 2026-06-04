from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.whisper_service import transcribe_segment
from services.jobs import create_job, get_job, raise_if_cancelled, CancelledJobError, JobStartResponse
import asyncio
import os

router = APIRouter()


class TranscribeRequest(BaseModel):
    segment_id: str
    language: Optional[str] = "fr"
    diarize: bool = True


@router.post("/transcribe")
async def transcribe(req: TranscribeRequest):
    """Synchronous transcribe — kept for back-compat. Prefer /transcribe-job."""
    path = f"segments/{req.segment_id}.mp4"
    if not os.path.exists(path):
        raise HTTPException(404, "Segment not found")
    subtitles = await asyncio.to_thread(transcribe_segment, path, req.language, req.diarize)
    return {"subtitles": subtitles}


@router.post("/transcribe-job", response_model=JobStartResponse)
async def transcribe_job(req: TranscribeRequest):
    """Fire-and-poll: returns {job_id}. Poll /api/jobs/{id}, fetch result with /api/jobs/{id}/result."""
    path = f"segments/{req.segment_id}.mp4"
    if not os.path.exists(path):
        raise HTTPException(404, "Segment not found")
    job = create_job("transcribe", title="Transcription Whisper")

    def worker():
        try:
            def on_progress(stage: str, pct: float):
                # Whisper segment iterator can't be killed mid-flight (C++ ext),
                # but raising here breaks the for-loop in transcribe_segment.
                raise_if_cancelled(job)
                job.update(stage=stage, pct=pct)

            def cancelled() -> bool:
                return job.cancelled

            subs = transcribe_segment(
                path, req.language, req.diarize,
                progress=on_progress, is_cancelled=cancelled,
            )
            if job.cancelled:
                return
            job.done({"subtitles": subs})
        except CancelledJobError:
            pass
        except Exception as e:
            job.fail(str(e))

    asyncio.get_event_loop().run_in_executor(None, worker)
    return {"job_id": job.id}

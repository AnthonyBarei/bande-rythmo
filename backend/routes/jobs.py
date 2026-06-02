"""Job control routes — poll status, cancel, fetch result, WS stream."""

import asyncio
import os
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse

from services.jobs import get_job, cleanup_old_jobs

router = APIRouter()


@router.get("/{job_id}")
async def status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job.to_dict()


@router.post("/{job_id}/cancel")
async def cancel(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    job.cancel()
    return {"ok": True, "status": job.status}


@router.get("/{job_id}/result")
async def result(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status != "done":
        raise HTTPException(409, f"Job status: {job.status}")

    res = job.result
    if isinstance(res, dict) and res.get("kind") == "file":
        path = res.get("path", "")
        if not os.path.isfile(path):
            raise HTTPException(404, "Result file missing")
        return FileResponse(
            path,
            filename=res.get("filename"),
            media_type=res.get("media_type", "application/octet-stream"),
        )
    return JSONResponse(res or {})


@router.post("/cleanup")
async def cleanup():
    removed = cleanup_old_jobs()
    return {"removed": removed}


@router.websocket("/{job_id}/ws")
async def ws_progress(websocket: WebSocket, job_id: str):
    """Streams job state changes as JSON frames.

    Frame shape: same as GET /api/jobs/{id} response (to_dict()) plus optional
    `final: true` on the last frame (done/error/cancelled). Client closes
    socket after the final frame.
    """
    job = get_job(job_id)
    if not job:
        await websocket.close(code=4404, reason="Job not found")
        return
    await websocket.accept()
    queue = job.subscribe()
    try:
        # If the job is already finished, send one frame + finalise.
        if job.status != "running":
            await websocket.send_json({**job.to_dict(), "final": True})
            return

        while True:
            # Tolerate client → server pings without blocking the producer.
            try:
                frame = await asyncio.wait_for(queue.get(), timeout=30.0)
            except asyncio.TimeoutError:
                # Heartbeat keeps proxies from closing idle sockets.
                await websocket.send_json({"heartbeat": True, "id": job.id, "status": job.status})
                continue
            await websocket.send_json(frame)
            if frame.get("final"):
                return
    except WebSocketDisconnect:
        pass
    finally:
        job.unsubscribe(queue)

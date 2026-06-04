"""In-memory job registry for long-running ops (Whisper, MP4 burn, Plex remux).

Frontend polls GET /api/jobs/{id} every ~1s for {stage, pct, eta, status}.
POST /api/jobs/{id}/cancel sets cancel_event + kills attached subprocess.
GET /api/jobs/{id}/result delivers the final file or JSON when status=done.
"""

from __future__ import annotations

import asyncio
import threading
import time
import uuid
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class JobStartResponse(BaseModel):
    """Standard response from any endpoint that kicks off a background job.
    Client polls GET /api/jobs/{id} or opens WS /api/jobs/{id}/ws; downloads
    final artifact (if any) from GET /api/jobs/{id}/result."""
    job_id: str


class JobStatus(BaseModel):
    id: str
    kind: str
    title: str
    stage: str
    pct: float
    eta: Optional[float] = None
    status: str  # running | done | error | cancelled
    error: Optional[str] = None
    created_at: float
    updated_at: float
    elapsed: float
    has_result: bool


JOBS: Dict[str, "Job"] = {}
_lock = threading.Lock()

# Captured on app startup; jobs running in threads use this to wake subscribers.
_loop: Optional[asyncio.AbstractEventLoop] = None


def bind_loop(loop: asyncio.AbstractEventLoop):
    """Called once from the FastAPI lifespan so threaded job workers can push
    state changes back to coroutine subscribers (WebSocket handlers)."""
    global _loop
    _loop = loop


class Job:
    __slots__ = (
        "id", "kind", "title",
        "stage", "pct", "eta",
        "status", "error", "result",
        "cancel_event", "process",
        "created_at", "updated_at",
        "subscribers",
    )

    def __init__(self, kind: str, title: str = ""):
        self.id = str(uuid.uuid4())
        self.kind = kind
        self.title = title
        self.stage = ""
        self.pct = 0.0
        self.eta: Optional[float] = None
        self.status = "running"   # running | done | error | cancelled
        self.error: Optional[str] = None
        self.result: Any = None
        self.cancel_event = threading.Event()
        self.process = None       # optional subprocess.Popen for hard kill
        now = time.time()
        self.created_at = now
        self.updated_at = now
        # WS subscribers — asyncio.Queue per connected client. Producer threads
        # push state via _loop.call_soon_threadsafe(_emit).
        self.subscribers: List[asyncio.Queue] = []

    def update(self, *, stage: Optional[str] = None, pct: Optional[float] = None, eta: Optional[float] = None):
        if stage is not None:
            self.stage = stage
        if pct is not None:
            self.pct = max(0.0, min(1.0, float(pct)))
        if eta is not None:
            self.eta = eta
        self.updated_at = time.time()
        self._notify()

    def done(self, result: Any = None):
        self.status = "done"
        self.pct = 1.0
        self.result = result
        self.updated_at = time.time()
        self._notify(final=True)

    def fail(self, error: str):
        if self.status == "running":
            self.status = "error"
            self.error = str(error)
            self.updated_at = time.time()
            self._notify(final=True)

    def cancel(self):
        self.cancel_event.set()
        proc = self.process
        if proc is not None:
            try:
                proc.kill()
            except Exception:
                pass
        if self.status == "running":
            self.status = "cancelled"
            self.updated_at = time.time()
            self._notify(final=True)

    def _notify(self, final: bool = False):
        """Push the current state to every WS subscriber. Safe from worker threads."""
        if not self.subscribers:
            return
        payload = self.to_dict()
        if final:
            payload["final"] = True
        loop = _loop
        if loop is None or loop.is_closed():
            return
        for q in list(self.subscribers):
            try:
                loop.call_soon_threadsafe(q.put_nowait, payload)
            except Exception:
                pass

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=64)
        self.subscribers.append(q)
        # Send current state immediately so the client has something to render.
        try:
            q.put_nowait(self.to_dict())
        except Exception:
            pass
        return q

    def unsubscribe(self, q: asyncio.Queue):
        try:
            self.subscribers.remove(q)
        except ValueError:
            pass

    @property
    def cancelled(self) -> bool:
        return self.cancel_event.is_set()

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "kind": self.kind,
            "title": self.title,
            "stage": self.stage,
            "pct": self.pct,
            "eta": self.eta,
            "status": self.status,
            "error": self.error,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "elapsed": time.time() - self.created_at,
            "has_result": self.result is not None,
        }


def create_job(kind: str, title: str = "") -> Job:
    job = Job(kind, title)
    with _lock:
        JOBS[job.id] = job
    return job


def get_job(job_id: str) -> Optional[Job]:
    return JOBS.get(job_id)


def cleanup_old_jobs(max_age_s: float = 3600.0) -> int:
    """Drop finished jobs older than max_age. Returns count removed."""
    now = time.time()
    removed = 0
    with _lock:
        for jid in list(JOBS.keys()):
            j = JOBS[jid]
            if j.status in ("done", "error", "cancelled") and now - j.updated_at > max_age_s:
                JOBS.pop(jid, None)
                removed += 1
    return removed


class CancelledJobError(Exception):
    """Raised inside a job worker when its cancel_event fires."""
    pass


def raise_if_cancelled(job: Job):
    if job.cancelled:
        raise CancelledJobError()

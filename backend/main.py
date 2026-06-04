from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from dotenv import load_dotenv

load_dotenv()

from database import init_db
from routes import video, transcription, export, clips, meme, files, plex, takes, jobs, fonts, lexicon
from services import jobs as jobs_service
import asyncio


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Threaded job workers push progress via call_soon_threadsafe — capture the
    # running loop now so they can wake WS subscribers.
    jobs_service.bind_loop(asyncio.get_running_loop())
    yield


app = FastAPI(title="Bande Rythmo API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

for d in ("segments", "exports", "thumbnails", "memes", "sources", "takes", "uploads/fonts"):
    os.makedirs(d, exist_ok=True)

app.include_router(video.router, prefix="/api/video", tags=["video"])
app.include_router(transcription.router, prefix="/api/transcription", tags=["transcription"])
app.include_router(export.router, prefix="/api/export", tags=["export"])
app.include_router(clips.router, prefix="/api/clips", tags=["clips"])
app.include_router(meme.router, prefix="/api/meme", tags=["meme"])
app.include_router(files.router, prefix="/api/files", tags=["files"])
app.include_router(plex.router, prefix="/api/plex", tags=["plex"])
app.include_router(takes.router, prefix="/api/takes", tags=["takes"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])
app.include_router(fonts.router, prefix="/api/fonts", tags=["fonts"])
app.include_router(lexicon.router, prefix="/api/lexicon", tags=["lexicon"])

app.mount("/segments", StaticFiles(directory="segments"), name="segments")
app.mount("/exports", StaticFiles(directory="exports"), name="exports")
app.mount("/thumbnails", StaticFiles(directory="thumbnails"), name="thumbnails")
app.mount("/memes", StaticFiles(directory="memes"), name="memes")
app.mount("/takes", StaticFiles(directory="takes"), name="takes")
app.mount("/uploads-fonts", StaticFiles(directory="uploads/fonts"), name="uploads-fonts")

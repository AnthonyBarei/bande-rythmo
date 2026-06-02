import os
import subprocess
import tempfile
import torch
from faster_whisper import WhisperModel
from typing import Callable, List, Dict, Optional

# Progress callback signature: progress(stage: str, pct: float in [0,1])
ProgressFn = Callable[[str, float], None]
# Cancel callback: returns True to abort early.
CancelFn = Callable[[], bool]

_model: Optional[WhisperModel] = None
_diarize_pipeline = None

_DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
_COMPUTE_TYPE = "float16" if _DEVICE == "cuda" else "int8"
_MODEL_NAME = os.getenv("WHISPER_MODEL", "large-v3")


def _get_model() -> WhisperModel:
    global _model
    if _model is None:
        _model = WhisperModel(_MODEL_NAME, device=_DEVICE, compute_type=_COMPUTE_TYPE)
    return _model


def _get_diarize_pipeline():
    global _diarize_pipeline
    if _diarize_pipeline is None:
        hf_token = os.getenv("HF_TOKEN")
        if not hf_token:
            return None
        from pyannote.audio import Pipeline
        _diarize_pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            token=hf_token,
        )
        if _DEVICE == "cuda":
            _diarize_pipeline = _diarize_pipeline.to(torch.device("cuda"))
    return _diarize_pipeline


def _build_diarization_map(path: str) -> Dict[tuple, str]:
    try:
        pipeline = _get_diarize_pipeline()
        if not pipeline:
            return {}
        diarization = pipeline(path)
        return {
            (turn.start, turn.end): speaker
            for turn, _, speaker in diarization.itertracks(yield_label=True)
        }
    except Exception:
        return {}


def _assign_speaker(start: float, end: float, diar_map: Dict[tuple, str]) -> str:
    best_speaker = ""
    best_overlap = 0.0
    for (d_start, d_end), speaker in diar_map.items():
        overlap = max(0.0, min(end, d_end) - max(start, d_start))
        if overlap > best_overlap:
            best_overlap = overlap
            best_speaker = speaker
    return best_speaker


def transcribe_segment(
    path: str,
    language: str = "fr",
    diarize: bool = True,
    progress: Optional[ProgressFn] = None,
    is_cancelled: Optional[CancelFn] = None,
) -> List[Dict]:
    """Transcribe a segment with optional progress + cancel hooks.

    progress(stage, pct):
      "Extraction audio"   0.00 → 0.05
      "Transcription"      0.05 → 0.85 (driven by seg.end / duration)
      "Diarisation"        0.85 → 0.95 (only if diarize=True)
      "Mise en forme"      0.95 → 1.00
    is_cancelled(): polled between segments; returning True aborts early
    and the function returns whatever has been transcribed so far.
    """

    def emit(stage: str, pct: float):
        if progress is not None:
            try:
                progress(stage, pct)
            except Exception:
                pass

    def aborted() -> bool:
        return bool(is_cancelled and is_cancelled())

    # Extract audio as WAV to avoid AAC pre-roll timestamp drift.
    # MP4 segments cut from the middle of a video can have up to ~1s of audio
    # before the nominal start (AAC keyframe alignment). Whisper would include
    # that pre-roll in its timestamps, shifting all subtitles forward by ~1s.
    # Extracting with pcm_s16le + first_pts=0 gives Whisper a clean 0-anchored stream.
    emit("Extraction audio", 0.0)
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.close()
    wav_path = tmp.name

    output: List[Dict] = []
    diar_map: Dict[tuple, str] = {}

    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", path,
                "-vn", "-c:a", "pcm_s16le", "-ar", "16000", "-ac", "1",
                "-af", "aresample=first_pts=0",
                wav_path,
            ],
            check=True,
            capture_output=True,
        )
        emit("Transcription", 0.05)
        if aborted():
            return output

        model = _get_model()
        segments_iter, info = model.transcribe(
            wav_path,
            language=language,
            word_timestamps=True,
            vad_filter=True,
            no_speech_threshold=0.6,
            log_prob_threshold=-1.0,
        )
        total_dur = float(getattr(info, "duration", 0) or 0)

        # Stream segments — yields incrementally, lets us report progress + cancel.
        for seg in segments_iter:
            if aborted():
                break
            text = seg.text.strip()
            if total_dur > 0:
                frac = min(1.0, max(0.0, float(seg.end) / total_dur))
                emit("Transcription", 0.05 + 0.80 * frac)
            if not text or set(text) <= set('. '):
                continue
            words = seg.words or []
            start = words[0].start if words else seg.start
            end = words[-1].end if words else seg.end
            if end - start < 0.05:
                continue
            word_list = [
                {"w": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3)}
                for w in words if w.word and w.word.strip()
            ] or None
            output.append({
                "start": round(start, 3),
                "end": round(end, 3),
                "character": "",
                "text": text,
                "words": word_list,
            })

        if aborted():
            return output

        if diarize:
            emit("Diarisation", 0.85)
            diar_map = _build_diarization_map(path)
    finally:
        try:
            os.remove(wav_path)
        except OSError:
            pass

    if diar_map:
        emit("Mise en forme", 0.95)
        for sub in output:
            sub["character"] = _assign_speaker(sub["start"], sub["end"], diar_map) or ""

    emit("Terminé", 1.0)
    return output

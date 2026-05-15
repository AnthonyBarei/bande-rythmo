import os
import torch
from faster_whisper import WhisperModel
from typing import List, Dict, Optional

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


def transcribe_segment(path: str, language: str = "fr", diarize: bool = True) -> List[Dict]:
    model = _get_model()
    segments_iter, _ = model.transcribe(
        path,
        language=language,
        word_timestamps=True,
        vad_filter=True,
        no_speech_threshold=0.6,
        log_prob_threshold=-1.0,
    )
    segments = list(segments_iter)

    diar_map = _build_diarization_map(path) if diarize else {}

    output = []
    for seg in segments:
        text = seg.text.strip()
        if not text or set(text) <= set('. '):
            continue
        words = seg.words or []
        start = words[0].start if words else seg.start
        end = words[-1].end if words else seg.end
        if end - start < 0.05:
            continue
        speaker = _assign_speaker(start, end, diar_map) if diar_map else ""
        output.append({
            "start": round(start, 3),
            "end": round(end, 3),
            "character": speaker,
            "text": text,
        })
    return output

import whisper
from typing import List, Dict

_model = None


def _get_model():
    global _model
    if _model is None:
        _model = whisper.load_model("base")
    return _model


def transcribe_segment(path: str, language: str = "fr") -> List[Dict]:
    model = _get_model()
    # word_timestamps=True enables DTW alignment — much more accurate start/end times
    result = model.transcribe(path, language=language, word_timestamps=True)
    segments = []
    for seg in result["segments"]:
        words = seg.get("words", [])
        # Use first/last word timestamps when available — more accurate than segment-level
        start = words[0]["start"] if words else seg["start"]
        end = words[-1]["end"] if words else seg["end"]
        segments.append({
            "start": round(start, 3),
            "end": round(end, 3),
            "character": "",
            "text": seg["text"].strip(),
        })
    return segments

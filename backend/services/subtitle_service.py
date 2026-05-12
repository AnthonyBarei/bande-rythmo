from typing import List, Dict


def _to_srt_time(s: float) -> str:
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    sec = int(s % 60)
    ms = int(round(s % 1, 3) * 1000)
    return f"{h:02d}:{m:02d}:{sec:02d},{ms:03d}"


def _to_ass_time(s: float) -> str:
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    sec = s % 60
    return f"{h}:{m:02d}:{sec:05.2f}"


def export_srt(subtitles: List[Dict], path: str):
    blocks = []
    for i, sub in enumerate(subtitles, 1):
        character = sub.get("character", "")
        text = f"{character}: {sub['text']}" if character else sub['text']
        blocks.append(
            f"{i}\n{_to_srt_time(sub['start'])} --> {_to_srt_time(sub['end'])}\n{text}\n"
        )
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(blocks))


def _build_ass_styles(characters: List[str]) -> str:
    base = (
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
        "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding\n"
    )
    # One style per character with different base Y (assigned at dialogue level via \move)
    return base + (
        "Style: Rythmo,Courier New,52,&H00FFFFFF,&H000000FF,&H00000000,"
        "&HFF000000,-1,0,0,0,100,100,0,0,1,2,0,7,0,0,0,1\n"
    )


def export_ass(subtitles: List[Dict], path: str):
    # Assign vertical tracks per character
    seen = []
    for sub in subtitles:
        c = sub.get("character", "")
        if c not in seen:
            seen.append(c)
    num_tracks = max(1, len(seen))
    track_h = 1080 // num_tracks
    char_y = {c: int(i * track_h + track_h / 2) for i, c in enumerate(seen)}

    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        "PlayResX: 1920\n"
        "PlayResY: 1080\n\n"
        "[V4+ Styles]\n"
        f"{_build_ass_styles(seen)}\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )
    lines = [header]
    for sub in subtitles:
        start = _to_ass_time(sub["start"])
        end = _to_ass_time(sub["end"])
        character = sub.get("character", "")
        text = sub["text"].replace("{", "\\{").replace("}", "\\}")
        y = char_y.get(character, 540)
        tagged = f"{{\\an7\\move(1920,{y},-500,{y})}}{text}"
        lines.append(f"Dialogue: 0,{start},{end},Rythmo,{character},0,0,0,,{tagged}")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

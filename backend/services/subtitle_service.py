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


# Per-character colors (BGR in ASS: &HBBGGRR&)
_TRACK_COLORS = [
    "&H00FFFFFF&",  # white
    "&H0044FFFF&",  # yellow
    "&H00FF8844&",  # blue
    "&H0044FF88&",  # green
    "&H00FF44AA&",  # pink
    "&H00AAAAFF&",  # salmon
]

# BR band: bottom 22% of 1080p
_BR_TOP = 840       # y where band starts
_BR_HEIGHT = 240    # px tall
_FONT_SIZE = 44
_SCROLL_START_X = 1940   # starts just off right edge
_SCROLL_END_X = -600     # ends past left edge


def _build_ass_styles(characters: List[str]) -> str:
    fmt = (
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
        "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding\n"
    )
    styles = fmt
    # Background style
    styles += (
        "Style: BRBg,Arial,20,&H00000000,&H000000FF,&H00000000,&HCC000000,"
        "0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1\n"
    )
    # One style per character
    for i, c in enumerate(characters):
        color = _TRACK_COLORS[i % len(_TRACK_COLORS)]
        name = f"BR_{i}"
        styles += (
            f"Style: {name},Courier New,{_FONT_SIZE},{color},&H000000FF,&H00000000,"
            f"&HAA000000,0,0,0,0,100,100,2,0,1,1,0,7,0,0,0,1\n"
        )
    return styles


def export_ass(subtitles: List[Dict], path: str):
    # Collect unique characters in order
    seen = []
    for sub in subtitles:
        c = sub.get("character", "")
        if c not in seen:
            seen.append(c)
    num_tracks = max(1, len(seen))
    track_h = _BR_HEIGHT // num_tracks
    # Y center of each track within the BR band
    char_y = {c: _BR_TOP + int(i * track_h + track_h / 2) for i, c in enumerate(seen)}
    char_style = {c: f"BR_{i}" for i, c in enumerate(seen)}

    # Find overall time range for background
    all_starts = [s["start"] for s in subtitles] if subtitles else [0]
    all_ends   = [s["end"]   for s in subtitles] if subtitles else [0]
    bg_start = _to_ass_time(min(all_starts))
    bg_end   = _to_ass_time(max(all_ends))

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

    # Semi-transparent dark background band covering full clip duration
    bg_rect = (
        f"{{\\an7\\pos(0,{_BR_TOP})\\p1}}"
        f"m 0 0 l 1920 0 1920 {_BR_HEIGHT} 0 {_BR_HEIGHT}"
        "{\\p0}"
    )
    lines.append(f"Dialogue: 0,{bg_start},{bg_end},BRBg,,0,0,0,,{bg_rect}")

    # Character name labels pinned on left, one per track
    for c in seen:
        y = char_y[c]
        label = (c[:12] if c else "—").replace("{", "\\{").replace("}", "\\}")
        style = char_style[c]
        color = _TRACK_COLORS[seen.index(c) % len(_TRACK_COLORS)]
        tag = f"{{\\an4\\pos(8,{y})}}{label}"
        lines.append(f"Dialogue: 1,{bg_start},{bg_end},{style},,0,0,0,,{tag}")

    # Scrolling subtitle lines
    for sub in subtitles:
        start = _to_ass_time(sub["start"])
        end   = _to_ass_time(sub["end"])
        character = sub.get("character", "")
        text = sub["text"].replace("{", "\\{").replace("}", "\\}")
        y = char_y.get(character, _BR_TOP + _BR_HEIGHT // 2)
        style = char_style.get(character, "BR_0")
        tagged = f"{{\\an4\\move({_SCROLL_START_X},{y},{_SCROLL_END_X},{y})}}{text}"
        lines.append(f"Dialogue: 2,{start},{end},{style},{character},0,0,0,,{tagged}")

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

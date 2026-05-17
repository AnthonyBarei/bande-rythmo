import xml.etree.ElementTree as ET
from typing import List, Dict

CURSOR_X_RATIO = 0.30

# RGB hex per track — matches br_renderer.TRACK_COLORS
_DETX_COLORS = ["#F5C518", "#50B4FF", "#FF64A0", "#64E6A0"]


def _to_srt_time(s: float) -> str:
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    sec = int(s % 60)
    ms = int(round(s % 1, 3) * 1000)
    return f"{h:02d}:{m:02d}:{sec:02d},{ms:03d}"


def _to_ass_time(s: float) -> str:
    s = max(0.0, s)
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


_TRACK_COLORS = [
    "&H00FFFFFF&",  # white
    "&H0044FFFF&",  # yellow
    "&H00FF8844&",  # blue
    "&H0044FF88&",  # green
    "&H00FF44AA&",  # pink
    "&H00AAAAFF&",  # salmon
]


def _build_ass_styles(characters: List[str], font_size: int) -> str:
    fmt = (
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
        "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding\n"
    )
    styles = fmt
    styles += (
        "Style: BRBg,Arial,20,&H00000000,&H000000FF,&H00000000,&HCC000000,"
        "0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1\n"
    )
    for i, c in enumerate(characters):
        color = _TRACK_COLORS[i % len(_TRACK_COLORS)]
        name = f"BR_{i}"
        styles += (
            f"Style: {name},Courier New,{font_size},{color},&H000000FF,&H00000000,"
            f"&HAA000000,0,0,0,0,100,100,2,0,1,1,0,7,0,0,0,1\n"
        )
    return styles


def export_ass(
    subtitles: List[Dict],
    path: str,
    pxPerSec: float = 180.0,
    video_width: int = 1920,
    video_height: int = 1080,
    br_height: int = 0,     # exact BR strip height in video pixels (0 = auto)
    br_offset: float = 0.0,
):
    seen = []
    for sub in subtitles:
        c = sub.get("character", "")
        if c not in seen:
            seen.append(c)
    num_tracks = max(1, len(seen))

    vw = video_width
    vh = video_height
    cursor_x = vw * CURSOR_X_RATIO

    if br_height > 0:
        br_h = br_height
    else:
        # Fallback: 64px canvas track height scaled to video width at reference 1200px canvas
        br_h = max(num_tracks * 40, int(num_tracks * 64 * vw / 1200))
        br_h = min(br_h, int(vh * 0.35))

    track_h = br_h // num_tracks
    br_top = vh - br_h

    # Font size proportional to track height — matches canvas BASE_FONT = 28px at reference scale
    font_size = max(14, int(track_h * 0.40))

    char_y = {c: br_top + int(i * track_h + track_h * 0.55) for i, c in enumerate(seen)}
    char_style = {c: f"BR_{i}" for i, c in enumerate(seen)}

    all_starts = [s["start"] for s in subtitles] if subtitles else [0]
    all_ends   = [s["end"]   for s in subtitles] if subtitles else [0]
    bg_start = _to_ass_time(max(0, min(all_starts) - br_offset))
    bg_end   = _to_ass_time(max(0, max(all_ends)   - br_offset))

    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        f"PlayResX: {vw}\n"
        f"PlayResY: {vh}\n\n"
        "[V4+ Styles]\n"
        f"{_build_ass_styles(seen, font_size)}\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )
    lines = [header]

    # Semi-transparent dark background band
    bg_rect = (
        f"{{\\an7\\pos(0,{br_top})\\p1}}"
        f"m 0 0 l {vw} 0 {vw} {br_h} 0 {br_h}"
        "{\\p0}"
    )
    lines.append(f"Dialogue: 0,{bg_start},{bg_end},BRBg,,0,0,0,,{bg_rect}")

    # Character name labels pinned on left
    for c in seen:
        y = char_y[c]
        label = (c[:12] if c else "—").replace("{", "\\{").replace("}", "\\}")
        style = char_style[c]
        tag = f"{{\\an4\\pos(8,{y})}}{label}"
        lines.append(f"Dialogue: 1,{bg_start},{bg_end},{style},,0,0,0,,{tag}")

    # Scrolling subtitle lines — positions match canvas exactly at given pxPerSec
    for sub in subtitles:
        # Apply br_offset: positive offset → text appears earlier on screen
        t_start = sub["start"] - br_offset
        t_end   = sub["end"]   - br_offset
        if t_end <= 0:
            continue

        character = sub.get("character", "")
        text = sub["text"].replace("{", "\\{").replace("}", "\\}")
        y = char_y.get(character, br_top + track_h // 2)
        style = char_style.get(character, "BR_0")

        # Event starts when text right edge enters screen from the right.
        # At video time t, canvas draws text left edge at: cursor_x + (t_start - t) * pxPerSec
        # Text right edge enters (= vw) when: t = t_start - (vw - cursor_x) / pxPerSec
        ideal_event_start = t_start - (vw - cursor_x) / pxPerSec
        event_start = max(0.0, ideal_event_start)

        # Event ends when text left edge exits screen to the left.
        # cursor_x + (t_start - t) * pxPerSec = 0  →  t = t_start + cursor_x / pxPerSec
        # Use t_end instead if the subtitle ends before that — text disappears on cue.
        natural_exit = t_start + cursor_x / pxPerSec
        event_end = max(t_end, natural_exit)

        # Position at event_start (may differ from vw if clamped to 0)
        x1 = int(cursor_x + (t_start - event_start) * pxPerSec)
        # Position at event_end: same formula
        x2 = int(cursor_x + (t_start - event_end) * pxPerSec)

        tagged = f"{{\\an4\\move({x1},{y},{x2},{y})}}{text}"
        lines.append(
            f"Dialogue: 2,{_to_ass_time(event_start)},{_to_ass_time(event_end)},"
            f"{style},{character},0,0,0,,{tagged}"
        )

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def export_ass_karaoke(subtitles: List[Dict], path: str):
    """ASS with \\kf karaoke tags — compatible with ass2rythmo and karaoke renderers.
    Duration distributed proportionally across words by character count."""
    seen = []
    for sub in subtitles:
        c = sub.get("character", "")
        if c not in seen:
            seen.append(c)

    char_style = {c: f"K_{i}" for i, c in enumerate(seen)}

    styles_fmt = (
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
        "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding\n"
    )
    styles = styles_fmt
    for i, c in enumerate(seen):
        color = _TRACK_COLORS[i % len(_TRACK_COLORS)]
        styles += (
            f"Style: K_{i},Courier New,28,{color},&H000000FF,&H00000000,"
            f"&HAA000000,0,0,0,0,100,100,2,0,1,1,0,2,10,10,10,1\n"
        )

    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        "PlayResX: 1920\n"
        "PlayResY: 1080\n\n"
        "[V4+ Styles]\n"
        f"{styles}\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )
    lines = [header]

    for sub in subtitles:
        t_start = sub["start"]
        t_end = sub["end"]
        duration_cs = max(1, int((t_end - t_start) * 100))
        text = sub["text"].strip()
        character = sub.get("character", "")
        style = char_style.get(character, "K_0")

        words = text.split()
        if not words:
            continue

        total_chars = sum(len(w) for w in words)
        if total_chars == 0:
            total_chars = 1

        tagged = ""
        for w in words:
            cs = max(1, int(duration_cs * len(w) / total_chars))
            safe_w = w.replace("{", "\\{").replace("}", "\\}")
            tagged += f"{{\\kf{cs}}}{safe_w} "
        tagged = tagged.rstrip()

        lines.append(
            f"Dialogue: 0,{_to_ass_time(t_start)},{_to_ass_time(t_end)},"
            f"{style},{character},0,0,0,,{tagged}"
        )

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def _to_detx_time(s: float, fps: float = 25.0) -> str:
    s = max(0.0, s)
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    sec = int(s % 60)
    frame = int(round((s % 1) * fps))
    frame = min(frame, int(fps) - 1)
    return f"{h:02d}:{m:02d}:{sec:02d}:{frame:02d}"


def export_detx(
    subtitles: List[Dict],
    path: str,
    fps: float = 25.0,
    title: str = "Bande Rythmo",
    video_path: str = "",
):
    """DetX open XML format — compatible with Cappella, Phonations, Joker (French dubbing ecosystem).

    Spec: https://github.com/MartinDelille/Joker/blob/master/DetX.md
    Structure: <detx> → <header>, <roles>, <body> with <line>/<lipsync>/<text>.
    """
    seen = []
    for sub in subtitles:
        c = sub.get("character", "")
        if c not in seen:
            seen.append(c)
    if not seen:
        seen = [""]

    # Stable role id per character; track = vertical position 0-3
    role_id = {c: f"role{i}" for i, c in enumerate(seen)}
    role_track = {c: i % 4 for i, c in enumerate(seen)}

    root = ET.Element("detx")

    header = ET.SubElement(root, "header")
    ET.SubElement(header, "cappella", copyright="Bande Rythmo", version="1")
    ET.SubElement(header, "title").text = title
    if video_path:
        ET.SubElement(header, "videofile").text = video_path

    roles = ET.SubElement(root, "roles")
    for c in seen:
        ET.SubElement(
            roles, "role",
            id=role_id[c],
            name=c if c else "Personnage",
            color=_DETX_COLORS[role_track[c] % len(_DETX_COLORS)],
        )

    body = ET.SubElement(root, "body")
    for sub in sorted(subtitles, key=lambda s: s["start"]):
        c = sub.get("character", "")
        text = sub.get("text", "")
        is_reac = text.strip().startswith("(")
        line = ET.SubElement(
            body, "line",
            role=role_id.get(c, "role0"),
            track=str(role_track.get(c, 0)),
        )
        if is_reac:
            line.set("type", "reac")
        ET.SubElement(line, "lipsync",
                      timecode=_to_detx_time(sub["start"], fps), type="in_open")
        ET.SubElement(line, "text").text = text
        ET.SubElement(line, "lipsync",
                      timecode=_to_detx_time(sub["end"], fps), type="out_open")

    tree = ET.ElementTree(root)
    ET.indent(tree, space="  ")
    with open(path, "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\n')
        tree.write(f, encoding="unicode", xml_declaration=False)

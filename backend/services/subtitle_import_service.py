"""
Subtitle import — parse SRT / ASS / VTT files into our internal subtitle dicts.
Returns list of {start, end, character, text} dicts (no words — no timestamps).
"""
import re
from typing import List, Dict


def _srt_time(s: str) -> float:
    """'00:01:23,456' → seconds (float)."""
    s = s.strip().replace(',', '.')
    parts = s.split(':')
    h, m, sec = float(parts[0]), float(parts[1]), float(parts[2])
    return h * 3600 + m * 60 + sec


def _vtt_time(s: str) -> float:
    """'00:01:23.456' or '01:23.456' → seconds."""
    s = s.strip()
    parts = s.split(':')
    if len(parts) == 2:
        return float(parts[0]) * 60 + float(parts[1])
    return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])


def _ass_time(s: str) -> float:
    """'0:01:23.45' → seconds."""
    s = s.strip()
    parts = s.split(':')
    return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])


def _ass_strip(text: str) -> str:
    """Remove ASS override tags {\\an8}, {\\c&H…} etc. and hard-code line breaks."""
    text = re.sub(r'\{[^}]*\}', '', text)
    text = text.replace('\\N', ' ').replace('\\n', ' ').replace('\\h', ' ')
    return text.strip()


def parse_srt(content: str) -> List[Dict]:
    """Parse SRT file content into subtitle dicts."""
    results = []
    # Normalize line endings
    content = content.replace('\r\n', '\n').replace('\r', '\n')
    blocks = re.split(r'\n\s*\n', content.strip())
    for block in blocks:
        lines = block.strip().splitlines()
        if len(lines) < 3:
            continue
        # First line: block number (skip)
        # Second line: timestamps
        tc_match = re.match(
            r'(\d{1,2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{3})',
            lines[1]
        )
        if not tc_match:
            # Try line 0 (some malformed SRTs omit index)
            tc_match = re.match(
                r'(\d{1,2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{3})',
                lines[0]
            )
            if not tc_match:
                continue
            text_lines = lines[1:]
        else:
            text_lines = lines[2:]

        start = _srt_time(tc_match.group(1))
        end = _srt_time(tc_match.group(2))
        raw = ' '.join(text_lines).strip()
        # Strip HTML tags (some SRTs use <i>, <b>)
        raw = re.sub(r'<[^>]+>', '', raw)

        # Extract character prefix "NAME: text" or "NAME:text"
        char = ''
        text = raw
        char_match = re.match(r'^([A-Z][A-Z0-9 _\-]*)\s*:\s*(.+)$', raw)
        if char_match:
            char = char_match.group(1).strip().title()
            text = char_match.group(2).strip()

        if text:
            results.append({'start': start, 'end': end, 'character': char, 'text': text})
    return results


def parse_ass(content: str) -> List[Dict]:
    """Parse SSA/ASS file content into subtitle dicts."""
    results = []
    content = content.replace('\r\n', '\n').replace('\r', '\n')

    # Find [Events] section
    in_events = False
    format_map = {}
    for line in content.splitlines():
        line = line.strip()
        if line.lower() == '[events]':
            in_events = True
            continue
        if in_events and line.startswith('['):
            break
        if not in_events:
            continue
        if line.lower().startswith('format:'):
            fields = [f.strip().lower() for f in line[7:].split(',')]
            format_map = {f: i for i, f in enumerate(fields)}
            continue
        if not line.lower().startswith('dialogue:'):
            continue
        parts = line[9:].split(',', len(format_map) - 1)
        if len(parts) < len(format_map):
            continue
        try:
            start = _ass_time(parts[format_map.get('start', 1)])
            end = _ass_time(parts[format_map.get('end', 2)])
            char = parts[format_map.get('name', 4)].strip() if 'name' in format_map else ''
            text_raw = parts[format_map.get('text', -1)].strip() if 'text' in format_map else parts[-1].strip()
            text = _ass_strip(text_raw)
            if text:
                results.append({'start': start, 'end': end, 'character': char, 'text': text})
        except (IndexError, ValueError):
            continue
    return results


def parse_vtt(content: str) -> List[Dict]:
    """Parse WebVTT file content into subtitle dicts."""
    results = []
    content = content.replace('\r\n', '\n').replace('\r', '\n')
    lines = content.splitlines()

    i = 0
    # Skip WEBVTT header
    while i < len(lines) and not '-->' in lines[i]:
        i += 1

    while i < len(lines):
        line = lines[i].strip()
        # May be a cue identifier line (skip) then TC line
        if '-->' not in line:
            i += 1
            continue
        # Remove position/align tags: "00:01.000 --> 00:04.000 align:center"
        tc_part = line.split(' ')[0:3]
        tc_str = ' '.join(tc_part[:3]) if len(tc_part) >= 3 else line
        tc_match = re.match(
            r'([\d:\.]+)\s*-->\s*([\d:\.]+)',
            tc_str
        )
        if not tc_match:
            i += 1
            continue
        try:
            start = _vtt_time(tc_match.group(1))
            end = _vtt_time(tc_match.group(2))
        except (ValueError, IndexError):
            i += 1
            continue
        i += 1
        text_lines = []
        while i < len(lines) and lines[i].strip():
            text_lines.append(lines[i].strip())
            i += 1
        raw = ' '.join(text_lines)
        # Strip VTT tags <i>, <b>, <c.>, timestamps <00:00:01.000>
        raw = re.sub(r'<[^>]+>', '', raw).strip()
        char = ''
        text = raw
        char_match = re.match(r'^([A-Z][A-Z0-9 _\-]*)\s*:\s*(.+)$', raw)
        if char_match:
            char = char_match.group(1).strip().title()
            text = char_match.group(2).strip()
        if text:
            results.append({'start': start, 'end': end, 'character': char, 'text': text})
        i += 1  # skip blank separator

    return results


def _detx_time(tc: str, fps: float) -> float:
    """'HH:MM:SS:FF' → seconds. Frame field divided by fps."""
    parts = tc.strip().split(':')
    if len(parts) == 4:
        h, m, s, f = parts
        return int(h) * 3600 + int(m) * 60 + int(s) + (int(f) / max(1.0, fps))
    if len(parts) == 3:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
    try:
        return float(tc)
    except ValueError:
        return 0.0


# DetX lipsync family → our sign type (reverse of _SIGN_DETX_TYPE; lossy:
# 'closed'→labiale, 'rounded'→arrondie, 'open'→ouverte).
_DETX_SIGN_TYPE = {"closed": "labiale", "rounded": "arrondie", "open": "ouverte"}


def parse_detx(content: str) -> List[Dict]:
    """Parse DetX XML → subtitle dicts. Round-trips export_detx: roles→character,
    in_open/out_open→start/end, line attrs→off/dos/ambiance/plan_cut, and the
    in_<fam>/out_<fam> lipsync pairs→words[].signs (best-effort)."""
    import xml.etree.ElementTree as ET
    try:
        root = ET.fromstring(content)
    except ET.ParseError:
        return []

    fps = 25.0
    vfr = root.findtext("./header/videoframerate")
    if vfr:
        try:
            fps = float(vfr)
        except ValueError:
            pass

    roles = {r.get("id"): (r.get("name") or "") for r in root.findall("./roles/role")}

    results = []
    for line in root.findall("./body/line"):
        role = line.get("role")
        character = roles.get(role, "")
        text = (line.findtext("text") or "").strip()

        start = end = None
        signs_open, signs_close = {}, {}
        for ls in line.findall("lipsync"):
            tc = ls.get("timecode")
            typ = ls.get("type") or ""
            if tc is None:
                continue
            t = _detx_time(tc, fps)
            if typ == "in_open" and start is None:
                start = t
            elif typ == "out_open":
                end = t
            elif typ.startswith("in_"):
                signs_open.setdefault(typ[3:], []).append(t)
            elif typ.startswith("out_"):
                signs_close.setdefault(typ[4:], []).append(t)

        if start is None:
            continue
        if end is None or end <= start:
            end = start + max(0.3, len(text) * 0.06)

        sub = {
            "start": round(start, 3),
            "end": round(end, 3),
            "character": character,
            "text": text,
        }
        if line.get("off") == "true":
            sub["off"] = True
        if line.get("dos") == "true":
            sub["dos"] = True
        if line.get("type") == "amb":
            sub["ambiance"] = True
        plan = line.get("plan")
        if plan:
            sub["plan_cut"] = round(_detx_time(plan, fps), 3)

        # Best-effort signs → single word spanning the line.
        sign_list = []
        for fam, opens in signs_open.items():
            closes = signs_close.get(fam, [])
            kind = _DETX_SIGN_TYPE.get(fam)
            if not kind:
                continue
            for i, t0 in enumerate(opens):
                t1 = closes[i] if i < len(closes) else t0 + 0.08
                sign_list.append({"i": 0, "type": kind,
                                  "t0": round(t0, 3), "t1": round(t1, 3)})
        if sign_list and text:
            sub["words"] = [{"w": text, "start": sub["start"], "end": sub["end"],
                             "signs": sorted(sign_list, key=lambda s: s["t0"])}]
        results.append(sub)

    return results


def parse_subtitle_file(filename: str, content: str) -> List[Dict]:
    """Dispatch by extension. Returns list of subtitle dicts sorted by start time."""
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if ext == 'srt':
        subs = parse_srt(content)
    elif ext in ('ass', 'ssa'):
        subs = parse_ass(content)
    elif ext == 'vtt':
        subs = parse_vtt(content)
    elif ext == 'detx':
        subs = parse_detx(content)
    else:
        # Sniff: DetX is XML
        if content.lstrip().startswith('<'):
            subs = parse_detx(content)
        else:
            subs = parse_srt(content) or parse_vtt(content)
    return sorted(subs, key=lambda s: s['start'])

import math
import os
import subprocess
from typing import Dict, List, Optional

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

CURSOR_X_RATIO = 0.30
BG = (5, 5, 5)

# Band background per rythmo style (matches the editor canvas).
_STYLE_BG = {
    "classique": (10, 10, 12),
    "neon":      (6, 6, 10),
    "minimal":   (13, 13, 16),
}


def _blend(fg, a, bg):
    """Blend colour `fg` at opacity `a` (0..1) over opaque background `bg`."""
    return tuple(int(bg[i] + (fg[i] - bg[i]) * a) for i in range(3))

# Bundled BR fonts — keyed by the id sent from the frontend font picker.
_FONTS_DIR = os.path.join(os.path.dirname(__file__), "..", "fonts")
_ATKINSON_BOLD = os.path.join(_FONTS_DIR, "AtkinsonHyperlegible-Bold.ttf")
_BR_FONT_FILES = {
    "atkinson":  os.path.join(_FONTS_DIR, "AtkinsonHyperlegible-Bold.ttf"),
    # Legible-handwriting alternative to the cursive Caveat — keeps the
    # manuscript feel while staying readable in motion. Falls back to
    # atkinson if ShantellSans.ttf isn't bundled yet.
    "lisible":   os.path.join(_FONTS_DIR, "ShantellSans.ttf"),
    "inter":     os.path.join(_FONTS_DIR, "Inter.ttf"),
    "jetbrains": os.path.join(_FONTS_DIR, "JetBrainsMono-Bold.ttf"),
    "cursive":   os.path.join(_FONTS_DIR, "Caveat.ttf"),
}

TRACK_COLORS = [
    {"bg": (245, 197, 24),  "bg_a": 26,  "label": (245, 197, 24)},
    {"bg": (80,  180, 255), "bg_a": 26,  "label": (80,  180, 255)},
    {"bg": (255, 100, 160), "bg_a": 26,  "label": (255, 100, 160)},
    {"bg": (100, 230, 160), "bg_a": 26,  "label": (100, 230, 160)},
]


def _load_font(candidates: list, size: int) -> ImageFont.FreeTypeFont:
    for path in candidates:
        if os.path.exists(path):
            try:
                font = ImageFont.truetype(path, size)
                # Variable fonts (e.g. Inter) — pin the Bold weight axis.
                try:
                    if b"Bold" in (font.get_variation_names() or []) \
                       or "Bold" in (font.get_variation_names() or []):
                        font.set_variation_by_name("Bold")
                except Exception:
                    pass
                return font
            except Exception:
                continue
    try:
        return ImageFont.load_default(size=size)
    except Exception:
        return ImageFont.load_default()


def _get_fonts(font_size: int, label_size: int = 10, avatar_size: int = 9,
               br_font: str = "atkinson"):
    fallback = [
        _ATKINSON_BOLD,
        "C:/Windows/Fonts/arialbd.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]
    chosen = _BR_FONT_FILES.get(br_font, _ATKINSON_BOLD)
    candidates = [chosen] + fallback
    return (
        _load_font(candidates, font_size),     # BR dialogue text
        _load_font(candidates, label_size),    # track labels
        _load_font(candidates, avatar_size),   # avatar initials
    )


def _text_rgb(is_active: bool) -> tuple:
    return (255, 255, 255) if is_active else (89, 89, 89)  # 255*0.35


def _merge_words(ws):
    """Merge contraction fragments — Whisper splits "t'as" → "t" + "'as".
    A token starting with ' / ’ / - (or following one) joins the previous."""
    out = []
    for w in ws:
        wt = w.get("w") or ""
        if out and wt and (wt[0] in "'’-"
                            or (out[-1]["w"] and out[-1]["w"][-1] in "'’-")):
            out[-1] = {"w": out[-1]["w"] + wt,
                       "start": out[-1]["start"], "end": w["end"]}
        else:
            out.append({"w": wt, "start": w["start"], "end": w["end"]})
    return out


def _valid_words(sub: Dict):
    """Per-word timing, only if still consistent with the réplique text+timing
    (else stale from an edit → caller falls back to whole-text even-stretch)."""
    ws = sub.get("words")
    if not isinstance(ws, list) or not ws:
        return None
    joined = "".join("".join((w.get("w") or "").split()) for w in ws)
    txt = "".join((sub.get("text") or "").split())
    if not joined or joined != txt:
        return None
    s, e = sub["start"], sub["end"]
    for w in ws:
        if w["start"] < s - 0.05 or w["end"] > e + 0.05:
            return None
    return _merge_words(ws)


_STRETCH_CAP = 1.2  # max horizontal stretch — a held word stays near-normal
                    # width and sits left-aligned; the trailing gap shows the hold.


def _draw_word(img, word_text, bl, br_, y_top, track_h, y_center, is_active,
               color, style, font_main, font_size, W):
    """Draw one word inside its time-block [bl, br_]: squeezed to fit; stretch
    capped at _STRETCH_CAP (long holds → left-aligned word + trailing gap).
    word_text carries a trailing space so consecutive words stay separated."""
    block_w = br_ - bl
    text_rgb = _text_rgb(is_active)
    stroke_w = max(1, round(font_size / 18))

    try:
        bb = font_main.getbbox(word_text, stroke_width=stroke_w)
        text_h = bb[3] - bb[1]
        bb0 = bb[0]
        # getlength = advance (counts the trailing space) → words keep a gap.
        natural_w = max(1, int(round(font_main.getlength(word_text))) + stroke_w * 2)
    except Exception:
        natural_w = max(1, len(word_text) * font_size // 2)
        text_h, bb0 = font_size, 0

    scale_x = block_w / natural_w if block_w > 0 else 1.0
    scale_x = max(0.05, min(scale_x, _STRETCH_CAP))

    tmp_w = natural_w + 4
    tmp = Image.new("RGBA", (tmp_w, track_h), (0, 0, 0, 0))
    tdraw = ImageDraw.Draw(tmp)
    ty = y_center - y_top - text_h // 2 - bb0
    tdraw.text((-bb0, ty), word_text, font=font_main, fill=(*text_rgb, 255),
               stroke_width=stroke_w, stroke_fill=(0, 0, 0, 235))

    if abs(scale_x - 1.0) > 0.01:
        tmp = tmp.resize((max(1, int(tmp_w * scale_x)), track_h), Image.LANCZOS)

    # Left-aligned at the block start; tmp width ≤ block width by construction
    # (squeezed → exact, capped → narrower) so the word never overflows br_.
    dst = int(bl)
    src_x = 0
    if dst < 0:
        src_x = -dst
        dst = 0
    if dst >= W or src_x >= tmp.width:
        return
    copy_w = min(tmp.width - src_x, W - dst)
    if copy_w <= 0:
        return
    crop = tmp.crop((src_x, 0, src_x + copy_w, track_h))
    if style == "neon":
        # Coloured blurred halo behind the glyphs — neon glow.
        alpha = crop.split()[3]
        glow = Image.new("RGBA", crop.size, (0, 0, 0, 0))
        glow.paste(Image.new("RGBA", crop.size, (*color["label"], 255)), (0, 0), alpha)
        glow = glow.filter(ImageFilter.GaussianBlur(max(2, font_size // 9)))
        img.paste(glow, (dst, y_top), glow)
    img.paste(crop, (dst, y_top), crop)


def _render_frame(
    t: float,
    subtitles: List[Dict],
    char_map: Dict[str, int],
    num_tracks: int,
    W: int,
    H: int,
    px_per_sec: float,
    font_main: ImageFont.FreeTypeFont,
    font_label: ImageFont.FreeTypeFont,
    font_avatar: ImageFont.FreeTypeFont,
    font_size: int,
    style: str = "classique",
) -> Image.Image:
    # Opaque BR band — glued below the picture (vstack), not over it.
    bg = _STYLE_BG.get(style, _STYLE_BG["classique"])
    img = Image.new("RGB", (W, H), bg)
    draw = ImageDraw.Draw(img)

    track_h = H // max(1, num_tracks)
    cursor_x = W * CURSOR_X_RATIO

    # Track separator lines
    for tr in range(1, num_tracks):
        y = tr * track_h
        draw.line([(0, y), (W, y)], fill=_blend((255, 255, 255), 0.05, bg), width=1)

    # Réplique blocks — style-dependent (drawn before text so text sits on top)
    edge_w = max(2, int(track_h * 0.035))
    for sub in subtitles:
        tr = char_map.get(sub.get("character", ""), 0)
        col = TRACK_COLORS[tr % len(TRACK_COLORS)]["bg"]
        y_top = tr * track_h
        bl = cursor_x + (sub["start"] - t) * px_per_sec
        br_ = cursor_x + (sub["end"] - t) * px_per_sec
        if br_ < 0 or bl > W:
            continue
        is_active = sub["start"] <= t <= sub["end"]
        bx = int(max(0, bl))
        bx2 = int(min(W, br_))
        if bx2 <= bx:
            continue
        if style == "minimal":
            uy = y_top + track_h - max(3, int(track_h * 0.05))
            draw.rectangle([bx, uy, bx2, y_top + track_h - 2],
                           fill=_blend(col, 1.0 if is_active else 0.4, bg))
        elif style == "neon":
            draw.rectangle([bx + 1, y_top + 4, bx2 - 1, y_top + track_h - 5],
                           outline=_blend(col, 0.7 if is_active else 0.4, bg),
                           width=max(1, int(track_h * 0.02)))
        else:  # classique
            draw.rectangle([bx, y_top + 3, bx2, y_top + track_h - 4],
                           fill=_blend(col, 0.28 if is_active else 0.14, bg))
            lx = int(bl)
            if -1 < lx < W:
                draw.rectangle([lx, y_top + 3, lx + edge_w, y_top + track_h - 4],
                               fill=_blend(col, 1.0 if is_active else 0.67, bg))

    # Avatar circle (once per réplique) + per-word stretched text
    for sub in subtitles:
        tr = char_map.get(sub.get("character", ""), 0)
        color = TRACK_COLORS[tr % len(TRACK_COLORS)]
        y_top = tr * track_h
        y_mid = y_top + track_h // 2
        char = sub.get("character", "")

        sub_bl = cursor_x + (sub["start"] - t) * px_per_sec
        sub_br = cursor_x + (sub["end"]   - t) * px_per_sec
        if sub_br < 0 or sub_bl > W:
            continue
        sub_active = sub["start"] <= t <= sub["end"]

        # Avatar circle — at the réplique start
        if char and (sub_br - sub_bl) > 20:
            r = max(8, int(track_h * 0.13))
            pad = max(5, int(track_h * 0.09))
            cx, cy = int(max(sub_bl, 0) + pad + r), int(y_top + pad + r)
            lc = color["label"] if sub_active else tuple(int(c * 0.6) for c in color["label"])
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=lc)
            initial = char[0].upper()
            try:
                bb = font_avatar.getbbox(initial)
                iw, ih = bb[2] - bb[0], bb[3] - bb[1]
                draw.text((cx - iw // 2 - bb[0], cy - ih // 2 - bb[1]),
                          initial, font=font_avatar, fill=(0, 0, 0))
            except Exception:
                draw.text((cx - 4, cy - 4), initial, font=font_avatar, fill=(0, 0, 0))

        # Per-word text — each word fills its own time-block [start, end].
        # No / stale word data → fall back to the whole réplique as one word.
        words = _valid_words(sub) or [
            {"w": sub.get("text", ""), "start": sub["start"], "end": sub["end"]}
        ]
        text_y_center = y_mid + (6 if char else 0)
        for wd in words:
            core = (wd.get("w") or "").replace("*", "○")
            if not core:
                continue
            wbl = cursor_x + (wd["start"] - t) * px_per_sec
            wbr = cursor_x + (wd["end"] - t) * px_per_sec
            if wbr < 0 or wbl > W:
                continue
            w_active = wd["start"] <= t <= wd["end"]
            _draw_word(img, core + " ", wbl, wbr, y_top, track_h, text_y_center,
                       w_active, color, style, font_main, font_size, W)
    draw = ImageDraw.Draw(img)

    # Track labels (fixed left, always on top)
    label_pad = max(5, int(track_h * 0.07))
    for tr in range(num_tracks):
        char = next((c for c, i in char_map.items() if i == tr), "")
        color = TRACK_COLORS[tr % len(TRACK_COLORS)]
        label = (char.upper() or "(DEF)")[:12]
        draw.text((label_pad, tr * track_h + label_pad), label, font=font_label, fill=color["label"])

    # Timeline 1-second ticks
    t0 = t - cursor_x / px_per_sec
    t1 = t + (W - cursor_x) / px_per_sec
    for tick in range(math.ceil(t0), math.floor(t1) + 1):
        tx = int(cursor_x + (tick - t) * px_per_sec)
        if 0 <= tx < W:
            draw.line([(tx, 0), (tx, H)], fill=(15, 15, 15), width=1)

    # Cursor line + triangle
    cx = int(cursor_x)
    cw = max(2, round(track_h * 0.03))
    tw = max(7, int(track_h * 0.10))
    draw.line([(cx, 0), (cx, H)], fill=(245, 197, 24), width=cw)
    draw.polygon([(cx - tw, 0), (cx + tw, 0), (cx, tw + 3)], fill=(245, 197, 24))

    return img


def render_br_video(
    subtitles: List[Dict],
    strip_width: int,
    strip_height: int,
    px_per_sec: float,
    fps: float,
    duration: float,
    output_path: str,
    br_offset: float = 0.0,
    font_scale: float = 1.0,
    br_font: str = "atkinson",
    supersample: int = 4,
    shutter: float = 0.25,
    style: str = "classique",
):
    """Render BR strip frames to a lossless video file at exact video fps.

    Each output frame is the average of `supersample` sub-frames — synthetic
    motion blur that makes the constant horizontal scroll read as smooth
    instead of stepping (VoxDub's "240Hz").

    `shutter` (0..1) is the fraction of the frame interval the sub-frames span
    — the camera shutter-angle analogue. 1.0 = full smear, 0.5 = cinema 180°,
    lower = crisper text but slightly less motion smoothing.
    """
    num_tracks = max(1, len({s.get("character", "") for s in subtitles}))
    char_map: Dict[str, int] = {}
    for s in subtitles:
        c = s.get("character", "")
        if c not in char_map:
            char_map[c] = len(char_map)

    W = strip_width
    H = strip_height
    ss = max(1, int(supersample))

    # Scale fonts to track height so BR text stays readable at any export
    # resolution. ~0.45 of track height — large readable glyphs with margin
    # above/below (VoxDub proportions).
    track_h = H // max(1, num_tracks)
    font_size = max(14, round(track_h * 0.45 * font_scale))
    label_size = max(9, round(track_h * 0.13))
    avatar_size = max(8, round(track_h * 0.13))
    font_main, font_label, font_avatar = _get_fonts(
        font_size, label_size, avatar_size, br_font)

    num_frames = max(1, round(duration * fps))

    # FFV1 lossless RGB intermediate — no chroma subsampling on text edges,
    # so the only lossy pass is the final encode.
    cmd = [
        "ffmpeg", "-y",
        "-f", "rawvideo", "-vcodec", "rawvideo",
        "-s", f"{W}x{H}",
        "-pix_fmt", "rgb24",
        "-r", str(fps),
        "-i", "pipe:0",
        "-c:v", "ffv1",
        "-level", "3",
        "-pix_fmt", "rgb24",
        output_path,
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)

    def _frame_rgb(t: float) -> np.ndarray:
        img = _render_frame(
            t, subtitles, char_map, num_tracks,
            W, H, px_per_sec,
            font_main, font_label, font_avatar, font_size, style,
        )
        return np.asarray(img.convert("RGB"), dtype=np.float32)

    try:
        for frame_idx in range(num_frames):
            if ss == 1:
                t = frame_idx / fps + br_offset
                out = _frame_rgb(t).astype(np.uint8)
            else:
                acc = None
                for s in range(ss):
                    t = (frame_idx + (s / ss) * shutter) / fps + br_offset
                    sub = _frame_rgb(t)
                    acc = sub if acc is None else acc + sub
                out = (acc / ss).round().clip(0, 255).astype(np.uint8)
            proc.stdin.write(out.tobytes())
        proc.stdin.close()
        proc.wait()
    except Exception:
        proc.stdin.close()
        proc.kill()
        proc.wait()
        raise

    if proc.returncode != 0:
        raise RuntimeError(f"br_renderer ffmpeg exit {proc.returncode}")

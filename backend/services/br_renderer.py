import math
import os
import subprocess
from typing import Dict, List, Optional

import numpy as np
from PIL import Image, ImageDraw, ImageFont

CURSOR_X_RATIO = 0.30
BG = (5, 5, 5)

# Bundled BR fonts — keyed by the id sent from the frontend font picker.
_FONTS_DIR = os.path.join(os.path.dirname(__file__), "..", "fonts")
_ATKINSON_BOLD = os.path.join(_FONTS_DIR, "AtkinsonHyperlegible-Bold.ttf")
_BR_FONT_FILES = {
    "atkinson":  os.path.join(_FONTS_DIR, "AtkinsonHyperlegible-Bold.ttf"),
    "inter":     os.path.join(_FONTS_DIR, "Inter.ttf"),
    "jetbrains": os.path.join(_FONTS_DIR, "JetBrainsMono-Bold.ttf"),
}

TRACK_COLORS = [
    {"bg": (245, 197, 24),  "bg_a": 26,  "label": (245, 197, 24)},
    {"bg": (80,  180, 255), "bg_a": 26,  "label": (80,  180, 255)},
    {"bg": (255, 100, 160), "bg_a": 26,  "label": (255, 100, 160)},
    {"bg": (100, 230, 160), "bg_a": 26,  "label": (100, 230, 160)},
]


def _blend(fg, alpha, bg=BG):
    a = alpha / 255.0
    return tuple(int(bg[i] + (fg[i] - bg[i]) * a) for i in range(3))


BLOCK_FILLS = [_blend(c["bg"], c["bg_a"]) for c in TRACK_COLORS]


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
) -> Image.Image:
    img = Image.new("RGBA", (W, H), (*BG, 255))
    draw = ImageDraw.Draw(img)

    track_h = H // max(1, num_tracks)
    cursor_x = W * CURSOR_X_RATIO

    # Track separator lines
    for tr in range(1, num_tracks):
        y = tr * track_h
        draw.line([(0, y), (W, y)], fill=(26, 26, 26), width=1)

    # Subtitle background blocks
    for sub in subtitles:
        tr = char_map.get(sub.get("character", ""), 0)
        y_top = tr * track_h
        bl = cursor_x + (sub["start"] - t) * px_per_sec
        br = cursor_x + (sub["end"]   - t) * px_per_sec
        if br < 0 or bl > W:
            continue
        bx = max(0, bl)
        bw = min(W, br) - bx
        if bw <= 0:
            continue
        draw.rectangle([int(bx), y_top + 1, int(bx + bw), y_top + track_h - 2],
                       fill=BLOCK_FILLS[tr % len(BLOCK_FILLS)])

    # Avatar circles + stretched text
    for sub in subtitles:
        tr = char_map.get(sub.get("character", ""), 0)
        color = TRACK_COLORS[tr % len(TRACK_COLORS)]
        y_top = tr * track_h
        y_mid = y_top + track_h // 2
        is_active = sub["start"] <= t <= sub["end"]
        char = sub.get("character", "")

        bl = cursor_x + (sub["start"] - t) * px_per_sec
        br_ = cursor_x + (sub["end"]   - t) * px_per_sec
        block_w = br_ - bl

        if br_ < 0 or bl > W:
            continue

        # Avatar circle
        if char and block_w > 20:
            r = max(8, int(track_h * 0.13))
            pad = max(5, int(track_h * 0.09))
            ax = max(bl, 0) + pad
            ay = y_top + pad
            cx, cy = int(ax + r), int(ay + r)
            lc = color["label"] if is_active else tuple(int(c * 0.6) for c in color["label"])
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=lc)
            initial = char[0].upper()
            try:
                bb = font_avatar.getbbox(initial)
                iw, ih = bb[2] - bb[0], bb[3] - bb[1]
                draw.text((cx - iw // 2 - bb[0], cy - ih // 2 - bb[1]),
                          initial, font=font_avatar, fill=(0, 0, 0))
            except Exception:
                draw.text((cx - 4, cy - 4), initial, font=font_avatar, fill=(0, 0, 0))

        # Stretched text
        raw_text = sub.get("text", "").replace("*", "○")
        if not raw_text:
            continue

        text_y_center = y_mid + (6 if char else 0)
        text_rgb = _text_rgb(is_active)

        # Thin black stroke around glyphs — definition against motion blur and
        # h264 compression, without a thick halo that reads as softness.
        stroke_w = max(1, round(font_size / 18))

        try:
            bb = font_main.getbbox(raw_text, stroke_width=stroke_w)
            natural_w = max(1, bb[2] - bb[0])
        except Exception:
            natural_w = max(1, len(raw_text) * font_size // 2)

        # Near-zero floor: text always squeezes to exactly fit its block — never
        # overflows / clips at the block edge. Extreme squeeze = too-short cue.
        scale_x = max(0.05, block_w / natural_w) if block_w > 0 else 0.05

        # Render text to RGBA temp image, then resize
        tmp_w = natural_w + stroke_w * 2 + 4
        try:
            bb = font_main.getbbox(raw_text, stroke_width=stroke_w)
            text_h = bb[3] - bb[1]
            tmp = Image.new("RGBA", (tmp_w, track_h), (0, 0, 0, 0))
            tdraw = ImageDraw.Draw(tmp)
            ty = text_y_center - y_top - text_h // 2 - bb[1]
            tdraw.text((-bb[0], ty), raw_text, font=font_main, fill=(*text_rgb, 255),
                       stroke_width=stroke_w, stroke_fill=(0, 0, 0, 235))
        except Exception:
            tmp = Image.new("RGBA", (tmp_w, track_h), (0, 0, 0, 0))
            tdraw = ImageDraw.Draw(tmp)
            tdraw.text((0, text_y_center - y_top - font_size // 2),
                       raw_text, font=font_main, fill=(*text_rgb, 255),
                       stroke_width=stroke_w, stroke_fill=(0, 0, 0, 235))

        # Horizontal scale
        if abs(scale_x - 1.0) > 0.01:
            new_w = max(1, int(tmp_w * scale_x))
            tmp = tmp.resize((new_w, track_h), Image.LANCZOS)

        scaled_w = tmp.width
        text_start_x = int(bl)
        clip_l = max(0, int(bl))
        clip_r = min(W, int(br_))
        if clip_r <= clip_l:
            continue

        src_x = max(0, clip_l - text_start_x)
        dst_x = clip_l
        copy_w = min(scaled_w - src_x, clip_r - dst_x)
        if copy_w <= 0:
            continue

        crop = tmp.crop((src_x, 0, src_x + copy_w, track_h))
        img.paste(crop, (dst_x, y_top), crop)
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
    shutter: float = 0.4,
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
    # resolution. Text fills most of the track height (VoxDub-style) — large
    # glyphs are far easier to read while scrolling.
    track_h = H // max(1, num_tracks)
    font_size = max(14, round(track_h * 0.58 * font_scale))
    label_size = max(9, round(track_h * 0.13))
    avatar_size = max(8, round(track_h * 0.13))
    font_main, font_label, font_avatar = _get_fonts(
        font_size, label_size, avatar_size, br_font)

    num_frames = max(1, round(duration * fps))

    # FFV1 lossless RGB intermediate — no chroma subsampling on text edges,
    # so the only lossy pass is the final overlay encode.
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
            font_main, font_label, font_avatar, font_size,
        ).convert("RGB")
        return np.asarray(img, dtype=np.float32)

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

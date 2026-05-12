import json
import os
import uuid
import asyncio

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from PIL import Image, ImageDraw, ImageFont, ImageSequence

router = APIRouter()

MEMES_DIR = "memes"
os.makedirs(MEMES_DIR, exist_ok=True)

ALLOWED_EXT = {"png", "jpg", "jpeg", "webp", "gif"}

FONT_PATHS = {
    "impact":   ["C:/Windows/Fonts/impact.ttf",   "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"],
    "arialblk": ["C:/Windows/Fonts/arialbd.ttf",  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"],
    "mono":     ["C:/Windows/Fonts/cour.ttf",      "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"],
}


def _load_font(style: str, size: int) -> ImageFont.FreeTypeFont:
    candidates = FONT_PATHS.get(style, FONT_PATHS["impact"])
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                pass
    return ImageFont.load_default()


def _wrap_text(draw: ImageDraw.ImageDraw, text: str, font, max_w: int) -> list[str]:
    words = text.split(" ")
    lines, cur = [], ""
    for word in words:
        test = f"{cur} {word}".strip() if cur else word
        w = draw.textlength(test, font=font)
        if w <= max_w:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines if lines else [text]


def _parse_color(color: str):
    """Return PIL-compatible color. Accepts #rrggbb or named colors."""
    return color


def _draw_stroke(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, font,
                 stroke_w: int, stroke_color: str):
    for dx in range(-stroke_w, stroke_w + 1):
        for dy in range(-stroke_w, stroke_w + 1):
            if dx == 0 and dy == 0:
                continue
            if dx * dx + dy * dy > stroke_w * stroke_w + 1:
                continue
            draw.text((x + dx, y + dy), text, font=font, fill=stroke_color)


def _apply_texts(img: Image.Image, texts_data: list[dict]) -> Image.Image:
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    w, h = img.size
    draw = ImageDraw.Draw(img)

    for t in texts_data:
        content = t.get("content", "").strip()
        if not content:
            continue
        x_pct   = float(t.get("x_pct", 50))
        y_pct   = float(t.get("y_pct", 10))
        fs_raw  = int(t.get("font_size", 48))
        color   = t.get("color", "#ffffff")
        s_color = t.get("stroke_color", "#000000")
        s_width = int(t.get("stroke_width", 3))
        align   = t.get("align", "center")
        style   = t.get("font_style", "impact")

        # Scale font size relative to baseline canvas width (560px)
        fs = max(10, int(fs_raw * (w / 560)))
        font = _load_font(style, fs)

        anchor_x = int(w * x_pct / 100)
        anchor_y = int(h * y_pct / 100)

        max_w_px = int(w * 0.88)
        lines = _wrap_text(draw, content.upper(), font, max_w_px)
        line_h = int(fs * 1.2)
        total_h = len(lines) * line_h
        scaled_sw = max(1, int(s_width * (w / 280))) if s_width > 0 else 0

        for i, line in enumerate(lines):
            bbox = draw.textbbox((0, 0), line, font=font)
            text_w = bbox[2] - bbox[0]
            text_h = bbox[3] - bbox[1]

            if align == "center":
                tx = anchor_x - text_w // 2
            elif align == "right":
                tx = anchor_x - text_w
            else:
                tx = anchor_x

            # Center all lines vertically around anchor_y
            ty = anchor_y - total_h // 2 + i * line_h - bbox[1]

            if scaled_sw > 0:
                _draw_stroke(draw, tx, ty, line, font, scaled_sw, s_color)
            draw.text((tx, ty), line, font=font, fill=color)

    return img


def _render_image(in_path: str, out_path: str, texts_data: list[dict], out_ext: str):
    img = Image.open(in_path)
    out = _apply_texts(img.convert("RGBA"), texts_data)
    if out_ext in ("jpg", "jpeg"):
        out.convert("RGB").save(out_path, quality=92)
    elif out_ext == "png":
        out.save(out_path, optimize=True)
    elif out_ext == "webp":
        out.save(out_path, quality=92)
    else:
        out.save(out_path)


def _render_gif(in_path: str, out_path: str, texts_data: list[dict]):
    src = Image.open(in_path)
    frames, durations = [], []
    for frame in ImageSequence.Iterator(src):
        composed = _apply_texts(frame.convert("RGBA"), texts_data)
        frames.append(composed)
        durations.append(frame.info.get("duration", 100))
    if not frames:
        raise ValueError("Empty GIF")
    first = frames[0].convert("P", palette=Image.ADAPTIVE)
    rest  = [f.convert("P", palette=Image.ADAPTIVE) for f in frames[1:]]
    first.save(
        out_path, save_all=True, append_images=rest,
        duration=durations, loop=src.info.get("loop", 0),
        disposal=2, optimize=False,
    )


@router.post("/generate")
async def generate(
    file:   UploadFile = File(...),
    texts:  str        = Form("[]"),
):
    try:
        texts_data = json.loads(texts)
        if not isinstance(texts_data, list):
            texts_data = []
    except Exception:
        texts_data = []

    if not any(t.get("content", "").strip() for t in texts_data):
        raise HTTPException(400, "At least one non-empty text layer required")

    name = (file.filename or "input").lower()
    ext  = name.rsplit(".", 1)[-1] if "." in name else ""
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"Unsupported format: {ext}. Use {sorted(ALLOWED_EXT)}")

    uid      = str(uuid.uuid4())
    in_path  = os.path.join(MEMES_DIR, f"in_{uid}.{ext}")
    out_path = os.path.join(MEMES_DIR, f"out_{uid}.{ext}")

    with open(in_path, "wb") as f:
        f.write(await file.read())

    try:
        if ext == "gif":
            await asyncio.to_thread(_render_gif, in_path, out_path, texts_data)
            media = "image/gif"
        else:
            await asyncio.to_thread(_render_image, in_path, out_path, texts_data, ext)
            media = f"image/{'jpeg' if ext in ('jpg', 'jpeg') else ext}"
    except Exception as e:
        raise HTTPException(500, f"Render failed: {e}")

    return FileResponse(out_path, filename=f"meme.{ext}", media_type=media)

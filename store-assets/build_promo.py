#!/usr/bin/env python3
"""Generate promotional tiles for the Edge / Chrome web stores.

Outputs (next to this script, in store-assets/):

  promo-1280x800.png   1280x800  Edge "promotional tile" + Chrome large tile
  promo-440x280.png     440x280  Chrome small tile (required for any chance
                                 of being featured)
  marquee-1400x560.png 1400x560  Chrome marquee (optional, for store-front
                                 featuring; we render one even if you don't
                                 submit it — easy to discard if not wanted)

Each tile is composed from:
  * the bubble icon (icon-options/01-bubble/source.svg, rendered via cairosvg
    at 4x then LANCZOS downsampled to the target footprint)
  * a soft purple-to-deep-purple gradient background
  * the wordmark "Teams Transcript -> Markdown" (rendered with DejaVu Sans
    Bold; falls back gracefully if unavailable)
  * a tagline appropriate to the tile's size

Re-run any time the icon or copy changes:
  python3 store-assets/build_promo.py
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

import cairosvg
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).parent
EXT_ROOT = HERE.parent
ICON_SVG = EXT_ROOT / "icon-options" / "01-bubble" / "source.svg"


# Brand palette (matches icons/icon-128.png and the Teams aesthetic).
PURPLE = (98, 100, 167)        # #6264A7
PURPLE_DEEP = (66, 68, 130)    # darker step
PURPLE_LIGHT = (133, 135, 198) # lighter step
WHITE = (255, 255, 255)
INK = (31, 31, 46)
MUTED = (200, 200, 220)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _font(size: int, *, bold: bool = False):
    path = (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    )
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def render_icon(target_px: int) -> Image.Image:
    """Render icon-options/01-bubble/source.svg to a target_px square PNG."""
    upscale = max(target_px * 4, 1024)
    raw = cairosvg.svg2png(
        bytestring=ICON_SVG.read_bytes(),
        output_width=upscale,
        output_height=upscale,
    )
    img = Image.open(io.BytesIO(raw)).convert("RGBA")
    return img.resize((target_px, target_px), Image.LANCZOS)


def gradient_background(w: int, h: int) -> Image.Image:
    """Vertical gradient PURPLE_LIGHT -> PURPLE -> PURPLE_DEEP."""
    img = Image.new("RGB", (w, h))
    px = img.load()
    midpoint = int(h * 0.55)
    for y in range(h):
        if y < midpoint:
            t = y / max(1, midpoint)
            r = int(PURPLE_LIGHT[0] + (PURPLE[0] - PURPLE_LIGHT[0]) * t)
            g = int(PURPLE_LIGHT[1] + (PURPLE[1] - PURPLE_LIGHT[1]) * t)
            b = int(PURPLE_LIGHT[2] + (PURPLE[2] - PURPLE_LIGHT[2]) * t)
        else:
            t = (y - midpoint) / max(1, h - midpoint)
            r = int(PURPLE[0] + (PURPLE_DEEP[0] - PURPLE[0]) * t)
            g = int(PURPLE[1] + (PURPLE_DEEP[1] - PURPLE[1]) * t)
            b = int(PURPLE[2] + (PURPLE_DEEP[2] - PURPLE[2]) * t)
        for x in range(w):
            px[x, y] = (r, g, b)
    return img


def drop_shadow(icon: Image.Image, blur: int = 20, offset: int = 8) -> Image.Image:
    """Return an RGBA image: icon over a soft drop shadow."""
    w, h = icon.size
    canvas = Image.new("RGBA", (w + 2 * blur, h + 2 * blur + offset), (0, 0, 0, 0))
    shadow_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    sx, sy = blur, blur + offset
    # Build the shadow from the icon's alpha so it follows the bubble shape.
    alpha = icon.split()[-1]
    shadow = Image.new("RGBA", icon.size, (0, 0, 0, 160))
    shadow.putalpha(alpha)
    shadow_layer.paste(shadow, (sx, sy), shadow)
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(blur))
    canvas = Image.alpha_composite(canvas, shadow_layer)
    canvas.paste(icon, (blur, blur), icon)
    return canvas


def draw_centered_text(
    canvas: Image.Image,
    text: str,
    *,
    x: int,
    y: int,
    font: ImageFont.ImageFont,
    fill,
    anchor: str = "lt",
):
    ImageDraw.Draw(canvas).text((x, y), text, fill=fill, font=font, anchor=anchor)


# ---------------------------------------------------------------------------
# Tiles
# ---------------------------------------------------------------------------


def build_1280x800() -> Path:
    """Edge promotional tile + Chrome large promotional tile."""
    W, H = 1280, 800
    bg = gradient_background(W, H).convert("RGBA")
    icon = render_icon(420)
    iconed = drop_shadow(icon, blur=28, offset=12)
    # Position icon centered vertically on the left third.
    ix = 110
    iy = (H - iconed.size[1]) // 2
    bg.alpha_composite(iconed, (ix, iy))

    # Title + tagline on the right.
    tx = ix + iconed.size[0] + 30
    title = "Teams Transcript"
    title_b = "to Markdown"
    tagline_1 = "Capture Microsoft Teams meeting recordings"
    tagline_2 = "as LLM-friendly Markdown (or raw WebVTT)."
    feature_1 = "Pulls the .vtt file straight from SharePoint in ~2 s"
    feature_2 = "or scrolls the rendered transcript on other surfaces."

    draw = ImageDraw.Draw(bg)
    draw.text((tx, 200), title, fill=WHITE, font=_font(72, bold=True))
    draw.text((tx, 290), title_b, fill=WHITE, font=_font(72, bold=True))
    draw.text((tx, 410), tagline_1, fill=MUTED, font=_font(28))
    draw.text((tx, 450), tagline_2, fill=MUTED, font=_font(28))
    draw.text((tx, 540), feature_1, fill=WHITE, font=_font(22))
    draw.text((tx, 575), feature_2, fill=WHITE, font=_font(22))

    out = HERE / "promo-1280x800.png"
    bg.convert("RGB").save(out, optimize=True)
    return out


def build_440x280() -> Path:
    """Chrome small promotional tile."""
    W, H = 440, 280
    bg = gradient_background(W, H).convert("RGBA")
    icon = render_icon(160)
    iconed = drop_shadow(icon, blur=14, offset=6)
    bg.alpha_composite(iconed, (24, (H - iconed.size[1]) // 2))

    draw = ImageDraw.Draw(bg)
    tx = 24 + iconed.size[0] + 6
    draw.text((tx, 70), "Teams", fill=WHITE, font=_font(30, bold=True))
    draw.text((tx, 105), "Transcript", fill=WHITE, font=_font(30, bold=True))
    draw.text((tx, 140), "to Markdown", fill=WHITE, font=_font(30, bold=True))
    draw.text((tx, 195), "Recordings -> .md / .vtt", fill=MUTED, font=_font(15))

    out = HERE / "promo-440x280.png"
    bg.convert("RGB").save(out, optimize=True)
    return out


def build_marquee_1400x560() -> Path:
    """Chrome marquee tile (optional)."""
    W, H = 1400, 560
    bg = gradient_background(W, H).convert("RGBA")
    icon = render_icon(360)
    iconed = drop_shadow(icon, blur=26, offset=10)
    bg.alpha_composite(iconed, (90, (H - iconed.size[1]) // 2))

    draw = ImageDraw.Draw(bg)
    tx = 90 + iconed.size[0] + 30
    draw.text((tx, 130), "Teams Transcript -> Markdown", fill=WHITE, font=_font(64, bold=True))
    draw.text((tx, 230), "for Microsoft Teams meeting recordings", fill=MUTED, font=_font(30))
    draw.text((tx, 320), "Click. Capture. Open the .md.", fill=WHITE, font=_font(28))
    draw.text((tx, 360), "(or grab the raw WebVTT — your call.)", fill=MUTED, font=_font(24))

    out = HERE / "marquee-1400x560.png"
    bg.convert("RGB").save(out, optimize=True)
    return out


def main() -> int:
    if not ICON_SVG.exists():
        print(f"Missing icon SVG: {ICON_SVG}", file=sys.stderr)
        return 1
    outputs = [build_1280x800(), build_440x280(), build_marquee_1400x560()]
    for p in outputs:
        print(f"  {p.relative_to(EXT_ROOT)}  ({p.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

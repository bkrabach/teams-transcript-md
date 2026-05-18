#!/usr/bin/env python3
"""Render every SVG icon option in this directory to PNGs at 16/32/48/128
and build a side-by-side preview composite.

Re-run after editing any source.svg:

    python3 icon-options/build_icons.py
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

import cairosvg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).parent
SIZES = [16, 32, 48, 128]


# ---------------------------------------------------------------------------
# SVG sources (kept here so they're version-controlled with the renderer).
# Each option ships at viewBox 0 0 128 128 so cairosvg can render any size.
# ---------------------------------------------------------------------------

# Microsoft Teams brand purple. The other shades are tuned siblings of it.
PURPLE = "#6264A7"
PURPLE_DK = "#4F529A"
PURPLE_LT = "#8B8DCE"
INK = "#1F1F2E"
PAPER = "#FFFFFF"


SOURCES: dict[str, str] = {}


SOURCES["01-bubble"] = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <!-- Teams-style chat bubble with .md inside -->
  <rect x="10" y="18" width="108" height="74" rx="18" ry="18" fill="{PURPLE}"/>
  <path d="M 32 92 L 32 116 L 58 92 Z" fill="{PURPLE}"/>
  <text x="64" y="73" text-anchor="middle"
        font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif"
        font-weight="900" font-size="44" fill="{PAPER}"
        letter-spacing="-1">md</text>
</svg>"""


SOURCES["02-doc"] = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <!-- Document with a coloured header bar and four caption lines -->
  <rect x="18" y="10" width="92" height="108" rx="10" fill="{PAPER}"/>
  <path d="M 18 20 Q 18 10 28 10 H 100 Q 110 10 110 20 V 36 H 18 Z" fill="{PURPLE}"/>
  <!-- Single small dot in header (speaker avatar hint) -->
  <circle cx="32" cy="23" r="5" fill="{PAPER}" opacity="0.85"/>
  <rect x="44" y="20" width="34" height="6" rx="3" fill="{PAPER}" opacity="0.85"/>
  <!-- Caption lines -->
  <rect x="30" y="52" width="68" height="7" rx="3.5" fill="{INK}"/>
  <rect x="30" y="68" width="56" height="7" rx="3.5" fill="{INK}"/>
  <rect x="30" y="84" width="64" height="7" rx="3.5" fill="{INK}"/>
  <rect x="30" y="100" width="44" height="7" rx="3.5" fill="{INK}"/>
</svg>"""


SOURCES["03-monogram"] = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <!-- Bold MD letterform on a rounded purple tile -->
  <defs>
    <linearGradient id="g3" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7376BD"/>
      <stop offset="1" stop-color="{PURPLE_DK}"/>
    </linearGradient>
  </defs>
  <rect x="6" y="6" width="116" height="116" rx="24" fill="url(#g3)"/>
  <text x="64" y="88" text-anchor="middle"
        font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif"
        font-weight="900" font-size="68" fill="{PAPER}"
        letter-spacing="-2">MD</text>
</svg>"""


SOURCES["04-caption"] = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <!-- Rounded card with three speaker rows: avatar dot + caption bar -->
  <rect x="6" y="6" width="116" height="116" rx="22" fill="{PAPER}" stroke="{PURPLE}" stroke-width="6"/>
  <!-- Row 1 -->
  <circle cx="28" cy="42" r="8" fill="{PURPLE}"/>
  <rect x="44" y="37" width="62" height="10" rx="5" fill="{PURPLE}"/>
  <!-- Row 2 (lighter, different speaker) -->
  <circle cx="28" cy="66" r="8" fill="{PURPLE_LT}"/>
  <rect x="44" y="61" width="48" height="10" rx="5" fill="{PURPLE_LT}"/>
  <!-- Row 3 (back to speaker 1) -->
  <circle cx="28" cy="90" r="8" fill="{PURPLE}"/>
  <rect x="44" y="85" width="56" height="10" rx="5" fill="{PURPLE}"/>
</svg>"""


# ---------------------------------------------------------------------------
# Render
# ---------------------------------------------------------------------------


def write_svg(option_dir: Path, svg: str) -> None:
    (option_dir / "source.svg").write_text(svg, encoding="utf-8")


def render_png(svg: str, size: int) -> bytes:
    # Render at 2x the target then downsample with Pillow LANCZOS for crisper
    # results at small sizes than cairo's direct downsample.
    upscale = max(size, 256)
    raw = cairosvg.svg2png(bytestring=svg.encode("utf-8"),
                           output_width=upscale, output_height=upscale)
    if size == upscale:
        return raw
    img = Image.open(io.BytesIO(raw)).convert("RGBA")
    img = img.resize((size, size), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def render_option(name: str, svg: str) -> None:
    option_dir = ROOT / name
    option_dir.mkdir(parents=True, exist_ok=True)
    write_svg(option_dir, svg)
    for size in SIZES:
        png = render_png(svg, size)
        (option_dir / f"icon-{size}.png").write_bytes(png)
        print(f"  {name}/icon-{size}.png ({len(png):,} bytes)")


# ---------------------------------------------------------------------------
# Preview composite
# ---------------------------------------------------------------------------


def build_preview() -> Path:
    """A single PNG showing every option at toolbar-ish (32) and detail (128)
    sizes against light + dark backgrounds, with labels."""
    options = sorted(SOURCES.keys())
    cols = len(options)
    cell_w = 200
    header_h = 36
    row_label_w = 86
    detail_h = 160
    toolbar_h = 64
    pad = 16

    W = row_label_w + cols * cell_w + pad
    H = header_h + detail_h * 2 + toolbar_h * 2 + pad * 2

    img = Image.new("RGB", (W, H), "#f4f4f7")
    draw = ImageDraw.Draw(img)

    try:
        font_h = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 18)
        font_b = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
    except OSError:
        font_h = ImageFont.load_default()
        font_b = ImageFont.load_default()

    # Column headers
    for ci, name in enumerate(options):
        cx = row_label_w + ci * cell_w
        label = name.split("-", 1)[1] if "-" in name else name
        draw.text((cx + cell_w // 2, header_h // 2),
                  label, fill="#1f1f1f", font=font_h, anchor="mm")

    y = header_h

    # Row 1: 128px detail on light bg
    draw.rectangle((0, y, W, y + detail_h), fill="#ffffff")
    draw.text((row_label_w - 8, y + detail_h // 2),
              "128 · light", fill="#666666", font=font_b, anchor="rm")
    for ci, name in enumerate(options):
        cx = row_label_w + ci * cell_w
        icon = Image.open(ROOT / name / "icon-128.png").convert("RGBA")
        img.paste(icon, (cx + (cell_w - 128) // 2, y + (detail_h - 128) // 2), icon)
    y += detail_h

    # Row 2: 128px detail on dark bg
    draw.rectangle((0, y, W, y + detail_h), fill="#1f1f1f")
    draw.text((row_label_w - 8, y + detail_h // 2),
              "128 · dark", fill="#aaaaaa", font=font_b, anchor="rm")
    for ci, name in enumerate(options):
        cx = row_label_w + ci * cell_w
        icon = Image.open(ROOT / name / "icon-128.png").convert("RGBA")
        img.paste(icon, (cx + (cell_w - 128) // 2, y + (detail_h - 128) // 2), icon)
    y += detail_h

    # Row 3: toolbar sizes (16, 32, 48) on light bg
    draw.rectangle((0, y, W, y + toolbar_h), fill="#ffffff")
    draw.text((row_label_w - 8, y + toolbar_h // 2),
              "16·32·48 light", fill="#666666", font=font_b, anchor="rm")
    for ci, name in enumerate(options):
        cx = row_label_w + ci * cell_w + 20
        cy = y + toolbar_h // 2
        for px, sz in zip([0, 24, 64], [16, 32, 48]):
            icon = Image.open(ROOT / name / f"icon-{sz}.png").convert("RGBA")
            img.paste(icon, (cx + px, cy - sz // 2), icon)
    y += toolbar_h

    # Row 4: toolbar sizes on dark bg
    draw.rectangle((0, y, W, y + toolbar_h), fill="#1f1f1f")
    draw.text((row_label_w - 8, y + toolbar_h // 2),
              "16·32·48 dark", fill="#aaaaaa", font=font_b, anchor="rm")
    for ci, name in enumerate(options):
        cx = row_label_w + ci * cell_w + 20
        cy = y + toolbar_h // 2
        for px, sz in zip([0, 24, 64], [16, 32, 48]):
            icon = Image.open(ROOT / name / f"icon-{sz}.png").convert("RGBA")
            img.paste(icon, (cx + px, cy - sz // 2), icon)

    out = ROOT / "preview.png"
    img.save(out, optimize=True)
    return out


def main() -> int:
    print("Rendering icon options:")
    for name, svg in SOURCES.items():
        render_option(name, svg)
    preview = build_preview()
    print(f"Preview composite -> {preview} ({preview.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

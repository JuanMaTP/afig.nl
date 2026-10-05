"""Shared helpers: shape text with HarfBuzz, draw outlined glyphs with fontTools."""
import functools
from pathlib import Path

import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import DecomposingRecordingPen

FONTS = Path(__file__).parent / "fonts"


@functools.lru_cache(maxsize=None)
def instance(name, axes_items):
    font = TTFont(FONTS / name)
    return instantiateVariableFont(font, dict(axes_items), inplace=False)


def glyphset(name, axes):
    return instance(name, tuple(sorted(axes.items()))).getGlyphSet()


def shape(name, text, axes, tracking=0):
    """Return [(glyph_name, x_offset, advance)] in font units, kerned, with tracking."""
    face = hb.Face(hb.Blob.from_file_path(str(FONTS / name)))
    font = hb.Font(face)
    font.set_variations(axes)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf, {"kern": True, "liga": False})
    ttf = instance(name, tuple(sorted(axes.items())))
    out, x = [], 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        out.append((ttf.getGlyphName(info.codepoint), x + pos.x_offset, pos.x_advance))
        x += pos.x_advance + tracking
    return out


def bounds(name, axes, glyph):
    pen = BoundsPen(glyphset(name, axes))
    glyphset(name, axes)[glyph].draw(pen)
    return pen.bounds


def contours(name, axes, glyph):
    """Bounding box of each contour of a glyph (composites decomposed)."""
    gs = glyphset(name, axes)
    rec = DecomposingRecordingPen(gs)
    gs[glyph].draw(rec)
    boxes, cur = [], []
    for op, args in rec.value:
        for pt in args:
            cur.append(pt)
        if op in ("closePath", "endPath"):
            xs = [p[0] for p in cur]
            ys = [p[1] for p in cur]
            boxes.append((min(xs), min(ys), max(xs), max(ys)))
            cur = []
    return boxes


def path(name, axes, glyph, dx, scale, baseline):
    """SVG path data for a glyph at x offset dx (font units), flipped into SVG space."""
    gs = glyphset(name, axes)
    pen = SVGPathPen(gs, ntos=lambda v: f"{v:.1f}".rstrip("0").rstrip("."))
    tpen = TransformPen(pen, (scale, 0, 0, -scale, dx * scale, baseline))
    gs[glyph].draw(tpen)
    return pen.getCommands()

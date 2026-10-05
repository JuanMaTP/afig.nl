"""The AFiG logo (direction Fig dot, decided 1 October 2026; navy and red since 3 October) as outlined SVG parts.

Everything is drawn from Figtree's real outlines, so no file depends on a loaded font.
The wordmark's letters are 100 SVG units per em; lockups are laid out in those units.
"""
import math
from collections import namedtuple

from fontTools.pens.boundsPen import BoundsPen
from fontTools.svgLib.path import parse_path

from glyphs import shape, contours, bounds, path

C = dict(
    pith="#F6EFE3", paper="#FFFBF5", ink="#1A1F3A", muted="#59607E", mutedd="#B9BED6",
    navy="#1E2A5A", red="#E5462F", leaf="#4F6B3C", leafd="#8DAA6E", night="#10142B",
)

FONT = "Figtree-Variable.ttf"
WGHT = 800   # ExtraBold
TRACK = -10  # font units between letters
FIG_H = 215  # height of the fig dot in font units (Figtree's own i-dot is 132)
S = 0.1      # SVG units per font unit

# The fig dot (30-unit box): the icon's outline scaled down, then its stalk.
FIG_BODY = [("M", (15, 4)), ("C", (16, 4, 16.42, 5.5, 17.42, 6.75)), ("C", (20.83, 8.67, 22.17, 12.17, 21.67, 15.67)),
            ("C", (21.17, 19.5, 18.25, 21.5, 15, 21.5)), ("C", (11.75, 21.5, 8.83, 19.5, 8.33, 15.67)),
            ("C", (7.83, 12.17, 9.17, 8.67, 12.58, 6.75)), ("C", (13.58, 5.5, 14, 4, 15, 4)), ("Z", ())]
FIG_STALK = ((15, 4), (16.6, 0.9))

# The icon's fig (64-unit box), halfway between the first tall drop and a wide fig, so its skin can be thick
# (5.2 at the sides and bottom). Inside: a pith ring, round flesh, five holes and a hub, like a film reel.
FIG64 = ("M32 8 C35 8 36.25 12.5 39.25 16.25 C49.5 22 53.5 32.5 52 43 C50.5 54.5 41.75 60.5 32 60.5 "
         "C22.25 60.5 13.5 54.5 12 43 C10.5 32.5 14.5 22 24.75 16.25 C27.75 12.5 29 8 32 8 Z")
CY = 40.2                                # centre of the flesh
RING_R, FLESH_R = 15.1, 13.1             # the pith ring's outer edge, the flesh
HOLES = (7.5, 3.35, 2.2)                 # holes: distance from the centre, radius; the hub's radius
# The stalk is a strip of film: it leaves the neck, rises and bends over in an S, in Leaf, its sprocket holes cut
# out. A cubic curve (control points), its width, and the sprockets: spacing along the curve, first one, size, margin.
STRIP = ((32, 12), (30, 0), (44, -6), (50, 4))
STRIP_W, SPROCKETS = 6.2, (2.7, 1.6, (1.15, 0.85), 0.62)
# The strip rises above the 64-unit box, so the full icon is drawn 95 % and moved down to fit it.
FIT = (0.95, 4.4, 1)  # scale; shift down before scaling, after it
# The small icon, for 16 and 32 px: no ring, hub or stalk (the outline's neck is the tip), larger holes.
SMALL_FLESH_R, SMALL_HOLES = 15.1, (8.5, 4.1)
# The favicon: the small icon at 92 % on a navy tile with rounded corners (corner radius in the 64-unit box).
TILE = (0.92, 12)

NAME = "Amsterdam Film Group"
ICON_LABEL = "AFiG icon: a fig cut in half, its seeds set like the holes of a film reel"

Part = namedtuple("Part", "body w h")
Line = namedtuple("Line", "body w cap desc")


def n(v):
    return f"{v:.2f}".rstrip("0").rstrip(".")


def reel(ring, r):
    """Five holes around the flesh's centre, the first one at the top."""
    return [(32 + ring * math.cos(a), CY + ring * math.sin(a), r)
            for a in (math.radians(-90 + 72 * i) for i in range(5))]


def circles(holes, attr):
    return "".join(f'<circle cx="{n(x)}" cy="{n(y)}" r="{n(r)}" {attr}/>' for x, y, r in holes)


def strip_points(steps=120):
    """Points along the strip's curve, each with its unit tangent (tx, ty) and normal (nx, ny)."""
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = STRIP
    out = []
    for i in range(steps + 1):
        t, u = i / steps, 1 - i / steps
        x = u ** 3 * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * x3
        y = u ** 3 * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * y3
        dx = 3 * u * u * (x1 - x0) + 6 * u * t * (x2 - x1) + 3 * t * t * (x3 - x2)
        dy = 3 * u * u * (y1 - y0) + 6 * u * t * (y2 - y1) + 3 * t * t * (y3 - y2)
        k = math.hypot(dx, dy)
        out.append((x, y, dx / k, dy / k, -dy / k, dx / k))
    return out


def strip_edges():
    pts, h = strip_points(), STRIP_W / 2
    return [(x + nx * h, y + ny * h) for x, y, _, _, nx, ny in pts], [(x - nx * h, y - ny * h) for x, y, _, _, nx, ny in pts]


def strip_path():
    """The film strip as one path: its outline, then each sprocket hole, cut out by fill-rule evenodd."""
    pts = strip_points()
    left, right = strip_edges()
    d = ["M" + " L".join(f"{n(x)} {n(y)}" for x, y in left + right[::-1]) + " Z"]
    pitch, s, (sw, sh), margin = SPROCKETS
    off = STRIP_W / 2 - margin - sh / 2
    length = [0.0]
    for a, b in zip(pts, pts[1:]):
        length.append(length[-1] + math.dist(a[:2], b[:2]))
    while s <= length[-1] - pitch / 2:
        x, y, tx, ty, nx, ny = pts[min(range(len(pts)), key=lambda i: abs(length[i] - s))]
        for side in (1, -1):
            cx, cy = x + side * off * nx, y + side * off * ny
            corners = [(cx + a * tx * sw / 2 + b * nx * sh / 2, cy + a * ty * sw / 2 + b * ny * sh / 2)
                       for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
            d.append("M" + " L".join(f"{n(px)} {n(py)}" for px, py in corners) + " Z")
        s += pitch
    return " ".join(d)


def fit(body):
    scale, before, after = FIT
    return f'<g transform="translate(32 {n(after)}) scale({scale}) translate(-32 {n(before)})">{body}</g>'


def wordmark(mode="light"):
    """'AFiG' in Figtree ExtraBold with a fig as the dot on the i. Navy letters on light grounds, Pith on dark;
    the fig is red on both."""
    light = mode == "light"
    axes = {"wght": WGHT}
    glyphs = shape(FONT, "AFıG", axes, TRACK)
    dx_i = next(x for g, x, _ in glyphs if g == "dotlessi")
    dot = next(b for b in contours(FONT, axes, "i") if b[1] > 300)
    cx = (dot[0] + dot[2]) / 2 + dx_i

    # The fig sits where Figtree's own dot would, slightly lower; in font units with y up.
    k = FIG_H / 17.5
    bottom = dot[1] - 8
    up = lambda x, y: (cx + (x - 15) * k, bottom + (21.5 - y) * k)
    dot_top = bottom + (21.5 - FIG_STALK[1][1]) * k

    left = min(x + bounds(FONT, axes, g)[0] for g, x, _ in glyphs)
    right = max(x + bounds(FONT, axes, g)[2] for g, x, _ in glyphs)
    top = max([bounds(FONT, axes, g)[3] for g, _, _ in glyphs] + [dot_top])
    low = min(bounds(FONT, axes, g)[1] for g, _, _ in glyphs)
    pad = 2
    base = top * S + pad
    shift = -left + pad / S
    to_svg = lambda x, y: ((x + shift) * S, base - y * S)

    letters = " ".join(path(FONT, axes, g, x + shift, S, base) for g, x, _ in glyphs)
    d = []
    for op, args in FIG_BODY:
        pts = [to_svg(*up(args[i], args[i + 1])) for i in range(0, len(args), 2)]
        d.append(op + " ".join(f"{n(x)} {n(y)}" for x, y in pts))
    (x1, y1), (x2, y2) = (to_svg(*up(*p)) for p in FIG_STALK)
    body = (f'<path d="{letters}" fill="{C["navy"] if light else C["pith"]}"/>'
            f'<path d="M{n(x1)} {n(y1)} L{n(x2)} {n(y2)}" stroke="{C["leaf"] if light else C["leafd"]}" '
            f'stroke-width="{n(1.6 * k * S)}" stroke-linecap="round" fill="none"/>'
            f'<path d="{" ".join(d)}" fill="{C["red"]}"/>')
    return Part(body, (right - left) * S + 2 * pad, base - low * S + pad)


def text(label, em, fill, wght=400):
    """A line of Figtree at `em` SVG units per em, with its baseline at y = 0."""
    axes = {"wght": wght}
    glyphs = shape(FONT, label, axes)
    s = em / 1000
    d = " ".join(filter(None, (path(FONT, axes, g, x, s, 0) for g, x, _ in glyphs)))
    low = min(bounds(FONT, axes, g)[1] for g, _, _ in glyphs if bounds(FONT, axes, g))
    return Line(f'<path d="{d}" fill="{fill}"/>', sum(a for _, _, a in glyphs) * s, 0.7 * em, -low * s)


def colours(mode):
    """The icon on a light ground has a navy skin. Navy disappears on dark grounds, so there the skin turns
    Pith and the pith ring and holes take the ground's colour: "dark" is Night, "navy" the avatar's ground."""
    if mode == "light":
        return dict(skin=C["navy"], ring=C["pith"], hole=C["paper"], stalk=C["leaf"])
    ground = C["night"] if mode == "dark" else C["navy"]
    return dict(skin=C["pith"], ring=ground, hole=ground, stalk=C["leafd"])


def icon(mode="light"):
    """A fig cut in half, its seeds set like the holes of a film reel, its stalk a strip of film; 64-unit box.
    Three layers (skin, pith ring, flesh) and the holes. For 40 px and up."""
    c = colours(mode)
    hub = (32, CY, HOLES[2])
    body = (f'<path d="{strip_path()}" fill="{c["stalk"]}" fill-rule="evenodd"/>'
            f'<path d="{FIG64}" fill="{c["skin"]}"/>'
            f'<circle cx="32" cy="{n(CY)}" r="{n(RING_R)}" fill="{c["ring"]}"/>'
            f'<circle cx="32" cy="{n(CY)}" r="{n(FLESH_R)}" fill="{C["red"]}"/>'
            + circles(reel(*HOLES[:2]) + [hub], f'fill="{c["hole"]}"'))
    return Part(fit(body), 64, 64)


def icon_small(mode="light"):
    """The icon for 16 and 32 px: skin, flesh and five larger holes."""
    c = colours(mode)
    return Part(f'<path d="{FIG64}" fill="{c["skin"]}"/>'
                f'<circle cx="32" cy="{n(CY)}" r="{n(SMALL_FLESH_R)}" fill="{C["red"]}"/>'
                + circles(reel(*SMALL_HOLES), f'fill="{c["hole"]}"'), 64, 64)


def favicon():
    """The small icon on its own navy tile, so it looks the same on any browser tab: light, dark or a theme's
    colour. (Following the system's colour scheme isn't enough: a tab strip can be dark in a light system.)"""
    scale, radius = TILE
    cy = (8 + 60.5) / 2  # the middle of the fig's outline
    return Part(f'<rect width="64" height="64" rx="{n(radius)}" fill="{C["navy"]}"/>'
                f'<g transform="translate(32 32) scale({scale}) translate(-32 -{n(cy)})">{icon_small("navy").body}</g>', 64, 64)


def icon_mono(ink):
    """The icon in one ink, for print: the pith ring, the holes and the sprockets are cut out (transparent)."""
    def ring(cx, cy, r):
        return f"M{n(cx - r)} {n(cy)} a{n(r)} {n(r)} 0 1 0 {n(2 * r)} 0 a{n(r)} {n(r)} 0 1 0 {n(-2 * r)} 0 Z"
    holes = reel(*HOLES[:2]) + [(32, CY, HOLES[2])]
    d = " ".join([FIG64, ring(32, CY, RING_R), ring(32, CY, FLESH_R)] + [ring(*h) for h in holes])
    return Part(fit(f'<path d="{strip_path()}" fill="{ink}" fill-rule="evenodd"/>'
                    f'<path d="{d}" fill="{ink}" fill-rule="evenodd"/>'), 64, 64)


def icon_bounds():
    """Where the drawing sits inside the icon's 64-unit box: the fig and its film strip, after fit()."""
    pen = BoundsPen(None)
    parse_path(FIG64, pen)
    left, right = strip_edges()
    xs = [x for x, _ in left + right] + [pen.bounds[0], pen.bounds[2]]
    ys = [y for _, y in left + right] + [pen.bounds[1], pen.bounds[3]]
    scale, before, after = FIT
    fx = lambda x: 32 + scale * (x - 32)
    fy = lambda y: after + scale * (y + before)
    return fx(min(xs)), fy(min(ys)), fx(max(xs)), fy(max(ys))


def lockup(kind, mode="light"):
    """Icon, wordmark and 'Amsterdam Film Group'. Horizontal for the site, email and documents;
    stacked for square posts and posters."""
    light = mode == "light"
    mark = wordmark(mode)
    if kind == "horizontal":
        k, gap, em, sub_gap = 1.78, 48, 20, 13.5
    else:
        k, gap, em, sub_gap = 2.27, 32, 23, 15.7
    sub = text(NAME, em, C["muted"] if light else C["mutedd"])
    x0, y0, x1, y1 = icon_bounds()
    iw, ih = (x1 - x0) * k, (y1 - y0) * k
    sub_base = mark.h + sub_gap + sub.cap  # baseline of the name, below the wordmark
    tw, th = max(mark.w, sub.w), sub_base + sub.desc
    m = 4

    def place_icon(x, y):
        return f'<g transform="translate({n(x - x0 * k)} {n(y - y0 * k)}) scale({k})">{icon(mode).body}</g>'

    if kind == "horizontal":
        h = max(ih, th)
        ty = m + (h - th) / 2
        tx = m + iw + gap
        body = (place_icon(m, m + (h - ih) / 2)
                + f'<g transform="translate({n(tx)} {n(ty)})">{mark.body}</g>'
                + f'<g transform="translate({n(tx)} {n(ty + sub_base)})">{sub.body}</g>')
        return Part(body, iw + gap + tw + 2 * m, h + 2 * m)

    w = max(iw, tw)
    body = (place_icon(m + (w - iw) / 2, m)
            + f'<g transform="translate({n(m + (w - mark.w) / 2)} {n(m + ih + gap)})">{mark.body}</g>'
            + f'<g transform="translate({n(m + (w - sub.w) / 2)} {n(m + ih + gap + sub_base)})">{sub.body}</g>')
    return Part(body, w + 2 * m, ih + gap + th + 2 * m)


def avatar():
    """The icon in Pith on a navy ground, square: WhatsApp and Meetup crop it to a circle."""
    body = (f'<rect width="64" height="64" fill="{C["navy"]}"/>'
            f'<g transform="translate(32 32) scale(0.74) translate(-32 -32)">{icon("navy").body}</g>')
    return Part(body, 64, 64)


def svg(part, label):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n(part.w)} {n(part.h)}" width="{n(part.w)}" '
            f'height="{n(part.h)}" role="img" aria-label="{label}"><title>{label}</title>{part.body}</svg>\n')

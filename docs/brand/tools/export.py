"""Write the AFiG logo files: the masters in docs/brand/logo/ and the favicons in public/.

    pip install -r docs/brand/tools/requirements.txt
    python docs/brand/tools/export.py
"""
import struct
from pathlib import Path

import resvg_py

import intro
from marks import C, NAME, ICON_LABEL, wordmark, icon, icon_small, icon_mono, favicon, lockup, avatar, svg

ROOT = Path(__file__).resolve().parents[3]
LOGO = ROOT / "docs" / "brand" / "logo"
PUBLIC = ROOT / "public"


def png(markup, width=None, height=None):
    return bytes(resvg_py.svg_to_bytes(svg_string=markup, width=width, height=height, skip_system_fonts=True))


def ico(images):
    """An .ico holding PNG images, given as [(size_px, png_bytes)]."""
    out = struct.pack("<HHH", 0, 1, len(images))
    offset = 6 + 16 * len(images)
    for px, data in images:
        out += struct.pack("<BBBBHHII", px % 256, px % 256, 0, 0, 1, 32, len(data), offset)
        offset += len(data)
    return out + b"".join(data for _, data in images)


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(data, str):
        path.write_text(data, encoding="utf-8", newline="\n")
    else:
        path.write_bytes(data)
    print(path.relative_to(ROOT).as_posix())


def main():
    full = f"AFiG: {NAME}"
    masters = [
        # name, markup, PNG size
        ("afig-wordmark", svg(wordmark(), "AFiG"), dict(width=1200)),
        ("afig-wordmark-dark", svg(wordmark("dark"), "AFiG"), dict(width=1200)),
        ("afig-icon", svg(icon(), ICON_LABEL), dict(width=512)),
        ("afig-icon-dark", svg(icon("dark"), ICON_LABEL), dict(width=512)),
        ("afig-icon-small", svg(icon_small(), ICON_LABEL), dict(width=512)),
        ("afig-icon-small-dark", svg(icon_small("dark"), ICON_LABEL), dict(width=512)),
        ("afig-icon-mono", svg(icon_mono(C["navy"]), ICON_LABEL), dict(width=512)),
        ("afig-icon-mono-light", svg(icon_mono(C["pith"]), ICON_LABEL), dict(width=512)),
        ("afig-lockup-horizontal", svg(lockup("horizontal"), full), dict(width=1600)),
        ("afig-lockup-horizontal-dark", svg(lockup("horizontal", "dark"), full), dict(width=1600)),
        ("afig-lockup-stacked", svg(lockup("stacked"), full), dict(height=1200)),
        ("afig-avatar", svg(avatar(), ICON_LABEL), dict(width=1024)),
    ]
    for name, markup, size in masters:
        write(LOGO / f"{name}.svg", markup)
        write(LOGO / f"{name}.png", png(markup, **size))

    # The favicon on its own navy tile, the same on every tab.
    write(PUBLIC / "favicon.svg", svg(favicon(), "AFiG"))
    write(PUBLIC / "favicon.ico", ico([(px, png(svg(favicon(), "AFiG"), px, px)) for px in (16, 32, 48)]))
    write(PUBLIC / "apple-touch-icon.png", png(svg(avatar(), "AFiG"), 180, 180))
    write(PUBLIC / "afig-avatar.png", png(svg(avatar(), ICON_LABEL), 1024, 1024))  # the link preview image
    intro.write()  # src/components/IntroMark.astro


if __name__ == "__main__":
    main()

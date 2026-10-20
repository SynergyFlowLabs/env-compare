#!/usr/bin/env python3
"""Rasterise the generated social SVGs to the PNGs that actually get uploaded.

`scripts/build-social.mjs` writes SVG, because SVG is text: reviewable in a diff,
editable without an image editor, and renderable by anything. Every platform,
though, wants a bitmap, so this turns one into the other.

    python3 scripts/render-social.py             # every SVG under docs/social
    python3 scripts/render-social.py --zoom 1    # 1x instead of the 2x default
    python3 scripts/render-social.py docs/social/linkedin/linkedin-card.svg

Why 2x. The design is already drawn at each platform's native pixel size
(1080×1350, 1200×1200, 1600×900), so 1x is correct for the upload. At 2x the
text stays sharp when a feed displays a crop of the card on a retina screen, and
the file is still well under every platform's limit. Rendering at the natural
size and then scaling the *layout* — `svg_to_bytes(width=…)` — reflows nothing
and lies about how the card looks, so this only ever passes `zoom`.

Requires resvg-py:  pip install --break-system-packages resvg-py
"""

from __future__ import annotations

import argparse
import glob
import os
import sys

DEFAULT_ZOOM = 2.0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "files",
        nargs="*",
        help="SVG files to render; defaults to every *.svg under docs/social",
    )
    parser.add_argument(
        "--zoom",
        type=float,
        default=DEFAULT_ZOOM,
        help=f"scale factor (default {DEFAULT_ZOOM:g}, i.e. 2x)",
    )
    args = parser.parse_args(argv)

    try:
        import resvg_py
    except ImportError:
        print(
            "resvg-py is not installed. Run:\n"
            "  pip install --break-system-packages resvg-py",
            file=sys.stderr,
        )
        return 2

    files = args.files or sorted(glob.glob(os.path.join("docs", "social", "*", "*.svg")))
    if not files:
        print("no SVGs found — run `node scripts/build-social.mjs` first", file=sys.stderr)
        return 1

    for path in files:
        png = path[:-4] + ".png"
        # resvg has no `scale`; `zoom` is the render-time multiplier.
        data = bytes(resvg_py.svg_to_bytes(svg_string=open(path, encoding="utf-8").read(), zoom=args.zoom))
        with open(png, "wb") as fh:
            fh.write(data)
        print(f"{png}  {len(data) // 1024} KB")

    print(f"\n{len(files)} PNG(s) at {args.zoom:g}x")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

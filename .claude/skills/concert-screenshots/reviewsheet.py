#!/usr/bin/env python3
"""One low-resolution montage of the CHOSEN picks - the only image a model reads.

Cost arithmetic, which is the whole point:
  - a per-show contact sheet is ~2400x1900  -> ~6,000 vision tokens EACH
  - 27 shows                                -> ~160,000 tokens just to look
  - this montage, 4 picks x 27 shows at 300px wide, is ONE image of ~1600x2200
                                            -> ~4,700 tokens TOTAL

Same decisions are still possible: you are judging whether the chosen frame is a
close-up, whether it is the right band, whether it is a title card. None of that
needs 2400px. Ask for a specific show's full contact sheet only when the montage
shows something wrong.
"""
from __future__ import annotations

import argparse
import glob
import json
from pathlib import Path

from PIL import Image, ImageDraw

HOME = Path.home() / "VaultShots"
DATA = HOME / "data"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--artist", required=True)
    ap.add_argument("--width", type=int, default=300, help="per-thumb width")
    ap.add_argument("--out", default=str(HOME / "reports" / "review.jpg"))
    a = ap.parse_args()

    picks = json.loads((DATA / "picks.json").read_text())
    state = json.loads((DATA / "state.json").read_text())
    by_key = {s["key"]: s for s in state["shows"]}

    W = a.width
    H = int(W * 0.62)
    rows = []
    for frag, sel in picks.items():
        keys = [k for k in by_key if frag in k]
        if not keys:
            continue
        sh = by_key[keys[0]]
        imgs = []
        for lb, ts in sel:
            hits = glob.glob(str(HOME / "work" / keys[0] / ("*_t%s.jpg" % ts)))
            imgs.append(Image.open(hits[0]).resize((W, H)) if hits else None)
        rows.append((sh["FolderName"], [lb.split()[0] for lb, _ in sel], imgs))

    if not rows:
        raise SystemExit("no picks resolve")

    LBL = 15
    sheet = Image.new("RGB", (W * 4, len(rows) * (H + LBL + 13)), (12, 12, 12))
    dr = ImageDraw.Draw(sheet)
    y = 0
    for name, tags, imgs in rows:
        dr.text((3, y + 2), name[:96], fill=(235, 200, 90))
        y += LBL
        for i, (tag, im) in enumerate(zip(tags, imgs)):
            if im:
                sheet.paste(im, (i * W, y))
            dr.text((i * W + 3, y + H + 1), tag, fill=(190, 190, 190))
        y += H + 13

    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, quality=82, optimize=True)
    est = (sheet.width * sheet.height) / 750
    print("  %d shows x 4 picks -> %s" % (len(rows), out))
    print("  %dx%d, %.0f KB, ~%,d vision tokens".replace("%,d", "%d")
          % (sheet.width, sheet.height, out.stat().st_size / 1024, est))


if __name__ == "__main__":
    main()

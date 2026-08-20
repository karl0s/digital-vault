#!/usr/bin/env python3
"""Report every show whose images are not at their correct display geometry.

Read-only. Touches nothing - it produces the worklist for re-capture.

The rule being audited is the one in the concert-screenshots skill (SKILL.md
section 4.1): reach the display shape by GROWING the under-sampled axis, never
by shrinking the other one. A 720x480 NTSC frame that displays as 4:3 must be
written as 720x540, not 640x480 and certainly not left at 720x480.

Usage:
  python3 scripts/audit-image-geometry.py                # summary by artist
  python3 scripts/audit-image-geometry.py --artist "Foo Fighters"
  python3 scripts/audit-image-geometry.py --list         # every affected show
"""
import argparse, collections, glob, json, os, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required:  pip3 install Pillow")

TOL = 0.02   # 2% - covers even-number rounding on both axes


def fit_no_downsample(w, h, dar):
    """Identical to shots.fit_no_downsample. Kept in sync deliberately: this
    audit must fail if the pipeline's rule ever regresses, so it re-implements
    the rule rather than importing it from a staging directory that may not
    exist on this machine."""
    if dar >= w / h:
        tw, th = int(round(h * dar)), h
    else:
        tw, th = w, int(round(w / dar))
    return tw + tw % 2, th + th % 2


def as_int(v):
    """shows.json stores Width/Height as strings ('720'), and blank for the
    handful of records the scan could not probe."""
    try:
        return int(str(v).strip())
    except (TypeError, ValueError):
        return 0


def parse_dar(s):
    """'4:3 (native)' -> (1.333, False) ; '4:3 (letterboxed 16:9)' -> (1.778, True)"""
    s = (s or "").strip()
    if not s:
        return None, False
    letterboxed = "letterbox" in s.lower()
    nums = re.findall(r"(\d+)\s*:\s*(\d+)", s)
    if not nums:
        return None, letterboxed
    # For a letterboxed frame the REAL picture shape is the second ratio.
    a, b = nums[-1] if letterboxed else nums[0]
    a, b = int(a), int(b)
    return (a / b if b else None), letterboxed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--artist")
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()

    shows = json.loads((ROOT / "public/shows.json").read_text())
    man = json.loads((ROOT / "public/image-manifest.json").read_text())
    by_ck = {s["ChecksumSHA1"]: s for s in shows if s.get("ChecksumSHA1")}

    dims = {}
    for f in glob.glob(str(ROOT / "public/images/*_0*.jpg")):
        base = os.path.basename(f)[:-4]
        ck, slot = base.rsplit("_", 1)
        try:
            with Image.open(f) as im:
                dims.setdefault(ck, []).append((int(slot), im.size))
        except Exception as e:
            print("  unreadable: %s (%s)" % (base, e))

    stats = collections.Counter()
    per_artist = collections.defaultdict(lambda: collections.Counter())
    rows = []

    for ck, slots in sorted(dims.items()):
        s = by_ck.get(ck)
        if not s:
            stats["no show record"] += 1
            continue
        artist = s.get("Artist", "?")
        if a.artist and artist.lower() != a.artist.lower():
            continue
        w, h = as_int(s.get("Width")), as_int(s.get("Height"))
        dar, letterboxed = parse_dar(s.get("AspectRatio"))
        sizes = {sz for _, sz in slots}

        if not (w and h) or not dar:
            stats["unknown source geometry"] += 1
            per_artist[artist]["unknown"] += 1
            rows.append((artist, s, "UNKNOWN", sizes, None))
            continue

        if letterboxed:
            # Correct output needs cropdetect on the source; the stored frame
            # includes bars, so no target can be computed from metadata alone.
            stats["letterboxed - needs cropdetect"] += 1
            per_artist[artist]["letterboxed"] += 1
            rows.append((artist, s, "LETTERBOX", sizes, None))
            continue

        tw, th = fit_no_downsample(w, h, dar)
        want = (tw, th)

        if len(sizes) > 1:
            stats["inconsistent within show"] += 1
            per_artist[artist]["inconsistent"] += 1
            rows.append((artist, s, "MIXED", sizes, want))
            continue

        got = next(iter(sizes))
        ar_ok = abs(got[0] / got[1] - dar) / dar <= TOL
        if got == want:
            stats["correct"] += 1
            per_artist[artist]["correct"] += 1
        elif ar_ok and got[0] >= want[0] and got[1] >= want[1]:
            stats["correct shape, larger than target"] += 1
            per_artist[artist]["correct"] += 1
        elif ar_ok:
            stats["correct shape, undersized"] += 1
            per_artist[artist]["undersized"] += 1
            rows.append((artist, s, "SMALL", sizes, want))
        else:
            stats["WRONG ASPECT (squashed)"] += 1
            per_artist[artist]["squashed"] += 1
            rows.append((artist, s, "SQUASHED", sizes, want))

    total = sum(stats.values())
    print("\n  IMAGE GEOMETRY AUDIT — %d shows with images\n" % total)
    for k in ("correct", "correct shape, larger than target", "WRONG ASPECT (squashed)",
              "correct shape, undersized", "inconsistent within show",
              "letterboxed - needs cropdetect", "unknown source geometry", "no show record"):
        if stats.get(k):
            print("    %-38s %5d  (%4.1f%%)" % (k, stats[k], stats[k] / total * 100))

    if a.list or a.artist:
        print("\n  AFFECTED SHOWS\n")
        for artist, s, kind, sizes, want in sorted(rows, key=lambda r: (r[0], r[1].get("ShowDate") or "")):
            got = " / ".join("%dx%d" % x for x in sorted(sizes))
            tgt = "%dx%d" % want if want else "?"
            print("    %-9s %-26s %-34s %-14s -> %s"
                  % (kind, artist[:26], (s.get("FolderName") or s.get("ShowID"))[:34], got, tgt))
    else:
        print("\n  BY ARTIST (shows needing re-capture, worst first)\n")
        need = {k: v for k, v in per_artist.items()
                if v["squashed"] + v["undersized"] + v["inconsistent"]}
        for artist, c in sorted(need.items(),
                                key=lambda kv: -(kv[1]["squashed"] + kv[1]["undersized"] + kv[1]["inconsistent"])):
            n = c["squashed"] + c["undersized"] + c["inconsistent"]
            bits = [f"{c[k]} {k}" for k in ("squashed", "undersized", "inconsistent", "letterboxed") if c[k]]
            print("    %-32s %4d   %s" % (artist[:32], n, ", ".join(bits)))
        print("\n    %d artists need work. Re-run with --artist \"<name>\" for detail." % len(need))
    return 0


if __name__ == "__main__":
    sys.exit(main())

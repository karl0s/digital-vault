#!/usr/bin/env python3
"""Compare each record's declared AspectRatio against what the SOURCE actually says.

Read-only. Touches nothing.

Why this exists: scripts/audit-image-geometry.py checks the IMAGES against the
RECORD. If the record itself is wrong, both agree and the audit passes while the
stills are squashed. That is exactly what happened with a 2013 Rock in Rio DVD: it
declares SAR 8:9 / DAR 4:3, internally consistent, so every automated check passed
- but a 2013 festival broadcast is 16:9 and the picture was visibly squashed. The
correction lived only in the capture tool's overrides.json for six artists while
shows.json stayed wrong.

This walks the drive, probes each show's representative media, and reports where
the source disagrees with the record.

  python3 scripts/audit-aspect-vs-source.py --artist "Chris Cornell"
  python3 scripts/audit-aspect-vs-source.py            # whole collection (slow)
"""
import argparse, json, os, re, subprocess, sys
from pathlib import Path

ROOT  = Path(__file__).resolve().parent.parent
DRIVE = Path("/Volumes/Live Music")
VID   = {'.mkv','.mp4','.ts','.vob','.m2ts','.avi','.mpg','.mpeg','.m4v'}


def as_int(v):
    try: return int(str(v).strip())
    except (TypeError, ValueError): return 0


def parse_dar(s, want="frame"):
    """Two different questions can be asked of an AspectRatio string.

    "4:3 (letterboxed 16:9)" describes a 4:3 STORED FRAME containing a 16:9
    PICTURE. Comparing against the source flag needs the FRAME ratio (4:3), since
    that is what the container declares. Comparing against the rendered stills
    needs the PICTURE ratio (16:9), which is what capture crops to. Asking for the
    wrong one reports every correctly-recorded boxed show as a disagreement.
    """
    s = (s or "").strip()
    if not s: return None
    nums = re.findall(r"(\d+)\s*:\s*(\d+)", s)
    if not nums: return None
    boxed = "letterbox" in s.lower() or "pillarbox" in s.lower()
    a, b = (nums[-1] if (boxed and want == "picture") else nums[0])
    return int(a) / int(b) if int(b) else None


def probe(path):
    r = subprocess.run(["ffprobe","-v","error","-select_streams","v:0","-show_entries",
        "stream=width,height,sample_aspect_ratio","-of","default=nw=1", str(path)],
        capture_output=True, timeout=120)
    if r.returncode != 0: return None
    d = dict(l.split("=",1) for l in r.stdout.decode().strip().splitlines() if "=" in l)
    try:
        w, h = int(d["width"]), int(d["height"])
    except (KeyError, ValueError):
        return None
    sar = d.get("sample_aspect_ratio", "1:1")
    try:
        a, b = (int(x) for x in sar.split(":"))
        if a <= 0 or b <= 0: a, b = 1, 1
    except Exception:
        a, b = 1, 1
    return w, h, a / b, sar


def rep_media(folder):
    """The file the pipeline would hash: DVD titleset VOBs, else the largest video.

    The FEATURE is not always titleset 01. On many discs VTS_01 is the menu - a
    2-4 MB stub that is authored 4:3 even when the concert is 16:9. Probing it
    reported KoRn, Papa Roach and Soundgarden as aspect disagreements when all
    three records were correct; the menu's geometry simply is not the show's.
    Pick the titleset with the most bytes, then its first segment.
    """
    p = DRIVE / folder
    if p.is_file(): return p if p.suffix.lower() in VID else None
    if not p.is_dir(): return None
    for d in (p / "VIDEO_TS", p):
        if d.is_dir():
            v = [x for x in d.iterdir()
                 if x.is_file() and re.match(r"VTS_\d+_[1-9]\.VOB$", x.name, re.I)]
            if v:
                by_ts = {}
                for x in v:
                    by_ts.setdefault(x.name.split("_")[1], []).append(x)
                best = max(by_ts.values(), key=lambda g: sum(q.stat().st_size for q in g))
                return sorted(best)[0]
    vids = [x for x in p.rglob("*") if x.is_file() and x.suffix.lower() in VID
            and not x.name.startswith("._") and x.stat().st_size > 20*1024*1024]
    return max(vids, key=lambda f: f.stat().st_size) if vids else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--artist")
    ap.add_argument("--tolerance", type=float, default=0.03)
    a = ap.parse_args()

    shows = json.loads((ROOT / "public/shows.json").read_text())
    if a.artist:
        shows = [s for s in shows if (s.get("Artist") or "").lower() == a.artist.lower()]

    on_drive = {e.name: e.name for e in os.scandir(DRIVE)} if DRIVE.is_dir() else {}
    if not on_drive:
        sys.exit("  drive not mounted at %s" % DRIVE)

    checked = agree = disagree = skipped = 0
    rows = []
    for s in shows:
        fn = (s.get("FolderName") or "").strip()
        # The drive has been reorganised since the scan, so match by suffix on the
        # CURRENT names rather than trusting FolderPath.
        cand = [n for n in on_drive if n.lower().endswith(fn.lower())] if fn else []
        if not cand:
            cand = [n for n in on_drive if fn and fn.lower() in n.lower()]
        if len(cand) != 1:
            skipped += 1; continue
        f = rep_media(cand[0])
        if not f:
            skipped += 1; continue
        pr = probe(f)
        if not pr:
            skipped += 1; continue
        w, h, sar, sar_s = pr
        src_dar = (w * sar) / h
        rec_dar = parse_dar(s.get("AspectRatio"), want="frame")
        checked += 1
        if rec_dar is None:
            rows.append(("NO ASPECT", s, cand[0], w, h, sar_s, src_dar, None)); disagree += 1
        elif abs(src_dar - rec_dar) / rec_dar > a.tolerance:
            rows.append(("DISAGREES", s, cand[0], w, h, sar_s, src_dar, rec_dar)); disagree += 1
        else:
            agree += 1

    print("\n  ASPECT: RECORD vs SOURCE\n")
    print("    checked %d   agree %d   disagree %d   skipped %d (not on drive / unreadable)"
          % (checked, agree, disagree, skipped))
    if rows:
        print("\n    %-10s %-26s %-34s %-11s %-9s %-9s %s"
              % ("", "ARTIST", "FOLDER", "STORED", "SAR", "SOURCE", "RECORD SAYS"))
        for kind, s, folder, w, h, sar_s, sd, rd in sorted(rows, key=lambda r: (r[1]["Artist"], r[2])):
            print("    %-10s %-26s %-34s %-11s %-9s %-9s %s"
                  % (kind, s["Artist"][:26], folder[:34], "%dx%d" % (w, h), sar_s,
                     "%.3f" % sd, ("%.3f  (%s)" % (rd, s.get("AspectRatio"))) if rd else s.get("AspectRatio") or "(empty)"))
        print("\n    A disagreement means the record, the source flag, or both are wrong.")
        print("    Verify by rendering one frame at each candidate shape before changing anything")
        print("    - an internally consistent SAR/DAR pair can still be wrong (SKILL.md 4.4).")
    return 0


if __name__ == "__main__":
    sys.exit(main())

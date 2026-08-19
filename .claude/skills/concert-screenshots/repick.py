#!/usr/bin/env python3
"""Re-render the ALREADY-CHOSEN picks at the corrected geometry and deinterlacer.

Two things changed and both need the frames redone from source:
  * geometry  - stop scaling DOWN to reach the display shape (see shots.fit_no_downsample)
  * deinterlace - bwdif instead of pp=lb blend

The frames themselves must not change. Pick timestamps in picks.json are floored
to whole seconds, so re-deriving a frame number from the string alone can land up
to a second away - enough to catch a different moment. Instead the exact frame is
recovered by fitting time-vs-index across that show's existing work/ filenames,
which is how those timestamps were generated in the first place.
"""
import json, re, subprocess, sys, shutil, glob, os
from pathlib import Path
from PIL import Image
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent))
import shots

H     = Path.home()/"VaultShots"
WORK  = H/"work"
APPLY = "--apply" in sys.argv
W, MID = shots.DEINT_WINDOW, shots.DEINT_MID

state = json.loads((H/"data/state.json").read_text())
BY    = {s["key"]: s for s in state["shows"]}
P     = json.loads((H/"data/picks.json").read_text())

def fps_of(s):
    try:
        a, b = str(s.get("fps") or "25/1").split("/")
        return float(a)/float(b) if float(b) else 25.0
    except Exception:
        return 25.0

def comb_ratio(p):
    g = np.asarray(Image.open(p).convert("L"), np.float32)
    v = np.abs(2*g[1:-1,:]-g[:-2,:]-g[2:,:]).mean()
    h = np.abs(2*g[:,1:-1]-g[:,:-2]-g[:,2:]).mean()
    return float(v/h)

RX = re.compile(r"_c(\d+)_t(\d\d)-(\d\d)-(\d\d)\.jpg$")


def contiguous(ns):
    """Collapse a sorted frame list into runs, so overlapping windows around
    picks that sit close together merge instead of double-selecting."""
    out = []
    for n in ns:
        if out and n == out[-1][-1] + 1: out[-1].append(n)
        else: out.append([n])
    return out

def index_map(key):
    """{ts_string: (index, seconds)} for every surviving work frame."""
    out = {}
    for f in sorted((WORK/key).glob("*.jpg")):
        m = RX.search(f.name)
        if not m: continue
        i = int(m.group(1)); hh, mm, ss = (int(m.group(x)) for x in (2,3,4))
        out["%02d-%02d-%02d" % (hh,mm,ss)] = (i, hh*3600+mm*60+ss, f.name)
    return out

def fit(pairs):
    """Least squares ts = a*i + b over the floored timestamps."""
    i = np.array([p[0] for p in pairs], float)
    t = np.array([p[1] for p in pairs], float) + 0.5   # de-bias the floor
    a, b = np.polyfit(i, t, 1)
    return float(a), float(b)

total_ok = total_bad = 0
print("\n  Re-rendering picks — %s\n" % state.get("artist",""))
for frag, sel in P.items():
    ks = [k for k in BY if frag in k]
    if not ks:
        print("  NO SHOW for %s" % frag); total_bad += len(sel); continue
    s = BY[ks[0]]; key = s["key"]; fps = fps_of(s)
    imap = index_map(key)
    if len(imap) < 8:
        print("  %-22s no work frames to anchor from (%d) - SKIPPED" % (frag, len(imap)))
        total_bad += len(sel); continue
    a, b = fit([(v[0], v[1]) for v in imap.values()])

    targets = []
    for label, ts in sel:
        if ts not in imap:
            print("  %-22s %-28s ts %s not in work/ - SKIPPED" % (frag, label, ts))
            total_bad += 1; continue
        i, _, oldname = imap[ts]
        targets.append((label, ts, int(round((a*i + b) * fps)), oldname))
    if not targets: continue
    targets.sort(key=lambda x: x[2])          # ffmpeg emits in decode order

    # union of consecutive-frame windows, so bwdif always has real neighbours
    keep = sorted({n for _,_,f,_ in targets for n in range(f-MID, f-MID+W)})
    pos  = {n: j for j, n in enumerate(keep)}
    pre  = "select='" + "+".join("between(n\\,%d\\,%d)" % (g[0], g[-1])
                                 for g in contiguous(keep)) + "'"
    post = "select='" + "+".join("eq(n\\,%d)" % pos[f] for _,_,f,_ in targets) + "'"
    head, di, tail = shots.vf_parts(s, shots.DEFAULT_DEINT)
    vf = ",".join(x for x in (pre, head, di, post, tail) if x)

    outdir = H/"_repick"/key
    outdir.mkdir(parents=True, exist_ok=True)
    shots.assert_readonly_target(outdir)
    print("  %-22s %d picks  %dx%d  %s" % (frag, len(targets), s["target_w"], s["target_h"],
                                           "bwdif" if di else "progressive (no deint)"))
    # Reuse an earlier render if it is already complete and correctly shaped, so a
    # dry run followed by --apply does not decode every DVD a second time.
    made = sorted(outdir.glob("o*.jpg"))
    cached = len(made) == len(targets) and all(shots.verify(f, s)[0] for f in made)
    if cached:
        print("     reusing cached render")
    else:
        for f in made: f.unlink()
        r = subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",s["src"],
                            "-vf",vf,"-vsync","0","-frames:v",str(len(targets)),
                            "-q:v","2","-pix_fmt","yuvj420p",str(outdir/"o%02d.jpg")],
                           capture_output=True, timeout=5400)
        made = sorted(outdir.glob("o*.jpg"))
        if len(made) != len(targets):
            print("     rendered %d of %d  %s" % (len(made), len(targets), r.stderr.decode()[:150]))
    for (label, ts, fr, oldname), f in zip(targets, made):
        ok, why = shots.verify(f, s)
        if not ok:
            print("     %-30s REJECT %s" % (label, why)); total_bad += 1; f.unlink(); continue
        with Image.open(f) as im: w,h = im.size
        cb = comb_ratio(f)
        print("     %-30s t%s  frame %-7d %dx%d  comb %.2f" % (label, ts, fr, w, h, cb))
        if APPLY:
            for old in glob.glob(str(WORK/key/("*_t%s.jpg" % ts))):
                os.unlink(old)
            shutil.copy2(f, WORK/key/oldname)
        total_ok += 1
    if len(made) < len(targets): total_bad += len(targets)-len(made)

print("\n  rendered %d   failed %d%s" % (total_ok, total_bad,
      "" if APPLY else "   (dry run - pass --apply to write into work/)"))
sys.exit(1 if total_bad else 0)

#!/usr/bin/env python3
"""Grab identifying frames from EVERY titleset in a folder. READ-ONLY.

Purpose: decide whether one folder holds one show or several. Structure and
runtime only ever suggest an answer - the frames decide it. Compare staging,
lighting, clothing and any on-screen captions across titlesets, and check
whether the END of one titleset continues into the START of the next.
"""
import re, subprocess, sys, collections, json
from pathlib import Path
sys.path.insert(0, str(Path.home()/"VaultShots")); import shots
DRIVE = Path("/Volumes/Live Music")
OUT = Path.home()/"VaultShots"/"ident"

def probe(p):
    r = subprocess.run(["ffprobe","-v","error","-select_streams","v:0","-show_entries",
        "stream=width,height,sample_aspect_ratio,display_aspect_ratio,field_order,avg_frame_rate",
        "-of","json", str(p)], capture_output=True)
    try: return json.loads(r.stdout.decode())["streams"][0]
    except Exception: return {}

folder = sys.argv[1]; secs = json.loads(sys.argv[2])   # {"01": 548, ...}
d = DRIVE/folder/"VIDEO_TS"
sets = collections.defaultdict(list)
for f in sorted(d.glob("VTS_*_[1-9].VOB")):
    m = re.match(r"VTS_(\d+)_(\d+)\.VOB$", f.name)
    if m: sets[m.group(1)].append(f)

outdir = OUT/re.sub(r"[^A-Za-z0-9]+","_",folder)[:48]
outdir.mkdir(parents=True, exist_ok=True)
shots.assert_readonly_target(outdir)
print("  %s -> %s" % (folder, outdir))
for ts, files in sorted(sets.items()):
    dur = secs.get(ts, 0)
    if not dur: print("    VTS_%s no duration, skipped" % ts); continue
    st = probe(files[0])
    t = shots.compute_target(st)
    src = "concat:" + "|".join(str(f) for f in files)
    # These are MPEG-PS DVDs read through concat: - -ss seeks against timestamps
    # that are wrong, and every seek returns nothing (SKILL.md 5.2). Select by
    # frame number in a single decode instead, with the windowed chain so bwdif
    # still gets neighbouring frames (4.7).
    fps = 25.0
    try:
        a_, b_ = str(t.get("fps") or "25/1").split("/")
        if float(b_): fps = float(a_)/float(b_)
    except Exception: pass
    W, MID = shots.DEINT_WINDOW, shots.DEINT_MID
    marks = [("a_start",0.04), ("b_mid",0.50), ("c_end",0.96)]
    want = [(tag, dur*frac, int(round(dur*frac*fps))) for tag, frac in marks]
    keep = sorted({n for _,_,f in want for n in range(f-MID, f-MID+W)})
    runs, pos = [], {n:i for i,n in enumerate(keep)}
    for n in keep:
        if runs and n == runs[-1][-1]+1: runs[-1].append(n)
        else: runs.append([n])
    pre  = "select='" + "+".join("between(n\,%d\,%d)"%(g[0],g[-1]) for g in runs) + "'"
    post = "select='" + "+".join("eq(n\,%d)"%pos[f] for _,_,f in want) + "'"
    head, di, tail = shots.vf_parts(t, shots.DEFAULT_DEINT)
    vf = ",".join(x for x in (pre, head, di, post, tail) if x)
    tmp = outdir/("_tmp_%s" % ts)
    if tmp.exists():
        for f in tmp.glob("*.jpg"): f.unlink()
    tmp.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",src,
                        "-vf",vf,"-vsync","0","-frames:v",str(len(want)),
                        "-q:v","2","-pix_fmt","yuvj420p",str(tmp/"m%02d.jpg")],
                       capture_output=True, timeout=5400)
    made = sorted(tmp.glob("m*.jpg"))
    for (tag, at, fr), f in zip(want, made):
        out = outdir/("VTS%s_%s_t%02d-%02d.jpg" % (ts, tag, int(at)//60, int(at)%60))
        f.replace(out)
        ok, why = shots.verify(out, t)
        print("    VTS_%s %-8s t=%5.0fs frame %-7d %s  %s"
              % (ts, tag, at, fr, "%dx%d"%(t["target_w"],t["target_h"]),
                 "ok" if ok else "REJECT "+why))
    if len(made) < len(want):
        print("    VTS_%s produced %d of %d  %s" % (ts, len(made), len(want),
              r.stderr.decode()[:140]))
    for f in tmp.glob("*.jpg"): f.unlink()
    tmp.rmdir()

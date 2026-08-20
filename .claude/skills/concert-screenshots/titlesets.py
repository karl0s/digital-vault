#!/usr/bin/env python3
"""Probe every DVD titleset in a folder separately. READ-ONLY.

A VIDEO_TS folder with several VTS_NN sets is the strongest structural hint
that one folder holds more than one programme. The scan pipeline collapses the
whole folder into a single record, so this is invisible in shows.json.
"""
import re, subprocess, sys, collections
from pathlib import Path
DRIVE = Path("/Volumes/Live Music")

def run(c, t=3600):
    return subprocess.run(c, capture_output=True, timeout=t)

def probe(p):
    r = run(["ffprobe","-v","error","-select_streams","v:0","-show_entries",
             "stream=width,height,sample_aspect_ratio,display_aspect_ratio,field_order,avg_frame_rate",
             "-of","default=nw=1", str(p)])
    if r.returncode != 0: return {}
    return dict(l.split("=",1) for l in r.stdout.decode().strip().splitlines() if "=" in l)

def demux_secs(paths):
    """Container duration lies on MPEG-PS. Demux for the truth (~90x realtime)."""
    src = "concat:" + "|".join(str(p) for p in paths)
    r = run(["ffmpeg","-hide_banner","-i",src,"-c","copy","-f","null","-"])
    ts = re.findall(r"time=(\d+):(\d\d):(\d\d)\.(\d\d)", r.stderr.decode("utf-8","replace"))
    if not ts: return 0.0
    h,m,s,c = ts[-1]
    return int(h)*3600+int(m)*60+int(s)+int(c)/100

for folder in sys.argv[1:]:
    d = DRIVE/folder/"VIDEO_TS"
    if not d.is_dir(): print("  no VIDEO_TS in %s" % folder); continue
    sets = collections.defaultdict(list)
    for f in sorted(d.glob("VTS_*_[1-9].VOB")):
        m = re.match(r"VTS_(\d+)_(\d+)\.VOB$", f.name)
        if m: sets[m.group(1)].append(f)
    print("\n  %s  —  %d titleset(s)" % (folder, len(sets)))
    tot = 0.0
    for ts, files in sorted(sets.items()):
        size = sum(f.stat().st_size for f in files)
        st = probe(files[0])
        secs = demux_secs(files)
        tot += secs
        mbps = size*8/secs/1e6 if secs else 0
        print("    VTS_%s  %2d file(s)  %7.1f MB  %s  SAR %-7s %-11s  %8s  %5.2f Mbps"
              % (ts, len(files), size/1048576,
                 "%sx%s" % (st.get("width","?"), st.get("height","?")),
                 st.get("sample_aspect_ratio","?"), st.get("field_order","?"),
                 "%d:%02d:%02d" % (secs//3600, secs%3600//60, secs%60), mbps))
    print("    total runtime: %d:%02d:%02d" % (tot//3600, tot%3600//60, tot%60))

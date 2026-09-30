#!/usr/bin/env python3
"""Read chapter (program) start times from a DVD titleset's VTS_xx_0.IFO. READ-ONLY.

Usage: dvd_chapters.py <folder> [--json]
For each titleset: the longest PGC's programs (= chapters on nearly every disc),
with start time and duration, summed from the cell playback times.
"""
import sys, struct, json
from pathlib import Path

def bcd(b): return (b >> 4) * 10 + (b & 0x0F)
def ptime(buf):
    h, m, s, f = buf[0], buf[1], buf[2], buf[3]
    rate = {1: 25.0, 3: 30000/1001}.get(f >> 6, 25.0)
    return bcd(h)*3600 + bcd(m)*60 + bcd(s) + bcd(f & 0x3F)/rate

def titleset(ifo):
    b = ifo.read_bytes()
    if b[:12] != b"DVDVIDEO-VTS": return None
    pgcit = struct.unpack(">I", b[0xCC:0xD0])[0] * 2048
    n = struct.unpack(">H", b[pgcit:pgcit+2])[0]
    best = None
    for i in range(n):
        off = pgcit + struct.unpack(">I", b[pgcit+8+i*8+4:pgcit+8+i*8+8])[0]
        nprog, ncell = b[off+2], b[off+3]
        total = ptime(b[off+4:off+8])
        if not ncell: continue
        pmap = off + struct.unpack(">H", b[off+0xE6:off+0xE8])[0]
        cpb = off + struct.unpack(">H", b[off+0xE8:off+0xEA])[0]
        cells = [ptime(b[cpb+c*24+4:cpb+c*24+8]) for c in range(ncell)]
        entry = [b[pmap+p] for p in range(nprog)]
        chaps = []
        for p, e in enumerate(entry):
            end = entry[p+1] if p+1 < nprog else ncell+1
            start = sum(cells[:e-1]); dur = sum(cells[e-1:end-1])
            chaps.append((round(start, 1), round(dur, 1)))
        if best is None or total > best[0]: best = (total, chaps)
    return best

def fmt(t): t=int(t); return "%d:%02d:%02d" % (t//3600, t//60%60, t%60)

if __name__ == "__main__":
    f = Path(sys.argv[1]); d = f/"VIDEO_TS" if (f/"VIDEO_TS").is_dir() else f
    out = {}
    for ifo in sorted(d.glob("VTS_*_0.IFO")):
        r = titleset(ifo)
        if not r: continue
        out[ifo.name[4:6]] = {"total": round(r[0], 1), "chapters": r[1]}
    if "--json" in sys.argv: print(json.dumps(out)); sys.exit()
    for v, r in out.items():
        print("VTS_%s  %s  %d chapters" % (v, fmt(r["total"]), len(r["chapters"])))
        print("   " + "  ".join("%s(%s)" % (fmt(s), fmt(du)[2:]) for s, du in r["chapters"]))

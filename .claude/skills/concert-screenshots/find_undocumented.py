#!/usr/bin/env python3
"""Units on the drive that no shows.json record describes. READ-ONLY.

Name matching alone is useless here: the collection has been reorganised, so a
folder's current name often shares little with the record written from its old
one. Content SIZE is the discriminator - a record whose TotalSizeBytes matches a
folder's media bytes to within 2% is describing that folder, whatever it is called.
"""
import json, os, re, sqlite3, unicodedata, sys
from pathlib import Path
DRIVE = Path("/Volumes/Live Music")
REPO  = Path("/Users/ko/Desktop/Projects/the-vault")
VIDEO = {".vob",".mkv",".mp4",".m4v",".avi",".ts",".m2ts",".mts",".mpg",".mpeg",".mov",".wmv",".flv"}
STOP  = set("the a of and live pro shot dvd dvdr tv hd hdtv ts ntsc pal ws master source "
            "disc version official vts new 2xdvd".split())

def toks(x):
    x = unicodedata.normalize("NFKD", x or "").encode("ascii","ignore").decode().casefold().replace("'","")
    return set(t for t in re.sub(r"[^a-z0-9]+"," ",x).split() if len(t)>1) - STOP

def has_media(p):
    try:
        for q in os.scandir(p):
            if q.is_file() and Path(q.name).suffix.lower() in VIDEO: return True
            if q.is_dir() and q.name.upper() in ("VIDEO_TS","BDMV"): return True
    except OSError: pass
    return False

def media_bytes(p):
    if p.is_file(): return p.stat().st_size
    tot = 0
    for root, dirs, files in os.walk(p):
        for f in files:
            if Path(f).suffix.lower() in VIDEO:
                try: tot += os.stat(os.path.join(root, f)).st_size
                except OSError: pass
    return tot

shows = json.loads((REPO/"public/shows.json").read_text())
recs, exact = [], {}
for s in shows:
    try: b = int(s.get("TotalSizeBytes") or 0)
    except ValueError: b = 0
    fp = Path(s.get("FolderPath") or "")
    # Tokens from the record's folder AND its PARENT. A record named only "Disc 1"
    # carries no identity of its own; its parent is what names the show, and a
    # basename-only comparison scores it 0 against every folder on the drive.
    rt = toks(s.get("FolderName") or "") | toks(fp.name) | toks(fp.parent.name)
    recs.append((b, rt, s))
    for k in ((s.get("FolderName") or "").strip(), fp.name, "%s/%s" % (fp.parent.name, fp.name)):
        if k: exact.setdefault(k.casefold(), s)

units = set()
try:
    con = sqlite3.connect("file:/Users/ko/MediaDeduper/data/dedupe.sqlite?mode=ro", uri=True)
    units |= {r[0] for r in con.execute("SELECT rel_path FROM units") if (DRIVE/r[0]).exists()}
except Exception as e:
    print("  (index unavailable: %s)" % e)
for p in sorted(DRIVE.iterdir()):
    if p.name.startswith("."): continue
    if p.is_file() and p.suffix.lower() in VIDEO: units.add(p.name); continue
    if not p.is_dir(): continue
    if has_media(p): units.add(p.name)
    else:
        for q in sorted(p.iterdir()):
            if q.is_dir() and not q.name.startswith(".") and has_media(q): units.add("%s/%s" % (p.name, q.name))
units = sorted(u for u in units if "karls pc before it dies" not in u.casefold())

undoc = []
for u in units:
    p = DRIVE/u
    b = media_bytes(p)
    if b < 20*1024*1024: continue                    # not a show
    up = Path(u)
    ut = toks(up.name) | toks(up.parent.name if up.parent != Path(".") else "")
    if up.name.casefold() in exact or u.casefold() in exact: continue
    size_hit = None
    for rb, rt, s in recs:
        if rb and abs(rb - b)/max(rb, b) <= 0.02 and (ut & rt): size_hit = s; break
    if size_hit: continue
    best, sc = None, 0
    for rb, rt, s in recs:
        n = len(ut & rt)
        if n > sc: best, sc = s, n
    if sc >= max(3, len(ut)-1): continue              # near-identical name
    undoc.append((u, b, sc, best))

print("capture units on the drive : %d   (PC backup tree excluded)" % len(units))
print("no record by size or name  : %d\n" % len(undoc))
for u, b, sc, best in undoc:
    bn = ((best or {}).get("FolderName") or "-")
    print("  %-66s %7.2f GB   closest name (%d tok): %s" % (u[:66], b/1073741824, sc, bn[:30]))

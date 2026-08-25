#!/usr/bin/env python3
"""One cheap pass that surfaces, BEFORE capture, everything this pipeline keeps
rediscovering one problem at a time. READ-ONLY on the drive and the repo.

    python3 preflight.py --artist "Kings Of Leon"

Every check here exists because a whole session was spent finding these by
conversation instead of by script. Running it first turns a dozen round trips
into one page of output.
"""
import argparse, json, re, subprocess, collections, unicodedata
from pathlib import Path

HOME = Path.home()/"VaultShots"
REPO = Path("/Users/ko/Desktop/Projects/the-vault")
DRIVE = Path("/Volumes/Live Music")
SHOWS = REPO/"public"/"shows.json"

def toks(x):
    x = unicodedata.normalize("NFKD", x or "").encode("ascii","ignore").decode().casefold()
    x = x.replace("'", "")
    STOP = set("the a of and live pro shot dvd dvdr tv hd hdtv ts ntsc pal ws master source "
               "disc version official vts".split())
    return set(w for w in re.sub(r"[^a-z0-9]+"," ",x).split() if len(w)>1 and w not in STOP)

def hms(s): return "%d:%02d" % (s//60, s%60)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--artist", required=True)
    a = ap.parse_args()
    shows = json.loads(SHOWS.read_text(encoding="utf-8"))
    mine = [s for s in shows if (s.get("Artist") or "") == a.artist]
    atk = toks(a.artist)
    squashed = re.sub(r"[^a-z0-9]+","", a.artist.casefold())
    initials = "".join(w[0] for w in a.artist.split() if w[:1].isalpha()).lower()
    print("PRE-FLIGHT  %s   %d records\n" % (a.artist, len(mine)))

    print("1. RECORDS WITH NO CHECKSUM  (cannot carry images at all)")
    n=0
    for s in mine:
        if not (s.get("ChecksumSHA1") or "").strip():
            print("     %s  %s" % (s["ShowID"], (s.get("FolderName") or "")[:60])); n+=1
    print("     none\n" if not n else "")

    print("2. DUPLICATE GROUPS THAT DISAGREE  (same show, different metadata -> sorts apart)")
    g = collections.defaultdict(list)
    for s in mine:
        k = ((s.get("EventOrFestival") or "").casefold(), (s.get("ShowDate") or "")[:4])
        if k[0]: g[k].append(s)
    n=0
    for (ev,yr),rows in sorted(g.items()):
        if len(rows) < 2: continue
        F = ("ShowDate","EventOrFestival","VenueName","City","Country")
        bad = [f for f in F if len({r.get(f) for r in rows}) > 1]
        if bad:
            n+=1
            print("     %-28s %s  %d records disagree on %s" % (ev[:28], yr, len(rows), ", ".join(bad)))
            for r in rows: print("        %s  %-11s %s" % (r["ShowID"], r.get("ShowDate"), (r.get("FolderName") or "")[:48]))
    print("     none\n" if not n else "")

    print("3. LOOSE FILES AT THE DRIVE ROOT  (never reached by folder discovery)")
    n=0
    if DRIVE.exists():
        byck = {(s.get("ChecksumSHA1") or "").strip() for s in shows}
        for f in sorted(DRIVE.glob("*")):
            if not f.is_file() or f.suffix.lower() not in (".ts",".mkv",".mp4",".avi",".m2ts"): continue
            ft = toks(f.stem)
            if atk & ft or squashed in f.stem.casefold() or (initials and initials in f.stem.casefold()):
                print("     %-52s %8.1f MB" % (f.name[:52], f.stat().st_size/1048576)); n+=1
    print("     none\n" if not n else "")

    print("4. FOLDERS WITH MORE THAN ONE TITLESET  (a record usually covers only one)")
    n=0
    if DRIVE.exists():
        for d in sorted(DRIVE.iterdir()):
            if not d.is_dir(): continue
            dt = toks(d.name)
            if not (atk & dt or squashed in d.name.casefold() or (initials and initials in d.name.casefold())):
                continue
            sub = d/"VIDEO_TS" if any((d/"VIDEO_TS").glob("VTS_*_[1-9].VOB")) else d
            sets = collections.defaultdict(list)
            for f in sub.glob("VTS_*_[1-9].VOB"):
                m = re.match(r"VTS_(\d+)_(\d+)\.VOB$", f.name)
                if m: sets[m.group(1)].append(f)
            if len(sets) > 1:
                sizes = {k: sum(x.stat().st_size for x in v)/1048576 for k,v in sets.items()}
                print("     %-46s %d titlesets: %s" % (d.name[:46], len(sets),
                      "  ".join("%s=%.0fMB"%(k,sizes[k]) for k in sorted(sizes))))
                n+=1
    print("     none\n" if not n else "")

    print("5. DURATION vs SIZE  (a scan that timed one VOB part reports a fraction of the show)")
    n=0
    for s in mine:
        try: dur = int(s.get("DurationSec") or 0)
        except ValueError: dur = 0
        size = (s.get("TotalSizeHuman") or "")
        mb = None
        m = re.match(r"([\d.]+)\s*(GB|MB)", size)
        if m: mb = float(m.group(1)) * (1024 if m.group(2)=="GB" else 1)
        if not dur or not mb: continue
        mbps = (mb*8)/dur if dur else 0          # implied bitrate, Mb/s
        if mbps > 40 or mbps < 0.3:
            print("     %s  %-42s %6ds  %8s  implies %.1f Mb/s" %
                  (s["ShowID"], (s.get("FolderName") or "")[:42], dur, size, mbps)); n+=1
    print("     none\n" if not n else "")
    print("Nothing here is a conclusion - each line is a folder or record to LOOK at.")

if __name__ == "__main__":
    main()

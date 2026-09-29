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

try:
    import sys as _sys; _sys.path.insert(0, str(Path.home()/"VaultShots"))
    from shots import STOPWORDS as _PLAN_STOP
except Exception:                            # never let the import widen the match
    _PLAN_STOP = {"in","on","at","for","to","with","from","an"}

def toks(x):
    x = unicodedata.normalize("NFKD", x or "").encode("ascii","ignore").decode().casefold()
    x = x.replace("'", "")
    # Union with shots.STOPWORDS, the list the planner already uses. This list lacked
    # the prepositions, so "Alice In Chains" kept the token "in" and checks 3 and 4
    # listed every folder containing "in" - Rock in Rio, T in the Park, Live In Milan.
    # The R.E.M./Silverchair widening class again (SKILL.md 0b); one list, not two.
    STOP = set("the a of and live pro shot dvd dvdr tv hd hdtv ts ntsc pal ws master source "
               "disc version official vts".split()) | _PLAN_STOP
    return set(w for w in re.sub(r"[^a-z0-9]+"," ",x).split() if len(w)>1 and w not in STOP)

def hms(s): return "%d:%02d" % (s//60, s%60)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--artist", required=True)
    a = ap.parse_args()
    shows = json.loads(SHOWS.read_text(encoding="utf-8"))
    # Artist match is CASE-INSENSITIVE. An exact == silently returned 0 records for
    # "silverchair" while shows.json holds "Silverchair", so checks 1, 2 and 5 all
    # reported "none" for an artist that has seven records. A matcher that finds
    # nothing must never look like a clean pass (SKILL.md 2, 15).
    mine = [s for s in shows if (s.get("Artist") or "").casefold() == a.artist.casefold()]
    atk = toks(a.artist)
    squashed = re.sub(r"[^a-z0-9]+","", a.artist.casefold())
    # A ONE-LETTER initials string matches every filename on the drive. "Silverchair"
    # gave initials "s", so check 3 listed all 44 loose root files as candidates. Same
    # class as the R.E.M. empty-token-set bug: a matcher that widens is worse than one
    # that fails (SKILL.md 2). Single-word artists get no initials alias.
    initials = "".join(w[0] for w in a.artist.split() if w[:1].isalpha()).lower()
    if len(initials) < 2: initials = ""
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
            # Look at the folder, its VIDEO_TS, AND one level of subdirectories. A folder
            # can hold whole nested DISCS ("Disc 1/", "Disc 2/") whose VOBs sit at their
            # own root with no VIDEO_TS at all - Silverchair's Intimate & Interactive is
            # eight titlesets across two nested discs and this check reported "none",
            # the hardcoded-VIDEO_TS no-op from SKILL.md 11 and the nested-disc case
            # from SKILL.md 10b, in one folder.
            discs = []
            for base in [d] + sorted(q for q in d.iterdir() if q.is_dir() and q.name != "VIDEO_TS"):
                for cand in (base/"VIDEO_TS", base):
                    if cand.is_dir() and any(cand.glob("VTS_*_[1-9].VOB")):
                        discs.append(cand); break
            for sub in discs:
                sets = collections.defaultdict(list)
                for f in sub.glob("VTS_*_[1-9].VOB"):
                    m = re.match(r"VTS_(\d+)_(\d+)\.VOB$", f.name)
                    if m: sets[m.group(1)].append(f)
                if len(sets) > 1:
                    sizes = {k: sum(x.stat().st_size for x in v)/1048576 for k,v in sets.items()}
                    rel = str(sub.relative_to(DRIVE)).replace("/VIDEO_TS","")
                    print("     %-46s %d titlesets: %s" % (rel[:46], len(sets),
                          "  ".join("%s=%.0fMB"%(k,sizes[k]) for k in sorted(sizes))))
                    n+=1
            if len(discs) > 1:
                print("     %-46s %d SEPARATE DISC TREES in one folder" % (d.name[:46], len(discs)))
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

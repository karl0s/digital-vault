#!/usr/bin/env python3
"""Scan the collection for folders that likely hold MORE THAN ONE show. READ-ONLY.

The scan pipeline records one row per folder. When a folder holds two concerts,
the row silently describes only whichever files the "representative media"
heuristic happened to pick - usually the largest - and the other show does not
exist as far as the site is concerned.

Structure and metadata alone can only ever produce a SUSPECT list. Nothing here
decides anything; every hit must be verified against frames and an outside
source before any record is created (see SKILL.md section 10b).

Signals, cheapest first - no file contents are read:
  * more than one substantial DVD titleset (VTS_01, VTS_02, ...)
  * an NFO / text / cue / md5 sidecar that may name the contents
  * a date in the folder name that disagrees with the record's ShowDate
  * a record whose representative media covers only part of the folder
"""
import argparse, collections, json, os, re, sys
from pathlib import Path

DRIVE = Path("/Volumes/Live Music")
REPO  = Path.home()/"Desktop/Projects/the-vault"
MIN_TITLESET = 100*1024*1024        # ignore menu/filler titlesets
DATE_RX = re.compile(r"(19|20)\d{2}[-_. ]?(0[1-9]|1[0-2])[-_. ]?(0[1-9]|[12]\d|3[01])")
YEAR_RX = re.compile(r"(19|20)\d{2}")
NFO_EXT = (".nfo", ".txt", ".cue", ".md5", ".sfv", ".log")


def titlesets(video_ts):
    sets = collections.defaultdict(int)
    try:
        for f in os.scandir(video_ts):
            m = re.match(r"VTS_(\d+)_([1-9])\.VOB$", f.name, re.I)
            if m:
                try: sets[m.group(1)] += f.stat().st_size
                except OSError: pass
    except OSError:
        return {}
    return {k: v for k, v in sets.items() if v >= MIN_TITLESET}


def norm_date(s):
    m = DATE_RX.search(s or "")
    if not m: return None
    d = re.sub(r"[-_. ]", "", m.group(0))
    return "%s-%s-%s" % (d[:4], d[4:6], d[6:8])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--artist", help="limit to folders whose name matches")
    ap.add_argument("--min-score", type=int, default=1)
    a = ap.parse_args()

    shows = json.loads((REPO/"public/shows.json").read_text())
    by_folder = {}
    for s in shows:
        fn = (s.get("FolderName") or "").strip()
        if fn: by_folder.setdefault(fn, []).append(s)

    hits = []
    for entry in sorted(os.scandir(DRIVE), key=lambda e: e.name):
        if not entry.is_dir(follow_symlinks=False) or entry.name.startswith("."):
            continue
        if a.artist and a.artist.lower() not in entry.name.lower():
            continue
        folder = Path(entry.path)
        sig, score = [], 0

        vts = folder/"VIDEO_TS"
        sets = titlesets(vts) if vts.is_dir() else {}
        if len(sets) > 1:
            score += 3
            sig.append("%d titlesets (%s)" % (len(sets),
                       ", ".join("%s:%.0fMB" % (k, v/1048576) for k, v in sorted(sets.items()))))

        sidecars = []
        for root, dirs, files in os.walk(folder):
            dirs[:] = [d for d in dirs if d.upper() not in ("VIDEO_TS", "AUDIO_TS")]
            for f in files:
                if f.startswith(".") or f.startswith("._"): continue
                if f.lower().endswith(NFO_EXT):
                    sidecars.append(os.path.relpath(os.path.join(root, f), folder))
        if sidecars:
            score += 1
            sig.append("sidecar: %s" % ", ".join(sidecars[:3]))

        # match a record by folder-name suffix ("Artist - <FolderName>")
        rec = None
        for fn, rs in by_folder.items():
            if entry.name.endswith(fn) or entry.name == fn:
                rec = rs[0]; break
        if rec:
            fdate = norm_date(entry.name)
            sdate = (rec.get("ShowDate") or "").strip()
            if fdate and sdate and fdate != sdate:
                score += 2
                sig.append("folder date %s != ShowDate %s" % (fdate, sdate))
            nrep = rec.get("RepVideoCount") or 0
            if sets and nrep:
                reps = (rec.get("RepVideoFiles") or "")
                covered = {m.group(1) for m in re.finditer(r"VTS_(\d+)_\d\.VOB", reps, re.I)}
                missing = set(sets) - covered
                if missing:
                    score += 3
                    sig.append("record covers only VTS_%s; %d titleset(s) uncatalogued: %s"
                               % (",".join(sorted(covered)) or "?", len(missing),
                                  ",".join(sorted(missing))))
        else:
            sig.append("NO shows.json record matched")

        years = sorted(set(YEAR_RX.findall(entry.name)))
        if len({y for y in re.findall(r"(?:19|20)\d{2}", entry.name)}) > 1:
            score += 2
            sig.append("folder name contains >1 year")

        if score >= a.min_score and sig:
            hits.append((score, entry.name, rec, sig))

    hits.sort(key=lambda h: (-h[0], h[1]))
    print("\n  MULTI-SHOW FOLDER SUSPECTS  (%d flagged)\n" % len(hits))
    print("  Nothing here is a conclusion. Verify each against frames + an outside")
    print("  source before creating any record. See SKILL.md section 10b.\n")
    for score, name, rec, sig in hits:
        print("  [%d] %s" % (score, name))
        if rec: print("      record: %s  %s" % (rec.get("ShowDate") or "(undated)", rec["ShowID"]))
        for s in sig: print("      - %s" % s)
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main())

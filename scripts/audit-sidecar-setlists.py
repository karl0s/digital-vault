#!/usr/bin/env python3
"""Compare the setlist in each folder's own sidecar against the show record.

A sidecar inside a show's folder is authoritative for that show (CLAUDE.md): it
was written from the disc by whoever made it. This finds folders whose sidecar
names songs the record does not have.

Two things make a naive comparison useless, and both were learned the hard way:

  1. Sidecars carry timestamps, track numbers and segment prefixes -
     "00:00 16) Lighten up", "Intro ~ All I Really Want", "Dude (Looks Like A
     Lady)\\". Compared raw, almost every line reads as missing.
  2. One folder can hold several shows. After a split the songs live across
     sibling records, so the comparison must pool every record derived from that
     folder, not just one.

Usage:
    python3 scripts/audit-sidecar-setlists.py                 # whole drive
    python3 scripts/audit-sidecar-setlists.py --artist Bush
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

ROOT  = Path(__file__).resolve().parent.parent
DRIVE = Path("/Volumes/Live Music")
SIDE  = (".txt", ".nfo", ".md", ".info")
MAXB  = 300_000

RED, GRN, DIM, RESET = "\033[31m", "\033[32m", "\033[2m", "\033[0m"


def clean(s: str) -> str:
    # Bullets, including the mojibake ones left by a mis-decoded sidecar.
    s = re.sub(r"^\s*[\-\*\u2022\u00b7\u25cf\u25aa\uFFFD>]+\s*", "", s)
    s = re.sub(r"^\s*\d{1,2}:\d{2}(?::\d{2})?\s*", "", s)
    s = re.sub(r"^\s*\d{1,2}\s*[\.\)\-:]\s*", "", s)
    s = re.sub(r"^\s*(intro|outro|band introduction|encore)\s*[~\-:]\s*", "", s, flags=re.I)
    s = re.sub(r"\s*\+\s*credits?\s*$", "", s, flags=re.I)
    # Trailing running time: "Spoonman (6:13)". Left in place it makes every song
    # on a timed sidecar read as missing - 13 of 13 on Cornell's Pinkpop.
    s = re.sub(r"\s*[\(\[]\s*\d{1,2}:\d{2}\s*[\)\]]\s*$", "", s)
    # Any trailing parenthetical annotation - "(incomplete)", "(Pink Floyd cover)",
    # "(Acoustic)". Both sides are cleaned the same way, so dropping it compares the
    # song rather than the note. Losing this rule made "Everlong (incomplete)" stop
    # matching a sidecar's plain "Everlong".
    s = re.sub(r"\s*[\(\[][^()\[\]]*[\)\]]\s*$", "", s)
    return s.strip().strip("\\/|").strip('"\'')


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", clean(s).lower())


NOT_A_SONG = re.compile(
    r"^(announcement|interview|intro|outro|credits|end|introduction|menu|chapter"
    r"|bonus|extras?|encore break)\b", re.I)

# Non-musical segments appear inside numbered track lists too, and not always at
# the start of the line - Loreley's disc numbers "Beastie Boys in interview with
# Alan Bangs" as a track. It belongs in Notes, never in Setlist.
SEGMENT = re.compile(r"\b(interview with|in interview|introduced by|talking|talks|speech"
                     r"|documentary|behind the scenes|soundcheck)\b", re.I)

# Sidecars usually embed a MediaInfo/GSpot dump, and its lines are numbered too.
# Without this the audit reports "000000 seconds of audio timestamp gaps." as a
# missing song, which trains the reader to ignore real findings.
TECHNICAL = re.compile(
    r"(\bfps\b|\bmbps\b|\bkbps\b|\bkb/s\b|\bhz\b|bitrate|timestamp|resolution"
    r"|codec|aspect|interlac|progressive|pal\b|ntsc\b|mpeg|ac3|\bvbr\b|\bcbr\b"
    r"|seconds of|channels?\b|sample rate|\bgb\b|\bmb\b|frame rate)", re.I)


def _within_one_edit(a: str, b: str) -> bool:
    """True when a and b differ by at most one insertion, deletion or substitution."""
    if a == b:
        return True
    la, lb = len(a), len(b)
    if abs(la - lb) > 1:
        return False
    i = j = 0
    seen = False
    while i < la and j < lb:
        if a[i] == b[j]:
            i += 1; j += 1; continue
        if seen:
            return False
        seen = True
        if la == lb:
            i += 1; j += 1
        elif la > lb:
            i += 1
        else:
            j += 1
    return True


def present(song: str, have: set, raw: list) -> bool:
    """Is this sidecar song already in the record?

    Exact normalised match first. Long compound entries - medleys above all - are
    then checked by word overlap, because the same medley is written differently
    everywhere: a sidecar's "Medley: Bela lugosi is dead - 4th of July - Whole
    lotta love" and a record's correctly-spelled "Bela Lugosi's Dead / 4th of
    July / Whole Lotta Love" are the same performance. Without this the entry is
    reported as missing forever, and a permanent false positive is how real
    findings get ignored.
    """
    n = norm(song)
    if n in have:
        return True
    words = set(re.findall(r"[a-z0-9]+", clean(song).lower()))
    if len(words) < 5:
        # Single-title near-miss: sidecars are hand-typed and contain typos
        # ("Wattershed" for "Watershed", "Right Thrpough You"). Allow one edit on
        # titles long enough that a coincidence is implausible.
        if len(n) >= 8:
            for h in have:
                if abs(len(h) - len(n)) <= 1 and _within_one_edit(n, h):
                    return True
        return False
    for r in raw:
        hw = set(re.findall(r"[a-z]+|[0-9]+", r.lower()))
        if not hw:
            continue
        shared = len(words & hw)
        if shared / max(1, len(words)) >= 0.7:
            return True
    return False


SET_HEADER = re.compile(r"^\s*(set\s*list|tracklist|track\s*list|songs)\s*:?\s*$", re.I)


def _unnumbered_block(lines):
    """Songs listed as bare lines under a "Setlist" header, or as the only run of
    short plain lines in the file.

    Cologne 1997 lists its nine songs with no numbers at all. A numbered-line
    detector sees nothing there, which is how a whole setlist stays invisible -
    the failure this audit exists to prevent.
    """
    out, i = [], 0
    while i < len(lines):
        if SET_HEADER.match(lines[i]):
            j = i + 1
            block = []
            while j < len(lines) and lines[j].strip():
                block.append(lines[j].strip())
                j += 1
            if len(block) >= 3:
                out.extend(block)
            i = j
        i += 1
    return out


def songs_in(text: str):
    lines = [l.strip() for l in text.splitlines()]
    numbered = [l for l in lines if re.match(r"^\d{1,2}\s*[\.\)\-:]\s*\S", l)
                or re.match(r"^\d{1,2}:\d{2}", l)]
    if len(numbered) < 3:
        numbered = _unnumbered_block(lines)
    out = []
    for l in numbered:
        c = clean(l)
        if (len(norm(c)) > 2 and not NOT_A_SONG.match(c) and not SEGMENT.search(c)
                and not TECHNICAL.search(c) and not re.fullmatch(r"[\d\W]+", c)):
            out.append(c)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--artist")
    a = ap.parse_args()
    if not DRIVE.is_dir():
        sys.exit("  drive not mounted at %s" % DRIVE)

    shows = json.loads((ROOT / "public/shows.json").read_text())
    if a.artist:
        shows = [s for s in shows if (s.get("Artist") or "").lower() == a.artist.lower()]
    if not shows:
        sys.exit("  no records for %r" % a.artist)

    # Pool every record whose folder name matches a drive folder, so splits are
    # compared together rather than one child at a time.
    on_drive = [e.name for e in os.scandir(DRIVE) if e.is_dir()]
    pools: dict[str, list] = {}
    for s in shows:
        fn = (s.get("FolderName") or "").strip()
        if not fn:
            continue
        for d in on_drive:
            # Exact or suffix only. A loose "fn in d" substring pooled a Blink-182
            # folder with a 30 Seconds to Mars record and reported Blink's setlist
            # as missing from it - cross-artist contamination, the same failure
            # class as SKILL.md section 2's token matching.
            if d.lower() == fn.lower() or d.lower().endswith(fn.lower()):
                pools.setdefault(d, []).append(s)
                break

    checked = gaps = 0
    rows = []
    for folder, recs in sorted(pools.items()):
        base = DRIVE / folder
        have, raws = set(), []
        for r in recs:
            for x in (r.get("Setlist") or "").split(";"):
                if norm(x):
                    have.add(norm(x)); raws.append(x.strip())
        try:
            files = [p for p in base.rglob("*")
                     if p.is_file() and p.suffix.lower() in SIDE
                     and not p.name.startswith("._") and p.stat().st_size < MAXB]
        except OSError:
            continue
        for p in files:
            try:
                found = songs_in(p.read_text(errors="replace"))
            except Exception:
                continue
            if len(found) < 2:
                continue
            checked += 1
            missing = [s for s in found if not present(s, have, raws)]
            if missing:
                gaps += 1
                rows.append((recs[0].get("Artist", ""), folder,
                             str(p.relative_to(base)), len(found), len(have), missing))

    print("\n  SIDECAR SETLISTS vs RECORDS\n")
    print("    folders with a sidecar setlist: %d   with a gap: %s%d%s"
          % (checked, RED if gaps else GRN, gaps, RESET))
    for artist, folder, side, nfound, nhave, missing in rows:
        print("\n    %s%-20s%s %s" % (RED, artist[:20], RESET, folder[:60]))
        print("      %s  sidecar %d songs, records hold %d" % (side[:44], nfound, nhave))
        for m in missing[:15]:
            print("        + %s" % m)
        if len(missing) > 15:
            print("        ... %d more" % (len(missing) - 15))
    if not gaps:
        print("    %severy sidecar song is already in its record%s" % (DIM, RESET))
    return 0


if __name__ == "__main__":
    sys.exit(main())

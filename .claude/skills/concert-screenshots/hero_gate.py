#!/usr/bin/env python3
"""Refuse to promote until every slot A is a confirmed close-up of the LEAD SINGER.

House rule, set by the collection owner:
  * slot A is ALWAYS the lead singer - never another member, however good the frame
  * where the singer is barely filmed, use the TIGHTEST AVAILABLE shot of the singer
  * where no usable close-up of the singer exists at all, FLAG IT for the owner to
    decide; do not silently substitute a wide or another person

This existed as prose in SKILL.md and CLAUDE.md for several artists and was broken
anyway, repeatedly and expensively. Prose does not hold; a gate does.

A show passes when EITHER
  * its A label does not start with "A?"  - i.e. a human or model chose it, and
  * its ShowID is in data/hero_verified.json with the pixel width it was checked at
    (>= 340, because identity errors survive a thumbnail: blonde hair slicked back
    reads as a bald head at 230px and did, twice)
OR
  * its ShowID is in data/no_closeup.json with a reason - the owner's flag path.
"""
import json, sys
from pathlib import Path
DATA = Path.home()/"VaultShots"/"data"
MIN_PX = 340

def check(verbose=True):
    picks = json.loads((DATA/"picks.json").read_text()) if (DATA/"picks.json").exists() else {}
    state = json.loads((DATA/"state.json").read_text()) if (DATA/"state.json").exists() else {"shows":[]}
    sid_of = {s["key"]: s.get("ShowID","") for s in state["shows"]}
    ver = json.loads((DATA/"hero_verified.json").read_text()) if (DATA/"hero_verified.json").exists() else {}
    flag = json.loads((DATA/"no_closeup.json").read_text()) if (DATA/"no_closeup.json").exists() else {}
    bad = []
    for key, sel in picks.items():
        sid = sid_of.get(key, "")
        label = (sel[0][0] if sel else "")
        if sid in flag:
            continue
        if label.startswith("A?"):
            bad.append((key, sid, "hero still the auto-picked suggestion")); continue
        v = ver.get(sid)
        if not v:
            bad.append((key, sid, "hero not recorded as verified")); continue
        if int(v.get("checked_px", 0)) < MIN_PX:
            bad.append((key, sid, "hero verified at only %spx (need >=%d)" % (v.get("checked_px"), MIN_PX)))
    if verbose:
        print("  HERO GATE  %d show(s) with picks, %d flagged as having no close-up"
              % (len(picks), len(flag)))
        for key, sid, why in bad:
            print("    %sREFUSE%s %s %-46s %s" % ("\033[31m","\033[0m", sid, key[:46], why))
        if not bad: print("    every hero confirmed as a close-up of the lead singer")
    return bad

if __name__ == "__main__":
    sys.exit(1 if check() else 0)

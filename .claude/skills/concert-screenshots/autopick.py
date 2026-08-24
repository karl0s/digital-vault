#!/usr/bin/env python3
"""Choose A/B/C/spare per show WITHOUT a model, from scores.json.

Why this exists: hand-picking meant an assistant reading one ~2400x1900 contact
sheet per show. At roughly (w*h)/750 vision tokens that is ~6,000 tokens EACH -
27 shows is ~160,000 tokens before a single decision is made. The scorer already
measures everything the briefs care about, so the first pass can be arithmetic.

Briefs, expressed in the features scores.json already stores:
  A  close-up of one person  -> high `conc` (subject concentrated centrally)
  B  two or more people      -> mid `spread`, still high subject sharpness
  C  wide shot               -> high `spread`, low `conc`, often high `lit_frac`
  spare                      -> best remaining, far from the other three

Frames must be visually distinct (dHash Hamming >= 12), which is the same rule
the shortlist uses, so the four picks never show the same two seconds.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

HOME = Path.home() / "VaultShots"
DATA = HOME / "data"


BRIEF = {"A": "close-up", "B": "two or more", "C": "wide", "spare": "best remaining"}


def ts_of(row):
    """scores.json keeps the frame path; the timestamp is the _tHH-MM-SS suffix."""
    name = Path(row["file"]).name
    return name.split("_t")[-1].rsplit(".", 1)[0]


def ham(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def distinct(cand, chosen, mindist=12):
    return all(ham(cand.get("dhash", 0), c.get("dhash", 0)) >= mindist for c in chosen)


def pick_for_show(rows):
    """rows: the show's `keep` list from scores.json, best-scored first."""
    used, out = [], {}

    def take(tag, ranked):
        for r in ranked:
            if r in used or not distinct(r, used):
                continue
            used.append(r)
            out[tag] = r
            return True
        return False

    # A: the tightest subject. conc is "how concentrated the sharp region is".
    take("A", sorted(rows, key=lambda r: (-r.get("conc", 0), -r.get("score", 0))))
    # B: two-or-more reads as moderate spread with the subject still sharp.
    take("B", sorted(rows, key=lambda r: (-(r.get("subject", 0) * min(r.get("spread", 0), 0.45)),
                                          -r.get("score", 0))))
    # C: wide - sharpness spread across many tiles, no single dominant region.
    take("C", sorted(rows, key=lambda r: (-r.get("spread", 0), r.get("conc", 0))))
    # spare: best remaining by overall score.
    take("spare", sorted(rows, key=lambda r: -r.get("score", 0)))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--artist", required=True)
    ap.add_argument("--out", default=str(DATA / "picks.json"))
    ap.add_argument("--merge", action="store_true",
                    help="keep any show already present in picks.json (hand-picked)")
    a = ap.parse_args()

    scores = json.loads((DATA / "scores.json").read_text())
    state = json.loads((DATA / "state.json").read_text())
    by_key = {s["key"]: s for s in state["shows"]}

    existing = {}
    outp = Path(a.out)
    if a.merge and outp.exists():
        existing = json.loads(outp.read_text())

    picks = dict(existing)
    made = kept = 0
    for key, blob in scores.items():
        sh = by_key.get(key)
        if not sh:
            continue
        # The FULL key, not key.rsplit("__",1)[0][:40]. That stripped the unique
        # hash and truncated, so two records under ONE parent folder ("DVD 1" and
        # "DVD 2" of a 2xDVD show) produced the SAME fragment: the second silently
        # overwrote the first in picks.json, leaving 18 entries for 19 shows, and
        # its timestamps then resolved against the other disc's work directory.
        frag = key
        if any(f in key for f in existing):
            kept += 1
            continue
        rows = blob.get("keep") or []
        if len(rows) < 4:
            print("  SKIP  %-46s only %d frames" % (sh["FolderName"][:46], len(rows)))
            continue
        chosen = pick_for_show(rows)
        if len(chosen) < 4:
            print("  SKIP  %-46s could not fill 4 distinct slots" % sh["FolderName"][:46])
            continue
        # Slot A is NEVER auto-confirmed. The scorer finds the tightest close-up in
        # the show; it has no idea WHO is in it, and on this collection that has put
        # a TV presenter, a news reporter, a phone-in caller, the bassist and a
        # touring keyboardist in the hero slot. It is also blind on dark sources,
        # where the shortlist it ranks contains no close-up at all. So A is emitted
        # as a SUGGESTION carrying the "A?" marker, and hero_gate.py refuses to let
        # the run promote until a human or model has replaced or confirmed it.
        picks[frag] = [["%s %s" % (tag if tag != "A" else "A?", BRIEF[tag]), ts_of(chosen[tag])]
                       for tag in ("A", "B", "C", "spare")]
        made += 1
        print("  auto  %-46s %s" % (sh["FolderName"][:46],
                                    " ".join(ts_of(chosen[t]) for t in ("A", "B", "C", "spare"))))
    outp.write_text(json.dumps(picks, indent=1))
    print("\n  %d auto-picked, %d hand-picked kept -> %s" % (made, kept, outp))


if __name__ == "__main__":
    main()

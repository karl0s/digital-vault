#!/usr/bin/env python3
"""Every aspect override must be mirrored into its shows.json record.

An override fixes the CAPTURE. The record is what the collection knows - it is
what the site renders from and what every audit reads. Two overrides once lived
here across SIX artists while shows.json kept the wrong values, and nothing looked
broken, because the tool rendered correctly the whole time. The discipline of
writing the correction back was documented but not enforced, so this enforces it.

  dar override   -> the record's PICTURE ratio must equal the forced ratio
  crop override  -> the record must use the two-part boxed form,
                    "<frame> (letterboxed|pillarboxed <picture>)", and the picture
                    ratio must match the crop's actual shape

Exit 1 on any unmirrored override. Run standalone, or let promote.py call it.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HOME  = Path.home() / "VaultShots"
SHOWS = Path.home() / "Desktop/Projects/the-vault/public/shows.json"
OVER  = HOME / "data" / "overrides.json"
TOL   = 0.03

RED, GRN, DIM, RESET = "\033[31m", "\033[32m", "\033[2m", "\033[0m"


def ratio(text):
    """The PICTURE ratio a record describes.

    "4:3 (letterboxed 16:9)" is a 4:3 stored frame containing a 16:9 picture.
    The picture is what the override forces and what the viewer sees, so it is
    the half that must match. Bare "16:9 (native)" has only one ratio.
    """
    if not text:
        return None
    nums = re.findall(r"(\d+(?:\.\d+)?)\s*[:x/]\s*(\d+(?:\.\d+)?)", text)
    if not nums:
        return None
    boxed = ("letterbox" in text.lower()) or ("pillarbox" in text.lower())
    a, b = nums[-1] if (boxed and len(nums) > 1) else nums[0]
    try:
        return float(a) / float(b)
    except ZeroDivisionError:
        return None


def is_boxed(text):
    return bool(text) and (("letterbox" in text.lower()) or ("pillarbox" in text.lower()))


def frame_ratio(text):
    """The STORED FRAME ratio - the first number in the two-part form."""
    if not text:
        return None
    nums = re.findall(r"(\d+(?:\.\d+)?)\s*[:x/]\s*(\d+(?:\.\d+)?)", text)
    if not nums:
        return None
    a, b = nums[0]
    try:
        return float(a) / float(b)
    except ZeroDivisionError:
        return None


def tokens(text):
    return [t for t in re.split(r"[^a-z0-9]+", (text or "").lower()) if len(t) > 1]


def match_record(frag, shows, showid=None):
    """Resolve an override key to exactly one record.

    A raw substring test is both too strict and too loose. Too strict because the
    override key is a PATH fragment - "2013 Rock In Rio DVD" never appears
    verbatim in a FolderName written "2013-09-14, Rock In Rio, ... DVD". Too loose
    because "BBC Radio 1" also lands inside Ladyhawke's "BBC Radio 1's Big
    Weekend". Match on tokens, and let an override name its record outright.
    """
    if showid:
        c = [s for s in shows if (s.get("ShowID") or "").strip() == showid]
        return c[0] if len(c) == 1 else None, (
            None if len(c) == 1 else "showid %s not found" % showid)
    want = tokens(frag)
    cand = []
    for s in shows:
        hay = set(tokens((s.get("FolderName") or "") + " " + (s.get("FolderPath") or "")))
        if all(t in hay for t in want):
            cand.append(s)
    if not cand:
        return None, "no record matches tokens %s" % (" ".join(want))
    if len(cand) > 1:
        return None, ('matches %d records (%s) - add "showid" to this override'
                      % (len(cand), ", ".join(x.get("ShowID", "?") for x in cand)))
    return cand[0], None


def main():
    if not OVER.exists():
        print("  no overrides.json - nothing to check")
        return 0
    overrides = json.loads(OVER.read_text(encoding="utf-8"))
    shows = json.loads(SHOWS.read_text(encoding="utf-8"))

    bad, checked = [], 0
    for frag, ov in overrides.items():
        rec, err = match_record(frag, shows, ov.get("showid"))
        if not rec:
            bad.append((frag, err, ""))
            continue
        rar = (rec.get("AspectRatio") or "").strip()
        checked += 1

        if not rar:
            bad.append((frag, "record has NO AspectRatio", rec.get("ShowID", "?")))
            continue

        if "dar" in ov:
            want = ratio(str(ov["dar"]))
            got = ratio(rar)
            if want and (got is None or abs(got - want) / want > TOL):
                bad.append((frag, "override forces DAR %s but record says %r"
                            % (ov["dar"], rar), rec.get("ShowID", "?")))

        if "crop" in ov:
            if not is_boxed(rar):
                bad.append((frag, "crop override but record %r is not the two-part "
                            "boxed form" % rar, rec.get("ShowID", "?")))
            else:
                m = re.match(r"(\d+):(\d+)", str(ov["crop"]))
                W, H = rec.get("Width"), rec.get("Height")
                fr = frame_ratio(rar)
                if m and W and H and fr:
                    # A crop is in STORED pixels; the picture ratio it produces is
                    # only visible after SAR. Derive SAR from the record's own frame
                    # ratio so this needs no drive access:  SAR = frame_dar * H / W.
                    # Comparing raw crop pixels called Viva Overdrive (712x432 PAL,
                    # SAR 16:15 -> 1.758) a mismatch against a correct 16:9 record.
                    sar = (fr * float(H)) / float(W)
                    want = (int(m.group(1)) * sar) / int(m.group(2))
                    got = ratio(rar)
                    if got is None or abs(got - want) / want > TOL:
                        bad.append((frag, "crop %s with SAR %.4f gives %.3f but record's "
                                    "picture ratio is %r" % (ov["crop"], sar, want, rar),
                                    rec.get("ShowID", "?")))

    print("\n  ASPECT OVERRIDES vs RECORDS\n")
    print("    overrides %d   verified %d   unmirrored %s%d%s"
          % (len(overrides), checked - len(bad),
             RED if bad else GRN, len(bad), RESET))
    for frag, why, sid in bad:
        print("    %sUNMIRRORED%s %-46s %-12s %s" % (RED, RESET, frag[:46], sid, why))
    if bad:
        print("\n    An override fixes the CAPTURE; the record is what the collection knows.")
        print("    Write the correction into shows.json with the evidence in Notes.")
        return 1
    print("    %severy override is reflected in its record%s" % (DIM, RESET))
    return 0


if __name__ == "__main__":
    sys.exit(main())

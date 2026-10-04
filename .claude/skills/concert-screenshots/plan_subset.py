#!/usr/bin/env python3
"""Plan a multi-artist batch restricted to specific ShowIDs. Writes data/state.json.

    python3 plan_subset.py --label "Tier2 B1" --ids ids.json

ids.json maps artist -> [ShowID, ...]. Each artist is planned with the normal
discover()/apply_splits() path (so splits.json, exclude.json and overrides still
apply), then only the listed ShowIDs are kept and the units are merged under one
label. Run the batch afterwards with ./run_artist_noplan.sh "<label>".

Refuses to write if any requested ShowID produced no unit - a show that silently
drops out of a re-pick batch would look "unchanged" on the review page.
"""
import argparse, json, sys, io, contextlib
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import shots

ap = argparse.ArgumentParser()
ap.add_argument("--label", required=True)
ap.add_argument("--ids", required=True)
a = ap.parse_args()
want = json.loads(Path(a.ids).read_text())
merged, missing = [], []
for artist, sids in want.items():
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        shots.cmd_plan(argparse.Namespace(artist=artist))
    st = json.loads(shots.STATE.read_text()) if hasattr(shots, "STATE") else json.loads((Path(__file__).parent/"data/state.json").read_text())
    got = {e["ShowID"]: e for e in st["shows"]}
    for sid in sids:
        if sid in got: merged.append(got[sid])
        else: missing.append((artist, sid))
    print("  %-22s %2d requested  %2d planned" % (artist, len(sids), sum(1 for s in sids if s in got)))
keys = [e["key"] for e in merged]
if len(keys) != len(set(keys)):
    sys.exit("REFUSING: duplicate work keys %s" % [k for k in keys if keys.count(k) > 1])
if missing:
    for m in missing: print("  MISSING", *m)
    sys.exit("REFUSING: %d requested show(s) produced no unit - resolve before capturing" % len(missing))
(Path(__file__).parent/"data/state.json").write_text(json.dumps({"artist": a.label, "shows": merged}, indent=1))
print("  %d units -> data/state.json as %r" % (len(merged), a.label))

#!/usr/bin/env python3
"""Plan loose files that are NOT on Live Music yet (downloads, a stick) - writes data/state.json.

    python3 plan_files.py --label "Downloads 2026-10-29" --files files.json

files.json is a list of {"path", "ShowID", "Checksum", "ShowDate"} plus optional
"progressive": "<why>" for a stream FLAGGED interlaced whose picture idet measures as
progressive (deinterlacing a progressive picture only softens it - SKILL.md 4.6).
Each file is planned exactly as discover()/cmd_plan() would plan a loose file on the
drive: pick_source, compute_target, overrides.json (scope a rule by "showid"), the
sane-bitrate duration check and gates 1-3. Run the batch afterwards with
./run_artist_noplan.sh "<label>".

Refuses to write if any file fails a gate, is missing, or two entries share a key or a
ShowID - a show that silently drops out looks "unchanged" on the review page.
"""
import argparse, hashlib, json, re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import shots

ap = argparse.ArgumentParser()
ap.add_argument("--label", required=True)
ap.add_argument("--files", required=True)
a = ap.parse_args()
want = json.loads(Path(a.files).read_text())
recs = {s["ShowID"]: s for s in json.loads((shots.REPO / "public/shows.json").read_text())}
units, bad = [], []
for e in want:
    p = Path(e["path"])
    if not p.is_file():
        bad.append((p.name, "not a file")); continue
    src, kind, files = shots.pick_source(p)
    info, err = shots.ffprobe_stream(src)
    if not info:
        bad.append((p.name, err)); continue
    t = shots.compute_target(info["stream"])
    it = {"rel": p.name, "label": p.name, "ShowID": e["ShowID"]}
    t = shots.apply_override(it, t)
    if e.get("progressive"):
        t["interlaced"] = False
        t["override"] = (t.get("override", "") + " progressive picture in an interlaced-flagged stream (%s)" % e["progressive"]).strip()
    try: rep = float(info["format"].get("duration") or 0)
    except Exception: rep = 0.0
    dur, how = shots.true_duration(src, files, rep)
    rec = recs.get(e["ShowID"]) or {}
    passed, glist = shots.gates(t, rec.get("AspectRatio"))
    n = max(120, min(500, int(dur // 5))) if dur > 0 else 120
    print("  %s %-58s %-9s SAR %-6s -> %-9s %-12s %5.0fmin %3d %s" % (
        "OK  " if passed else "FAIL", p.name[:58], "%dx%d" % (t["w"], t["h"]), t["sar"],
        "%dx%d" % (t["target_w"], t["target_h"]), ("intl " + t["field_order"]) if t["interlaced"] else "progressive",
        dur / 60, n, how))
    if t.get("override"): print("        override: %s" % t["override"])
    for name, good, detail in glist:
        if not good: print("        gate failed: %s (%s)" % (name, detail))
    if not passed:
        bad.append((p.name, "gate")); continue
    slug = re.sub(r"[^A-Za-z0-9]+", "_", p.name).strip("_")[:48]
    units.append({
        "key": "%s__%s" % (slug, hashlib.sha1(p.name.encode()).hexdigest()[:6]),
        "ShowID": e["ShowID"], "Checksum": e.get("Checksum", ""),
        "vts": [], "vobs": [], "files": [], "t0": 0.0, "decode": "",
        "FolderName": p.name, "rel": p.name, "ShowDate": e.get("ShowDate", ""),
        "link": "file:%s" % p.parent, "src": src, "kind": kind, "duration": dur, "n": n, **t,
    })
for k in ("key", "ShowID"):
    vals = [u[k] for u in units]
    if len(vals) != len(set(vals)):
        sys.exit("REFUSING: duplicate %s %s" % (k, sorted({v for v in vals if vals.count(v) > 1})))
if bad:
    for b in bad: print("  PROBLEM", *b)
    sys.exit("REFUSING: %d file(s) not planned - resolve before capturing" % len(bad))
shots.assert_readonly_target(shots.STATE)
shots.STATE.write_text(json.dumps({"artist": a.label, "shows": units}, indent=1), encoding="utf-8")
print("  %d units -> %s as %r" % (len(units), shots.STATE, a.label))

#!/usr/bin/env python3
"""Plan loose files that are NOT on Live Music yet (downloads, a stick) - writes data/state.json.

    python3 plan_files.py --label "Downloads 2026-10-29" --files files.json

files.json is a list of {"path", "ShowID", "Checksum", "ShowDate"} - path a file or a disc folder,
"vts": ["01"] to take one titleset, "from"/"to" (seconds or "H:MM:SS") to window one
programme inside the stream - plus optional
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
    if not (p.is_file() or p.is_dir()):        # a loose file, or a disc folder (pick_source reads its VOBs)
        bad.append((p.name, "not on disk")); continue
    src, kind, files = shots.pick_source(p, e.get("vts"))
    if not src:
        bad.append((p.name, "no media")); continue
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
    # A multi-part concat: source's container duration is the first part's guess (SKILL.md 5.1):
    # demux it, as cmd_plan does, or a 2:14 disc plans as 45 min.
    if str(src).startswith("concat:") and str(src).count("|") >= 1:
        _d = shots.demux_duration(src)
        dur, how = (_d, "demuxed") if _d > 1 else shots.true_duration(src, files, rep)
    else:
        dur, how = shots.true_duration(src, files, rep)
    # "from"/"to" window one programme inside a longer stream, exactly as a splits.json
    # from/to does in cmd_plan: the frame budget and the 5%/95% trim describe the window.
    t0w, t1w = shots._secs(e.get("from")), shots._secs(e.get("to"))
    if t0w is not None or t1w is not None:
        lo, hi = t0w or 0.0, (t1w if t1w else dur)
        dur = max(1.0, min(hi, dur) - lo)
        how += " window %d:%02d-%d:%02d" % (int(lo) // 60, int(lo) % 60, int(lo + dur) // 60, int(lo + dur) % 60)
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
    rel = p.name
    if e.get("vts"): rel += "_VTS" + "+".join(e["vts"])            # two units of one disc need two keys
    if t0w is not None or t1w is not None: rel += "_T%d-%d" % (int(t0w or 0), int(t1w or 0))
    slug = re.sub(r"[^A-Za-z0-9]+", "_", rel).strip("_")[:48]
    units.append({
        "key": "%s__%s" % (slug, hashlib.sha1(rel.encode()).hexdigest()[:6]),
        "ShowID": e["ShowID"], "Checksum": e.get("Checksum", ""),
        "vts": e.get("vts") or [], "vobs": [], "files": [], "t0": t0w or 0.0, "t1": t1w, "decode": e.get("decode", ""),
        "FolderName": p.name, "rel": rel, "ShowDate": e.get("ShowDate", ""),
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

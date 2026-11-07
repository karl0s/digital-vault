#!/usr/bin/env python3
"""Are the recent additions on Live Music complete and playable? READ-ONLY on the drive.

    python3 verify_recent.py                    # every record with AddedOn
    python3 verify_recent.py --since 2026-11-01 # added on or after a date
    python3 verify_recent.py --nft              # only NFT records (a trader's copies)
    python3 verify_recent.py --only <ShowID> --fresh

For each record: present at FolderPath (else found by exact size: a file renamed in the move);
sizes against the record; the full SHA1 against ChecksumSHA1 (the media as RepVideoFiles lists
it, or with the titleset's _0 VOB first; a derived checksum - a time-window split - is reported
as such, its disc verified through the sibling with the real hash); and playability: 8 seconds
decoded at 2/25/50/75% and the last 4 seconds, counting the frames that come out against the
stream's frame rate (avg_frame_rate - r_frame_rate is the field rate on interlaced m2ts).

Decoder messages after a seek are normal on broadcast TS/m2ts and VOBs (no SPS/PPS or sequence
header until the next keyframe) and are NOT counted as faults; frames are. An H.264 TS that
carries its PPS only at the start decodes nothing after a seek: decode it whole from the start
(`ffmpeg -v error -i F -map 0:v:0 -f null -`) and compare the frame count with length x fps
(Oasis Wembley 2008: 67,412 of 67,450, 2026-11-07).

Writes ~/VaultShots/data/verify_recent.json (resumable). Needs the drive mounted (run outside
the sandbox). First used 2026-11-07, before a trader's download links expired: 64 records, 263 GB.
"""
import argparse, hashlib, json, os, re, subprocess, time
from pathlib import Path

VS = Path.home() / "VaultShots"; REPO = Path("/Users/ko/Desktop/Projects/the-vault"); LM = Path("/Volumes/Live Music")
OUT = VS / "data/verify_recent.json"
ap = argparse.ArgumentParser(); ap.add_argument("--since", default=""); ap.add_argument("--nft", action="store_true"); ap.add_argument("--fresh", action="store_true"); ap.add_argument("--only", default="", help="one ShowID")
a = ap.parse_args()
shows = json.loads((REPO / "public/shows.json").read_text())
recs = [s for s in shows if s.get("AddedOn") and s["AddedOn"] >= a.since and (not a.nft or s.get("NFT") == "Yes") and (not a.only or s["ShowID"] == a.only)]

def size_index():
    idx = {}
    for root, dirs, files in os.walk(LM):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        if root.count(os.sep) - str(LM).count(os.sep) > 1: dirs[:] = []
        for f in files:
            if not f.startswith("."):
                p = os.path.join(root, f)
                try: idx.setdefault(os.path.getsize(p), []).append(p)
                except OSError: pass
    return idx

def media_of(s, base):
    if base.is_file(): return [base]
    out = []
    for r in [r.strip() for r in (s.get("RepVideoFiles") or "").split(";") if r.strip()]:
        p = base / r
        if not p.exists() and (base / "VIDEO_TS" / Path(r).name).exists(): p = base / "VIDEO_TS" / Path(r).name
        out.append(p)
    return out

def sha1_files(files):
    h = hashlib.sha1()
    for f in files:
        with open(f, "rb") as fh:
            for b in iter(lambda: fh.read(8 << 20), b""): h.update(b)
    return h.hexdigest()

def probe(f):
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=avg_frame_rate:format=duration",
                                   "-of", "json", str(f)], capture_output=True, text=True).stdout or "{}")
    try: n, d = j["streams"][0]["avg_frame_rate"].split("/"); fps = int(n) / int(d)
    except Exception: fps = 25.0
    return float(j.get("format", {}).get("duration") or 0), fps if 5 < fps < 75 else 25.0

def frames(f, at, secs):
    r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{max(0, at):.1f}", "-i", str(f), "-map", "0:v:0", "-t", str(secs), "-f", "null", "-",
                        "-progress", "pipe:1", "-nostats"], capture_output=True, text=True, timeout=900)
    got = re.findall(r"^frame=(\d+)", r.stdout, re.M)
    return int(got[-1]) if got else 0

done = {} if a.fresh or not OUT.exists() else json.loads(OUT.read_text())
idx = None
for s in recs:
    sid = s["ShowID"]
    if sid in done: continue
    row = {"Artist": s["Artist"], "AddedOn": s["AddedOn"], "NFT": s.get("NFT", ""), "FolderPath": s["FolderPath"]}
    base = Path(s["FolderPath"])
    if not base.exists():
        idx = idx or size_index(); c = idx.get(int(s.get("TotalSizeBytes") or 0), [])
        if len(c) != 1:
            row["status"] = "MISSING"; row["candidates"] = c; done[sid] = row; OUT.write_text(json.dumps(done, indent=1)); print(sid, "MISSING", s["FolderPath"], flush=True); continue
        base = Path(c[0]); row["renamed_to"] = c[0]
    files = media_of(s, base)
    if any(not f.exists() for f in files):
        row["status"] = "FILES MISSING"; row["missing"] = [str(f) for f in files if not f.exists()]; done[sid] = row; OUT.write_text(json.dumps(done, indent=1)); print(sid, "FILES MISSING", flush=True); continue
    allf = [p for p in base.rglob("*") if p.is_file() and not p.name.startswith(".")] if base.is_dir() else [base]
    row["bytes_on_drive"] = sum(p.stat().st_size for p in allf); row["bytes_in_record"] = int(s.get("TotalSizeBytes") or 0)
    cands = {"media": sha1_files(files)}
    if re.search(r"VTS_\d\d_[1-9]\.VOB$", files[0].name):
        z = files[0].with_name(re.sub(r"_\d\.VOB$", "_0.VOB", files[0].name))
        if z.exists(): cands["with_vts0"] = sha1_files([z] + files)
    pn = (s.get("PrivateNotes") or "").lower()
    row["sha1_match"] = s.get("ChecksumSHA1") in cands.values(); row["derived"] = "derived" in pn and "not a content hash" in pn
    ratios = []
    for i, f in enumerate(files):
        dur, fps = probe(f)
        pts = (0.02, 0.25, 0.5, 0.75) if len(files) == 1 else ((0.02, 0.5) if i == 0 else (0.5,))
        ratios += [round(frames(f, dur * x, 8) / (fps * 8), 2) for x in pts]
        if i == len(files) - 1: ratios.append(round(frames(f, dur - 4, 4) / (fps * 4), 2))
    row["frame_ratios"] = ratios
    ok_play = min(ratios) >= 0.85
    row["status"] = "OK" if (row["sha1_match"] or row["derived"]) and ok_play and row["bytes_on_drive"] == row["bytes_in_record"] else "CHECK"
    done[sid] = row; OUT.write_text(json.dumps(done, indent=1))
    print(sid, row["status"], s["Artist"][:22].ljust(22), "sha1", "match" if row["sha1_match"] else ("derived" if row["derived"] else "MISMATCH"),
          "| frames", min(ratios), "| size", "ok" if row["bytes_on_drive"] == row["bytes_in_record"] else "DIFFERS", flush=True)
bad = {k: v for k, v in done.items() if v.get("status") != "OK"}
print(f"DONE {len(done)} records, {len(done) - len(bad)} OK, {len(bad)} to look at:", ", ".join(bad) or "none")

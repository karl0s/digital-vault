#!/usr/bin/env python3
"""Reconcile public/shows.json against the drive. READ-ONLY.

Three passes, cheapest first, because each is decisive for a subset:
  1. FolderPath resolves on the drive           -> matched
  2. exact FolderName / parent-name equality    -> matched (the path has drifted)
  3. content hash of the representative media   -> matched, whatever it is called
Anything still unmatched after 3 is genuinely one-sided and is reported as such.
"""
import hashlib, json, os, sys, unicodedata
from pathlib import Path
DRIVE = Path("/Volumes/Live Music"); REPO = Path("/Users/ko/Desktop/Projects/the-vault")
VIDEO = {".vob",".mkv",".mp4",".m4v",".avi",".ts",".m2ts",".mts",".mpg",".mpeg",".mov",".wmv",".flv"}
NFC = lambda s: unicodedata.normalize("NFC", s)

def has_media(p):
    try:
        for q in os.scandir(p):
            if q.is_file() and Path(q.name).suffix.lower() in VIDEO: return True
            if q.is_dir() and q.name.upper() in ("VIDEO_TS","BDMV"): return True
    except OSError: pass
    return False

def rep_media(p):
    if p.is_file(): return [p]
    for d in (p/"VIDEO_TS", p):
        if d.is_dir():
            v = sorted(q for q in d.iterdir() if q.is_file()
                       and q.name.upper().startswith("VTS_") and q.suffix.upper()==".VOB"
                       and q.stem[-1] != "0")
            if v: return v
    vids = [q for q in p.rglob("*") if q.is_file() and q.suffix.lower() in VIDEO]
    return [max(vids, key=lambda q: q.stat().st_size)] if vids else []

CACHE_F = Path("/private/tmp/claude-501/-Users-ko-Desktop-Projects-the-vault/c425e4be-2ae6-4e1a-b186-4b7be292da01/scratchpad/hash_cache.json")
CACHE = json.loads(CACHE_F.read_text()) if CACHE_F.exists() else {}

def sha1(paths):
    key = "|".join("%s:%d:%d" % (q, q.stat().st_size, q.stat().st_mtime) for q in paths)
    if key in CACHE: return CACHE[key]
    h = hashlib.sha1()
    for q in paths:
        try:
            with open(q,"rb") as fh:
                while True:
                    b = fh.read(1<<20)
                    if not b: break
                    h.update(b)
        except OSError: return ""
    CACHE[key] = h.hexdigest()
    return CACHE[key]

# ---- drive units
units = []
for p in sorted(DRIVE.iterdir()):
    if p.name.startswith(".") or "karls pc before it dies" in p.name.casefold(): continue
    if p.is_file() and p.suffix.lower() in VIDEO: units.append(p); continue
    if not p.is_dir(): continue
    if has_media(p): units.append(p)
    else:
        for q in sorted(p.iterdir()):
            if q.is_dir() and not q.name.startswith(".") and has_media(q): units.append(q)

shows = json.loads((REPO/"public/shows.json").read_text())
u_by_path = {NFC(str(u)): u for u in units}
u_by_name = {}
for u in units: u_by_name.setdefault(NFC(u.name).casefold(), []).append(u)

matched_u, matched_s, how = {}, {}, {}
for s in shows:
    fp = s.get("FolderPath") or ""
    u = u_by_path.get(NFC(fp))
    if u is not None and str(u) not in matched_u:
        matched_u[str(u)] = s; matched_s[s["ShowID"]] = u; how[s["ShowID"]] = "path"
for s in shows:
    if s["ShowID"] in matched_s: continue
    for key in (s.get("FolderName") or "", Path(s.get("FolderPath") or "").name):
        for u in u_by_name.get(NFC(key).casefold(), []):
            if str(u) not in matched_u:
                matched_u[str(u)] = s; matched_s[s["ShowID"]] = u; how[s["ShowID"]] = "name"; break
        if s["ShowID"] in matched_s: break

rest_u = [u for u in units if str(u) not in matched_u]
rest_s = [s for s in shows if s["ShowID"] not in matched_s]
print("units on drive %d   records %d" % (len(units), len(shows)))
print("matched by path %d, by name %d  -> unresolved: %d units, %d records\n"
      % (sum(1 for v in how.values() if v=="path"), sum(1 for v in how.values() if v=="name"),
         len(rest_u), len(rest_s)))
if "--hash" in sys.argv:
    by_ck = {}
    for s in rest_s:
        c = (s.get("ChecksumSHA1") or "").strip()
        if c: by_ck.setdefault(c, []).append(s)
    print("hashing %d unresolved units..." % len(rest_u))
    for i, u in enumerate(rest_u, 1):
        reps = rep_media(u)
        if not reps: continue
        c = sha1(reps)
        if c in by_ck and by_ck[c]:
            s = by_ck[c].pop(0)
            matched_u[str(u)] = s; matched_s[s["ShowID"]] = u; how[s["ShowID"]] = "content"
        if i % 25 == 0: print("   %d/%d" % (i, len(rest_u)), flush=True)
    rest_u = [u for u in units if str(u) not in matched_u]
    rest_s = [s for s in shows if s["ShowID"] not in matched_s]
    print("\nafter content hashing -> unresolved: %d units, %d records" % (len(rest_u), len(rest_s)))
CACHE_F.write_text(json.dumps(CACHE))
json.dump({"mapping": {s["ShowID"]: str(matched_s[s["ShowID"]]) for s in shows if s["ShowID"] in matched_s},
           "units_no_record": [str(u.relative_to(DRIVE)) for u in rest_u],
           "records_no_unit": [{"ShowID":s["ShowID"],"Artist":s["Artist"],
                                "FolderName":s.get("FolderName"),"FolderPath":s.get("FolderPath"),
                                "size":s.get("TotalSizeHuman"),"ck":s.get("ChecksumSHA1","")[:12]}
                               for s in rest_s],
           "how": how},
          open("/private/tmp/claude-501/-Users-ko-Desktop-Projects-the-vault/c425e4be-2ae6-4e1a-b186-4b7be292da01/scratchpad/reconcile.json","w"), indent=1)

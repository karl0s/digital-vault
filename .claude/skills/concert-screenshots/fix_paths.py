#!/usr/bin/env python3
"""Rewrite FolderPath/FolderName to where each show ACTUALLY lives on the drive.

Only 31 of 879 records still resolved by their stored path; the rest still point at
'Big Daddy' or 'Seagate Expansion Drive' from before the collection was reorganised
onto 'Live Music'. Every tool therefore falls back to matching folders by NAME, and
that is what produced three wrong record mappings, a sidecar resolved to the wrong
band's file, and two 'undocumented' shows that were already recorded.

Takes the mapping from reconcile.py, which resolves by path, then by name, then by
content hash - so a folder that was renamed is still matched by what is inside it.
The old value is preserved in Notes: nothing is discarded.
"""
import json, sys
from pathlib import Path
S = Path("/private/tmp/claude-501/-Users-ko-Desktop-Projects-the-vault/c425e4be-2ae6-4e1a-b186-4b7be292da01/scratchpad")
REPO = Path("/Users/ko/Desktop/Projects/the-vault")
APPLY = "--apply" in sys.argv

rec = json.loads((S/"reconcile.json").read_text())
mapping = rec["mapping"]
shows = json.loads((REPO/"public/shows.json").read_text())
by = {s["ShowID"]: s for s in shows}

changed = renamed = same = 0
examples = []
for sid, newpath in mapping.items():
    s = by.get(sid)
    if not s: continue
    old_p, old_n = s.get("FolderPath") or "", s.get("FolderName") or ""
    new_n = Path(newpath).name
    if old_p == newpath and old_n == new_n:
        same += 1; continue
    if APPLY:
        note = "FolderPath updated 2026-08-25 to where this show now lives on the drive. Previously %r" % old_p
        if old_n != new_n: note += " with FolderName %r" % old_n
        note += ". Matched by content hash where the name had changed."
        s["Notes"] = (note + "\n\n" + (s.get("Notes") or "")).strip()
        s["FolderPath"] = newpath
        s["FolderName"] = new_n
        s["MasterDriveName"] = "Live Music"
    changed += 1
    if old_n != new_n:
        renamed += 1
        if len(examples) < 12: examples.append((sid, s.get("Artist","")[:18], old_n[:40], new_n[:40]))

print("records mapped to a folder : %d" % len(mapping))
print("already correct            : %d" % same)
print("paths rewritten            : %d  (of which the FOLDER NAME also changed: %d)" % (changed, renamed))
print("\nname changes, sample:")
for sid, art, o, n in examples:
    print("  %s %-18s %-40s -> %s" % (sid, art, o, n))
if APPLY:
    (REPO/"public/shows.json").write_text(json.dumps(shows, ensure_ascii=False, indent=2))
    print("\nAPPLIED")
else:
    print("\ndry run")

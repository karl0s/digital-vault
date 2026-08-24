#!/usr/bin/env bash
# Everything read-only that must happen BEFORE a frame is captured.
#
#   ~/VaultShots/scout.sh "Radiohead"
#
# One pass, one log, one summary. Nothing here decides anything - each line is a
# folder or record to LOOK at. Capturing before resolving these is what produces
# stills of the wrong concert, which no later step detects.
set -u
A="${1:?usage: scout.sh \"Artist Name\"}"
cd ~/VaultShots || exit 1
REPO=~/Desktop/Projects/the-vault
LOG=/tmp/scout_$(echo "$A" | tr -cd '[:alnum:]').log
: > "$LOG"
say(){ printf '\n=== %s ===\n' "$*" | tee -a "$LOG"; }

say "PREFLIGHT $A";      python3 -u preflight.py --artist "$A"                     2>&1 | tee -a "$LOG"
say "MULTI-SHOW";        python3 -u find_multishow.py --artist "$A"                2>&1 | tee -a "$LOG"
say "IMAGES vs RECORD";  python3 -u "$REPO/scripts/audit-image-geometry.py" --artist "$A" 2>&1 | tee -a "$LOG"
say "RECORD vs SOURCE";  python3 -u "$REPO/scripts/audit-aspect-vs-source.py" --artist "$A" 2>&1 | tee -a "$LOG"
say "SETLISTS";          python3 -u "$REPO/scripts/audit-sidecar-setlists.py" --artist "$A" 2>&1 | tee -a "$LOG"
say "SPLIT-BILL RECORDS"
{ python3 - "$A" <<'PY'
import json, sys
a = sys.argv[1]
hit = [s for s in json.load(open("/Users/ko/Desktop/Projects/the-vault/public/shows.json"))
       if a.lower() in (s.get("Artist") or "").lower() and (s.get("Artist") or "") != a]
print("  %d record(s) filed under a JOINED artist name - invisible to an exact-match run" % len(hit))
for s in hit: print("   ", s["ShowID"], repr(s.get("Artist")), (s.get("FolderName") or "")[:44])
PY
} 2>&1 | tee -a "$LOG"
say "SIDECARS TO READ"
{ python3 - "$A" <<'PY'
import json, os, re, sys, unicodedata
from pathlib import Path
D = Path("/Volumes/Live Music"); a = sys.argv[1]
def toks(x):
    x = unicodedata.normalize("NFKD", x or "").encode("ascii","ignore").decode().casefold().replace("'","")
    return set(t for t in re.sub(r"[^a-z0-9]+"," ",x).split() if len(t) > 1)
want = toks(a); sq = re.sub(r"[^a-z0-9]+","",a.casefold()); n = 0
for p in sorted(D.iterdir()):
    if not p.is_dir() or p.name.startswith("."): continue
    if not (len(want & toks(p.name)) >= min(2,len(want)) or sq in re.sub(r"[^a-z0-9]+","",p.name.casefold())): continue
    for r,_,fs in os.walk(p):
        for f in fs:
            if f.startswith("._"): continue
            if Path(f).suffix.lower() in (".txt",".nfo",".info"):
                print("   ", os.path.join(r,f).replace(str(D)+"/","")); n += 1
print("  %d sidecar(s). READ EVERY ONE - they have revealed two-show discs, wrong dates and full setlists before a frame was decoded." % n)
PY
} 2>&1 | tee -a "$LOG"

cat <<EOF | tee -a "$LOG"

=== WHAT TO DO NEXT ===
  Resolve everything above BEFORE capturing:
    * folders with >1 titleset      -> is that one show or several?
    * duplicate groups that disagree -> align date/event/venue/city/country
    * durations vs size             -> a wrong runtime under-samples the show
    * records with no checksum      -> they cannot carry images at all
  Then:  ~/VaultShots/run_artist.sh "$A"      (plan -> capture -> score -> autopick)
  Then:  ~/VaultShots/showpicks.sh "$A"       (materialise, verify, open in the browser)
  Full log: $LOG
EOF

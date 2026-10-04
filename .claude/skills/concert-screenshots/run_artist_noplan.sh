#!/bin/bash
# run_artist.sh without the PLAN step, for runs whose state.json has been
# deliberately pruned (a unit belonging to another artist's records, a cached
# duplicate). Re-running plan would rebuild state.json and undo the pruning.
set -u
A="$1"
cd ~/VaultShots || exit 1
LOG=/tmp/run_$(echo "$A" | tr -cd '[:alnum:]').log
: > "$LOG"
say() { echo "=== $* ===" | tee -a "$LOG"; }
say "STATE (plan skipped - using the pruned data/state.json)"
python3 -c "import json;s=json.load(open('data/state.json'));print(' %d units, artist %s'%(len(s['shows']),s['artist']))" | tee -a "$LOG"
say "CAPTURE";     python3 -u shots.py --artist "$A" capture --workers 3 >>"$LOG" 2>&1 || exit 3
say "SCORE";       python3 -u shots.py --artist "$A" score --top 24 --workers 6 >>"$LOG" 2>&1 || exit 4
say "CONTACT";     python3 -u shots.py --artist "$A" contact         >>"$LOG" 2>&1 || exit 5
say "AUTOPICK";    python3 -u autopick.py --artist "$A" --merge      >>"$LOG" 2>&1 || exit 6
say "MATERIALISE"; python3 -u shots.py --artist "$A" picks           >>"$LOG" 2>&1 || exit 7
say "REVIEW";      python3 -u reviewsheet.py --artist "$A"           >>"$LOG" 2>&1 || exit 8
{
  echo
  echo "########## SUMMARY ##########"
  grep -E "ready:|captured .* frames" "$LOG" | sed 's/\x1b\[[0-9;]*m//g'
  echo "--- weak or starved shows (look at these first) ---"
  grep -E "STARVED|CROWD TEST RELAXED|best [0-4][0-9] " "$LOG" | sed 's/\x1b\[[0-9;]*m//g'
  echo "--- picks ---"
  grep -E "attempted|UNRESOLVED|DUPLICATE" "$LOG" | sed 's/\x1b\[[0-9;]*m//g'
  echo "--- review montage ---"
  grep -E "vision tokens|shows x 4" "$LOG"
} | tee -a "$LOG"

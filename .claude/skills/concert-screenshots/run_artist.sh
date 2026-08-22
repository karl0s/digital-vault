#!/bin/bash
# One command, one wait, one image to look at.
#
# The expensive part of this task was never the compute - it was an assistant
# babysitting it: a tool call to check progress every minute, and a full-size
# contact sheet read per show. This runs the whole deterministic pipeline
# offline and exits, so the assistant spends ONE turn starting it and ONE turn
# looking at the result.
#
#   ./run_artist.sh "Incubus"
#
set -u
A="$1"
cd ~/VaultShots || exit 1
LOG=/tmp/run_$(echo "$A" | tr -cd '[:alnum:]').log
: > "$LOG"

say() { echo "=== $* ===" | tee -a "$LOG"; }

say "PLAN $A";     python3 -u shots.py --artist "$A" plan            >>"$LOG" 2>&1 || exit 2
say "CAPTURE";     python3 -u shots.py --artist "$A" capture --workers 3 >>"$LOG" 2>&1 || exit 3
say "SCORE";       python3 -u shots.py --artist "$A" score --top 24 --workers 6 >>"$LOG" 2>&1 || exit 4
say "CONTACT";     python3 -u shots.py --artist "$A" contact         >>"$LOG" 2>&1 || exit 5
say "AUTOPICK";    python3 -u autopick.py --artist "$A" --merge      >>"$LOG" 2>&1 || exit 6
say "MATERIALISE"; python3 -u shots.py --artist "$A" picks           >>"$LOG" 2>&1 || exit 7
say "REVIEW";      python3 -u reviewsheet.py --artist "$A"           >>"$LOG" 2>&1 || exit 8

# The summary the assistant actually needs - everything else stays in the log.
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

#!/usr/bin/env bash
# Materialise picks, verify every image resolves, then open the page.
#
#   ~/VaultShots/showpicks.sh "Smashing Pumpkins"
#   ~/VaultShots/showpicks.sh              # uses whatever artist is staged
#
# The artist name is a SAFETY CHECK, not a selector: shots.py derives everything
# from data/state.json, so passing a name that does not match what is staged means
# the wrong run is loaded — which has silently happened before — and this refuses
# rather than showing you another artist's picks.
set -euo pipefail
cd ~/VaultShots

[ -f data/state.json ] || { echo "no data/state.json — nothing is staged. Run 'shots.py --artist \"X\" plan' first."; exit 1; }
STAGED=$(python3 -c "import json;print(json.load(open('data/state.json')).get('artist',''))")
[ -n "$STAGED" ] || { echo "data/state.json has no artist"; exit 1; }

if [ $# -ge 1 ]; then
  WANT="$*"
  if [ "$(echo "$WANT" | tr 'A-Z' 'a-z')" != "$(echo "$STAGED" | tr 'A-Z' 'a-z')" ]; then
    echo "REFUSING: you asked for '$WANT' but the staged run is '$STAGED'."
    echo "Re-plan first:  python3 shots.py --artist \"$WANT\" plan"
    exit 1
  fi
fi

SLUG=$(python3 -c "
import re,json
a=json.load(open('data/state.json')).get('artist','artist')
print(re.sub(r'[^a-z0-9]+','_',a.lower()).strip('_'))")
PAGE="reports/${SLUG}_picks.html"

echo "artist staged : $STAGED"
python3 shots.py picks

[ -f "$PAGE" ] || { echo "REFUSING: $PAGE was not produced"; exit 1; }

# Never open a page whose images do not resolve — a broken page wastes a review pass
# and is worse than no page at all.
if ! python3 check_report_links.py "$PAGE"; then
  echo "REFUSING to open: images in $PAGE do not resolve."
  echo "Most often this means 'shots.py archive' already moved picks/ — restore it or re-materialise."
  exit 1
fi

echo "opening $PAGE"
open "$PAGE"

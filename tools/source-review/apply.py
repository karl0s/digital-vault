"""Writes the Source review's picks into public/shows.json.

    python3 tools/source-review/apply.py picks.txt            # dry run: prints the plan
    python3 tools/source-review/apply.py picks.txt --apply    # writes it

picks.txt is the review page's "Copy for Claude Code" export (tools/source-review/build.py).
Only records whose RecordingType is still blank are touched; each gets a PrivateNotes entry
under SOURCE (date). "Not sure" rows stay blank. The file is rewritten in its own format
(indent 2, UTF-8), so nothing else changes. Afterwards: python3 scripts/health-check.py, commit
(fix(shows):), and rebuild the page so answered records drop off it.
"""
import datetime
import json
import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SHOWS = os.path.join(REPO, 'public', 'shows.json')
SECTIONS = {'PRO-SHOT': 'Proshot', 'AUDIENCE': 'Audience', 'NOT SURE': None}


def parse(text):
    picks, current = {}, None
    for line in text.splitlines():
        head = re.match(r'^(PRO-SHOT|AUDIENCE|NOT SURE)', line.strip())
        if head:
            current = head.group(1)
            continue
        m = re.match(r'^([0-9a-f]{12})\s', line.strip())
        if m and current:
            picks[m.group(1)] = SECTIONS[current]
    return picks


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    picks = parse(open(sys.argv[1], encoding='utf-8').read())
    raw = open(SHOWS, encoding='utf-8').read()
    shows = json.loads(raw)
    if json.dumps(shows, indent=2, ensure_ascii=False) + '\n' != raw:
        sys.exit('shows.json is not in its usual format; not touching it')
    by_id = {s['ShowID']: s for s in shows}
    today = datetime.date.today().isoformat()
    plan, skipped = [], []
    for sid, value in picks.items():
        show = by_id.get(sid)
        if show is None:
            skipped.append(f'{sid}: no such record')
        elif value is None:
            skipped.append(f'{sid} {show["Artist"]}: not sure, left blank')
        elif (show.get('RecordingType') or '').strip():
            skipped.append(f'{sid} {show["Artist"]}: already {show["RecordingType"]}')
        else:
            plan.append((show, value))
    for show, value in plan:
        print(f'  {show["ShowID"]}  {show["Artist"]} · {show.get("ShowDate") or "Undated"}  ->  {value}')
    for line in skipped:
        print(f'  skip {line}')
    print(f'{len(plan)} to write, {len(skipped)} skipped')
    if '--apply' not in sys.argv:
        print('Dry run. Add --apply to write.')
        return
    for show, value in plan:
        show['RecordingType'] = value
        note = (f"SOURCE ({today}): RecordingType set to {value}, the owner's pick on the source review "
                f"(tools/source-review), from the stills and the record's own clues.")
        prev = (show.get('PrivateNotes') or '').rstrip()
        show['PrivateNotes'] = f'{prev}\n\n{note}' if prev else note
    out = json.dumps(shows, indent=2, ensure_ascii=False) + '\n'
    assert '�' not in out
    open(SHOWS, 'w', encoding='utf-8').write(out)
    print(f'Wrote {len(plan)}. Next: python3 scripts/health-check.py, commit, python3 tools/source-review/build.py')


if __name__ == '__main__':
    main()

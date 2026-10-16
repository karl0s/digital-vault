"""Writes the date-precision review's picks into public/shows.json.

    python3 tools/date-precision/apply.py picks.txt            # dry run: prints the plan
    python3 tools/date-precision/apply.py picks.txt --apply    # writes it

picks.txt is the review page's "Copy for Claude Code" export (tools/date-precision/build.py).
REAL DATE writes DatePrecision "day", MONTH ONLY writes "month" (the date must be YYYY-MM-01);
NOT SURE changes nothing. Each record gets a PrivateNotes entry under DATE PRECISION (date).
The file is rewritten in its own format, so nothing else changes. Afterwards: python3
scripts/health-check.py, commit (fix(shows):), and rebuild the page.
"""
import datetime
import json
import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SHOWS = os.path.join(REPO, 'public', 'shows.json')
SECTIONS = {'REAL DATE': 'day', 'MONTH ONLY': 'month', 'NOT SURE': None}


def parse(text):
    picks, current = {}, None
    for line in text.splitlines():
        head = re.match(r'^(REAL DATE|MONTH ONLY|NOT SURE)', line.strip())
        if head:
            current = head.group(1)
            continue
        ids = re.match(r'^((?:[0-9a-f]{12} ?)+)\s', line.strip() + ' ')
        if ids and current:
            for sid in ids.group(1).split():
                picks[sid] = SECTIONS[current]
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
        date = (show or {}).get('ShowDate') or ''
        if show is None:
            skipped.append(f'{sid}: no such record')
        elif value is None:
            skipped.append(f'{sid} {show["Artist"]} {date}: not sure, left as it is')
        elif show.get('DatePrecision'):
            skipped.append(f'{sid} {show["Artist"]} {date}: already {show["DatePrecision"]}')
        elif not re.fullmatch(r'\d{4}-\d{2}-01', date):
            skipped.append(f'{sid} {show["Artist"]} {date}: not on the 1st')
        else:
            plan.append((show, value))
    for show, value in plan:
        print(f'  {show["ShowID"]}  {show["Artist"]} · {show["ShowDate"]}  ->  {value}')
    for line in skipped:
        print(f'  skip {line}')
    print(f'{len(plan)} to write, {len(skipped)} skipped')
    if '--apply' not in sys.argv:
        print('Dry run. Add --apply to write.')
        return
    for show, value in plan:
        show['DatePrecision'] = value
        what = 'the day is real' if value == 'day' else 'only the month is known'
        note = f"DATE PRECISION ({today}): {what} (DatePrecision {value}), the owner's call on the date-precision review (tools/date-precision)."
        prev = (show.get('PrivateNotes') or '').rstrip()
        show['PrivateNotes'] = f'{prev}\n\n{note}' if prev else note
    out = json.dumps(shows, indent=2, ensure_ascii=False) + '\n'
    assert '�' not in out
    open(SHOWS, 'w', encoding='utf-8').write(out)
    print(f'Wrote {len(plan)}. Next: python3 scripts/health-check.py, commit, python3 tools/date-precision/build.py')


if __name__ == '__main__':
    main()

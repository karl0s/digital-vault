"""Writes the setlist research review's picks into public/shows.json.

    python3 tools/setlist-research/apply_review.py picks.txt            # dry run
    python3 tools/setlist-research/apply_review.py picks.txt --apply

picks.txt is the research review's "Copy for Claude Code" export (tools/setlist-research/review.py).
An added show gets the songs as the page's box held them, in house format, and a PrivateNotes note
naming the sources that agreed. A show left blank gets a note carrying a fingerprint of the
research it was judged on (`research <hash>`): review.py hides it while the research is unchanged,
and shows it again, as new evidence, if a later round changes it. Only a record with no setlist is
written. Nothing else changes.
"""
import datetime, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from review import ANSWERED, REPO, RESULTS, fingerprint, sites  # noqa: E402

SHOWS = os.path.join(REPO, 'public', 'shows.json')
# The review page the picks were made on: research that changed after it was built wasn't seen.
PAGE = os.path.expanduser('~/VaultShots/reports/setlist-research.html')
PAGE_BUILT = os.path.getmtime(PAGE) if os.path.exists(PAGE) else 0


def tidy(setlist):
    return '; '.join(x.strip() for x in setlist.split(';') if x.strip())


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    add, leave, section = {}, set(), None
    for line in open(sys.argv[1], encoding='utf-8').read().splitlines():
        head = re.match(r'^(ADD|LEAVE BLANK)\b', line.strip())
        if head:
            section = head.group(1)
            continue
        m = re.match(r'^([0-9a-f]{12})\s', line.strip() + ' ')
        if m and section == 'ADD' and '  ::  ' in line:
            add[m.group(1)] = tidy(line.split('  ::  ', 1)[1])
        elif m and section == 'LEAVE BLANK':
            leave.add(m.group(1))
    raw = open(SHOWS, encoding='utf-8').read()
    shows = json.loads(raw)
    if json.dumps(shows, indent=2, ensure_ascii=False) + '\n' != raw:
        sys.exit('shows.json is not in its usual format; not touching it')
    today = datetime.date.today().isoformat()
    plan = []
    for s in shows:
        sid = s['ShowID']
        if sid not in add and sid not in leave:
            continue
        if (s.get('Setlist') or '').strip():
            print(f"  skipped, has a setlist now: {sid} {s['Artist']}")
            continue
        path = os.path.join(RESULTS, f'{sid}.json')
        r = json.load(open(path)) if os.path.exists(path) else {}
        urls = [x.get('url') for x in r.get('sources') or [] if x.get('agrees') and x.get('url')][:4]
        if sid in add and add[sid]:
            plan.append((s, add[sid], f"SETLIST ({today}): from web research, {len(sites(r))} independent sources agreeing ({', '.join(urls)}); {ANSWERED} ({today})."))
        elif sid in leave and os.path.exists(path) and os.path.getmtime(path) > PAGE_BUILT:
            print(f"  not noted, its research changed after the page was built, so it will be asked again: {sid} {s['Artist']}")
        elif sid in leave:
            plan.append((s, None, f"SETLIST RESEARCH ({today}): left blank, {ANSWERED} ({today}); research {fingerprint(r)}: {r.get('status', '?')}, {len(sites(r))} agreeing source(s)."))
    for s, new, _ in plan[:8]:
        print(f"  {s['ShowID']}  {s['Artist']}  ->  {(new or '(left blank; noted)')[:100]}")
    print(f'{sum(1 for _, n, _ in plan if n)} setlists to write; {sum(1 for _, n, _ in plan if not n)} left blank, noted' + (' (first eight shown)' if len(plan) > 8 else ''))
    if '--apply' not in sys.argv:
        print('Dry run. Add --apply to write.')
        return
    for s, new, note in plan:
        if new:
            s['Setlist'] = new
        prev = (s.get('PrivateNotes') or '').rstrip()
        s['PrivateNotes'] = f'{prev}\n\n{note}' if prev else note
    out = json.dumps(shows, indent=2, ensure_ascii=False) + '\n'
    assert '�' not in out
    open(SHOWS, 'w', encoding='utf-8').write(out)
    print('Written. Next: the taper check, the health check, then rebuild the pages.')


if __name__ == '__main__':
    main()

"""Writes the broadcaster review's picks into public/shows.json.

    python3 tools/broadcaster/apply.py picks.txt            # dry run
    python3 tools/broadcaster/apply.py picks.txt --apply

picks.txt is the review page's "Copy for Claude Code" export (tools/broadcaster/build.py). Each
accepted row's channel goes into `Broadcaster`, only where the record has none; the evidence
is re-drafted from the record, so the note says where the name came from. Nothing else changes.
"""
import datetime, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build import REPO, draft  # noqa: E402

SHOWS = os.path.join(REPO, 'public', 'shows.json')


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    accepted, section = set(), None
    for line in open(sys.argv[1], encoding='utf-8').read().splitlines():
        head = re.match(r'^(ACCEPT|LEAVE BLANK)', line.strip())
        if head:
            section = head.group(1)
            continue
        m = re.match(r'^([0-9a-f]{12})\s', line.strip() + ' ')
        if m and section == 'ACCEPT':
            accepted.add(m.group(1))
    raw = open(SHOWS, encoding='utf-8').read()
    shows = json.loads(raw)
    if json.dumps(shows, indent=2, ensure_ascii=False) + '\n' != raw:
        sys.exit('shows.json is not in its usual format; not touching it')
    today = datetime.date.today().isoformat()
    plan = []
    for s in shows:
        if s['ShowID'] in accepted and not s.get('Broadcaster'):
            d = draft(s)
            if d and d['name']:
                plan.append((s, d))
    for s, d in plan[:5]:
        print(f"  {s['ShowID']}  {s['Artist']}  ->  {d['name']}  ({d['where']})")
    print(f'{len(plan)} to write' + (' (first five shown)' if len(plan) > 5 else ''))
    if '--apply' not in sys.argv:
        print('Dry run. Add --apply to write.')
        return
    for s, d in plan:
        s['Broadcaster'] = d['name']
        note = f"BROADCASTER ({today}): {d['name']}, the owner's pick on the broadcaster review; named in the record's {d['where'].lower()}."
        prev = (s.get('PrivateNotes') or '').rstrip()
        s['PrivateNotes'] = f'{prev}\n\n{note}' if prev else note
    out = json.dumps(shows, indent=2, ensure_ascii=False) + '\n'
    assert '�' not in out
    open(SHOWS, 'w', encoding='utf-8').write(out)
    print(f'Wrote {len(plan)}. Next: the health check, commit; then show Broadcaster on the site.')


if __name__ == '__main__':
    main()

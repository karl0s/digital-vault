"""Writes the generation review's picks into public/shows.json.

    python3 tools/generation/apply.py picks.txt            # dry run
    python3 tools/generation/apply.py picks.txt --apply

picks.txt is the review page's "Copy for Claude Code" export (tools/generation/build.py), in the
lineage review's format. A row used as suggested gets the suggestion, re-drafted and checked
against the page's; an edited row gets Karl's text; a row left blank changes nothing. Only a record
with no `Generation` is written. Every answered row gets a note in PrivateNotes, so the page
doesn't ask again. Nothing else changes.
"""
import datetime, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build import ANSWERED, REPO, review  # noqa: E402

SHOWS = os.path.join(REPO, 'public', 'shows.json')


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    use, edited, keep, section = {}, {}, set(), None
    for line in open(sys.argv[1], encoding='utf-8').read().splitlines():
        head = re.match(r'^(USE|EDITED|LEAVE AS IT IS)', line.strip())
        if head:
            section = head.group(1)
            continue
        m = re.match(r'^([0-9a-f]{12})\s', line.strip() + ' ')
        if not m:
            continue
        if section == 'USE':
            h = re.search(r'#([0-9a-f]{6})\s*$', line)
            use[m.group(1)] = h.group(1) if h else ''
        elif section == 'EDITED' and '  ::  ' in line:
            edited[m.group(1)] = ' '.join(line.split('  ::  ', 1)[1].split())
        elif section == 'LEAVE AS IT IS':
            keep.add(m.group(1))
    raw = open(SHOWS, encoding='utf-8').read()
    shows = json.loads(raw)
    if json.dumps(shows, indent=2, ensure_ascii=False) + '\n' != raw:
        sys.exit('shows.json is not in its usual format; not touching it')
    today = datetime.date.today().isoformat()
    plan = []  # (show, new Generation or None, note)
    for s in shows:
        sid = s['ShowID']
        if s.get('Generation'):
            continue
        if sid in use:
            r = review(s)
            if not r or r['hash'] != use[sid] or not r['suggestion']:
                print(f"  not written, its suggestion has changed since the page was made: {sid} {s['Artist']}")
                continue
            plan.append((s, r['suggestion'], f"GENERATION ({today}): from the record's own sidecar text (Notes), {ANSWERED}."))
        elif sid in edited and edited[sid]:
            plan.append((s, edited[sid], f"GENERATION ({today}): as the owner wrote it, {ANSWERED}."))
        elif sid in keep:
            plan.append((s, None, f"GENERATION ({today}): left blank, {ANSWERED}."))
    changes = [(s, new) for s, new, _ in plan if new is not None]
    for s, new in changes:
        print(f"  {s['ShowID']}  {s['Artist']}  ->  {new}")
    print(f'{len(changes)} to write; {len(plan) - len(changes)} left blank, noted')
    if '--apply' not in sys.argv:
        print('Dry run. Add --apply to write.')
        return
    for s, new, note in plan:
        if new is not None:
            s['Generation'] = new
        prev = (s.get('PrivateNotes') or '').rstrip()
        s['PrivateNotes'] = f'{prev}\n\n{note}' if prev else note
    out = json.dumps(shows, indent=2, ensure_ascii=False) + '\n'
    assert '�' not in out
    open(SHOWS, 'w', encoding='utf-8').write(out)
    print(f'Wrote {len(changes)}. Next: the health check, then rebuild the page.')


if __name__ == '__main__':
    main()

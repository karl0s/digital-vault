"""Writes the lineage review's picks into public/shows.json.

    python3 tools/lineage/apply.py picks.txt            # dry run
    python3 tools/lineage/apply.py picks.txt --apply

picks.txt is the review page's "Copy for Claude Code" export (tools/lineage/build.py). A row used
as suggested gets the suggestion, re-drafted from the record and checked against the page's (so a
record that changed since is skipped); an edited row gets Karl's text as he wrote it; a row left as
it is changes nothing. Every answered row gets a note in PrivateNotes — the old Lineage kept there
where it changed — so the page doesn't ask again. Nothing else changes.
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
    plan = []  # (show, new Lineage or None, note)
    for s in shows:
        sid, old = s['ShowID'], s.get('Lineage') or ''
        was = f'; was "{old}"' if old else ''
        if sid in use:
            r = review(s)
            if not r or r['hash'] != use[sid]:
                print(f"  not written, its suggestion has changed since the page was made: {sid} {s['Artist']}")
                continue
            plan.append((s, r['suggestion'], f"LINEAGE ({today}): from the record's own sidecar text (Notes), {ANSWERED}{was}."))
        elif sid in edited and edited[sid]:
            plan.append((s, edited[sid], f"LINEAGE ({today}): as the owner wrote it, {ANSWERED}{was}."))
        elif sid in keep:
            plan.append((s, None, f"LINEAGE ({today}): left as it was, {ANSWERED}."))
    changes = [(s, new) for s, new, _ in plan if new is not None]
    for s, new in changes[:5]:
        print(f"  {s['ShowID']}  {s['Artist']}  ->  {new[:110]}")
    print(f'{len(changes)} to write' + (' (first five shown)' if len(changes) > 5 else '') + f'; {len(plan) - len(changes)} left as they are, noted')
    if '--apply' not in sys.argv:
        print('Dry run. Add --apply to write.')
        return
    for s, new, note in plan:
        if new is not None:
            s['Lineage'] = new
        prev = (s.get('PrivateNotes') or '').rstrip()
        s['PrivateNotes'] = f'{prev}\n\n{note}' if prev else note
    out = json.dumps(shows, indent=2, ensure_ascii=False) + '\n'
    assert '�' not in out
    open(SHOWS, 'w', encoding='utf-8').write(out)
    print(f'Wrote {len(changes)}, noted {len(plan) - len(changes)} left as they are. Next: the taper redaction (dry run), the health check, then rebuild the page.')


if __name__ == '__main__':
    main()

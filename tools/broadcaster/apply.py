"""Writes the broadcaster review's picks into public/shows.json.

    python3 tools/broadcaster/apply.py picks.txt            # dry run
    python3 tools/broadcaster/apply.py picks.txt --apply

picks.txt is the review page's "Copy for Claude Code" export (tools/broadcaster/build.py). Each
accepted row's channel goes into `Broadcaster`, only where the record has none; the evidence
is re-drafted from the record, so the note says where the name came from. A channel Karl typed
from a still's logo ("SET TO") is written as he typed it; a single character is a stray key and
is not, and a name the page doesn't know (a half-typed "nt") is held back and listed until he
confirms it: `--allow="NTR"` (repeatable) writes it. A row he left blank gets a note in
PrivateNotes, so the page doesn't ask again. Nothing else changes.
"""
import datetime, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build import CHANNELS, LEFT_BLANK, REPO, SHOWS as PROGRAMMES, draft  # noqa: E402

SHOWS = os.path.join(REPO, 'public', 'shows.json')


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    accepted, typed, blank, section = {}, {}, set(), None
    for line in open(sys.argv[1], encoding='utf-8').read().splitlines():
        head = re.match(r'^(ACCEPT|SET TO|LEAVE BLANK)', line.strip())
        if head:
            section = head.group(1)
            continue
        m = re.match(r'^([0-9a-f]{12})\s', line.strip() + ' ')
        # "<ShowID>  <channel>  <Artist · date>": two spaces apart, as the page writes it.
        name = line.strip().split('  ')[1].strip() if m and '  ' in line.strip() else ''
        if m and section == 'ACCEPT':
            accepted[m.group(1)] = name
        elif m and section == 'SET TO' and len(name) < 2:
            print(f'  not written, not a channel: {line.strip()!r}')
        elif m and section == 'SET TO':
            typed[m.group(1)] = name
        elif m and section == 'LEAVE BLANK':
            blank.add(m.group(1))
    raw = open(SHOWS, encoding='utf-8').read()
    shows = json.loads(raw)
    if json.dumps(shows, indent=2, ensure_ascii=False) + '\n' != raw:
        sys.exit('shows.json is not in its usual format; not touching it')
    today = datetime.date.today().isoformat()
    # Names the page offered (its datalist), any already on a record, and those confirmed here.
    allowed = [a.split('=', 1)[1] for a in sys.argv if a.startswith('--allow=')]
    known = {n.lower(): n for n in [n for _, n in CHANNELS if n] + [f'France {k}' for k in '234'] + list(PROGRAMMES.values())
             + [x['Broadcaster'] for x in shows if x.get('Broadcaster')] + allowed}
    for sid, name in list(typed.items()):
        if name.lower() in known:
            typed[sid] = known[name.lower()]
        else:
            print(f'  held, not a channel the page knows: {sid}  {name!r}')
            del typed[sid]
    plan = []
    for s in shows:
        if s.get('Broadcaster'):
            continue
        if s['ShowID'] in typed:
            plan.append((s, dict(name=typed[s['ShowID']], where='')))
        elif s['ShowID'] in accepted:
            d = draft(s)
            if d and d['name'] and d['name'] == accepted[s['ShowID']]:
                plan.append((s, d))
            else:
                print(f"  not written, the suggestion has changed since the page was made: {s['ShowID']} {s['Artist']}")
    left = [s for s in shows if s['ShowID'] in blank and not s.get('Broadcaster') and LEFT_BLANK not in (s.get('PrivateNotes') or '')]
    for s, d in plan[:5]:
        print(f"  {s['ShowID']}  {s['Artist']}  ->  {d['name']}  ({d['where'] or 'typed from the stills'})")
    print(f'{len(plan)} to write' + (' (first five shown)' if len(plan) > 5 else '') + f'; {len(left)} left blank, noted')
    if '--apply' not in sys.argv:
        print('Dry run. Add --apply to write.')
        return
    for s, d in plan:
        s['Broadcaster'] = d['name']
        note = (f"BROADCASTER ({today}): {d['name']}, the owner's pick on the broadcaster review; named in the record's {d['where'].lower()}."
                if d['where'] else f"BROADCASTER ({today}): {d['name']}, typed by the owner from the logo on the record's stills (broadcaster review).")
        prev = (s.get('PrivateNotes') or '').rstrip()
        s['PrivateNotes'] = f'{prev}\n\n{note}' if prev else note
    for s in left:
        note = f"BROADCASTER ({today}): {LEFT_BLANK}."
        prev = (s.get('PrivateNotes') or '').rstrip()
        s['PrivateNotes'] = f'{prev}\n\n{note}' if prev else note
    out = json.dumps(shows, indent=2, ensure_ascii=False) + '\n'
    assert '�' not in out
    open(SHOWS, 'w', encoding='utf-8').write(out)
    print(f'Wrote {len(plan)}, noted {len(left)} left blank. Next: the health check, then rebuild the page (build.py).')


if __name__ == '__main__':
    main()

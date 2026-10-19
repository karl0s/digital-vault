"""Writes the missing-setlists report's picks into public/shows.json.

    python3 tools/setlist-research/apply_report.py picks.txt            # dry run
    python3 tools/setlist-research/apply_report.py picks.txt --apply

picks.txt is the report page's "Copy for Claude Code" export (tools/setlist-research/report.py).

  ADD FROM INFO FILE        the setlist as the page's box held it, from the record's own info file
  SAME SHOW, COPY           the other copy's setlist, as it stands
  … COPY MARKED INCOMPLETE  the same, ending " (incomplete)": this copy is longer
  SAME SHOW, DON'T COPY     no setlist; noted 'Setlist NOT copied'
  DIFFERENT SHOWS           no setlist; noted 'not the same show as X'
  LEAVE BLANK               no setlist; noted, so the page doesn't ask again
  MARK AS DOCUMENTARY       ContentType "Documentary" (the capture identified it from the picture)

Only a record with no setlist is written. The notes use the missing-setlists tool's own words, so
neither page asks twice. Nothing else changes.
"""
import datetime, json, os, re, sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SHOWS = os.path.join(REPO, 'public', 'shows.json')
SECTIONS = {'ADD FROM INFO FILE': 'add', 'LEAVE BLANK': 'leave', 'MARK AS DOCUMENTARY': 'doc', 'SAME SHOW, COPY MARKED INCOMPLETE': 'incomplete',
            'SAME SHOW, COPY': 'copy', "SAME SHOW, DON'T COPY": 'nocopy', 'DIFFERENT SHOWS': 'different'}


def tidy(setlist):
    """House format: '; ' between songs, no empties."""
    return '; '.join(x.strip() for x in setlist.split(';') if x.strip())


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    picks, section = {}, None
    for line in open(sys.argv[1], encoding='utf-8').read().splitlines():
        head = next((v for k, v in sorted(SECTIONS.items(), key=lambda kv: -len(kv[0])) if line.strip().startswith(k)), None)
        if head:
            section = head
            continue
        m = re.match(r'^([0-9a-f]{12})\s', line.strip() + ' ')
        if not m or not section:
            continue
        text = line.split('  ::  ', 1)[1].strip() if '  ::  ' in line else ''
        twin = re.search(r'<-\s+([0-9a-f]{12})\s*$', line)
        picks[m.group(1)] = (section, text, twin.group(1) if twin else '')
    raw = open(SHOWS, encoding='utf-8').read()
    shows = json.loads(raw)
    if json.dumps(shows, indent=2, ensure_ascii=False) + '\n' != raw:
        sys.exit('shows.json is not in its usual format; not touching it')
    by = {s['ShowID']: s for s in shows}
    today = datetime.date.today().isoformat()
    review = f"the owner's call in the setlists report ({today})"
    mins = lambda s: round(float(s.get('DurationSec') or 0) / 60)
    plan = []  # (show, new setlist or None, note)
    for sid, (kind, text, twin) in picks.items():
        s = by.get(sid)
        if not s or (s.get('Setlist') or '').strip():
            print(f'  skipped, has a setlist now or not found: {sid}')
            continue
        o = by.get(twin)
        where = f"{twin} ({o.get('ShowDate') or 'undated'}, {o.get('VenueName') or o.get('EventOrFestival') or ''})" if o else twin
        if kind == 'doc':
            plan.append((s, None, f"CONTENT TYPE ({today}): Documentary — the capture identified it from the picture as a documentary (interviews and archive clips, see above); {review}."))
        elif kind == 'add' and text:
            source = 'the song captions the capture read on screen' if s.get('ShowID') == '90c54e21e6ba' else "the record's own info file (Notes), read by hand"
            plan.append((s, tidy(text), f"SETLIST ({today}): from {source}; {review}."))
        elif kind in ('copy', 'incomplete') and o and (o.get('Setlist') or '').strip():
            new = tidy(o['Setlist'])
            if kind == 'incomplete' and not new.endswith('(incomplete)'):
                new += ' (incomplete)'
            plan.append((s, new, f"SETLIST ({today}): copied from {where}, another recording of this show — {review}."
                                 f" Running time {mins(s)} min here, {mins(o)} min there{'; this copy is longer, so the list is marked (incomplete)' if kind == 'incomplete' else ''}."))
        elif kind == 'nocopy' and o:
            plan.append((s, None, f"SETLIST CHECK ({today}): the same show as {where}, {review}; Setlist NOT copied — {mins(s)} min here, {mins(o)} min there, so this cut can't hold all its songs."))
        elif kind == 'different' and o:
            plan.append((s, None, f"SETLIST CHECK ({today}): not the same show as {where}, {review}; that record's setlist was not copied."))
        elif kind == 'leave':
            plan.append((s, None, f"SETLIST CHECK ({today}): left blank, {review}."))
    for s, new, _ in plan:
        print(f"  {s['ShowID']}  {s['Artist']}  ->  {new if new else '(no setlist; noted)'}")
    print(f'{sum(1 for _, n, _ in plan if n)} setlists to write; {sum(1 for _, n, _ in plan if not n)} notes only')
    if '--apply' not in sys.argv:
        print('Dry run. Add --apply to write.')
        return
    for s, new, note in plan:
        if new:
            s['Setlist'] = new
        if note.startswith('CONTENT TYPE'):
            s['ContentType'] = 'Documentary'
        prev = (s.get('PrivateNotes') or '').rstrip()
        s['PrivateNotes'] = f'{prev}\n\n{note}' if prev else note
    out = json.dumps(shows, indent=2, ensure_ascii=False) + '\n'
    assert '�' not in out
    open(SHOWS, 'w', encoding='utf-8').write(out)
    print('Written. Next: the taper redaction (dry run), the health check, then rebuild the pages.')


if __name__ == '__main__':
    main()

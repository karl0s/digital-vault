"""Missing setlists: renders ~/VaultShots/reports/missing-setlists.html and .csv.

Every show on the site with no setlist, by kind (documentaries and multi-act
masters have none by design), then for each live show the other recordings of
the same artist that DO have a setlist and may be the same show:
  strong   — same day, same event/venue/city, running times within 25%
  possible — anything else that overlaps (a different cut, a month- or
             year-only date, an undated copy)
The owner answers each pair A (different) or B (same — copy the setlist) and
pastes the "Copy for Claude Code" export back into a session.

Answers live on the records, so a rebuild never asks twice:
  'SETLIST (date): copied from X'       — a B: the two are one show, so a
                                          ruling against either covers both
  'not the same show as X'              — an A
  'Setlist NOT copied'                  — same show, songs still to confirm
Read-only on the repo. Rebuild any time:

    python3 tools/missing-setlists/build.py && open ~/VaultShots/reports/missing-setlists.html
"""
import collections, csv, hashlib, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
REPORTS = os.path.expanduser('~/VaultShots/reports')
OUT, CSV = os.path.join(REPORTS, 'missing-setlists.html'), os.path.join(REPORTS, 'missing-setlists.csv')

shows = json.load(open(os.path.join(REPO, 'public', 'shows.json'), encoding='utf-8'))
manifest = json.load(open(os.path.join(REPO, 'public', 'image-manifest.json'), encoding='utf-8'))
by = {s['ShowID']: s for s in shows}
empty = lambda s: not (s.get('Setlist') or '').strip()
masters = {s['ParentShowID'] for s in shows if s.get('ParentShowID')}
visible = [s for s in shows if s.get('Hidden') != 'Yes']
docs = [s for s in visible if empty(s) and s.get('ContentType') == 'Documentary']
mast = [s for s in visible if empty(s) and s['ShowID'] in masters and s.get('ContentType') != 'Documentary']
live = [s for s in visible if empty(s) and s.get('ContentType') != 'Documentary' and s['ShowID'] not in masters]

# Same-show clusters from earlier B answers.
parent = {}
def find(x):
    while parent.get(x, x) != x:
        x = parent[x]
    return x
for s in shows:
    for r in re.findall(r'SETLIST \([0-9-]+\): copied from ([0-9a-f]{12})', s.get('PrivateNotes') or ''):
        parent[find(s['ShowID'])] = find(r)
def cluster(x):
    return {k for k in by if find(k) == find(x)}

with_setlist = collections.defaultdict(list)
for s in shows:
    if not empty(s):
        with_setlist[s['Artist']].append(s)

def n(v): return (v or '').strip().lower()
def minutes(s):
    try: return int(s.get('DurationSec') or 0) / 60
    except ValueError: return 0
def exact_day(s):
    x = s.get('ShowDate') or ''
    return len(x) == 10 and not x.endswith('-01')

def candidates(s):
    notes = s.get('PrivateNotes') or ''
    if 'Setlist NOT copied' in notes:
        return []
    ruled = set()
    for r in re.findall(r'not the same show as ([0-9a-f]{12})', notes):
        ruled |= cluster(r)
    out = []
    for c in with_setlist.get(s['Artist'], []):
        if c['ShowID'] == s['ShowID'] or c['ShowID'] in ruled:
            continue
        ev = n(s.get('EventOrFestival')) and n(s.get('EventOrFestival')) == n(c.get('EventOrFestival'))
        ven = n(s.get('VenueName')) and n(s.get('VenueName')) == n(c.get('VenueName'))
        city = n(s.get('City')) and n(s.get('City')) == n(c.get('City'))
        sd, cd = s.get('ShowDate') or '', c.get('ShowDate') or ''
        a, b = minutes(s), minutes(c)
        close = a > 0 and b > 0 and min(a, b) / max(a, b) >= 0.75
        reason = strength = None
        if sd and sd == cd and exact_day(s) and (ev or ven or city):
            reason = f"same day ({sd}) + same {'event' if ev else 'venue' if ven else 'city'}"
            strength = 'strong' if close else 'possible'
            if not close:
                reason += '; running times differ — a different cut, so the songs may differ'
        elif sd and sd == cd and exact_day(s):
            reason, strength = f'same day ({sd}); event/place differ or missing', 'possible'
        elif sd[:4] and sd[:4] == cd[:4] and (ev or ven):
            reason = f"same year ({sd[:4]}) + same {'event' if ev else 'venue'}; " + \
                ('month/year-only date' if not exact_day(s) or not exact_day(c) else 'different days')
            strength = 'possible'
        elif not sd and (ev or ven):
            reason, strength = f"undated + same {'event' if ev else 'venue'}", 'possible'
        if reason:
            out.append({'id': c['ShowID'], 'strength': strength, 'reason': reason})
    out.sort(key=lambda x: (x['strength'] != 'strong', abs(minutes(by[x['id']]) - minutes(s))))
    return out[:3]

def image(s):
    c = s.get('ChecksumSHA1') or ''
    slots = manifest.get(c, [])
    return f'file://{REPO}/public/images/{c}_0{1 if 1 in slots else slots[0]}.jpg' if slots else ''

def row(s):
    p = by.get(s.get('ParentShowID') or '')
    notes = s.get('PrivateNotes') or ''
    return {'id': s['ShowID'], 'artist': s['Artist'], 'date': s.get('ShowDate') or '', 'event': s.get('EventOrFestival') or '',
            'venue': s.get('VenueName') or '', 'place': ', '.join(x for x in [s.get('City'), s.get('Country')] if x),
            'type': s.get('RecordingType') or '', 'mins': round(minutes(s)), 'folder': s.get('FolderName') or '', 'img': image(s),
            'cut': (f"cut from {p['Artist']} — {p.get('EventOrFestival') or p.get('VenueName') or p.get('FolderName')} "
                    f"({s.get('SegmentStart')}–{s.get('SegmentEnd')})" if p else ''),
            'pending': 'Setlist NOT copied' in notes,
            'songs': [x.strip() for x in (s.get('Setlist') or '').split(';') if x.strip()]}

key = lambda r: (r['artist'].lower(), r['date'] or '9999', r['id'])
pairs, final = [], []
for s in live:
    cs = candidates(s)
    if cs:
        pairs.append({'miss': row(s), 'cands': [{**row(by[c['id']]), 'strength': c['strength'], 'reason': c['reason']} for c in cs]})
    else:
        final.append(row(s))
pairs.sort(key=lambda p: (p['cands'][0]['strength'] != 'strong', key(p['miss'])))
final.sort(key=key)
answered = sum(1 for s in shows for _ in re.findall(r'not the same show as|SETLIST \([0-9-]+\): copied from', s.get('PrivateNotes') or ''))
summary = {'site': len(visible), 'none': len(docs) + len(mast) + len(live), 'docs': len(docs), 'masters': len(mast),
           'live': len(live), 'pairs': len(pairs), 'strong': sum(p['cands'][0]['strength'] == 'strong' for p in pairs),
           'final': len(final), 'answered': answered, 'byArtist': collections.Counter(r['artist'] for r in final).most_common()}
# Saved answers are keyed to this exact set of questions, so a rebuild with new ones starts clean.
qkey = hashlib.sha1('|'.join(p['miss']['id'] + '>' + p['cands'][0]['id'] for p in pairs).encode()).hexdigest()[:10]
data = {'summary': summary, 'pairs': pairs, 'final': final, 'key': qkey,
        'docs': sorted((row(s) for s in docs), key=key), 'masters': sorted((row(s) for s in mast), key=key)}

os.makedirs(REPORTS, exist_ok=True)
with open(CSV, 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['ShowID', 'Artist', 'ShowDate', 'Event', 'Venue', 'Place', 'Minutes', 'Folder', 'Cut from', 'Other version with a setlist', 'Match'])
    for p in pairs:
        r, c = p['miss'], p['cands'][0]
        w.writerow([r['id'], r['artist'], r['date'], r['event'], r['venue'], r['place'], r['mins'], r['folder'], r['cut'], c['id'], f"{c['strength']}: {c['reason']}"])
    for r in final:
        w.writerow([r['id'], r['artist'], r['date'], r['event'], r['venue'], r['place'], r['mins'], r['folder'], r['cut'],
                    'same show as a recording with a setlist; songs to confirm' if r['pending'] else '', ''])
page = open(os.path.join(HERE, 'template.html'), encoding='utf-8').read()
page = page.replace('__REPO__', REPO).replace('__DATA__', json.dumps(data, ensure_ascii=False).replace('</', '<\\/'))
open(OUT, 'w', encoding='utf-8').write(page)
print(f"wrote {OUT} and {CSV}: {summary['live']} live shows without a setlist — {summary['pairs']} to judge, {summary['final']} with nothing to copy")

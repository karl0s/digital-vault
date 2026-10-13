"""Artist portrait picker: renders ~/VaultShots/reports/artist-portraits.html.

Every artist, the picture their search-results tile shows now (the pick in
src/lib/portraits.ts, else the newest show's slot 1), and every image of every
show to choose from. Picks save in the browser; "Copy for Claude Code" exports
them to paste into a session, which writes them into ARTIST_PORTRAITS.
Read-only on the repo. Rebuild after images or shows change:

    python3 tools/artist-portraits/build.py && open ~/VaultShots/reports/artist-portraits.html
"""
import json, re, os, unicodedata
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.expanduser('~/VaultShots/reports/artist-portraits.html')

shows = [s for s in json.load(open(f'{REPO}/public/shows.json')) if s.get('Hidden') != 'Yes']
manifest = json.load(open(f'{REPO}/public/image-manifest.json'))

# Picks already live in src/lib/portraits.ts seed the page.
src = open(f'{REPO}/src/lib/portraits.ts').read()
seed = {m[1].replace("\\'", "'"): {'show': m[2], 'slot': int(m[3])}
        for m in re.findall(r"""(['"])((?:(?!\1)[^\\]|\\.)+)\1\s*:\s*\{\s*show:\s*'([0-9a-f]+)',\s*slot:\s*(\d)\s*\}""", src)}

def dated(s):
    d = s.get('ShowDate') or ''
    return d if re.match(r'^\d{4}', d) else ''

# Mirrors newestFirst in src/lib/portraits.ts exactly.
def newest_first_key(s):
    d = dated(s)
    return (0, ''.join(chr(0x10FFFF - ord(c)) for c in d), s['ShowID']) if d else (1, '', s['ShowID'])

by_artist = {}
for s in shows:
    by_artist.setdefault(s['Artist'], []).append(s)

def fold(v):
    return unicodedata.normalize('NFD', v).encode('ascii', 'ignore').decode().casefold()

artists = []
for name in sorted(by_artist, key=fold):
    ss = sorted(by_artist[name], key=newest_first_key)
    cands = []
    default = None
    for s in ss:
        c = s.get('ChecksumSHA1')
        if not c: continue
        slots = sorted(manifest.get(c, []))
        if default is None and 1 in slots:
            default = len(cands)
        place = s.get('EventOrFestival') or s.get('VenueName') or ', '.join(x for x in [s.get('City'), s.get('Country')] if x)
        for slot in slots:
            cands.append({'id': s['ShowID'], 'c': c, 's': slot, 'd': dated(s), 'p': place, 'z': s.get('TotalSizeHuman') or ''})
    artists.append({'n': name, 'k': len(ss), 'cands': cands, 'def': default})

data = json.dumps({'artists': artists, 'seed': seed}, ensure_ascii=False).replace('</', '<\\/')
page = open(os.path.join(HERE, 'template.html')).read().replace('__REPO__', REPO)
open(OUT, 'w').write(page.replace('__DATA__', data))
total = sum(len(a['cands']) for a in artists)
print(f'wrote {OUT}: {len(artists)} artists, {total} images, {len(seed)} seeded picks, '
      f'{sum(1 for a in artists if a["def"] is None)} without a default')

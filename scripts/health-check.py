#!/usr/bin/env python3
"""
health-check.py

Validates the integrity of The Vault's show data, images, and manifests.
Run manually or automatically as a git pre-push hook.

Exit codes:
  0 — all checks passed (warnings are printed but don't block)
  1 — one or more errors found (blocks push if used as a hook)
"""

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOWS_JSON        = os.path.join(ROOT, 'public', 'shows.json')
MANIFEST_JSON     = os.path.join(ROOT, 'public', 'image-manifest.json')
IMAGES_DIR        = os.path.join(ROOT, 'public', 'images')
TEMP_DIR          = os.path.join(ROOT, 'public', 'images', 'temp-images')

ERRORS   = []
WARNINGS = []

def error(msg):   ERRORS.append(msg)
def warn(msg):    WARNINGS.append(msg)

def section(title):
    print(f'\n── {title} ──')

# ── 1. Load and validate JSON files ──────────────────────────────────────────

section('Loading files')

try:
    with open(SHOWS_JSON) as f:
        shows = json.load(f)
    print(f'  shows.json          {len(shows)} records')
except Exception as e:
    error(f'Failed to load shows.json: {e}')
    shows = []

try:
    with open(MANIFEST_JSON) as f:
        manifest = json.load(f)
    print(f'  image-manifest.json {len(manifest)} checksums')
except Exception as e:
    error(f'Failed to load image-manifest.json: {e}')
    manifest = {}

# ── 2. ShowDate format ────────────────────────────────────────────────────────

section('ShowDate format')
import re
from datetime import date as _date
bad_dates = []
for s in shows:
    d = s.get('ShowDate', '')
    if not d:
        continue
    m = re.match(r'^(\d{4})-(\d{2})-(\d{2})$', d)
    if not m:
        bad_dates.append((s['ShowID'], s.get('Artist',''), d))
        continue
    # Shape is not enough. "2000-00-00" matches the pattern and sat in the data
    # for months: it is not a real date, it breaks sorting, and CLAUDE.md forbids
    # exactly this placeholder. Only the calendar can reject it.
    try:
        _date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError as e:
        bad_dates.append((s['ShowID'], s.get('Artist',''), '%s (%s)' % (d, e)))

if bad_dates:
    for sid, artist, d in bad_dates:
        error(f'  Bad ShowDate format: {sid} {artist} → "{d}"')
else:
    print('  All dates are YYYY-MM-DD or blank — OK')

# ── 3. Required fields ────────────────────────────────────────────────────────

section('Required fields')
missing_fields = []
for s in shows:
    if not s.get('ShowID'):    missing_fields.append((s.get('ShowID','?'), 'ShowID missing'))
    if not s.get('Artist'):    missing_fields.append((s.get('ShowID','?'), 'Artist missing'))

if missing_fields:
    for sid, msg in missing_fields:
        error(f'  {sid}: {msg}')
else:
    print('  All records have ShowID and Artist — OK')

# ── 4. Duplicate ShowIDs ──────────────────────────────────────────────────────

section('Duplicate ShowIDs')
seen_ids = {}
for s in shows:
    sid = s.get('ShowID','')
    seen_ids[sid] = seen_ids.get(sid, 0) + 1
dupes = {k: v for k, v in seen_ids.items() if v > 1}
if dupes:
    for sid, count in dupes.items():
        error(f'  Duplicate ShowID: {sid} appears {count} times')
else:
    print(f'  No duplicate ShowIDs — OK')

# ── 5. Image manifest vs actual image files ───────────────────────────────────

section('Image manifest vs disk')
missing_images = []
for checksum, indices in manifest.items():
    for i in indices:
        fname = f'{checksum}_0{i}.jpg'
        fpath = os.path.join(IMAGES_DIR, fname)
        if not os.path.exists(fpath):
            missing_images.append(fname)

if missing_images:
    for f in missing_images[:20]:
        error(f'  Missing image file: {f}')
    if len(missing_images) > 20:
        error(f'  ... and {len(missing_images) - 20} more missing image files')
else:
    print(f'  All manifest image files exist on disk — OK')

# ── 6. Shows with checksums not in manifest ───────────────────────────────────

section('Shows → manifest coverage')
not_in_manifest = []
for s in shows:
    cs = s.get('ChecksumSHA1', '')
    if cs and cs not in manifest:
        not_in_manifest.append((s['ShowID'], s.get('Artist',''), cs[:12]))

if not_in_manifest:
    for sid, artist, cs_short in not_in_manifest:
        warn(f'  Checksum not in manifest: {sid} {artist} ({cs_short}...)')
else:
    print(f'  All show checksums are in the manifest — OK')

# ── 7. Orphaned images (on disk but not in manifest) ─────────────────────────

section('Orphaned images')
manifest_files = set()
for checksum, indices in manifest.items():
    for i in indices:
        manifest_files.add(f'{checksum}_0{i}.jpg')

disk_files = set()
for f in os.listdir(IMAGES_DIR):
    if f.endswith('.jpg') and '_0' in f:
        disk_files.add(f)

orphans = disk_files - manifest_files
if orphans:
    for f in sorted(orphans)[:10]:
        warn(f'  Orphaned image (on disk, not in manifest): {f}')
    if len(orphans) > 10:
        warn(f'  ... and {len(orphans) - 10} more orphaned images')
else:
    print(f'  No orphaned images — OK')

# ── 8. Temp checksum stubs ────────────────────────────────────────────────────

section('Temp checksum stubs')
temp_shows = [s for s in shows if 'TEMP CHECKSUM' in (s.get('Notes','') or '')]
if temp_shows:
    for s in temp_shows:
        warn(f'  Temp checksum: {s["ShowID"]} — {s.get("Artist","")} {s.get("EventOrFestival","") or s.get("City","")} {s.get("ShowDate","")}')
else:
    print('  No temp checksum stubs — OK')

# ── 9. Temp images folder ─────────────────────────────────────────────────────

section('Temp images folder')
if os.path.isdir(TEMP_DIR):
    leftover = [f for f in os.listdir(TEMP_DIR) if not f.startswith('.')]
    if leftover:
        warn(f'  Temp folder is not empty ({len(leftover)} files):')
        for f in leftover:
            warn(f'    {f}')
    else:
        print('  Temp folder is empty — OK')
else:
    print('  Temp folder does not exist — OK')

# ── 10. Shows missing images entirely ────────────────────────────────────────

section('Shows with no images')
no_images = []
for s in shows:
    cs = s.get('ChecksumSHA1','')
    if not cs:
        no_images.append((s['ShowID'], s.get('Artist',''), s.get('EventOrFestival','') or s.get('FolderName','')))

if no_images:
    for sid, artist, name in no_images:
        warn(f'  No checksum/images: {sid} {artist} — {name}')
else:
    print('  All shows have a checksum — OK')

# ── 11. EventOrFestival consistency ─────────────────────────────────────────

section('EventOrFestival consistency')

# Known bad values — deprecated variants that must not be re-introduced
BANNED_EVENT_VALUES = {
    # Letterman
    'Late Show w/ Letterman':           'David Letterman',
    'Late Show with David Letterman':   'David Letterman',
    'Late Show w/ David Letterman':     'David Letterman',
    # Jools Holland
    'Later... with Jools Holland':      'Jools Holland',
    'Later w/ Jools Holland':           'Jools Holland',
    # Tonight Show
    'The Tonight Show Starring Jimmy Fallon': 'Jimmy Fallon',
    'The Tonight Show w/ Fallon':       'Jimmy Fallon',
    'The Tonight Show':                 'Jay Leno',
    # Conan
    'Conan Show':                       "Conan O'Brien",
    'Conan':                            "Conan O'Brien",
    "Late Night w/ Conan O'Brien":      "Conan O'Brien",
    # Kimmel
    'Jimmy Kimmel Live':                'Jimmy Kimmel',
    # Carson Daly
    'Last Call w/ Carson Daly':         'Carson Daly',
    # Festivals
    'Les Eurockéennes':                 'Eurockéennes Festival',
    'Lowlands':                         'Lowlands Festival',
    'SWU Festival':                     'SWU Music & Arts Festival',
    'Nissan Live Sets':                 'Nissan Live Sets on Yahoo! Music',
    'Much Music Intimate and Interactive': 'Much Music Intimate & Interactive',
    'Live from the Basement':           'From the Basement',
}

# Patterns that are clearly garbage in EventOrFestival
import re as _re
event_issues = []
for s in shows:
    ev = s.get('EventOrFestival', '') or ''
    if not ev:
        continue
    sid = s['ShowID']
    artist = s.get('Artist', '')

    if ev in BANNED_EVENT_VALUES and BANNED_EVENT_VALUES[ev] is not None:
        event_issues.append(f'  Deprecated EventOrFestival: {sid} {artist} — "{ev}" → should be "{BANNED_EVENT_VALUES[ev]}"')
    elif _re.match(r'^\d{4}-\d{2}-\d{2}$', ev):
        event_issues.append(f'  Date in EventOrFestival: {sid} {artist} — "{ev}"')
    elif ev.startswith('----') or ev.startswith('=='):
        event_issues.append(f'  File content in EventOrFestival: {sid} {artist} — "{ev[:40]}"')

if event_issues:
    for issue in event_issues:
        warn(issue)
else:
    print('  No deprecated or garbage EventOrFestival values — OK')

# ── 12. Documentation currency ───────────────────────────────────────────────

section('Documentation currency')

import subprocess

# Check if README or CLAUDE.md mention the current show count
actual_count = len(shows)
doc_issues = []

for doc_path, doc_name in [('README.md', 'README'), ('CLAUDE.md', 'CLAUDE.md')]:
    full_path = os.path.join(ROOT, doc_path)
    if not os.path.exists(full_path):
        doc_issues.append(f'{doc_name} not found')
        continue

    with open(full_path) as f:
        doc_text = f.read()

    # Check if any show count (plural "shows") in the doc is >5% off from actual.
    # Exclude year-like numbers (1900–2029) to avoid false positives like "a 1996 show".
    import re as _re
    counts_found = [int(m) for m in _re.findall(r'\b(\d{3,4})\s+shows\b', doc_text, _re.IGNORECASE)
                    if not (1900 <= int(m) <= 2029)]
    for c in counts_found:
        if abs(c - actual_count) > max(5, actual_count * 0.02):
            doc_issues.append(f'{doc_name} mentions {c} shows but actual is {actual_count} — update may be needed')

# Check if any new component or hook files exist that aren't mentioned in README
readme_path = os.path.join(ROOT, 'README.md')
if os.path.exists(readme_path):
    with open(readme_path) as f:
        readme_text = f.read()

    for search_dir, label in [('components', 'component'), ('src/hooks', 'hook'), ('scripts', 'script')]:
        dir_path = os.path.join(ROOT, search_dir)
        if not os.path.isdir(dir_path):
            continue
        for fname in os.listdir(dir_path):
            if fname.startswith('.') or fname.startswith('_') or fname == '__pycache__':
                continue
            base = fname.rsplit('.', 1)[0]
            if base not in readme_text:
                doc_issues.append(f'{label} "{fname}" not mentioned in README — consider adding it')

# Check for uncommitted changes to docs themselves relative to last commit
try:
    result = subprocess.run(
        ['git', 'diff', '--name-only', 'HEAD', 'README.md', 'CLAUDE.md'],
        cwd=ROOT, capture_output=True, text=True
    )
    changed_docs = [l.strip() for l in result.stdout.splitlines() if l.strip()]
    if changed_docs:
        for d in changed_docs:
            warn(f'  {d} has uncommitted changes')
except Exception:
    pass

if doc_issues:
    for issue in doc_issues:
        warn(f'  {issue}')
else:
    print('  README and CLAUDE.md appear current — OK')

# ── 13. Setlist loss guard ───────────────────────────────────────────────────

section('Setlist loss guard')

# A setlist is expensive to recover and easy to destroy: a rewrite of shows.json
# that drops the field looks identical to one that never had it. This compares
# the working file against the last commit and BLOCKS a push when songs would
# disappear. Legitimate cases pass automatically - when a folder is split, the
# parent's songs move to the children, so any song still present on another
# record is not a loss.
import subprocess as _sp

def _songs(t):
    return [x.strip() for x in (t or '').split(';') if x.strip()]

def _norm_song(t):
    # Drop a trailing parenthetical before comparing: "(incomplete)", "(Acoustic)",
    # "(Prince cover)". Completing a setlist removes the "(incomplete)" marker from
    # the last song, and without this the guard reports that song as lost every
    # time a setlist is FIXED - punishing exactly the change it exists to protect.
    t = re.sub(r'\s*\([^()]*\)\s*$', '', (t or '').strip())
    return re.sub(r'[^a-z0-9]+', '', t.lower())

_head = _sp.run(['git', 'show', 'HEAD:public/shows.json'],
                capture_output=True, text=True, cwd=str(ROOT))
if _head.returncode != 0:
    print('  no committed shows.json to compare against — skipped')
else:
    try:
        _before = {x['ShowID']: x for x in json.loads(_head.stdout)}
    except Exception:
        _before = {}
    _by_id = {x['ShowID']: x for x in shows}
    _appf = os.path.join(ROOT, 'scripts', 'setlist-removals-approved.json')
    try:
        _approved = {k: v for k, v in json.load(open(_appf)).items() if not k.startswith('_')}
    except Exception:
        _approved = {}
    # Re-homing means the songs moved to a record that GAINED them in this change -
    # a split child, typically. Accepting a match against any record in the file is
    # far too loose: an artist plays the same songs every night, so dropping two real
    # tracks from one show is silently excused by another show that also plays them.
    _now_songs = set()
    for _s in shows:
        _sid2 = _s['ShowID']
        _old2 = _before.get(_sid2)
        _oldset = {_norm_song(x) for x in _songs((_old2 or {}).get('Setlist'))}
        for _x in _songs(_s.get('Setlist')):
            if _norm_song(_x) not in _oldset:      # new to THIS record
                _now_songs.add(_norm_song(_x))
    _losses = []
    for _sid, _old in _before.items():
        _o = _songs(_old.get('Setlist'))
        if not _o:
            continue
        _cur = _by_id.get(_sid)
        _n = _songs(_cur.get('Setlist')) if _cur else []
        _gone = [x for x in _o if _norm_song(x) not in {_norm_song(y) for y in _n}]
        # Anywhere else in the file counts as re-homed, not lost.
        _gone = [x for x in _gone if _norm_song(x) not in _now_songs]
        # Deliberate removals are acknowledged in scripts/setlist-removals-approved.json,
        # which forces the reason to be written down rather than silently bypassed.
        _ok = {_norm_song(x) for x in _approved.get(_sid, {}).get('entries', [])}
        _gone = [x for x in _gone if _norm_song(x) not in _ok]
        if _gone:
            _losses.append((_sid, _old.get('Artist', ''), len(_o), len(_n), _gone))
    if _losses:
        for _sid, _artist, _no, _nn, _gone in _losses:
            error(f'  Setlist songs would be LOST: {_sid} {_artist} '
                  f'({_no} -> {_nn} songs) — {"; ".join(_gone[:6])}'
                  + (f' … +{len(_gone) - 6} more' if len(_gone) > 6 else ''))
        print('  If a song is genuinely not in this recording, remove it in a commit whose')
        print('  message says so. If a folder was split, put the songs on the child records.')
    else:
        print('  No setlist songs lost against HEAD — OK')

# ── Summary ───────────────────────────────────────────────────────────────────

print('\n' + '═' * 60)
print(f'  ERRORS:   {len(ERRORS)}')
print(f'  WARNINGS: {len(WARNINGS)}')
print('═' * 60)

if WARNINGS:
    print('\nWARNINGS (will not block push):')
    for w in WARNINGS:
        print(f'  ⚠  {w}')

if ERRORS:
    print('\nERRORS (blocking):')
    for e in ERRORS:
        print(f'  ✗  {e}')
    print('\nHealth check FAILED. Fix errors before pushing.\n')
    sys.exit(1)
else:
    print('\nHealth check PASSED.\n')
    sys.exit(0)

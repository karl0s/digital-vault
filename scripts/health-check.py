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
bad_dates = []
for s in shows:
    d = s.get('ShowDate', '')
    if d and d != '' and not re.match(r'^\d{4}-\d{2}-\d{2}$', d):
        bad_dates.append((s['ShowID'], s.get('Artist',''), d))

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

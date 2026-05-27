#!/usr/bin/env python3
"""
Consistency audit for shows.json.

Section 1 — Festival/venue: shows at the same EventOrFestival should share
            identical City, Country, and VenueName.

Section 2 — Duplicate recordings: multiple recordings of the same show
            (same Artist + full ShowDate) should share identical
            EventOrFestival, VenueName, City, and Country.
"""

import json
from collections import defaultdict

with open('public/shows.json') as f:
    shows = json.load(f)

# ── helpers ───────────────────────────────────────────────────────────────────

def val(s, key):
    return s.get(key, '').strip()

def is_year_only(date):
    """YYYY-01-01 pattern — month and day are placeholders."""
    parts = date.split('-')
    return len(parts) == 3 and parts[1] == '01' and parts[2] == '01'

def is_month_only(date):
    """YYYY-MM-01 pattern — day is a placeholder."""
    parts = date.split('-')
    return len(parts) == 3 and parts[2] == '01' and parts[1] != '01'

def divergence(group, keys):
    """Return dict of key → sorted unique non-empty values when there are conflicts."""
    issues = {}
    for key in keys:
        values = {val(s, key) for s in group}
        non_empty = {v for v in values if v}
        empty_count = sum(1 for s in group if not val(s, key))
        if len(non_empty) > 1:
            issues[key] = ('conflict', sorted(non_empty))
        elif non_empty and empty_count > 0:
            issues[key] = ('missing', sorted(non_empty), empty_count)
    return issues

# ── Section 1: Festival/venue consistency ─────────────────────────────────────

festival_groups = defaultdict(list)
for s in shows:
    ev = val(s, 'EventOrFestival')
    if ev:
        festival_groups[ev].append(s)

festival_issues = []
for event, group in sorted(festival_groups.items()):
    issues = divergence(group, ['City', 'Country', 'VenueName'])
    if issues:
        festival_issues.append((event, group, issues))

# ── Section 2: Duplicate recording consistency ────────────────────────────────

dupe_groups = defaultdict(list)
for s in shows:
    date = val(s, 'ShowDate')
    artist = val(s, 'Artist')
    if date and artist:
        dupe_groups[(artist, date)].append(s)

dupe_issues = []
for (artist, date), group in sorted(dupe_groups.items()):
    if len(group) < 2:
        continue
    issues = divergence(group, ['EventOrFestival', 'VenueName', 'City', 'Country'])
    if issues:
        placeholder = is_year_only(date) or is_month_only(date)
        dupe_issues.append((artist, date, group, issues, placeholder))

# ── Report ─────────────────────────────────────────────────────────────────────

SEP = '=' * 72

print(f"\n{SEP}")
print(f"  CONSISTENCY AUDIT — {len(shows)} shows")
print(SEP)

# ── Section 1 ──
conflict_festivals = [(e, g, i) for e, g, i in festival_issues
                      if any(v[0] == 'conflict' for v in i.values())]
missing_festivals  = [(e, g, i) for e, g, i in festival_issues
                      if all(v[0] == 'missing' for v in i.values())
                      and not any(v[0] == 'conflict' for v in i.values())]

print(f"\n{'─'*72}")
print(f"  SECTION 1 · Festival/venue inconsistencies")
print(f"  {len(conflict_festivals)} events with conflicting values  |  "
      f"{len(missing_festivals)} events with missing values only")
print(f"{'─'*72}\n")

if conflict_festivals:
    print("  ── Conflicts (different non-empty values — definite errors) ──\n")
    for event, group, issues in conflict_festivals:
        print(f"  '{event}'  ({len(group)} shows)")
        for key, info in issues.items():
            if info[0] == 'conflict':
                print(f"    {key}: {info[1]}")
            else:
                print(f"    {key}: one value is {info[1]}  ({info[2]} shows missing)")
        print()

if missing_festivals:
    print("  ── Missing values (some shows have data, others blank) ──\n")
    for event, group, issues in missing_festivals:
        print(f"  '{event}'  ({len(group)} shows)")
        for key, info in issues.items():
            print(f"    {key}: {info[1]}  ({info[2]} of {len(group)} shows have blank)")
        print()

# ── Section 2 ──
real_dupes      = [(a, d, g, i) for a, d, g, i, ph in dupe_issues if not ph]
placeholder_dupes = [(a, d, g, i) for a, d, g, i, ph in dupe_issues if ph]

print(f"\n{'─'*72}")
print(f"  SECTION 2 · Duplicate recording inconsistencies")
print(f"  {len(real_dupes)} exact-date duplicates  |  "
      f"{len(placeholder_dupes)} year/month-only (may be different shows)")
print(f"{'─'*72}\n")

if real_dupes:
    print("  ── Exact-date duplicates (same show, different metadata) ──\n")
    for artist, date, group, issues in real_dupes:
        print(f"  {artist} — {date}  ({len(group)} versions)")
        for key, info in issues.items():
            if info[0] == 'conflict':
                print(f"    {key}: {info[1]}")
            else:
                print(f"    {key}: canonical={info[1]}  ({info[2]} versions missing)")
        for s in group:
            size = s.get('TotalSizeHuman', '?')
            fn   = s.get('FolderName', '?')
            print(f"      [{s['ShowID']}] {size:>10}  {fn}")
        print()

if placeholder_dupes:
    print("  ── Year/month-only date groups (may be different shows — review manually) ──\n")
    for artist, date, group, issues in placeholder_dupes:
        print(f"  {artist} — {date}  ({len(group)} entries)")
        for key, info in issues.items():
            if info[0] == 'conflict':
                print(f"    {key}: {info[1]}")
            else:
                print(f"    {key}: canonical={info[1]}  ({info[2]} entries missing)")
        for s in group:
            size = s.get('TotalSizeHuman', '?')
            fn   = s.get('FolderName', '?')
            print(f"      [{s['ShowID']}] {size:>10}  {fn}")
        print()

# ── Summary ──
print(f"\n{SEP}")
total = len(conflict_festivals) + len(missing_festivals) + len(real_dupes) + len(placeholder_dupes)
print(f"  TOTAL ISSUES: {total}")
print(f"    Festival conflicts:  {len(conflict_festivals)}")
print(f"    Festival missing:    {len(missing_festivals)}")
print(f"    Exact-date dupes:   {len(real_dupes)}")
print(f"    Year-only groups:   {len(placeholder_dupes)}")
print(SEP)

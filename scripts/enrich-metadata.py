#!/usr/bin/env python3
"""
enrich-metadata.py

Looks up exact dates, venues, cities and countries for shows that have
placeholder metadata (YYYY-01-01 dates), using the FREE setlist.fm API.

── Setup (one time) ─────────────────────────────────────────────────────────
  1. Create a free account at https://www.setlist.fm
  2. Go to https://www.setlist.fm/settings/api  →  Apply for an API key
     (it's instant and free — just needs a brief description like "personal archive")
  3. Add the key to your shell:
       echo 'export SETLISTFM_API_KEY=your-key-here' >> ~/.zshrc
       source ~/.zshrc

── Usage ─────────────────────────────────────────────────────────────────────
  # All shows with YYYY-01-01 placeholder dates (default)
  python3 scripts/enrich-metadata.py

  # One artist only
  python3 scripts/enrich-metadata.py --artist "Stone Temple Pilots"

  # Single show by ShowID
  python3 scripts/enrich-metadata.py --id abc123def456

  # Preview proposals without writing
  python3 scripts/enrich-metadata.py --dry-run

  # Limit how many shows to process in one run
  python3 scripts/enrich-metadata.py --limit 5
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.request
import urllib.parse
import urllib.error

ROOT       = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOWS_JSON = os.path.join(ROOT, 'public', 'shows.json')
API_BASE   = 'https://api.setlist.fm/rest/1.0'

# ── Helpers ───────────────────────────────────────────────────────────────────

def load_shows():
    with open(SHOWS_JSON) as f:
        return json.load(f)

def save_shows(shows):
    with open(SHOWS_JSON, 'w') as f:
        json.dump(shows, f, indent=2)

def is_placeholder_date(date_str):
    return bool(date_str and re.match(r'^\d{4}-01-01$', date_str))

def sfm_date_to_iso(d):
    """Convert setlist.fm DD-MM-YYYY → YYYY-MM-DD."""
    parts = d.split('-')
    if len(parts) == 3:
        return f'{parts[2]}-{parts[1]}-{parts[0]}'
    return None

def find_targets(shows, artist_filter=None, show_id=None):
    out = []
    for s in shows:
        if show_id and s['ShowID'] != show_id:
            continue
        if artist_filter and artist_filter.lower() not in s.get('Artist', '').lower():
            continue
        if show_id or is_placeholder_date(s.get('ShowDate', '')):
            out.append(s)
    return out

def describe(show):
    parts = [show.get('Artist', '')]
    for f in ['EventOrFestival', 'VenueName', 'City']:
        v = show.get(f, '')
        if v and v not in parts:
            parts.append(v)
    d = show.get('ShowDate', '')
    if d:
        parts.append(f'({d})')
    return '  |  '.join(parts)

# ── setlist.fm API ────────────────────────────────────────────────────────────

def sfm_search(api_key, artist_name, year, page=1):
    """Search setlist.fm for an artist's shows in a given year."""
    params = urllib.parse.urlencode({
        'artistName': artist_name,
        'year':       year,
        'p':          page,
    })
    url = f'{API_BASE}/search/setlists?{params}'
    req = urllib.request.Request(url, headers={
        'Accept':    'application/json',
        'x-api-key': api_key,
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return {'setlist': [], 'total': 0}
        if e.code == 429:
            print('      Rate limited — waiting 10s...')
            time.sleep(10)
            return sfm_search(api_key, artist_name, year, page)
        raise

def parse_setlist(sl):
    """Extract the fields we care about from a setlist.fm result."""
    iso_date = sfm_date_to_iso(sl.get('eventDate', ''))
    venue    = sl.get('venue', {})
    city_obj = venue.get('city', {})
    country  = city_obj.get('country', {})
    tour     = sl.get('tour', {})
    return {
        'ShowDate':        iso_date,
        'VenueName':       venue.get('name', ''),
        'City':            city_obj.get('name', ''),
        'Country':         country.get('name', ''),
        'EventOrFestival': tour.get('name', ''),
        'url':             sl.get('url', ''),
    }

# ── Matching ──────────────────────────────────────────────────────────────────

def score_match(show, candidate):
    """Score how well a setlist.fm result matches what we already know."""
    score = 0
    def norm(s): return (s or '').lower().strip()

    known_city    = norm(show.get('City'))
    known_venue   = norm(show.get('VenueName'))
    known_event   = norm(show.get('EventOrFestival'))
    known_country = norm(show.get('Country'))

    if known_city    and known_city    in norm(candidate['City']):    score += 3
    if known_venue   and known_venue   in norm(candidate['VenueName']):  score += 3
    if known_event   and known_event   in norm(candidate['EventOrFestival']): score += 2
    if known_country and known_country in norm(candidate['Country']):  score += 1
    return score

def find_best_match(show, candidates):
    """
    Return (best_candidate, confidence, alternatives).
    confidence: 'high' | 'medium' | 'low'
    """
    if not candidates:
        return None, None, []

    if len(candidates) == 1:
        return candidates[0], 'high', []

    # Score all candidates against known fields
    scored = sorted(candidates, key=lambda c: score_match(show, c), reverse=True)
    best   = scored[0]
    rest   = scored[1:]

    top_score  = score_match(show, best)
    next_score = score_match(show, rest[0]) if rest else -1

    if top_score == 0:
        # No known fields to match against — ambiguous
        confidence = 'low'
    elif top_score > next_score:
        confidence = 'high' if top_score >= 3 else 'medium'
    else:
        confidence = 'low'  # tie

    return best, confidence, rest[:2]  # return up to 2 alternatives

# ── Research a single show ────────────────────────────────────────────────────

def research_show(api_key, show):
    """
    Query setlist.fm and return proposed field updates for this show.
    Returns (proposal, confidence, source_url, note).
    proposal is a dict of {field: {'from': old, 'to': new}}.
    """
    artist = show.get('Artist', '')
    year   = (show.get('ShowDate') or '')[:4]
    if not year or not artist:
        return {}, None, '', 'Missing artist or year — skipped'

    data = sfm_search(api_key, artist, year)
    total = data.get('total', 0)

    if total == 0:
        return {}, None, '', f'No results on setlist.fm for {artist} {year}'

    # Fetch more pages if needed (up to 3 pages = 60 results)
    all_setlists = data.get('setlist', [])
    pages_to_fetch = min(3, -(-total // 20))  # ceil division
    for page in range(2, pages_to_fetch + 1):
        time.sleep(0.6)
        more = sfm_search(api_key, artist, year, page)
        all_setlists.extend(more.get('setlist', []))

    candidates  = [parse_setlist(sl) for sl in all_setlists]
    best, confidence, alternatives = find_best_match(show, candidates)

    if best is None:
        return {}, None, '', 'No suitable match found'

    # Build proposal — only include fields that would actually change
    proposal = {}
    for field in ['ShowDate', 'VenueName', 'City', 'Country', 'EventOrFestival']:
        proposed = best.get(field, '')
        current  = show.get(field, '')
        if not proposed:
            continue
        if proposed == current:
            continue
        # Don't replace a full date with another placeholder
        if field == 'ShowDate' and is_placeholder_date(proposed):
            continue
        # Don't downgrade a full date
        if field == 'ShowDate' and len(current) == 10 and len(proposed) < 10:
            continue
        proposal[field] = {'from': current, 'to': proposed}

    alt_note = ''
    if alternatives and confidence == 'low':
        alt_note = f'  (also found: {alternatives[0]["City"]} {alternatives[0]["ShowDate"]})'

    note = f'{total} result(s) found on setlist.fm{alt_note}'
    return proposal, confidence, best.get('url', ''), note

# ── Display ───────────────────────────────────────────────────────────────────

CONF_ICON = {'high': '✓', 'medium': '~', 'low': '?'}

def print_result(show, proposal, confidence, url, note):
    icon = CONF_ICON.get(confidence, ' ') if confidence else '✗'
    conf = confidence or 'none'
    print(f'\n  [{icon} {conf}]  {show["ShowID"]}')
    print(f'          {describe(show)}')
    if not proposal:
        print(f'          No changes proposed  —  {note}')
    else:
        for field, change in proposal.items():
            old = change['from'] or '(blank)'
            print(f'          {field:<22} {old}  →  {change["to"]}')
        if url:
            print(f'          Source: {url}')
        if note:
            print(f'          Note:   {note}')

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Enrich show metadata via setlist.fm')
    parser.add_argument('--artist',  help='Filter by artist name (partial match)')
    parser.add_argument('--id',      help='Single show by ShowID')
    parser.add_argument('--dry-run', action='store_true', help='Show proposals, do not write')
    parser.add_argument('--limit',   type=int, default=0, help='Max shows to process (0=all)')
    args = parser.parse_args()

    # ── API key check ─────────────────────────────────────────────────────────
    api_key = os.environ.get('SETLISTFM_API_KEY')
    if not api_key:
        print(
            '\nSETLISTFM_API_KEY is not set.\n\n'
            'Setup (free, takes 2 minutes):\n'
            '  1. Create a free account at https://www.setlist.fm\n'
            '  2. Go to https://www.setlist.fm/settings/api\n'
            '  3. Click "Apply for an API key" (instant approval)\n'
            '  4. Then run:\n'
            '       echo \'export SETLISTFM_API_KEY=your-key\' >> ~/.zshrc\n'
            '       source ~/.zshrc\n'
        )
        sys.exit(1)

    shows      = load_shows()
    show_index = {s['ShowID']: i for i, s in enumerate(shows)}
    targets    = find_targets(shows, artist_filter=args.artist, show_id=args.id)

    if not targets:
        print('No shows matched the criteria.')
        sys.exit(0)

    if args.limit:
        targets = targets[:args.limit]

    print(f'\nThe Vault — Metadata Enrichment')
    print(f'Source: setlist.fm  |  Shows to research: {len(targets)}')
    if args.dry_run:
        print('Mode: DRY RUN (no writes)')
    print('─' * 60)

    results = []  # (show, proposal, confidence, url, note)

    for i, show in enumerate(targets, 1):
        print(f'\n[{i}/{len(targets)}] {show.get("Artist")} — {show.get("ShowDate")}', end='', flush=True)
        try:
            proposal, confidence, url, note = research_show(api_key, show)
            results.append((show, proposal, confidence, url, note))
            print_result(show, proposal, confidence, url, note)
        except Exception as e:
            print(f'\n  ERROR: {e}')
            results.append((show, {}, None, '', str(e)))
        # Polite rate limiting — setlist.fm asks for max 2 req/sec
        if i < len(targets):
            time.sleep(0.6)

    # ── Summary ───────────────────────────────────────────────────────────────
    with_changes = [(s, p, c, u, n) for s, p, c, u, n in results if p]
    no_changes   = [(s, p, c, u, n) for s, p, c, u, n in results if not p]

    print(f'\n{"═" * 60}')
    print(f'  Researched:   {len(results)}')
    print(f'  With changes: {len(with_changes)}')
    print(f'  No changes:   {len(no_changes)}')
    print(f'{"═" * 60}')

    if not with_changes:
        print('\nNothing to update.')
        sys.exit(0)

    if args.dry_run:
        print('\nDry run — no files written.')
        sys.exit(0)

    # ── Confirm and write ─────────────────────────────────────────────────────
    answer = input(f'\nWrite {len(with_changes)} change(s) to public/shows.json? [y/N] ').strip().lower()
    if answer != 'y':
        print('Aborted — nothing written.')
        sys.exit(0)

    for show, proposal, _, _, _ in with_changes:
        idx = show_index[show['ShowID']]
        for field, change in proposal.items():
            shows[idx][field] = change['to']

    save_shows(shows)
    print(f'\n✓  Updated {len(with_changes)} show(s) in public/shows.json')
    print('   Run health check and push:\n'
          '     python3 scripts/health-check.py\n'
          '     git add -f public/shows.json && git commit && git push')

if __name__ == '__main__':
    main()

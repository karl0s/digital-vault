#!/usr/bin/env python3
"""
enrich-metadata.py

Metadata enrichment agent for The Vault.
Uses Claude claude-sonnet-4-6 with web search to look up exact dates, venues,
cities and countries for shows that have incomplete or placeholder metadata.

── Setup ────────────────────────────────────────────────────────────────────
  pip install anthropic
  export ANTHROPIC_API_KEY=sk-ant-...        # add to ~/.zshrc or ~/.bash_profile

── Usage ────────────────────────────────────────────────────────────────────
  # Enrich all shows with placeholder dates (YYYY-01-01) — default
  python3 scripts/enrich-metadata.py

  # Filter to one artist
  python3 scripts/enrich-metadata.py --artist "Stone Temple Pilots"

  # Specific show by ShowID
  python3 scripts/enrich-metadata.py --id abc123def456

  # Preview proposed changes without writing
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

ROOT        = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOWS_JSON  = os.path.join(ROOT, 'public', 'shows.json')
MODEL       = 'claude-sonnet-4-6'

ENRICHABLE_FIELDS = ['ShowDate', 'VenueName', 'City', 'Country', 'EventOrFestival']

# ── Helpers ───────────────────────────────────────────────────────────────────

def load_shows():
    with open(SHOWS_JSON) as f:
        return json.load(f)

def save_shows(shows):
    with open(SHOWS_JSON, 'w') as f:
        json.dump(shows, f, indent=2)

def is_placeholder_date(date_str):
    """Returns True for YYYY-01-01 (year-only placeholder)."""
    if not date_str:
        return False
    return bool(re.match(r'^\d{4}-01-01$', date_str))

def find_target_shows(shows, artist_filter=None, show_id=None):
    """Return shows that need enrichment."""
    targets = []
    for s in shows:
        if show_id and s['ShowID'] != show_id:
            continue
        if artist_filter and artist_filter.lower() not in s.get('Artist', '').lower():
            continue
        if show_id or is_placeholder_date(s.get('ShowDate', '')):
            targets.append(s)
    return targets

def describe_show(show):
    """Human-readable show description for prompts and display."""
    parts = [show.get('Artist', '')]
    ef    = show.get('EventOrFestival', '')
    venue = show.get('VenueName', '')
    city  = show.get('City', '')
    date  = show.get('ShowDate', '')
    if ef:    parts.append(ef)
    if venue and venue != ef: parts.append(venue)
    if city:  parts.append(city)
    if date:  parts.append(f'({date})')
    folder = show.get('FolderName') or show.get('FolderPath', '').split('/')[-1]
    return ' — '.join(parts), folder

# ── Agent ─────────────────────────────────────────────────────────────────────

def research_show(client, show):
    """
    Ask Claude (with web search) to find exact metadata for a show.
    Returns a dict of proposed field updates, or None if nothing found.
    """
    desc, folder = describe_show(show)
    year = (show.get('ShowDate') or '')[:4] or 'unknown year'

    known = {k: show.get(k, '') for k in ENRICHABLE_FIELDS if show.get(k)}
    known_str = '\n'.join(f'  {k}: {v}' for k, v in known.items()) or '  (none)'

    prompt = f"""I need exact metadata for this concert recording in my archive.

Artist: {show.get('Artist', '')}
Year: {year}
Folder name: {folder}
Currently known:
{known_str}

Search setlist.fm, Wikipedia, and other reliable sources to find:
1. The exact date (YYYY-MM-DD)
2. The venue name as it was called at the time (not modern rebranding — e.g. use
   "Brixton Academy" not "O2 Academy Brixton" for shows before 2011)
3. City
4. Country
5. Festival or event name if applicable (e.g. "Glastonbury", "MTV Unplugged")

Return ONLY valid JSON with no markdown formatting, no explanation — just the JSON object:
{{
  "ShowDate": "YYYY-MM-DD or null",
  "VenueName": "venue name or null",
  "City": "city or null",
  "Country": "country or null",
  "EventOrFestival": "event/festival name or null",
  "confidence": "high / medium / low",
  "source": "URL or site where you found this",
  "notes": "any caveats or uncertainty"
}}

Rules:
- Return null for any field you cannot confirm from a reliable source
- Never guess or invent data
- If the date is ambiguous (multiple shows that year), return the most likely one
  and set confidence to medium or low with an explanation in notes
- Do not change a field that is already correct (compare against "Currently known" above)"""

    messages = [{'role': 'user', 'content': prompt}]
    tools    = [{'type': 'web_search_20250305', 'name': 'web_search'}]

    # Agentic loop — Claude may issue multiple search calls before answering
    while True:
        response = client.messages.create(
            model=MODEL,
            max_tokens=1024,
            tools=tools,
            messages=messages,
        )

        # Collect any text blocks for the final answer
        text_blocks    = [b for b in response.content if b.type == 'text']
        tool_use_blocks = [b for b in response.content if b.type == 'tool_use']

        if response.stop_reason == 'end_turn' or not tool_use_blocks:
            # Final response — extract JSON from text
            if not text_blocks:
                return None
            raw = text_blocks[-1].text.strip()
            # Strip markdown code fences if present
            raw = re.sub(r'^```(?:json)?\s*', '', raw)
            raw = re.sub(r'\s*```$', '', raw)
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                # Try to extract JSON object from within the text
                m = re.search(r'\{[\s\S]+\}', raw)
                if m:
                    try:
                        return json.loads(m.group())
                    except Exception:
                        pass
            return None

        # Tool use — append assistant message and tool results, then loop
        messages.append({'role': 'assistant', 'content': response.content})
        tool_results = []
        for tb in tool_use_blocks:
            # Web search results are returned by Anthropic server-side;
            # if the tool result is already in the response content we don't need to do
            # anything — but some API versions return tool_result blocks separately.
            # Pass an empty result to keep the loop going if needed.
            tool_results.append({
                'type': 'tool_result',
                'tool_use_id': tb.id,
                'content': '',
            })
        if tool_results:
            messages.append({'role': 'user', 'content': tool_results})

# ── Diff / display ────────────────────────────────────────────────────────────

def build_proposal(show, result):
    """
    Compare research result against current show data.
    Returns dict of fields that would actually change.
    """
    if not result:
        return {}

    changes = {}
    for field in ENRICHABLE_FIELDS:
        proposed = result.get(field)
        current  = show.get(field, '')
        if proposed and proposed != current:
            # Don't overwrite a good date with a placeholder
            if field == 'ShowDate' and is_placeholder_date(proposed):
                continue
            # Don't downgrade a full date to year-only
            if field == 'ShowDate' and len(current) == 10 and len(proposed) < 10:
                continue
            changes[field] = {'from': current, 'to': proposed}
    return changes

def print_proposal(show, proposal, result):
    desc, _ = describe_show(show)
    confidence = result.get('confidence', '?') if result else '?'
    source     = result.get('source', '') if result else ''
    notes      = result.get('notes', '') if result else ''

    conf_colour = {'high': '✓', 'medium': '~', 'low': '?'}.get(confidence, '?')

    print(f'\n  [{conf_colour} {confidence}]  {show["ShowID"]}  {desc}')
    if not proposal:
        print('      No changes proposed')
    else:
        for field, change in proposal.items():
            old = change["from"] or '(blank)'
            new = change["to"]
            print(f'      {field:<20}  {old}  →  {new}')
    if source:
        print(f'      Source: {source}')
    if notes:
        print(f'      Note:   {notes}')

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Enrich show metadata using Claude + web search')
    parser.add_argument('--artist',  help='Filter to shows by this artist (partial match)')
    parser.add_argument('--id',      help='Research a single show by ShowID')
    parser.add_argument('--dry-run', action='store_true', help='Show proposals without writing')
    parser.add_argument('--limit',   type=int, default=0, help='Max shows to process (0 = all)')
    args = parser.parse_args()

    # ── API key check ─────────────────────────────────────────────────────────
    api_key = os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        print(
            '\nANTHROPIC_API_KEY is not set.\n'
            'Add it to your shell profile:\n'
            '  echo \'export ANTHROPIC_API_KEY=sk-ant-...\' >> ~/.zshrc\n'
            '  source ~/.zshrc\n'
        )
        sys.exit(1)

    try:
        import anthropic
    except ImportError:
        print('\nThe anthropic package is not installed.\n  pip install anthropic\n')
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)

    # ── Find target shows ─────────────────────────────────────────────────────
    shows      = load_shows()
    show_index = {s['ShowID']: i for i, s in enumerate(shows)}
    targets    = find_target_shows(shows, artist_filter=args.artist, show_id=args.id)

    if not targets:
        print('No shows matched the criteria.')
        sys.exit(0)

    if args.limit:
        targets = targets[:args.limit]

    print(f'\nThe Vault — Metadata Enrichment Agent')
    print(f'Model: {MODEL}  |  Shows to research: {len(targets)}')
    if args.dry_run:
        print('Mode: DRY RUN (no writes)')
    print('─' * 60)

    # ── Research each show ────────────────────────────────────────────────────
    proposals = []   # list of (show, proposal_dict, result_dict)

    for i, show in enumerate(targets, 1):
        desc, folder = describe_show(show)
        print(f'\n[{i}/{len(targets)}] Researching: {desc}')
        if folder:
            print(f'             Folder: {folder}')

        try:
            result   = research_show(client, show)
            proposal = build_proposal(show, result)
            proposals.append((show, proposal, result))
            print_proposal(show, proposal, result)
        except Exception as e:
            print(f'  ERROR: {e}')
            proposals.append((show, {}, None))

        # Polite rate limiting
        if i < len(targets):
            time.sleep(1)

    # ── Summary ───────────────────────────────────────────────────────────────
    with_changes  = [(s, p, r) for s, p, r in proposals if p]
    no_changes    = [(s, p, r) for s, p, r in proposals if not p]

    print(f'\n{"═" * 60}')
    print(f'  Researched : {len(proposals)} shows')
    print(f'  With changes: {len(with_changes)}')
    print(f'  No changes  : {len(no_changes)}')
    print(f'{"═" * 60}')

    if not with_changes:
        print('\nNothing to update.')
        sys.exit(0)

    if args.dry_run:
        print('\nDry run complete — no files written.')
        sys.exit(0)

    # ── Confirm and write ─────────────────────────────────────────────────────
    answer = input(f'\nWrite {len(with_changes)} change(s) to public/shows.json? [y/N] ').strip().lower()
    if answer != 'y':
        print('Aborted — no changes written.')
        sys.exit(0)

    for show, proposal, _ in with_changes:
        idx = show_index[show['ShowID']]
        for field, change in proposal.items():
            shows[idx][field] = change['to']

    save_shows(shows)
    print(f'\n✓ Updated {len(with_changes)} shows in public/shows.json')
    print('  Remember to run the health check and push:\n'
          '    python3 scripts/health-check.py\n'
          '    git add -f public/shows.json && git commit && git push')

if __name__ == '__main__':
    main()

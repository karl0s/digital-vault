"""Writes the drive scan's new specs into public/shows.json: added, never overwritten.

    python3 tools/drive-scan/apply.py            # dry run: counts what would be added
    python3 tools/drive-scan/apply.py --apply

Only the fields the review page proposed (tools/drive-scan/page.py, proposed()): FrameRate,
ScanType, VideoKbps, AudioKbps, AudioTracks, DiscType, Menu, Chapters, ShowSizeHuman. A field a
record already has is left exactly as it is. Width and Height are never touched here: the 18
the source contradicts go through their own check. Each record that gains anything notes it in
PrivateNotes under DRIVE SCAN (date), without a path (folder names can carry a taper's handle).
"""
import collections, datetime, json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from page import SCAN, REPO, prepared, proposed  # noqa: E402

SHOWS = REPO / 'public' / 'shows.json'


def main():
    raw = SHOWS.read_text(encoding='utf-8')
    shows = json.loads(raw)
    if json.dumps(shows, indent=2, ensure_ascii=False) + '\n' != raw:
        sys.exit('shows.json is not in its usual format; not touching it')
    by_id = {s['ShowID']: s for s in shows}
    rows = prepared(json.load(open(SCAN)), by_id)
    today = datetime.date.today().isoformat()
    added, kept, records = collections.Counter(), collections.Counter(), 0
    for r in rows:
        s = by_id.get(r['ShowID'])
        if not s:
            continue
        new = {k: v for k, v in proposed(r).items() if v}
        fresh = {k: v for k, v in new.items() if not str(s.get(k) or '').strip()}
        kept.update(k for k in new if k not in fresh)
        if not fresh:
            continue
        records += 1
        added.update(fresh.keys())
        if '--apply' in sys.argv:
            s.update(fresh)
            src = "its programme's files" if r.get('inherited') else 'its own files'
            note = (f"DRIVE SCAN ({today}): {', '.join(fresh)} added, read from {src} on Live Music "
                    f"(tools/drive-scan; matched by {r.get('matched_by', 'name')}). Nothing existing changed.")
            prev = (s.get('PrivateNotes') or '').rstrip()
            s['PrivateNotes'] = f'{prev}\n\n{note}' if prev else note
    print(f'{records} records gain fields:', dict(added))
    if kept:
        print('left as they were (already set):', dict(kept))
    if '--apply' not in sys.argv:
        print('Dry run. Add --apply to write.')
        return
    out = json.dumps(shows, indent=2, ensure_ascii=False) + '\n'
    assert '�' not in out
    SHOWS.write_text(out, encoding='utf-8')
    print('Written. Next: python3 scripts/health-check.py, npm run check, commit.')


if __name__ == '__main__':
    main()

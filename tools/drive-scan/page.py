"""The drive scan's review page: what tools/drive-scan/scan.py found, before anything is written.

    python3 tools/drive-scan/page.py     # renders ~/VaultShots/reports/drive-scan.html

Coverage (how many records were found on the drive, and how), what the scan says across the
collection (frame rates, scan, disc types, bitrates), where the source disagrees with the record,
and, record by record, the fields a later step would write. Read-only.
"""
import collections, html, json
from pathlib import Path

SCAN = Path.home() / 'VaultShots' / 'drive-scan' / 'scan.json'
OUT = Path.home() / 'VaultShots' / 'reports' / 'drive-scan.html'
REPO = Path(__file__).resolve().parent.parent.parent


def human(n):
    for unit, size in (('GB', 1e9), ('MB', 1e6)):
        if n >= size:
            return f'{n / size:.2f} {unit}'
    return f'{n} B'


def proposed(r):
    """The fields a later step would write for this record."""
    if not r.get('found'):
        return {}
    f = {}
    if r.get('inherited'):
        # An act cut from a programme: the programme's stream, never a size or bitrate of its own.
        return {k: v for k, v in (('FrameRate', r.get('frame_rate')), ('ScanType', r.get('scan')), ('DiscType', r.get('disc_type'))) if v}
    if r.get('frame_rate'):
        f['FrameRate'] = r['frame_rate']
    if r.get('scan'):
        f['ScanType'] = r['scan']
    # Bitrate and size rest on the length: where the record and the source disagree on it (a
    # slice of a shared titleset, a record with no length), neither is proposed.
    bad_rate = any(x.startswith(('bitrate', 'length')) for x in r.get('flags', []))
    if r.get('video_kbps') and not bad_rate:
        f['VideoKbps'] = str(r['video_kbps'])
    audio = [a['kbps'] for a in r.get('audio', []) if a.get('kbps')]
    if audio:
        f['AudioKbps'] = str(audio[0])
    if len(r.get('audio', [])) > 1:
        f['AudioTracks'] = str(len(r['audio']))
    if r.get('disc_type'):
        f['DiscType'] = r['disc_type']
    if r.get('disc_type', '').startswith('DVD'):
        f['Menu'] = 'Yes' if r.get('menu') else 'No'
        if r.get('chapters'):
            f['Chapters'] = str(r['chapters'])
    if r.get('own_bytes') and not r.get('shared') and not r.get('approximate') and not bad_rate:
        f['ShowSizeHuman'] = human(r['own_bytes'])
    return f


def corrections(r, s):
    """Where the source shows the record itself is wrong: (field, record value, source value)."""
    out = []
    if not r.get('found') or r.get('approximate'):
        return out
    try:
        if r.get('height') and int(s.get('Height') or 0) and int(s['Height']) != int(r['height']):
            out.append(('Width × Height', f"{s.get('Width')} × {s.get('Height')}", f"{r['width']} × {r['height']}"))
    except (TypeError, ValueError):
        pass
    try:
        missing = not float(s.get('DurationSec') or 0)
    except ValueError:
        missing = True
    if missing and r.get('duration') and not s.get('ParentShowID') and not r.get('shared'):
        out.append(('Length', 'none', f"{round(r['duration'] / 60)} min ({round(r['duration'])} s, from the disc)"))
    return out


def prepared(rows, shows):
    """The scan, with acts cut from a programme that was found taking the programme's stream."""
    by_id = {r['ShowID']: r for r in rows}
    for r in rows:
        master = by_id.get(shows.get(r['ShowID'], {}).get('ParentShowID') or '')
        if not r.get('found') and master and master.get('found'):
            r.update(found=True, inherited=True, matched_by='programme', frame_rate=master.get('frame_rate'),
                     scan=master.get('scan'), disc_type=master.get('disc_type'), flags=[])
    return rows


def main():
    shows = {s['ShowID']: s for s in json.load(open(REPO / 'public' / 'shows.json', encoding='utf-8'))}
    rows = prepared(json.load(open(SCAN)), shows)
    found = [r for r in rows if r.get('found')]
    E = html.escape
    c = lambda key: collections.Counter(r.get(key) or '—' for r in found).most_common()
    how = collections.Counter(r.get('matched_by', '?') for r in found)
    flagged = [r for r in found if r.get('flags')]
    fixes = [(r, corrections(r, shows.get(r['ShowID'], {}))) for r in found]
    fixes = [(r, fx) for r, fx in fixes if fx]
    missing = [r for r in rows if not r.get('found')]
    stat = lambda title, items: f'<div class="stat"><h3>{E(title)}</h3>' + ''.join(f'<div><span>{E(str(k))}</span><b>{v}</b></div>' for k, v in items) + '</div>'
    stats = ''.join([
        stat('Frame rate', c('frame_rate')), stat('Scan', c('scan')), stat('Disc', c('disc_type')),
        stat('Matched', [('by name', how.get('name', 0)), ('by size', how.get('size', 0)), ('by content', how.get('content', 0)), ('from its programme', how.get('programme', 0)), ('not found', len(missing))]),
    ])
    def row(r):
        s = shows.get(r['ShowID'], {})
        p = proposed(r)
        vals = ' · '.join(f'{k}: {v}' for k, v in p.items()) or '—'
        place = ' · '.join(x for x in [s.get('EventOrFestival'), s.get('VenueName'), s.get('City')] if x)
        return (f'<tr><td><b>{E(r["Artist"])}</b> <span class="sub">{E(r.get("ShowDate") or "Undated")} · {E(place)}</span>'
                f'<div class="sub mono">{E(r["ShowID"])}{" · shared titleset" if r.get("shared") else ""}{" · approximate" if r.get("approximate") else ""}</div></td>'
                f'<td class="vals">{E(vals)}</td><td class="flags">{"<br>".join(E(x) for x in r.get("flags", []))}</td></tr>')
    by_artist = sorted(found, key=lambda r: (r['Artist'].lower(), r.get('ShowDate') or ''))
    doc = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Drive scan</title><style>
:root{{color-scheme:dark}} body{{margin:0;background:#141414;color:#e5e7eb;font:14px/1.5 system-ui,sans-serif}}
main{{max-width:1300px;margin:0 auto;padding:28px 24px 80px}} h1{{color:#fff;font-size:22px;margin:0 0 6px}} .lead{{color:#d1d5db;max-width:900px}} .lead b{{color:#fff}}
h2{{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#9ca3af;margin:34px 0 8px}}
.stats{{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}} .stat{{border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px 14px;background:rgba(255,255,255,.03)}}
.stat h3{{margin:0 0 6px;font-size:12px;color:#9ca3af;font-weight:600}} .stat div{{display:flex;justify-content:space-between;color:#d1d5db}} .stat b{{color:#fff}}
table{{width:100%;border-collapse:collapse}} td{{padding:9px 8px;border-bottom:1px solid rgba(255,255,255,.07);vertical-align:top}}
.sub{{color:#9ca3af;font-weight:400;font-size:13px}} .mono{{font-family:ui-monospace,Menlo,monospace;font-size:12px}} .vals{{color:#d1d5db;font-size:13px}} .flags{{color:#fcd34d;font-size:13px;width:260px}}
</style></head><body><main>
<h1>Drive scan: the specs the records were missing</h1>
<p class="lead">Read from each record's own files on Live Music; <b>nothing has been written to the collection</b>. Found <b>{len(found)} of {len(rows)}</b> records. For each, the fields a later step would add are listed: frame rate and scan, video and audio bitrate (the average, from size and length), disc type, menu and chapters for DVDs, and the show's own size. Records that share a titleset with another get no size of their own. Where the source disagrees with the record, it is flagged.</p>
<div class="stats">{stats}</div>
<h2>Corrections: the record itself is wrong ({len(fixes)})</h2>
<p class="lead">The source on the drive shows these records' picture size is not what they store, or that they store no length. The picture size decides the quality label (352 × 288 reads "Low-res", 704 × 576 "SD 576").</p>
<table>{''.join(f'<tr><td><b>{E(r["Artist"])}</b> <span class="sub">{E(r.get("ShowDate") or "Undated")}</span> <span class="sub mono">{E(r["ShowID"])}</span></td><td class="vals">{E(f)}: <span class="sub">{E(a)}</span> → <b>{E(b)}</b></td></tr>' for r, fx in fixes for f, a, b in fx)}</table>
<h2>Other disagreements, for information ({len(flagged)})</h2>
<p class="lead">Mostly records cut from a titleset they share, or from a longer programme, where the disc's own length is the whole titleset's: no bitrate or size is proposed for them.</p>
<table>{''.join(row(r) for r in flagged)}</table>
<h2>Not found on the drive ({len(missing)})</h2><table>{''.join(f'<tr><td><b>{E(r["Artist"])}</b> <span class="sub">{E(r.get("ShowDate") or "Undated")}</span> <span class="sub mono">{E(r["ShowID"])}</span></td></tr>' for r in missing)}</table>
<h2>Every record found ({len(found)})</h2><table>{''.join(row(r) for r in by_artist)}</table>
</main></body></html>'''
    assert '�' not in doc
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(doc, encoding='utf-8')
    print(OUT, len(found), 'found,', len(missing), 'missing,', len(flagged), 'flagged')


if __name__ == '__main__':
    main()

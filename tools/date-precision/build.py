"""The date-precision review (docs/ux-research F7): shows stored on the 1st of a month, where the
site can't tell a real date from a placeholder (CLAUDE.md, ShowDate). One row per show (its
copies together), the evidence from its own records, and Real date / Month only / Not sure.

    python3 tools/date-precision/build.py     # renders ~/VaultShots/reports/date-precision.html

YYYY-01-01 means the year alone by convention, so those rows appear only where something says
the date may be real. Karl picks on the page (saved in his browser) and pastes "Copy for Claude
Code" into a session; tools/date-precision/apply.py writes DatePrecision. Answered shows drop
off on the next build. Read-only: this script writes only the page.
"""
import collections, html, json, os, re, urllib.parse

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.expanduser('~/VaultShots/reports/date-precision.html')
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
MONTH_PHRASE = re.compile(r'(month only|year and month|day (is )?unknown|exact day|YYYY-MM-01|-01 (is|as) (a )?placeholder)', re.I)


def date_mentions(s):
    """The stored date written out in the record's own folder name or sidecar Notes."""
    dt = s['ShowDate']
    y, m, d = dt.split('-')
    forms = [dt, f'{d}.{m}.{y}', f'{d}/{m}/{y}', f'{m}/{d}/{y}', f'{m}-{d}-{y}', f'{d}-{m}-{y}', f'{y}.{m}.{d}', f'{y}{m}{d}', f'{d}.{m}.{y[2:]}',
             f'{MONTHS[int(m) - 1]} 1, {y}', f'{MONTHS[int(m) - 1]} 1st, {y}', f'1 {MONTHS[int(m) - 1]} {y}', f'1st {MONTHS[int(m) - 1]} {y}']
    for field, label in (('FolderName', 'Folder name'), ('Notes', 'Sidecar')):
        # "(VTS_02 - Barfly Sessions 2000-08-01)" was written from the record's
        # own date when a disc was split: circular, so it proves nothing.
        text = s.get(field) or ''
        if field == 'FolderName':
            text = re.sub(r'\((?:VTS|Disc)[^)]*\)?', '', text)
        for f in forms:
            at = text.find(f)
            if at >= 0:
                a, b = max(0, at - 50), min(len(text), at + len(f) + 50)
                return label, ('…' if a else '') + ' '.join(text[a:b].split()) + ('…' if b < len(text) else '')
    return None


def candidates():
    shows = [s for s in json.load(open(os.path.join(REPO, 'public', 'shows.json'), encoding='utf-8'))
             if s.get('Hidden') != 'Yes' and not s.get('DatePrecision') and re.fullmatch(r'\d{4}-\d{2}-01', s.get('ShowDate') or '')]
    groups = collections.defaultdict(list)
    for s in shows:
        groups[(s['Artist'], s['ShowDate'], s.get('EventOrFestival') or '', s.get('VenueName') or '', s.get('City') or '')].append(s)
    rows = []
    for (artist, date, event, venue, city), copies in groups.items():
        jan1 = date.endswith('-01-01')
        found = next((m for m in map(date_mentions, copies) if m), None)
        month_note = next((s for s in copies if MONTH_PHRASE.search(s.get('PrivateNotes') or '')), None)
        if found:
            # A folder may carry the 1 January placeholder too: no suggestion there.
            g, rec = ('jan1', '') if jan1 else ('real', 'day')
            why = f'{found[0]} gives this date: {found[1]}'
        elif jan1:
            continue  # the year alone, by convention, and nothing says otherwise
        elif month_note:
            m = MONTH_PHRASE.search(month_note['PrivateNotes'])
            t = month_note['PrivateNotes']
            a, b = max(0, m.start() - 70), min(len(t), m.end() + 70)
            g, rec, why = 'month', 'month', 'Private notes: …' + ' '.join(t[a:b].split()) + '…'
        else:
            g, rec, why = 'unknown', '', 'Nothing in the records says whether the 1st is real.'
        query = ' '.join(x for x in [artist, event or venue, date[:4]] if x)
        rows.append(dict(ids=[s['ShowID'] for s in copies], g=g, rec=rec, why=why, artist=artist, date=date,
                         place=' · '.join(x for x in [event, venue if venue != event else '', city] if x),
                         folder=copies[0].get('FolderName') or '', copies=len(copies),
                         search=f'https://www.setlist.fm/search?query={urllib.parse.quote(query)}'))
    return rows


GROUPS = [
    ('jan1', 'Stored as 1 January, and the folder or sidecar says so too: a real New Year’s Day show? Your call'),
    ('real', 'The 1st of the month, and the record gives that exact date: the day is real'),
    ('month', 'The 1st of the month, and the private notes say only the month is known'),
    ('unknown', 'The 1st of the month, and nothing says which: your call, or leave it'),
]


def main():
    rows = candidates()
    order = {g: i for i, (g, _) in enumerate(GROUPS)}
    rows.sort(key=lambda r: (order[r['g']], r['artist'].lower(), r['date']))
    for n, r in enumerate(rows, 1):
        r['n'] = n
    E = html.escape
    parts = []
    for g, title in GROUPS:
        gr = [r for r in rows if r['g'] == g]
        if not gr:
            continue
        parts.append(f'<h2 id="g-{g}">{E(title)}<span>{len(gr)}</span></h2>')
        if g in ('real', 'month'):
            parts.append(f'<div class="tools"><button class="acc" data-g="{g}">Accept the suggestion for all {len(gr)}</button></div>')
        parts.append('<table>')
        for r in gr:
            month = MONTHS[int(r['date'][5:7]) - 1]
            opts = [('R', 'day', f'Real date: {r["date"]}'), ('M', 'month', f'Month only: {month} {r["date"][:4]}'), ('?', 'skip', 'Not sure: leave it')]
            ob = ''.join(f'<button class="opt{" rec" if v == r["rec"] else ""}" data-v="{v}"><span class="k">{k}</span>{E(l)}'
                         f'{" <em>suggested</em>" if v == r["rec"] else ""}</button>' for k, v, l in opts)
            parts.append(f'''<tr data-ids="{' '.join(r['ids'])}" data-g="{g}" data-rec="{r['rec']}" data-label="{E(r['artist'] + ' · ' + r['date'])}">
<td class="n">{r['n']}</td><td><div class="art">{E(r['artist'])} <span class="date">{E(r['date'])}</span></div>
<div class="sub">{E(r['place'])}{f" · {r['copies']} copies" if r['copies'] > 1 else ''}</div>
<div class="why">{E(r['why'])}</div>
<div class="sub">Folder: {E(r['folder'])} · <a href="{E(r['search'])}" target="_blank">setlist.fm</a></div></td>
<td class="chc"><div class="ch">{ob}</div></td></tr>''')
        parts.append('</table>')
    stats = collections.Counter(r['g'] for r in rows)
    nav = ''.join(f'<a href="#g-{g}">{E(t.split(":")[0].split(",")[0])} {stats[g]}</a>' for g, t in GROUPS if stats[g])
    page = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Date precision review</title>
<style>
  :root {{ color-scheme: dark; --g300:#d1d5db; --g400:#9ca3af; --line: rgba(255,255,255,.08); }}
  * {{ box-sizing: border-box; }} body {{ margin: 0; background: #141414; color: #fff; font: 14px/1.5 system-ui, sans-serif; }}
  button {{ font: inherit; color: inherit; cursor: pointer; }} a {{ color: #93c5fd; }}
  header {{ position: sticky; top: 0; z-index: 10; background: rgba(20,20,20,.97); border-bottom: 1px solid var(--line); }}
  .bar {{ max-width: 1240px; margin: 0 auto; padding: 12px 24px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }}
  h1 {{ font-size: 18px; margin: 0 8px 0 0; }} .bar a {{ color: var(--g300); text-decoration: none; font-size: 13px; padding: 6px 12px; border-radius: 999px; background: rgba(255,255,255,.06); }}
  .sp {{ flex: 1; }} .prog {{ color: var(--g300); font-size: 13px; }}
  .copy {{ border: 0; border-radius: 999px; background: #fff; color: #111; font-weight: 600; padding: 8px 16px; font-size: 13px; }}
  main {{ max-width: 1240px; margin: 0 auto; padding: 8px 24px 80px; }}
  h2 {{ font-size: 12px; letter-spacing: .2em; text-transform: uppercase; color: var(--g400); margin: 36px 0 6px; font-weight: 600; scroll-margin-top: 70px; }}
  h2 span {{ letter-spacing: 0; text-transform: none; font-weight: 400; color: rgba(255,255,255,.5); margin-left: 8px; }}
  .lead {{ color: var(--g300); margin: 16px 0 6px; max-width: 900px; }} .lead b {{ color: #fff; font-weight: 600; }}
  table {{ width: 100%; border-collapse: collapse; }} td {{ padding: 12px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }}
  tr.done td {{ background: rgba(167,139,250,.05); }}
  .n {{ color: var(--g400); width: 40px; }} .art {{ font-weight: 600; font-size: 15px; }} .date {{ font-weight: 400; color: #fde68a; margin-left: 6px; }}
  .sub {{ color: var(--g400); font-size: 13px; }} .why {{ color: var(--g300); font-size: 13px; margin: 4px 0; max-width: 640px; }}
  .chc {{ width: 300px; }} .ch {{ display: flex; flex-direction: column; gap: 6px; }}
  .opt {{ text-align: left; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.04); border-radius: 8px; padding: 7px 10px; font-size: 13px; display: flex; gap: 8px; align-items: center; }}
  .opt:hover {{ background: rgba(255,255,255,.08); }} .opt em {{ font-style: normal; font-size: 11px; color: #6ee7b7; margin-left: auto; }}
  .opt .k {{ width: 20px; height: 20px; flex: none; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 700; background: rgba(255,255,255,.1); }}
  .opt.on {{ border-color: #a78bfa; background: rgba(167,139,250,.14); }} .opt.on .k {{ background: #a78bfa; color: #111; }}
  .tools {{ margin: 4px 0 8px; }} .acc {{ border: 1px solid rgba(255,255,255,.15); background: rgba(255,255,255,.08); border-radius: 999px; padding: 6px 14px; font-size: 13px; }}
  .toast {{ position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: #fff; color: #111; padding: 10px 16px; border-radius: 999px; font-weight: 600; opacity: 0; transition: opacity .2s; }} .toast.on {{ opacity: 1; }}
</style></head><body>
<header><div class="bar"><h1>Date precision</h1>{nav}<span class="sp"></span><span class="prog" id="prog"></span><button class="copy" id="copyout">Copy for Claude Code</button></div></header>
<main>
<p class="lead">These shows are stored on <b>the 1st of a month</b>. That is how a month-only date is written (2001-05-01 for "May 2001"), so the site can’t tell a real 1st from a placeholder and shows the full date. Pick <b>Real date</b> (the site keeps the day), <b>Month only</b> (it shows "May 2001 (day unknown)"), or <b>Not sure</b> (left as it is). Copies of one show are one row.</p>
<p class="lead">Shows stored as <b>1 January</b> already read as the year alone and aren’t listed, unless their own records give that exact date. The setlist.fm link searches the artist, event and year. Picks save in this browser; press <b>Copy for Claude Code</b> when done, or part-way.</p>
{''.join(parts)}
</main><div class="toast" id="toast">Copied</div>
<script>
const KEY = 'vault-date-precision-2026-10-17';
let picks = {{}}; try {{ picks = JSON.parse(localStorage.getItem(KEY) || '{{}}'); }} catch (e) {{}}
const save = () => {{ try {{ localStorage.setItem(KEY, JSON.stringify(picks)); }} catch (e) {{}} }};
const rows = [...document.querySelectorAll('tr[data-ids]')];
const key = tr => tr.dataset.ids;
function paint() {{
  for (const tr of rows) {{ const v = picks[key(tr)]; tr.classList.toggle('done', !!v); tr.querySelectorAll('.opt').forEach(b => b.classList.toggle('on', b.dataset.v === v)); }}
  document.getElementById('prog').textContent = rows.filter(r => picks[key(r)]).length + ' of ' + rows.length + ' answered';
}}
document.addEventListener('click', e => {{
  const o = e.target.closest('.opt');
  if (o) {{ const k = key(o.closest('tr')); picks[k] === o.dataset.v ? delete picks[k] : picks[k] = o.dataset.v; save(); paint(); return; }}
  const a = e.target.closest('.acc');
  if (a) {{ rows.filter(r => r.dataset.g === a.dataset.g && r.dataset.rec && !picks[key(r)]).forEach(r => picks[key(r)] = r.dataset.rec); save(); paint(); }}
}});
document.getElementById('copyout').addEventListener('click', async () => {{
  const by = {{ day: [], month: [], skip: [] }};
  for (const tr of rows) {{ const v = picks[key(tr)]; if (v) by[v].push(tr.dataset.ids + '  ' + tr.dataset.label); }}
  const answered = rows.filter(r => picks[key(r)]).length;
  const t = ['DATE PRECISION: ' + answered + ' of ' + rows.length + ' answered', '',
    'REAL DATE (' + by.day.length + ')', ...by.day, '', 'MONTH ONLY (' + by.month.length + ')', ...by.month, '', 'NOT SURE (' + by.skip.length + ')', ...by.skip].join('\\n');
  try {{ await navigator.clipboard.writeText(t); }} catch (e) {{ const ta = document.createElement('textarea'); ta.value = t; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); }}
  const el = document.getElementById('toast'); el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 1500);
}});
paint();
</script></body></html>'''
    assert '�' not in page
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8').write(page)
    print(OUT, len(rows), 'shows', dict(stats))


if __name__ == '__main__':
    main()

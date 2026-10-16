"""The Source review (docs/ux-research, data quality): every visible record with no
RecordingType, the clue its own data gives, two stills, and Pro-shot / Audience / Not sure per row.

    python3 tools/source-review/build.py      # renders ~/VaultShots/reports/source-review.html

Karl picks on the page (saved in his browser) and pastes "Copy for Claude Code" into a session;
tools/source-review/apply.py writes the picks. Records answered drop off the page on the next
build. Read-only: this script writes only the page.
"""
import json, collections, re, html, os
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.expanduser('~/VaultShots/reports/source-review.html')
d = [s for s in json.load(open(f'{REPO}/public/shows.json')) if s.get('Hidden') != 'Yes']
manifest = json.load(open(f'{REPO}/public/image-manifest.json'))
key = lambda s: (s['Artist'], s.get('ShowDate'), s.get('EventOrFestival') or '', s.get('VenueName') or '', s.get('City') or '', s.get('Country') or '', s.get('ContentType') or '')
grp = collections.defaultdict(list)
for s in d:
    if s.get('ShowDate'): grp[key(s)].append(s)
ev = collections.defaultdict(collections.Counter)
for s in d:
    if s.get('RecordingType') and s.get('EventOrFestival'): ev[s['EventOrFestival']][s['RecordingType']] += 1
TV = {'David Letterman','Jools Holland','Jimmy Fallon','Jay Leno',"Conan O'Brien",'Jimmy Kimmel','Carson Daly','Saturday Night Live','MTV Unplugged','Farm Club','Much Music Intimate & Interactive','Nissan Live Sets on Yahoo! Music'}
BROAD = re.compile(r'\b(pro-?shot|pro shot|tv|broadcast|dvb|satellite|tv-?rip|hdtv|mtv|vh1|vh2|bbc|itv|channel 4|rockpalast|arte|zdf|wdr|ard|3sat|canal\+?|much ?music|fuse|webcast|live ?stream|aol|yahoo|pbs|nhk|wowow|rtl|vpro|nps|bnn|dr2|svt|nrk|rai|mtv2|kerrang|scuzz)\b', re.I)
AUD = re.compile(r'\b(aud|audience|camcorder|handheld|cam shot|amateur)\b', re.I)
FIELDS = [('Notes', 'Notes'), ('Lineage', 'Lineage'), ('SourceEquipment', 'Source equipment'), ('PrivateNotes', 'Private notes'), ('FolderName', 'Folder name')]
NAME = {'Proshot': 'Pro-shot', 'Audience': 'Audience', 'Soundboard': 'Soundboard'}

def snippet(s, rx):
    for f, label in FIELDS:
        t = s.get(f) or ''
        m = rx.search(t)
        if m:
            a, b = max(0, m.start() - 60), min(len(t), m.end() + 60)
            txt = ' '.join(t[a:b].split())
            return label, ('…' if a else '') + txt + ('…' if b < len(t) else ''), m.group(0)
    return None

def date_name(v):
    if not v: return 'Undated'
    return v[:4] if v.endswith('-01-01') else v

def quality(s):
    try: w, h = int(s.get('Width') or 0), int(s.get('Height') or 0)
    except ValueError: return ''
    if not w or not h: return ''
    if h >= 1000: return 'HD 1080'
    if h >= 700: return 'HD 720'
    if w <= 360 or h <= 300: return 'Low-res'
    return f'SD {h}'

def length(s):
    t = round(int(s.get('DurationSec') or 0) / 60)
    if not t: return ''
    return f'{t // 60}h {t % 60:02d}m' if t >= 60 else f'{t} min'

GROUPS = [
    ('copy', 'Another copy of the same show has a source', 'strong'),
    ('tv', 'A TV programme', 'strong'),
    ('notes', 'The record’s own notes say how it was filmed', 'strong'),
    ('weak', 'A weaker clue: HD, or the event’s other records', 'possible'),
    ('none', 'No clue in the record: judge from the stills', None),
]
rows = []
for s in d:
    if (s.get('RecordingType') or '').strip(): continue
    sibs = [x for x in grp.get(key(s), []) if x is not s and x.get('RecordingType')]
    e = s.get('EventOrFestival') or ''
    h = int(s.get('Height') or 0) if str(s.get('Height') or '').isdigit() else 0
    evc = ev.get(e)
    aud, broad = snippet(s, AUD), snippet(s, BROAD)
    if sibs and len({x['RecordingType'] for x in sibs}) == 1:
        g, rec = 'copy', sibs[0]['RecordingType']
        why = f'{len(sibs)} other {"copy" if len(sibs) == 1 else "copies"} of this show {"is" if len(sibs) == 1 else "are"} {NAME[rec]}: ' + ', '.join(f'{x["ShowID"]} ({quality(x) or "?"}, {length(x) or "?"})' for x in sibs[:3])
    elif e in TV:
        g, rec, why = 'tv', 'Proshot', f'Event: {e} (a TV programme)'
    elif aud:
        # Weaker on purpose: 868 of 884 sourced records are Pro-shot, and these
        # notes often describe a whole disc, not this titleset.
        g, rec = 'weak', 'Audience'
        why = f'{aud[0]} mention “{aud[2]}”: {aud[1]}'
    elif broad:
        g, rec = 'notes', 'Proshot'
        why = f'{broad[0]} mention “{broad[2]}”: {broad[1]}'
    elif h >= 700:
        g, rec, why = 'weak', 'Proshot', f'{quality(s)}: HD recordings in the collection are broadcasts or webcasts'
    elif evc and sum(evc.values()) >= 3 and evc.most_common(1)[0][1] / sum(evc.values()) >= 0.8:
        top, n = evc.most_common(1)[0]
        g, rec, why = 'weak', top, f'{e}: {n} of the {sum(evc.values())} other records with a source are {NAME[top]}'
    else:
        g, rec, why = 'none', '', 'Nothing in the record says. 868 of the 884 records with a source are Pro-shot.'
    cs = s.get('ChecksumSHA1') or ''
    slots = manifest.get(cs, [])[:2]
    imgs = [(f'file://{REPO}/node_modules/.cache/vault-thumbs/{cs}_0{i}.webp', f'file://{REPO}/public/images/{cs}_0{i}.jpg') for i in slots]
    place = ' · '.join(x for x in [e, s.get('VenueName') if s.get('VenueName') not in (e, s.get('City')) else '', ', '.join(x for x in [s.get('City'), s.get('Country')] if x)] if x)
    rows.append(dict(id=s['ShowID'], g=g, rec=rec, why=why, artist=s['Artist'], date=date_name(s.get('ShowDate')), place=place,
                     spec=' · '.join(x for x in [quality(s), length(s), s.get('TVStandard') if quality(s)[:2] != 'HD' else ''] if x), imgs=imgs,
                     doc=s.get('ContentType') == 'Documentary'))
order = {g[0]: i for i, g in enumerate(GROUPS)}
rows.sort(key=lambda r: (order[r['g']], r['artist'].lower(), r['date']))
for i, r in enumerate(rows, 1): r['n'] = i

E = html.escape
parts = []
for gk, title, strength in GROUPS:
    gr = [r for r in rows if r['g'] == gk]
    if not gr: continue
    accept = f'<button class="acc" data-g="{gk}">Accept the suggestion for all {len(gr)}</button>' if strength else ''
    parts.append(f'<h2 id="g-{gk}">{E(title)}<span>{len(gr)}</span></h2><div class="tools">{accept}</div><table>')
    for r in gr:
        ims = ''.join(f'<div class="im"><img loading="lazy" src="{E(t)}" onerror="this.onerror=null;this.src=\'{E(o)}\'"></div>' for t, o in r['imgs']) or '<div class="im none">no stills</div>'
        tag = f'<span class="str {strength}">{"strong clue" if strength == "strong" else "weaker clue"}</span>' if strength else ''
        opts = ''.join(
            f'<button class="opt{" rec" if v == r["rec"] else ""}" data-v="{v}"><span class="k">{k}</span>{lab}{" <em>suggested</em>" if v == r["rec"] else ""}</button>'
            for k, v, lab in [('P', 'Proshot', 'Pro-shot'), ('A', 'Audience', 'Audience'), ('?', 'skip', 'Not sure: leave blank')])
        parts.append(f'''<tr data-id="{r["id"]}" data-g="{gk}" data-rec="{r["rec"]}" data-label="{E(r["artist"] + " · " + r["date"])}">
<td class="n">{r["n"]}</td><td class="th"><div class="ims">{ims}</div></td>
<td><div class="art">{E(r["artist"])}{' <span class="tag">Documentary</span>' if r["doc"] else ''}</div><div class="sub">{E(r["date"])}{' · ' + E(r["place"]) if r["place"] else ''}</div>
<div class="sub">{E(r["spec"])}</div><div class="why">{tag} {E(r["why"])}</div><div class="mono">{r["id"]}</div></td>
<td class="chc"><div class="ch">{opts}</div></td></tr>''')
    parts.append('</table>')

stats = collections.Counter(r['g'] for r in rows)
page = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Source review</title>
<style>
  @font-face {{ font-family: 'DM Sans'; src: url('file://{REPO}/public/fonts/dm-sans-latin.woff2') format('woff2'); font-weight: 100 1000; }}
  :root {{ color-scheme: dark; --g200:#e5e7eb; --g300:#d1d5db; --g400:#9ca3af; --g500:#6b7280; --line: rgba(255,255,255,.08); }}
  * {{ box-sizing: border-box; }} body {{ margin: 0; background: #141414; color: #fff; font: 14px/1.45 'DM Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }}
  button {{ font: inherit; color: inherit; cursor: pointer; }}
  header {{ position: sticky; top: 0; z-index: 10; background: rgba(20,20,20,.97); backdrop-filter: blur(12px); border-bottom: 1px solid var(--line); }}
  .bar {{ max-width: 1480px; margin: 0 auto; padding: 12px 24px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }}
  h1 {{ font-size: 18px; margin: 0 8px 0 0; }}
  .bar a {{ color: var(--g400); text-decoration: none; font-size: 13px; padding: 6px 12px; border-radius: 999px; background: rgba(255,255,255,.06); }}
  .bar a:hover {{ background: rgba(255,255,255,.12); color: #fff; }}
  .sp {{ flex: 1; }} .prog {{ color: var(--g300); font-size: 13px; font-variant-numeric: tabular-nums; }}
  .copy {{ border: 0; border-radius: 999px; background: #fff; color: #111; font-weight: 600; padding: 8px 16px; font-size: 13px; }}
  main {{ max-width: 1480px; margin: 0 auto; padding: 8px 24px 80px; }}
  h2 {{ font-size: 12px; letter-spacing: .2em; text-transform: uppercase; color: var(--g400); margin: 40px 0 6px; font-weight: 600; scroll-margin-top: 70px; }}
  h2 span {{ letter-spacing: 0; text-transform: none; font-weight: 400; color: rgba(255,255,255,.5); margin-left: 8px; }}
  .lead {{ color: var(--g400); margin: 16px 0 6px; max-width: 920px; }} .lead b {{ color: var(--g200); font-weight: 500; }}
  table {{ width: 100%; border-collapse: collapse; }}
  td {{ padding: 12px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }}
  tr.done td {{ background: rgba(167,139,250,.04); }}
  .n {{ color: var(--g400); font-variant-numeric: tabular-nums; width: 40px; }}
  .th {{ width: 400px; }} .ims {{ display: flex; gap: 8px; }}
  .im {{ width: 190px; aspect-ratio: 4/3; border-radius: 6px; overflow: hidden; background: #222; }} .im.none {{ display: grid; place-items: center; color: var(--g400); font-size: 12px; }}
  .im img {{ width: 100%; height: 100%; object-fit: cover; display: block; }}
  .art {{ font-weight: 600; font-size: 15px; }} .sub {{ color: var(--g300); font-size: 13px; }} .mono {{ font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: var(--g400); margin-top: 6px; }}
  .why {{ color: var(--g300); font-size: 13px; margin-top: 8px; max-width: 560px; }}
  .tag {{ display: inline-block; font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: rgba(167,139,250,.2); color: #c4b5fd; margin-left: 6px; }}
  .str {{ display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; padding: 3px 7px; border-radius: 4px; margin-right: 4px; }}
  .str.strong {{ background: rgba(52,211,153,.15); color: #6ee7b7; }} .str.possible {{ background: rgba(251,191,36,.12); color: #fcd34d; }}
  .chc {{ width: 230px; }} .ch {{ display: flex; flex-direction: column; gap: 6px; }}
  .opt {{ text-align: left; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.04); border-radius: 8px; padding: 7px 10px; font-size: 13px; display: flex; gap: 8px; align-items: center; }}
  .opt:hover {{ background: rgba(255,255,255,.08); }} .opt em {{ font-style: normal; font-size: 11px; color: #6ee7b7; margin-left: auto; }}
  .opt .k {{ width: 20px; height: 20px; flex: none; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 700; background: rgba(255,255,255,.1); }}
  .opt.on {{ border-color: #a78bfa; background: rgba(167,139,250,.14); }} .opt.on .k {{ background: #a78bfa; color: #111; }}
  .tools {{ margin: 4px 0 8px; }} .acc {{ border: 1px solid rgba(255,255,255,.15); background: rgba(255,255,255,.08); border-radius: 999px; padding: 6px 14px; font-size: 13px; }}
  .acc:hover {{ background: rgba(255,255,255,.14); }}
  .toast {{ position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: #fff; color: #111; padding: 10px 16px; border-radius: 999px; font-weight: 600; opacity: 0; transition: opacity .2s; }} .toast.on {{ opacity: 1; }}
</style></head><body>
<header><div class="bar"><h1>Source review</h1>
{''.join(f'<a href="#g-{g}">{E(t.split(":")[0])} {stats[g]}</a>' for g, t, _ in GROUPS if stats[g])}
<span class="sp"></span><span class="prog" id="prog"></span><button class="copy" id="copy">Copy for Claude Code</button></div></header>
<main>
<p class="lead"><b>{len(rows)} shows on the site don’t say how they were filmed</b>, so a trader can’t tell a broadcast from a camcorder copy, and a Source filter would hide them. Each row gives what the record’s own data suggests and two stills. Pick <b>Pro-shot</b>, <b>Audience</b>, or <b>Not sure</b> (it stays blank). Your picks save in this browser; when you’re done, or part-way, press <b>Copy for Claude Code</b> and paste it into the chat.</p>
<p class="lead">The strong groups can be accepted in one click, then any row changed. Rows you don’t answer are left as they are.</p>
{''.join(parts)}
</main><div class="toast" id="toast">Copied</div>
<script>
const KEY = 'vault-source-review-2026-10-16';
let picks = {{}}; try {{ picks = JSON.parse(localStorage.getItem(KEY) || '{{}}'); }} catch (e) {{}}
const save = () => {{ try {{ localStorage.setItem(KEY, JSON.stringify(picks)); }} catch (e) {{}} }};
const rows = [...document.querySelectorAll('tr[data-id]')];
function paint() {{
  for (const tr of rows) {{ const v = picks[tr.dataset.id]; tr.classList.toggle('done', !!v); tr.querySelectorAll('.opt').forEach(b => b.classList.toggle('on', b.dataset.v === v)); }}
  document.getElementById('prog').textContent = Object.keys(picks).length + ' of ' + rows.length + ' answered';
}}
document.addEventListener('click', e => {{
  const o = e.target.closest('.opt');
  if (o) {{ const id = o.closest('tr').dataset.id; picks[id] === o.dataset.v ? delete picks[id] : picks[id] = o.dataset.v; save(); paint(); return; }}
  const a = e.target.closest('.acc');
  if (a) {{ rows.filter(r => r.dataset.g === a.dataset.g && r.dataset.rec && !picks[r.dataset.id]).forEach(r => picks[r.dataset.id] = r.dataset.rec); save(); paint(); }}
}});
document.getElementById('copy').addEventListener('click', async () => {{
  const by = {{ Proshot: [], Audience: [], skip: [] }};
  for (const tr of rows) {{ const v = picks[tr.dataset.id]; if (v) by[v].push(tr.dataset.id + '  ' + tr.dataset.label + (tr.dataset.rec && tr.dataset.rec !== v && v !== 'skip' ? '  (changed from the suggestion)' : '')); }}
  const t = ['SOURCE REVIEW: ' + Object.keys(picks).length + ' of ' + rows.length + ' answered', '',
    'PRO-SHOT (' + by.Proshot.length + ')', ...by.Proshot, '', 'AUDIENCE (' + by.Audience.length + ')', ...by.Audience, '', 'NOT SURE, LEAVE BLANK (' + by.skip.length + ')', ...by.skip].join('\\n');
  try {{ await navigator.clipboard.writeText(t); }} catch (e) {{ const ta = document.createElement('textarea'); ta.value = t; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); }}
  const el = document.getElementById('toast'); el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 1500);
}});
paint();
</script></body></html>'''
assert '�' not in page
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'w').write(page)
print(OUT, len(rows), 'rows', dict(stats))

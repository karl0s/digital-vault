"""Picture size: where the drive scan's source contradicts a record's Width x Height.

    python3 tools/drive-scan/sizes.py page                       # ~/VaultShots/reports/picture-size.html
    python3 tools/drive-scan/sizes.py apply <picks.txt>          # dry run
    python3 tools/drive-scan/sizes.py apply <picks.txt> --apply

The owner's rule (2026-10-18): a record's Width and Height change only once he is sure the
source's are right, and a SMALLER size is quality-checked first. The evidence on each row is the
record's own stills: the capture tool grows the under-sampled axis to the display shape and
never upscales past native, so a 768 x 576 still came from a 576-line source and a 720 x 540 one
from a 480-line source. Where the stills agree with the source, the source is recommended; where
they agree with the record, keeping the record is. Writes only Width and Height, for accepted
rows, with a PrivateNotes entry under PICTURE SIZE (date).
"""
import datetime, html, json, re, sys
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from page import REPO, SCAN, prepared  # noqa: E402

SHOWS = REPO / 'public' / 'shows.json'
OUT = Path.home() / 'VaultShots' / 'reports' / 'picture-size.html'


def lines_from_still(h):
    """A still's height is the source's line count (576, 480 grown to 540, 352, 288…)."""
    return {540: 480, 528: 480}.get(h, h)


def rows():
    shows = {s['ShowID']: s for s in json.load(open(SHOWS, encoding='utf-8'))}
    out = []
    for r in prepared(json.load(open(SCAN)), shows):
        s = shows.get(r['ShowID'])
        if not s or not r.get('found') or r.get('inherited') or not r.get('height'):
            continue
        try:
            rw, rh = int(s['Width']), int(s['Height'])
        except (KeyError, TypeError, ValueError):
            continue
        sw, sh = int(r['width']), int(r['height'])
        if rh == sh:
            continue
        still = None
        cs = s.get('ChecksumSHA1')
        if cs and (REPO / 'public' / 'images' / f'{cs}_01.jpg').exists():
            still = Image.open(REPO / 'public' / 'images' / f'{cs}_01.jpg').size
        bigger = sw * sh > rw * rh
        seen = lines_from_still(still[1]) if still else None
        if seen == sh:
            verdict, why = 'source', f'Your still is {still[0]} × {still[1]}: it came from a {sh}-line source, as the drive says.'
        elif seen == rh:
            verdict, why = 'keep', f'Your still is {still[0]} × {still[1]}: it came from a {rh}-line source, as the record says. The scan most likely read another titleset.'
        else:
            verdict, why = 'check', f'Your still ({still[0]} × {still[1]}) matches neither.' if still else 'No still to compare.'
        out.append(dict(id=s['ShowID'], artist=s['Artist'], date=s.get('ShowDate') or 'Undated', cs=cs, rec=(rw, rh), src=(sw, sh),
                        bigger=bigger, still=still, verdict=verdict, why=why, aspect=s.get('AspectRatio') or '',
                        file=(r.get('paths') or [''])[0]))
    return out


def page():
    E = html.escape
    rs = rows()
    groups = [
        ('bigger', 'Bigger: the source has more lines than the record says', [r for r in rs if r['bigger']]),
        ('smaller', 'Smaller: the source has fewer lines (checked against your stills)', [r for r in rs if not r['bigger']]),
    ]
    parts = []
    for key, title, gr in groups:
        parts.append(f'<h2>{E(title)}<span>{len(gr)}</span></h2><table>')
        for r in gr:
            img = f'<img src="file://{E(str(REPO))}/public/images/{E(r["cs"])}_01.jpg">' if r['still'] else ''
            rec = 'source' if r['verdict'] == 'source' else 'keep'
            opts = (f'<button class="opt{" rec" if rec == "source" else ""}" data-v="source"><span class="k">S</span>Use the source: {r["src"][0]} × {r["src"][1]}{" <em>suggested</em>" if rec == "source" else ""}</button>'
                    f'<button class="opt{" rec" if rec == "keep" else ""}" data-v="keep"><span class="k">K</span>Keep the record: {r["rec"][0]} × {r["rec"][1]}{" <em>suggested</em>" if rec == "keep" else ""}</button>')
            parts.append(f'''<tr data-id="{r['id']}" data-rec="{rec}" data-label="{E(r['artist'] + ' · ' + r['date'])}">
<td class="th">{img}<div class="sub">still {r['still'][0] if r['still'] else '?'} × {r['still'][1] if r['still'] else '?'}</div></td>
<td><div class="art">{E(r['artist'])} <span class="sub">{E(r['date'])} · {E(r['id'])}</span></div>
<div class="chg">record <b>{r['rec'][0]} × {r['rec'][1]}</b> · drive <b class="{'up' if r['bigger'] else 'down'}">{r['src'][0]} × {r['src'][1]}</b> <span class="tag {'up' if r['bigger'] else 'down'}">{'bigger' if r['bigger'] else 'SMALLER'}</span></div>
<div class="why">{E(r['why'])}</div><div class="sub">aspect {E(r['aspect'])} · the scan read: {E(r['file'])}</div></td>
<td class="chc"><div class="ch">{opts}</div></td></tr>''')
        parts.append('</table>')
    doc = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Picture size</title><style>
:root{{color-scheme:dark;--line:rgba(255,255,255,.08)}} *{{box-sizing:border-box}} body{{margin:0;background:#141414;color:#fff;font:14px/1.5 system-ui,sans-serif}} button{{font:inherit;color:inherit;cursor:pointer}}
header{{position:sticky;top:0;z-index:10;background:rgba(20,20,20,.97);border-bottom:1px solid var(--line)}} .bar{{max-width:1200px;margin:0 auto;padding:12px 24px;display:flex;gap:12px;align-items:center}}
h1{{font-size:18px;margin:0}} .sp{{flex:1}} .prog{{color:#d1d5db;font-size:13px}} .copy,.all{{border:0;border-radius:999px;font-weight:600;padding:8px 16px;font-size:13px}} .copy{{background:#fff;color:#111}} .all{{background:#6ee7b7;color:#052e1c}}
main{{max-width:1200px;margin:0 auto;padding:8px 24px 80px}} .lead{{color:#d1d5db;max-width:900px}} .lead b{{color:#fff}}
h2{{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#9ca3af;margin:34px 0 6px}} h2 span{{letter-spacing:0;color:rgba(255,255,255,.5);margin-left:8px}}
table{{width:100%;border-collapse:collapse}} td{{padding:12px 10px;border-bottom:1px solid var(--line);vertical-align:top}} tr.done td{{background:rgba(167,139,250,.05)}}
.th{{width:230px}} .th img{{width:210px;border-radius:6px;display:block}} .art{{font-weight:600;font-size:15px}} .sub{{color:#9ca3af;font-size:13px;font-weight:400}}
.chg{{margin:4px 0;font-size:15px;color:#d1d5db}} .chg b{{color:#fff}} b.down{{color:#fca5a5}} b.up{{color:#86efac}} .why{{color:#e5e7eb;font-size:13px;max-width:620px;margin:4px 0}}
.tag{{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.08em;padding:2px 7px;border-radius:4px;margin-left:6px}} .tag.up{{background:rgba(52,211,153,.15);color:#6ee7b7}} .tag.down{{background:rgba(248,113,113,.18);color:#fca5a5}}
.chc{{width:300px}} .ch{{display:flex;flex-direction:column;gap:6px}}
.opt{{text-align:left;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);border-radius:8px;padding:7px 10px;font-size:13px;display:flex;gap:8px;align-items:center}} .opt em{{font-style:normal;font-size:11px;color:#6ee7b7;margin-left:auto}}
.opt .k{{width:20px;height:20px;flex:none;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700;background:rgba(255,255,255,.1)}} .opt.on{{border-color:#a78bfa;background:rgba(167,139,250,.14)}} .opt.on .k{{background:#a78bfa;color:#111}}
.toast{{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#fff;color:#111;padding:10px 16px;border-radius:999px;font-weight:600;opacity:0;transition:opacity .2s}} .toast.on{{opacity:1}}
</style></head><body>
<header><div class="bar"><h1>Picture size</h1><span class="sp"></span><span class="prog" id="prog"></span><button class="all" id="all">Accept the suggestions</button><button class="copy" id="copyout">Copy for Claude Code</button></div></header>
<main><p class="lead">The drive says these records' picture is a different size from what they store. <b>Nothing changes until you choose.</b> The judge on each row is your own still: the capture tool draws a still at the picture's real shape and never enlarges past what the source has, so its height tells which source it came from (a 768 × 576 still, a 576-line source; a 720 × 540 one, a 480-line source). <span style="color:#86efac">Green</span> means the drive's size is bigger, <span style="color:#fca5a5">red</span> smaller.</p>
{''.join(parts)}</main><div class="toast" id="toast">Copied</div>
<script>
const KEY='vault-picture-size-2026-10-18'; let picks={{}}; try{{picks=JSON.parse(localStorage.getItem(KEY)||'{{}}')}}catch(e){{}}
const save=()=>{{try{{localStorage.setItem(KEY,JSON.stringify(picks))}}catch(e){{}}}}; const rows=[...document.querySelectorAll('tr[data-id]')];
function paint(){{for(const tr of rows){{const v=picks[tr.dataset.id];tr.classList.toggle('done',!!v);tr.querySelectorAll('.opt').forEach(b=>b.classList.toggle('on',b.dataset.v===v))}}document.getElementById('prog').textContent=rows.filter(r=>picks[r.dataset.id]).length+' of '+rows.length+' answered'}}
document.addEventListener('click',e=>{{const o=e.target.closest('.opt');if(o){{const k=o.closest('tr').dataset.id;picks[k]===o.dataset.v?delete picks[k]:picks[k]=o.dataset.v;save();paint()}}}});
document.getElementById('all').addEventListener('click',()=>{{rows.forEach(r=>{{if(!picks[r.dataset.id])picks[r.dataset.id]=r.dataset.rec}});save();paint()}});
document.getElementById('copyout').addEventListener('click',async()=>{{const by={{source:[],keep:[]}};for(const tr of rows){{const v=picks[tr.dataset.id];if(v)by[v].push(tr.dataset.id+'  '+tr.dataset.label)}}
const t=['PICTURE SIZE: '+(by.source.length+by.keep.length)+' of '+rows.length+' answered','','USE THE SOURCE ('+by.source.length+')',...by.source,'','KEEP THE RECORD ('+by.keep.length+')',...by.keep].join('\\n');
try{{await navigator.clipboard.writeText(t)}}catch(e){{const ta=document.createElement('textarea');ta.value=t;document.body.append(ta);ta.select();document.execCommand('copy');ta.remove()}}
const el=document.getElementById('toast');el.classList.add('on');setTimeout(()=>el.classList.remove('on'),1500)}});
paint();
</script></body></html>'''
    assert '�' not in doc
    OUT.write_text(doc, encoding='utf-8')
    print(OUT, len(rs), 'rows:', sum(r['bigger'] for r in rs), 'bigger,', sum(not r['bigger'] for r in rs), 'smaller;',
          {v: sum(r['verdict'] == v for r in rs) for v in ('source', 'keep', 'check')})


def apply(text, write):
    use = set()
    section = None
    for line in text.splitlines():
        head = re.match(r'^(USE THE SOURCE|KEEP THE RECORD)', line.strip())
        if head:
            section = head.group(1)
            continue
        m = re.match(r'^([0-9a-f]{12})\s', line.strip() + ' ')
        if m and section == 'USE THE SOURCE':
            use.add(m.group(1))
    raw = SHOWS.read_text(encoding='utf-8')
    shows = json.loads(raw)
    if json.dumps(shows, indent=2, ensure_ascii=False) + '\n' != raw:
        sys.exit('shows.json is not in its usual format; not touching it')
    by_id = {s['ShowID']: s for s in shows}
    plan = [r for r in rows() if r['id'] in use]
    for r in plan:
        print(f"  {r['id']}  {r['artist']}: {r['rec'][0]} x {r['rec'][1]} -> {r['src'][0]} x {r['src'][1]} ({'bigger' if r['bigger'] else 'SMALLER'})")
    print(f'{len(plan)} to write')
    if not write:
        print('Dry run. Add --apply to write.')
        return
    today = datetime.date.today().isoformat()
    for r in plan:
        s = by_id[r['id']]
        s['Width'], s['Height'] = str(r['src'][0]), str(r['src'][1])
        note = (f"PICTURE SIZE ({today}): Width x Height {r['rec'][0]} x {r['rec'][1]} -> {r['src'][0]} x {r['src'][1]}, the owner's choice "
                f"on the picture-size review: the drive's source says so, and {r['why']}")
        prev = (s.get('PrivateNotes') or '').rstrip()
        s['PrivateNotes'] = f'{prev}\n\n{note}' if prev else note
    out = json.dumps(shows, indent=2, ensure_ascii=False) + '\n'
    assert '�' not in out
    SHOWS.write_text(out, encoding='utf-8')
    print(f'Wrote {len(plan)}. Next: python3 scripts/audit-image-geometry.py, the health check, commit.')


if __name__ == '__main__':
    if len(sys.argv) >= 2 and sys.argv[1] == 'page':
        page()
    elif len(sys.argv) >= 3 and sys.argv[1] == 'apply':
        apply(open(sys.argv[2], encoding='utf-8').read(), '--apply' in sys.argv)
    else:
        sys.exit(__doc__)

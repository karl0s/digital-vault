"""Dates researched online for the shows the date-precision review couldn't settle.

    python3 tools/date-precision/research.py page  <results.json>             # renders the review page
    python3 tools/date-precision/research.py apply <results.json> <picks.txt>  # dry run
    python3 tools/date-precision/research.py apply <results.json> <picks.txt> --apply

results.json is a list of findings, one per show (its copies together):
  {"ids", "artist", "stored_date", "verdict": first-is-real | different-date | month-only | unknown,
   "date": "YYYY-MM-DD" | "YYYY-MM" | null, "source_title", "source_url", "evidence", "note"}
One fetched source per date was enough by the owner's word (2026-10-17), not CLAUDE.md's two.
The page (~/VaultShots/reports/date-research.html) shows each finding beside the stored date with
its source; Karl accepts all or some, and pastes "Copy for Claude Code". apply then writes, for
every copy of an accepted show: a different date -> ShowDate (DatePrecision cleared); the 1st
confirmed -> DatePrecision "day"; month only -> ShowDate YYYY-MM-01 and DatePrecision "month".
Each record notes the change and its source in PrivateNotes under DATE (date).
"""
import datetime, html, json, os, re, sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SHOWS = os.path.join(REPO, 'public', 'shows.json')
PAGE = os.path.expanduser('~/VaultShots/reports/date-research.html')
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
GROUPS = [
    ('different-date', 'A different date was found: the stored one is a placeholder or wrong'),
    ('first-is-real', 'The 1st is the real date'),
    ('month-only', 'Only the month could be confirmed'),
    ('unknown', 'Not found: left as they are'),
]


def proposal(r):
    """What accepting the finding would store: (ShowDate, DatePrecision or None), or None."""
    d, v = r.get('date') or '', r['verdict']
    if v == 'different-date' and re.fullmatch(r'\d{4}-\d{2}-\d{2}', d):
        return d, None
    if v == 'first-is-real':
        return r['stored_date'], 'day'
    if v == 'month-only' and re.fullmatch(r'\d{4}-\d{2}', d[:7]):
        return f'{d[:7]}-01', 'month'
    return None


def shown(date, precision):
    if precision == 'month':
        return f'{MONTHS[int(date[5:7]) - 1]} {date[:4]}'
    return date


def page(results):
    E = html.escape
    parts = []
    n = 0
    for g, title in GROUPS:
        gr = [r for r in results if r['verdict'] == g]
        if not gr:
            continue
        parts.append(f'<h2 id="g-{g}">{E(title)}<span>{len(gr)}</span></h2><table>')
        for r in gr:
            n += 1
            p = proposal(r)
            src = r.get('source_url') or ''
            link = f'<a href="{E(src)}" target="_blank">{E(r.get("source_title") or src)}</a>' if src.startswith('http') else E(r.get('source_title') or src or '—')
            change = (f'<span class="old">{E(r["stored_date"])}</span> → <span class="new">{E(shown(*p))}</span>' if p and p[0] != r['stored_date'] or (p and p[1] == 'month')
                      else (f'<span class="new">{E(r["stored_date"])}</span> confirmed' if p else '<span class="old">no change</span>'))
            choice = (f'<div class="ch"><button class="opt rec" data-v="accept"><span class="k">A</span>Accept</button>'
                      f'<button class="opt" data-v="keep"><span class="k">K</span>Keep as it is</button></div>') if p else ''
            parts.append(f'''<tr data-ids="{' '.join(r['ids'])}" data-g="{g}" data-label="{E(r['artist'] + ' · ' + r['stored_date'])}">
<td class="n">{n}</td><td><div class="art">{E(r['artist'])}{f" <span class='sub'>{len(r['ids'])} copies</span>" if len(r['ids']) > 1 else ''}</div>
<div class="chg">{change}</div><div class="why">{E(r.get('evidence') or '')}</div>
<div class="sub">Source: {link}{(' · ' + E(r['note'])) if r.get('note') else ''}</div></td><td class="chc">{choice}</td></tr>''')
        parts.append('</table>')
    counts = {g: sum(r['verdict'] == g for r in results) for g, _ in GROUPS}
    nav = ''.join(f'<a href="#g-{g}">{E(t.split(":")[0])} {counts[g]}</a>' for g, t in GROUPS if counts[g])
    doc = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Date research</title><style>
:root{{color-scheme:dark;--g300:#d1d5db;--g400:#9ca3af;--line:rgba(255,255,255,.08)}} *{{box-sizing:border-box}}
body{{margin:0;background:#141414;color:#fff;font:14px/1.5 system-ui,sans-serif}} button{{font:inherit;color:inherit;cursor:pointer}} a{{color:#93c5fd}}
header{{position:sticky;top:0;z-index:10;background:rgba(20,20,20,.97);border-bottom:1px solid var(--line)}}
.bar{{max-width:1200px;margin:0 auto;padding:12px 24px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}} h1{{font-size:18px;margin:0 8px 0 0}}
.bar a{{color:var(--g300);text-decoration:none;font-size:13px;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.06)}} .sp{{flex:1}} .prog{{color:var(--g300);font-size:13px}}
.copy,.all{{border:0;border-radius:999px;font-weight:600;padding:8px 16px;font-size:13px}} .copy{{background:#fff;color:#111}} .all{{background:#6ee7b7;color:#052e1c}}
main{{max-width:1200px;margin:0 auto;padding:8px 24px 80px}} .lead{{color:var(--g300);max-width:900px;margin:16px 0 6px}} .lead b{{color:#fff}}
h2{{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--g400);margin:36px 0 6px;font-weight:600;scroll-margin-top:70px}} h2 span{{letter-spacing:0;text-transform:none;font-weight:400;color:rgba(255,255,255,.5);margin-left:8px}}
table{{width:100%;border-collapse:collapse}} td{{padding:12px 10px;border-bottom:1px solid var(--line);vertical-align:top}} tr.done td{{background:rgba(167,139,250,.05)}}
.n{{color:var(--g400);width:40px}} .art{{font-weight:600;font-size:15px}} .sub{{color:var(--g400);font-size:13px;font-weight:400}}
.chg{{margin:4px 0;font-size:15px}} .old{{color:var(--g400)}} .new{{color:#fde68a;font-weight:600}} .why{{color:var(--g300);font-size:13px;max-width:700px}}
.chc{{width:220px}} .ch{{display:flex;flex-direction:column;gap:6px}}
.opt{{text-align:left;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);border-radius:8px;padding:7px 10px;font-size:13px;display:flex;gap:8px;align-items:center}}
.opt .k{{width:20px;height:20px;flex:none;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700;background:rgba(255,255,255,.1)}}
.opt.on{{border-color:#a78bfa;background:rgba(167,139,250,.14)}} .opt.on .k{{background:#a78bfa;color:#111}}
.toast{{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#fff;color:#111;padding:10px 16px;border-radius:999px;font-weight:600;opacity:0;transition:opacity .2s}} .toast.on{{opacity:1}}
</style></head><body>
<header><div class="bar"><h1>Date research</h1>{nav}<span class="sp"></span><span class="prog" id="prog"></span><button class="all" id="all">Accept all</button><button class="copy" id="copyout">Copy for Claude Code</button></div></header>
<main><p class="lead">Each show below was dated the 1st of a month, which can be a placeholder. Its date was looked up online: <b>one page read per show</b>, as you asked, linked on each row with what it says. <b>Accept all</b> takes every finding; or accept or keep row by row. Then press <b>Copy for Claude Code</b> and paste it into the chat. Copies of a show change together.</p>
{''.join(parts)}</main><div class="toast" id="toast">Copied</div>
<script>
const KEY='vault-date-research-2026-10-17'; let picks={{}}; try{{picks=JSON.parse(localStorage.getItem(KEY)||'{{}}')}}catch(e){{}}
const save=()=>{{try{{localStorage.setItem(KEY,JSON.stringify(picks))}}catch(e){{}}}};
const rows=[...document.querySelectorAll('tr[data-ids]')].filter(r=>r.querySelector('.opt'));
function paint(){{for(const tr of rows){{const v=picks[tr.dataset.ids];tr.classList.toggle('done',!!v);tr.querySelectorAll('.opt').forEach(b=>b.classList.toggle('on',b.dataset.v===v))}}
document.getElementById('prog').textContent=rows.filter(r=>picks[r.dataset.ids]).length+' of '+rows.length+' answered'}}
document.addEventListener('click',e=>{{const o=e.target.closest('.opt');if(o){{const k=o.closest('tr').dataset.ids;picks[k]===o.dataset.v?delete picks[k]:picks[k]=o.dataset.v;save();paint()}}}});
document.getElementById('all').addEventListener('click',()=>{{rows.forEach(r=>{{if(!picks[r.dataset.ids])picks[r.dataset.ids]='accept'}});save();paint()}});
document.getElementById('copyout').addEventListener('click',async()=>{{const by={{accept:[],keep:[]}};for(const tr of rows){{const v=picks[tr.dataset.ids];if(v)by[v].push(tr.dataset.ids+'  '+tr.dataset.label)}}
const t=['DATE RESEARCH: '+(by.accept.length+by.keep.length)+' of '+rows.length+' answered','','ACCEPT ('+by.accept.length+')',...by.accept,'','KEEP ('+by.keep.length+')',...by.keep].join('\\n');
try{{await navigator.clipboard.writeText(t)}}catch(e){{const ta=document.createElement('textarea');ta.value=t;document.body.append(ta);ta.select();document.execCommand('copy');ta.remove()}}
const el=document.getElementById('toast');el.classList.add('on');setTimeout(()=>el.classList.remove('on'),1500)}});
paint();
</script></body></html>'''
    assert '�' not in doc
    os.makedirs(os.path.dirname(PAGE), exist_ok=True)
    open(PAGE, 'w', encoding='utf-8').write(doc)
    print(PAGE, counts)


def apply(results, picks_text, write):
    accepted = set()
    section = None
    for line in picks_text.splitlines():
        head = re.match(r'^(ACCEPT|KEEP)', line.strip())
        if head:
            section = head.group(1)
            continue
        m = re.match(r'^((?:[0-9a-f]{12} ?)+)\s', line.strip() + ' ')
        if m and section == 'ACCEPT':
            accepted.add(' '.join(m.group(1).split()))
    raw = open(SHOWS, encoding='utf-8').read()
    shows = json.loads(raw)
    if json.dumps(shows, indent=2, ensure_ascii=False) + '\n' != raw:
        sys.exit('shows.json is not in its usual format; not touching it')
    by_id = {s['ShowID']: s for s in shows}
    today = datetime.date.today().isoformat()
    plan = []
    for r in results:
        if ' '.join(r['ids']) not in accepted or not proposal(r):
            continue
        date, precision = proposal(r)
        for sid in r['ids']:
            s = by_id[sid]
            if s.get('ShowDate') != r['stored_date']:
                print(f'  skip {sid} {s["Artist"]}: its date changed since the research ({s.get("ShowDate")})')
                continue
            plan.append((s, date, precision, r))
    for s, date, precision, r in plan:
        print(f'  {s["ShowID"]}  {s["Artist"]}  {s["ShowDate"]} -> {shown(date, precision)}{"" if precision != "day" else " (confirmed)"}')
    print(f'{len(plan)} records to write')
    if not write:
        print('Dry run. Add --apply to write.')
        return
    for s, date, precision, r in plan:
        before = s['ShowDate']
        s['ShowDate'] = date
        if precision:
            s['DatePrecision'] = precision
        else:
            s.pop('DatePrecision', None)
        what = (f'ShowDate {before} -> {date}' if date != before else f'{before} confirmed as the real day') if precision != 'month' \
            else f'ShowDate {before} -> {date}, month only (DatePrecision month)'
        src = r.get('source_url') or 'own sidecar'
        note = (f"DATE ({today}): {what}, researched online for the owner, who said one source is enough. "
                f"Source: {r.get('source_title') or ''} ({src}). {r.get('evidence') or ''}").strip()
        prev = (s.get('PrivateNotes') or '').rstrip()
        s['PrivateNotes'] = f'{prev}\n\n{note}' if prev else note
    out = json.dumps(shows, indent=2, ensure_ascii=False) + '\n'
    assert '�' not in out
    open(SHOWS, 'w', encoding='utf-8').write(out)
    print(f'Wrote {len(plan)}. Next: node tools/taper-redaction/apply.mjs, python3 scripts/health-check.py, commit, rebuild the pages.')


if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    results = json.load(open(sys.argv[2], encoding='utf-8'))
    if sys.argv[1] == 'page':
        page(results)
    elif sys.argv[1] == 'apply' and len(sys.argv) >= 4:
        apply(results, open(sys.argv[3], encoding='utf-8').read(), '--apply' in sys.argv)
    else:
        sys.exit(__doc__)

"""The setlist research review: what the web research found for each show with no setlist.

    python3 tools/setlist-research/review.py     # renders ~/VaultShots/reports/setlist-research.html

Reads the research agents' results (~/VaultShots/setlist-research/results/<ShowID>.json, written
to BRIEF.md's rules) and recommends, for each show, add or leave, and why:

  add    two or more independent sources, fetched and read, agree; and the recording can hold
         the songs: a TV spot of a few songs, a list of what the broadcast aired, or a recording
         about as long as the set
  leave  one source only, sources that disagree, nothing found, or a recording much shorter
         than the set (a 25-minute broadcast of a 90-minute set: no telling which songs it holds)

An earlier session's reason for leaving a show blank is shown beside it. Karl adds (editing the
songs if he likes) or leaves each, and pastes "Copy for Claude Code"; apply_review.py writes it.
A show with nothing found needs no answer. Read-only.
"""
import html, json, os, re
from urllib.parse import urlparse

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RESULTS = os.path.expanduser('~/VaultShots/setlist-research/results')
OUT = os.path.expanduser('~/VaultShots/reports/setlist-research.html')
TALK = {'David Letterman', 'Jay Leno', 'Jimmy Fallon', "Conan O'Brien", 'Jimmy Kimmel', 'Carson Daly', 'Saturday Night Live', 'Jools Holland'}
ANSWERED = "the owner's call in the setlist research review"
PRIOR = re.compile(r"(?i)setlist (?:deliberately )?left (?:empty|blank)|left (?:empty|blank) deliberately|no setlist is given|no setlist could be sourced|Setlist NOT copied")
MIN_PER_SONG = 4.2


def mins(s):
    try:
        return round(float(s.get('DurationSec') or 0) / 60)
    except ValueError:
        return 0


def prior(s):
    for line in (s.get('PrivateNotes') or '').splitlines():
        m = PRIOR.search(line)
        if m:
            return line.strip()[max(0, m.start() - 200):m.end() + 300]
    return ''


def songs_of(lst):
    return [x for x in (lst or []) if x and x.strip().lower() != 'encore break']


def sites(r):
    """The distinct sites among the sources that agree: two pages of one site count once."""
    out = []
    for src in r.get('sources') or []:
        if src.get('agrees'):
            host = urlparse(src.get('url') or '').netloc.lower().removeprefix('www.').removeprefix('m.')
            if host and host not in out:
                out.append(host)
    return out


def advise(s, r):
    """(choice, songs to propose, why)."""
    status = r.get('status')
    agree = sites(r)
    full, aired = r.get('songs') or [], r.get('broadcast_songs') or []
    here = mins(s)
    if status == 'not_found' or not (full or aired):
        return 'none', [], 'Nothing usable found on the web.'
    if status == 'conflict':
        return 'leave', full, f'The sources disagree, so the rule says leave it. {r.get("notes", "")}'
    if len(agree) < 2:
        return 'leave', aired or full, f'Only {len(agree)} source agrees ({", ".join(agree) or "none"}); a setlist needs two independent sources that agree.'
    if aired:
        n = len(songs_of(aired))
        return 'add', aired, f'{len(agree)} sources agree ({", ".join(agree)}), and they list what the broadcast aired ({n} songs), so it matches this recording.'
    n = len(songs_of(full))
    need = max(n * MIN_PER_SONG, float(r.get('set_minutes') or 0))
    # An earlier session left it blank because the recording is a cut of the set: the full set
    # doesn't fix that, only a list of what this cut holds would.
    why_empty = prior(s)
    if why_empty and re.search(r'(?i)edited|partial|shorter|cut\b|runs? (?:about )?\d|minutes|which songs|NOT copied', why_empty):
        return 'leave', full, (f'{len(agree)} sources agree on the set, but an earlier check left this blank because the recording is a cut of it '
                               f'({here} min here, ~{round(need)} min for {n} songs), and no source lists what this cut holds. Leave it, unless you know.')
    tv = s.get('EventOrFestival') in TALK or r.get('what') in ('TV appearance',)
    if tv and n <= 4 and here >= n * 2.5:
        return 'add', full, f'{len(agree)} sources agree ({", ".join(agree)}) on a {n}-song TV spot, and the recording ({here} min) has room for {"it" if n == 1 else "them"}.'
    if here >= 0.75 * need:
        return 'add', full, f'{len(agree)} sources agree ({", ".join(agree)}), and the recording ({here} min) is about as long as the set (~{round(need)} min for {n} songs), so it holds the songs.'
    return 'leave', full, (f'{len(agree)} sources agree on the set, but this recording runs {here} min against ~{round(need)} min for its {n} songs: '
                           'it holds only some of them and there is no telling which. Leave it, unless you know what this cut holds.')


def main():
    shows = json.load(open(os.path.join(REPO, 'public', 'shows.json'), encoding='utf-8'))
    by = {s['ShowID']: s for s in shows}
    results = []
    for f in sorted(os.listdir(RESULTS)):
        try:
            r = json.load(open(os.path.join(RESULTS, f)))
        except ValueError:
            continue
        s = by.get(r.get('ShowID'))
        # Not a show any more, given a setlist since, or already answered on this page.
        if not s or (s.get('Setlist') or '').strip() or ANSWERED in (s.get('PrivateNotes') or ''):
            continue
        results.append((s, r, *advise(s, r)))
    E = html.escape
    groups = [('add', 'Recommended: add', 'Two or more independent sources agree, and the recording can hold the songs.'),
              ('leave', 'Recommended: leave blank', 'Found something, but it falls short of the rule: one source, a conflict, or a recording much shorter than the set. Add any you know better.'),
              ('none', 'Nothing found', 'The research found nothing usable. These need no answer: each will be noted as searched, so it isn\'t searched again.')]
    parts, counts = [], {}
    for key, title, lead in groups:
        rows = sorted([x for x in results if x[2] == key], key=lambda x: (x[0]['Artist'].lower(), x[0].get('ShowDate') or ''))
        counts[key] = len(rows)
        parts.append(f'<h2 id="g-{key}">{E(title)}<span>{len(rows)}</span></h2><p class="gl">{E(lead)}</p>')
        if key == 'none':
            parts.append('<details><summary>Show them, with what was tried</summary><ul class="plain">' + ''.join(
                f'<li><b>{E(s["Artist"])}</b> {E(s.get("ShowDate") or "Undated")} · {E(s.get("EventOrFestival") or s.get("VenueName") or "")} · {mins(s)} min — <span class="dim">{E((r.get("notes") or "")[:260])}</span></li>'
                for s, r, _, _, _ in rows) + '</ul></details>')
            continue
        for s, r, choice, songs, why in rows:
            cs = s.get('ChecksumSHA1') or ''
            a, b = f'file://{REPO}/node_modules/.cache/vault-thumbs/{cs}_01.webp', f'file://{REPO}/public/images/{cs}_01.jpg'
            place = ' · '.join(x for x in [s.get('ShowDate') or 'Undated', s.get('EventOrFestival'), s.get('VenueName'), s.get('City'), s.get('Country')] if x)
            kind = 'TV spot' if s.get('EventOrFestival') in TALK else 'act from a broadcast' if s.get('ParentShowID') else 'concert'
            srcs = ''.join(f'<li class="{"ok" if x.get("agrees") else "no"}"><a href="{E(x.get("url") or "")}" target="_blank">{E(urlparse(x.get("url") or "").netloc.removeprefix("www.") or "source")}</a> '
                           f'<span class="kind">{E(x.get("kind") or "")}</span> {E(x.get("says") or "")}</li>' for x in r.get('sources') or [])
            p = prior(s)
            parts.append(f'''<section class="row" data-id="{s['ShowID']}" data-label="{E(s['Artist'] + ' · ' + (s.get('ShowDate') or 'Undated'))}">
<div class="pic"><img loading="lazy" src="{E(a)}" onerror="this.onerror=null;this.src='{E(b)}'" alt=""></div>
<div class="body"><div class="art">{E(s['Artist'])} <span class="sub">{E(place)} · {mins(s)} min · {kind}</span></div>
{f'<div class="prior">Left blank on purpose before: “…{E(p)}…”</div>' if p else ''}
<textarea class="prop" rows="2">{E('; '.join(x.strip() for x in songs if x.strip()))}</textarea>
<div class="why"><b>Why {"add" if choice == "add" else "leave"}:</b> {E(why)}</div>
<ul class="src">{srcs}</ul>{f'<div class="notes">{E(r.get("notes") or "")}</div>' if r.get('notes') else ''}</div>
<div class="ch"><button class="opt{" rec" if choice == "add" else ""}" data-v="add"><span class="k">A</span>Add this setlist{" <em>recommended</em>" if choice == "add" else ""}</button>
<button class="opt{" rec" if choice == "leave" else ""}" data-v="leave"><span class="k">–</span>Leave it blank{" <em>recommended</em>" if choice == "leave" else ""}</button></div></section>''')
    nav = ''.join(f'<a href="#g-{k}">{E(t.replace("Recommended: ", ""))} {counts.get(k, 0)}</a>' for k, t, _ in groups)
    doc = PAGE.replace('{NAV}', nav).replace('{BODY}', ''.join(parts)).replace('{N}', str(len(results)))
    assert '�' not in doc
    open(OUT, 'w', encoding='utf-8').write(doc)
    print(OUT, len(results), 'researched:', counts)


PAGE = r'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Setlist research</title><style>
:root{color-scheme:dark;--line:rgba(255,255,255,.08)} *{box-sizing:border-box} body{margin:0;background:#141414;color:#fff;font:14px/1.5 system-ui,sans-serif} button,textarea{font:inherit;color:inherit} button{cursor:pointer}
header{position:sticky;top:0;z-index:10;background:rgba(20,20,20,.97);border-bottom:1px solid var(--line)} .bar{max-width:1300px;margin:0 auto;padding:12px 24px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
h1{font-size:18px;margin:0 8px 0 0} .bar a{color:#d1d5db;text-decoration:none;font-size:13px;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.06)} .sp{flex:1} .prog{color:#d1d5db;font-size:13px}
.bar label{font-size:13px;color:#d1d5db;display:flex;gap:6px;align-items:center}
.copy{border:0;border-radius:999px;font-weight:600;padding:8px 16px;font-size:13px;background:#fff;color:#111}
main{max-width:1300px;margin:0 auto;padding:8px 24px 80px} .lead{color:#d1d5db;max-width:950px} .lead b{color:#fff}
h2{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#9ca3af;margin:38px 0 4px;scroll-margin-top:70px} h2 span{letter-spacing:0;color:rgba(255,255,255,.5);margin-left:8px} .gl{color:#d1d5db;margin:0 0 10px;max-width:900px}
.row{display:flex;gap:16px;padding:16px 12px;border-bottom:1px solid var(--line)} .row.done{background:rgba(167,139,250,.06)} body.hide .row.done{display:none}
.pic{width:200px;flex:none} .pic img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;display:block;background:#222}
.body{flex:1;min-width:0} .art{font-weight:600;font-size:15px} .sub{color:#9ca3af;font-weight:400;font-size:13px} .dim{color:#9ca3af}
.prior{color:#fde68a;font-size:12.5px;margin:6px 0}
.prop{width:100%;margin-top:8px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);border-radius:8px;padding:8px 10px;font-size:14px;color:#fde68a;resize:vertical}
.why{font-size:13px;color:#d1d5db;margin-top:6px} .why b{color:#fff}
ul.src{margin:6px 0 0;padding-left:18px;font-size:12.5px;color:#d1d5db} ul.src li.no{color:#9ca3af} ul.src a{color:#93c5fd} .kind{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin:0 4px}
.notes{font-size:12.5px;color:#9ca3af;margin-top:6px}
.ch{width:230px;flex:none;display:flex;flex-direction:column;gap:6px}
.opt{text-align:left;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);border-radius:8px;padding:7px 10px;font-size:13px;display:flex;gap:8px;align-items:center} .opt em{font-style:normal;font-size:11px;color:#6ee7b7;margin-left:auto}
.opt .k{width:20px;height:20px;flex:none;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700;background:rgba(255,255,255,.1)} .opt.on{border-color:#a78bfa;background:rgba(167,139,250,.14)} .opt.on .k{background:#a78bfa;color:#111}
ul.plain{color:#d1d5db;font-size:13px} ul.plain li{margin:4px 0} summary{cursor:pointer;color:#9ca3af}
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#fff;color:#111;padding:10px 16px;border-radius:999px;font-weight:600;opacity:0;transition:opacity .2s} .toast.on{opacity:1}
</style></head><body>
<header><div class="bar"><h1>Setlist research</h1>{NAV}<span class="sp"></span><label><input type="checkbox" id="hide"> Hide answered</label><span class="prog" id="prog"></span><button class="copy" id="copyout">Copy for Claude Code</button></div></header>
<main><p class="lead">What the research agents found for the {N} shows with no setlist anywhere in our data. The rule: <b>two independent sources, fetched and read, that agree</b>, and a recording that can hold the songs. Each show starts on <b>my recommendation</b> with the reason under it; change any, and <b>edit the songs</b> in the box before adding if a title is off. The sources link out so you can check. <b>Nothing is written until you paste "Copy for Claude Code" back.</b></p>{BODY}</main>
<div class="toast" id="toast">Copied</div>
<script>
const KEY='vault-setlist-research-2026-10-19'; let st={picks:{},text:{}}; try{st=Object.assign(st,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}}; const rows=[...document.querySelectorAll('.row')];
for(const r of rows){if(!st.picks[r.dataset.id]){const rec=r.querySelector('.opt.rec');if(rec)st.picks[r.dataset.id]=rec.dataset.v}}
const tidy=t=>t.replace(/\s+/g,' ').trim();
function paint(){for(const r of rows){const v=st.picks[r.dataset.id];r.classList.toggle('done',!!v);r.querySelectorAll('.opt').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
 const ta=r.querySelector('.prop');if(st.text[r.dataset.id]!==undefined&&document.activeElement!==ta)ta.value=st.text[r.dataset.id]}
 document.getElementById('prog').textContent=rows.filter(r=>st.picks[r.dataset.id]).length+' of '+rows.length+' answered'}
document.addEventListener('click',e=>{const o=e.target.closest('.opt');if(!o)return;st.picks[o.closest('.row').dataset.id]=o.dataset.v;save();paint()});
document.addEventListener('input',e=>{const ta=e.target.closest('.prop');if(!ta)return;st.text[ta.closest('.row').dataset.id]=ta.value;save()});
document.getElementById('hide').addEventListener('change',e=>document.body.classList.toggle('hide',e.target.checked));
document.getElementById('copyout').addEventListener('click',async()=>{const add=[],leave=[];
 for(const r of rows){const v=st.picks[r.dataset.id];const l=r.dataset.id+'  '+r.dataset.label;if(v==='add')add.push(l+'  ::  '+tidy(r.querySelector('.prop').value));else if(v==='leave')leave.push(l)}
 const t=['SETLIST RESEARCH: '+(add.length+leave.length)+' of '+rows.length+' answered','','ADD ('+add.length+')',...add,'','LEAVE BLANK ('+leave.length+')',...leave].join('\n');
 try{await navigator.clipboard.writeText(t)}catch(e){const ta=document.createElement('textarea');ta.value=t;document.body.append(ta);ta.select();document.execCommand('copy');ta.remove()}
 const el=document.getElementById('toast');el.classList.add('on');setTimeout(()=>el.classList.remove('on'),1500)});
paint();
</script></body></html>'''

if __name__ == '__main__':
    main()

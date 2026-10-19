"""The missing-setlists report: every live show with no setlist, with its still, and where we looked.

    python3 tools/setlist-research/report.py     # renders ~/VaultShots/reports/setlists-report.html

For each show: whether its own info file (Notes, the sidecar text from its folder) was checked and
what it holds, whether another recording of the same show has a setlist, whether its file names
name a song, and its web research (tools/setlist-research/BRIEF … results, once in). Sections:

  1. Found in its own info file — setlists missed until now, read by hand from the text; Karl
     adds or leaves each.
  2. Another copy of this show has a setlist — copy, copy marked (incomplete), same show but don't
     copy, or different shows; the recommendation follows the running times.
  3. The checklist: nothing in our data, so researched on the web (review.py shows the results).
  4. No setlist by design: Various Artists masters (their acts' records carry the songs).

Answers are written by apply_report.py into PrivateNotes in the missing-setlists tool's own words
('SETLIST (date): copied from X', 'not the same show as X', 'Setlist NOT copied'), so no page
asks twice. Read-only.
"""
import csv, html, json, os, re

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RESEARCH = os.path.expanduser('~/VaultShots/setlist-research')
OUT = os.path.expanduser('~/VaultShots/reports/setlists-report.html')
TALK = {'David Letterman', 'Jay Leno', 'Jimmy Fallon', "Conan O'Brien", 'Jimmy Kimmel', 'Carson Daly', 'Saturday Night Live', 'Jools Holland'}

# Read by hand from each record's own info file (2026-10-19). A sidecar in the show's own folder
# is truth on its own (CLAUDE.md → Setlist sourcing).
FROM_INFO_FILE = {
    '82b12f274c5d': dict(setlist='1979', lines=['1. 1979'],
                         why="Its info file lists the one song performed: \"1. 1979\". The recording is the American Music Awards spot."),
    '56a0d564ba6c': dict(setlist='Epic; Easy (Commodores cover); Epic; Digging the Grave; Digging the Grave; What a Day; Midlife Crisis; Digging the Grave; From Out of Nowhere',
                         lines=['MTV Music Awards Epic (1990)', 'MTV Rock Am Ring interview … + Easy & Epic live (May 1993)', 'BBC Top Of The Pops Digging The Grave (March 1995)',
                                'MTV Most Wanted - Billy Painting, Digging The Grave, What A Day & Midlife Crisis (1995)', 'MTV Coca Cola Report In Norwich Interview + Digging The Grave & From Out Of Nowhere (1995)'],
                         why="A compilation of TV appearances; its info file names every song performed, segment by segment, in disc order. Left out: the \"live shots\" of three songs inside an MTV news piece (clips, not performances), and the making-of pieces."),
    'fe1e14ec3cfc': dict(setlist='Evidence; Caffeine; What a Day; Easy (Commodores cover); Introduce Yourself; Digging the Grave; We Care a Lot; Ashes to Ashes',
                         lines=['MTV Rock Am Ring interview … + Evidence, Caffeine and What A day (1995)', 'VPRO Pinkpop interview … + Easy and Introduce Yourself (1995)',
                                'KA2 Beach Rock interview Roddy, Digging the Grave and We Care A Lot (1995)', 'BBC Top Of The Pops Ashes To Ashes (1997)'],
                         why="A compilation of TV appearances; its info file names every Faith No More song performed, in disc order. Left out: the filler at the end (Peeping Tom, Fantômas and an Ozzy Osbourne song: other bands)."),
    'cc0a258b1e62': dict(setlist='Disarm; Spaceboy; Siva; Bury Me (incomplete)',
                         lines=["SPs performance from the metro in 1993 … includes disarm and spaceboy. runs 45 mins.", 'some other clips (Reading Festival 1992 Siva/Bury Me …)'],
                         why="Its info file names four of the songs: two from the 45-minute Metro 1993 set, two from the Reading 1992 clips. The rest of the Metro set isn't named, so the list ends (incomplete)."),
}


# Songs our own capture notes read on screen in the recording (PrivateNotes); the recording
# outranks every other source, so a partial list is written and marked (incomplete).
FROM_RECORDING = {
    '90c54e21e6ba': dict(setlist="Hash Pipe; Say It Ain't So (incomplete)", lines=["On-screen song title cards read in the capture: 'Hash Pipe' (4:43) and 'Say It Ain't So' (17:23)."],
                         why='The recording itself captions two songs, with their times, so their order is known. The rest of the 22 minutes is uncaptioned, so the list ends (incomplete). The show is unidentified, so the web can\'t add to it.'),
}
# Records the capture identified as documentaries (CLAUDE.md → Documentaries): no setlist needed.
DOCUMENTARIES = {
    'ce4828402e24': "The capture identified it from the picture: 'a 23-minute documentary on the 2005 album Language. Sex. Violence. Other? - interviews, archive clips captioned with their source'. Half or more of it is talking, so it is a Documentary, which needs no setlist.",
}
PRIOR = re.compile(r"(?i)setlist (?:deliberately )?left (?:empty|blank)|left (?:empty|blank) deliberately|no setlist is given|no setlist could be sourced")


def prior(s):
    """An earlier session's reason for leaving the setlist empty, if it gave one."""
    for line in (s.get('PrivateNotes') or '').splitlines():
        m = PRIOR.search(line)
        if m:
            return line.strip()[max(0, m.start() - 160):m.end() + 260]
    return ''


def mins(s):
    try:
        return round(float(s.get('DurationSec') or 0) / 60)
    except ValueError:
        return 0


def info_file(s):
    """What the record's own info file says about a setlist."""
    n = s.get('Notes') or ''
    if not n:
        return 'none', 'No info file in its folder.'
    if s['ShowID'] in FROM_INFO_FILE:
        return 'found', 'Its info file names the songs.'
    if re.search(r'(?i)\?{3,}|help|didn\'t figure|no setlist', n):
        return 'asks', 'Its info file has a setlist heading but asks for help ("????", "No setlist! Please help!").'
    return 'nothing', 'Its info file holds no songs (technical notes only).'


def twin_advice(here, there):
    """(choice, why) for a pair the missing-setlists tool matched."""
    h, t = mins(here), mins(there)
    n = len([x for x in (there.get('Setlist') or '').split(';') if x.strip() and x.strip() != 'Encore break'])
    songs = f'{n} song' + ('' if n == 1 else 's')
    if t and 0.85 <= h / t <= 1.15:
        return 'copy', f'{h} min here, {t} min there: the same length, so the same songs. Copy its {songs}.'
    if t and h > t * 1.15:
        return 'incomplete', f'{h} min here, {t} min there: this copy is longer, so it holds at least {"that song" if n == 1 else f"those {n} songs"} and more. Copy them and mark the list (incomplete); the web research may give the full set.'
    return 'nocopy', f'{h} min here, {t} min there: this copy is a much shorter cut, so it can\'t hold all {songs} and there\'s no telling which. Same show, but don\'t copy (the research may find what this cut holds).'


def thumb(s):
    cs = s.get('ChecksumSHA1') or ''
    return (f'file://{REPO}/node_modules/.cache/vault-thumbs/{cs}_01.webp', f'file://{REPO}/public/images/{cs}_01.jpg') if cs else ('', '')


def junk_entries(shows):
    """Setlist entries that look like a header line, not a song ("Foo Fighters - Bizarre Festival")."""
    out = []
    for s in shows:
        for e in [x.strip() for x in (s.get('Setlist') or '').split(';') if x.strip()]:
            if re.match(re.escape(s['Artist']) + r'\s+-\s+', e, re.I) or e in (s.get('VenueName'), s.get('City'), s.get('EventOrFestival')) \
                    or re.fullmatch(r'(?i)[A-Z][a-z]+ (?:Japan|Germany|England|USA)', e):
                out.append((s, e))
    return out


def main():
    shows = json.load(open(os.path.join(REPO, 'public', 'shows.json'), encoding='utf-8'))
    by = {s['ShowID']: s for s in shows}
    live = [s for s in shows if s.get('Hidden') != 'Yes' and s.get('ContentType') != 'Documentary']
    missing = [s for s in live if not (s.get('Setlist') or '').strip()]
    masters = [s for s in missing if s['Artist'] == 'Various Artists']
    acts = [s for s in missing if s['Artist'] != 'Various Artists']
    twins = {}
    for r in csv.DictReader(open(os.path.expanduser('~/VaultShots/reports/missing-setlists.csv'))):
        o = r['Other version with a setlist']
        if o in by and r['ShowID'] in by and by[r['ShowID']] in acts:
            twins[r['ShowID']] = by[o]
    results = {}
    rdir = os.path.join(RESEARCH, 'results')
    for f in os.listdir(rdir) if os.path.isdir(rdir) else []:
        try:
            r = json.load(open(os.path.join(rdir, f)))
            results[r['ShowID']] = r
        except (ValueError, KeyError):
            pass
    E = html.escape

    def head(s):
        a, b = thumb(s)
        place = ' · '.join(x for x in [s.get('ShowDate') or 'Undated', s.get('EventOrFestival'), s.get('VenueName'), s.get('City')] if x)
        kind = 'TV spot' if s.get('EventOrFestival') in TALK else 'Act from a broadcast' if s.get('ParentShowID') else 'Concert'
        img = f'<img loading="lazy" src="{E(a)}" onerror="this.onerror=null;this.src=\'{E(b)}\'" alt="">' if a else '<div class="noimg">no still</div>'
        return img, place, kind

    def status(s):
        r = results.get(s['ShowID'])
        if not r:
            return '<span class="st pend">researching</span>'
        return f'<span class="st {E(r.get("status", ""))}">{E(r.get("status", "").replace("_", " "))}</span>'

    sec, n = [], 0
    # 1. From its own info file.
    rows = []
    for sid, f in FROM_INFO_FILE.items():
        s = by[sid]
        n += 1
        img, place, kind = head(s)
        rows.append(f'''<section class="row" data-id="{sid}" data-kind="info" data-label="{E(s['Artist'] + ' · ' + (s.get('ShowDate') or 'Undated'))}">
<div class="pic">{img}</div><div class="body"><div class="art">{E(s['Artist'])} <span class="sub">{E(place)} · {mins(s)} min · {kind}</span></div>
<div class="quote">{''.join(f'<div>“{E(x)}”</div>' for x in f['lines'])}</div>
<textarea class="prop" rows="2">{E(f['setlist'])}</textarea><div class="why"><b>Why:</b> {E(f['why'])}</div></div>
<div class="ch"><button class="opt rec" data-v="add"><span class="k">A</span>Add this setlist <em>recommended</em></button><button class="opt" data-v="leave"><span class="k">–</span>Leave it blank</button></div></section>''')
    rec_rows = []
    for sid, f in FROM_RECORDING.items():
        s = by[sid]
        img, place, kind = head(s)
        rec_rows.append(f'''<section class="row" data-id="{sid}" data-kind="info" data-label="{E(s['Artist'] + ' · ' + (s.get('ShowDate') or 'Undated'))}">
<div class="pic">{img}</div><div class="body"><div class="art">{E(s['Artist'])} <span class="sub">{E(place)} · {mins(s)} min · {kind}</span></div>
<div class="quote">{''.join(f'<div>“{E(x)}”</div>' for x in f['lines'])}</div>
<textarea class="prop" rows="2">{E(f['setlist'])}</textarea><div class="why"><b>Why:</b> {E(f['why'])}</div></div>
<div class="ch"><button class="opt rec" data-v="add"><span class="k">A</span>Add this setlist <em>recommended</em></button><button class="opt" data-v="leave"><span class="k">–</span>Leave it blank</button></div></section>''')
    for sid, why in DOCUMENTARIES.items():
        s = by[sid]
        img, place, kind = head(s)
        rec_rows.append(f'''<section class="row" data-id="{sid}" data-kind="doc" data-label="{E(s['Artist'] + ' · ' + (s.get('ShowDate') or 'Undated'))}">
<div class="pic">{img}</div><div class="body"><div class="art">{E(s['Artist'])} <span class="sub">{E(place)} · {mins(s)} min</span></div>
<div class="why"><b>Why:</b> {E(why)}</div></div>
<div class="ch"><button class="opt rec" data-v="doc"><span class="k">A</span>Mark it a Documentary <em>recommended</em></button><button class="opt" data-v="leave"><span class="k">–</span>Leave it as a live show</button></div></section>''')
    sec.append(('info', 'Found in its own info file', f'{len(rows)} setlists we had all along: the songs are named in the show\'s own info file, read by hand. Edit the box if a title is off.', ''.join(rows)))
    sec.append(('screen', 'Named on screen in the recording', 'What our own capture notes read in the picture: song captions, and one record that turns out not to be a live show.', ''.join(rec_rows)))
    # 2. Another copy of the show has a setlist.
    rows = []
    for sid, other in sorted(twins.items(), key=lambda kv: (by[kv[0]]['Artist'], by[kv[0]].get('ShowDate') or '')):
        s = by[sid]
        n += 1
        img, place, kind = head(s)
        img2, _, _ = head(other)
        choice, why = twin_advice(s, other)
        opts = [('copy', 'Same show: copy its setlist'), ('incomplete', 'Same show: copy it, marked (incomplete)'), ('nocopy', "Same show, but don't copy"), ('different', 'Different shows')]
        rows.append(f'''<section class="row" data-id="{sid}" data-kind="twin" data-twin="{other['ShowID']}" data-label="{E(s['Artist'] + ' · ' + (s.get('ShowDate') or 'Undated'))}">
<div class="pic">{img}<div class="cap">this one · {mins(s)} min</div>{img2}<div class="cap">the copy with a setlist · {mins(other)} min</div></div>
<div class="body"><div class="art">{E(s['Artist'])} <span class="sub">{E(place)} · {kind}</span></div>
<div class="quote"><div><b>The other copy</b> ({E(other['ShowID'])}, {E(other.get('VenueName') or other.get('EventOrFestival') or '')}): {E(other['Setlist'])}</div></div>
<div class="why"><b>Why:</b> {E(why)}</div></div>
<div class="ch">{''.join(f'<button class="opt{" rec" if v == choice else ""}" data-v="{v}"><span class="k">{"ABCD"[i]}</span>{E(t)}{" <em>recommended</em>" if v == choice else ""}</button>' for i, (v, t) in enumerate(opts))}</div></section>''')
    sec.append(('twin', 'Another copy of this show has a setlist', f'{len(rows)} shows held twice, where only one copy has the songs. Whether they are one show is your call; the recommendation follows the running times.', ''.join(rows)))
    # 3. The checklist: nothing in our data.
    covered = set(FROM_INFO_FILE) | set(FROM_RECORDING) | set(DOCUMENTARIES)
    todo = [s for s in acts if s['ShowID'] not in covered]
    cards = []
    for s in sorted(todo, key=lambda s: (s['Artist'].lower(), s.get('ShowDate') or '')):
        img, place, kind = head(s)
        state, said = info_file(s)
        extra = ' · another copy has a setlist (above)' if s['ShowID'] in twins else ''
        why_empty = prior(s)
        extra_html = f'<div class="sub prior">Left blank on purpose before: “…{E(why_empty)}…”</div>' if why_empty else ''
        cards.append(f'<div class="card"><div class="cpic">{img}</div><div class="cbody"><div class="art">{E(s["Artist"])}</div>'
                     f'<div class="sub">{E(place)}</div><div class="sub">{mins(s)} min · {kind}{E(extra)}</div>'
                     f'<div class="sub dim">{E(said)}</div>{extra_html}{status(s)}</div></div>')
    sec.append(('todo', 'Checklist: nothing in our data', f'{len(todo)} shows with no setlist anywhere we hold: no info file in the folder (every folder\'s info files were read into the records on 2026-10-06), or one that names no songs, and no other copy with one. All of them are with the research agents; their findings come on a second page, each with a recommended answer.', f'<div class="cards">{"".join(cards)}</div>'))
    # 4. By design.
    sec.append(('design', 'No setlist by design', f'{len(masters)} Various Artists masters: a festival or TV programme filed whole, whose acts each have their own record with the songs.',
                '<details><summary>Show them</summary><ul class="plain">' + ''.join(f'<li>{E(s.get("ShowDate") or "Undated")} · {E(s.get("EventOrFestival") or s.get("VenueName") or "")}</li>' for s in sorted(masters, key=lambda s: s.get('ShowDate') or '')) + '</ul></details>'))
    junk = junk_entries(live)
    if junk:
        sec.append(('junk', 'Also spotted: header lines inside setlists', 'Entries in other shows\' setlists that read like a header, not a song. Nothing is changed here; say if you want them out.',
                    '<ul class="plain">' + ''.join(f'<li><b>{E(s["Artist"])}</b> {E(s.get("ShowDate") or "Undated")}: “{E(e)}”</li>' for s, e in junk) + '</ul>'))
    research_done = sum(1 for s in todo if s['ShowID'] in results)
    summary = (f'<div class="sum"><div><b>{len(missing)}</b> live shows with no setlist</div><div><b>{len(FROM_INFO_FILE)}</b> found in their own info file</div><div><b>{len(FROM_RECORDING) + len(DOCUMENTARIES)}</b> settled by what the capture saw on screen</div>'
               f'<div><b>{len(twins)}</b> held twice, the other copy with songs</div><div><b>{len(todo)}</b> with nothing in our data · {research_done} researched so far</div>'
               f'<div><b>{len(masters)}</b> Various Artists masters (none by design)</div>'
               f'<div><b>{sum(1 for s in acts if s.get("Notes"))}</b> have an info file at all; every one was read</div></div>')
    nav = ''.join(f'<a href="#{k}">{E(t)}</a>' for k, t, _, _ in sec)
    body = ''.join(f'<h2 id="{k}">{E(t)}</h2><p class="gl">{E(lead)}</p>{content}' for k, t, lead, content in sec)
    doc = PAGE.replace('{NAV}', nav).replace('{SUMMARY}', summary).replace('{BODY}', body)
    assert '�' not in doc
    open(OUT, 'w', encoding='utf-8').write(doc)
    print(OUT, f'{len(missing)} missing: {len(FROM_INFO_FILE)} from info files, {len(twins)} twins, {len(todo)} to research ({research_done} done), {len(masters)} masters, {len(junk)} header lines')


PAGE = r'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Missing setlists</title><style>
:root{color-scheme:dark;--line:rgba(255,255,255,.08)} *{box-sizing:border-box} body{margin:0;background:#141414;color:#fff;font:14px/1.5 system-ui,sans-serif} button,textarea{font:inherit;color:inherit} button{cursor:pointer}
header{position:sticky;top:0;z-index:10;background:rgba(20,20,20,.97);border-bottom:1px solid var(--line)} .bar{max-width:1300px;margin:0 auto;padding:12px 24px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
h1{font-size:18px;margin:0 8px 0 0} .bar a{color:#d1d5db;text-decoration:none;font-size:13px;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.06)} .sp{flex:1} .prog{color:#d1d5db;font-size:13px}
.copy{border:0;border-radius:999px;font-weight:600;padding:8px 16px;font-size:13px;background:#fff;color:#111}
main{max-width:1300px;margin:0 auto;padding:8px 24px 80px}
.sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:16px 0 8px} .sum div{background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:10px;padding:10px 12px;color:#d1d5db;font-size:13px} .sum b{display:block;font-size:22px;color:#fff}
h2{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#9ca3af;margin:38px 0 4px;scroll-margin-top:70px} .gl{color:#d1d5db;margin:0 0 10px;max-width:900px}
.row{display:flex;gap:16px;padding:16px 12px;border-bottom:1px solid var(--line)} .row.done{background:rgba(167,139,250,.06)}
.pic{width:220px;flex:none} .pic img,.noimg{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;display:block;background:#222} .noimg{display:grid;place-items:center;color:#666;font-size:12px}
.cap{font-size:11px;color:#9ca3af;margin:3px 0 8px}
.body{flex:1;min-width:0} .art{font-weight:600;font-size:15px} .sub{color:#9ca3af;font-weight:400;font-size:13px} .dim{color:#7b7f87}
.quote{margin:8px 0;padding:6px 10px;border-left:2px solid #6ee7b7;font-size:13px;color:#d1d5db} .quote b{color:#fff;font-weight:600}
.prop{width:100%;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);border-radius:8px;padding:8px 10px;font-size:14px;color:#fde68a;resize:vertical}
.why{font-size:13px;color:#d1d5db;margin-top:6px} .why b{color:#fff}
.ch{width:250px;flex:none;display:flex;flex-direction:column;gap:6px}
.opt{text-align:left;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);border-radius:8px;padding:7px 10px;font-size:13px;display:flex;gap:8px;align-items:center} .opt em{font-style:normal;font-size:11px;color:#6ee7b7;margin-left:auto}
.opt .k{width:20px;height:20px;flex:none;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700;background:rgba(255,255,255,.1)} .opt.on{border-color:#a78bfa;background:rgba(167,139,250,.14)} .opt.on .k{background:#a78bfa;color:#111}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px} .card{background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.cpic img,.cpic .noimg{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;border-radius:0} .cbody{padding:8px 10px 10px} .cbody .art{font-size:14px} .cbody .sub{font-size:12px}
.prior{color:#fde68a;font-size:11.5px;margin-top:4px} .st{display:inline-block;margin-top:6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;border-radius:999px;padding:2px 8px;background:rgba(255,255,255,.08);color:#d1d5db}
.st.found{background:#065f46;color:#d1fae5} .st.partial{background:#78350f;color:#fef3c7} .st.conflict{background:#7f1d1d;color:#fee2e2} .st.not_found{background:#374151;color:#e5e7eb}
ul.plain{columns:2;color:#d1d5db;font-size:13px} summary{cursor:pointer;color:#9ca3af}
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#fff;color:#111;padding:10px 16px;border-radius:999px;font-weight:600;opacity:0;transition:opacity .2s} .toast.on{opacity:1}
</style></head><body>
<header><div class="bar"><h1>Missing setlists</h1>{NAV}<span class="sp"></span><span class="prog" id="prog"></span><button class="copy" id="copyout">Copy for Claude Code</button></div></header>
<main>{SUMMARY}{BODY}</main><div class="toast" id="toast">Copied</div>
<script>
const KEY='vault-setlists-report-2026-10-19'; let st={picks:{},text:{}}; try{st=Object.assign(st,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}}; const rows=[...document.querySelectorAll('.row')];
// The recommended answer is the default: a row counts as answered from the start.
for(const r of rows){if(!st.picks[r.dataset.id]){const rec=r.querySelector('.opt.rec');if(rec)st.picks[r.dataset.id]=rec.dataset.v}}
const tidy=t=>t.replace(/\s+/g,' ').trim();
function paint(){for(const r of rows){const v=st.picks[r.dataset.id];r.classList.toggle('done',!!v);r.querySelectorAll('.opt').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
 const ta=r.querySelector('.prop');if(ta&&st.text[r.dataset.id]!==undefined&&document.activeElement!==ta)ta.value=st.text[r.dataset.id]}
 document.getElementById('prog').textContent=rows.filter(r=>st.picks[r.dataset.id]).length+' of '+rows.length+' answered'}
document.addEventListener('click',e=>{const o=e.target.closest('.opt');if(!o)return;const id=o.closest('.row').dataset.id;st.picks[id]=o.dataset.v;save();paint()});
document.addEventListener('input',e=>{const ta=e.target.closest('.prop');if(!ta)return;st.text[ta.closest('.row').dataset.id]=ta.value;save()});
document.getElementById('copyout').addEventListener('click',async()=>{const g={add:[],leave:[],doc:[],copy:[],incomplete:[],nocopy:[],different:[]};
 for(const r of rows){const v=st.picks[r.dataset.id];if(!v)continue;const l=r.dataset.id+'  '+r.dataset.label;
  if(v==='add')g.add.push(l+'  ::  '+tidy(r.querySelector('.prop').value));else if(r.dataset.twin)g[v].push(l+'  <-  '+r.dataset.twin);else g[v].push(l)}
 const t=['SETLISTS REPORT: '+Object.values(g).reduce((a,b)=>a+b.length,0)+' of '+rows.length+' answered','',
  'ADD FROM INFO FILE ('+g.add.length+')',...g.add,'','LEAVE BLANK ('+g.leave.length+')',...g.leave,'','MARK AS DOCUMENTARY ('+g.doc.length+')',...g.doc,'',
  'SAME SHOW, COPY ('+g.copy.length+')',...g.copy,'','SAME SHOW, COPY MARKED INCOMPLETE ('+g.incomplete.length+')',...g.incomplete,'',
  "SAME SHOW, DON'T COPY ("+g.nocopy.length+')',...g.nocopy,'','DIFFERENT SHOWS ('+g.different.length+')',...g.different].join('\n');
 try{await navigator.clipboard.writeText(t)}catch(e){const ta=document.createElement('textarea');ta.value=t;document.body.append(ta);ta.select();document.execCommand('copy');ta.remove()}
 const el=document.getElementById('toast');el.classList.add('on');setTimeout(()=>el.classList.remove('on'),1500)});
paint();
</script></body></html>'''

if __name__ == '__main__':
    main()

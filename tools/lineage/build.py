"""The lineage review: chains in a show's own sidecar text that never reached its `Lineage`.

    python3 tools/lineage/build.py     # renders ~/VaultShots/reports/lineage.html

`Lineage` was filled from sidecar lines labelled "Lineage:" or "Source:", and cut where a chain ran
onto a second line; a chain written any other way ("Palladia HDTV>Motorola DCT3412>FireWire>…",
"Format: DVB-S -> PC -> …") stayed in Notes only. This finds every line of Notes with an arrow
(->, =>, →, >) between two pieces of text, joins a chain broken over several lines, and sorts the
lines into video lineage, audio lineage and not lineage (a setlist's segue, an arrow used as a
bullet, "your copy will be…"). Each record gets a suggestion in the house style — the chain
verbatim, its label dropped, two chains joined with " | " — which Karl uses, edits or leaves;
tools/lineage/apply.py writes his picks. A record he has answered says so in PrivateNotes and is
not asked again. Read-only.
"""
import difflib, hashlib, html, importlib.util, json, os, re

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.expanduser('~/VaultShots/reports/lineage.html')
# The broadcaster review's channel names, so "by einsfestival" isn't taken for a person.
_spec = importlib.util.spec_from_file_location('broadcaster_build', os.path.join(REPO, 'tools', 'broadcaster', 'build.py'))
_channels = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_channels)
found_in = _channels.found_in

# Written into PrivateNotes once Karl has answered a record (apply.py).
ANSWERED = 'the owner\'s pick on the lineage review'

ARROW = r'(?:-+>|=+>|→|(?<![<>=-])>(?![>=]))'
BETWEEN = re.compile(rf'\S\s*{ARROW}\s*\S')
TRACK = re.compile(r'^\s*(?:d\d+\s*)?(?:t|track\s*)?\d{1,3}\s*[.):\-]\s*\D', re.I)
# A label with no colon: "Lineage (Main Set) Direct stream…", "Lineage __ file.ts > …", "Source - DTV > DVD".
NAMED = re.compile(r'^\s*(?:(?:lineage|linage)\s*(?:\([^)]*\)|\[[^\]]*\])?[\s:\-–_]*(?=[^\s>=→-])'
                   r'|(?:source|video source|video|transfer|conversion|generation)\s*[\-–]\s+)', re.I)
# A chain wrapped onto the next line, not a new chain: the next line doesn't start like a source.
SOURCE_START = re.compile(r'(?i)^(?:digital|satellite|cable|dvb|tv|analog|master|vhs|tracks?\b|pro-?shot|hd|live|freeview|bbc|mtv|\[)')
LABEL = re.compile(r'^\s*([^:>→]{1,45}?)\s*:\s+(?=\S)')
AUDIO = re.compile(r'\b(?:FLAC|WAV|SHN|DAT|CDR?|EAC|MD|minidisc|cassette|mics?|soundboard|SBD|AUD|Schoeps|Neumann|Sound ?Forge|Audition|CD Wave|TLH|xACT)\b', re.I)
VIDEO = re.compile(r'\b(?:TV|HDTV|VHS|S-?VHS|DVD\w*|DVB\w*|broadcast|cable|satellite|sat|HD|SD|PC|capture\w*|PVR|DVR|HDD|recorder|TS|M2TS|MPEG\w*|'
                   r'Firewire|TMPG\w*|Nero\w*|Shrink|Author\w*|IfoEdit|ProjectX|Project X|VideoReDo|Vegas|Premiere|Edius|tuner|standalone|SA|master|'
                   r'torrent|stream\w*|webcast|camcorder|cam|Hi ?8|U-?Matic|Beta\w*|laserdisc|LD|avi|mkv|mp4|x264|h\.?264|Dreambox|Humax|Topfield|Hauppauge)\b', re.I)
# "…> DVD-R by <handle>" at the end of a step: a person, unless it's a channel or a recording word.
BY = re.compile(rf'\s+by\s+((?:Mr\.\s+)?[^\s>,;)]+)(?=\s*(?:{ARROW}|$|[,;)]))')


def songs(s):
    return {re.sub(r'\W+', ' ', x).strip().lower() for x in (s.get('Setlist') or '').split(';') if x.strip()}


def lines_of(notes):
    """Notes as lines, a chain broken over several lines joined back into one."""
    out = []
    for raw in (notes or '').splitlines():
        line = ' '.join(raw.split())
        if not line or re.match(r'^-{2,}\s.*\s-{2,}$', line):
            out.append('')
            continue
        prev = out[-1] if out else ''
        wrapped = (prev and len(prev) >= 70 and re.search(ARROW, prev) and re.search(ARROW, line) and not re.search(r'[.!?;:)]$', prev)
                   and not LABEL.match(line) and not SOURCE_START.match(line))
        if prev and (re.search(rf'(?:{ARROW}|&)\s*$', prev) or re.match(rf'^{ARROW}', line) or wrapped):
            out[-1] = f'{prev} {line}'
        else:
            out.append(line)
    return [x for x in out if x]


def kind(line, setlist):
    """'video', 'audio' or why it is not lineage."""
    parts = [re.sub(r'\W+', ' ', p).strip().lower() for p in re.split(ARROW, line)]
    if TRACK.match(line) or any(p and p in setlist for p in parts):
        return 'a segue in the track list'
    if re.match(rf'^\s*{ARROW}', line) or re.search(rf':\s*{ARROW}', line):
        return 'an arrow used as a bullet'
    if re.match(r'(?i)\s*your\b', line):
        return 'what your copy will be'
    if re.match(r'^[a-z]', line) and re.search(r'[.)]\s+[A-Z][a-z]+,', line):
        return 'a sentence, not a chain'
    label = LABEL.match(line)
    if label and re.match(r'(?i)audio', label.group(1)):
        return 'audio'
    a, v = len(AUDIO.findall(line)), len(VIDEO.findall(line))
    if a and a >= v:
        return 'audio'
    return 'video' if v else 'no recording words'


def clean(line):
    """The chain itself: its label ("Lineage:", "Video Source -") and a trailing arrow dropped, and a
    person named with "by …" taken out (a channel, "by einsfestival", stays)."""
    line = line.rstrip(' \\')  # a stray backslash: the end of an RTF line
    m = LABEL.match(line) or NAMED.match(line)
    if m and not re.search(ARROW, line[:m.end()]):
        line = line[m.end():]
    line = BY.sub(lambda b: b.group(0) if found_in(b.group(1)) or VIDEO.match(b.group(1)) or AUDIO.match(b.group(1)) else '', line)
    return re.sub(rf'\s*{ARROW}\s*$', '', line).rstrip(' \\').strip()


def candidates(s):
    setlist = songs(s)
    out, seen, plain = [], set(), []
    for line in lines_of(s.get('Notes')):
        if not BETWEEN.search(line):
            # A one-step source with a label and no arrow ("Source - Master vhs (SP)"), used only
            # where the notes have no chain at all.
            if re.match(r'(?i)\s*(lineage|linage|source)\s*[:\-–]', line) and not line.endswith(':') and len(clean(line)) > 3:
                plain.append(dict(line=line, chain=clean(line), kind='video', person=False))
            continue
        k = kind(line, setlist)
        chain = clean(line) if k in ('video', 'audio') else line
        key = norm(chain)
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(dict(line=line, chain=chain, kind=k, person=k == 'video' and len(BY.findall(line.rstrip(' \\'))) > len(BY.findall(chain))))
    if plain and not any(c['kind'] == 'video' for c in out):
        out += plain[:1]
    return out


def norm(t):
    return re.sub(r'[^a-z0-9]+', '', (t or '').lower())


def pipes(t):
    """Split a Lineage on " | ", but not inside brackets ("[1080i/H.264 | AC3/2.0]")."""
    out, depth, cur = [], 0, ''
    for i, ch in enumerate(t):
        depth += ch in '([' and 1 or ch in ')]' and -1 or 0
        if depth <= 0 and t[i:i + 3] == ' | ':
            out.append(cur)
            cur = ''
            continue
        if not (depth <= 0 and t[i - 2:i + 1] == ' | ' and i >= 2):
            cur += ch
    return [p.strip(' |') for p in out + [cur] if p.strip(' |')]


def completes(piece, chain):
    """The notes' chain is the record's piece in full: it starts the same and runs on."""
    pn, cn = norm(re.sub(rf'\s*{ARROW}\s*$', '', piece)), norm(chain)
    if len(cn) <= len(pn) or not cn.startswith(pn[:12]):
        return False
    return cn.startswith(pn) or difflib.SequenceMatcher(None, pn, cn[:len(pn)]).ratio() >= 0.9


def words(t):
    return set(re.findall(r'[a-z0-9]+', t.lower()))


def reworded(piece, chain):
    """The same chain in other words: nearly every word of the record's piece is in it, and it
    isn't much longer (a tidied "18 August 2005" against the sidecar's "August 18 2005")."""
    wp, wc = words(piece), words(chain)
    return bool(wp) and len(wp & wc) / len(wp) >= 0.85 and len(wc) <= 1.6 * len(wp)


def suggest(current, video):
    """(new Lineage, how): a cut-off chain completed from the notes, the notes' other chains added."""
    if len(current.strip()) <= 3 or current.strip().lower() in ('me', 'you'):
        current = ''
    pieces, used, how = pipes(current), set(), set()
    for i, p in enumerate(pieces):
        have = {norm(x) for x in pieces}
        for c in video:
            if id(c) not in used and norm(c['chain']) not in have and completes(p, c['chain']):
                pieces[i], how = c['chain'], how | {'cut'}
                used.add(id(c))
                break
    joined = norm(' | '.join(pieces))
    for c in video:
        if id(c) not in used and norm(c['chain']) not in joined and not any(reworded(p, c['chain']) for p in pieces):
            pieces.append(c['chain'])
            joined += norm(c['chain'])
            how.add('more' if current else 'new')
    return ' | '.join(pieces), how


def review(s):
    """The record's row, or None when the notes hold nothing its `Lineage` lacks."""
    if ANSWERED in (s.get('PrivateNotes') or ''):
        return None
    cands = candidates(s)
    video = [c for c in cands if c['kind'] == 'video']
    current = s.get('Lineage') or ''
    suggestion, how = suggest(current, video)
    if not cands or norm(suggestion) == norm(current) or not suggestion:
        return None
    group = 'missing' if not current else ('cut' if 'cut' in how else 'more')
    return dict(group=group, cands=cands, current=current, suggestion=suggestion,
                hash=hashlib.sha1(suggestion.encode()).hexdigest()[:6], person=any(c['person'] for c in video))


STYLE = """
:root{color-scheme:dark;--line:rgba(255,255,255,.08)} *{box-sizing:border-box} body{margin:0;background:#141414;color:#fff;font:14px/1.5 system-ui,sans-serif} button,textarea{font:inherit;color:inherit}
button{cursor:pointer}
header{position:sticky;top:0;z-index:10;background:rgba(20,20,20,.97);border-bottom:1px solid var(--line)} .bar{max-width:1200px;margin:0 auto;padding:12px 24px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
h1{font-size:18px;margin:0} .bar a{color:#d1d5db;text-decoration:none;font-size:13px;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.06)} .sp{flex:1} .prog{color:#d1d5db;font-size:13px}
.bar label{font-size:13px;color:#d1d5db;display:flex;gap:6px;align-items:center}
.copy{border:0;border-radius:999px;font-weight:600;padding:8px 16px;font-size:13px;background:#fff;color:#111}
main{max-width:1200px;margin:0 auto;padding:8px 24px 80px} .lead{color:#d1d5db;max-width:900px} .lead b{color:#fff}
h2{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#9ca3af;margin:34px 0 4px;scroll-margin-top:70px} h2 span{letter-spacing:0;color:rgba(255,255,255,.5);margin-left:8px}
.gl{color:#9ca3af;font-size:13px;margin:0 0 8px;max-width:900px}
.row{padding:16px 12px 18px;border-bottom:1px solid var(--line)} .row.done{background:rgba(167,139,250,.06)} body.hide .row.done{display:none}
.head{display:flex;gap:16px;align-items:flex-start} .n{color:#9ca3af;width:36px;flex:none} .info{flex:1;min-width:0}
.art{font-weight:600;font-size:15px} .sub{color:#9ca3af;font-weight:400;font-size:13px}
.now{font-size:13px;color:#d1d5db;margin-top:4px} .now b{color:#9ca3af;font-weight:500}
.flag{display:inline-block;font-size:11px;font-weight:600;border-radius:999px;padding:1px 8px;margin-left:6px;vertical-align:1px;background:rgba(253,230,138,.15);color:#fde68a}
.prop{width:100%;margin-top:8px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);border-radius:8px;padding:8px 10px;font-size:14px;color:#fde68a;resize:vertical;min-height:58px}
.prop.edited{border-color:#a78bfa}
.ch{width:230px;flex:none;display:flex;flex-direction:column;gap:6px}
.opt{text-align:left;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);border-radius:8px;padding:7px 10px;font-size:13px;display:flex;gap:8px;align-items:center} .opt em{font-style:normal;font-size:11px;color:#6ee7b7;margin-left:auto}
.opt .k{width:20px;height:20px;flex:none;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700;background:rgba(255,255,255,.1)} .opt.on{border-color:#a78bfa;background:rgba(167,139,250,.14)} .opt.on .k{background:#a78bfa;color:#111}
.ev{margin:10px 0 0 52px;font-size:13px;color:#d1d5db} .ev .l{font-family:ui-monospace,Menlo,monospace;font-size:12px;padding:3px 8px;border-left:2px solid rgba(255,255,255,.15);margin:3px 0;white-space:pre-wrap;word-break:break-word}
.ev .l.video{border-color:#6ee7b7} .ev .l i{font-style:normal;color:#9ca3af;font-family:system-ui,sans-serif;font-size:11px;margin-right:6px}
details{margin-top:6px} summary{cursor:pointer;color:#9ca3af;font-size:12px} details pre{white-space:pre-wrap;word-break:break-word;font-size:12px;color:#d1d5db;background:rgba(255,255,255,.03);padding:10px;border-radius:6px;max-height:420px;overflow:auto}
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#fff;color:#111;padding:10px 16px;border-radius:999px;font-weight:600;opacity:0;transition:opacity .2s} .toast.on{opacity:1}
"""

SCRIPT = r"""
const KEY='vault-lineage-2026-10-18'; let st={picks:{},text:{}}; try{st=Object.assign(st,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}}; const rows=[...document.querySelectorAll('.row')];
const tidy=t=>t.replace(/\s+/g,' ').trim();
function paint(){for(const r of rows){const id=r.dataset.id,v=st.picks[id]||'',ta=r.querySelector('.prop');r.classList.toggle('done',!!v);
r.querySelectorAll('.opt').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
if(document.activeElement!==ta&&st.text[id]!==undefined)ta.value=st.text[id];ta.classList.toggle('edited',tidy(ta.value)!==tidy(ta.defaultValue))}
document.getElementById('prog').textContent=rows.filter(r=>st.picks[r.dataset.id]).length+' of '+rows.length+' answered'}
document.addEventListener('click',e=>{const o=e.target.closest('.opt');if(!o)return;const id=o.closest('.row').dataset.id;st.picks[id]===o.dataset.v?delete st.picks[id]:st.picks[id]=o.dataset.v;save();paint()});
document.addEventListener('input',e=>{const ta=e.target.closest('.prop');if(!ta)return;const id=ta.closest('.row').dataset.id;
if(tidy(ta.value)===tidy(ta.defaultValue))delete st.text[id];else{st.text[id]=ta.value;st.picks[id]='use'}save();paint()});
document.getElementById('hide').addEventListener('change',e=>document.body.classList.toggle('hide',e.target.checked));
document.getElementById('copyout').addEventListener('click',async()=>{const use=[],ed=[],keep=[];for(const r of rows){const id=r.dataset.id,v=st.picks[id];if(!v)continue;
const ta=r.querySelector('.prop'),label=id+'  '+r.dataset.label;
if(v==='keep')keep.push(label);else if(tidy(ta.value)===tidy(ta.defaultValue))use.push(label+'  #'+r.dataset.hash);else ed.push(label+'  ::  '+tidy(ta.value))}
const t=['LINEAGE: '+(use.length+ed.length+keep.length)+' of '+rows.length+' answered','','USE (as suggested) ('+use.length+')',...use,'','EDITED ('+ed.length+')',...ed,'','LEAVE AS IT IS ('+keep.length+')',...keep].join('\n');
try{await navigator.clipboard.writeText(t)}catch(e){const ta=document.createElement('textarea');ta.value=t;document.body.append(ta);ta.select();document.execCommand('copy');ta.remove()}
const el=document.getElementById('toast');el.classList.add('on');setTimeout(()=>el.classList.remove('on'),1500)});
paint();
"""

GROUPS = [
    ('missing', 'No lineage yet', 'The sidecar has a chain; the record has none.', 'Leave it blank'),
    ('cut', 'Lineage cut off', 'The record has the start of a chain the sidecar has in full (it was cut where the chain ran onto a second line).', 'Keep what\'s there'),
    ('more', 'The sidecar has more', 'The record has a lineage, and the sidecar has another chain beside it — often the transfer or editing steps. The suggestion keeps what\'s there and adds it after a " | ".', 'Keep what\'s there'),
]


def main():
    shows = [s for s in json.load(open(os.path.join(REPO, 'public', 'shows.json'), encoding='utf-8')) if s.get('Hidden') != 'Yes']
    rows = sorted([(s, r) for s in shows for r in [review(s)] if r], key=lambda x: (x[0]['Artist'].lower(), x[0].get('ShowDate') or ''))
    E = html.escape
    parts, n, counts = [], 0, {}
    for key, title, lead, keep in GROUPS:
        gr = [(s, r) for s, r in rows if r['group'] == key]
        counts[key] = len(gr)
        if not gr:
            continue
        parts.append(f'<h2 id="g-{key}">{E(title)}<span>{len(gr)}</span></h2><p class="gl">{E(lead)}</p>')
        for s, r in gr:
            n += 1
            place = ' · '.join(x for x in [s.get('ShowDate') or 'Undated', s.get('EventOrFestival'), s.get('VenueName'), s.get('City')] if x)
            flags = '<span class="flag">a name taken out: check</span>' if r['person'] else ''
            now = f'<div class="now"><b>Lineage today:</b> {E(r["current"])}</div>' if r['current'] else ''
            lines = ''.join(f'<div class="l {"video" if c["kind"] == "video" else ""}"><i>{E(c["kind"])}</i>{E(c["line"])}</div>' for c in r['cands'])
            parts.append(
                f'<section class="row" data-id="{s["ShowID"]}" data-hash="{r["hash"]}" data-label="{E(s["Artist"] + " · " + (s.get("ShowDate") or "Undated"))}">'
                f'<div class="head"><div class="n">{n}</div><div class="info"><div class="art">{E(s["Artist"])} <span class="sub">{E(place)}</span>{flags}</div>{now}'
                f'<textarea class="prop" rows="2" aria-label="Lineage">{E(r["suggestion"])}</textarea></div>'
                f'<div class="ch"><button class="opt rec" data-v="use"><span class="k">A</span>Use this lineage <em>suggested</em></button>'
                f'<button class="opt" data-v="keep"><span class="k">–</span>{E(keep)}</button></div></div>'
                f'<div class="ev">The arrow lines in its sidecar text (Notes), green where they read as video lineage:{lines}'
                f'<details><summary>All of its sidecar text</summary><pre>{E(s.get("Notes") or "")}</pre></details></div></section>')
    nav = ''.join(f'<a href="#g-{k}">{E(t)} {counts[k]}</a>' for k, t, _, _ in GROUPS if counts.get(k))
    doc = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
           f'<title>Lineage review</title><style>{STYLE}</style></head><body>'
           f'<header><div class="bar"><h1>Lineage</h1>{nav}<span class="sp"></span><label><input type="checkbox" id="hide"> Hide answered</label>'
           '<span class="prog" id="prog"></span><button class="copy" id="copyout">Copy for Claude Code</button></div></header>'
           '<main><p class="lead">Shows whose own sidecar text (the info file pasted into Notes) holds a <b>lineage chain</b> — '
           'steps joined by <b>&gt;</b>, <b>-&gt;</b>, <b>=&gt;</b> or <b>→</b> — that its Lineage field is missing or has only part of. '
           'Each suggestion is the chain word for word, its label ("Lineage:", "Source -") dropped, two chains joined with " | ", as the '
           'Lineage field already reads. <b>Edit the box</b> to change it (an edit counts as "use"), or keep what\'s there. '
           'Arrows that aren\'t lineage — a segue in the track list, an arrow used as a bullet, audio chains — are listed under each show and left out. '
           '<b>Nothing is written until you choose.</b></p>'
           f'{"".join(parts)}</main><div class="toast" id="toast">Copied</div><script>{SCRIPT}</script></body></html>')
    assert '�' not in doc
    open(OUT, 'w', encoding='utf-8').write(doc)
    print(OUT, n, 'records:', counts)


if __name__ == '__main__':
    main()

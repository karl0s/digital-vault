"""The broadcaster review (docs/ux-research F1, J2): which channel a pro-shot recording came from.

    python3 tools/broadcaster/build.py     # renders ~/VaultShots/reports/broadcaster.html

Traders rank copies by broadcast (an HD BBC feed over a cable re-air), and the name was nowhere
on a record. This drafts one per pro-shot record from what the record already says, in this
order: its own sidecar Notes and Lineage, its folder name, the talk show it is (Letterman is
CBS…), then the private notes. Each row shows the evidence; Karl accepts all or some and pastes
"Copy for Claude Code"; tools/broadcaster/apply.py writes `Broadcaster`. Read-only.
"""
import collections, html, json, os, re

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.expanduser('~/VaultShots/reports/broadcaster.html')

# (pattern, name as traders write it). Specific before general: "BBC Three" before "BBC".
CHANNELS = [
    (r'BBC\s?(?:One|1)\b', 'BBC One'), (r'BBC\s?(?:Two|2)\b', 'BBC Two'), (r'BBC\s?(?:Three|3)\b', 'BBC Three'),
    (r'BBC\s?(?:Four|4)\b', 'BBC Four'), (r'BBC\s?HD\b', 'BBC HD'), (r'BBCi\b', 'BBCi'), (r'BBC\s?Scotland\b', 'BBC Scotland'),
    (r'BBC\b', 'BBC'),
    (r'MTV\s?2\b', 'MTV2'), (r'MTV\s?Live\s?HD\b', 'MTV Live HD'), (r'MTV\s?Europe\b', 'MTV Europe'), (r'MTV\s?Japan\b', 'MTV Japan'),
    (r'MTV\s?Brasil\b', 'MTV Brasil'), (r'MTV\s?Australia\b', 'MTV Australia'), (r'MTV\b', 'MTV'),
    (r'VH1\b', 'VH1'), (r'VH2\b', 'VH2'),
    (r'Rockpalast\b', 'WDR'), (r'WDR\b', 'WDR'), (r'ZDF\s?kultur\b|ZDF\.kultur\b', 'ZDFkultur'), (r'ZDF\b', 'ZDF'), (r'3sat\b', '3sat'),
    (r'Arte\b', 'Arte'), (r'SWR\b', 'SWR'), (r'NDR\b', 'NDR'), (r'Einsfestival\b|EinsPlus\b', 'Einsfestival'), (r'Das Erste\b|\bARD\b', 'ARD'),
    (r'ProSieben\b|Pro7\b', 'ProSieben'), (r'VIVA\b', 'VIVA'), (r'RTL\b', 'RTL'),
    (r'VPRO\b', 'VPRO'), (r'NPS\b', 'NPS'), (r'BNN\b', 'BNN'), (r'TMF\b', 'TMF'), (r'Nederland\s?3\b', 'Nederland 3'), (r'3voor12\b', '3voor12'),
    (r'Canvas\b', 'Canvas'), (r'Canal\s?\+|Canal Plus', 'Canal+'), (r'France\s?(?:2|3|4)\b', None), (r'Paris Premi[eè]re\b', 'Paris Première'),
    (r'Channel\s?4\b', 'Channel 4'), (r'E4\b', 'E4'), (r'Sky\s?Arts\b', 'Sky Arts'), (r'4Music\b', '4Music'), (r'ITV\s?2\b', 'ITV2'), (r'ITV\b', 'ITV'),
    (r'Kerrang!?\s?TV\b', 'Kerrang! TV'), (r'Scuzz\b', 'Scuzz'),
    (r'\bSF\s?2\b', 'SF 2'), (r'\bSRF\b', 'SRF'), (r'\bORF\s?1\b', 'ORF 1'), (r'\bORF\b', 'ORF'),
    (r'\bDR\s?2\b', 'DR2'), (r'\bSVT\b', 'SVT'), (r'\bNRK\b', 'NRK'), (r'\bYLE\b', 'YLE'),
    (r'Rai\s?(?:3|Tre)\b', 'Rai 3'), (r'Rai\s?4\b', 'Rai 4'), (r'\bRAI\b|\bRai\b', 'Rai'), (r'Rete A\b', 'Rete A'),
    (r'\bTVE\b|\bLa\s?2\b', 'TVE'), (r'\bRTP\b', 'RTP'),
    (r'WOWOW\b', 'WOWOW'), (r'\bNHK\b', 'NHK'), (r'Space Shower\b', 'Space Shower TV'),
    (r'Multishow\b', 'Multishow'), (r'Globo\b', 'Globo'),
    (r'Much\s?Music\b', 'MuchMusic'), (r'\bCBC\b', 'CBC'),
    (r'\bHBO\b', 'HBO'), (r'\bFuse\b', 'Fuse'), (r'AXS\s?TV\b', 'AXS TV'), (r'Palladia\b', 'Palladia'), (r'HDNet\b', 'HDNet'), (r'\bPBS\b', 'PBS'),
    (r'DirecTV\b', 'DirecTV'), (r'Channel\s?V\b', 'Channel V'), (r'\bABC\s?2\b', 'ABC2'), (r'Triple J\b|\bjtv\b', 'Triple J (ABC)'), (r'\bSBS\b', 'SBS'),
    (r'\bNBC\b', 'NBC'), (r'\bCBS\b', 'CBS'), (r'\bTBS\b', 'TBS'),
]
CHANNELS = [(re.compile(p, re.I if n not in ('ARD', 'RTL', 'TVE') else 0), n) for p, n in CHANNELS]
FRANCE = re.compile(r'France\s?([234])\b', re.I)
# The talk shows CLAUDE.md names, and their networks.
SHOWS = {'David Letterman': 'CBS', 'Jay Leno': 'NBC', 'Jimmy Fallon': 'NBC', 'Saturday Night Live': 'NBC', 'Carson Daly': 'NBC',
         'Jimmy Kimmel': 'ABC', 'Jools Holland': 'BBC Two', 'Much Music Intimate & Interactive': 'MuchMusic', 'Farm Club': 'USA Network',
         'Rockpalast': 'WDR', 'Austin City Limits': 'PBS', 'MTV Unplugged': 'MTV', 'VH1 Storytellers': 'VH1'}


def found_in(text):
    """Every channel named in a text, in order of first mention, with a snippet."""
    hits = []
    for rx, name in CHANNELS:
        m = rx.search(text or '')
        if not m:
            continue
        name = name or f'France {FRANCE.search(m.group(0)).group(1)}'
        if any(name == h[0] or (h[0].startswith(name) and len(h[0]) > len(name)) for h in hits):
            continue  # "BBC" when "BBC Three" is already there
        a, b = max(0, m.start() - 50), min(len(text), m.end() + 50)
        hits.append((name, m.start(), ('…' if a else '') + ' '.join(text[a:b].split()) + ('…' if b < len(text) else '')))
    return sorted(hits, key=lambda h: h[1])


def draft(s):
    if s.get('RecordingType') != 'Proshot':
        return None
    sources = [('Sidecar', (s.get('Notes') or '') + '\n' + (s.get('Lineage') or '')), ('Folder name', s.get('FolderName') or '')]
    for label, text in sources:
        hits = found_in(text)
        if hits:
            return dict(name=hits[0][0], also=[h[0] for h in hits[1:]], where=label, quote=hits[0][2], strength='strong')
    event = s.get('EventOrFestival') or ''
    if event in SHOWS:
        return dict(name=SHOWS[event], also=[], where='Programme', quote=f'{event} is a {SHOWS[event]} programme', strength='strong')
    hits = found_in(s.get('PrivateNotes') or '')
    if hits:
        return dict(name=hits[0][0], also=[h[0] for h in hits[1:]], where='Private notes', quote=hits[0][2], strength='weak')
    return dict(name='', also=[], where='', quote='', strength='none')


def main():
    shows = [s for s in json.load(open(os.path.join(REPO, 'public', 'shows.json'), encoding='utf-8'))
             if s.get('Hidden') != 'Yes' and not s.get('Broadcaster')]
    rows = [(s, d) for s in shows for d in [draft(s)] if d]
    E = html.escape
    groups = [('strong', 'From the record itself: its sidecar, folder or programme'), ('weak', 'From the private notes only: check'),
              ('none', 'No channel named anywhere')]
    parts, n = [], 0
    for key, title in groups:
        gr = sorted([(s, d) for s, d in rows if d['strength'] == key], key=lambda x: (x[0]['Artist'].lower(), x[0].get('ShowDate') or ''))
        if not gr:
            continue
        parts.append(f'<h2 id="g-{key}">{E(title)}<span>{len(gr)}</span></h2>')
        if key == 'strong':
            parts.append('<div class="tools"><button class="acc" data-g="strong">Accept the suggestion for all of these</button></div>')
        elif key == 'weak':
            parts.append('<div class="tools"><button class="acc" data-g="weak">Accept all of these (check them: a note can name a channel in passing)</button></div>')
        parts.append('<table>')
        for s, d in gr:
            n += 1
            opts = (f'<button class="opt rec" data-v="accept"><span class="k">A</span>{E(d["name"])} <em>suggested</em></button>'
                    f'<button class="opt" data-v="skip"><span class="k">–</span>Leave it blank</button>') if d['name'] else ''
            also = f' · also named: {", ".join(d["also"])}' if d['also'] else ''
            place = ' · '.join(x for x in [s.get('EventOrFestival'), s.get('VenueName'), s.get('City')] if x)
            parts.append(f'''<tr data-id="{s['ShowID']}" data-g="{key}" data-name="{E(d['name'])}" data-label="{E(s['Artist'] + ' · ' + (s.get('ShowDate') or 'Undated'))}">
<td class="n">{n}</td><td><div class="art">{E(s['Artist'])} <span class="sub">{E(s.get('ShowDate') or 'Undated')} · {E(place)}</span></div>
<div class="name">{E(d['name']) or '—'}</div><div class="why">{E(d['where'] + ': ' + d['quote']) if d['quote'] else ''}{E(also)}</div></td>
<td class="chc"><div class="ch">{opts}</div></td></tr>''')
        parts.append('</table>')
    counts = collections.Counter(d['strength'] for _, d in rows)
    names = collections.Counter(d['name'] for _, d in rows if d['name']).most_common(12)
    doc = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Broadcaster review</title><style>
:root{{color-scheme:dark;--line:rgba(255,255,255,.08)}} *{{box-sizing:border-box}} body{{margin:0;background:#141414;color:#fff;font:14px/1.5 system-ui,sans-serif}} button{{font:inherit;color:inherit;cursor:pointer}}
header{{position:sticky;top:0;z-index:10;background:rgba(20,20,20,.97);border-bottom:1px solid var(--line)}} .bar{{max-width:1200px;margin:0 auto;padding:12px 24px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}}
h1{{font-size:18px;margin:0}} .bar a{{color:#d1d5db;text-decoration:none;font-size:13px;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.06)}} .sp{{flex:1}} .prog{{color:#d1d5db;font-size:13px}}
.copy{{border:0;border-radius:999px;font-weight:600;padding:8px 16px;font-size:13px;background:#fff;color:#111}}
main{{max-width:1200px;margin:0 auto;padding:8px 24px 80px}} .lead{{color:#d1d5db;max-width:900px}} .lead b{{color:#fff}}
h2{{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#9ca3af;margin:34px 0 6px;scroll-margin-top:70px}} h2 span{{letter-spacing:0;color:rgba(255,255,255,.5);margin-left:8px}}
table{{width:100%;border-collapse:collapse}} td{{padding:10px;border-bottom:1px solid var(--line);vertical-align:top}} tr.done td{{background:rgba(167,139,250,.05)}}
.n{{color:#9ca3af;width:40px}} .art{{font-weight:600}} .sub{{color:#9ca3af;font-weight:400;font-size:13px}} .name{{color:#fde68a;font-weight:600;font-size:15px;margin-top:2px}} .why{{color:#d1d5db;font-size:13px;max-width:720px}}
.chc{{width:240px}} .ch{{display:flex;flex-direction:column;gap:6px}}
.opt{{text-align:left;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);border-radius:8px;padding:7px 10px;font-size:13px;display:flex;gap:8px;align-items:center}} .opt em{{font-style:normal;font-size:11px;color:#6ee7b7;margin-left:auto}}
.opt .k{{width:20px;height:20px;flex:none;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700;background:rgba(255,255,255,.1)}} .opt.on{{border-color:#a78bfa;background:rgba(167,139,250,.14)}} .opt.on .k{{background:#a78bfa;color:#111}}
.tools{{margin:4px 0 8px}} .acc{{border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);border-radius:999px;padding:6px 14px;font-size:13px}}
.toast{{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#fff;color:#111;padding:10px 16px;border-radius:999px;font-weight:600;opacity:0;transition:opacity .2s}} .toast.on{{opacity:1}}
</style></head><body>
<header><div class="bar"><h1>Broadcaster</h1>{''.join(f'<a href="#g-{k}">{E(t.split(":")[0])} {counts[k]}</a>' for k, t in groups if counts[k])}<span class="sp"></span><span class="prog" id="prog"></span><button class="copy" id="copyout">Copy for Claude Code</button></div></header>
<main><p class="lead">Which channel each <b>pro-shot</b> recording came from, drafted from what its own record says: its sidecar and lineage first, then its folder name, then the talk show it is (Letterman is CBS, Jools Holland BBC Two…), then the private notes. <b>Nothing is written until you choose.</b> Most common: {E(", ".join(f"{k} {v}" for k, v in names))}.</p>
{''.join(parts)}</main><div class="toast" id="toast">Copied</div>
<script>
const KEY='vault-broadcaster-2026-10-18'; let picks={{}}; try{{picks=JSON.parse(localStorage.getItem(KEY)||'{{}}')}}catch(e){{}}
const save=()=>{{try{{localStorage.setItem(KEY,JSON.stringify(picks))}}catch(e){{}}}}; const rows=[...document.querySelectorAll('tr[data-id]')].filter(r=>r.querySelector('.opt'));
function paint(){{for(const tr of rows){{const v=picks[tr.dataset.id];tr.classList.toggle('done',!!v);tr.querySelectorAll('.opt').forEach(b=>b.classList.toggle('on',b.dataset.v===v))}}document.getElementById('prog').textContent=rows.filter(r=>picks[r.dataset.id]).length+' of '+rows.length+' answered'}}
document.addEventListener('click',e=>{{const o=e.target.closest('.opt');if(o){{const k=o.closest('tr').dataset.id;picks[k]===o.dataset.v?delete picks[k]:picks[k]=o.dataset.v;save();paint();return}}
const a=e.target.closest('.acc');if(a){{rows.filter(r=>r.dataset.g===a.dataset.g&&!picks[r.dataset.id]).forEach(r=>picks[r.dataset.id]='accept');save();paint()}}}});
document.getElementById('copyout').addEventListener('click',async()=>{{const acc=[],skip=[];for(const tr of rows){{const v=picks[tr.dataset.id];if(v==='accept')acc.push(tr.dataset.id+'  '+tr.dataset.name+'  '+tr.dataset.label);else if(v)skip.push(tr.dataset.id+'  '+tr.dataset.label)}}
const t=['BROADCASTER: '+(acc.length+skip.length)+' of '+rows.length+' answered','','ACCEPT ('+acc.length+')',...acc,'','LEAVE BLANK ('+skip.length+')',...skip].join('\\n');
try{{await navigator.clipboard.writeText(t)}}catch(e){{const ta=document.createElement('textarea');ta.value=t;document.body.append(ta);ta.select();document.execCommand('copy');ta.remove()}}
const el=document.getElementById('toast');el.classList.add('on');setTimeout(()=>el.classList.remove('on'),1500)}});
paint();
</script></body></html>'''
    assert '�' not in doc
    open(OUT, 'w', encoding='utf-8').write(doc)
    print(OUT, len(rows), 'pro-shot records:', dict(counts), '| most common:', names[:8])


if __name__ == '__main__':
    main()

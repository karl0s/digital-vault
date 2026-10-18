"""The generation review: shows whose own sidecar has a "Generation:" section and no `Generation`.

    python3 tools/generation/build.py     # renders ~/VaultShots/reports/generation.html

`Generation` reads "Master", "1st Gen", "2nd Gen"; a sidecar's "GENERATION:" section is usually a
chain ("TV > VHS(1) > DVDR(0)"). The suggestion reads the chain's own markers: (M) or [M], or a
straight digital capture (DVB, HDTV, a feed, a webstream) with no tape, is a Master; a tape's (1)
or [1] the 1st generation, and the highest number in the chain wins ("VHS(1) > DVDR(2)" is the
2nd). Karl uses, edits or leaves each; tools/generation/apply.py writes his picks. Built like the
lineage review (tools/lineage), whose page it shares. Read-only.
"""
import hashlib, html, importlib.util, json, os, re

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.expanduser('~/VaultShots/reports/generation.html')
_spec = importlib.util.spec_from_file_location('lineage_build', os.path.join(REPO, 'tools', 'lineage', 'build.py'))
_lineage = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_lineage)

# Written into PrivateNotes once Karl has answered a record (apply.py).
ANSWERED = "the owner's pick on the generation review"
HEAD = re.compile(r'(?i)^\s*(?:generation|gen)\s*[:\-=]\s*(.*)$')
MARK = re.compile(r'(?i)\b(?:VHS|S-?VHS|Beta\w*|U-?Matic|Hi-?8|DV|MiniDV|DVDR?|DVD-R|MPEG-TS|TS|tape|master)\s*[(\[](M|\d+)[)\]]|\b(?:VHS|tape)-M\b|\[M\]|\(master\)')
DIGITAL = re.compile(r'(?i)\b(?:DVB\S*|HDTV|ATSC|transport stream|satellite feed|live satellite|feed|webstream|web ?cast|stream|mpeg-ts|\.ts)\b')
TAPE = re.compile(r'(?i)\b(?:VHS|S-?VHS|Beta\w*|U-?Matic|Hi-?8|tape)\b')
ORDINAL = {1: '1st Gen', 2: '2nd Gen', 3: '3rd Gen'}


def section(notes):
    """The "Generation:" section: its own line, or the lines under a bare heading."""
    lines = (notes or '').splitlines()
    for i, line in enumerate(lines):
        m = HEAD.match(line)
        if not m:
            continue
        if m.group(1).strip():
            return m.group(1).strip()
        under = []
        for nxt in lines[i + 1:]:
            if not nxt.strip() or re.match(r'^\s*[A-Z][A-Z ]{2,}:\s*$', nxt):
                break
            under.append(nxt.strip())
        return ' '.join(under)
    return ''


def suggest(text):
    """(label or '', the markers it rests on)."""
    if not text or re.fullmatch(r'(?i)\s*unknown\.?\s*', text):
        return '', []
    marks = [m.group(0) for m in MARK.finditer(text)]
    numbers = [int(n) for m in MARK.finditer(text) for n in [m.group(1)] if n and n.isdigit()]
    tape_numbers = [int(m.group(1)) for m in MARK.finditer(text) if m.group(1) and m.group(1).isdigit() and TAPE.search(m.group(0))]
    if any(re.search(r'(?i)\(M\)|\[M\]|-M\b|\(master\)', x) for x in marks) and not tape_numbers:
        return 'Master', marks
    if numbers and max(numbers) >= 1:
        return ORDINAL.get(max(numbers), f'{max(numbers)}th Gen'), marks
    if DIGITAL.search(text) and not TAPE.search(text):
        return 'Master', marks or ['a direct digital capture, no tape']
    return '', marks


def review(s):
    if s.get('Generation') or ANSWERED in (s.get('PrivateNotes') or ''):
        return None
    text = section(s.get('Notes'))
    if not text:
        return None
    label, marks = suggest(text)
    return dict(group='missing', text=text, suggestion=label, marks=marks, current='',
                hash=hashlib.sha1(label.encode()).hexdigest()[:6])


def main():
    shows = [s for s in json.load(open(os.path.join(REPO, 'public', 'shows.json'), encoding='utf-8')) if s.get('Hidden') != 'Yes']
    rows = sorted([(s, r) for s in shows for r in [review(s)] if r], key=lambda x: (x[0]['Artist'].lower(), x[0].get('ShowDate') or ''))
    E = html.escape
    parts = []
    for n, (s, r) in enumerate(rows, 1):
        place = ' · '.join(x for x in [s.get('ShowDate') or 'Undated', s.get('EventOrFestival'), s.get('VenueName'), s.get('City')] if x)
        why = (f'Read from: {", ".join(r["marks"])}' if r['marks'] else 'Nothing in it says the generation') if r['suggestion'] else 'No suggestion: the sidecar doesn\'t say'
        parts.append(
            f'<section class="row" data-id="{s["ShowID"]}" data-hash="{r["hash"]}" data-label="{E(s["Artist"] + " · " + (s.get("ShowDate") or "Undated"))}">'
            f'<div class="head"><div class="n">{n}</div><div class="info"><div class="art">{E(s["Artist"])} <span class="sub">{E(place)}</span></div>'
            f'<div class="now"><b>Lineage:</b> {E(s.get("Lineage") or "—")}</div>'
            f'<textarea class="prop" rows="1" aria-label="Generation" placeholder="Master, 1st Gen, 2nd Gen…">{E(r["suggestion"])}</textarea>'
            f'<div class="now">{E(why)}</div></div>'
            f'<div class="ch"><button class="opt rec" data-v="use"><span class="k">A</span>Use this generation <em>suggested</em></button>'
            f'<button class="opt" data-v="keep"><span class="k">–</span>Leave it blank</button></div></div>'
            f'<div class="ev">Its sidecar\'s generation section:<div class="l video">{E(r["text"])}</div>'
            f'<details><summary>All of its sidecar text</summary><pre>{E(s.get("Notes") or "")}</pre></details></div></section>')
    script = (_lineage.SCRIPT.replace("vault-lineage-2026-10-18", "vault-generation-2026-10-19")
              .replace("'LINEAGE: '", "'GENERATION: '"))
    assert 'GENERATION: ' in script and 'vault-generation' in script
    doc = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
           f'<title>Generation review</title><style>{_lineage.STYLE}</style></head><body>'
           '<header><div class="bar"><h1>Generation</h1><span class="sp"></span><label><input type="checkbox" id="hide"> Hide answered</label>'
           '<span class="prog" id="prog"></span><button class="copy" id="copyout">Copy for Claude Code</button></div></header>'
           '<main><p class="lead">Shows whose own sidecar has a <b>Generation</b> section and whose Generation field is empty. The field reads '
           '<b>Master</b>, <b>1st Gen</b>, <b>2nd Gen</b>; the sidecar\'s section is usually a chain, so each suggestion reads the chain\'s '
           'markers: (M) or [M], or a straight digital capture with no tape, is a Master; a tape\'s (1) the 1st generation; the highest number '
           'in the chain wins. <b>Edit the box</b> to change it, or leave it blank. <b>Nothing is written until you choose.</b></p>'
           f'{"".join(parts)}</main><div class="toast" id="toast">Copied</div><script>{script}</script></body></html>')
    assert '�' not in doc
    open(OUT, 'w', encoding='utf-8').write(doc)
    print(OUT, len(rows), 'records')
    for s, r in rows:
        print(f"  {s['ShowID']}  {s['Artist'][:22]:22} {r['suggestion'] or '—':9} {r['text'][:80]}")


if __name__ == '__main__':
    main()

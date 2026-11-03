#!/usr/bin/env python3
"""Hero options for one show: frames around chosen moments, rendered exactly as the pipeline renders
picks, on one page for the owner to choose from. Writes nothing to the repo; promotion is separate.

    python3 hero_options.py --showid acede40f98f5 \
        --around "Current hero=00:30:32" --span 10 --step 0.5 \
        --twin aa813cc575ee --twin ae6d79e09d8d --twin fa64fa89dba8 --twin-span 2 --twin-step 0.33

  --around LABEL=TS   scrub TS +/- --span seconds every --step seconds (repeatable)
  --twin SHOWID       another copy of the show: its site hero, and this recording's frames around the
                      moment twin_match.py found that hero at, +/- --twin-span
  --match FILE        the twin_match report made FROM THIS RECORDING (reports/twins/<slug>/match.json).
                      Required with --twin: other reports hold matches against other copies' files.

Frames come from shots.grab with shots.build_vf_seek on the show's planned unit (state.json, or the
archived run's state): the same deinterlacer, scaler, size and JPEG settings as every pick (§4.8),
verified with shots.verify. Output: reports/hero-<ShowID>/ and reports/hero-<ShowID>.html.
"""
import argparse, glob, html, json, os, shutil, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image

VS = Path.home() / 'VaultShots'
REPO = Path.home() / 'Desktop/Projects/the-vault'
sys.path.insert(0, str(VS))
import shots  # noqa: E402


def secs(ts):
    p = [float(x) for x in str(ts).replace('-', ':').split(':')]
    return sum(v * 60 ** i for i, v in enumerate(reversed(p)))


def hms(t):
    return '%d:%02d:%05.2f' % (t // 3600, t % 3600 // 60, t % 60)


def unit_for(showid):
    for f in [VS / 'data/state.json'] + sorted(Path(p) for p in glob.glob(str(VS / 'archive/*/state.json'))):
        for u in json.load(open(f)).get('shows', []):
            if u.get('ShowID') == showid and u.get('target_w'):
                return u, f
    raise SystemExit('no planned unit with a target size for %s' % showid)


def sharpness(p):
    a = np.asarray(Image.open(p).convert('L'), dtype=float)
    lap = a[:-2, 1:-1] + a[2:, 1:-1] + a[1:-1, :-2] + a[1:-1, 2:] - 4 * a[1:-1, 1:-1]
    return float(lap.var())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--showid', required=True)
    ap.add_argument('--around', action='append', default=[])
    ap.add_argument('--span', type=float, default=10)
    ap.add_argument('--step', type=float, default=0.5)
    ap.add_argument('--twin', action='append', default=[])
    ap.add_argument('--twin-span', type=float, default=2)
    ap.add_argument('--twin-step', type=float, default=0.33)
    ap.add_argument('--match')
    a = ap.parse_args()

    shows = {s['ShowID']: s for s in json.load(open(REPO / 'public/shows.json', encoding='utf-8'))}
    rec = shows[a.showid]
    unit, statefile = unit_for(a.showid)
    vf = shots.build_vf_seek(unit, shots.DEFAULT_DEINT)
    out = VS / 'reports' / ('hero-' + a.showid)
    shots.assert_readonly_target(out / 'x.jpg')
    out.mkdir(parents=True, exist_ok=True)

    groups = []   # (title, note, reference image or None, [times]); the scrubs follow the twins' moments
    arounds = []
    for spec in a.around:
        label, ts = spec.split('=', 1)
        c = secs(ts)
        n = int(round(a.span / a.step))
        arounds.append((label, 'Every %gs, %gs either side of %s' % (a.step, a.span, hms(c)), None,
                        [round(c + i * a.step, 2) for i in range(-n, n + 1)]))
    if a.twin and not a.match:
        raise SystemExit('--twin needs --match: the twin_match report made from this recording')
    matches = json.load(open(a.match)) if a.match else []
    for twin in a.twin:
        m = next((m for m in matches if m['twin'] == twin and m['slot'] == 1), None)
        if not m:
            print('no twin match for', twin); continue
        ref = REPO / 'public/images' / ('%s_01.jpg' % shows[twin]['ChecksumSHA1'])
        dst = out / ('ref_%s_01.jpg' % twin)
        shutil.copyfile(ref, dst)
        n = int(round(a.twin_span / a.twin_step))
        tw = shows[twin]
        title = '%s copy (%s, %s)' % (tw.get('Broadcaster') or 'Other', twin, (tw.get('FolderName') or '')[:60])
        groups.append((title, 'Its site hero, found in this recording at %s (match %.2f); every %gs, %gs either side'
                       % (hms(m['t']), m['fine'], a.twin_step, a.twin_span), dst.name,
                       [round(m['t'] + i * a.twin_step, 2) for i in range(-n, n + 1)]))

    groups += arounds
    jobs = sorted({t for g in groups for t in g[3]})
    def render(t):
        p = out / ('t%s.jpg' % hms(t).replace(':', '-'))
        if not p.exists() and not shots.grab(unit['src'], t, vf, p):
            return t, None, 'grab failed'
        ok, why = shots.verify(p, unit)
        return t, p if ok else None, why
    with ThreadPoolExecutor(4) as ex:
        res = {t: (p, why) for t, p, why in ex.map(render, jobs)}
    bad = [(t, w) for t, (p, w) in res.items() if not p]
    print('rendered %d, failed %d' % (len(jobs) - len(bad), len(bad)), bad[:5])

    cur = REPO / 'public/images' / ('%s_01.jpg' % rec['ChecksumSHA1'])
    shutil.copyfile(cur, out / 'current_01.jpg')
    sharp = {t: sharpness(p) for t, (p, _) in res.items() if p}

    def vec(f):
        v = np.asarray(Image.open(f).convert('L').resize((96, 72)), dtype=float).ravel()
        v -= v.mean()
        return v / (np.linalg.norm(v) + 1e-6)
    # The frame that IS the site's current hero, if one was rendered (same pixels, correlation ~1).
    cv = vec(out / 'current_01.jpg')
    same = {t for t, (p, _) in res.items() if p and float(cv @ vec(p)) > 0.995}

    def card(t):
        p, _ = res[t]
        if not p:
            return ''
        badge = '<b class="now-tag">On the site now</b>' if t in same else ''
        return ('<label class="c"><input type="radio" name="hero" value="%s" data-file="%s"><a href="%s/%s" target="_blank">'
                '<img src="%s/%s" loading="lazy" alt=""></a><span>%s · sharp %d %s</span></label>'
                % (hms(t), p.name, out.name, p.name, out.name, p.name, hms(t), sharp[t], badge))
    sections = ''
    for title, note, ref, times in groups:
        refhtml = ('<figure class="ref"><img src="%s/%s" alt=""><figcaption>Their hero now (another copy, for comparison)</figcaption></figure>'
                   % (out.name, ref)) if ref else ''
        sections += ('<section><h2>%s</h2><p class="note">%s</p><div class="row">%s<div class="grid">%s</div></div></section>'
                     % (html.escape(title), html.escape(note), refhtml, ''.join(card(t) for t in times)))
    name = '%s, %s, %s' % (rec['Artist'], rec.get('VenueName') or '', rec.get('ShowDate') or '')
    doc = PAGE.replace('{TITLE}', html.escape(name)).replace('{SHOWID}', a.showid).replace('{DIR}', out.name) \
              .replace('{FOLDER}', html.escape(rec.get('FolderName') or '')).replace('{SECTIONS}', sections) \
              .replace('{CURTS}', html.escape(', '.join(a.around)))
    page = VS / 'reports' / ('hero-%s.html' % a.showid)
    page.write_text(doc, encoding='utf-8')
    print(page, '| unit from', statefile, '| vf', vf)


PAGE = r'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hero Options</title><style>
:root{--bg:#f6f6f4;--panel:#fff;--ink:#16161a;--ink-2:#55555f;--ink-3:#8a8a94;--line:#e6e6e2;--accent:#4f46e5;--ok:#0f7b45;--ok-bg:#e3f6ec;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0f0f11;--panel:#17171a;--ink:#ededf0;--ink-2:#a9a9b3;--ink-3:#73737d;--line:#26262b;--accent:#8b85ff;--ok:#5fd39a;--ok-bg:#123324;color-scheme:dark}}
*{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif}
.wrap{max-width:1500px;margin:0 auto;padding:22px 16px 110px} h1{font-size:21px;margin:0} h2{font-size:15px;margin:28px 0 2px} .note,.lede{color:var(--ink-2);margin:2px 0 10px}
.now{display:flex;gap:14px;align-items:flex-start;margin-top:12px} .now img{width:360px;border-radius:8px;display:block}
.row{display:flex;gap:14px;align-items:flex-start} .ref{margin:0;flex:0 0 300px} .ref img{width:300px;border-radius:8px;display:block;outline:2px solid var(--line)} .ref figcaption{font-size:12px;color:var(--ink-3);margin-top:4px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;flex:1}
.c{display:block;background:var(--panel);border:2px solid var(--line);border-radius:10px;padding:6px;cursor:pointer}
.c img{width:100%;display:block;border-radius:6px} .c span{display:block;font-size:12px;color:var(--ink-2);margin-top:4px;font-variant-numeric:tabular-nums}
.c input{position:absolute;opacity:0} .now-tag{font-size:11px;color:var(--ok);background:var(--ok-bg);border-radius:999px;padding:0 6px;margin-left:4px} .c:has(input:checked){border-color:var(--accent);background:color-mix(in srgb,var(--accent) 8%,var(--panel))}
.bar{position:fixed;left:0;right:0;bottom:0;background:var(--panel);border-top:1px solid var(--line);padding:10px 16px;display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap}
.bar img{height:54px;border-radius:4px} button{height:34px;border:0;border-radius:9px;padding:0 14px;font:inherit;font-weight:600;background:var(--ink);color:var(--bg);cursor:pointer;transition:transform 160ms cubic-bezier(0.23,1,0.32,1)}
button:active{transform:scale(0.97)} .ok{color:var(--ok)}
@media (max-width:760px){.row,.now{flex-direction:column}.ref{flex:none}.now img,.ref img{width:100%}}
@media (prefers-reduced-motion:reduce){button{transition:none}}
</style></head><body><div class="wrap">
<h1>Hero options: {TITLE}</h1>
<p class="lede">Record {SHOWID} ({FOLDER}). Every frame below is rendered the way the site's stills are (720×540, deinterlaced, nothing retouched). Click one to choose it; click the picture's link to see it full size. Then copy your pick for Claude Code. Nothing changes on the site until you paste it back.</p>
<div class="now"><figure class="ref"><img src="{DIR}/current_01.jpg" alt=""><figcaption>The hero on the site now ({CURTS})</figcaption></figure></div>
{SECTIONS}
</div>
<div class="bar"><span id="sel">No frame chosen yet</span><button id="copy">Copy for Claude Code</button><span id="msg" class="ok"></span></div>
<script>
let pick=null;const sel=document.getElementById('sel');
document.addEventListener('change',e=>{if(e.target.name!=='hero')return;pick={ts:e.target.value,file:e.target.dataset.file};
  sel.textContent='';const im=document.createElement('img');im.alt='';im.src='{DIR}/'+pick.file;sel.append(im,' Chosen: '+pick.ts)});
document.getElementById('copy').addEventListener('click',async()=>{
  const t=pick?`HERO PICK {SHOWID}: slot 1 = frame at ${pick.ts} (reports/{DIR}/${pick.file})`:'HERO PICK {SHOWID}: (no frame chosen)';
  try{await navigator.clipboard.writeText(t)}catch(e){const a=document.createElement('textarea');a.value=t;document.body.append(a);a.select();document.execCommand('copy');a.remove()}
  const m=document.getElementById('msg');m.textContent='Copied: paste it into Claude Code';setTimeout(()=>m.textContent='',2500)});
</script></body></html>'''

if __name__ == '__main__':
    main()

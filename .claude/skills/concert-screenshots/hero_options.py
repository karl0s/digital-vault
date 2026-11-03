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
import argparse, glob, html, json, os, re, shutil, sys
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


def unit_for(showid, rec):
    """The show's planned unit (state.json, or an archived run's). With none, plan this one show the
    way shots.py plan does (pick_source, ffprobe, compute_target, apply_override, the gates), in
    memory: state.json is never written, so another session's run is left alone."""
    for f in [VS / 'data/state.json'] + sorted(Path(p) for p in glob.glob(str(VS / 'archive/*/state.json'))):
        for u in json.load(open(f)).get('shows', []):
            if u.get('ShowID') == showid and u.get('target_w'):
                return u, f
    folder = Path(rec.get('FolderPath') or '')
    if not folder.is_dir():
        raise SystemExit('no planned unit for %s, and its folder is not on the drive: %s' % (showid, folder))
    # The folder's capture rule (data/splits.json) says which titleset, VOBs or files are this show.
    rule = {}
    for r in json.load(open(VS / 'data/splits.json')).get(folder.name, []):
        if r.get('showid') == showid:
            rule = r
    if rule.get('from') or rule.get('to') or rule.get('subdir'):
        raise SystemExit('%s is a time-window or nested-disc split: plan it with plan_subset.py first' % showid)
    if not rule:
        # No rule: follow the record's own files (RepVideoFiles), into a nested disc and its titleset if they say so.
        rep = [x.strip() for x in str(rec.get('RepVideoFiles') or '').split(';') if x.strip()]
        sub = {x.split('/VIDEO_TS/')[0] for x in rep if '/VIDEO_TS/' in x and not x.startswith('VIDEO_TS/')}
        if len(sub) == 1:
            folder = folder / sub.pop()
        vts = sorted({m.group(1) for x in rep for m in [re.search(r'VTS_(\d\d)_\d\.VOB', x)] if m})
        if vts:
            rule = {'vts': vts}
    src, kind, files = shots.pick_source(folder, rule.get('vts'), rule.get('vobs'), rule.get('files'))
    info, err = shots.ffprobe_stream(src) if src else (None, 'no video files')
    if not info:
        raise SystemExit('cannot plan %s: %s' % (showid, err))
    it = {'rel': folder.name, 'label': folder.name, 'ShowID': showid}
    t = shots.apply_override(it, shots.compute_target(info['stream']))
    passed, glist = shots.gates(t, rec.get('AspectRatio'))
    if not passed:
        raise SystemExit('gates failed for %s: %s' % (showid, [g for g in glist if not g[1]]))
    return dict(t, src=src, kind=kind), 'planned now from ' + str(folder)


def fps_of(unit):
    f = str(unit.get('fps') or '30000/1001')
    n, d = (f.split('/') + ['1'])[:2]
    return float(n) / float(d or 1)


def seek_works(unit, vf, out):
    """Some discs restart their timestamps in every VOB, so -ss lands nowhere (SKILL.md §5.2): test once."""
    p = out / '_seektest.jpg'
    ok = shots.grab(unit['src'], 60.0, vf, p)
    p.unlink(missing_ok=True)
    return ok


def nv(m):
    m = m - m.mean(axis=-1, keepdims=True)
    return m / (np.linalg.norm(m, axis=-1, keepdims=True) + 1e-6)


def scan(unit, out, index_mode):
    """The whole show at 48x36 grey, about twice a second, and the time of each row. Seek mode samples by
    timestamp (fps=2); index mode by frame number (every K-th decoded frame), because on a disc whose
    timestamps restart the frame number is the only coordinate (SKILL.md §5.2b). Cached for re-runs."""
    import subprocess
    fps = fps_of(unit)
    K = max(1, round(fps / 2))
    cache = out / ('scan_48x36_%s.npy' % ('idx%d' % K if index_mode else '2fps'))
    if cache.exists():
        F = np.load(cache)
    else:
        vf = ("select='not(mod(n\\,%d))',scale=48:36,format=gray" % K) if index_mode else 'fps=2,scale=48:36,format=gray'
        args = ['ffmpeg', '-hide_banner', '-nostdin', '-v', 'error', '-i', unit['src'], '-an', '-vf', vf]
        args += (['-vsync', '0'] if index_mode else []) + ['-f', 'rawvideo', '-']
        raw = subprocess.run(args, capture_output=True).stdout
        n = len(raw) // (48 * 36)
        F = nv(np.frombuffer(raw[: n * 48 * 36], np.uint8).reshape(n, 48 * 36).astype(np.float32))
        np.save(cache, F)
    t_of = (lambda i: round(i * K / fps, 2)) if index_mode else (lambda i: round(i / 2.0, 2))
    return F, t_of


def render_index(unit, times, out):
    """Frames by frame NUMBER in one decode: each wanted frame with 4 neighbours either side (a temporal
    deinterlacer needs consecutive frames, SKILL.md §4.7), the windows merged, deinterlaced, scaled; then
    each window's middle frame kept. Same settings as every pick (§4.8). Returns {t: path}."""
    import subprocess, tempfile
    fps = fps_of(unit)
    want = sorted({round(t * fps) for t in times})
    wins = []
    for n in want:
        a, b = max(0, n - 4), n + 4
        if wins and a <= wins[-1][1] + 1:
            wins[-1][1] = max(wins[-1][1], b)
        else:
            wins.append([a, b])
    seq = [n for a, b in wins for n in range(a, b + 1)]
    pos = {n: i for i, n in enumerate(seq)}
    expr = '+'.join('between(n\\,%d\\,%d)' % (a, b) for a, b in wins)
    head, di, tail = shots.vf_parts(unit, shots.DEFAULT_DEINT)
    vf = ','.join(x for x in (head, "select='%s'" % expr, di, tail) if x)
    tmp = Path(tempfile.mkdtemp(dir=str(out)))
    shots.assert_readonly_target(tmp / 'x.jpg')
    subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-v', 'error', '-y', '-i', unit['src'], '-an', '-vf', vf,
                    '-vsync', '0', '-q:v', '2', '-pix_fmt', 'yuvj420p', str(tmp / 'f_%06d.jpg')], capture_output=True)
    got = {}
    for t in times:
        n = round(t * fps)
        f = tmp / ('f_%06d.jpg' % (pos[n] + 1))
        if f.exists():
            p = out / ('t%s.jpg' % hms(round(n / fps, 2)).replace(':', '-'))
            shutil.move(str(f), p)
            got[round(n / fps, 2)] = p
    shutil.rmtree(tmp, ignore_errors=True)
    return got


def locate(unit, out, index_mode, img):
    """Where a still sits in this recording: the best scan row, then frame by frame over 2 s around it."""
    F, t_of = scan(unit, out, index_mode)
    v = nv(np.asarray(Image.open(img).convert('L').resize((48, 36)), dtype=np.float32).ravel()[None, :])[0]
    c = t_of(int(np.argmax(F @ v)))
    fps = fps_of(unit)
    ts = [round((round(c * fps) + k) / fps, 2) for k in range(-int(fps), int(fps) + 1)]
    if index_mode:
        got = render_index(unit, ts, out)
    else:
        vf = shots.build_vf_seek(unit, shots.DEFAULT_DEINT)
        got = {}
        for t in ts:
            p = out / ('t%s.jpg' % hms(t).replace(':', '-'))
            if p.exists() or shots.grab(unit['src'], t, vf, p):
                got[t] = p
    def vec(f):
        x = np.asarray(Image.open(f).convert('L').resize((96, 72)), dtype=float).ravel()
        x -= x.mean()
        return x / (np.linalg.norm(x) + 1e-6)
    ref = vec(img)
    best = max(got, key=lambda t: float(ref @ vec(got[t])))
    for t, p in got.items():
        if t != best:
            p.unlink(missing_ok=True)
    print('located the current hero at %s (match %.3f)' % (hms(best), float(ref @ vec(got[best]))))
    return best


def similar_group(unit, rec, a, groups):
    """Moments across the whole show that look like the hero: the show decoded twice a second at 48x36
    grey, each frame scored by its best normalised correlation with the templates (the current hero,
    and any twin's hero), then the best frames taken greedily, at least --similar-gap seconds apart and
    away from the moments already on the page."""
    import subprocess
    temps = [REPO / 'public/images' / ('%s_01.jpg' % rec['ChecksumSHA1'])]
    temps += [VS / 'reports' / ('hero-' + a.showid) / g[2] for g in groups if g[2]]
    for t in a.like:
        f = VS / 'reports' / ('hero-' + a.showid) / ('t%s.jpg' % hms(round(secs(t), 2)).replace(':', '-'))
        if not f.exists():
            raise SystemExit('--like %s: no rendered frame %s' % (t, f.name))
        temps.append(f)
    T = nv(np.stack([np.asarray(Image.open(t).convert('L').resize((48, 36)), dtype=np.float32).ravel() for t in temps]))
    F, t_of = scan(unit, VS / 'reports' / ('hero-' + a.showid), a.index_mode)
    n = len(F)
    score = (F @ T.T).max(axis=1)
    lo, hi = int(n * 0.03), int(n * 0.97)                      # not the opening card or the credits
    taken = [t for g in groups for t in g[3]]
    bad = [secs(x) for x in a.exclude]
    picks = []
    for i in np.argsort(-score):
        if not lo <= i < hi:
            continue
        t = t_of(i)
        if any(abs(t - b) <= 3 for b in bad):
            continue
        if all(abs(t - x) >= a.similar_gap for x in picks + taken):
            picks.append(t)
        if len(picks) >= a.similar:
            break
    print('similar: %d frames scanned, %d moments' % (n, len(picks)))
    return ('More like the hero, across the show', '%d moments that look most like the current hero%s, at least %gs apart, in show order'
            % (len(picks), ' and the other copies\' heroes' if len(temps) > 1 else '', a.similar_gap), None, sorted(picks))


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
    ap.add_argument('--ref', help='LABEL=PATH: an image (e.g. an old hero from git) shown beside the first --around group')
    ap.add_argument('--similar', type=int, default=0,
                    help='also find N moments across the whole show that look like the current hero (and the twins\' heroes)')
    ap.add_argument('--similar-gap', type=float, default=15, help='seconds between those moments')
    ap.add_argument('--moment', action='append', default=[],
                    help='HH:MM:SS.ss of a moment already checked by eye (e.g. kept from a --similar round): shown as its own group')
    ap.add_argument('--moment-title', default='More close-ups across the show (checked)')
    ap.add_argument('--like', action='append', default=[],
                    help='HH:MM:SS.ss of a frame already rendered for this show to use as an extra --similar template (e.g. a confirmed close-up)')
    ap.add_argument('--exclude', action='append', default=[],
                    help='HH:MM:SS.ss of a look-alike that is not the singer (a wide, another member): never offered again')
    a = ap.parse_args()

    shows = {s['ShowID']: s for s in json.load(open(REPO / 'public/shows.json', encoding='utf-8'))}
    rec = shows[a.showid]
    unit, statefile = unit_for(a.showid, rec)
    vf = shots.build_vf_seek(unit, shots.DEFAULT_DEINT)
    out = VS / 'reports' / ('hero-' + a.showid)
    shots.assert_readonly_target(out / 'x.jpg')
    out.mkdir(parents=True, exist_ok=True)
    a.index_mode = unit.get('decode') == 'single' or not seek_works(unit, vf, out)
    if a.index_mode:
        print('seeking fails on this disc: frames are found and rendered by frame number (SKILL.md §5.2b)')
    cur = REPO / 'public/images' / ('%s_01.jpg' % rec['ChecksumSHA1'])

    groups = []   # (title, note, reference image or None, [times]); the scrubs follow the twins' moments
    arounds = []
    ref_name, ref_caption = None, ''
    if a.ref:
        ref_caption, ref_path = a.ref.split('=', 1)
        ref_name = 'ref_custom.jpg'
        shutil.copyfile(ref_path, out / ref_name)
    for spec in a.around:
        label, ts = spec.split('=', 1)
        c = locate(unit, out, a.index_mode, cur) if ts.strip() == 'auto' else secs(ts)
        n = int(round(a.span / a.step))
        arounds.append((label, 'Every %gs, %gs either side of %s' % (a.step, a.span, hms(c)), ref_name if not arounds else None,
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
    if a.similar:
        groups.append(similar_group(unit, rec, a, groups))
    if a.moment:
        groups.append((a.moment_title, '%d moments, in show order' % len(a.moment), None, sorted(round(secs(m), 2) for m in a.moment)))
    if a.index_mode:   # every time snaps to a whole frame, so a page time and its file always agree
        fps = fps_of(unit)
        groups = [(g[0], g[1], g[2], [round(round(t * fps) / fps, 2) for t in g[3]]) for g in groups]
    jobs = sorted({t for g in groups for t in g[3]})
    def render(t):
        p = out / ('t%s.jpg' % hms(t).replace(':', '-'))
        if not p.exists() and not shots.grab(unit['src'], t, vf, p):
            return t, None, 'grab failed'
        ok, why = shots.verify(p, unit)
        return t, p if ok else None, why
    if a.index_mode:
        have = {t: out / ('t%s.jpg' % hms(t).replace(':', '-')) for t in jobs}
        missing = [t for t, p in have.items() if not p.exists()]
        if missing:
            render_index(unit, missing, out)
        res = {}
        for t, p in have.items():
            ok, why = shots.verify(p, unit) if p.exists() else (False, 'not rendered')
            res[t] = (p if ok else None, why)
    else:
        with ThreadPoolExecutor(4) as ex:
            res = {t: (p, why) for t, p, why in ex.map(render, jobs)}
    bad = [(t, w) for t, (p, w) in res.items() if not p]
    print('rendered %d, failed %d' % (len(jobs) - len(bad), len(bad)), bad[:5])

    shutil.copyfile(cur, out / 'current_01.jpg')
    sharp = {t: sharpness(p) for t, (p, _) in res.items() if p}

    def vec(f):
        v = np.asarray(Image.open(f).convert('L').resize((96, 72)), dtype=float).ravel()
        v -= v.mean()
        return v / (np.linalg.norm(v) + 1e-6)
    # The frame that IS the site's current hero, if one was rendered (same pixels, correlation ~1).
    # Identical pixels score ~1; a hero first captured with another deinterlace window scores ~0.98 at
    # its own moment. Tag the one best frame when it is that close.
    cv = vec(out / 'current_01.jpg')
    cs = {t: float(cv @ vec(p)) for t, (p, _) in res.items() if p}
    best = max(cs, key=cs.get) if cs else None
    same = {best} if best is not None and cs[best] >= 0.97 else set()
    same_label = 'On the site now' if best is not None and cs[best] > 0.995 else "The site's hero (this moment)"

    def card(t):
        p, _ = res[t]
        if not p:
            return ''
        badge = '<b class="now-tag">%s</b>' % same_label if t in same else ''
        return ('<label class="c"><input type="radio" name="hero" value="%s" data-file="%s"><a href="%s/%s" target="_blank">'
                '<img src="%s/%s" loading="lazy" alt=""></a><span>%s · sharp %d %s</span></label>'
                % (hms(t), p.name, out.name, p.name, out.name, p.name, hms(t), sharp[t], badge))
    sections = ''
    for title, note, ref, times in groups:
        cap = html.escape(ref_caption) if ref == ref_name else 'Their hero now (another copy, for comparison)'
        refhtml = ('<figure class="ref"><img src="%s/%s" alt=""><figcaption>%s</figcaption></figure>'
                   % (out.name, ref, cap)) if ref else ''
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

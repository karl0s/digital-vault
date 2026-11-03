#!/usr/bin/env python3
"""The same moment from several copies of one show, side by side, so the owner can see which looks best.

    python3 compare_copies.py --ref ccd7ed3c2fa4 \
        --copy 9591d1560110=reports/twins/<slug>/match.json --copy 0ea36fe37b0e=reports/twins/<slug>/match.json

--ref is the record whose site hero (slot 1) is the moment; each --copy is another record of the show
with the twin_match.py report made FROM that copy's source (where --ref's stills were found in it).
Each copy's frame is rendered as picks are (shots.grab, shots.build_vf_seek, its own planned shape,
bars kept), refined to the frame that best matches the ref, then shown three ways: as the site would
store it, the picture alone at one common size, and a 2x crop of the same region. Writes only to
reports/compare-<ref>/ and reports/compare-<ref>.html.
"""
import argparse, html, json, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image

VS = Path.home() / 'VaultShots'
REPO = Path.home() / 'Desktop/Projects/the-vault'
sys.path.insert(0, str(VS))
import shots  # noqa: E402
import hero_options as ho  # noqa: E402


def picture_box(im):
    """The picture inside any pillarbox or letterbox: columns and rows whose AVERAGE is brighter than the
    bars. Averages, not maxima, so a channel logo sitting in a bar (Palladia's) doesn't count as picture."""
    a = np.asarray(im.convert('L'), dtype=float)
    cols = np.where(a.mean(axis=0) > 20)[0]
    rows = np.where(a.mean(axis=1) > 20)[0]
    return (int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1) if len(cols) and len(rows) else (0, 0, im.width, im.height)


def vec(im, box=None):
    im = im.crop(box) if box else im
    v = np.asarray(im.convert('L').resize((96, 72)), dtype=float).ravel()
    v -= v.mean()
    return v / (np.linalg.norm(v) + 1e-6)


def sharp(im):
    a = np.asarray(im.convert('L'), dtype=float)
    lap = a[:-2, 1:-1] + a[2:, 1:-1] + a[1:-1, :-2] + a[1:-1, 2:] - 4 * a[1:-1, 1:-1]
    return float(lap.var())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ref', required=True)
    ap.add_argument('--copy', action='append', default=[])
    ap.add_argument('--window', type=float, default=1.2, help='seconds either side of the twin match to search for the best frame')
    ap.add_argument('--step', type=float, default=0.04)
    ap.add_argument('--zoom', default='0.30,0.05,0.80,0.70', help='region to enlarge, as fractions of the picture: x0,y0,x1,y1')
    a = ap.parse_args()
    shows = {s['ShowID']: s for s in json.load(open(REPO / 'public/shows.json', encoding='utf-8'))}
    out = VS / 'reports' / ('compare-' + a.ref)
    shots.assert_readonly_target(out / 'x.jpg')
    out.mkdir(parents=True, exist_ok=True)
    ref = shows[a.ref]
    ref_img = Image.open(REPO / 'public/images' / ('%s_01.jpg' % ref['ChecksumSHA1'])).convert('RGB')
    ref_img.save(out / 'ref.jpg', quality=95)
    rv = vec(ref_img, picture_box(ref_img))
    entries = [dict(id=a.ref, rec=ref, img=ref_img, file='ref.jpg', note='On the site now (slot 1)')]
    for spec in a.copy:
        cid, match = spec.split('=', 1)
        m = next(x for x in json.load(open(VS / match)) if x['twin'] == a.ref and x['slot'] == 1)
        rec = shows[cid]
        unit, _ = ho.unit_for(cid, rec)
        vf = shots.build_vf_seek(unit, shots.DEFAULT_DEINT)
        n = int(round(a.window / a.step))
        ts = [round(m['t'] + i * a.step, 3) for i in range(-n, n + 1)]
        def r(t):
            p = out / ('%s_%.3f.jpg' % (cid, t))
            if not p.exists():
                shots.grab(unit['src'], t, vf, p)
            im = Image.open(p).convert('RGB')
            return float(rv @ vec(im, picture_box(im))), t, p
        with ThreadPoolExecutor(4) as ex:
            score, t, p = max(ex.map(r, ts))
        best = out / ('%s_best.jpg' % cid)
        Image.open(p).save(best, quality=95)
        entries.append(dict(id=cid, rec=rec, img=Image.open(best).convert('RGB'), file=best.name,
                            note=('Same moment at %s (match %.3f)' % (ho.hms(t), score)) if score >= 0.8 else
                                 ('Nearest frame found, %s, a moment off (match %.3f): seeking in this file is not frame-exact' % (ho.hms(t), score))))
    zx0, zy0, zx1, zy1 = (float(x) for x in a.zoom.split(','))
    common = (960, 720)
    rows = []
    for e in entries:
        box = picture_box(e['img'])
        pic = e['img'].crop(box)
        eq = pic.resize(common, Image.LANCZOS)
        eq.save(out / ('%s_equal.jpg' % e['id']), quality=95)
        w, h = pic.size
        z = pic.crop((int(w * zx0), int(h * zy0), int(w * zx1), int(h * zy1)))
        z = z.resize((int(common[0] * (zx1 - zx0)) * 2, int(common[1] * (zy1 - zy0)) * 2), Image.LANCZOS)
        z.save(out / ('%s_zoom.jpg' % e['id']), quality=95)
        r = e['rec']
        rows.append(dict(e, box=box, pic=pic.size, stored=e['img'].size, sharp_equal=sharp(eq),
                         spec='%s×%s %s · %s · %s' % (r.get('Width'), r.get('Height'), r.get('AspectRatio') or '', r.get('TotalSizeHuman') or '',
                                                     (r.get('VideoCodec') or r.get('Container') or ''))))
    best_sharp = max(x['sharp_equal'] for x in rows)
    cards = ''.join('''<section class="card"><h2>{name}</h2><p class="meta">{note}<br>{spec}<br>Stored still {sw}×{sh}; picture {pw}×{ph}{bars} · detail at equal size: <b>{sh_eq:.0f}</b>{top}</p>
<figure><figcaption>As the site would store it</figcaption><a href="{d}/{file}" target="_blank"><img src="{d}/{file}" alt=""></a></figure>
<figure><figcaption>Picture only, all at 960×720</figcaption><a href="{d}/{id}_equal.jpg" target="_blank"><img src="{d}/{id}_equal.jpg" alt=""></a></figure>
<figure><figcaption>Zoomed: the same region, 2×</figcaption><a href="{d}/{id}_zoom.jpg" target="_blank"><img src="{d}/{id}_zoom.jpg" alt=""></a></figure></section>'''.format(
        name=html.escape('%s — %s' % (x['id'], x['rec'].get('FolderName') or '')), note=html.escape(x['note']), spec=html.escape(x['spec']),
        sw=x['stored'][0], sh=x['stored'][1], pw=x['pic'][0], ph=x['pic'][1],
        bars=' (bars at the sides kept)' if x['pic'][0] < x['stored'][0] - 8 else '',
        sh_eq=x['sharp_equal'], top=' (most detail)' if x['sharp_equal'] == best_sharp else '', d=out.name, file=x['file'], id=x['id']) for x in rows)
    doc = PAGE.replace('{TITLE}', html.escape('%s, %s, %s' % (ref['Artist'], ref.get('EventOrFestival') or ref.get('VenueName') or '', ref.get('ShowDate') or ''))) \
              .replace('{CARDS}', cards)
    (VS / 'reports' / ('compare-%s.html' % a.ref)).write_text(doc, encoding='utf-8')
    for x in rows:
        print('%s  %s  stored %s picture %s  detail %.0f' % (x['id'], x['note'], x['stored'], x['pic'], x['sharp_equal']))
    print(VS / 'reports' / ('compare-%s.html' % a.ref))


PAGE = r'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Copy Comparison</title><style>
:root{--bg:#f6f6f4;--panel:#fff;--ink:#16161a;--ink-2:#55555f;--ink-3:#8a8a94;--line:#e6e6e2;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0f0f11;--panel:#17171a;--ink:#ededf0;--ink-2:#a9a9b3;--ink-3:#73737d;--line:#26262b;color-scheme:dark}}
*{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif}
.wrap{max-width:1500px;margin:0 auto;padding:22px 16px 60px} h1{font-size:21px;margin:0} .lede{color:var(--ink-2);margin:4px 0 14px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px;margin-top:14px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.card h2,.card .meta{grid-column:1/-1;margin:0} .card h2{font-size:15px} .meta{color:var(--ink-2);font-size:13px}
figure{margin:0} figure img{width:100%;display:block;border-radius:6px} figcaption{font-size:12px;color:var(--ink-3);margin-bottom:4px}
@media (max-width:900px){.card{grid-template-columns:1fr}}
</style></head><body><div class="wrap">
<h1>Same moment, every copy: {TITLE}</h1>
<p class="lede">Each copy's frame at the moment of the site's hero, rendered the way the site's stills are. The middle column puts every picture at the same size so they compare fairly; the right column enlarges the same region 2×. "Detail" is a sharpness measure at equal size: higher is crisper (it can also rise with noise, so trust your eyes).</p>
{CARDS}
</div></body></html>'''

if __name__ == '__main__':
    main()

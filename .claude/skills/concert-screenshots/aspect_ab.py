#!/usr/bin/env python3
"""Show every SUSPECT-ANAMORPHIC source at both shapes, on one page. READ-ONLY.

    python3 aspect_ab.py            # the staged artist (data/state.json), after capture

WHY: six Stereophonics sources (UK TV, 2002-2004: BBC Two/Three, Channel 4, ITV, BBC
Glastonbury) were flagged 4:3 by the disc (720x576, SAR 16:15), had NO letterbox bars,
and were really full-height anamorphic 16:9 squeezed into a 4:3 frame by an off-air
recorder. Every gate passed - the flags agree with each other, there are no bars for
cropdetect or a row profile to find - and the stills shipped squashed until the owner
caught them on review. A face compared across a hero montage did not catch it either.

WHAT IT FLAGS: every unit whose capture target is 4:3, whose frame has no bars (row
profile, brightest third), and whose ShowDate is 2000 or later or empty. That is a
review list, not a verdict - most of it is genuinely 4:3 (the same artist's WDR, SF2
and RTP/SIC broadcasts were). It exists so the OWNER looks at each one once, at both
shapes, before promotion instead of after.

HOW: for each flagged unit, take the slot-A pick if picks exist (else the frame with
the highest `conc` in scores.json), and render it at its captured 4:3 shape and
stretched to 16:9 - stretching the 768x576 capture to 1024x576 is exactly what a 16:9
capture of the same frame would be, so nothing is decoded. Judge a FRONT-ON circle
(a mic's grille ring seen head-on, a kick-drum head square to camera, a round
spotlight lens) - not a face, and not a foreshortened drum.

Sources the owner has already judged are listed in data/aspect_confirmed.json and skipped.

Output: reports/<artist>_aspect_ab.html  (opened by the caller)
"""
import json, re, sys, html, urllib.parse
from pathlib import Path
import numpy as np
from PIL import Image

VS = Path.home() / "VaultShots"
REPO = Path.home() / "Desktop/Projects/the-vault"
st = json.load(open(VS / "data/state.json"))
artist = st.get("artist", "artist")
slug = re.sub(r"[^a-z0-9]+", "_", artist.lower()).strip("_")
shows = {s["ShowID"]: s for s in json.load(open(REPO / "public/shows.json"))}
picks = json.load(open(VS / "data/picks.json")) if (VS / "data/picks.json").exists() else {}
scores = json.load(open(VS / "data/scores.json")) if (VS / "data/scores.json").exists() else {}
out_dir = VS / "reports" / (slug + "_aspect_ab")
out_dir.mkdir(parents=True, exist_ok=True)


def has_bars(frames):
    rows = []
    for f in frames[::4]:
        rows.append(np.asarray(Image.open(f).convert("L"), dtype=np.float32).mean(axis=1))
    if not rows:
        return False
    rows.sort(key=lambda r: -r.mean())
    m = np.mean(rows[:max(10, len(rows) // 3)], axis=0)
    dark = m < 22
    top = next((i for i in range(len(m)) if not dark[i]), len(m))
    bot = next((i for i in range(len(m) - 1, -1, -1) if not dark[i]), -1)
    return top >= 8 or (len(m) - 1 - bot) >= 8


# Sources the owner has already judged on this page. Without this the same genuinely-4:3
# sources come back every run, and a page that re-asks answered questions stops being read.
confirmed_f = VS / "data/aspect_confirmed.json"
confirmed = json.load(open(confirmed_f)) if confirmed_f.exists() else {}

flagged = []
for s in st["shows"]:
    if abs(s["target_w"] / s["target_h"] - 4 / 3) > 0.02:
        continue                                   # already 16:9 (or overridden)
    if s["ShowID"] in confirmed:
        continue                                   # owner already judged it
    date = (shows.get(s["ShowID"], {}).get("ShowDate") or "")
    if date and date[:4] < "2000":
        continue
    frames = sorted((VS / "work" / s["key"]).glob("*.jpg"))
    if not frames or has_bars(frames):
        continue
    ts = None
    for lab, t in picks.get(s["key"], []):
        if lab.startswith("A"):
            ts = t
    f = None
    if ts:
        m = list((VS / "work" / s["key"]).glob("*_t%s.jpg" % ts))
        f = m[0] if m else None
    if f is None:
        sc = (scores.get(s["key"]) or {}).get("keep") or []     # {"all": n, "keep": [...], ...}
        sc = sorted(sc, key=lambda r: -(r.get("conc") or 0))
        f = (VS / "work" / s["key"] / sc[0]["file"]) if sc else frames[len(frames) // 2]
    im = Image.open(f)
    a = out_dir / ("%s_43.jpg" % s["ShowID"]); b = out_dir / ("%s_169.jpg" % s["ShowID"])
    im.save(a, quality=90)
    im.resize((round(im.height * 16 / 9), im.height), Image.LANCZOS).save(b, quality=90)
    flagged.append((s, date, a, b))

rel = lambda p: urllib.parse.quote(str(p.relative_to(VS / "reports")), safe="/")
rows = "".join(
    "<section><h2>%s</h2><p>%s &middot; ShowID %s &middot; captured as 4:3</p>"
    "<div class=ab><figure><img src='%s'><figcaption>as captured (4:3)</figcaption></figure>"
    "<figure><img src='%s'><figcaption>if it is anamorphic 16:9</figcaption></figure></div></section>"
    % (html.escape(s["FolderName"]), html.escape(d or "undated"), s["ShowID"], rel(a), rel(b))
    for s, d, a, b in flagged)
page = VS / "reports" / (slug + "_aspect_ab.html")
page.write_text("""<!doctype html><meta charset=utf-8><title>%s - aspect A/B</title>
<style>body{background:#111;color:#ddd;font:15px/1.5 system-ui,sans-serif;margin:0;padding:20px 16px}
main{max-width:1500px;margin:auto}h1{font-size:20px}h2{font-size:15px;margin:22px 0 2px;color:#ffd24a}
p{margin:0 0 8px;color:#999}.ab{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start}
figure{margin:0}img{height:300px;display:block}figcaption{color:#aaa;font-size:13px}</style>
<main><h1>%s - which shape is right?</h1>
<p>Every source here is flagged 4:3 by its disc, has no letterbox bars, and is from 2000 or later -
the profile of an off-air recorder squeezing a 16:9 broadcast into a 4:3 frame. Most are genuinely 4:3.
Judge a front-on circle (a mic grille seen head-on, a kick-drum head square to camera), not a face.
Name the ones that are 16:9; they get a <code>dar</code> override and a recapture.</p>%s</main>"""
                % (html.escape(artist), html.escape(artist), rows or "<p>No suspect sources.</p>"),
                encoding="utf-8")
print("  %d suspect source(s) -> %s" % (len(flagged), page))
for s, d, _, _ in flagged:
    print("    %s  %-10s %s" % (s["ShowID"], d or "undated", s["FolderName"][:70]))

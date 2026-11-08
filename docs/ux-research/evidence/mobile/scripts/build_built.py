"""The mobile audit's fixes as built on the branch mobile-audit: before (live) / after (branch)."""
from pathlib import Path
import html

import sys
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / 'VaultShots/reports/mobile-audit-built.html'
S = sys.argv[2] if len(sys.argv) > 2 else 'mobile-audit/shots/'

ROWS = [
  ('R1', 'An artist from the A–Z list opens at the top', 'Tapping Pearl Jam landed on the bottom of its shows. Now the page jumps to the top. Also on desktop.',
   [('Today', 'M-azjump-before-iphone.jpg'), ('Branch', 'impl-artist-PJ-iphone.jpg')]),
  ('R2 · R4', 'Two columns, results right under the bar', 'Pearl Jam: 1 card a screen, 10.8 screens → 6 a screen, 2.9 screens. The big title, “Found 24” and Clear search are gone on phones; All artists stays.',
   [('Today', 'M-tiles-before-iphone.jpg'), ('Branch', 'impl-pearljam-iphone.jpg')]),
  ('R4', 'Results above the keyboard', '“brasil” with the keyboard up: no shows visible → 4. The row under the search steps aside while typing; the Search key closes the keyboard.',
   [('Today', 'M-keyboard-before-android.jpg'), ('Branch (keyboard drawn on)', 'impl-keyboard-android.jpg')]),
  ('R3', 'Initials beside other words', '“ratm swu” found nothing → the 2 SWU shows. Also “fnm bizarre 97”, “qotsa reading”, “30stm rar”. Also on desktop.',
   [('Today', 'M-initials-before-android.jpg'), ('Branch', 'impl-ratm-swu-android.jpg')]),
  ('R6', 'A letter index on the A–Z list', 'Tap or drag the letters at the right edge. All artists (and Back) return to the exact place you left the list.',
   [('Today', 'M-az-before-iphone.jpg'), ('Branch, after tapping P', 'impl-az-P-iphone.jpg')]),
  ('R7', 'A slim filter bar', 'Four filters on: the bar was 235px with chips, 1 show on screen → 121px, 6 shows. One row: Filters (4), count, list/cards, sort.',
   [('Today', 'M-bar-before-iphone.jpg'), ('Branch', 'impl-bar-iphone.jpg')]),
  ('R8', 'Filters in a sheet', 'Every filter in one sheet, 44px chips with live counts, “Show 34 shows” at the foot. Drag down, tap outside or × to close.',
   [('Today: More filters runs off the screen', 'M-sheet-before-iphone.jpg'), ('Branch', 'impl-sheet-iphone.jpg'), ('Branch: Add an event', 'impl-sheet-events-iphone.jpg')]),
  ('R10 · R13', 'A shorter masthead, and New one tap away', 'First screen: 1 show → 4. “● New · 64” beside Filters opens the 64 new shows.',
   [('Today', 'M-landing-before-iphone.jpg'), ('Branch', 'impl-landing-iphone.jpg'), ('Branch: after tapping New', 'impl-new-iphone.jpg')]),
  ('R10', 'No masthead with the phone sideways', '',
   [('Today', 'M-landscape-before-land.jpg'), ('Branch', 'impl-landing-land.jpg')]),
  ('R9', 'Copies compared on a phone', 'Each copy stacked; what differs lit in amber, what is shared under “Same”.',
   [('Today', 'impl-drawer-live-before-copies-iphone.jpg'), ('Branch', 'impl-drawer-final-copies-iphone.jpg')]),
  ('R11', 'The docked show header is one line', '150px → 56px while you read the setlist or info file.',
   [('Today', 'impl-drawer-live-before-docked-iphone.jpg'), ('Branch', 'impl-drawer-final-docked-iphone.jpg')]),
  ('R12', '44px touch targets', 'Close, the viewer’s Back / arrows / dots, Technical details, A–Z rows, the search field’s ×, every bar and sheet control. Share and Open full size keep their look with a bigger touch area.',
   [('Today: under 44px outlined', 'M-targets-before-iphone.jpg'), ('Branch: the viewer', 'impl-drawer-final-viewer-iphone.jpg')]),
  ('Desktop', 'Desktop looks the same', 'Pixel-identical to the live site on an artist page and on filtered results at 1440×900. What does change there: R1, R3, Back stepping through the site (R5), All artists returning to your place (R6), and the first four stills loading first (R14).',
   [('Live site', 'impl-desktop-artist-live.jpg'), ('Branch', 'impl-desktop-artist-branch.jpg')]),
]

cards = []
for tag, title, note, pics in ROWS:
    wide = tag == 'Desktop' or 'land' in pics[0][1]
    figs = ''.join(f'<figure><figcaption>{html.escape(c)}</figcaption><a href="{S}{f}" target="_blank"><img loading="lazy" src="{S}{f}" alt="{html.escape(c)}"></a></figure>' for c, f in pics)
    cards.append(f'<section class="rec{" wide" if wide else ""}"><h2><span>{tag}</span>{html.escape(title)}</h2>{f"<p>{html.escape(note)}</p>" if note else ""}<div class="pics">{figs}</div></section>')

page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mobile fixes built</title>
<style>
:root{{--bg:#141414;--card:#1c1c1c;--ink:#f2f2f2;--mute:#a3a3a3;--acc:#6ee7b7;--line:rgba(255,255,255,.08)}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,system-ui,sans-serif}}
main{{max-width:1240px;margin:0 auto;padding:28px 16px 80px}}
h1{{font-size:26px;margin:0 0 6px}}.lead{{color:var(--mute);margin:0 0 18px;max-width:820px}}
.box{{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:0 0 22px}}
.box b{{color:var(--ink)}}.box p{{margin:4px 0;color:var(--mute)}}code{{background:rgba(255,255,255,.08);padding:1px 6px;border-radius:5px;color:var(--ink)}}
a{{color:var(--acc)}}
.rec{{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin:0 0 16px}}
.rec h2{{font-size:17px;margin:0 0 4px;display:flex;gap:10px;align-items:baseline}}.rec h2 span{{font-size:12px;color:#111;background:var(--acc);border-radius:4px;padding:2px 6px;font-weight:700;letter-spacing:.04em}}
.rec p{{margin:0 0 12px;color:var(--mute);max-width:860px}}
.pics{{display:flex;gap:14px;flex-wrap:wrap}}figure{{margin:0;width:250px}}.wide figure{{width:min(560px,100%)}}
figcaption{{font-size:12px;color:var(--mute);margin:0 0 6px;text-transform:uppercase;letter-spacing:.08em}}
img{{width:100%;border-radius:10px;border:1px solid var(--line);display:block}}
</style></head><body><main>
<h1>Mobile fixes — before and after</h1>
<p class="lead">The fourteen fixes from the mobile audit, as built. Each “Today” picture is the site before (live, 2026-11-08), each “Branch” picture the new code, on the same emulated phones. Tap a picture to see it full size.</p>
<div class="box">
<p><b>Status:</b> picked B on all 14 by the owner, built on the branch <code>mobile-audit</code> and checked on emulated phones and desktop, then merged into main and pushed live on 2026-11-08. Live site: <a href="https://karl0s.github.io/digital-vault/">karl0s.github.io/digital-vault</a>.</p>
<p><b>The research behind it:</b> the audit report (<code>mobile-audit.html</code>), <code>docs/ux-research/06-mobile-audit.md</code> (findings, scores, what was built) and <code>07-mobile-case-study.md</code> (the brief, the plan, the decisions and the timeline).</p>
</div>
{''.join(cards)}
</main></body></html>'''
OUT.write_text(page)
print(OUT)

# bp.py TAG TITLE STATEFILE NOTES.json  -> ~/VaultShots/reports/TAG.html (+ TAG_ba/ image copies)
import json, sys, shutil, html, urllib.parse
from pathlib import Path
tag,title,statef,notesf=sys.argv[1:5]
H=Path.home()/"VaultShots"; REPO=Path("/Users/ko/Desktop/Projects/the-vault")
notes=json.load(open(notesf)); intro=notes.pop("_intro","")
st=json.load(open(statef))["shows"]
d={s["ShowID"]:s for s in json.load(open(REPO/"public/shows.json"))}
man=json.load(open(REPO/"public/image-manifest.json"))
R=H/"reports"/f"{tag}_ba"; shutil.rmtree(R,ignore_errors=True); (R/"b").mkdir(parents=True); (R/"a").mkdir()
import os; picks=list((H/os.environ.get("PICKS_DIR","picks")).glob("*.jpg"))
secs=[]; order={"A":0,"B":1,"C":2,"spare":3}
for e in sorted(st,key=lambda e:(d[e["ShowID"]]["Artist"].lower(),d[e["ShowID"]].get("ShowDate") or "9")):
    sid=e["ShowID"]; s=d[sid]; ck=s["ChecksumSHA1"]
    bs=[]
    for i in man.get(ck,[]):
        src=REPO/f"public/images/{ck}_{i:02d}.jpg"
        if src.exists(): shutil.copy(src,R/"b"/src.name); bs.append(src.name)
    mine=sorted([p for p in picks if p.stem.rsplit("__",1)[0].endswith("_"+sid[:6])],key=lambda p:order.get(p.stem.rsplit("__",1)[1],9))
    as_=[]
    for p in mine: shutil.copy(p,R/"a"/p.name); as_.append(p.name)
    bh="".join(f'<img loading=lazy src="{tag}_ba/b/{urllib.parse.quote(n)}">' for n in bs) or '<div class=none>No images on the site yet</div>'
    ah="".join(f'<img loading=lazy src="{tag}_ba/a/{urllib.parse.quote(n)}">' for n in as_) or '<div class=none>MISSING</div>'
    meta=" · ".join(x for x in [s.get("ShowDate") or "undated", s.get("EventOrFestival") or s.get("VenueName") or "", s.get("City") or ""] if x)
    nt=notes.get(sid,"")
    secs.append(f'''<section{' class=flag' if nt else ''}><h3>{html.escape(s["Artist"])} <span>{html.escape(meta)}</span></h3>
<div class=f>{html.escape(s.get("FolderName") or "")} · {e["target_w"]}×{e["target_h"]} · {sid}</div>
{f'<p class=nt>{nt}</p>' if nt else ''}
<div class=lab>Before (site now)</div><div class=four>{bh}</div>
<div class=lab new>After — hero first</div><div class=four>{ah}</div></section>''')
page=f'''<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>{html.escape(title)}</title><style>
:root{{--bg:#0e1014;--fg:#e8ecf2;--mu:#98a2b3;--card:#161a21;--line:#262c36;--ok:#3ddc97;--warn:#f5b84b}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 -apple-system,system-ui,sans-serif}}
main{{max-width:1300px;margin:0 auto;padding:24px 16px 80px}}h1{{font-size:24px;margin:0 0 8px}}
.sum{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 18px;margin:0 0 22px}}
section{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;margin:0 0 14px}}section.flag{{border-left:3px solid var(--warn)}}
h3{{margin:0;font-size:16px}}h3 span{{font-weight:400;color:var(--mu);font-size:14px;margin-left:6px}}.f{{font-size:11.5px;color:var(--mu);opacity:.8;margin:2px 0 8px}}
.nt{{margin:0 0 10px;font-size:13.5px;color:#f3dcae}}.lab{{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--mu);margin:6px 0 4px}}.lab.new{{color:var(--ok)}}
.four{{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}}.four img{{width:100%;display:block;border-radius:4px}}.none{{color:var(--mu);font-size:13px;padding:8px}}
@media(max-width:700px){{.four{{grid-template-columns:1fr 1fr}}}}</style></head><body><main>
<h1>{html.escape(title)}</h1><div class=sum>{intro}</div>{"".join(secs)}</main></body></html>'''
out=H/"reports"/f"{tag}.html"; out.write_text(page,encoding="utf-8"); print(out, len(secs),"shows")

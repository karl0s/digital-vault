"""Render data/va_tracker.json to reports/va_checklist.html."""
import json, html
from pathlib import Path
H=Path.home()/"VaultShots"; T=json.load(open(H/"data/va_tracker.json"))
G={"A":"Recordings filed as Various Artists today","B":"Multi-artist recordings filed under one band today","C":"Two-act discs"}
ST={"todo":"To do","identifying":"Identifying acts","proposed":"Breakdown ready — your call","capturing":"Capturing","review":"Picks to review","done":"Done"}
def secs(t):
    h,m,s=[int(x) for x in t.split(":")]; return h*3600+m*60+s
def dur(a,b):
    d=secs(b)-secs(a); return "%d:%02d"%(d//60,d%60)
e=html.escape
cards={}
for m in T["masters"]:
    acts=m.get("acts") or []
    if acts:
        tr="".join(f'''<tr><td><b>{e(a["artist"])}</b></td><td class=mono>{a["start"]}</td><td class=mono>{a["end"]}</td><td class=mono>{dur(a["start"],a["end"])}</td><td class=c>{a["songs"] if a["songs"] not in (None,"") else "?"}</td>
<td class=sl>{e(a.get("setlist") or "")}</td><td class=sm>{e(a.get("source") or "")}</td><td class=sm>{e(a.get("existing") or "—")}</td><td class=dec>{e(a.get("decision") or "")}</td></tr>''' for a in acts)
        total=sum(secs(a["end"])-secs(a["start"]) for a in acts)
        tbl=f'''<div class=wrap><table><tr><th>Act</th><th>Start</th><th>End</th><th>Length</th><th>Songs</th><th>Setlist</th><th>How we know</th><th>Record already?</th><th>Your decision</th></tr>{tr}</table></div>
<div class=sm style="margin-top:6px">{len(acts)} acts · {total//60} min accounted for</div>'''
    else:
        tbl=f'<div class=pend>Act breakdown not done yet. What we know: {e(m.get("known",""))}</div>'
    kids=", ".join(e(k) for k in m.get("children_existing",[]))
    cards.setdefault(m["group"],[]).append(f'''<section class="{m["status"]}"><div class=hd><span class=id>{m["id"]}</span><h3>{e(m["title"])}</h3><span class="st {m["status"]}">{ST[m["status"]]}</span></div>
<div class=sm>{e(" · ".join(m.get("folders",[])))}{(" · ~"+str(m["mins"])+" min") if m.get("mins") else ""} · master record today: {", ".join(m.get("records",[])) or "none"}{(" · linked records already: "+kids) if kids else ""}</div>
{('<div class=nt>'+e(m["notes"])+'</div>') if m.get("notes") else ''}{tbl}</section>''')
done=sum(m["status"]=="done" for m in T["masters"]); ready=sum(bool(m.get("acts")) for m in T["masters"])
body="".join(f'<h2>{G[g]} <span>({len(c)})</span></h2>{"".join(c)}' for g,c in cards.items())
page=f'''<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Various Artists Checklist</title><style>
:root{{--bg:#0e1014;--fg:#e8ecf2;--mu:#98a2b3;--card:#161a21;--line:#262c36;--ok:#3ddc97;--warn:#f5b84b;--blue:#8fb3ff}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 -apple-system,system-ui,sans-serif}}main{{max-width:1400px;margin:0 auto;padding:24px 16px 80px}}
h1{{font-size:24px;margin:0 0 6px}}h2{{font-size:16px;margin:30px 0 10px}}h2 span{{color:var(--mu);font-weight:400}}h3{{margin:0;font-size:16px;flex:1}}
.sum{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 16px}}
section{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:0 0 12px}}section.proposed{{border-left:3px solid var(--warn)}}section.done{{opacity:.65;border-left:3px solid var(--ok)}}
.hd{{display:flex;gap:10px;align-items:center;margin-bottom:4px}}.id{{color:var(--mu);font-family:ui-monospace,Menlo,monospace}}
.wrap{{overflow-x:auto;margin-top:8px}}table{{border-collapse:collapse;width:100%;min-width:1000px}}td,th{{padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top;text-align:left}}th{{color:var(--mu);font-weight:600;font-size:11.5px;text-transform:uppercase;letter-spacing:.05em}}
.mono{{font-family:ui-monospace,Menlo,monospace;font-size:12.5px;white-space:nowrap}}.c{{text-align:center}}.sl{{font-size:12.5px;max-width:340px}}.sm{{font-size:12px;color:var(--mu)}}.dec{{color:var(--ok);font-size:12.5px}}
.nt{{font-size:12.5px;color:#f3dcae;margin-top:3px}}.pend{{color:var(--mu);font-size:13px;margin-top:6px;font-style:italic}}
.st{{font-size:11.5px;padding:2px 8px;border-radius:99px;border:1px solid var(--line);white-space:nowrap}}.st.done{{color:var(--ok);border-color:var(--ok)}}.st.proposed,.st.review{{color:var(--warn);border-color:var(--warn)}}.st.identifying,.st.capturing{{color:var(--blue);border-color:var(--blue)}}
</style></head><body><main><h1>Various Artists — master &amp; linked records checklist</h1>
<div class=sum><b>{ready} of {len(T["masters"])} broken down · {done} done.</b> For each master: every act, where it starts and ends on the master's timeline, how long it runs and how many songs it plays. You pick which acts get their own linked record; each links back to the master.</div>{body}</main></body></html>'''
out=H/"reports/va_checklist.html"; out.write_text(page); print(out)

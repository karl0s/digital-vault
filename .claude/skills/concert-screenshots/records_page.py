#!/usr/bin/env python3
"""The owner's review page for a batch of new records (downloads intake, SKILL.md 13b).

    python3 records_page.py spec.json            # writes reports/<slug>-records.html and checks it
    python3 records_page.py spec.json --open     # ... and opens it in Chrome
    python3 records_page.py --example            # prints a spec to start from

One page, every open question as a numbered row (A/B/C buttons, one marked "suggested", optional
images), the drafted records below, the evidence last. Picks save in the browser (localStorage);
"Copy for Claude Code" copies one line - "<export>: 1B 2A 3?" - for the owner to paste back.

spec.json (paths relative to ~/VaultShots; image paths relative to reports/, as the page sees them):
  slug       file name and storage key, e.g. "downloads-2026-11-06"
  title      the page's heading
  export     the first words of the pasted answer line, e.g. "NEW RECORDS REVIEW F (downloads 2026-11-06)"
  lead       a paragraph of HTML (links and <b> allowed) - what the batch is, what to do
  picks      optional: the picks page beside it in reports/
  records    the drafted records (a JSON list, data/new_records_*.json)
  fields     optional: which record fields to show (default below)
  questions  [{"id": "1", "t": title, "sub": the evidence in a sentence,
               "opts": [["A", "text", false], ["B", "text", true]], "imgs": [["src", "caption"]], "h": 150}]
  evidence   {"imgs": [["caption", "src"]], "sources": [["name", "url"]]}

Refuses (writes nothing) on: duplicate question ids, a question with fewer than two options or more
than one suggestion, a missing records file, an image that does not exist, U+FFFD anywhere.
"""
import html, json, subprocess, sys
from pathlib import Path

VS = Path.home() / "VaultShots"; REPORTS = VS / "reports"; e = html.escape
FIELDS = ["ShowID", "Artist", "ShowDate", "DatePrecision", "EventOrFestival", "Title", "VenueName", "City", "Country", "RecordingType",
          "ContentType", "Setlist", "Broadcaster", "FolderName", "ChecksumSHA1", "Width", "Height", "AspectRatio", "DurationSec", "ScanType",
          "VideoKbps", "AudioTracks", "TotalSizeHuman", "Hidden", "DuplicateOf", "NFT", "AddedOn", "PrivateNotes"]
EXAMPLE = {
    "slug": "downloads-2026-11-06", "title": "New records review — two downloads",
    "export": "NEW RECORDS REVIEW F (downloads 2026-11-06)",
    "lead": "Your downloads, drafted as records (below). Nothing is written yet. Answer each row, look at the stills on the "
            "<a href=\"downloads_2026_11_06_picks.html\">picks page</a>, then press <b>Copy for Claude Code</b> and paste it back.",
    "picks": "downloads_2026_11_06_picks.html", "records": "data/new_records_2026_11_06.json",
    "questions": [{"id": "1", "t": "Artist — show: setlist", "sub": "the evidence, in a sentence",
                   "opts": [["A", "Leave blank", False], ["B", "Copy the 12 songs from <ShowID>", True]]},
                  {"id": "2", "t": "Shape: <file>", "sub": "Flagged 4:3 with no bars on a post-2000 broadcast. Your call",
                   "imgs": [["downloads_2026_11_06_aspect_ab/<ShowID>_43.jpg", "A · 4:3"], ["downloads_2026_11_06_aspect_ab/<ShowID>_169.jpg", "B · 16:9"]],
                   "opts": [["A", "4:3 (as captured)", False], ["B", "16:9", False]]}],
    "evidence": {"imgs": [["What the image shows.", "downloads_2026_11_06/key_frames.jpg"]], "sources": [["setlist.fm", "https://www.setlist.fm/"]]},
}
CSS = """:root{color-scheme:dark;--line:rgba(255,255,255,.08)}*{box-sizing:border-box}body{margin:0;background:#141414;color:#fff;font:14px/1.5 system-ui,sans-serif}button{font:inherit;color:inherit;cursor:pointer}
header{position:sticky;top:0;z-index:5;background:rgba(20,20,20,.97);border-bottom:1px solid var(--line)}.bar{max-width:1200px;margin:0 auto;padding:12px 24px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
h1{font-size:18px;margin:0}.sp{flex:1}.prog{color:#d1d5db;font-size:13px}.copy{border:0;border-radius:999px;font-weight:600;padding:8px 16px;font-size:13px;background:#fff;color:#111}
main{max-width:1200px;margin:0 auto;padding:8px 24px 80px}.lead{color:#d1d5db;max-width:900px}code{font:12px ui-monospace,Menlo,monospace;color:#fde68a}.dim{color:#9ca3af}a{color:#c4b5fd}
h2{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#9ca3af;margin:30px 0 6px}
.row{display:flex;gap:16px;padding:14px 8px;border-bottom:1px solid var(--line);align-items:flex-start}.row.done{background:rgba(167,139,250,.06)}.n{color:#9ca3af;width:28px;flex:none}.info{flex:1;min-width:0}.t{font-weight:600}.sub{color:#9ca3af;font-size:13px}
.ch{width:440px;flex:none;display:flex;flex-direction:column;gap:6px}@media(max-width:800px){.row{flex-wrap:wrap}.ch{width:100%}main,.bar{padding-left:16px;padding-right:16px}}
.opt{text-align:left;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);border-radius:8px;padding:7px 10px;font-size:13px;display:flex;gap:8px;align-items:flex-start}.opt em{font-style:normal;font-size:11px;color:#6ee7b7;margin-left:auto;white-space:nowrap}
.opt .k{width:20px;height:20px;flex:none;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700;background:rgba(255,255,255,.1)}.opt.on{border-color:#a78bfa;background:rgba(167,139,250,.14)}.opt.on .k{background:#a78bfa;color:#111}
.imgs{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}figure{margin:0}figure img{max-width:100%;border-radius:4px;display:block}
details{border-bottom:1px solid var(--line);padding:10px 4px}summary{cursor:pointer}table{border-collapse:collapse;margin:10px 0 4px;width:100%}th{text-align:left;color:#9ca3af;font-weight:500;width:150px;padding:4px 10px 4px 0;vertical-align:top;font-size:13px}td{padding:4px 0;font-size:13px;border-bottom:1px solid var(--line);word-break:break-word}
.ev img{max-width:100%;height:auto;border-radius:6px;margin:6px 0 14px}.ev p{color:#d1d5db;max-width:900px}"""
JS = """const KEY=%s,EXPORT=%s;let p={};try{p=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
const N=document.querySelectorAll('.row').length;
function paint(){document.querySelectorAll('.row').forEach(r=>{const q=r.dataset.q;r.classList.toggle('done',!!p[q]);r.querySelectorAll('.opt').forEach(o=>o.classList.toggle('on',p[q]===o.dataset.v))});
document.getElementById('prog').textContent=Object.keys(p).length+' of '+N+' answered'}
document.querySelectorAll('.opt').forEach(o=>o.addEventListener('click',()=>{const q=o.closest('.row').dataset.q;p[q]=p[q]===o.dataset.v?undefined:o.dataset.v;if(!p[q])delete p[q];try{localStorage.setItem(KEY,JSON.stringify(p))}catch(e){}paint()}));
document.getElementById('copy').addEventListener('click',async()=>{const qs=[...document.querySelectorAll('.row')].map(r=>r.dataset.q);
const t=EXPORT+': '+qs.map(q=>q+(p[q]||'?')).join(' ');try{await navigator.clipboard.writeText(t);document.getElementById('copy').textContent='Copied'}catch(e){prompt('Copy this',t)}});
paint();"""


def fail(msg):
    sys.exit("REFUSING: " + msg)


def build(spec):
    for k in ("slug", "title", "export", "lead", "records", "questions"):
        if not spec.get(k): fail("spec has no %r" % k)
    recs_path = VS / spec["records"]
    if not recs_path.is_file(): fail("no records file %s" % recs_path)
    recs = json.loads(recs_path.read_text(encoding="utf-8"))
    qs = spec["questions"]; ids = [str(q["id"]) for q in qs]
    if len(ids) != len(set(ids)): fail("duplicate question ids %s" % sorted({i for i in ids if ids.count(i) > 1}))
    srcs = []
    rows = []
    for q in qs:
        opts = q.get("opts") or []
        if len(opts) < 2: fail("question %s has fewer than two options" % q["id"])
        if sum(bool(o[2]) for o in opts if len(o) > 2) > 1: fail("question %s suggests more than one option" % q["id"])
        if len({o[0] for o in opts}) != len(opts): fail("question %s repeats an option letter" % q["id"])
        b = "".join('<button class="opt" data-v="%s"><span class="k">%s</span><span>%s</span>%s</button>' % (
            e(o[0]), e(o[0]), e(o[1]), "<em>suggested</em>" if len(o) > 2 and o[2] else "") for o in opts)
        imgs = q.get("imgs") or []; srcs += [s for s, _ in imgs]
        im = "".join('<figure><img style="height:%dpx" src="%s" alt=""><figcaption class="dim">%s</figcaption></figure>' % (
            q.get("h", 150), e(s), e(c)) for s, c in imgs)
        rows.append('<div class="row" data-q="%s"><div class="n">%s</div><div class="info"><div class="t">%s</div><div class="sub">%s</div>%s</div>'
                    '<div class="ch">%s</div></div>' % (e(str(q["id"])), e(str(q["id"])), e(q["t"]), e(q.get("sub", "")),
                                                       '<div class="imgs">%s</div>' % im if im else "", b))
    fields = spec.get("fields") or FIELDS
    det = "".join('<details><summary><b>%d</b> %s <span class="dim">· %s · %s · %s</span></summary><table>%s</table></details>' % (
        i, e(r.get("Artist", "")), e(r.get("ShowDate") or "undated"), e(r.get("EventOrFestival") or r.get("Title") or ""),
        e(r.get("FolderName", "")),
        "".join("<tr><th>%s</th><td>%s</td></tr>" % (k, e(str(r[k])).replace("\n", "<br>")) for k in fields if r.get(k, "") != ""))
        for i, r in enumerate(recs, 1))
    ev = spec.get("evidence") or {}; srcs += [s for _, s in ev.get("imgs", [])]
    evh = "".join('<p>%s</p><img src="%s" alt="">' % (e(t), e(s)) for t, s in ev.get("imgs", []))
    if ev.get("sources"):
        evh += "<p>Sources: %s</p>" % " · ".join('<a href="%s">%s</a>' % (e(u), e(n)) for n, u in ev["sources"])
    missing = [s for s in srcs if not (REPORTS / s).resolve().is_file()]
    if spec.get("picks") and not (REPORTS / spec["picks"]).is_file(): missing.append(spec["picks"])
    if missing: fail("missing under reports/: %s" % ", ".join(missing))
    page = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
            '<title>%s</title><style>%s</style></head><body><header><div class="bar"><h1>%s</h1><span class="prog" id="prog"></span>'
            '<span class="sp"></span><button class="copy" id="copy">Copy for Claude Code</button></div></header><main>'
            '<p class="lead">%s</p><h2>Open questions</h2>%s<h2>The records (as drafted, suggestions applied)</h2>%s%s</main>'
            '<script>%s</script></body></html>') % (
        e(spec["title"]), CSS, e(spec["title"]), spec["lead"], "".join(rows), det,
        '<h2>Evidence</h2><div class="ev">%s</div>' % evh if evh else "", JS % (json.dumps(spec["slug"]), json.dumps(spec["export"])))
    if "�" in page: fail("U+FFFD (mojibake) in the page - read the source text in its true encoding")
    out = REPORTS / ("%s-records.html" % spec["slug"])
    out.write_text(page, encoding="utf-8")
    return out, len(qs), len(recs)


def main():
    if "--example" in sys.argv:
        print(json.dumps(EXAMPLE, indent=1, ensure_ascii=False)); return
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1: sys.exit(__doc__)
    out, nq, nr = build(json.loads(Path(args[0]).read_text(encoding="utf-8")))
    chk = subprocess.run([sys.executable, str(VS / "check_report_links.py"), str(out)], capture_output=True, text=True)
    print(chk.stdout.strip().splitlines()[-1] if chk.stdout.strip() else chk.stderr.strip())
    if chk.returncode: sys.exit("link check failed - not opening")
    print("  %d questions, %d records -> %s" % (nq, nr, out))
    if "--open" in sys.argv: subprocess.run(["open", "-a", "Google Chrome", str(out)])


if __name__ == "__main__":
    main()

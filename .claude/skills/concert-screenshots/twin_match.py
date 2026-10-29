#!/usr/bin/env python3
"""Is this recording one the collection already holds? Find a record's site stills inside it.

    python3 twin_match.py --key <state key> --twins <ShowID> [<ShowID> ...]
    python3 twin_match.py --src <file> --twins <ShowID> [...]          # a file not planned yet

For each twin, each of its promoted stills (public/images/<checksum>_0N.jpg) is looked for in the
source: twice a second at 48x36 grey, best normalised correlation, then refined frame by frame at
96x72 over the 3 seconds around it, and that frame rendered at the source's display shape. A
4:3 picture pillarboxed in an HD frame is cropped to its picture first (cropdetect at three
points), because the twin's stills are 4:3. Output, never anywhere else:
~/VaultShots/reports/twins/<slug>/ - pairs.jpg (each still beside the frame found, with its
score) and match.json.

Scores: ~0.8+ is the same moment; 0.5-0.7 is usually the same shot a moment apart or a miss -
LOOK at pairs.jpg, never trust the number alone. Two copies of one broadcast need DIFFERENT
moments for their stills (SKILL.md "Two sources of ONE broadcast"): pick away from the times found.
READ-ONLY on the source.
"""
import argparse, json, re, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

VS = Path.home() / "VaultShots"; REPO = Path("/Users/ko/Desktop/Projects/the-vault")
ap = argparse.ArgumentParser()
g = ap.add_mutually_exclusive_group(required=True)
g.add_argument("--key", help="a unit key in data/state.json (after plan / plan_files)")
g.add_argument("--src", help="a media file")
ap.add_argument("--twins", nargs="+", required=True, help="ShowIDs whose stills to look for")
a = ap.parse_args()

def run(args): return subprocess.run(args, capture_output=True)

if a.key:
    u = next((s for s in json.loads((VS / "data/state.json").read_text())["shows"] if s["key"] == a.key), None)
    if not u: sys.exit("no unit %r in data/state.json" % a.key)
    src, inter, order, fps = u["src"], u["interlaced"], u.get("field_order") or "tt", eval(u.get("fps") or "25")
    W, H, TW, TH = u["w"], u["h"], u["target_w"], u["target_h"]; slug = a.key
else:
    src = a.src
    st = json.loads(run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_streams", "-of", "json", src]).stdout)["streams"][0]
    W, H, fo = st["width"], st["height"], (st.get("field_order") or "progressive")
    inter, order, fps = fo in ("tt", "bb", "tb", "bt"), fo, eval(st.get("avg_frame_rate") or "25")
    sn, sd = (int(x) for x in (st.get("sample_aspect_ratio") or "1:1").replace("0:1", "1:1").split(":")) if st.get("sample_aspect_ratio") not in (None, "0:1") else (1, 1)
    sar = sn / sd if sd else 1
    TW, TH = (W, H) if abs(sar - 1) < 0.01 else ((round(W * sar / 2) * 2, H) if sar > 1 else (W, round(H / sar / 2) * 2))
    slug = re.sub(r"[^A-Za-z0-9]+", "_", Path(src).stem)[:48]
out = VS / "reports" / "twins" / slug; out.mkdir(parents=True, exist_ok=True)
assert str(out.resolve()).startswith(str(VS.resolve()) + "/"), "refusing to write outside ~/VaultShots"
dei = "bwdif=mode=send_frame:parity=%s:deint=all," % ("tff" if order in ("tt", "tb") else "bff") if inter else ""

dur = float(json.loads(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", src]).stdout)["format"]["duration"])
crops = []
for p in (0.3, 0.5, 0.7):
    e = run(["ffmpeg", "-hide_banner", "-nostdin", "-ss", "%.1f" % (dur * p), "-i", src, "-map", "0:v:0", "-frames:v", "200",
             "-vf", "cropdetect=limit=24:round=2:reset=0", "-f", "null", "-"]).stderr.decode("utf-8", "replace")
    c = re.findall(r"crop=(\d+):(\d+):(\d+):(\d+)", e)
    if c: crops.append(tuple(map(int, c[-1])))
# A dark frame reads as bars on any axis, so take the LARGEST picture seen on each axis across
# the samples (bars are symmetric), and only bars over 24 px count (STP Bizarre's 720p rerun
# read 938x666 from one dark frame against its true 938x720).
cw = max((c[0] for c in crops), default=W); ch = max((c[1] for c in crops), default=H)
if cw >= W - 24: cw = W
if ch >= H - 24: ch = H
cw -= cw % 2; ch -= ch % 2; cx, cy = (W - cw) // 2, (H - ch) // 2
crop = "crop=%d:%d:%d:%d," % (cw, ch, cx, cy)

def frames(args, w, h):
    b = run(["ffmpeg", "-hide_banner", "-nostdin", "-v", "error", *args, "-f", "rawvideo", "-pix_fmt", "gray", "-"]).stdout
    n = len(b) // (w * h)
    return np.frombuffer(b[: n * w * h], np.uint8).reshape(n, w * h).astype(np.float32)

def norm(m):
    m = m - m.mean(axis=-1, keepdims=True); return m / (np.linalg.norm(m, axis=-1, keepdims=True) + 1e-6)

print("  %s: %dx%d %s, picture %dx%d+%d+%d, %.0f min" % (Path(src).name, W, H, "interlaced" if inter else "progressive", cw, ch, cx, cy, dur / 60))
RATE = 2   # twice a second: once a second at 32x24 missed shots a moment long (two of STP Bizarre's)
T = norm(frames(["-i", src, "-map", "0:v:0", "-vf", "%s%sfps=%d,scale=48:36:flags=area" % (dei, crop, RATE)], 48, 36))
shows = {s["ShowID"]: s for s in json.load(open(REPO / "public/shows.json"))}
mani = json.load(open(REPO / "public/image-manifest.json"))
res, tiles = [], []
for sid in a.twins:
    ck = shows[sid]["ChecksumSHA1"]
    for slot in mani.get(ck, []):
        still = REPO / "public/images" / ("%s_%02d.jpg" % (ck, slot))
        s1 = norm(frames(["-i", str(still), "-vf", "scale=48:36:flags=area"], 48, 36)[0])
        best = int(np.argmax(T @ s1)); coarse = float(T[best] @ s1)
        t0 = max(0.0, best / RATE - 1.5)
        s2 = norm(frames(["-i", str(still), "-vf", "scale=96:72:flags=area"], 96, 72)[0])
        F = frames(["-ss", "%.3f" % t0, "-t", "3", "-i", src, "-map", "0:v:0", "-vf", "%s%sscale=96:72:flags=area" % (dei, crop)], 96, 72)
        if len(F):
            sc = norm(F) @ s2; j = int(np.argmax(sc)); t, fine = t0 + j / fps, float(sc[j])
        else:
            t, fine = best / RATE, coarse
        fr = out / ("%s_%02d_found.jpg" % (sid, slot))
        run(["ffmpeg", "-hide_banner", "-nostdin", "-v", "error", "-y", "-ss", "%.3f" % t, "-i", src, "-map", "0:v:0", "-frames:v", "1",
             "-vf", "%sscale=%d:%d:flags=lanczos,setsar=1" % (dei, TW, TH), "-q:v", "2", str(fr)])
        res.append({"twin": sid, "slot": slot, "t": round(t, 2), "coarse": round(coarse, 3), "fine": round(fine, 3), "found": str(fr)})
        print("    %s still %d  t=%d:%02d  score %.2f" % (sid, slot, int(t) // 60, int(t) % 60, fine))
        A_, B_ = Image.open(still).convert("RGB"), Image.open(fr).convert("RGB")
        A_ = A_.resize((int(A_.width * 160 / A_.height), 160)); B_ = B_.resize((int(B_.width * 160 / B_.height), 160))
        tile = Image.new("RGB", (A_.width + B_.width + 4, 160)); tile.paste(A_, (0, 0)); tile.paste(B_, (A_.width + 4, 0))
        d = ImageDraw.Draw(tile); lab = "%s %d  %.2f  %d:%02d" % (sid, slot, fine, int(t) // 60, int(t) % 60)
        d.rectangle([0, 0, 7 * len(lab) + 4, 12], fill=(0, 0, 0)); d.text((2, 0), lab, fill=(255, 255, 0)); tiles.append(tile)
(out / "match.json").write_text(json.dumps(res, indent=1))
if tiles:
    TWs = max(t.width for t in tiles); C = 3; R = (len(tiles) + C - 1) // C
    sheet = Image.new("RGB", ((TWs + 8) * C, 166 * R))
    for i, t in enumerate(tiles): sheet.paste(t, ((i % C) * (TWs + 8), (i // C) * 166))
    sheet.save(out / "pairs.jpg", quality=82)
print("  -> %s (yours left, this source right)" % (out / "pairs.jpg"))

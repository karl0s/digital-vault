#!/usr/bin/env python3
"""VaultShots - robust screenshot capture from the Live Music HD.

SAFETY
  The collection drive is an INPUT ONLY. Every path on it is opened read-only
  or passed to ffmpeg as '-i'. Every file this program writes lands under
  ~/VaultShots. It cannot touch public/images, shows.json or the HD.

WHY THE OLD SHOTS WERE SQUASHED
  DVD pixels are not square. A 720x576 frame with sample_aspect_ratio 64:45 is
  meant to display at 1024x576 (16:9). Writing the raw 720x576 grid yields a
  1.25:1 picture where 1.78:1 was intended - a 30% horizontal squash. This tool
  computes the display shape from SAR and verifies every written file.

Commands:
  plan      probe each show, compute target dimensions, run the safety gates
  capture   extract N candidate frames per show (deinterlace -> scale -> verify)
  score     rank candidates, de-duplicate, keep the best 20
  contact   build one labelled contact sheet per show
  report    write the review page
  ab        deinterlace A/B (pp=lb vs bwdif vs yadif) on one show
  all       plan -> capture -> score -> contact -> report
"""
from __future__ import annotations

import argparse, json, math, os, re, shutil, sqlite3, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

HOME     = Path(os.environ.get("VAULTSHOTS_HOME", str(Path.home() / "VaultShots")))
WORK     = HOME / "work"
CONTACT  = HOME / "contact"
REPORTS  = HOME / "reports"
DATA     = HOME / "data"
STATE    = DATA / "state.json"

REPO      = Path("/Users/ko/Desktop/Projects/the-vault")
SHOWS_JSON = REPO / "public" / "shows.json"
DEDUPE_DB  = Path.home() / "MediaDeduper" / "data" / "dedupe.sqlite"
HD_ROOT    = Path("/Volumes/Live Music")

VIDEO_EXT = {".vob",".mkv",".mp4",".m4v",".avi",".ts",".m2ts",".mts",".mpg",".mpeg",".mov",".wmv",".flv"}
BOLD,DIM,GREEN,YELLOW,RED,CYAN,RESET = "\033[1m","\033[2m","\033[32m","\033[33m","\033[31m","\033[36m","\033[0m"


# ---------------------------------------------------------------- safety
def assert_readonly_target(p: Path) -> None:
    """Refuse to write anywhere except under HOME."""
    rp = Path(os.path.realpath(str(p)))
    rh = Path(os.path.realpath(str(HOME)))
    if not (rp == rh or str(rp).startswith(str(rh) + os.sep)):
        raise SystemExit("REFUSING to write outside %s: %s" % (rh, rp))
    if str(rp).startswith(str(Path(os.path.realpath(str(HD_ROOT)))) + os.sep):
        raise SystemExit("REFUSING to write to the collection drive: %s" % rp)


def run(argv, timeout=180):
    return subprocess.run(argv, capture_output=True, timeout=timeout, shell=False, check=False)


# ---------------------------------------------------------------- discovery
def discover(artist: str):
    """Enumerate the artist's folders as they exist on the drive RIGHT NOW, then
    link each back to a shows.json record for its checksum.

    Drive-first on purpose. shows.json's FolderName values reflect the old drive
    layout and no longer match after the collection was reorganised, so matching
    by name (or by total size, where sibling recordings differ by <0.5%) produces
    wrong pairings. The drive is the ground truth for what can be captured.
    """
    import unicodedata
    shows = json.loads(SHOWS_JSON.read_text(encoding="utf-8"))
    mine  = [s for s in shows if s.get("Artist") == artist]

    def toks(x):
        x = unicodedata.normalize("NFKD", x or "").encode("ascii","ignore").decode().casefold()
        return set(t for t in re.sub(r"[^a-z0-9]+", " ", x).split() if len(t) > 1)
    artist_toks = toks(artist)

    con = sqlite3.connect("file:%s?mode=ro" % DEDUPE_DB, uri=True)
    con.row_factory = sqlite3.Row
    units = [dict(r) for r in con.execute(
        "SELECT rel_path,kind,n_media,total_size FROM units ORDER BY rel_path")]
    con.close()

    out = []
    for u in units:
        rel = u["rel_path"]
        low = rel.casefold()
        if "karls pc before it dies" in low:      # PC backup copy, not the collection
            continue
        # Token match, not substring: loose files use underscores
        # ("30_seconds_to_mars_-_live_at_mexico_city...") which a plain
        # substring test on the artist name would miss entirely.
        rt = toks(rel)
        if not (len(artist_toks & rt) >= 2 or "30stm" in rt):
            continue
        folder = HD_ROOT / rel
        if not (folder.is_dir() or folder.is_file()):   # loose single-file shows count
            continue
        base = os.path.basename(rel)
        cand = toks(base) - artist_toks
        best, bestsc = None, 0
        for sh in mine:
            sc = len(cand & (toks(sh.get("FolderName") or "") - artist_toks))
            if sc > bestsc: best, bestsc = sh, sc
        strong = bestsc >= 3            # weak overlaps map many folders onto one record
        out.append({
            "rel": rel, "folder": folder, "kind": u["kind"],
            "label": base,
            "ShowID": (best or {}).get("ShowID", "") if strong else "",
            "Checksum": (best or {}).get("ChecksumSHA1", "") if strong else "",
            "ShowDate": (best or {}).get("ShowDate", "") if strong else "",
            "json_aspect": (best or {}).get("AspectRatio", "") if strong else "",
            "link": ("%d tok" % bestsc) if strong else ("weak %d" % bestsc if bestsc else "unlinked"),
        })
    return out


def pick_source(folder: Path):
    if folder.is_file():                      # loose single-file show
        return str(folder), "file", [folder]
    """Return (ffmpeg_input, kind, files).

    DVD folders are read through the concat: protocol across all VTS parts, so
    candidate frames span the whole show rather than one 1 GB VOB chunk.
    """
    vts = sorted([q for q in folder.rglob("*")
                  if q.is_file() and re.match(r"VTS_\d+_[1-9]\.VOB$", q.name, re.I)],
                 key=lambda q: q.name.upper())
    if vts:
        return "concat:" + "|".join(str(q) for q in vts), "dvd", vts
    vids = sorted([q for q in folder.rglob("*")
                   if q.is_file() and q.suffix.lower() in VIDEO_EXT
                   and q.stat().st_size > 20*1024*1024],
                  key=lambda q: q.stat().st_size, reverse=True)
    if not vids:
        return None, None, []
    return str(vids[0]), "file", [vids[0]]


# ---------------------------------------------------------------- probing
def ffprobe_stream(src: str):
    r = run(["ffprobe","-v","error","-select_streams","v:0","-print_format","json",
             "-show_streams","-show_format","-i",src], timeout=120)
    if r.returncode != 0:
        return None, (r.stderr.decode("utf-8","replace")[:300] or "ffprobe failed")
    try:
        d = json.loads(r.stdout.decode("utf-8","replace"))
    except ValueError as e:
        return None, str(e)
    st = (d.get("streams") or [None])[0]
    if not st:
        return None, "no video stream"
    return {"stream": st, "format": d.get("format") or {}}, None


def ratio(s, default=(1,1)):
    try:
        a,b = str(s).split(":")
        a,b = int(a), int(b)
        return (a,b) if a>0 and b>0 else default
    except Exception:
        return default


def compute_target(st):
    w, h = int(st["width"]), int(st["height"])
    sn, sd = ratio(st.get("sample_aspect_ratio"), (1,1))
    dn, dd = ratio(st.get("display_aspect_ratio"), (0,0))
    if abs(sn/sd - 1.0) <= 0.01:      # 999:1000 and friends are encoder noise
        sn, sd = 1, 1
    tw = int(round(w * sn / sd))
    tw += tw % 2                      # keep it even
    th = h
    dar = (dn/dd) if dn and dd else (tw/th)
    return {"w":w,"h":h,"sar":"%d:%d"%(sn,sd),"dar_str":("%d:%d"%(dn,dd)) if dn else "",
            "target_w":tw,"target_h":th,"dar":dar,"computed_ar":tw/th,
            "interlaced": str(st.get("field_order","")).lower() in ("tt","bb","tb","bt"),
            "field_order": st.get("field_order",""),
            "fps": st.get("avg_frame_rate","")}


OVERRIDES = DATA / "overrides.json"


def apply_override(it, t):
    """Per-show corrections for containers whose aspect flag is simply wrong.

    Gate 1 only checks that SAR and DAR agree with each other - it cannot know
    the flag itself is wrong. The 2013 Rock in Rio DVD declares SAR 8:9 / DAR 4:3,
    which is internally consistent and passes every automated check, yet the
    picture is visibly squashed: a 2013 festival broadcast is 16:9, and rendering
    it at 4:3 makes people narrow and tall. Verified by rendering the same frame
    at both shapes and comparing a known-circular floor logo.
    """
    if not OVERRIDES.exists():
        return t
    try:
        ov = json.loads(OVERRIDES.read_text(encoding="utf-8"))
    except ValueError:
        return t
    for frag, rule in ov.items():
        if frag not in it["rel"] and frag not in it["label"]:
            continue
        if "dar" in rule:
            dn, dd = ratio(rule["dar"], (16, 9))
            t["dar"] = dn / dd
            tw = int(round(t["target_h"] * dn / dd)); tw += tw % 2
            t["target_w"] = tw
            t["computed_ar"] = tw / t["target_h"]
            t["override"] = "DAR forced to %s (%s)" % (rule["dar"], rule.get("why", ""))
        if "crop" in rule:                      # w:h:x:y, applied before scaling
            t["crop"] = rule["crop"]
            cw, ch = (int(v) for v in rule["crop"].split(":")[:2])
            # The cropped region's shape must be derived from the CROPPED pixels
            # and the sample aspect - not from the full frame's DAR, which
            # included the black bars and is meaningless once they are gone.
            sn, sd = ratio(t["sar"], (1, 1))
            tw = int(round(cw * sn / sd)); tw += tw % 2
            t["target_w"], t["target_h"] = tw, ch
            t["dar"] = tw / ch
            t["computed_ar"] = tw / ch
            t["override"] = (t.get("override","") + " crop %s (%s)" % (rule["crop"], rule.get("why",""))).strip()
    return t


def gates(t, json_aspect):
    """Gates 1-3: run BEFORE any frame is cut."""
    g = []
    ok = True
    d1 = abs(t["computed_ar"] - t["dar"]) / max(t["dar"], 1e-9)
    g.append(("SAR/DAR agree", d1 <= 0.01, "computed %.4f vs declared %.4f" % (t["computed_ar"], t["dar"])))
    ok &= d1 <= 0.01
    good_dims = t["target_w"] >= 320 and t["target_h"] >= 240
    g.append(("target dimensions sane", good_dims, "%dx%d" % (t["target_w"], t["target_h"])))
    ok &= good_dims
    in_band = 1.15 <= t["computed_ar"] <= 2.60
    g.append(("aspect in plausible band", in_band, "%.3f:1" % t["computed_ar"]))
    ok &= in_band
    if json_aspect:
        m = re.search(r"(\d+):(\d+)", json_aspect)
        if m:
            ja = int(m.group(1))/int(m.group(2))
            agree = abs(ja - t["dar"])/max(t["dar"],1e-9) <= 0.02
            g.append(("agrees with shows.json", agree, "%s" % json_aspect))
    return ok, g


def demux_duration(src, timeout=900):
    """True runtime via a demux-only pass (-c copy -f null).

    MPEG-PS containers report nonsense: a 472 MB VOB claims 13.9 s and 283 Mbps.
    Byte-seek probing also fails on the concat: protocol. Demuxing without
    decoding runs at ~90x realtime and reports the real final timestamp.
    """
    r = run(["ffmpeg","-hide_banner","-i",src,"-c","copy","-f","null","-"], timeout=timeout)
    txt = r.stderr.decode("utf-8","replace")
    hits = re.findall(r"time=(\d+):(\d\d):(\d\d(?:\.\d+)?)", txt)
    if not hits:
        return 0.0
    h, m, sec = hits[-1]
    return int(h)*3600 + int(m)*60 + float(sec)


def true_duration(src, files, reported):
    """Trust the container only when its duration implies a sane bitrate."""
    total = sum(f.stat().st_size for f in files) if files else 0
    if reported > 1 and total and (total * 8 / reported) < 30e6:
        return reported, "reported"
    d = demux_duration(src)
    if d > 1:
        return d, "demuxed"
    return reported, "unknown"


# ---------------------------------------------------------------- plan
def cmd_plan(a):
    items = discover(a.artist)
    print(BOLD + "\nPlan — %s (%d folders on the drive)" % (a.artist, len(items)) + RESET)
    print(DIM + "-"*104 + RESET)
    state = {"artist": a.artist, "shows": []}
    okc = badc = 0
    for it in items:
        src, kind, files = pick_source(it["folder"])
        if not src:
            print("  %sSKIP%s %-40s  no video files" % (RED,RESET,it["label"][:40])); badc+=1; continue
        info, err = ffprobe_stream(src)
        if not info:
            print("  %sSKIP%s %-40s  %s" % (RED,RESET,it["label"][:40],err)); badc+=1; continue
        t = compute_target(info["stream"])
        t = apply_override(it, t)
        # DVDs are read through the concat: protocol, which does not report a
        # duration - sum the parts instead.
        dur = 0.0
        if kind == "dvd":
            for f in files:
                i2,_ = ffprobe_stream(str(f))
                if i2:
                    try: dur += float(i2["format"].get("duration") or 0)
                    except Exception: pass
        else:
            try: dur = float(info["format"].get("duration") or 0)
            except Exception: dur = 0.0
        dur, how = true_duration(src, files, dur)
        passed, glist = gates(t, it["json_aspect"])
        n = max(120, min(500, int(dur // 5))) if dur > 0 else 120
        flag = (GREEN+"OK  "+RESET) if passed else (RED+"FAIL"+RESET)
        print("  %s %-40s %-9s SAR %-7s -> %-9s %-10s %5.0fmin %3d  %s" % (
            flag, it["label"][:40], "%dx%d"%(t["w"],t["h"]), t["sar"],
            "%dx%d"%(t["target_w"],t["target_h"]),
            ("intl "+t["field_order"]) if t["interlaced"] else "progressive",
            dur/60, n, how))
        if t.get("override"):
            print("        %soverride: %s%s" % (CYAN, t["override"], RESET))
        for name, good, detail in glist:
            if not good: print("        %sgate failed: %s (%s)%s" % (RED,name,detail,RESET))
        if passed:
            okc += 1
            # The work-dir key MUST be unique per drive folder. Deriving it from
            # ShowID collided badly: several distinct folders link to one record,
            # so their frames piled into a shared directory at mixed dimensions.
            import hashlib
            slug = re.sub(r"[^A-Za-z0-9]+", "_", it["rel"]).strip("_")[:48]
            key = "%s__%s" % (slug, hashlib.sha1(it["rel"].encode()).hexdigest()[:6])
            state["shows"].append({
                "key": key, "ShowID": it["ShowID"], "Checksum": it["Checksum"],
                "FolderName": it["label"], "rel": it["rel"], "ShowDate": it["ShowDate"],
                "link": it["link"], "src": src, "kind": kind, "duration": dur, "n": n, **t,
            })
        else: badc += 1
    DATA.mkdir(parents=True, exist_ok=True)
    assert_readonly_target(STATE)
    STATE.write_text(json.dumps(state, indent=1), encoding="utf-8")
    print(DIM + "-"*104 + RESET)
    print("  ready: %s%d%s   skipped: %s%d%s   -> %s" % (GREEN,okc,RESET,YELLOW,badc,RESET,STATE))
    return 0


# ---------------------------------------------------------------- capture
def build_vf(t, deint="pp=lb"):
    parts = []
    if t.get("crop"):
        parts.append("crop=%s" % t["crop"])      # strip baked-in letterbox first
    if t["interlaced"] and deint:
        parts.append(deint)                                  # deinterlace at native res
    parts.append("scale=%d:%d:flags=lanczos" % (t["target_w"], t["target_h"]))
    parts.append("setsar=1")
    return ",".join(parts)


def grab(src, ts, vf, out: Path, timeout=90):
    assert_readonly_target(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    r = run(["ffmpeg","-hide_banner","-loglevel","error","-y",
             "-ss","%.3f"%ts,"-i",src,"-frames:v","1","-vf",vf,
             "-q:v","2","-pix_fmt","yuvj420p",str(out)], timeout=timeout)
    return r.returncode == 0 and out.exists() and out.stat().st_size > 2000


def verify(path: Path, t):
    """Gates 4-6: the written file must BE the computed target."""
    from PIL import Image
    try:
        with Image.open(path) as im: w,h = im.size
    except Exception as e:
        return False, "unreadable: %s" % e
    if (w,h) != (t["target_w"], t["target_h"]):
        return False, "got %dx%d expected %dx%d" % (w,h,t["target_w"],t["target_h"])
    if abs(w/h - t["dar"])/max(t["dar"],1e-9) > 0.01:
        return False, "AR %.4f vs DAR %.4f" % (w/h, t["dar"])
    return True, "%dx%d" % (w,h)


def capture_singlepass(s, vf_tail, outdir: Path, n: int):
    """One decode pass, taking every Kth frame.

    Needed for MPEG-PS DVDs whose container timestamps are broken: the demux pass
    finds the real runtime, but -ss still seeks against the bogus timestamps, so
    every seek lands past the container's claimed end and fails. Decoding straight
    through and selecting by frame number sidesteps timestamps entirely.
    """
    fps = 25.0
    try:
        num, den = str(s.get("fps") or "25/1").split("/")
        if float(den): fps = float(num)/float(den)
    except Exception: pass
    total = max(1, int(s["duration"] * fps))
    k = max(1, total // max(1, n))
    tmp = outdir / "_pass"
    if tmp.exists(): shutil.rmtree(tmp)
    tmp.mkdir(parents=True, exist_ok=True)
    assert_readonly_target(tmp)
    vf = "select='not(mod(n\\,%d))'," % k + vf_tail
    r = run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",s["src"],
             "-vf",vf,"-vsync","0","-frames:v",str(n),"-q:v","2",
             "-pix_fmt","yuvj420p",str(tmp/"f_%04d.jpg")], timeout=3600)
    made = sorted(tmp.glob("f_*.jpg"))
    ok = 0
    for i, f in enumerate(made):
        ts = (i * k) / fps
        hh=int(ts//3600); mm=int(ts%3600//60); ss=int(ts%60)
        dest = outdir / ("%s_c%03d_t%02d-%02d-%02d.jpg" % (s["key"], i, hh, mm, ss))
        good, why = verify(f, s)
        if not good:
            f.unlink(missing_ok=True); continue
        f.replace(dest); ok += 1
    shutil.rmtree(tmp, ignore_errors=True)
    return ok, r.returncode


def cmd_capture(a):
    state = json.loads(STATE.read_text(encoding="utf-8"))
    shows = state["shows"]
    if a.only: shows = [s for s in shows if s["key"] in set(a.only.split(","))]
    print(BOLD + "\nCapture — %d shows, deinterlace=%s" % (len(shows), a.deint or "off") + RESET)
    grand_ok = grand_bad = 0
    for si, s in enumerate(shows, 1):
        outdir = WORK / s["key"]
        if a.fresh and outdir.exists(): shutil.rmtree(outdir)
        outdir.mkdir(parents=True, exist_ok=True)
        vf = build_vf(s, a.deint)
        dur, n = s["duration"], s["n"]
        lo, hi = dur*0.05, dur*0.95
        step = (hi-lo)/max(1,n-1)
        stamps = [lo + i*step for i in range(n)]
        t0=time.time(); ok=bad=0
        def one(i_ts):
            i, ts = i_ts
            hh=int(ts//3600); mm=int(ts%3600//60); ss=int(ts%60)
            out = outdir / ("%s_c%03d_t%02d-%02d-%02d.jpg" % (s["key"], i, hh, mm, ss))
            if out.exists() and not a.fresh: return (True,"cached",out,ts)
            if not grab(s["src"], ts, vf, out): return (False,"ffmpeg failed",out,ts)
            good, why = verify(out, s)
            if not good:
                try: out.unlink()
                except OSError: pass
                return (False,why,out,ts)
            return (True,why,out,ts)
        with ThreadPoolExecutor(max_workers=a.workers) as ex:
            futs=[ex.submit(one,(i,ts)) for i,ts in enumerate(stamps)]
            for k,f in enumerate(as_completed(futs),1):
                good,why,out,ts = f.result()
                if good: ok+=1
                else:
                    bad+=1
                    if bad<=3: print("\n      %sreject%s %s" % (YELLOW,RESET,why))
                if k%10==0 or k==len(futs):
                    print("\r  [%2d/%2d] %-30s %3d/%3d  ok=%d bad=%d  %.0fs" %
                          (si,len(shows),s["FolderName"][:30],k,len(futs),ok,bad,time.time()-t0),
                          end="", flush=True)
        if ok == 0 and bad > 0:
            print("\n      %sseek path failed entirely - retrying with a single decode pass%s"
                  % (YELLOW,RESET))
            tail = vf.split(",",1)[1] if vf.startswith("pp=") or vf.startswith("bwdif") or vf.startswith("yadif") else vf
            tail = vf   # keep the full chain; select is prepended inside
            ok2, rc = capture_singlepass(s, tail, outdir, s["n"])
            print("      single-pass recovered %s%d%s frames (ffmpeg rc=%d)" % (GREEN,ok2,RESET,rc))
            ok, bad = ok2, max(0, bad-ok2)
        print("   %s%dx%d verified%s%s" % (GREEN,s["target_w"],s["target_h"],RESET,
              ("  %s%d rejected%s"%(YELLOW,bad,RESET)) if bad else ""))
        grand_ok+=ok; grand_bad+=bad
    print("\n  captured %s%d%s frames, rejected %s%d%s" % (GREEN,grand_ok,RESET,YELLOW,grand_bad,RESET))
    return 0


# ---------------------------------------------------------------- scoring
def score_image(path):
    import subject as _subj
    return _subj.analyse(path)


def _legacy_score_image(path):
    import numpy as np
    from PIL import Image
    with Image.open(path) as im:
        g = np.asarray(im.convert("L").resize((320,240)), dtype=np.float32)
        rgb = np.asarray(im.convert("RGB").resize((64,48)), dtype=np.float32)
    # sharpness: variance of a 3x3 Laplacian
    k = g[:-2,1:-1]+g[2:,1:-1]+g[1:-1,:-2]+g[1:-1,2:]-4*g[1:-1,1:-1]
    sharp = float(k.var())
    mean = float(g.mean()); contrast = float(g.std())
    R,G,B = rgb[...,0],rgb[...,1],rgb[...,2]
    rg = np.abs(R-G); yb = np.abs(0.5*(R+G)-B)
    colour = float(math.sqrt(rg.std()**2+yb.std()**2) + 0.3*math.sqrt(rg.mean()**2+yb.mean()**2))
    # dHash for de-duplication
    small = np.asarray(Image.open(path).convert("L").resize((9,8)), dtype=np.int16)
    bits = (small[:,1:] > small[:,:-1]).flatten()
    dhash = int("".join("1" if b else "0" for b in bits), 2)
    exposure = 1.0 - min(1.0, abs(mean-118)/118)          # penalise very dark/blown
    total = (min(sharp,600)/600*100)*0.55 + (min(contrast,80)/80*100)*0.20 + \
            exposure*100*0.15 + (min(colour,80)/80*100)*0.10
    return {"sharp":sharp,"mean":mean,"contrast":contrast,"colour":colour,
            "exposure":exposure,"score":total,"dhash":dhash}


def cmd_score(a):
    import numpy as np
    state = json.loads(STATE.read_text(encoding="utf-8"))
    out = {}
    for s in state["shows"]:
        d = WORK / s["key"]
        files = sorted(d.glob("*.jpg"))
        if not files: continue
        rows=[]
        with ThreadPoolExecutor(max_workers=a.workers) as ex:
            futs={ex.submit(score_image,f):f for f in files}
            for f in as_completed(futs):
                p=futs[f]
                try: m=f.result()
                except Exception: continue
                m["file"]=p.name; m["t"]=p.stem.split("_t")[-1]; rows.append(m)
        rows = [r for r in rows if not r.get("crowd")]
        # Adaptive blur floor: sharpness scales with resolution and bitrate, so an
        # absolute cutoff would gut the SD sources and pass soft HD frames. Judge
        # each show against its own best.
        if rows:
            ref = float(np.percentile([r["subject"] for r in rows], 95))
            floor = max(250.0, 0.35*ref)
            rows = [r for r in rows if r["subject"] >= floor]
        rows.sort(key=lambda r:-r["score"])
        # de-duplicate: keep a frame only if it differs enough from those kept
        keep=[]
        for r in rows:
            if all(bin(r["dhash"] ^ k["dhash"]).count("1") >= a.mindist for k in keep):
                keep.append(r)
            if len(keep) >= a.top: break
        out[s["key"]] = {"all":len(rows), "keep":keep}
        print("  %-40s %4d usable -> top %2d kept (best %.0f)" %
              (s["FolderName"][:40], len(rows), len(keep), keep[0]["score"] if keep else 0))
    p = DATA/"scores.json"; assert_readonly_target(p)
    p.write_text(json.dumps(out, indent=1), encoding="utf-8")
    print("  -> %s" % p)
    return 0


# ---------------------------------------------------------------- contact sheets
def cmd_contact(a):
    from PIL import Image, ImageDraw
    state=json.loads(STATE.read_text(encoding="utf-8"))
    scores=json.loads((DATA/"scores.json").read_text(encoding="utf-8"))
    CONTACT.mkdir(parents=True, exist_ok=True)
    COLS,TW = 5,384
    for s in state["shows"]:
        sc=scores.get(s["key"]); 
        if not sc or not sc["keep"]: continue
        keep=sc["keep"]; rows=(len(keep)+COLS-1)//COLS
        th=int(TW*s["target_h"]/s["target_w"]); pad=26
        sheet=Image.new("RGB",(COLS*TW, rows*(th+pad)),(16,18,22))
        dr=ImageDraw.Draw(sheet)
        for i,r in enumerate(keep):
            im=Image.open(WORK/s["key"]/r["file"]).convert("RGB").resize((TW,th))
            x,y=(i%COLS)*TW,(i//COLS)*(th+pad)
            sheet.paste(im,(x,y))
            dr.rectangle([x,y+th,x+TW,y+th+pad],fill=(16,18,22))
            dr.text((x+6,y+th+7),"#%d  %s  score %.0f  sharp %.0f"%(i+1,r["t"],r["score"],r["sharp"]),
                    fill=(200,208,218))
            dr.rectangle([x,y,x+TW-1,y+th-1],outline=(45,52,62))
        p=CONTACT/("%s_contact.jpg"%s["key"]); assert_readonly_target(p)
        sheet.save(p,quality=88)
        print("  %-34s %d frames -> %s" % (s["FolderName"][:34],len(keep),p.name))
    return 0


# ---------------------------------------------------------------- A/B deinterlace
def cmd_ab(a):
    state=json.loads(STATE.read_text(encoding="utf-8"))
    s=next((x for x in state["shows"] if x["interlaced"] and (not a.only or x["key"]==a.only)), None)
    if not s: print("no interlaced show found"); return 1
    outdir=HOME/"ab"/s["key"]; outdir.mkdir(parents=True,exist_ok=True)
    modes=[("none",""),("pp-lb","pp=lb"),("bwdif","bwdif=mode=send_frame"),("yadif","yadif=0:-1:0")]
    stamps=[s["duration"]*f for f in (0.25,0.45,0.65)]
    print(BOLD+"\nA/B deinterlace — %s"%s["FolderName"]+RESET)
    for name,filt in modes:
        vf=build_vf(s,filt) if filt else "scale=%d:%d:flags=lanczos,setsar=1"%(s["target_w"],s["target_h"])
        for i,ts in enumerate(stamps):
            out=outdir/("%s_t%d.jpg"%(name,i))
            ok=grab(s["src"],ts,vf,out)
            print("  %-6s frame %d  %s" % (name,i,"ok" if ok else "FAILED"))
    print("  -> %s"%outdir)
    return 0


# ---------------------------------------------------------------- main
def main():
    p=argparse.ArgumentParser(prog="shots.py",description="Read-only screenshot capture from the Live Music HD.")
    p.add_argument("--artist",default="30 Seconds to Mars")
    sub=p.add_subparsers(dest="cmd",required=True)
    for name,fn in (("plan",cmd_plan),("capture",cmd_capture),("score",cmd_score),
                    ("contact",cmd_contact),("ab",cmd_ab)):
        sp=sub.add_parser(name); sp.set_defaults(func=fn)
        if name=="capture":
            sp.add_argument("--deint",default="pp=lb"); sp.add_argument("--workers",type=int,default=3)
            sp.add_argument("--only"); sp.add_argument("--fresh",action="store_true")
        if name=="score":
            sp.add_argument("--top",type=int,default=20); sp.add_argument("--mindist",type=int,default=12)
            sp.add_argument("--workers",type=int,default=6)
        if name=="ab": sp.add_argument("--only")
    a=p.parse_args()
    HOME.mkdir(parents=True,exist_ok=True)
    return a.func(a)


if __name__=="__main__":
    sys.exit(main())

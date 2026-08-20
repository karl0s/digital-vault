---
name: concert-screenshots
description: Capture high-quality, correctly-proportioned screenshots from concert video on an external drive, for any band and any source format (DVD/VOB, Blu-ray, TS, MKV, MP4, HD broadcast). Use when asked to take, redo, grab or improve screenshots/stills/thumbnails for shows, or when existing images look squashed, stretched, blurry or wrong. Read-only on the collection; all output is staged outside the repo.
---

# Concert Screenshot Capture

A repeatable pipeline for pulling stills from a live-music collection. Derived from a full
run over 21 Thirty Seconds to Mars shows spanning nine distinct source formats. Every rule
below exists because something went wrong; the failure is documented alongside the fix so
you can recognise it rather than rediscover it.

---

## 0. Non-negotiable safety rules

1. **The collection drive is INPUT ONLY.** Every path on it is opened read-only or passed to
   ffmpeg as `-i`. Never write, move, rename or delete anything on it.
2. **All output goes outside the repo and outside the drive** — use `~/VaultShots/` (or an
   equivalent local staging directory). Assert this before writing anything.
3. **Never overwrite `public/images/` or `image-manifest.json` as part of capture.**
   Promotion is a separate, explicitly-requested step.
4. **ffmpeg writes only to the staging directory.** Verify every output path resolves under
   the staging root before invoking it.
5. **Never delete candidate frames until picks are locked** and confirmed to resolve to files.

```python
def assert_readonly_target(p, staging_root, drive_root):
    rp = Path(os.path.realpath(str(p)))
    if not str(rp).startswith(str(Path(os.path.realpath(staging_root))) + os.sep):
        raise SystemExit("REFUSING to write outside staging: %s" % rp)
    if str(rp).startswith(str(Path(os.path.realpath(drive_root))) + os.sep):
        raise SystemExit("REFUSING to write to the collection: %s" % rp)
```

---

## 1. Prerequisites

- `ffmpeg` + `ffprobe`. `bwdif` is the default deinterlacer (§4.6) and is built in.
  **libpostproc** (`ffmpeg -version | grep enable-postproc`) is only needed for the `pp=lb`
  fallback.
- Python 3 with **numpy** and **Pillow**. **Do NOT install OpenCV.** Face detection is the
  wrong tool: valid shots include hands on a drum kit or guitar, a body, a silhouette — all
  faceless. Region-based scoring (§6) handles these; a face gate rejects them.

---

## 2. Discovery — enumerate the DRIVE, never the metadata

**Failure this prevents:** the collection had been reorganised since the last scan. An
artist folder had been flattened into top-level folders, so 22 of 37 cached paths were dead
and `shows.json`'s `FolderName` matched nothing.

Rules:

- **Enumerate folders on the drive as they exist right now.** The drive is ground truth.
- Match the artist by **normalised tokens, not substring.** Loose files use underscores
  (`30_seconds_to_mars_-_live_at_mexico_city...`), which a substring test on the artist name
  misses entirely.
- **Scale the token requirement to the artist's own name length:**
  `need = min(2, len(artist_tokens))`. A fixed "≥2 tokens" rule silently matches **nothing**
  for a single-word artist like Aerosmith or Muse. Add per-artist aliases (`30stm`) where the
  collection uses them.
- **Accept loose single files, not just directories.** A `.mkv`/`.ts` sitting at the drive
  root is a show. An `is_dir()` check silently drops these — it cost 5 of 21 shows.
- **Exclude backup/duplicate trees** (e.g. a "PC backup" folder) by path substring.
- Link back to `shows.json` **only when the match is strong** (≥3 distinctive token overlap).
  Weak name matching mapped 14 different folders onto 7 records. Record the link as metadata;
  never let it define identity.

### A COMMON-WORD artist name matches other artists' folders

**Failure this prevents:** planning "Bush" pulled in *Smashing Pumpkins — Shepherd's Bush
Empire* and *TRAIN Live At O2 Empire, Shepherd's Bush*. Both would have been captured and had
another band's stills promoted onto Bush records. **Nothing downstream catches this** — the
frames are valid, correctly shaped and correctly deinterlaced, just of the wrong band.

Compare each folder against **every** artist's records, not only the one being planned:

```python
best_other_sc = max(len(toks(other_artist) & base_toks) for other_artist in all_artists)
if best_other_sc >= 2 and best_other_sc > len(artist_toks & base_toks):
    skip                      # another artist matches more strongly
if basename.startswith(other_artist_normalised + " "):
    skip                      # the folder OPENS with their name - decisive on a tie
```

Both rules are needed. Token count caught Smashing Pumpkins (2 tokens vs 1) but not TRAIN,
where "Bush" and "Train" each match exactly one token — there, only the leading-name test
breaks the tie. Print the skip and the artist it belongs to; a silent omission is worse than
the bug.

The collection contains **Train, Filter, Live, Garbage, Cake, Tool and Bush** — every one a
common word that will collide with venue names, song titles or other bands' folders.

### Work-directory keys MUST be unique per drive folder

**Failure this prevents:** keying work directories by `ShowID` caused 14 folders to share 7
directories. Frames from different shows piled into the same folder at mixed dimensions and
overwrote each other — a show that should have had 200 frames showed 400 at two aspect ratios.

```python
slug = re.sub(r"[^A-Za-z0-9]+", "_", rel_path).strip("_")[:48]
key  = "%s__%s" % (slug, hashlib.sha1(rel_path.encode()).hexdigest()[:6])
```

**QA gate:** assert `len(set(keys)) == len(keys)` before capturing anything.

---

## 3. Source selection

- **DVD folders:** gather all `VTS_\d+_[1-9].VOB` in sorted order and read them through the
  `concat:` protocol, so candidates span the whole show rather than one 1 GB chunk.
- **Blu-ray:** `BDMV/STREAM/*.m2ts`, largest first, or concat in playlist order.
- **Otherwise:** the largest video file over ~20 MB.

---

## 4. Geometry — the single most important section

DVD and broadcast pixels are **not square**. This is the cause of every "squashed", "thin"
or "stretched" screenshot.

### 4.1 Compute the target from SAR — and NEVER downsample

The display shape is `(width × SAR) / height`. There are always two ways to reach it:
grow one axis, or shrink the other. **Always grow.**

```python
def fit_no_downsample(w, h, dar):
    if dar >= w / h:
        tw, th = round(h * dar), h      # display wider than stored -> grow width
    else:
        tw, th = w, round(w / dar)      # display taller than stored -> grow height
    return tw + tw % 2, th + th % 2     # keep both even
```

**Failure this prevents:** the original rule was `target_w = round(w × SAR); target_h = h`,
which is only correct when SAR ≥ 1. For NTSC 4:3 material (SAR 8:9 or 10:11) it *shrinks*
the width — 720×480 became 640×480, discarding 80 columns of real samples. Both are exactly
4:3, so every aspect gate passed and the bug survived two full artists.

It surfaced only when the user compared hand-taken VLC grabs against pipeline output and
said they looked clearer. VLC grows the height instead: 720×480 → **720×540**, same shape,
**26% more pixels**, nothing discarded.

| Stored | SAR | Display | Correct output | Old (downsampling) rule | Cost |
|---|---|---|---|---|---|
| 720×480 | 8:9 | 4:3 | **720×540** | 640×480 | **21% of pixels thrown away** |
| 704×480 | 10:11 | 4:3 | **704×528** | 640×480 | **19% thrown away** |
| 704×576 | 12:11 | 4:3 | **768×576** | 768×576 | correct either way |
| 720×576 | 64:45 | 16:9 | **1024×576** | 1024×576 | correct either way |
| 720×576 | 16:15 | 4:3 | **768×576** | 768×576 | correct either way |
| 720×480 | 32:27 | 16:9 | **854×480** | 854×480 | correct either way |
| 1920×1080 | 1:1 | 16:9 | 1920×1080 | 1920×1080 | correct either way |

Note the pattern: **only SAR < 1 sources were affected**, which is why PAL 16:9 material
(SAR 64:45, grows width) looked fine throughout and hid the problem.

**Keep `computed_ar` as the shape SAR *implies*** — `(w × SAR) / h` — not as the shape of
the output. Deriving it from the output makes gate 1 (§8) trivially true, because the output
is now constructed to match DAR by definition. The gate must still be able to catch a source
whose SAR and DAR disagree.

### 4.1b Canonical output sizes — what consistency actually means

**Policy: native max, no upscaling beyond the source.** Reach the display shape by growing
the under-sampled axis. Never invent pixels to make two shows match, and never discard real
ones. Sizes therefore vary by source standard — that is correct and intended.

Two shows are "consistent" when their **aspect ratio is exact** and each is at **the largest
size its source honestly supports**. Forcing every 4:3 show to one arbitrary size would mean
upscaling NTSC by up to 20%, which produces matching dimensions with mismatched sharpness —
uniformity on paper, not on screen.

Every size the collection legitimately produces (measured across 796 catalogued shows):

| Source | Standard | Display | **Output** | Shows |
|---|---|---|---|---:|
| 720×576 | PAL | 4:3 | **768×576** | 224 |
| 720×480 | NTSC | 4:3 | **720×540** | 239 |
| 720×576 | PAL | 16:9 | **1024×576** | 110 |
| 704×480 | NTSC | 4:3 | **704×528** | 54 |
| 704×576 | PAL | 4:3 | **768×576** | 24 |
| 720×480 | NTSC | 16:9 | **854×480** | 24 |
| 704×576 | PAL | 16:9 | **1024×576** | 6 |
| 480×576 | PAL | 4:3 | **768×576** | 3 |
| 352×480 | NTSC | 4:3 | **640×480** | 3 |
| 1280×720 | either | 16:9 | **1280×720** | 10 |
| 1920×1080 | either | 16:9 | **1920×1080** | 77 |
| 1440×1080 | PAL | 16:9 | **1920×1080** | 6 |

Eight distinct output sizes in total: `640×480`, `704×528`, `720×540`, `768×576`,
`854×480`, `1024×576`, `1280×720`, `1920×1080`.

**A show's images must all share one size** — if slot 1 is 768×576 and slot 3 is 720×576,
something re-captured half of them under a different rule. §8 gate 7 catches it per run; the
collection-wide audit (§4.1c) catches it retrospectively.

Half-D1 sources (352×480, 480×576) legitimately upscale their *width* substantially — 352 →
640 is an 82% stretch. That is not a violation: the horizontal axis is genuinely
under-sampled, and the alternative is a picture squashed to half its proper width.

### 4.1c Auditing the whole collection

`scripts/audit-image-geometry.py` in the site repo recomputes the correct target for every
show from `shows.json` (`Width`, `Height`, `AspectRatio`) and compares it to what is on disk.

```bash
python3 scripts/audit-image-geometry.py                    # summary + per-artist worklist
python3 scripts/audit-image-geometry.py --artist "Foo Fighters"
python3 scripts/audit-image-geometry.py --list             # every affected show
```

It classifies each show as `correct`, `SQUASHED` (wrong aspect — raw pixel dimensions),
`SMALL` (right shape, below target), `MIXED` (slots disagree with each other),
`LETTERBOX` (needs cropdetect, cannot be judged from metadata) or unknown geometry.

**It deliberately re-implements `fit_no_downsample` rather than importing it**, so the audit
still fails if the pipeline's rule regresses. Two independent statements of the rule are the
point; sharing one would let a bug hide from its own test.

Baseline at the time of writing: **7.3% correct, 67.5% squashed, 9.6% undersized,
11.2% internally inconsistent.** The squashed majority predates this pipeline — those images
were written at raw pixel dimensions with no SAR correction at all.

### 4.1c-2 A folder can CONTAIN other complete discs — never glob recursively

**Failure this prevents:** `pick_source` gathered VOBs with `rglob`, so a folder holding nested
discs swept all of them into one source. The Audioslave compilation has `rar/`, `pp/` and
`hul/` subfolders, each a complete DVD and each already its own capture unit. All four were
concatenated and — because the sort key was the *filename* — interleaved: root `VTS_01_1`,
then `rar/VTS_01_1`, then `pp/VTS_01_1`, and so on. Four different concerts spliced together.

The only visible symptom was an implausible runtime: **1675 minutes for a two-hour disc**. No
gate fired, because every frame it would have produced is validly shaped.

Gather from the disc's own level only:

```python
for d in (folder/"VIDEO_TS", folder):
    if d.is_dir():
        cand = [q for q in d.iterdir() if VOB_RX.match(q.name)]
        if cand: break
```

Same for loose video files: `iterdir`, not `rglob`. A nested folder that holds media is a
separate unit and will be planned separately.

**QA gate:** a runtime that disagrees wildly with `size ÷ bitrate` means the source list is
wrong, not just the duration. Check what `pick_source` actually returned before trusting a
demux to fix it.

### 4.1d One titleset can mix geometries — ffprobe only reports the first stream

**Failure this prevents:** the Alice in Chains Unplugged disc holds the show **twice**.
`VTS_01_1` is a 352×240 copy that runs out into minutes of blank green filler; `VTS_01_2`–`_4`
are the real 720×480 broadcast. `ffprobe` on the concatenated titleset reports the **first**
video stream it finds, so the whole 3.8 GB disc was catalogued as 352×240 — a quarter of the
true resolution, and the reason that show's images were wrong on the site.

Probe **each VOB separately** whenever a titleset's reported geometry looks implausible for
its size or bitrate — 352×240 at 8.8 Mbps is a contradiction, since quarter-D1 needs nothing
like that:

```bash
for f in VTS_01_*.VOB; do
  ffprobe -v error -select_streams v -show_entries stream=width,height,sample_aspect_ratio \
          -of csv=p=0 "$f"
done | sort -u          # more than one line = mixed geometry
```

Then restrict capture to the good files with `vobs` in `splits.json` (§10b step 7). Selecting
files rather than a time window matters here: it makes ffprobe report the **right** geometry,
because the bad stream is no longer first.

### 4.2 Snap near-square SAR to 1:1

Encoders emit noise like `999:1000` and `1287:1280`. Within 1% of square, force `1:1` —
otherwise you get a 1288-pixel-wide image for no reason.

### 4.3 Detect letterbox with cropdetect at TWO OR MORE timestamps

**Failure this prevents:** cropdetect on a single dark frame returns a bogus crop. Sampling
one show at 55% runtime reported `636×556` when the true frame was full-width; a second
sample at 30% exposed it.

- Sample at ≥2 points (e.g. 30% and 55%). Only trust a **consistent** result.
- When cropping, recompute the target from the **cropped** pixels and the SAR — not from the
  full frame's DAR, which included the bars and is meaningless once they're gone.
  Getting this wrong produced `606×404` instead of the correct `720×404`.

### 4.4 Aspect-flag overrides — the flag itself can be wrong

**Failure this prevents:** a 2013 festival DVD declared `SAR 8:9 / DAR 4:3`. That is
*internally consistent*, so it passes every automated check — but the picture was visibly
squashed. A 2013 broadcast is 16:9; the flag was simply wrong.

Detection heuristic — flag for human review when:
- an SD source (704/720 × 480/576) declares **4:3** but the show is dated **2008 or later**; or
- the computed aspect is **non-standard** (not within 2% of 4:3 or 16:9).

**Verification method (do this, don't guess):** render the *same frame* at both candidate
shapes side by side and look for a known-circular or known-proportioned reference — a floor
logo, a drum head, a wheel, human body proportions. The correct one looks natural; the wrong
one makes people narrow and tall (or short and wide).

Store overrides in a JSON file keyed by path fragment, with a `why` field recording the
evidence. Never bury an override in code.

### WRITE THE CORRECTION BACK TO `shows.json` — the override is not the record

**Failure this prevents:** two aspect corrections lived in `overrides.json` for **six artists**
while `shows.json` kept the wrong values. The capture tool rendered correctly the whole time, so
nothing looked broken — but the master data, which is what the site and every audit read, stayed
wrong. One was a 2013 Rock in Rio DVD still recorded as 4:3; the other had no `AspectRatio` at
all.

An override fixes the CAPTURE. The record is what the collection actually knows. **Every
override must be mirrored into the record in the same session it is created**, with the evidence
in `Notes`:

| Override | Record change |
|---|---|
| `dar` forced | `AspectRatio` → the true ratio, e.g. `16:9 (native)` |
| `crop` for letterbox | `AspectRatio` → `4:3 (letterboxed 16:9)` — frame ratio first, picture ratio second |
| `crop` for pillarbox | `AspectRatio` → `16:9 (pillarboxed 3:2)` — same convention |

The two-part form matters: the FIRST ratio is the stored frame, the SECOND is the real picture.
Audits need both — image checks compare against the picture, source checks against the frame.

### The feature is not always titleset 01 — never probe VTS_01 blind

**Failure this prevents:** the first collection sweep reported KoRn, Papa Roach and
Soundgarden as aspect disagreements. All three records were correct. `rep_media` took
`VTS_01_1.VOB` unconditionally, and on those discs titleset 01 is the **menu** — 2.9 MB,
3.5 MB and 39 MB stubs, authored 4:3 while the concert sits in VTS_02 at 16:9. The audit
was comparing the record against a menu screen.

Pick the titleset with the most **total** bytes, then its first segment:

```python
by_ts = {}
for x in vobs:
    by_ts.setdefault(x.name.split("_")[1], []).append(x)   # group by titleset number
best = max(by_ts.values(), key=lambda g: sum(q.stat().st_size for q in g))
return sorted(best)[0]
```

Grouping matters — a single 1 GB segment of a three-segment feature must not lose to a
different titleset that happens to have one larger file. And this is why §4.1d exists:
one disc legitimately carries more than one geometry, so "the disc's aspect" is not a
single value. Probe the titleset you are actually capturing.

### Auditing records against the SOURCE, not just the images

`scripts/audit-image-geometry.py` compares the IMAGES to the RECORD. If the record itself is
wrong, both agree and it passes while the stills are squashed — that is precisely how the Rock in
Rio DVD went unnoticed.

`scripts/audit-aspect-vs-source.py` closes that hole. It probes each show's representative media
and reports where the source disagrees with the record:

```bash
python3 scripts/audit-aspect-vs-source.py --artist "Chris Cornell"
python3 scripts/audit-aspect-vs-source.py          # whole collection, slow
```

A disagreement means the record, the source flag, or both are wrong — it does not say which.
An internally consistent SAR/DAR pair can still be wrong (§4.4), so verify by rendering one frame
at each candidate shape before changing anything.

### 4.5 Filter chain and ORDER

```
crop=<w:h:x:y>          # only if letterboxed; strips bars FIRST
bwdif=mode=send_frame:parity=auto:deint=all    # ONLY if interlaced, at native resolution
scale=<tw>:<th>:flags=lanczos
setsar=1
```

Order matters: deinterlace **before** scaling, or you interpolate already-resampled lines.
Crop before both.

### 4.6 Deinterlace conditionally — and use bwdif

Read `field_order` from ffprobe. `tt`/`bb`/`tb`/`bt` = interlaced → deinterlace.
`progressive` → **do not touch it**; deinterlacing a progressive HD source softens it for nothing.

**Use `bwdif`.** Measured on three Aerosmith DVDs, same frames, same geometry:

| Deinterlacer | Sharpness (vs `pp=lb`) | Comb ratio | Verdict |
|---|---|---|---|
| `pp=lb` (blend) | 100% | 1.08 | clean but soft — averages both fields together |
| none | 214% | **4.53** | heavily combed, unusable |
| **`bwdif`** | **173%** | **1.20** | **sharpest clean result** |
| `yadif` | 159% | 1.36 | clean, but bwdif beats it |

`pp=lb` averages the two fields, which removes combing by destroying real vertical detail.
`bwdif` is motion-adaptive: it keeps a full progressive frame where the picture is static
and interpolates only where it moves.

**Sharpness alone is a trap — always measure combing too.** A variance-of-Laplacian score
counts comb lines as texture, so *disabling* deinterlacing scores best of all while looking
obviously worse. Measure the two independently:

```python
comb_ratio = mean(|2·row[y] − row[y−1] − row[y+1]|) / mean(|2·col[x] − col[x−1] − col[x+1]|)
# ~1.0–1.5 clean · >2.4 visibly striped
```

Build the A/B as a page of full frames **each with a 200% centre crop underneath** and look
at it. Combing is obvious by eye and ambiguous by metric.

### 4.7 Temporal deinterlacers need consecutive frames — `select` breaks them

**Failure this prevents:** `bwdif` placed *after* a `select` filter produced output
**byte-identical to no deinterlacing at all**, on all three test DVDs. It scored 214% sharp
with a comb ratio of 4.5 and was very nearly adopted as "the sharpest option".

`bwdif`, `yadif`, `w3fdif`, `estdif` and `nnedi` all need the frames either side of the one
they emit. Hand them a stream of unrelated moments — which is exactly what `select` produces
— and they silently degrade to spatial-only or pass through untouched. **`pp=lb` is purely
spatial and immune, which is why the bug stayed hidden while it was the default.**

Three call sites need care:

1. **Seek path (`-ss`)** — the first frame after a seek has no predecessor, so it falls back
   to spatial-only. Decode a few frames past the seek point and keep one with neighbours:
   `…,bwdif,select='eq(n\,4)',scale=…` and `-frames:v 1`. Costs ~4 extra decoded frames.

2. **Single-pass sweep** — keep a short *run* of consecutive frames at each sample point,
   deinterlace the run, then take its middle frame:
   ```
   select='lt(mod(n\,K)\,9)' , crop , bwdif , select='eq(mod(n\,9)\,4)' , scale , setsar=1
   ```
   Only 9/K of frames reach the filter, so the cost over plain selection is negligible.
   Timestamps shift by the window offset: `ts = (i×K + 4) / fps`.

3. **Targeted re-capture of specific frames** — select the union of 9-frame windows around
   each wanted frame, deinterlace, then select the middle of each window by its *position in
   the filtered stream*, not its original frame number. Merge overlapping windows first.

**QA gate:** after any change to the deinterlacer or the chain order, hash the output of the
deinterlaced variant against the no-deinterlace variant. **If they are byte-identical, the
deinterlacer did nothing.** This is a one-line check that would have caught it immediately.

---

### 4.8 Encode settings that must never vary

Consistency across artists depends on these being identical every run. Changing any of them
means the collection no longer matches itself, so treat them as fixed unless there is a
measured reason to change — and if one does change, **re-run every artist**, not just the
next one.

| Setting | Value | Why |
|---|---|---|
| Scaler | `flags=lanczos` | Sharpest of the practical resamplers; bilinear visibly softens |
| Deinterlace | `bwdif`, conditional on `field_order` | §4.6. Never applied to progressive sources |
| Sample aspect | `setsar=1` | Without it the browser re-stretches a correctly-scaled image |
| JPEG quality | `-q:v 2` | ffmpeg's scale is 2 (best) to 31. ~50 KB per SD frame |
| Pixel format | `-pix_fmt yuvj420p` | Full-range JPEG; `yuv420p` shifts levels and washes out blacks |
| Sharpening | **none** | An unsharp pass exaggerates DVD ringing and looks worse at card size |
| Denoise | **none** | Removes film grain and fine detail; the source is what it is |
| Colour | **untouched** | No auto-levels, no saturation — broadcasts differ, and that is authentic |
| Watermarks | **kept** | Broadcaster bugs, tickers and TV-PG marks are part of the recording (§9) |

Storage: at `-q:v 2`, four SD frames per show is roughly 200 KB. Across 831 shows that is
about 170 MB — acceptable for a repo that already ships the images. Do not lower quality to
save space; drop to three frames per show instead if it ever matters.

---

## 5. Duration and seeking — containers lie

### 5.1 Measure true runtime by demuxing

**Failure this prevents:** a 472 MB VOB reported `duration=13.87s` and `bit_rate=283 Mbps`.
Six of 21 shows reported near-zero runtime, which would stack every frame at t=0.

Trust the container only when its duration implies a sane bitrate — and check **both**
directions. An under-reported duration looks like an absurdly *high* bitrate; an over-reported
one looks like an absurdly *low* bitrate. One DVD claimed **53 hours**, which works out at
167 kbps, and sailed through a one-sided check:

```python
bps = total_bytes * 8 / reported
if reported > 1 and 4e5 < bps < 30e6:      # 0.4 - 30 Mbps
    use reported
else:
    ffmpeg -i SRC -c copy -f null -      # demux only, ~90x realtime
    parse the LAST "time=HH:MM:SS.ms" from stderr
```

The 13.87s VOB set measured **10:05**. A disc claiming 2 minutes was really **62**.

### 5.2 Single-pass fallback when seeking fails

**Failure this prevents:** even with the true runtime known, `-ss` seeks against the
container's *bogus* timestamps. Six shows produced **zero** usable frames — 783 rejects —
because every seek landed past the claimed end.

If the seek path yields `ok == 0`, retry with one decode pass selecting by frame number,
which sidesteps timestamps entirely:

```
-vf "select='not(mod(n\,K))',<rest of chain>" -vsync 0 -frames:v N
K = int(duration × fps) // N
```

Rename outputs to `t = (i × K) / fps` afterwards so timestamps stay meaningful.

**With a temporal deinterlacer this exact chain is WRONG** — `select` starves `bwdif` of the
neighbouring frames it needs and it silently stops working. Use the windowed form from §4.7
instead, and offset the timestamps by the window centre.

**The single-pass path must apply the same 5%/95% trim as the seek path.** The seek path
computes its timestamps inside `dur*0.05 … dur*0.95`; the fallback originally swept the whole
file from frame 0, so **opening logos and the closing credit roll became candidates**. Credits
score superbly — crisp white text is about the sharpest thing on a DVD — so they flood the
shortlist. On one show **nine of twenty-two shortlisted frames were end credits**. Restrict
the selection and offset the timestamps:

```
start = int(total * 0.05);  end = int(total * 0.95)
k     = max(1, (end - start) // n)
select='gte(n\,START)*lte(n\,END)*lt(mod(n-START\,K)\,9)'   # windowed, temporal deint
ts    = (start + i*K + 4) / fps
```

**QA gate:** print the first and last candidate timestamp per show and check both fall inside
the trim window. A show whose last frame is at 99% of runtime did not apply it.

**QA gate:** if any show finishes with 0 usable frames, the run is not complete.

**A worse variant: seeking that returns the SAME frame every time.** One DVD produced 500
valid, correctly-sized, byte-**identical** frames — timestamps spread properly across the
runtime, dimensions all correct, `ok == 500`, so neither the zero-frame fallback nor any
dimension gate fired. It only surfaced because de-duplication collapsed 500 candidates to 1.

Always verify **content distinctness** after the seek pass:

```python
distinct = len({md5(f.read_bytes()) for f in frames[:400]})
if distinct < max(2, len(frames[:400]) // 2):
    discard everything and use the single-pass path
```

Validity is not the same as usefulness. A check that only asks "did I get a file of the right
size?" will pass happily on 500 copies of one frame.

**This applies to targeted single-frame re-captures too.** Grabbing one replacement frame
from an affected DVD with `-ss` will silently produce nothing. Use the same frame-number
select, computing `n = round(timestamp × fps)` for just the frames you need:

```
-vf "select='eq(n\,1125)+eq(n\,22500)+eq(n\,55625)'" -vsync 0 -frames:v 3
```

Output arrives in **decode order**, not the order you listed - sort your targets by timestamp
before zipping them back to their labels.

---

## 6. Frame selection — why naive sharpness fails

**Global variance-of-Laplacian is the wrong metric.** A crowd of 50,000 faces is the busiest
texture in any frame, so it wins on sharpness. And a frame with a razor-sharp *background*
scores well even when the performer is smeared. In the first run, **30% of every shortlist
was crowd shots**, and frames scoring 92+ had visibly blurred drummers.

### 6.1 Tile the frame

Divide into 6×8 tiles; compute Laplacian variance per tile. Then:

- **subject focus** = max sharpness of the **central** region (excludes edge lighting rigs
  and audience). This is the "is the subject in focus" measure.
- **spread** = fraction of tiles above 45% of peak
- **quiet** = fraction of tiles below 15% of peak
- **lo_hi** = `log10(max_tile / min_tile)`
- **cv** = `std(tiles) / mean(tiles)`

**The signature:** a crowd is uniformly busy — *no calm regions anywhere*. A subject shot
always has quiet areas: dark stage, sky, lighting rig.

Measured separation on hand-labelled frames:

| Feature | Crowd | Subject | Separation |
|---|---|---|---|
| `lo_hi` | 1.72 | 2.95 | 1.26σ |
| `quiet` | 0.15 | 0.39 | 1.07σ |
| `cv` | 0.74 | 1.11 | 0.88σ |

```
subjectness = 0.38·min(1, lo_hi/3.4) + 0.30·min(1, quiet/0.55)
            + 0.20·min(1, cv/1.6)   + 0.12·(1 − min(1, edge_density/0.6))
crowd if subjectness < 0.60
```
→ blocks 100% of daylight crowds, costs ~22% of good frames. Absorb that with density (§7).

### 6.2 Night crowds and title cards need extra rules

Night crowds defeat §6.1 because dark gaps between people read as "quiet". Title cards score
superbly because crisp text on a clean background looks exactly like a focused subject.

Two cheap signals, measured on labelled frames:

```
lit_frac = fraction of pixels with luma > 26
flat     = fraction of 8×8 blocks with std < 3.0
palette  = distinct colours after 4-bit-per-channel quantisation

crowd   if palette > 520 and flat < 0.50        # clothing colour, no flat areas
graphic if (lit_frac < 0.11 or lit_frac > 0.93)
           and flat > 0.68 and palette < 400    # test BOTH luminance tails
```

Dark cards ("JOIN US @…") and bright cards ("LET THERE BE MUSIC") both occur — test both
tails. Gradient-background cards still slip through; reject those by eye.

### 6.2b The crowd test is calibrated on rock stages — relax it rather than weaken it

`subjectness < 0.60` assumes a lit performer against a dark surround. An **evenly-lit venue**
— an acoustic theatre, a daylight festival — has few dark tiles and low tile-contrast, so it
reads as "uniformly busy" exactly like a crowd. On the Alanis MTV Unplugged set it rejected
**83% of frames** (median subjectness 0.49) and left a shortlist of 11.

Do not lower the threshold globally; it is doing real work on the festival shows in the same
artist. Instead, **re-admit the best of what it rejected, but only when the show would
otherwise be starved**, and print what was relaxed:

```python
if len(rows) < want:
    spare = sorted([r for r in sharp if r["crowd"]], key=lambda r: -r["subjectness"])
    rows += spare[:(want - len(rows)) * 3]      # headroom for the de-dup pass
    print("CROWD TEST RELAXED to subjectness>=%.2f" % min(r["subjectness"] for r in ...))
```

Crowd-flagged frames short-circuit the score formula to **0**, so sort by
`(-score, -subject)` or the re-admitted ones land in arbitrary order.

**Derive the blur floor from non-crowd frames only.** Crowds are the busiest texture in any
show, so including them inflates the 95th percentile and tightens the floor for everything
else — the opposite of the intent. Getting this wrong cost one show 10 usable frames.

### 6.2c Blank and filler frames — palette is the only reliable signal

Discs carry more dead air than expected: black between segments on almost every DVD, and in
one case **minutes of solid green** where a low-resolution copy ran out.

None of the other tests catch these. `graphic` requires an extreme luminance tail, `crowd2`
requires a large palette, and a *grainy* monochrome field defeats both `flat` and `contrast` —
the green filler measured `flat 0.54` and `contrast 19.6`, indistinguishable from real
texture, because it came off VHS with noise on it.

What a blank frame cannot fake is having almost no distinct colours:

```
palette = distinct colours after 4-bit-per-channel quantisation
blank if palette < 90 or contrast < 4.0 or flat > 0.97
```

**Calibrate the threshold against labelled frames, don't guess it.** Across a mixed set
(bright studio, dark club, daylight festival, news graphics) the lowest palette on a genuine
frame was **109**; blanks measured **49** (grainy green), **21** (near-black) and **1** (pure
black). 90 sits in that gap with margin either side. Re-check the margin on any artist whose
sources are unusually dark.

Blank frames are dropped outright and **must never be eligible for the crowd relaxation**
(§6.2b) — a green field is not a shot of anything. Report the count that was dropped.

### 6.2d Off-air recordings contain COMMERCIALS

**Failure this prevents:** the Alice in Chains Unplugged disc is an off-air tape with the ad
breaks left in. Four commercials — a deodorant product shot, a beer logo, a cartoon, a car —
reached the 24-frame shortlist, because ads are bright, sharp, high-contrast and centrally
composed, which is exactly what the scoring rewards.

No cheap signal separates a commercial from a performance: both are real photographs of real
things. Treat it as a **review** obligation rather than a filter:

- Expect ads on anything sourced from broadcast tape rather than a disc master. A sidecar
  saying "VHS > DVDR" is the tell.
- Scan the contact sheet for frames that do not look like a stage, and discard them by eye.
- Say so in the hand-off. A pick that is secretly a deodorant advert is worse than a thin
  shortlist.

The related content traps in §10 (music-video compilations, awards shows, split bills) apply
to whole folders; this one applies **inside** a single show's runtime.

### 6.2e DARK shows need shot-scale diversity, not just score

**Failure this prevents:** two shows were handed over with **no close-up and no instrument shot
anywhere in the shortlist** — a night festival set and an unlit club broadcast. Nothing was
broken; the scoring did exactly what it was designed to do, and that was the problem.

Scoring rewards a sharp subject against a quiet background. On a lit stage that reliably
surfaces the performer. **On a dark show it inverts:** the brightest, highest-contrast frames
are wide shots of the crowd and the lighting rig, so a close-up of a face or a hand on a
fretboard — dim, low-contrast, small tonal range — loses on score every time. Rank by score
alone and the entire shortlist is wide shots.

The fix is not to re-weight the score, which would damage the shows where it works. It is to
**reserve shortlist slots by shot scale before filling the rest by score**:

```python
# conc = subject brightness / median tile. High when ONE region dominates the
# frame, which is what a close-up is.
n_close = max(4, top // 3)
for r in sorted(rows, key=lambda r: -r["conc"]):     # close-up reserve FIRST
    if len(keep) >= n_close: break
    if distinct(r, keep): keep.append(r)
for r in rows:                                        # then best by score
    if len(keep) >= top: break
    if distinct(r, keep): keep.append(r)
```

A third of the shortlist is reserved, so a close-up can never be crowded out by a brighter
wide shot. This runs on every show — it costs a well-lit show nothing, because there the
high-`conc` frames are close-ups that would have scored well anyway.

**Report darkness explicitly.** When the median frame luma is below 60, the run prints
`DARK SOURCE (median luma N) - M close-up slots reserved`, so the reviewer knows to expect a
harder shortlist and to check the briefs rather than trust the ranking.

**And never hand over a score-ranked shortlist as if it were picked.** Score order is a
starting point for review, not a substitute for it. If picks are auto-selected to save time,
say which shows they are — the ones where score and judgement diverge are exactly the ones the
reviewer will notice.

### 6.3 Adaptive blur floor

Sharpness scales with resolution and bitrate, so an absolute cutoff guts SD sources and
passes soft HD ones. Judge each show against itself:

```python
floor = max(250.0, 0.35 * percentile([r.subject for r in rows], 95))
```

### 6.4 De-duplicate

dHash each frame; require Hamming distance ≥12 between kept frames so the shortlist isn't
four views of the same two seconds.

---

## 7. Density — how many candidates

**One frame per 5 seconds of runtime, floor 120, cap 500.**

Started at 1-per-15s; tripled it specifically to absorb aggressive crowd rejection. Net
result: ~2.3× more usable subject frames than the conservative pass, with zero crowds.

- Skip the first and last 5% (logos, credits, black).
- ~7,500 frames for 21 shows ≈ **600 MB** and **~45 minutes** at 3 workers.
- Keep the top **24** per show after filtering.

**QA gate:** every show must retain ≥24 usable frames. If one is starved (<30), say so —
don't hand over a thin shortlist silently.

---

## 8. Verification gates — run ALL of them

Before capture:
1. **SAR/DAR agree** — `(w × SAR)/h` equals declared DAR within 1%
2. **Target sane** — ≥320×240
3. **Aspect plausible** — between 1.15 and 2.60
4. **Cross-check `shows.json`** — disagreement is a *flag*, not a blocker (the drive wins)

After writing each frame:
5. **Re-open the JPEG** — actual pixel dimensions must equal the computed target exactly
6. **Final aspect assertion** — within 1% of DAR
7. **Per-show consistency** — every frame from one show shares identical dimensions
8. **No downsampling** — `target_w ≥ width` and `target_h ≥ height` (§4.1). A target smaller
   than the stored frame on either axis means the geometry rule has regressed.
9. **The deinterlacer actually ran** — on interlaced sources, output must NOT be
   byte-identical to the same frame rendered with no deinterlacer (§4.7), and comb ratio
   should sit below ~1.6.

Any frame failing 5–7 is **deleted and logged**, never kept. Report the count.
Gates 8–9 are cheap spot-checks; run them on one frame per show, not all 500.

**Final audit:** re-open every surviving frame and assert dimensions per show. Target:
`0 wrong dimensions`.

---

## 9. Shot briefs and review

Default briefs (adjust per user):

| Brief | Meaning |
|---|---|
| A | Close-up of the singer |
| B | Close-up of multiple band members |
| C | Wide stage shot, whole band |
| spare | Best remaining — often hands on guitar/drums |

- The **subject need not have a face.** Hands on a fretboard, a body shot, a silhouette all
  count. Say so when briefing any automated stage.
- **Watermarks stay.** Broadcaster bugs (MTV, palladia, WDR), tickers and TV-PG marks are
  part of the authentic recording. Never crop or clone them out.
- Build **one contact sheet per show** (5-wide grid, 24 frames, each labelled with index,
  timestamp, score and subject sharpness). Review the sheet, not 300 individual frames.
- Publish a **self-contained HTML index** of all sheets, and a **picks page** showing the
  chosen frames as actual images. Never report picks as bare index numbers — they're
  meaningless to anyone not looking at the same sheet.

### Pick filenames must be unique per RECORD, not per folder

**Failure this prevents:** pick files were named from `FolderName` truncated to 44 characters.
Two records split out of one folder share that prefix — `Alanis Morissette - MTV Unplugged
1999 (Pete` for both the Unplugged show and the Canada Day show — so **the second show's picks
silently overwrote the first's**. Only 12 of 16 files existed, and the run still reported
`resolved 16`, because a copy that destroys an earlier file is still a successful copy.

Two fixes, both needed:

1. Put the **ShowID** in the filename. The folder no longer identifies the show (§10b).
2. **Count files on disk, not successful copies**, and fail loudly when they disagree:

```python
on_disk = len(list(out.glob("*.jpg")))
if on_disk != ok:
    print("FILENAME COLLISION: %d resolved but only %d files exist" % (ok, on_disk))
    return 1
```

This is §15 in miniature: the tally being checked was the one the bug could not affect.

### Each pick in a show needs a DISTINCT brief tag

**Failure this prevents:** the brief tag is the label's first token, so swapping which pick is
the hero by relabelling both entries "B …" makes both write `__B.jpg`, and one silently
destroys the other. 20 picks resolved, 18 files on disk.

The file-count guard above catches the symptom; check the cause explicitly too:

```python
tags = [label.split()[0] for label, _ in sel]
dup  = [t for t in set(tags) if tags.count(t) > 1]
if dup: print("DUPLICATE BRIEF TAG %s in %s" % (",".join(sorted(dup)), frag))
```

When re-ordering picks, change the **labels** as well as the timestamps: the hero entry must
begin with `A`, whatever it depicts. `"A  multiple members (hero)"` is right;
`"B  multiple members (hero)"` silently loses a pick.

### Record picks by TIMESTAMP, not sheet index

**Failure this prevents:** picks were recorded as "#5", then the shortlist was re-scored and
the numbering shifted. Four picks silently pointed at different frames. Timestamps survive
re-scoring; indices do not.

Store as `{show_fragment: [[label, "HH-MM-SS"], …]}` in a JSON file, and **assert every pick
resolves to an existing file**, reporting `UNRESOLVED` loudly rather than dropping it.

---

## 10. Content traps — not every "show" is a concert

Check what a folder actually contains before picking. Real examples from one artist:

| Folder | Reality |
|---|---|
| `… - Video Hits` | Music-video compilation. No stage, no live performance. |
| `… - Last Call` | A whole TV episode featuring **another artist**; the band appear for ~4 min. |
| `… - EMAs` | Full awards broadcast; the band appear once, accepting an award. |
| `… + <Other Band> - <Festival>` | **Split bill** — most frames are the other band. |

For these: capture a **targeted time window** around the band's segment rather than the whole
runtime, and tell the user the folder is mislabelled. Flag it for metadata correction.

**Picking rule for compilations and split bills: only the target artist counts.** Frames of the
other act, the interview segments, the host or the awards ceremony are all rejected regardless
of how well they score. If that leaves fewer than four usable frames, say so and promote fewer
rather than padding with someone else's band.

**Read the footage for ground truth.** Broadcast overlays routinely contradict the folder name
and are more reliable than it. Two folders in the reference run were wrong in both halves of
their title, and the on-screen captions gave the correct venue, city and second artist
outright. Always check the credits, lower-thirds and title cards before trusting a folder.

---

## 10b. One folder, several shows — detection, verification, splitting

Expected to affect **10–20 folders collection-wide**. Both Alanis Morissette folders turned
out to hold two shows each, and in one of them the existing record described the *wrong* one.

### Why it is invisible

The scan records **one row per folder**, and `ChecksumSHA1` is computed from "representative
media" — the DVD's `VTS_*_[1-9].VOB` in order, otherwise the single largest video file. When
a folder holds two concerts:

- only one of them is described by the row;
- the other has no ShowID, no checksum, no images, and **cannot appear on the site at all**;
- the row's metadata can be a *blend* of both, with no field flagged as uncertain.

Worked example — `Alanis Morissette - 1996-06-29`, one record:

| Field | Value | Where it actually came from |
|---|---|---|
| `ShowDate` | 1996-04-01 | the **Munich** show |
| `FolderName` | 1996-06-29 | the **Hyde Park** show |
| `City, Country` | Friesland, Germany | **the uploader's home town**, from the NFO header |
| `ChecksumSHA1` | ca5b604f… | `VTS_01` only — the Munich show |

Three fields, three different sources, one of them not a venue at all. Nothing in the record
suggested a problem.

Second folder, `MTV Unplugged 1999 (Pete)`: six titlesets. `VTS_01`–`05` are one 44-minute
acoustic theatre show; `VTS_06` is a **different Canadian TV broadcast** (13 min, different
bitrate, different outfit, `CBC`/`CHEX TV DURHAM` bug instead of `MUCH`). The pipeline picked
the largest file — `VTS_06` — so **the record titled "MTV Unplugged 1999" is keyed to the
footage that is not MTV Unplugged.**

### Step 1 — Detect (cheap, no file contents read)

```bash
python3 find_multishow.py                 # whole drive
python3 find_multishow.py --artist alanis
```

| Signal | Weight | Why it matters |
|---|---:|---|
| >1 substantial DVD titleset | 3 | Strongest structural hint. Not proof — see below |
| Record's `RepVideoFiles` covers only some titlesets | 3 | The uncovered ones are uncatalogued footage |
| Date in folder name ≠ record's `ShowDate` | 2 | Classic blended-metadata signature |
| >1 year in the folder name | 2 | e.g. `… 1994 + 1999` |
| NFO / txt / md5 / cue sidecar present | 1 | Often names the contents outright |
| ≥2 titlesets estimated ≥20 min each | 2 | Two full sets, not a clip reel (see below) |
| No long titleset and ≥4 of them | −2 | Demotes clip reels out of the way |

**Multiple titlesets is NOT proof of multiple shows.** Plenty of DVDs author a single concert
as several titles. In the Unplugged folder five titlesets were one show and the sixth was
another. Structure *suggests*; only content decides.

The commonest false positive is a **clip reel**: `VA Late Night #6 2005` has thirteen
titlesets, but they are thirteen three-minute TV spots, not thirteen concerts. Those belong
to the §10 content traps, not here. The detector separates the two by estimating each
titleset's runtime from its size at a nominal 7.5 Mbps (measured 7.25–9.56 across this
collection — ±25%, ample to tell a 3-minute clip from a 45-minute set, and no file contents
are read):

| Class | Rule | Meaning |
|---|---|---|
| `MULTI-SHOW LIKELY` | ≥2 titlesets estimated ≥20 min | Genuine candidates — verify these first |
| `one main set + extras` | 1 long + short ones | Usually one show plus bonus footage |
| `clip reel / compilation` | no long titlesets, ≥4 of them | §10 territory, not a split |
| `unclear` | anything else | Needs eyes |

On this collection: 95 folders flagged, of which **20 classify as `MULTI-SHOW LIKELY`**. Seven
of those twenty announce it in the folder name itself — `… 2003-05-01 PRO #1 + 2002-09-12
PRO #1`, `Greenday + Foo Fighters`, `Bizarre Festival + Phoenix Festival`, `… (x2)`. A folder
name containing `+` between two dates, two festivals or two artists is worth treating as a
strong signal in its own right.

```bash
python3 find_multishow.py --min-score 3 --kind "MULTI-SHOW LIKELY"
```

### Step 2 — Verify, in order of authority

1. **Read the sidecar first.** `EXTRAS_TS/*.txt`, `*.nfo`, `.md5`, the `.torrent` filename.
   Fan-made DVDs routinely document every show, with per-show setlists and exact lengths.
   This is the cheapest and most informative evidence available — read it before running
   anything.

   **But a sidecar is a CLAIM, not a verdict.** One disc's sidecar advertised "Extras: MTV's
   2004 Movie Awards Performance"; the titleset is actually a 24-minute music-video block with
   a one-minute live insert. A record was created on the strength of that line and had to be
   deleted. **Never create a record from a sidecar alone — sample the frames for that titleset
   first.** The sidecar tells you where to look; the frames decide what is there.
2. **Measure each titleset separately** (`titlesets.py`) and check the arithmetic against the
   sidecar. Munich claimed 46:04 and measured 46:00; Hyde Park claimed 32:55 and measured
   32:52; the total matched 78:59 to within six seconds. Ratios that line up like that
   settle which titleset is which.
3. **Grab frames from every titleset** — start, middle and end (`identify_titlesets.py`).
   Compare venue, staging, lighting, clothing and **broadcaster bug**. The bug is often the
   single most decisive pixel on screen: `N3` vs `Premiere` proved two different broadcasts
   of two different concerts; `MUCH` vs `CBC/CHEX TV DURHAM` did the same in the other folder.
4. **Continuity test across the boundary.** Compare the END of `VTS_N` with the START of
   `VTS_N+1`. Same song, same staging, same shot grammar → one show split across titles.
   Different venue or bug → separate shows.
5. **Corroborate externally** — 2+ independent sources for date, venue and event, exactly as
   for any metadata (setlist.fm, Last.fm, Concert Archives, published reviews).

**The footage identifies itself more often than expected.** Four things to look for, all of
which resolved real questions on the Alanis discs:

| Evidence | Example | What it settled |
|---|---|---|
| Broadcaster bug | `N3` vs `Premiere`; `MUCH` vs `CBC`/`CHEX TV DURHAM` | Two different broadcasts = two different shows |
| — but see below | an `MTV` bug over the Letterman marquee | The bug names the CAPTURE SOURCE, not the programme |
| Credit roll | *"Recorded At THE BROOKLYN ACADEMY OF MUSIC, HARVEY THEATER"* | Exact venue, including the room |
| Song title cards | *"uninvited"*, *"King of Pain"* | Confirmed the titleset grouping matches the setlist |
| Landmarks and banners | Parliament Buildings + Peace Tower; a banner reading *"MASTERS OF MUSIC … 29th"* | Identified an unknown show's venue and event outright |

A show with no title card is not necessarily unidentifiable — one titleset was catalogued as
"unidentified" until wide shots revealed the Canadian Parliament Buildings and a presenter
segment staged in front of a giant maple leaf, which together with the CBC bug make it Canada
Day on Parliament Hill. **Identify the venue and event from what is provable, and still leave
the date empty if the year cannot be sourced.** Partial identification beats both a guess and
a blank.

**A broadcaster bug identifies the capture, not necessarily the programme.** A bug is decisive
when comparing two titlesets *within one folder*: different bugs there mean different broadcasts.
It is NOT proof of what the programme is. A compilation assembled off-air carries whatever
channel each clip was taped from — an Audioslave performance on the Ed Sullivan Theater marquee
for *Late Show with David Letterman* carried an **MTV** bug throughout, because that copy came
from MTV. The marquee in shot settled it; the bug would have misled.

Use bugs to tell segments apart. Use what is IN the frame — a venue sign, a stage backdrop, a
caption — to say what the segment is.

Encode parameters are a useful secondary tell: `VTS_01`–`05` all sat at 9.56 Mbps while
`VTS_06` sat at 7.82 Mbps. A bitrate or geometry change mid-folder means a different
authoring session, which usually means different source material.

### A TITLESET BOUNDARY IS NOT A SHOW BOUNDARY

**Failure this prevents:** one MuchMusic *Intimate & Interactive* broadcast was split into
**three** separate records, then a fourth titleset was nearly split off as well. The disc simply
chaptered one hour-long programme across five titlesets, and every boundary looked like a new
show. The user caught it twice.

The trap is that a magazine-format broadcast genuinely changes appearance across a single
programme: live performance, then viewer calls, then a pre-recorded insert with its own title
card. Each looked like a different show. One insert even carried a **VANCOUVER** caption, which
produced a record for a Vancouver concert that never happened — it was a Speakers Corner segment
played into a Toronto studio broadcast.

**Structure suggests; continuity decides.** Before splitting, check whether these hold ACROSS
the boundary:

| Signal | Same show if… |
|---|---|
| Presenter | same person, **same clothing** |
| Microphone / bug | same station flag on the mic, same corner bug |
| Caption house style | `CALLER: Name, Town, PROV` in the same typeface throughout |
| On-screen furniture | same phone number, email, hashtag |
| Set and audience | same room, same crowd |

Any one of those persisting across a titleset boundary means one programme. The clothing test is
the cheapest and was decisive here: the same presenter in the same metallic top appeared in
three "different shows".

A pre-recorded insert with its own title card is **part of the programme it appears in**, not a
separate show — however emphatically the card names another city.

### After splitting, RENAME THE ORIGINAL RECORD TOO

**Failure this prevents:** splitting produced new records named for their titleset
(`… (VTS_01 - Hard Rock Cafe)`) while the original kept the whole-folder name
(`… HBO Reverb + Hard Rock Cafe`). Listed together they read as duplicates — the original
appears to contain everything its siblings also claim.

Every record from a split must name **only the part it covers**, the original included:

```
Bush - HBO Reverb + Hard Rock Cafe   →  Bush - HBO Reverb (VTS_02)
DVD 1                                →  DVD 1 (VTS_01-02 - Much Music Intimate & Interactive)
Bush - Woodstock 99                  →  Bush - Woodstock 99 (Bush set)
```

### Step 3 — Decide which record keeps the original checksum

**The record that keeps the original `ChecksumSHA1` must be the show whose files were
actually hashed.** Read `RepVideoFiles` — it lists them explicitly. Confirm by recomputing:

```bash
python3 titleset_checksums.py "<folder name>"
```

`VTS_01`'s hash came back byte-equal to the existing record's checksum, proving that record
*is* the Munich show whatever its other fields claimed. **Never move a checksum to a
different show to make the metadata look tidier** — the checksum is the key that images are
filed under, and it is the one field that is verifiable from the drive.

### Re-keying a record ORPHANS its old images

**Failure this prevents:** resolving a temp-checksum stub changed a record's `ChecksumSHA1`
from the placeholder to a real content hash. The images filed under the *old* checksum stayed
on disk and in the manifest, now referenced by no record at all — invisible on the site,
counted by nothing, and never cleaned up. Promotion's own post-flight passed, because it
checks manifest-vs-disk and both still agreed.

Whenever a checksum changes — a resolved stub, a corrected mis-key, a split — audit for
manifest entries that **no record references**:

```python
recs = {s["ChecksumSHA1"] for s in shows if s.get("ChecksumSHA1")}
orphans = [k for k in manifest if k not in recs]
```

Delete the files and the manifest entry, but **only after asserting the checksum is genuinely
unreferenced**. `scripts/audit-image-geometry.py` reports these as `no show record`.

### Step 4 — Key the new record

**Prefer a real content hash.** When the shows are separable at file level — distinct
titlesets, distinct files — compute the new record's `ChecksumSHA1` from *its own* files
using the pipeline's algorithm. It is a genuine content hash and behaves like every other key
in the collection.

Only when two shows share one inseparable file (a single continuous VOB) fall back to a
derived key, and say so plainly in `Notes`:

```python
ChecksumSHA1 = sha1((primary_ck + "|" + discriminator).encode()).hexdigest()   # NOT content
ShowID       = sha1((folder_path + "|" + discriminator).encode()).hexdigest()[:12]
```

The discriminator is whatever separates the shows — the date, the venue, or the artist for a
split bill. Use the same value in both derivations.

### Step 5 — Write the records

- Both records keep the **same `FolderPath`**. That is the truth: the files really do live in
  one folder.
- Give each a **distinct `FolderName`** where possible, so the two are tellable apart in any
  list, and record the titleset in `Notes`: *"VTS_02 of a two-show disc; VTS_01 is
  <other show> (ShowID …)."* Cross-reference both ways.
- Populate `Width`/`Height`/`AspectRatio`/`TVStandard`/`DurationSec` from **that titleset's**
  ffprobe output, not the folder's. Two shows on one disc can differ in every one of them.
- Each record gets **its own stills, captured from its own titleset**. Never share images
  between the two — they are different concerts.

### Step 6 — Promotion must not resolve by FolderName

`promote.py` used to key records by `FolderName` in a dict comprehension. Two records sharing
a folder meant one **silently overwrote** the other and the wrong show got the images. It now
accepts a **ShowID** (12 hex) or checksum (40 hex) in `promote_map.json`, and treats any
ambiguous match as an error rather than a guess:

```json
{ "1996_06_29_VTS01": "3395c78f1ad2",
  "1996_06_29_VTS02": "a1b2c3d4e5f6" }
```

For same-artist splits, `[FolderName, Artist]` is **not** enough to disambiguate. Use ShowIDs.

### Excluding folders: `data/exclude.json`

Some folders should never be planned at all. List their basenames:

```json
["Beastie Boys 2004-06-09",
 "Beastie Boys 1999-05-03 - SECC, Glasgow, Scotland [PRO]",
 "Beastie Boys - Fight for Your Right Revisited …ts"]
```

Two cases justify it:

- **A byte-identical duplicate copy** of a folder already covered by a record. Capturing it
  decodes gigabytes twice and produces a second set of stills nothing will ever use. Confirm
  the duplication first — sample-hashing size plus the first and last 32 MiB of every VOB is
  decisive without reading the whole file.
- **Material that is not a performance** — a narrative short film, a documentary — where the
  user has decided it gets no record.

Excluded folders are printed at plan time so the omission is visible, never silent.

### Step 7 — Capture each show from its OWN titleset

A split folder must be captured as **one unit per show**. Capturing the folder as a whole
draws candidate frames from both concerts at once, and each record then gets stills of the
wrong show — with nothing downstream to catch it, because every frame is valid, correctly
shaped and correctly deinterlaced.

Declare the split in `data/splits.json`, keyed by the folder's basename on the drive:

```json
{
  "Alanis Morissette - 1996-06-29": [
    {"vts": ["01"], "showid": "3395c78f1ad2", "label": "Munich 1996-04-01"},
    {"vts": ["02"], "showid": "53ab1e48902a", "label": "Hyde Park 1996-06-29"}
  ],
  "Alanis Morissette - MTV Unplugged 1999 (Pete)": [
    {"vts": ["01","02","03","04","05"], "showid": "edf18a8aa29e", "label": "MTV Unplugged 1999"},
    {"vts": ["06"], "showid": "1b855d937789", "label": "unidentified CBC broadcast"}
  ]
}
```

Three selectors, which compose:

| Selector | Use when |
|---|---|
| `vts` | Shows are separate **titlesets** (`VTS_01` vs `VTS_02`) |
| `vobs` | One titleset **mixes geometries or sources** — name the good files (§4.1d) |
| `from` / `to` | Shows share one continuous stream and can only be separated by **time** |

Accepts `90`, `"1:30"` or `"00:01:30"`. A time window narrows the show **before** the frame
budget and the plan display are computed, so both describe the segment actually being
captured — otherwise a 6-minute extract is given a 500-frame budget meant for an hour.

`plan` expands each listed folder into one capture unit per entry. Each unit gets:

- a `concat:` source restricted to **that entry's titlesets only**;
- its own probe, so two shows on one disc can differ in geometry, field order and runtime —
  they often do;
- a work-directory key derived from `<rel>#VTS01-02`, keeping units distinct (§2);
- the **ShowID carried explicitly**, because name matching cannot separate two shows that
  share a folder.

A titleset group is captured as one unit when the shows were authored across several
titlesets — `VTS_01`–`05` above are one continuous performance and belong together.

**Every entry must name a ShowID that exists in `shows.json`.** A missing or mistyped ID is
reported and that unit is skipped rather than silently captured against the wrong record.

Promotion then keys on those ShowIDs (§10b step 6), not on `FolderName`.

### What NOT to do

- Do not split on runtime, file count or titleset count alone.
- Do not invent a date for footage you cannot identify. Leave `ShowDate` empty and say so —
  `VTS_06` above is a confirmed separate show whose date and programme are still unknown.
- Do not delete or re-key the existing record to "clean up". Fix its metadata in place and
  add the missing show alongside it.
- Do not let the two records share images.

---

## 11. Output naming and promotion

| Stage | Naming |
|---|---|
| Candidates | `work/<key>/<key>_c###_tHH-MM-SS.jpg` |
| Picks (staged) | `picks/<Folder Name truncated>_<ShowID[:6]>__<A|B|C|spare>.jpg` |
| Promotion (only on request) | `{ChecksumSHA1}_01.jpg` … `_04.jpg` |

### Promotion procedure (`promote.py`) — the only step that writes to the repo

**Preconditions — refuse to run unless ALL hold:**
1. Baseline audit clean: 0 manifest entries without files AND 0 files without manifest entries
2. Every show maps to a **confirmed** `shows.json` record — a hand-checked table, never a guess.
   Name matching alone mapped 14 drive folders onto 7 records in the reference run.
3. `git status` clean, so the diff is reviewable
4. Dry run first; `--apply` is a separate, explicit flag

**Per show:**
1. Back up every existing `{checksum}_*.jpg` plus its old manifest entry to a ledger
2. Write picks to `{checksum}_01.jpg` … `_0N.jpg` in brief order (A, B, C, spare)
3. **Delete every `{checksum}_0M.jpg` where M > N.** This is the orphan step — it bites
   whenever the new pick count is lower than the old one.
4. Set `manifest[checksum] = [1..N]` exactly — contiguous, no gaps. (One show in the
   reference run had `[1, 2, 4]`; this normalises such gaps.)

**Post-conditions — verify GLOBALLY, not just on what changed:**
- 0 manifest entries without a file
- 0 files without a manifest entry
- **`shows.json` byte-identical** — promotion writes images and manifest only
- per-show disk slots == manifest slots
- `scripts/health-check.py` passes
- Exit non-zero and stop if any check fails

**Do NOT promote a show if it would reduce quality.** In the reference run two discs yielded
only one usable frame each (the band appeared briefly on someone else's programme), which
would have replaced three good images with one. Skip, report, and re-capture a targeted
window instead.

**Rollback:** restore files from the backup ledger and revert the manifest entries.

### `public/` is gitignored — ALWAYS `git add -f`

**Failure this prevents:** promotion added two new `_04.jpg` files (shows that went 3 slots
to 4). `public/` is in `.gitignore` while its files are tracked, so `git add public/images/`
staged **zero additions** — the new files were silently skipped while the manifest declared
slot 4. Committed as-is, the deployed site would 404 on both images. Every local check
passed, because `health-check.py` inspects the **disk**, not git.

Always finish with:

```bash
git add -f public/images/ public/image-manifest.json
```

**The same trap applies to this skill's own directory.** `.gitignore` also lists
`.claude/skills/`. Files already tracked show up as modified, so edits to `SKILL.md` or
`shots.py` commit normally — but any **new** bundled script (`repick.py`, a new helper) is
silently invisible to `git add`. It looks committed, and the skill is then broken for anyone
who clones. Whenever a file is added to the bundle:

```bash
git add -f .claude/skills/concert-screenshots/
```

Verify with `git status --porcelain` showing nothing left, **and** `git ls-files` listing
every file in the directory. Two gitignored-but-tracked directories, one habit.

**Then verify against git, not the filesystem:** every manifest entry must map to a file that
is tracked *or staged*. A disk-only audit cannot catch this class of bug.

---

## 12. Pruning

Only after picks are locked **and verified to resolve**:

- **Keep:** every picked frame + the top-24 shortlist per show + all contact sheets.
- **Delete:** all other candidates.

Reference run: 7,509 frames / 598 MB → 506 frames / 36 MB. Keeping the shortlist means picks
can be revised without re-capturing.

### `picks/` is the source of truth for promotion — never `work/`

**Failure this prevents:** promotion originally resolved each pick by globbing `work/` for a
timestamp. Pruning `work/` afterwards broke it completely — the next promotion run resolved
nothing. (The guard caught it: 0 promoted, nothing damaged.)

`work/` holds disposable candidates. `picks/` holds the locked, named selections. Promotion
must read `picks/<Folder Name>__<A|B|C|spare>.jpg` and only fall back to `work/` if absent.

### `picks/` is not cleared between runs — remove stale files

**Failure this prevents:** after a show was re-split and renamed, `picks/` held **68 files where
52 were expected**. The extras were the previous run's picks under their old names, and they
would have been promoted alongside the current ones.

The file-count guard originally only understood "fewer than expected". It must handle both
directions: fewer means picks were lost to a name collision; more means stale files from an
earlier run. Track what the current run actually wrote and delete the remainder by name.

### Re-materialise `picks/` whenever `picks.json` changes

Picks chosen *after* the picks page was last generated exist only as timestamps in JSON —
there is no image on disk yet. If `work/` has since been pruned, they cannot be resolved at
all and must be re-captured from source. **Always regenerate `picks/` immediately after
editing `picks.json`,** and assert every entry produced a file.

---

## 12b. Re-rendering already-chosen picks (`repick.py`)

When capture *settings* change — geometry, deinterlacer, crop — the selections are still
valid but the pixels are stale. `repick.py` re-renders exactly the frames already listed in
`picks.json` at the current settings, without re-scoring or re-choosing anything.

**The trap it exists to avoid:** pick timestamps are stored floored to whole seconds
(`t00-53-04`). Re-deriving a frame number as `round(seconds × fps)` can land up to a full
second — ~25-30 frames — from the frame that was actually chosen, which is easily a different
moment on stage. Instead, recover the exact frame by fitting `ts = a·i + b` across that
show's existing `work/` filenames, since that linear relationship is what generated the
timestamps in the first place:

```python
a, b = numpy.polyfit(indices, floored_seconds + 0.5, 1)   # +0.5 de-biases the floor
frame = round((a * i + b) * fps)
```

Then render with the §4.7 windowed chain, merging overlapping windows, so a temporal
deinterlacer still has neighbours.

```bash
python3 repick.py            # dry run: renders to _repick/, verifies, reports comb ratios
python3 repick.py --apply    # copies into work/ under the ORIGINAL filenames
python3 shots.py --artist "<Artist>" picks   # re-materialise picks/ + rebuild the page
```

Renders are cached per show, so the dry run costs the decode and `--apply` is free. Both
steps verify dimensions via `shots.verify()` and reject anything mis-shaped.

**Always produce a before/after page** — old and new side by side with pixel counts,
sharpness and comb ratio per frame — and look at it before promoting. Numbers alone have
already been wrong twice on this pipeline.

### VERIFY EVERY REPORT'S LINKS BEFORE OPENING IT

Report pages are written into `reports/` but reference scratch directories that are
**siblings** of `reports/` — so every path needs a `../` prefix. Omitting it produces a page
where every image is broken. The author never notices, because the author does not open the
page; the reviewer opens it and finds nothing there.

```bash
python3 check_report_links.py            # all reports
python3 check_report_links.py reports/x.html
```

Run it before every `open`. It exits non-zero if anything is missing. This has failed twice:
once when archiving moved `picks/` out from under eight pages, and once by writing
`ident/…` where `../ident/…` was needed.

---

## 13. Shows the original scan never catalogued

**Loose media files at the drive root are systematically missing.** The scan pipeline walks
*folders*; a `.ts` or `.mkv` sitting at the top level is never catalogued, so it cannot appear
on the site at all. In the reference artist this accounted for **5 of 22 shows** — nearly a
quarter — all invisible. Check for these on every artist.

To create a record, match the pipeline's own algorithms exactly:

```python
ShowID       = sha1(str(full_folder_path)).hexdigest()[:12]
ChecksumSHA1 = sha1(concatenated representative media, in order).hexdigest()
#   representative media = the DVD's VTS_*_[1-9].VOB segments in order,
#   otherwise the single LARGEST video file in the folder
```

Populate the technical fields from `ffprobe` (container, codecs, width, height, duration,
`AspectRatio` as `"<DAR> (native)"`, `TVStandard` from frame rate), `FileCount` and
`TotalSizeBytes` from the filesystem. Leave `Setlist` blank. Record any uncertainty in `Notes`
rather than inventing a value; use the `YYYY-01-01` convention when only the year is known.

**Validate before writing:** `ShowID` unique, `ChecksumSHA1` unique, `ShowDate` either empty
or exactly `YYYY-MM-DD`, and the record count increases by exactly the number added.

### Split bills need a DERIVED checksum

One folder holding two artists' sets needs **two records** so each act appears under its own
name with its own stills. But images are keyed by `ChecksumSHA1`, and in the reference
collection **no checksum is shared by two records** — sharing one would give both acts
identical pictures and break that invariant.

Give the second record a derived key and say so plainly in `Notes`:

```python
derived = sha1((primary_checksum + "|" + artist).encode()).hexdigest()
ShowID  = sha1((folder_path + "|" + artist).encode()).hexdigest()[:12]
```

Document that it is **not a content hash**, so nobody later mistakes it for a scan artefact.

---

## 14. Scoping an artist cheaply before capturing

Before running the pipeline, audit what is actually wrong. Compare each existing image's pixel
aspect against its show's recorded `AspectRatio` — seconds of work, no video decoding:

```python
with Image.open(img) as im: w,h = im.size
declared = parse "<n>:<d>" from show["AspectRatio"]
squashed = abs(w/h - declared) / declared > 0.02
```

In the reference collection roughly **75% of all images** failed this test — stored at raw
pixel dimensions (720×576 shown at 1.250:1 rather than 1.333:1). Use it to decide which
artists are worth doing and to prove the improvement afterwards.

---

## 15. Never write a check that can fail silently

**Failure this prevents:** a re-capture helper was written as

```python
if out.exists():
    print(...)          # prints dimensions and OK/MISMATCH
```

When ffmpeg failed, the file never appeared, the branch never ran, and the script produced
**no output at all** — reading as success. The real error (broken-container seeking) was
invisible.

Every verification must have an explicit failure branch that prints, and every batch must
report counts that add up: `attempted == succeeded + failed`. Prefer asserting the total over
eyeballing a list.

---

## 16. End-to-end QA checklist

- [ ] Staging directory is outside the repo and outside the drive; assertion in place
- [ ] Work-dir keys unique — `len(set(keys)) == len(keys)`
- [ ] Every show has a plausible duration (no zeros; demuxed where the container lied)
- [ ] Interlaced shows deinterlaced; progressive shows untouched
- [ ] Every show's target dimensions derived from SAR, not assumed
- [ ] Target is never SMALLER than the source on either axis (§4.1 — no downsampling)
- [ ] Output size is one of the eight canonical sizes (§4.1b), or the source is unusual
      enough to justify a new one — say which
- [ ] All slots within a show share one size
- [ ] Encode settings unchanged from §4.8 (lanczos, `-q:v 2`, `yuvj420p`, `setsar=1`,
      no sharpen/denoise/colour)
- [ ] Deinterlacer demonstrably ran — output NOT byte-identical to the undeinterlaced frame,
      comb ratio below ~1.6 on a normal shot (§4.7)
- [ ] Suspicious aspect flags (SD 4:3 dated ≥2008, non-standard ratios) visually verified
- [ ] EVERY override created this session mirrored into its `shows.json` record, with the
      evidence in Notes — the override fixes capture, the record is what the collection knows
- [ ] `scripts/audit-aspect-vs-source.py --artist "<name>"` run; disagreements resolved
- [ ] Letterbox checked at ≥2 timestamps
- [ ] Full-collection dimension audit reports **0 wrong dimensions**
- [ ] No show finished with 0 usable frames
- [ ] Seek pass produced DISTINCT frames (not N copies of one) — check content hashes
- [ ] Every show retains ≥24 candidates after filtering (flag any that don't); a relaxed
      crowd threshold or a STARVED marker is reported, never silent
- [ ] Candidate timestamps fall inside the 5%/95% trim window on BOTH capture paths (§5.2) —
      no opening logos, no end credits in the shortlist
- [ ] Blank/filler frames dropped, and the count reported (§6.2c)
- [ ] Any titleset whose reported geometry looks implausible for its size/bitrate has been
      probed VOB-by-VOB for mixed geometry (§4.1d)
- [ ] No unit's source list reaches into a nested disc — check any folder with subfolders
      that contain their own VIDEO_TS (§4.1c-2)
- [ ] Every planned runtime is plausible for the media size; an absurd one means the SOURCE
      LIST is wrong, not merely the duration
- [ ] Contact sheets built for every show
- [ ] Picks recorded by timestamp and **all resolve** to files
- [ ] Pick FILE COUNT ON DISK equals the resolved count — no filename collisions (§11)
- [ ] Every pick in a show has a distinct brief tag (A/B/C/spare) — a duplicate silently
      overwrites (§11)
- [ ] Shortlists reviewed for COMMERCIALS on any off-air source (§6.2d)
- [ ] Every shortlist contains at least one CLOSE-UP and one instrument/detail frame — on dark
      sources score alone will not produce them (§6.2e)
- [ ] Any show marked DARK SOURCE reviewed against the briefs, not accepted on rank
- [ ] Picks page shows real images, not index numbers
- [ ] Content traps identified and reported (compilations, split bills, awards shows)
- [ ] `find_multishow.py` run for this artist; every hit resolved or explicitly cleared (§10b)
- [ ] EVERY new record's titleset sampled visually BEFORE the record is written — a sidecar
      description is never sufficient on its own (§10b)
- [ ] Report links verified with `check_report_links.py` before any page is opened
- [ ] For any folder with >1 titleset: each titleset probed, frames compared, broadcaster bug
      checked, and the record's `RepVideoFiles` confirmed to describe the show it claims to be
- [ ] Before splitting: continuity checked ACROSS the boundary (presenter and their clothing,
      mic flag, caption style, on-screen furniture) — a titleset boundary is not a show boundary
- [ ] After splitting: the ORIGINAL record renamed to name only its part, not the whole folder
- [ ] No folder belonging to a DIFFERENT artist was planned — check the skip lines
- [ ] Any new record from a split keyed by a REAL content hash where the files allow it
- [ ] Collection drive unmodified; repo clean
- [ ] Pruning only after picks verified
- [ ] `picks/` regenerated after any `picks.json` edit; every pick resolved to a file
- [ ] Promotion sources from `picks/`, not `work/`
- [ ] Loose media files at the drive root checked for missing records
- [ ] New records: unique ShowID, unique checksum, valid date format
- [ ] Split bills given derived checksums, documented in Notes
- [ ] `git add -f` used for BOTH `public/` and `.claude/skills/` (§11); every manifest entry
      tracked or staged (verify against git, not disk)
- [ ] `scripts/audit-image-geometry.py --artist "<name>"` reports 100% correct for this artist,
      with no `no show record` rows — those are images orphaned by a checksum change (§10b)
- [ ] No verification step can pass silently on failure

---

## 17. Runbook — the exact order for one artist

Every step that lived only in my head across two artists caused a bug. This is the sequence;
follow it in order.

```bash
cd ~/VaultShots
A="Stone Temple Pilots"

# 0. MULTI-SHOW CHECK - does any folder hold more than one concert? (§10b)
python3 find_multishow.py --artist "$A"
#    Then READ EVERY SIDECAR it reports. info.txt / Info.txt / *.nfo are written by the
#    person who made the disc and are the single most informative artefact available:
#    across two artists they revealed a two-show disc, a three-programme disc, a wrong
#    date, a source lineage and two full setlists - all before decoding a single frame.
#    Resolve every hit BEFORE capturing: capturing a two-show folder as one show
#    produces stills of the wrong concert and there is no later step that catches it.

# 1. SCOPE (seconds) - how many images are actually wrong?
python3 ~/Desktop/Projects/the-vault/scripts/audit-image-geometry.py --artist "$A"
#    Gives the exact worklist: SQUASHED / SMALL / MIXED / LETTERBOX per show (§4.1c).
#    If it already reports 100% correct and the stills look fine, stop here. See also §14.

# 2. PLAN - probe every folder, compute targets, run gates 1-4
python3 shots.py --artist "$A" plan          # --artist is GLOBAL: before the subcommand
#    Read the output. Check: no 0-minute runtimes, no absurd runtimes, targets sane,
#    overrides needed for any suspicious aspect flags (§4.4).

# 3. CAPTURE - extract and verify every frame
python3 shots.py capture --workers 3 --fresh        # bwdif is the default
#    Check: 0 rejected, and no show fell back to single-pass unexpectedly.

# 4. SCORE + SHEETS + INDEX
python3 shots.py score --top 24 --mindist 12 --workers 6
python3 shots.py contact
python3 shots.py index                       # -> reports/<artist>_contact.html
#    Check: every show kept >=24. Flag any that are starved.

# 5. REVIEW - open the index, read ONE contact sheet per show, pick by TIMESTAMP.
#    Budget one large image read per show; this is the expensive step.
#    Write data/picks.json as {fragment: [[label, "HH-MM-SS"], ...]}

# 6. MATERIALISE - after EVERY edit to picks.json, no exceptions
python3 shots.py picks                       # copies to picks/, builds the picks page
#    It asserts attempted == resolved + unresolved. Anything UNRESOLVED must be
#    re-captured from source before going further (§5.2 for broken containers).

# 7. PROMOTE
python3 promote.py --propose-map             # draft mapping; CONFIRM each line
#    save the confirmed version to data/promote_map.json
python3 promote.py                           # dry run - read the OLD->NEW column
python3 promote.py --apply

# 8. VERIFY + COMMIT
python3 scripts/health-check.py                        # in the repo
python3 scripts/audit-image-geometry.py --artist "$A"  # must be 100% correct now
git add -f public/images/ public/image-manifest.json
git add -f .claude/skills/concert-screenshots/         # if any bundled script changed
#    assert every manifest entry is tracked or staged (§11), then commit

# 9. ARCHIVE - park the run so the next artist starts clean
python3 shots.py archive
```

**Step 9 is not optional.** Leftover `picks.json` / `scores.json` from the previous artist
will silently skip or mis-resolve during the next promotion.

`archive` also **moves that artist's report pages in with their images and repairs the links**.
It previously emptied `picks/` and `contact/` while leaving the HTML in `reports/` pointing at
`../picks/…`, so every review page for a finished artist quietly became a page of broken
images — eight of them had accumulated before anyone looked. Inside the archive those
directories sit alongside the html, so the `../` prefix is dropped.

An archived artist should be **self-contained**: picks, contact sheets, evidence frames,
report pages and the run's JSON, all under `archive/<artist>/`, with every page still
rendering. Verify after archiving:

```python
for f in glob("archive/*/*.html"):
    missing = [s for s in re.findall(r'src="([^"]+)"', open(f).read())
               if not os.path.exists(os.path.join(os.path.dirname(f), s))]
```

**Do not keep a promote-backup directory as the rollback plan.** Every promotion is committed,
so git history already holds the replaced images, and the directory is pure duplication — 11 MB
of it in the reference collection. Roll back with `git checkout` instead.

### Scale expectations

| Shows | Frames | Capture | Review |
|---:|---:|---|---|
| 7 | ~3,500 | ~20 min | 7 sheet reads |
| 21 | ~7,500 | ~45 min | 21 sheet reads |

Storage runs ~600 MB during capture, dropping to ~50 MB after pruning (§12).

### Outcomes that are NOT failures

- **"No true close-up exists in this source."** Wide-camera arena broadcasts genuinely have
  none. Label the pick as the closest available; do not pass a wide shot off as a close-up.
- **Fewer than four picks** on a compilation where the artist appears briefly.
- **A show skipped at promotion** because promoting would replace more good images with fewer.

Say these plainly. A thin, honest result beats a padded one.

---

## 18. Reference implementation

`shots.py` and `subject.py` in this skill directory implement the above.

```
python3 shots.py --artist "<Artist>" plan    # probe, compute targets, run gates
#   NOTE: --artist is a GLOBAL flag and must precede the subcommand
python3 shots.py capture                      # extract + verify every frame
python3 shots.py score --top 24 --mindist 12  # filter crowds/graphics/blur, rank
python3 shots.py contact                      # contact sheet per show
python3 shots.py index                        # HTML index of all sheets
python3 shots.py picks                        # materialise picks/ + picks page
python3 shots.py archive                      # park a finished artist
python3 shots.py ab                           # deinterlace A/B comparison

python3 promote.py --propose-map              # draft the show mapping
python3 promote.py                            # dry run
python3 promote.py --apply                    # write images + manifest
```

Paths at the top of `shots.py` (`HD_ROOT`, `REPO`, `HOME`) are the only things to change per
collection. `data/overrides.json` holds per-show aspect corrections.

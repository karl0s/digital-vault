---
name: concert-screenshots
description: Capture high-quality, correctly-proportioned screenshots from concert video on an external drive, for any band and any source format (DVD/VOB, Blu-ray, TS, MKV, MP4, HD broadcast). Use when asked to take, redo, grab or improve screenshots/stills/thumbnails for shows, or when existing images look squashed, stretched, blurry or wrong. The collection drive is read-only and capture is staged in ~/VaultShots; after the owner signs off, promotion writes the images and manifest into the repo, alongside any record corrections made during the run.
---

# Concert Screenshot Capture

A repeatable pipeline for pulling stills from the collection. Every rule here exists because
something went wrong; each says, in a line, what it prevents. §17 is the runbook, §16 the
checklist, §18 the tools and the invariants they already implement.

**`Notes` is public; `PrivateNotes` never reaches the site.** Everything this procedure writes —
evidence, corrections, splits, aspect and identity notes — goes in `PrivateNotes`. `Notes` holds
only an info file from the show's own folder, pasted verbatim under `---- filename ----`
(CLAUDE.md → *Notes and PrivateNotes*).

---

## 0a. RUN IT OFFLINE — the cost of this task is attention, not compute

Babysitting a capture (a tool call a minute) and reading a full contact sheet per show burned a
day's budget on one 27-show artist. A 2400×1900 contact sheet is **~6,000 vision tokens**; a
review montage of all four picks for 27 shows at 300px is ~7,000 in total.

```bash
~/VaultShots/run_artist.sh "Incubus"      # plan → capture → score → contact → autopick
                                          # → materialise → review montage, then exits
```

Start it with `run_in_background: true`, **wait for the completion notification, never poll**,
then read **one** image: `reports/review.jpg`.

- `autopick.py` picks A/B/C/spare from `scores.json` with no model (`conc` for a close-up,
  `spread` for a wide, dHash distance so the four differ). `reviewsheet.py` builds the montage:
  300px judges *close-up? right band? title card?*, not fine focus.
- **Hand-picking is a correction pass**: override the wrong ones in `picks.json` (plain JSON)
  and re-run `shots.py picks`. Pull a full contact sheet only for a specific question.

| Needs a model | Does not |
|---|---|
| Split bills — whose segment is this? | Which frame is sharpest |
| Title cards, adverts, wrong programme | Whether four picks are distinct |
| Is the record's identity right? | Geometry, dedup, blank detection |
| Final judgement on the montage | Anything already in `scores.json` |

### 0a-0. Ask the owner BEFORE sweeping — they know the collection
Order: **`preflight.py` → one identification page → ask → capture.** The owner names in one line
("VTS_01 is a full Jet set") what costs several decode-and-montage rounds to guess. Build ONE
html page of every ambiguous titleset, say which you *can* identify from on-screen evidence
(captions, channel bugs, credit rolls — a CBS eye, "Last Call with Carson Daly"), and ask about
the rest together.

### 0a-1. The montage ladder — spend resolution only where the question is

| Step | What it answers | Cost |
|---|---|---|
| Whole disc, one row per titleset, 132px thumbs | where are the segment boundaries | ~4-5k |
| Six frames per titleset, 220px | what is each programme | ~5k |
| Two suspect rows, 220px | is that dark frame bad or just dark | ~1.5k |
| One titleset, full res 704px | reading an on-screen name caption | ~2.5k |

Escalate only the rows still ambiguous, and only as far as the question needs. Downscale a
montage rather than dropping frames (a 2679×5376 sheet is ~19k tokens; at 0.52 scale ~5k).
Never open a per-show contact sheet during identification.

### 0a-2. NEVER open a per-show contact sheet to choose a hero
The contact sheet renders the scorer's shortlist, which rewards a sharp subject against a quiet
background — so on a dark or wide-camera source it is **all wide shots** and the close-up is not
in it at any size (23 heroes on one artist were replaced after reading ~120k tokens of sheets).
`conc` does not find close-ups on dark sources either. **Sweep the full capture** at 150px,
~40 frames per show, three shows per image (~4k tokens for three shows):

```python
fs  = sorted((Path("work")/key).glob("*.jpg"))
sel = fs[::max(1, len(fs)//40)][:40]        # whole runtime, evenly spaced
```

### 0a-3. The cheapest order that still gets it right

| Step | Cost | Why here |
|---|---|---|
| `preflight` + `find_multishow` + both audits, read every sidecar | ~15k | Structure and identity before any decode |
| ONE page of everything ambiguous → ask the owner once | ~8k | They answer in a sentence what costs rounds to guess |
| Build the artist's **who's-who** (§6.2d-3) | ~3k | Every later identification is then free |
| `plan` → `capture` in background → **do not poll** | ~2k | Notification-driven; polling re-reads context for one line |
| `score` → `autopick` → ONE hero montage, all shows, 210px | ~3k | Judges every hero in a single read |
| Sweep ONLY the shows whose hero is wrong | ~4k per 3 shows | Never the whole artist |
| Verify replacement heroes at ≥340px, one montage | ~2k | Identity errors happen at thumbnail size |
| `promote` → hash-verify all slots → sync skill copies → commit on `main`, never push → **archive last** | ~2k | §17 steps 7-9 |

A 60-show artist fits under ~60k tokens of review this way.

## 0b. RUN `preflight.py` BEFORE CAPTURING — one pass, not twenty round trips

```bash
python3 ~/VaultShots/preflight.py --artist "Kings of Leon"
```

Every structural fault on one 50-record artist was found one round trip at a time; all are
detectable in this read-only pass. Each finding is something to LOOK at, not a conclusion:

| Check | Why it matters |
|---|---|
| Records with no `ChecksumSHA1` | Cannot carry images — the checksum is the key |
| Duplicate groups that disagree | Sources of one show scatter instead of sorting together |
| Loose media at the **drive root** | Folder discovery never reaches them |
| Folders with >1 titleset (nested discs included) | A record usually covers only one of them |
| `DurationSec` vs `TotalSizeHuman` | An implied bitrate outside 0.3–40 Mb/s means the scan timed one VOB part |

Matching is deliberately loose (artist tokens, the separator-stripped name, initials). The
duration check false-positives on split records, which inherit the whole disc's size. **A
`0 records` report is a wrong name or a matcher bug, never an empty artist.**

## 0. Non-negotiable safety rules

1. **The collection drive is INPUT ONLY.** Opened read-only or passed to ffmpeg as `-i`. Never
   write, move, rename or delete anything on it.
2. **All output goes to `~/VaultShots/`**, outside the repo and the drive. Assert it before writing.
3. **Never overwrite `public/images/` or `image-manifest.json` as part of capture.** Promotion is a
   separate, explicitly requested step.
4. **ffmpeg writes only to the staging directory** — verify every output path resolves under it.
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

- `ffmpeg` + `ffprobe`; `bwdif` (the default deinterlacer, §4.6) is built in. libpostproc
  (`ffmpeg -version | grep enable-postproc`) is needed only for the `pp=lb` fallback.
- The collection drive is mounted at `/Volumes/Live Music`.
- Python 3 with **numpy** and **Pillow**. **Do NOT install OpenCV** — face detection rejects valid
  faceless shots (hands on a kit, a silhouette); the region scoring of §6 handles them.

---

## 2. Discovery — enumerate the DRIVE, never the metadata

The collection has been reorganised since the scan (22 of 37 cached paths once dead), so:

- **Enumerate folders on the drive as they are now** — the drive is ground truth. The dedupe
  index (`MediaDeduper`) is a cache; `discover()` unions it with a live scan and prints dead
  paths. Never "fix" it with a full `dedupe.py scan` (re-hashes 46,000 files / 2.6 TB for no gain).
- Match the artist on **distinctive tokens**, not substrings; scale the requirement to the name
  (`need = min(2, len(artist_toks))`); accept **loose single files** as shows; exclude backup
  trees; link a folder to a record only on a strong match, and never let the link define
  identity. The matcher's aliases and edge cases are listed in §18 — **after every plan, compare
  folders found against the artist's record count.** Fewer is a silent drop; far more is a
  matcher that widened (`skipped: 0` says nothing about what never matched).
- **Common-word artists** — Train, Filter, Live, Garbage, Cake, Tool, Bush — collide with venues
  and other bands' folders ("Bush" matched *Shepherd's Bush Empire*). Discovery rejects a folder
  another artist matches more strongly, or whose name opens with another artist's name. Read the
  skip lines.
- **Shows with no record:** match drive units on **size** (±2% of `TotalSizeBytes`, plus one
  distinctive token, tokenising the parent too), not name. `find_undocumented.py` does this.

### Setlists: the guard, and why a populated one is not a checked one
`health-check.py` blocks a push that loses setlist songs (splits pass; a deliberate removal needs
an entry in `scripts/setlist-removals-approved.json`). Pasted sidecars leave junk at the **top**
(band, venue, date, city) and **bottom** (running time, lineage, credits, "thanx to") — check the
first and last three entries. One record held another band's whole setlist. A disc-numbered
segment (`Interview (cuts in)`, `Dave Talks`, `jam`) goes to `PrivateNotes`, and real songs collide with
junk patterns (*Taper Jean Girl*, *Running on Faith*, *February Stars*).

### Read every sidecar — for setlist, not just identity
A sidecar in the show's own folder is **authoritative for that show** (written from the disc).
Read every one before capture and take, in order: **setlist** (house format), **date, venue,
city**, **lineage** (evidence for aspect and quality), and **non-song segments** (to `PrivateNotes`).
Paste the file verbatim into `Notes` under `---- filename ----`; name it in `PrivateNotes`. Verify per artist:

```bash
python3 scripts/audit-sidecar-setlists.py --artist "Bush"
```

It strips running times and technical lines, matches folders exactly, word-matches medleys, and
pools every record from a folder before calling a song missing.

### The recording outranks every external source
Captions, banners, backdrops and title cards are primary evidence about *this* recording. When a
published setlist disagrees, write what the video shows, mark a partial list `(incomplete)`, and
put the conflict in `PrivateNotes`. Use external sources only to choose between dates the recording
narrows down, then **commit to the best-evidenced one** and say why. The footage often identifies
the show outright (a "WELCOME BACK TO THE RITZ" banner, a Live Earth lower-third).

**Read song captions with a strip sweep**, not the capture (a ~5 s caption falls between ~5 s
samples). This is analysis, so hand-rolled ffmpeg is fine; drop `-hwaccel` for MPEG-2:

```bash
ffmpeg -i SRC -an -vf "fps=2,crop=iw*0.40:ih*0.14:0:ih*0.82,scale=480:-2,format=gray" -f rawvideo strip.gray
```

Score frames for bright, static, sharp-edged strokes and montage one per run. **A folder named
"Full" is not evidence of a full show, and a caption that appears twice means a rerun, not an
encore** (Soundgarden Lollapalooza 2010 was a seven-song edit plus half its own repeat).

### One recording, two bands — whose songs are in the record?
On any folder whose name contains `+`, `&`, `with`, `VA -` or two artist names: **sweep the whole
runtime first** (the shortlist says what looks good, never who is on stage), find the boundary and
write it into `PrivateNotes`, pick only inside the segment, and check the setlist belongs to the artist
on the record. Multi-act discs are filed through `va-masters` (§10); a two-band split bill is one
record per band per tape, plus a master.

### Splitting when the shows are NOT separable at file level
A titleset split gives each show a real checksum (prefer it, §10b). A **time-window** split cannot,
so derive the second record's identifiers — unique and reproducible:

```python
DISC        = "greenday"                       # short, stable discriminator (date, venue or artist)
gd_showid   = sha1(folder_path      + "|" + DISC).hexdigest()[:12]
gd_checksum = sha1(primary_checksum + "|" + DISC).hexdigest()   # NOT a content hash
```

The primary record keeps the real `FolderPath`-derived ShowID and real `ChecksumSHA1`. Both
`PrivateNotes` record the sibling's ShowID, the segment boundary, and that the identifiers are derived,
not a content hash. This is the one statement of the formula (§10b step 4 and §13 point here).

---

## 3. Source selection

- **DVD folders:** all `VTS_\d+_[1-9].VOB` of the disc's own level in sorted order, read through
  `concat:` so candidates span the whole show.
- **Blu-ray:** `BDMV/STREAM/*.m2ts`, largest first, or concat in playlist order.
- **Otherwise:** the largest video file over ~20 MB (or the files a `files` split names, §10b).

---

## 4. Geometry — the single most important section

DVD and broadcast pixels are **not square** — the cause of every squashed or stretched still.

### 4.1 Compute the target from SAR — and NEVER downsample
Display shape = `(width × SAR) / height`. Reach it by **growing** an axis, never shrinking one:

```python
def fit_no_downsample(w, h, dar):
    if dar >= w / h:
        tw, th = round(h * dar), h      # display wider than stored -> grow width
    else:
        tw, th = w, round(w / dar)      # display taller than stored -> grow height
    return tw + tw % 2, th + th % 2     # keep both even
```

The old `target_w = round(w × SAR)` rule shrank NTSC 4:3 (SAR < 1) — 720×480 → 640×480, 21% of
real pixels thrown away — while every aspect gate passed. Keep `computed_ar` as the shape SAR
*implies*, not the output's, or gate 1 (§8) becomes trivially true.

### 4.1b Canonical output sizes — what consistency means
**Native max, no upscaling beyond the source.** Consistent = the **aspect is exact** and each show
is at the largest size its source honestly supports; forcing one size would upscale NTSC by 20%.

| Source | Standard | Display | **Output** |
|---|---|---|---|
| 720×576 / 704×576 / 480×576 | PAL | 4:3 | **768×576** |
| 720×480 | NTSC | 4:3 | **720×540** |
| 704×480 | NTSC | 4:3 | **704×528** |
| 352×480 | NTSC | 4:3 | **640×480** |
| 720×576 / 704×576 | PAL | 16:9 | **1024×576** |
| 720×480 | NTSC | 16:9 | **854×480** |
| 1280×720 | either | 16:9 | **1280×720** |
| 1920×1080 / 1440×1080 | either | 16:9 | **1920×1080** |

Eight sizes in all. **All slots of one show share one size** (§8 gate 7). Half-D1 sources
legitimately stretch their width a lot (352 → 640): that axis is genuinely under-sampled.

### 4.1c Auditing the whole collection
```bash
python3 scripts/audit-image-geometry.py                    # summary + per-artist worklist
python3 scripts/audit-image-geometry.py --artist "Foo Fighters"
python3 scripts/audit-image-geometry.py --list             # every affected show
```
Classes: `correct`, `SQUASHED`, `SMALL`, `MIXED`, `LETTERBOX` (`letterboxed - needs cropdetect`, a
legacy two-part record, §4.3), unknown geometry, and `no show record` (orphaned images). It
**re-implements** `fit_no_downsample` on purpose, so a regression in the pipeline cannot hide from
its own test. Run it for current figures; never copy them into a doc.

### 4.1c-2 A folder can CONTAIN other complete discs — never glob recursively
Gather VOBs from `folder/VIDEO_TS` or `folder` only (`iterdir`, never `rglob`); a nested folder
with media is its own unit. Recursion once spliced four concerts into a "1675-minute" disc.
**QA gate:** a runtime far from `size ÷ bitrate` means the source list is wrong, not just the
duration.

### 4.1d One titleset can mix geometries — ffprobe reports only the first stream
The Alice in Chains Unplugged disc was catalogued 352×240 because `VTS_01_1` is a quarter-res copy
padded with green filler. When a titleset's geometry is implausible for its bitrate, probe each VOB:

```bash
for f in VTS_01_*.VOB; do
  ffprobe -v error -select_streams v -show_entries stream=width,height,sample_aspect_ratio \
          -of csv=p=0 "$f"
done | sort -u          # more than one line = mixed geometry
```
Then capture only the good files with `vobs` in `splits.json` (§10b step 7).

### 4.2 Snap near-square SAR to 1:1
Within 1% of square (`999:1000`, `1287:1280`), force `1:1`.

### 4.3 Letterbox and pillarbox: KEEP the bars, MEASURE them at two or more timestamps
**The owner's rule (2026-10-05): capture the whole stored frame, bars included. Never crop.**
Losing picture is worse than carrying bars, bars carrying a broadcaster's captions or logo are
part of the recording, and on a disc that mixes shapes a crop cuts the full-frame parts.

- **Measure** the bars at ≥2 points (e.g. 30% and 55%) and trust only a consistent result —
  cropdetect on one dark frame returns nonsense. On VHS or off-air masters use a row profile (§4.3b).
- Write the picture's rows and the ratio they give into `PrivateNotes`. `AspectRatio` stays the **frame**
  ratio.
- A picture measuring to a non-standard ratio inside a standard frame can mean the **flag** is
  wrong (Limp Bizkit, Field lessons); fixing a flag with a `dar` override is not a crop (§4.4).
- **Legacy:** the eight `crop` rules in `data/overrides.json` predate the rule — leave them, add
  none. If one is recaptured, its target comes from the cropped pixels and the SAR.

**The two-part `AspectRatio` string (`4:3 (letterboxed 16:9)`) means the images ARE cropped** —
tools read the second ratio as the picture and the geometry audit stops checking the show. It
belongs only to those legacy records. **Never write it for a new capture.**

### 4.3b cropdetect is BLIND to a VHS letterbox — profile rows from bright frames
VHS and off-air bars sit at luma 8-20, never 0, so cropdetect reports full frame. Profile per-row
luminance over the **brightest** frames only (a dark stage otherwise reads as bars):

```python
frames.sort(key=lambda r: -mean(r))
m = [mean(c) for c in zip(*frames[:max(10, len(frames)//3)])]   # then read the plateaus
```

A real letterbox is three flat plateaus; a dark picture is a gradient. One disc can mix shapes
(MTV Five Night Stand letterboxes the concert, fills the frame for interviews) — another reason
the bars stay. Bars can carry burned-in graphics (an MTV TWO logo in the upper bar): take each
row's **maximum** across frames as well as its mean, and measure the bars, not DVB side blanking.

### 4.4 Aspect-flag overrides — the flag itself can be wrong
A self-consistent `SAR 8:9 / DAR 4:3` on a 2013 festival broadcast passed every check and was
visibly squashed. Flag for review when:
- an SD source (704/720 × 480/576) declares **4:3**, has **no bars**, and is dated **2000 or
  later** (or undated) — below; or
- the computed aspect is **non-standard** (not within 2% of 4:3 or 16:9).

**Verification: never by eye.** Rendering one frame at both shapes and judging a face, a drum head
or body proportions has been wrong three times (Pearl Jam ACL 2009, Silverchair Melbourne Park
1999, six Stereophonics sources) — the owner caught each. What settles a disputed shape:
1. the owner's A/B (`aspect_ab.py`);
2. a **same-performer, same-era source of undisputed aspect** rendered against it;
3. a rigid graphic shared with a source of known geometry (measure a channel logo's box, don't
   eyeball it);
4. structure — two independent captures sharing one framing are both uncropped.

**Point-light measurements are invalid on SD** (they read ~1.0 on a true anamorphic 16:9 disc).
Never quote one as evidence. Era priors are a reason to look, not a verdict: Australian TV 4:3 in
1999, UK widescreen from ~2000, SD festival broadcasts from 2008 usually 16:9, and a sidecar
lineage `HD Broadcast > SD DVD` makes any 4:3 flag suspect. **Where a disc's own VOBs declare
different aspects, pin the answer in `overrides.json`** even when the default happens to be right
— VOB sort order is not evidence.

Overrides live in `~/VaultShots/data/overrides.json`, keyed by path fragment (add `"showid"` when
a fragment is ambiguous or the folder is split), each with a `why`. Never bury one in code.

### A 4:3 flag with NO bars on a post-2000 broadcast is a SUSPECT — the owner judges it at both shapes
Six Stereophonics UK broadcasts (2002–2004) were full-height 16:9 squeezed into 4:3 by an off-air
recorder; flags, cropdetect and an eyeball check all passed them. But same-era WDR, SF2 and SIC
broadcasts with the same flag were genuinely 4:3 — so the profile is a **trigger**, not a verdict:

```bash
python3 ~/VaultShots/aspect_ab.py     # after capture; lists suspects, renders each hero at 4:3 AND 16:9
open ~/VaultShots/reports/<artist>_aspect_ab.html
```

It decodes nothing (stretching a 768×576 capture to 1024×576 *is* the 16:9 frame). Hand the page
over **with** the picks page, before promotion. Record each answer in `data/aspect_confirmed.json`
(`{ShowID: {"dar": "4:3", ...}}`) so it is never asked twice. **Do not pre-judge it.** If a
reference helps, a mic grille's ring seen head-on is a true circle; never a face or a side-on drum.

**Confirmed 16:9 → fix:** a `dar: "16:9"` override **scoped by `showid`**, move the unit's old
`work/<key>/` aside, re-plan, recapture with `--fresh` (§15), re-materialise (timestamps unchanged,
`picks.json` needs no edit), write `AspectRatio: "16:9 (native)"` to the record and note the disc's
own 4:3 flag in `PrivateNotes`.

### WRITE THE CORRECTION BACK TO `shows.json` — the override is not the record
An override fixes the CAPTURE; the record is what the site and every audit read. Mirror every
override into its record **in the same session**, evidence in `PrivateNotes`:

| Override | Record change |
|---|---|
| `dar` forced | `AspectRatio` → the true ratio, e.g. `16:9 (native)`; the disc's flag in `PrivateNotes` |
| none — bars kept (§4.3) | `AspectRatio` stays the frame ratio; measured rows and ratio in `PrivateNotes` |
| legacy `crop` only — add no new ones | `AspectRatio` → `4:3 (letterboxed 16:9)` / `16:9 (pillarboxed 3:2)` |

**Enforced:** `check_overrides.py` resolves every override to its record and fails if the
correction is missing; `promote.py` runs it in pre-flight and refuses. Run it any time:

```bash
python3 ~/VaultShots/check_overrides.py
```

### Auditing records against the SOURCE, not just the images
The geometry audit passes a wrong record whose images agree with it. This one probes each show's
representative media (the largest titleset, not a VTS_01 menu stub):

```bash
python3 scripts/audit-aspect-vs-source.py --artist "Chris Cornell"
python3 scripts/audit-aspect-vs-source.py          # whole collection, slow
```

A disagreement means the record, the flag or both are wrong — settle it with §4.4's evidence before
changing anything.

### 4.5 Filter chain and ORDER
```
bwdif=mode=send_frame:parity=auto:deint=all    # ONLY if interlaced, at native resolution
scale=<tw>:<th>:flags=lanczos
setsar=1
```
Deinterlace **before** scaling. No `crop` (§4.3); a legacy crop rule, where one applies, runs first.

### 4.6 Deinterlace conditionally — and use bwdif
`field_order` `tt`/`bb`/`tb`/`bt` = interlaced → deinterlace; `progressive` → **do not touch it**.

| Deinterlacer | Sharpness (vs `pp=lb`) | Comb ratio | Verdict |
|---|---|---|---|
| `pp=lb` (blend) | 100% | 1.08 | clean but soft — averages both fields |
| none | 214% | **4.53** | heavily combed, unusable |
| **`bwdif`** | **173%** | **1.20** | **sharpest clean result** |
| `yadif` | 159% | 1.36 | clean, but bwdif beats it |

**Sharpness alone is a trap** — comb lines read as texture. Measure combing independently, and
look at an A/B page of full frames with a 200% centre crop:

```python
comb_ratio = mean(|2·row[y] − row[y−1] − row[y+1]|) / mean(|2·col[x] − col[x−1] − col[x+1]|)
# ~1.0–1.5 clean · >2.4 visibly striped
```

### 4.7 Temporal deinterlacers need consecutive frames — `select` breaks them
`bwdif`, `yadif`, `w3fdif`, `estdif` and `nnedi` silently do nothing when fed `select`'s unrelated
moments (the output was byte-identical to no deinterlacing). `pp=lb` is spatial and immune, which
hid it. Where you hand-roll a chain:

1. **Seek (`-ss`):** decode a few frames past the seek and keep one with neighbours —
   `…,bwdif,select='eq(n\,4)',scale=…` with `-frames:v 1`.
2. **Single-pass sweep:** keep a 9-frame run at each sample point, deinterlace, take the middle:
   ```
   select='lt(mod(n\,K)\,9)' , bwdif , select='eq(mod(n\,9)\,4)' , scale , setsar=1
   ```
   Timestamps shift by the window offset: `ts = (i×K + 4) / fps`.
3. **Targeted re-capture:** select the union of 9-frame windows (merged where they overlap),
   deinterlace, then pick each window's middle by its position in the filtered stream.

**QA gate:** after any deinterlacer or chain change, hash a deinterlaced frame against the same
frame without — **byte-identical means the deinterlacer did nothing.**

### 4.8 Encode settings that must never vary
Changing any of these means the collection no longer matches itself; if one ever must change,
**re-run every artist**.

| Setting | Value | Why |
|---|---|---|
| Scaler | `flags=lanczos` | Sharpest practical resampler |
| Deinterlace | `bwdif`, conditional on `field_order` | §4.6; never on progressive sources |
| Sample aspect | `setsar=1` | Otherwise the browser re-stretches the image |
| JPEG quality | `-q:v 2` | Best on ffmpeg's 2–31 scale; ~50 KB per SD frame |
| Pixel format | `-pix_fmt yuvj420p` | Full range; `yuv420p` washes out blacks |
| Sharpening / denoise | **none** | Exaggerates DVD ringing / removes real detail |
| Colour | **untouched** | No auto-levels or saturation; broadcasts differ, authentically |
| Watermarks | **kept** | Bugs, tickers and TV-PG marks are part of the recording (§9) |

Do not lower quality to save space; drop to three frames per show instead if it ever matters.

---

## 5. Duration and seeking — containers lie

### 5.1 Measure true runtime by demuxing
Trust a container duration only when it implies a sane bitrate **in both directions** (a VOB
claimed 13.87 s; a DVD claimed 53 hours):

```python
bps = total_bytes * 8 / reported
if reported > 1 and 4e5 < bps < 30e6:      # 0.4 - 30 Mbps
    use reported
else:
    ffmpeg -i SRC -c copy -f null -      # demux only, ~90x realtime
    parse the LAST "time=HH:MM:SS.ms" from stderr
```

A plausible bitrate is not proof (Oasis Glastonbury 2004 reported 34 min of a 1:27:13 set at a
DVD-like 10 Mb/s), so `shots.py plan` **always demuxes a multi-part `concat:` source** and trusts
the container only for a single file. For a DVD, the IFO playback time is authoritative —
cross-check `DurationSec` against it and any sidecar length before capture. When timestamps are
non-monotonic even the demux fails; then **decode and count** (it cannot be lied to, and the
frames are the sweep you needed anyway):

```
ffmpeg -i SRC -vf "fps=1/20,scale=..." -vsync 0 out_%04d.jpg
duration ≈ (number of files) × 20
```

### 5.2 Single-pass fallback when seeking fails
`-ss` seeks against the container's bogus timestamps; six shows once produced zero frames. If the
seek path yields `ok == 0`, decode once selecting by frame number:

```
-vf "select='not(mod(n\,K))',<rest of chain>" -vsync 0 -frames:v N
K = int(duration × fps) // N
```

Name the outputs by `t = (i × K) / fps` so timestamps stay meaningful. With a temporal
deinterlacer use the windowed form (§4.7). **Apply the same 5%/95% trim as the seek
path**, or opening logos and the credit roll — the sharpest frames on a DVD — flood the shortlist:

```
start = int(total * 0.05);  end = int(total * 0.95)
k     = max(1, (end - start) // n)
select='gte(n\,START)*lte(n\,END)*lt(mod(n-START\,K)\,9)'   # windowed, temporal deint
ts    = (start + i*K + 4) / fps
```

QA gates and traps:
- **First and last candidate timestamps inside the trim window**, on both paths.
- **No show finishes with 0 usable frames.**
- **Stuck seeking** returns the same frame repeatedly — wholly (500 identical frames) or partly
  (a Pinkpop DVD's timestamps ended at 20:04 of 34:19). `shots.py` falls back when fewer than half
  are distinct **or** the commonest frame repeats more than `max(4, 8%)` of the time.
- **A seek can land in a DIFFERENT SHOW** on a two-broadcast stream whose timestamps restart at the
  join (RHCP Woodstock 1994 + 1999). Pin `"decode": "single"` on such a unit in `splits.json`:
  ```json
  {"from": "0", "to": "64:10", "showid": "b77e1fdad0f6", "decode": "single", "label": "Woodstock '94"}
  ```
  and verify the WHOLE run, e.g. a strip of the broadcaster-bug corner from every 10th frame.
- **On a windowed unit, confirm a rescue landed in the window from the pixels** (a title card, the
  act) — fallback filenames are computed from the request, not the picture.
- **Targeted single-frame re-captures** on such discs use `select`, not `-ss`:
  `-vf "select='eq(n\,1125)+eq(n\,22500)'" -vsync 0 -frames:v 2`. Output arrives in decode order —
  sort targets by timestamp before matching labels.

### 5.2b When timestamps are broken, INDEX is the only coordinate — not time
On such a disc the `fps` filter's own timing is broken too, so thumbnail `i` of a `fps=1/20` sweep
is **not** at `i × 20` s; converting a label back to a frame number picked the programme's
presenter instead of the singer. **The chain that produced the frames you reviewed must produce the
frames you keep**, addressed by index:

```
# sweep (review)   : -vf "fps=1/20,scale=220:165"          -> thumb i
# capture (keep)   : -vf "<deint>,fps=1/20,scale=W:H"      -> frame i, same instant
```

Capture the whole titleset (one decode either way). **Sanity check: the capture emits the same
frame count as the sweep.** A mismatch means every pick points at the wrong moment.

---

## 6. Frame selection — why naive sharpness fails

Global Laplacian variance rewards crowds (the busiest texture) and sharp backgrounds behind a
smeared performer. The scorer (`shots.py score`) therefore works on tiles.

### 6.1 Tile the frame
6×8 tiles, Laplacian variance per tile: **subject focus** = max sharpness of the central region;
**spread** = tiles above 45% of peak; **quiet** = tiles below 15%; **lo_hi** =
`log10(max_tile/min_tile)`; **cv** = `std/mean`. A crowd is uniformly busy; a subject shot has
quiet regions.

```
subjectness = 0.38·min(1, lo_hi/3.4) + 0.30·min(1, quiet/0.55)
            + 0.20·min(1, cv/1.6)   + 0.12·(1 − min(1, edge_density/0.6))
crowd if subjectness < 0.60
```
Blocks daylight crowds, costs ~22% of good frames — absorbed by density (§7).

### 6.2 Night crowds and title cards
```
lit_frac = fraction of pixels with luma > 26
flat     = fraction of 8×8 blocks with std < 3.0
palette  = distinct colours after 4-bit-per-channel quantisation

crowd   if palette > 520 and flat < 0.50                     # clothing colour, no flat areas
graphic if (lit_frac < 0.11 or lit_frac > 0.93) and flat > 0.68 and palette < 400   # both tails
```
Gradient-background cards slip through — reject by eye.

### 6.2b The crowd test is calibrated on rock stages — relax it rather than weaken it
On an evenly lit venue (acoustic theatre, daylight festival) the crowd test rejects most frames.
Rather than lowering it, `score` **re-admits the best rejected frames only when a show would be
starved**, and prints `CROWD TEST RELAXED`. The blur floor is derived from non-crowd frames only.

### 6.2c Blank and filler frames — palette is the only reliable signal
```
blank   if palette < 90 or contrast < 4.0 or flat > 0.97     # calibrated: genuine ≥109, blanks ≤49
```
Black between segments and minutes of grainy green filler pass every other test. They are dropped
outright, reported, and never re-admitted.

### 6.2d Off-air recordings contain COMMERCIALS — a review duty, not a filter
Ads are bright, sharp and centred — exactly what the scorer rewards. Expect them on anything taped
off-air (a sidecar saying "VHS > DVDR" or "commercials included": roughly one frame in six), check
every slot, and say so in the hand-off.

### 6.2d-1 Sweep the STRUCTURE before concluding what a programme contains
The shortlist says what scored, not what is **in** the show (a "talking heads" record was half live
performance). Before trusting a uniform shortlist, sweep once (~1.2k tokens):

```python
fs = sorted((WORK/key).glob("*.jpg"))
sel = fs[::max(1, len(fs)//48)][:48]          # ~48 thumbs, whole runtime, one image
```

It also answers "is this two programmes?" (§10b) and "are there any close-ups at all?".
`scores.json` stores `file` as a bare filename — join it with `work/<key>/`.

### NEVER pick a frame from the montage alone — render it, then decide
Reading a dense grid, the eye takes the cell **next to** the intended one (five times in one session:
the drummer, the bassist, a wide, a light, the host). Choose candidates, **render those exact frames
at full size with their timestamps**, then write `picks.json`, then look at the materialised picks
again. A sharpness number settles near-ties (it cannot say *who*):

```python
a = np.asarray(Image.open(f).convert("L"), dtype=float)
lap = a[:-2,1:-1] + a[2:,1:-1] + a[1:-1,:-2] + a[1:-1,2:] - 4*a[1:-1,1:-1]
sharpness = lap.var()
```

### 6.2d-00 THE GATE GUARDS SLOT A ONLY — B/C/spare are where the junk lands
Title cards, caption cards, credit rolls and adverts are the highest-contrast, quietest frames in a
programme, so they **lead** the shortlist on any source; a dark source only removes the competition.
(Radiohead got four adverts as one show's four picks; Supergrass, with no dark sources at all,
still needed 14 of 18 heroes and 16 of 54 other slots replaced.) **Hand-pick all four slots on every
artist:**

1. `autopick` → `shots.py picks` → `reviewsheet.py`.
2. Read **`reports/review.jpg` once** (~6k tokens, all four slots of every show) — it catches
   adverts, cards, credits, idents, other bands and near-duplicates; not identity.
3. Sweep the full capture (§0a-2) and hand-write `picks.json` for every show.
4. Judge the hero separately at ≥340px (§6.2d-0).

### Two sources of ONE broadcast need DIFFERENT moments
Two records of the same broadcast (e.g. a DVB-S capture and a VHS master) rank the same frames
first. Sweep them side by side; if they align, choose different timestamps for each record's slots,
so the site does not show the same four pictures twice. Each keeps its own record.

### A non-artist segment inside ONE titleset must scope every slot
When a sweep shows the artist's segment ending before the file does (an ident, another band's
caption, channel filler), write the boundary into `PrivateNotes` and check **every** slot's timestamp
against it, not just slot A. Nothing structural flags it.

### 6.2d-0 THE HERO RULE IS ENFORCED, NOT ADVISED — `hero_gate.py`
The owner's rules (2026-08-25):
1. **Slot A is a close-up of the LEAD SINGER.** Always — never another member, however good the frame.
2. **Where the singer is barely filmed, use the tightest available shot OF THE SINGER.**
3. **Where no usable close-up of the singer exists, FLAG IT** for the owner — never fall back silently.

Prose did not hold (a guitarist as hero in fourteen shows, then a presenter, a reporter, a caller,
the bassist, a touring keyboardist), so a gate does. `autopick` labels slot A `A?`; `promote.py`
runs `hero_gate.py` and REFUSES unless every show either has its A label confirmed **and** an entry
in `data/hero_verified.json` with `checked_px >= 340`, or an entry in `data/no_closeup.json` with a
reason.

```bash
python3 hero_gate.py     # exit 1 and a REFUSE line per unconfirmed hero
```
```json
{"3cbf2c1669ea": {"ts": "00-17-35", "checked_px": 360, "who": "lead singer, at the mic"}}
```

### 6.2d-2 The hero is the LEAD SINGER — the scorer cannot know who anyone is
- **The singer is at the CENTRE MIC with no instrument**, or singing into it. Anyone holding a bass,
  behind a kit or at the side of the stage is not the hero. This beats faces (Kings of Leon are
  three brothers and a cousin).
- Costume and hair change across decades — check per era.
- Lookalike traps: the drummer at a distance; the **TV host** (a frame captioned with the host's
  name is the host); a **backing singer at their own mic** — identical composition to a hero frame, and
  the bassist has an instrument too.
- **Name one physical discriminator for the frontman that survives a thumbnail** (Gaz Coombes'
  sideburns; the bassist is clean-shaven) and check for it explicitly. **Never hair colour or
  length** — under stage light they read the same.
- **Verify all heroes as one montage** of the A frames at ~300px (~2k tokens), then each replacement
  at ≥340px. The 4-up review montage is too small to tell a guitarist from a singer.
- When one hero is caught wrong, re-check every other source of the **same performance** in the
  same pass.
- **"No close-up exists" needs the same evidence as a positive** — a sweep. One disc said to have
  none had one at 00:17:35, and the claim was repeated from memory. If there truly is none, use the
  widest acceptable frame with the singer centre stage and flag it (rule 3).

### 6.2d-3 Build the artist's WHO'S-WHO once, before picking anything
Identity is the largest quality risk and no script can check it. Spend ~3k tokens at the start:

1. Pull 6-8 frames across the artist's eras (a sweep row per era).
2. Write `data/whoswho_<artist>.md`: per era, who fronts the centre mic, hair and build of each
   member, who plays what, and the frontman's **discriminator** (§6.2d-2).
3. Note **extra** people — touring keyboardists, horns, guests, presenters, reporters.

**Never write an era's row without frames from that era** (a guessed "hair tied back" row was an
afro on screen). Head shape and hair colour fail at 230px (a slicked-back blond bassist read as
"bald"); verify at ≥340px. **A frame with two candidates in it** (singer and keyboardist both
visible) is self-evidencing — prefer it.

### 6.2e DARK shows need shot-scale diversity, not just score
On a dark show the brightest, highest-contrast frames are wide shots of crowd and rig, so a dim
close-up loses on score every time. `score` therefore **reserves a third of the shortlist for the
highest-`conc` frames** before filling the rest by score (free on a well-lit show), and prints
`DARK SOURCE (median luma N) - M close-up slots reserved` when the median luma is below 60. Never
hand over a score-ranked shortlist as if it were picked.

### 6.3 Adaptive blur floor
Judge each show against itself: `floor = max(250.0, 0.35 * percentile([r.subject for r in rows], 95))`.

### 6.4 De-duplicate
dHash every frame; keep frames at Hamming distance ≥12 from each other.

---

## 7. Density — how many candidates

**One frame per 5 seconds, floor 120, cap 500**, skipping the first and last 5%. ~7,500 frames for
21 shows ≈ 600 MB and ~45 min at 3 workers. Keep the top **24** per show after filtering. **QA gate:**
every show keeps ≥24 usable frames; say so if one is starved (<30).

---

## 8. Verification gates — run ALL of them

Before capture:
1. **SAR/DAR agree** — `(w × SAR)/h` equals the declared DAR within 1% (a `dar` override prints both
   and passes; the plausible-band gate judges the overridden shape)
2. **Target sane** — ≥320×240
3. **Aspect plausible** — between 1.15 and 2.60
4. **Cross-check `shows.json`** — a disagreement is a flag, not a blocker (the drive wins)

After writing each frame:
5. **Re-open the JPEG** — pixel dimensions equal the computed target exactly
6. **Final aspect** — within 1% of DAR
7. **Per-show consistency** — every frame of one show shares identical dimensions
8. **No downsampling** — `target_w ≥ width` and `target_h ≥ height` (§4.1)
9. **The deinterlacer ran** — output not byte-identical to the undeinterlaced frame (§4.7), comb ratio
   below ~1.6

Frames failing 5–7 are **deleted and logged**; report the count. Gates 8–9 are spot-checks, one frame
per show. **Final audit:** re-open every surviving frame — `0 wrong dimensions`.

---

## 9. Shot briefs and review

| Brief | Meaning |
|---|---|
| A | Close-up of the singer (§6.2d-0) |
| B | Close-up of multiple band members |
| C | Wide stage shot, whole band |
| spare | Best remaining — often hands on guitar/drums |

- The **subject need not have a face** — hands on a fretboard, a body, a silhouette all count.
- **Watermarks stay** (MTV, palladia, WDR bugs, tickers, TV-PG marks). Never crop or clone them out.
- A **contact sheet per show** (5-wide, 24 frames, labelled index, timestamp, score, sharpness) is a
  record of what scored — **not how slots are chosen** (§0a-2, §6.2d-00).
- Publish a **picks page showing the chosen frames as images**, never bare index numbers.
- **Record picks by TIMESTAMP, never by sheet index** (re-scoring shifts indices):
  `{show_fragment: [[label, "HH-MM-SS"], …]}`, and assert every pick resolves, reporting
  `UNRESOLVED` loudly.
- **QA gate:** `len(picks) == len(shows_with_scores)`, and every picks key matches exactly one
  state key — a fragment matching two is an error, never a first-match win.
- **Each pick in a show needs a distinct brief tag** — the label's first token names the file. When
  re-ordering, change the labels too: the hero entry must begin with `A`, whatever it shows
  (`"A  multiple members (hero)"`); two `B` labels write one file and silently lose a pick.

---

## 10. Content traps — not every "show" is a concert

| Folder | Reality |
|---|---|
| `… - Video Hits` | Music-video compilation. No stage, no live performance. |
| `… - Last Call` | A whole TV episode featuring **another artist**; the band appear for ~4 min. |
| `… - EMAs` | Full awards broadcast; the band appear once, accepting an award. |
| `… + <Other Band> - <Festival>` | **Split bill** — most frames are the other band. |

Capture a **targeted time window** around the band's segment and report the mislabelled folder.

**A recording with several acts on it goes through the `va-masters` skill:** one Various Artists
master plus one linked record per act (`ParentShowID`, `SegmentStart`/`SegmentEnd`, that act's setlist
and stills). **A capture run never creates a standalone record for an act on such a disc** — capture
the act's linked record if it exists, otherwise name the disc in the hand-off. A two-band split bill
is the same model at its smallest (§2). Only a disc that is all one artist, or pairs unrelated
programmes, gets no master (va-masters, "Not every multi-programme disc is VA").

**Only the target artist counts** — frames of the other act, interviews, the host or the ceremony are
rejected however they score. Fewer than four usable frames → promote fewer, never pad. **Read the
footage for ground truth:** captions, lower-thirds and credits routinely contradict the folder name.

---

## 10b. One folder, several shows — detection, verification, splitting

The scan records **one row per folder**, keyed to "representative media" (the DVD's VOBs in order,
else the largest file). When a folder holds two shows, one has no record, checksum or images, and
the row can **blend** both: one Alanis record took its date from Munich, its `FolderName` from Hyde
Park, its city from the uploader's home town in the NFO, and its checksum from `VTS_01` only. Another
record titled "MTV Unplugged 1999" was keyed to the CBC Canada Day titleset beside it.

### Step 1 — Detect (cheap, no file contents read)
```bash
python3 find_multishow.py                 # whole drive
python3 find_multishow.py --artist alanis
python3 find_multishow.py --min-score 3 --kind "MULTI-SHOW LIKELY"
find "$FOLDER" -type d -iname VIDEO_TS | wc -l     # >1 = more than one DISC in the folder
```

| Signal | Weight |
|---|---:|
| >1 substantial DVD titleset | 3 |
| Record's `RepVideoFiles` covers only some titlesets | 3 |
| Date in folder name ≠ record's `ShowDate` | 2 |
| >1 year in the folder name | 2 |
| ≥2 titlesets estimated ≥20 min each (size at ~7.5 Mbps) | 2 |
| NFO / txt / md5 / cue sidecar present | 1 |
| No long titleset and ≥4 of them (a clip reel) | −2 |

Classes: `MULTI-SHOW LIKELY` (verify first), `one main set + extras`, `clip reel / compilation` (§10,
not a split), `unclear`. **Several titlesets are not proof of several shows** — and a `+` between two
dates, festivals or artists in a folder name is strong evidence even when the sidecar disagrees.
**Assume a multi-titleset folder is several shows until a sweep proves otherwise:** one artist held a
three-festival disc, a Big Day Out master that was Jet then Kings of Leon then Muse, a ten-titleset
"Live & Videos" disc, and a show spanning two titlesets whose record covered only the first.

### Step 2 — Verify, in order of authority
1. **Read the sidecar first** (`EXTRAS_TS/*.txt`, `*.nfo`, `.md5`, the `.torrent` name) — fan DVDs
   document every show with setlists and lengths. **But it is a claim, not a verdict:** never create a
   record from a sidecar alone; sample that titleset's frames first.
2. **Measure each titleset** (`titlesets.py`) and check the arithmetic against the sidecar.
3. **Grab frames from every titleset** — start, middle, end (`identify_titlesets.py`). Compare venue,
   staging, lighting, clothing and the **broadcaster bug**.
4. **Continuity test across each boundary** (below).
5. **Corroborate externally** — 2+ independent sources for date, venue and event.

What the footage gives you:

| Evidence | Settles |
|---|---|
| Broadcaster bug (`N3` vs `Premiere`; `MUCH` vs `CBC`) | Two titlesets with different bugs = two broadcasts. A bug names the **capture source**, not the programme (a Letterman clip carried an MTV bug) |
| Credit roll ("Recorded At THE BROOKLYN ACADEMY OF MUSIC, HARVEY THEATER") | Exact venue |
| Song title cards | That the titleset grouping matches the setlist |
| Landmarks and banners (Parliament Buildings + Peace Tower) | An unknown show's venue and event |
| Encode parameters (9.56 vs 7.82 Mbps mid-folder) | A different authoring session, usually different material |
| A taper's own title card repeated mid-stream; a regional bug change (`WDR` → `BR`) | The join between two shows in one stream, and which festival each is |

Identify what is provable and **leave the date empty if the year cannot be sourced** — partial
identification beats a guess. **Trust a prior session's note only as far as the evidence it names** —
a frame number or caption is evidence; "appears around 45-62 min" is a guess (it held two other
bands). Cross-check a setlist's length against the segment runtime (twelve songs in 7m38s is wrong).

### A TITLESET BOUNDARY IS NOT A SHOW BOUNDARY
One MuchMusic broadcast chaptered across five titlesets became three records; a pre-recorded insert
captioned VANCOUVER produced a record for a concert that never happened. Before splitting, check
what persists across the boundary — **any one** means one programme:

| Signal | Same show if… |
|---|---|
| Presenter | same person, **same clothing** |
| Microphone / bug | same station flag on the mic, same corner bug |
| Caption house style | `CALLER: Name, Town, PROV` in the same typeface throughout |
| On-screen furniture | same phone number, email, hashtag |
| Set and audience | same room, same crowd |

A pre-recorded insert with its own title card belongs to the programme it appears in.

### Compilation discs: ONE wanted segment among many
A "MTV Cribs 2002 + Others" folder recorded as holding none of the artist's footage had 16 titlesets,
one of them the band's episode — the whole folder had been sampled as one concat stream with broken
timestamps. Procedure:
1. **Enumerate titlesets, never concatenate them for identification** (`VTS_01_1..4` are parts of one
   programme and must be concatenated; `VTS_01 … VTS_NN` are separate programmes).
2. Sweep each titleset by sequential decode (`fps=1/20`), which also measures it (§5.1).
3. One montage, one row per titleset (§0a-1); go to full resolution only for a name caption.
4. Capture from the wanted titleset **alone**.
5. **Write what the other programmes are into `PrivateNotes`.**

A titleset can be pure filler (`stddev < 6` across every frame). If the other programmes are other
acts, file the disc through `va-masters` (§10).

### Nested discs, doubled folders and loose files
- **A second complete disc in a subfolder** (R.E.M. T in the Park + Oxegen) is invisible to
  `find_multishow`, `pick_source`, `vts` splits and preflight's titleset count. Split it with
  `subdir` (one per entry; a record spanning two nested discs cannot draw from both — capture the
  richer half and say so in `PrivateNotes`):
  ```json
  {"R.E.M. - T in the Park, 2008-07-13 + Oxegen 2008": [
     {"showid": "7af6be6f7f6a", "label": "T in the Park 2008-07-13"},
     {"subdir": "REM - Oxegen Festival 12 July 2008",
      "showid": "ff6b0c88d556", "label": "Oxegen 2008-07-12"}]}
  ```
- **A doubled folder** (`X/X/VIDEO_TS`) shows the outer shell as a `SKIP` — confirm the inner unit is
  planned and linked, or use `subdir`.
- **Per-song or per-programme loose files** — name them with a `files` split; they concatenate in the
  given order, a missing file refuses the unit, and `.m2ts` joins force the slow single-pass path:
  ```json
  {"files": ["Searching with my good eye closed.m2ts", "Rusty Cage.m2ts", "..."], "showid": "6ba8d09333cf"}
  ```
- Changing a split's shape changes the unit's state key — re-read it from `state.json` before
  `capture --only` (a non-matching `--only` exits 0 after one red line), and recapture any unit whose
  key changed.

### After splitting
- **Rename every record to name only its part**, the original included —
  `Bush - HBO Reverb + Hard Rock Cafe` → `Bush - HBO Reverb (VTS_02)`.
- **The record whose metadata already fits one segment keeps that identity.** A three-song setlist is
  a TV slot; twenty is a concert. The other segment becomes the new record.
- **A time-window split needs its own state entry and work directory** (`picks` names files from the
  state entry), or two records' picks collide.
- **Every pick's timestamp must fall inside the titleset the record covers** — the frames look right
  in isolation; only arithmetic catches a record covering VTS_01 while its picks are in VTS_02:
  ```python
  bounds = list(itertools.accumulate(titleset_seconds))   # concat-time end of each titleset
  lo, hi = (bounds[i-1] if i else 0), bounds[i]           # i = titleset the record covers
  assert all(lo <= secs(ts) < hi for _, ts in picks[key]), "picks are from the wrong titleset"
  ```

### Merging two records that are ONE show (a concert across two discs)
1. Name the show from the **parent** folder (artist, city, date); note drive typos, never "fix" the drive.
2. Keep the surviving record's real checksum; record the retired sibling's `ShowID` and `ChecksumSHA1`
   in `PrivateNotes`.
3. Sum `DurationSec` and `TotalSizeHuman`.
4. Put the images on one timeline — offset disc 2's frames by disc 1's runtime before naming.
5. Clean up the orphaned images (below).

### Links: check them, and the orphans they leave
- **A folder linked to the WRONG record passes every gate** (a Kings of Leon folder overwrote a
  Various Artists record's images). After any plan, look at every link whose folder and record share
  no distinctive token, and confirm it by size or content, never by name. Then:
  ```python
  ids = [u["ShowID"] for u in state["shows"]]
  assert len(set(ids)) == len(ids)
  assert all(u["Checksum"] == rec[u["ShowID"]]["ChecksumSHA1"] for u in state["shows"])
  ```
- **A merge, delete, split or re-key orphans the old images** — `promote.py` cannot see it. List
  manifest entries no record references, and delete files and entry only once the checksum is
  provably unreferenced (plain `rm`, never `git rm`):
  ```bash
  python3 -c "
  import json
  mani=json.load(open('public/image-manifest.json'))
  cks={(s.get('ChecksumSHA1') or '').strip() for s in json.load(open('public/shows.json'))}
  print([c for c in mani if c not in cks])"
  ```
  `audit-image-geometry.py` reports the same as `no show record`.

### Step 3 — Decide which record keeps the original checksum
**The record keeping the original `ChecksumSHA1` is the show whose files were actually hashed** —
read `RepVideoFiles`, then prove it by recomputing. **Never move a checksum to make metadata tidier**:
it is the image key and the one field verifiable from the drive.

```bash
python3 titleset_checksums.py "<folder name>"
```

It prints both conventions in use — `VTS_NN_1..n` only, and with `VTS_NN_0.VOB` in front — and marks
`<- MATCHES <ShowID>`. **Hash a new record the way its sibling was hashed.**

### Step 4 — Key the new record
**Prefer a real content hash** from the new record's own titleset. Only when two shows share one
inseparable stream, derive the key (formula and `PrivateNotes` wording: §2, "Splitting when the shows are NOT
separable at file level").

### Step 5 — Write the records
- Both keep the **same `FolderPath`**; give each a **distinct `FolderName`** and cross-reference the
  titleset and sibling ShowID in both `PrivateNotes`.
- Take `Width`/`Height`/`AspectRatio`/`TVStandard`/`DurationSec` from **that titleset's** ffprobe.
- Each record gets **its own stills from its own titleset** — never shared.
- `Artist` is the stored spelling, no leading "The" (§17 step 0).
- Set `ContentType`: `"Documentary"` when half or more of **that titleset's** runtime is people talking
  or narration over footage (interviews, making-of, behind-the-scenes, Cribs-style tours,
  rockumentaries, TV biographies), otherwise absent. Storytellers, Unplugged and concert films with
  backstage inserts are not documentaries. Judge from the footage; for a borderline one,
  `python3 ~/VaultShots/doc_sweep.py <ShowID>` (48 frames, ±7% — put 42-58% to the owner).
  `RecordingType` (Proshot, Soundboard, Audience) is never `Documentary`.

### Step 6 — Promotion keys on ShowID
`promote_map.json` maps each picks key to a **ShowID** (or checksum) — never a FolderName, which two
split records share:

```json
{ "1996_06_29_VTS01": "3395c78f1ad2",
  "1996_06_29_VTS02": "a1b2c3d4e5f6" }
```

### Excluding folders: `data/exclude.json`
List basenames (or full `rel` paths for generic names like `Disc 1`) of folders never to plan: a
**byte-identical duplicate** of a folder already covered (confirm by size plus the first and last 32 MiB
of every VOB), or **material the owner decided gets no record** (CLAUDE.md → Documentaries lists the
documentary footage ruled out). Excluded folders are printed at plan time.

### Step 7 — Capture each show from its OWN titleset — `data/splits.json`
Capturing a split folder whole draws frames from both shows, and nothing downstream catches it. Declare
the split, keyed by the folder's basename (or full `rel`):

```json
{
  "Alanis Morissette - 1996-06-29": [
    {"vts": ["01"], "showid": "3395c78f1ad2", "label": "Munich 1996-04-01"},
    {"vts": ["02"], "showid": "53ab1e48902a", "label": "Hyde Park 1996-06-29"}
  ],
  "Alanis Morissette - MTV Unplugged 1999 (Pete)": [
    {"vts": ["01","02","03","04","05"], "showid": "edf18a8aa29e", "label": "MTV Unplugged 1999"},
    {"vts": ["06"], "showid": "1b855d937789", "label": "Canada Day, Parliament Hill"}
  ]
}
```

| Selector | Use when |
|---|---|
| `vts` | Shows are separate **titlesets** |
| `vobs` | One titleset **mixes geometries or sources** — name the good files (§4.1d) |
| `from` / `to` | Shows share one continuous stream — separable only by **time** (`90`, `"1:30"`, `"00:01:30"`) |
| `subdir` / `files` | A nested disc, or loose files (above) |
| `decode: "single"` | Seeking lands in the wrong show (§5.2) |

Selectors compose. Each unit gets its own probe, frame budget and work-directory key, and carries its
ShowID explicitly; an entry naming a ShowID not in `shows.json` is reported and skipped. **Write every
hand mapping into `splits.json` in the session that makes it** — re-picks later depend on it (Field
lessons).

### What NOT to do
- Do not split on runtime, file count or titleset count alone.
- Do not invent a date for footage you cannot date.
- Do not delete or re-key the existing record to "clean up" — fix it in place and add the missing show.
- Do not let two records share images.

---

## 11. Output naming and promotion

| Stage | Naming |
|---|---|
| Candidates | `work/<key>/<key>_c###_tHH-MM-SS.jpg` |
| Picks (staged) | `picks/<Folder Name truncated>_<ShowID[:6]>__<A|B|C|spare>.jpg` |
| Promotion (only on request) | `{ChecksumSHA1}_01.jpg` … `_04.jpg` |

### Promotion procedure (`promote.py`) — the only step that writes to the repo
- **Archive the finished artist before starting the next** (`shots.py archive`, named after the
  state's artist unless `--name` is given): it moves `picks/`, `contact/`, the report pages and the
  data files into `archive/<slug>/` and deletes `picks.json` and `scores.json`. Delete
  `data/promote_map.json` too — otherwise `autopick --merge` keeps the old picks and promotion
  resolves against a stale state.
- **CAPTURED is not RECORDED.** A state entry with picks but no ShowID is a show one step from being
  lost: create its record or say it has none.
- **Rebuild `data/promote_map.json` every run from each state entry's ShowID**, and assert the values
  are unique. `--propose-map` matches on name and maps both units of any split to one record — use it
  only as a draft. Validate:
  ```python
  for frag, folder in confirmed.items():
      recs = [s for s in shows if (s.get("FolderName") or "").strip() == folder]
      assert len(recs) == 1, (frag, "matches %d records" % len(recs))
      assert (recs[0].get("ChecksumSHA1") or "").strip(), (frag, "no checksum")
      out[frag] = recs[0]["ShowID"]
  ```
- **QA gate:** the dry-run plan lists as many shows as `picks.json` has entries, minus deliberate
  exclusions. A short plan means a stale map, not missing shows.
- The drive folder name and the record's `FolderName` can legitimately differ, and the record can be
  the right one — resolve which from evidence and write the reasoning into `PrivateNotes`.
- **Prove a guard fires before trusting it:** blank one ShowID in `state.json`, confirm `promote.py`
  exits non-zero on the dry run and `--apply`, restore.

**`promote.py` refuses** (pre-flight, dry run and `--apply` alike) when:
1. `check_overrides.py` fails — an aspect override not mirrored into its record (§4.4)
2. `hero_gate.py` fails — a hero neither verified nor flagged (§6.2d-0)
3. the repo already has orphans — a manifest entry with no file, or a file with no entry
4. a discovered folder's record exists but is not linked in `state.json` (exact `FolderName`, ambiguous,
   or a probable token/squashed-name match against an unclaimed record). A folder with **no** record is
   a genuinely new show: noted, not refused.

It reports coverage (`records for <artist>: N, of which M have picks`) and **SKIPS**, listing each:
a picks key with no map entry, a map value resolving to no record or several, a record with no
checksum, a key with no capture state, unresolved picks, or several staged files for one tag. Read that
list and the plan's count.

**It does not check — do these around it:** every show maps to a **confirmed** record; `git status
--short` first (note other sessions' work); dry run before `--apply`; afterwards
`python3 scripts/health-check.py` in the repo.

**Per show:** back up every existing `{checksum}_*.jpg` to `~/VaultShots/promote-backup/` (old manifest
entries to its `_ledger.json`); write picks to `_01` … `_0N` in brief order; **delete every
`{checksum}_0M.jpg` where M > N** (the orphan step — it bites whenever 4 images become 3); set
`manifest[checksum] = [1..N]` exactly.

**Post-flight, global, non-zero on failure:** 0 manifest entries without a file, 0 files without an
entry, **`shows.json` byte-identical**, per-show disk slots == manifest slots.

**Do not promote a show if it would reduce quality** (one usable frame replacing three good images):
skip, report, recapture a targeted window.

**Rollback.** Before the commit: restore each checksum's files from `promote-backup/` and its entry from
`_ledger.json`, and `rm` any slot the promotion added. After it, `rm` the added slots and run this
(it stages — commit by path at once):

```bash
git checkout <commit>^ -- public/images/<files> public/image-manifest.json
```

**Trash `promote-backup/` once the run is committed** (§17 step 8); git holds everything then.

### Committing: on `main`, by explicit path, in one command — and never push
**Never push until the owner says** — every push to `main` deploys. Two sessions often share the
repo's git index, so:
- **Never leave anything staged.** Delete with plain `rm`, never `git rm`.
- **Commit by exact paths, in one command:** `git commit -m … -- path1 path2`.
- `git status --short` first: anything you did not touch is the other session's — leave it out, and
  ask before committing a file (`public/shows.json`) that also carries its edits.
- Never `git add -A`, `git add .` or `git add -f`. **New files** (a slot that went 3 → 4, a newly bundled
  script) show as `??` and must be added by exact path in the same command — `git commit -- <path>`
  refuses an untracked file:

```bash
cd ~/Desktop/Projects/the-vault
git status --short -- public/images .claude/skills               # NEW files show as ??
git add -- public/images/<ck>_04.jpg && \
git commit -m "feat(images): <Artist> — …" -- public/shows.json public/image-manifest.json \
    'public/images/<ck1>_*' 'public/images/<ck2>_*' <changed skill copies>
git status --short                                               # nothing staged afterwards
```

A quoted `'public/images/<ck>_*'` is a git pathspec (it also carries deleted slots; one matching nothing
aborts the commit). **Then verify against git, not the disk** — every manifest entry a tracked file
(the deploy's health check fails a missing one, but catch it here):

```bash
python3 -c "
import json, subprocess
t = set(subprocess.run(['git','ls-files','public/images'], capture_output=True, text=True).stdout.split())
m = json.load(open('public/image-manifest.json'))
print([f'{c}_{i:02d}.jpg' for c, v in m.items() for i in v if f'public/images/{c}_{i:02d}.jpg' not in t])"
```

It must print `[]`.

---

## 12. Pruning

Only after picks are locked **and verified to resolve**: keep every picked frame, the top-24 shortlist
per show and the contact sheets; delete the other candidates (7,509 frames / 598 MB → 506 / 36 MB).

- **`picks/` is the source of truth for promotion, not `work/`** — `promote.py` reads
  `picks/<…>_<ShowID[:6]>__<tag>.jpg` first and refuses an ambiguous tag. (This rule once sat here
  unimplemented while hand corrections silently failed to promote — **verify a documented rule is
  implemented before relying on it**.)
- **After any promotion, hash every slot against its staged pick:**
  ```python
  for slot, tag in ((1,"A"),(2,"B"),(3,"C"),(4,"spare")):
      assert md5(picks_file(sid, tag)) == md5(IMGS/("%s_%02d.jpg" % (ck, slot)))
  ```
- **A hand-supplied still goes into `picks/<…>__A.jpg` as well as `public/images/`**, or the next
  `--apply` overwrites it from `picks/`.
- **`picks/` is not cleared between runs** — more files than expected are stale picks under old names;
  delete what the current run did not write.
- **Re-materialise `picks/` (`shots.py picks`) after every `picks.json` edit**, and assert every entry
  produced a file; a pick whose frame was pruned must be recaptured from source.

---

## 12b. Re-rendering already-chosen picks (`repick.py`)

When capture settings change (geometry, deinterlacer, an override), the selections stand but the pixels
are stale. `repick.py` re-renders exactly the frames in `picks.json`. Pick timestamps are floored to whole
seconds, so it recovers each exact frame by fitting the show's `work/` filenames rather than
`round(seconds × fps)` (which can land ~25 frames away):

```python
a, b = numpy.polyfit(indices, floored_seconds + 0.5, 1)   # +0.5 de-biases the floor
frame = round((a * i + b) * fps)
```

```bash
python3 repick.py            # dry run: renders to _repick/, verifies, reports comb ratios
python3 repick.py --apply    # copies into work/ under the ORIGINAL filenames
python3 shots.py --artist "<Artist>" picks   # re-materialise picks/ + rebuild the page
```

Renders are cached per show, so the dry run costs the decode and `--apply` is free; both verify
dimensions via `shots.verify()`.

**Always build a before/after page** (old and new side by side with pixels, sharpness and comb ratio)
and look at it before promoting.

### VERIFY EVERY REPORT'S LINKS BEFORE OPENING IT
Pages in `reports/` reference sibling folders, so every path needs `../`. Run before every `open`:

```bash
python3 check_report_links.py            # all reports
python3 check_report_links.py reports/x.html
```

---

## 13. Shows the original scan never catalogued

**Loose media at the drive root is systematically missing** (5 of 22 shows on one artist) — the scan
walked folders. Check on every artist. Create a record with the pipeline's own algorithms:

```python
ShowID       = sha1(str(full_folder_path)).hexdigest()[:12]
ChecksumSHA1 = sha1(concatenated representative media, in order).hexdigest()
#   representative media = the DVD's VTS_*_[1-9].VOB segments in order,
#   otherwise the single LARGEST video file in the folder
```

Technical fields from `ffprobe` (container, codecs, width, height, duration, `AspectRatio` as
`"<DAR> (native)"`, `TVStandard` from frame rate), `FileCount` and `TotalSizeBytes` from the filesystem.
`Setlist` only from the folder's own sidecar (pasted into `Notes`, named in `PrivateNotes`); uncertainty goes in `PrivateNotes`;
`YYYY-01-01` when only the year is known. `Artist` and `ContentType` exactly as §10b step 5. **Validate
before writing:** ShowID and checksum unique, `ShowDate` empty or exactly `YYYY-MM-DD`, and the record
count up by exactly the number added. Split bills get a derived checksum for the second act (§2).

---

## 14. Scoping an artist cheaply before capturing

Compare each existing image's shape with its record's `AspectRatio` — seconds, no decoding:

```python
with Image.open(img) as im: w,h = im.size
declared = parse "<n>:<d>" from show["AspectRatio"]
squashed = abs(w/h - declared) / declared > 0.02
```

Use it to choose artists worth doing and to prove the improvement afterwards (`scout.sh` bundles it).

---

## 15. Never write a check that can fail silently

A helper wrapped in `if out.exists(): print(...)` printed nothing when ffmpeg failed — which read as
success. Every verification needs an explicit failure branch that prints, and every batch must report
counts that add up: `attempted == succeeded + failed`.

**A resumed capture reports cached frames as successes.** `capture` skips existing outputs unless
`--fresh`, so after an aspect fix it printed `ok=500 bad=0 … verified` and wrote nothing. **After any
geometry, override or deinterlacer change, re-capture with `--fresh`** (scoped to `--only`), check that
`cached=` is 0, and **verify the files** — one `Image.open().size` over the work directory.

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
- [ ] Suspicious aspect flags (SD 4:3 with no bars dated ≥2000 or undated, non-standard ratios)
      put on the owner's A/B page (`aspect_ab.py`) — not judged by eye
- [ ] Any DISPUTED aspect settled against a known-good source (same performer and era, a shared
      rigid graphic, or two captures sharing one framing) or by the owner's A/B — never by an
      unaided look, and never by a point-light number (invalid on SD, §4.4)
- [ ] 16:9-FLAGGED DVDs checked for letterbox bars too, and any non-standard container SAR explained
- [ ] A disc whose VOBs declare DIFFERENT aspects has the answer PINNED in overrides.json,
      even where the default happens to be right — VOB sort order is not evidence
- [ ] After ANY geometry, override or deinterlacer change, re-captured with `--fresh`, and the
      WORK DIRECTORY's actual pixel sizes re-read — `ok=N` counts cached frames, not written ones
- [ ] The artist's STORED spelling confirmed first (no leading "The" — `Killers`, not "The
      Killers"), and `preflight` reported a NON-ZERO record count for it; a 0 is a matcher bug
      or a wrong name, not an empty artist (case does not matter — artist match is case-insensitive)
- [ ] EVERY override created this session mirrored into its `shows.json` record, with the
      evidence in PrivateNotes — the override fixes capture, the record is what the collection knows
- [ ] `scripts/audit-aspect-vs-source.py --artist "<name>"` run; disagreements resolved
- [ ] Letterbox measured at ≥2 timestamps (row profile from bright frames on VHS or off-air,
      §4.3b); bars KEPT, rows in PrivateNotes, `AspectRatio` the frame ratio — no new `crop` rule (§4.3)
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
- [ ] Pick FILE COUNT ON DISK equals the resolved count — no filename collisions (§9)
- [ ] Every pick in a show has a distinct brief tag (A/B/C/spare) — a duplicate silently
      overwrites (§9)
- [ ] Shortlists reviewed for COMMERCIALS on any off-air source (§6.2d)
- [ ] Every shortlist contains at least one CLOSE-UP and one instrument/detail frame — on dark
      sources score alone will not produce them (§6.2e)
- [ ] ALL FOUR slots of EVERY show read on `reports/review.jpg` — not only the shows marked
      DARK SOURCE
- [ ] Any show marked DARK SOURCE reviewed against the briefs, not accepted on rank
- [ ] The who's-who names ONE physical discriminator for the frontman that survives a thumbnail
      (not hair colour), and every hero was checked for it specifically at ≥340px
- [ ] Where a disc continues past the artist's segment (channel filler, another band, an ident),
      EVERY slot's timestamp checked against that boundary, not just slot A
- [ ] Any unit rescued by the single-pass fallback confirmed FROM THE PIXELS to have landed in
      its window — the filenames are computed from the request, not from the picture
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
- [ ] Collection drive unmodified; nothing left staged in the repo
- [ ] Pruning only after picks verified
- [ ] `picks/` regenerated after any `picks.json` edit; every pick resolved to a file
- [ ] Promotion sources from `picks/`, not `work/`
- [ ] Loose media files at the drive root checked for missing records
- [ ] New records: unique ShowID, unique checksum, valid date format, `Artist` the stored
      spelling (no leading "The"), `ContentType` set — `Documentary` when half or more is
      talking or narration, otherwise absent (§10b step 5)
- [ ] Split bills: one record per band per tape, the second keyed by a derived checksum
      documented in PrivateNotes (§2); every multi-act disc, split bills included, filed through
      `va-masters` with a master — never as a standalone record made by a capture run (§10)
- [ ] `~/VaultShots/sync_skill_copies.sh "<Artist> run"` run after promotion; changed copies in the run's
      commit, and ~/VaultShots committed by it (local git, no remote)
- [ ] Committed on `main` by explicit path in ONE command, new files `git add`ed by exact path (no `-f`)
      (§11); every manifest entry a tracked file (verify against git, not disk); NOT pushed
- [ ] `~/VaultShots/promote-backup` moved to the Trash once the run is committed (§11)
- [ ] `scripts/audit-image-geometry.py --artist "<name>"` reports 100% correct for this artist,
      with no `no show record` rows — those are images orphaned by a checksum change (§10b)
- [ ] No verification step can pass silently on failure

---

## 17. Runbook — the exact order for one artist

```bash
cd ~/VaultShots                    # pipeline commands run HERE; repo commands (step 8) in the repo
R=~/Desktop/Projects/the-vault
A="Stone Temple Pilots"

# 0. SCOUT - one read-only pass, before any decode.
#    Confirm the name as STORED first (no leading "The"; a wrong name gives a clean, EMPTY report).
#    a = one distinctive word of the name, lower-case:
python3 -c "import json; a='temple'
print({s['Artist'] for s in json.load(open('$R/public/shows.json')) if a in (s.get('Artist') or '').lower()})"
./scout.sh "$A"
#    Bundles preflight, multi-show detection, both geometry audits, sidecar setlists, split bills
#    and the sidecars to read. READ EVERY SIDECAR IT LISTS - they have revealed three-show discs,
#    wrong dates, other bands' setlists and full setlists before a frame was decoded.
#    Read "MENTIONED UNDER OTHER ARTISTS": a record filed elsewhere can BE this artist's show.
#    Resolve every ambiguity BEFORE capturing - wrong-concert stills are undetectable afterwards.
#    ONE html page of what is open, opened, one question to the owner. Meanwhile capture every
#    UNAMBIGUOUS unit, pinning any ambiguous folder to its PROVEN titleset in splits.json first.
#    A disc with several ACTS is filed through va-masters, never as a record made here (§10).

# 1. WHO'S-WHO - before picking anything (§6.2d-3)
#    data/whoswho_<artist>.md: centre mic, who plays what, extra people, and ONE physical
#    discriminator for the frontman that survives a thumbnail. Not hair colour.

# 2. CAPTURE - plan, capture, score, contact, autopick, materialise, review sheet
./run_artist.sh "$A"        # in the BACKGROUND; wait for the notification; do not poll
#    ./run_artist_noplan.sh when state.json has been deliberately pruned (plan would undo it).
#    Check the summary: 0 rejected, no show starved, picks attempted == resolved.
#    Adding a unit later: write the record, add its splits.json entry, re-run - existing units
#    come back cached=N and autopick --merge keeps hand picks. Back up data/picks.json first.

# 3. REVIEW ALL FOUR SLOTS - reports/review.jpg, ONE read for the whole artist (§6.2d-00)

# 4. HEROES - sweep, never a contact sheet (§0a-2)
#    Sweep at 150px, ~40 frames per show, three shows per image, for every wrong hero.
#    Verify each at >=340px against the discriminator before writing it:
#    data/hero_verified.json -> {"<ShowID>": {"ts": "...", "checked_px": 420}}
#    No usable close-up of the singer -> data/no_closeup.json with a reason, and say so.
python3 hero_gate.py                         # must pass before promote will run

# 5. MATERIALISE - after EVERY edit to picks.json
python3 shots.py --artist "$A" picks
#    Anything UNRESOLVED is re-captured from source first (§5.2 for broken containers).

# 5b. ASPECT A/B - every 4:3-flagged, bar-free, post-2000 source at BOTH shapes (§4.4)
python3 aspect_ab.py

# 6. SHOW THE OWNER - a local page in their browser, never a Claude Artifact
./showpicks.sh "$A"; open reports/<artist>_aspect_ab.html
#    It refuses a mismatched artist and a page whose images do not resolve. STOP until they sign
#    off on the picks AND every source's shape.

# 7. PROMOTE - only after sign-off
#    Build data/promote_map.json from each state entry's ShowID; assert the values are UNIQUE.
#    Never --propose-map (it maps both units of a split to one record).
python3 promote.py                           # dry run - read OLD->NEW and SKIPPED
python3 promote.py --apply

# 8. SYNC, VERIFY, COMMIT - on main, in the REPO, never pushed
./sync_skill_copies.sh "$A run"              # refreshes the repo's skill copies, commits ~/VaultShots (§18)
cd "$R"
python3 scripts/health-check.py
python3 scripts/audit-image-geometry.py --artist "$A"  # must be 100% correct now
#    A deliberate Setlist removal needs an entry in scripts/setlist-removals-approved.json.
git status --short                           # what you did not touch is another session's
git add -- <each new file> && git commit -m "feat(images): $A ..." -- <every path, by name>
#    One command, explicit paths, skill copies included (§11). Nothing staged; every manifest
#    entry a tracked file. NEVER push - the owner says when.
mv ~/VaultShots/promote-backup ~/.Trash/promote-backup-$(date +%Y%m%d-%H%M%S)

# 9. ARCHIVE - LAST, only after the commit
cd ~/VaultShots && python3 shots.py --artist "$A" archive
#    Clears work/ and moves picks/ - never before sign-off.
```

### Scale expectations

| Shows | Frames | Capture | Review |
|---:|---:|---|---|
| 7 | ~3,500 | ~20 min | `review.jpg` once, one hero montage, a sweep per 3 shows whose hero is wrong |
| 21 | ~7,500 | ~45 min | the same — sweeps only where needed |

Storage ~600 MB during capture, ~50 MB after pruning.

### Outcomes that are NOT failures — say them plainly
- **No true close-up exists in this source** (wide-camera arena broadcasts) — label the closest
  available; never pass a wide off as a close-up.
- **Fewer than four picks** on a compilation where the artist appears briefly.
- **A show skipped at promotion** because it would replace good images with fewer.

---

## 18. Reference implementation

**`~/VaultShots/` holds the master copy of every pipeline script.** The scripts beside this file and
in `.claude/skills/va-masters/` are copies, versioned with the site. Edit and run only the
`~/VaultShots/` versions; a differing repo copy is stale, never a fork.
`~/VaultShots/sync_skill_copies.sh "<msg>"` refreshes every copy, lists what changed and commits
`~/VaultShots` to its own local git (no remote, by the owner's choice); `--check` only lists, and
exits 1 if a copy differs. Run it at the end of every run, after promotion and before the commit. To
bundle a NEW script, copy it into the skill folder once and `git add` that path.
`shots.py` and `subject.py` implement most of this file.

```
python3 shots.py --artist "<Artist>" plan    # probe, compute targets, run gates
#   --artist is a GLOBAL flag before the subcommand; plan requires it and resolves it
#   case-insensitively to the stored spelling, warning with suggestions when nothing matches.
#   The other subcommands read the artist from data/state.json.
python3 shots.py capture                      # extract + verify every frame (--fresh after setting changes)
python3 shots.py score --top 24 --mindist 12  # filter crowds/graphics/blur, rank
python3 shots.py contact                      # contact sheet per show
python3 shots.py index                        # HTML index of all sheets
python3 shots.py picks                        # materialise picks/ + picks page
python3 shots.py archive                      # park a finished artist
python3 shots.py ab                           # deinterlace A/B comparison

python3 promote.py                            # dry run
python3 promote.py --apply                    # write images + manifest

./scout.sh "<Artist>"                         # one read-only pass before any decode (§17 step 0)
./run_artist.sh "<Artist>"                    # plan -> capture -> score -> autopick -> picks
./run_artist_noplan.sh "<Label>"              # same, without plan, for a pruned or subset state.json
python3 plan_subset.py --label L --ids ids.json   # plan only listed ShowIDs; REFUSES if any yields no unit
./showpicks.sh "<Artist>"                     # materialise, verify links, open for the owner
python3 hero_gate.py                          # refuse promotion until every hero is verified
python3 aspect_ab.py                          # 4:3-flagged, bar-free, post-2000 sources at both shapes
python3 check_overrides.py                    # every override mirrored into its record
python3 doc_sweep.py <ShowID> [...]           # 48-frame sweep for the Documentary call -> doc_sweeps/
python3 find_multishow.py / titlesets.py / identify_titlesets.py / titleset_checksums.py   # §10b
python3 reconcile.py                          # records vs the drive -> data/reconcile.json
python3 find_undocumented.py                  # folders with no record, matched on SIZE not name
python3 fix_paths.py                          # repair FolderPath after a drive remount
python3 check_report_links.py                 # every report's images resolve
./sync_skill_copies.sh "<msg>"                # refresh the repo's copies; commit ~/VaultShots
```

Working files live in `~/VaultShots/data/` — `state.json`, `picks.json`, `splits.json`, `overrides.json`,
`exclude.json`, `promote_map.json`, `hero_verified.json`, `no_closeup.json`, `aspect_confirmed.json`,
`reconcile.json` and `reconcile.py`'s `hash_cache.json` — never a session scratchpad.

**Paths are hard-coded to this machine** — in `shots.py` (`HD_ROOT`, `REPO`, `HOME`, `DEDUPE_DB`), and
`/Users/ko/...`, `~/Desktop/Projects/the-vault` or `/Volumes/Live Music` in most other scripts
(`preflight.py`, `scout.sh`, `promote.py`, `aspect_ab.py`, `check_overrides.py`, `find_multishow.py`,
`find_undocumented.py`, `reconcile.py`, `fix_paths.py`, `titleset_checksums.py`, `doc_sweep.py`,
`bp.py`). Moving the collection or the repo means finding them all:

```bash
grep -n '/Users/ko\|Desktop/Projects\|/Volumes/' ~/VaultShots/*.py ~/VaultShots/*.sh
```

### Invariants the tools already implement — keep them if you edit a script
Each was a silent failure once. None needs doing by hand; all must survive a change to the code.

**Artist and folder matching (`discover`, `preflight`, `promote` gate):**
- Compare artist names **case-folded**; the name arrives from a shell argument.
- Match on **distinctive tokens** (`artist_toks - STOPWORDS`: articles, prepositions, and `usa us uk
  ca ny la live band pro shot dvd tv hd hdtv ntsc pal ws concert show set master disc`), both for the
  artist's own match and for cross-artist rejection.
- Strip apostrophes **before** tokenising (`Jane's` → `janes`); collapse dotted initialisms
  (`r.e.m.` → `rem`); refuse to match anything when a name yields no usable token.
- Add the **squashed name** as an alias (`greenday`), accept it followed only by digits
  (`stereophonics2003-06-07dvd`), and use it in every fallback that matches names (the promote
  gate's `LiveWembley2001` case). Every name rule needs the squashed case.
- Per-artist aliases: `30stm`; `ratm`/`rage`; `qotsa`; `rhcp`; `stp`.
- Any derived alias needs a **minimum length** (initials of a one-word name match everything).
- An **exact `FolderName` match** links on its own; a **tie at the top score is refused** (printed
  red), never first-match; `splits.json` claims a record for its folder.
- Union the dedupe cache with a live drive scan; print dead paths; look one level into nested discs.
- Reject a folder another artist matches more strongly, or whose name opens with another artist's.

**Keys, names and files:**
- Work-directory key = slugged `rel` + 6-char sha1 of it; the picks key is the **whole** work key,
  never truncated; staged pick filenames include the ShowID.
- `rel` keeps a `subdir` readable (overrides match path fragments); a `files` tag digests the file
  names, not their count.
- Count files on disk, not successful copies — fewer is a name collision, more is stale files.
- `pick_source` and titleset tools never recurse; tools that look for `VIDEO_TS` fall back to the folder
  root and **error** when nothing is found.
- `rep_media` probes the titleset with the most **total** bytes, not `VTS_01` (often a menu stub).

**Geometry and capture:**
- A `dar` override marks the gate-1 disagreement as adjudicated and prints both numbers.
- `check_overrides.py` matches an override to its record on tokens (or its `showid`), and compares
  a legacy crop after SAR, derived from the record's own frame ratio (`SAR = frame_dar × H / W`),
  so it needs no drive access.
- Tools reading a two-part `AspectRatio` take the **last** ratio when it says letterboxed/pillarboxed.
- `aspect_ab.py` counts a row as bar only if it is dark in every frame (95th-percentile brightest pixel
  under 48), so a dark crowd is not a letterbox.
- The capture tally prints `cached=N` beside `ok`.

**Pages and archives:**
- Build `src`/`href` with `urllib.parse.quote(name, safe="/")`; `check_report_links.py` cuts at the
  first `#` before unquoting, as a browser does.
- `archive` carries every file a page references, resolved against `reports/` and the staging root,
  **per file** (never `copytree`/`rmtree` on the shared `ident/`), and is verified by walking every
  `src`/`href`.

---

## Field lessons — collection traps

Lessons from capture runs. Most now live in their section; this index says where, and the rest follow.

| Lesson | Where it lives |
|---|---|
| Grow the under-sampled axis — never downscale, never upscale past native to match | §4.1, §4.1b |
| Two audits: images vs record, record vs source | §4.1c; §4.4, "Auditing records against the SOURCE" |
| A record's `AspectRatio` is often wrong — write the correction back | §4.4, "WRITE THE CORRECTION BACK" |
| Look at a record's CURRENT stills before trusting its identity | below |
| "No footage here" needs the same evidence as a positive | below; §6.2d-2 |
| A record can cover one titleset while its name describes another | §10b, "After splitting" |
| Compilation discs: one wanted segment among many | §10b, "Compilation discs" |
| Split bills: one record per band, per tape, plus a master | §2, §10 |
| A nested folder can hold a SECOND COMPLETE DISC | §10b, "Nested discs" |
| A sidecar's LINE-UP block imported as data | below |
| A circle test can lie — Pearl Jam, ACL 2009 | below |
| A 4:3 flag with no bars on a post-2000 broadcast can be squeezed 16:9 | §4.4 |
| Point lights do NOT measure the aspect of an SD source | §4.4 |
| A letterbox inside a 16:9-FLAGGED frame; an invented container SAR — Limp Bizkit | below |
| cropdetect cannot see a VHS letterbox | §4.3b |
| The two-part `AspectRatio` form is legacy only | §4.3 |
| A letterbox is not necessarily 16:9 — measure it | below |
| A seek can land in the OTHER show — Woodstock 1994 + 1999 | §5.2 |
| Artist names: no "The", aliases, initials, glued dates, squashed names | §17 step 0; §18 invariants |
| A record captured once can have NO saved capture rule | below |
| Five "FOTTP" discs held eighteen programmes | below |
| A prior session's "appears around X" is a guess | §10b, Step 2 |
| Read every sidecar; one folder can hold several shows | §2; §10b |
| Check for orphaned images after any merge, delete or re-key | §10b, "Links" |
| Run `preflight.py` before capturing | §0b |
| Image A is always the lead singer; hand-pick all four slots | §6.2d-0, §6.2d-00 |
| The bassist singing backing vocals | §6.2d-2 |
| Reviewing costs more than capturing | §0a |

### Look at a record's CURRENT stills before trusting its identity
On 30 Seconds to Mars three records showed the wrong thing on the live site and every audit passed
them: a "Kooks" record holding another titleset's hash, a "Last Call" record keyed to the wrong titleset
of a compilation, and a "Late Show" record (`e814e4732ab9`, since re-filed as Nickel Creek under the
Late Night #6 2005 master) over another band's footage. The capture pass is also how the collection
finds its gaps: shows with no record, records holding another band's setlist, dimensions disagreeing
with the disc, folders holding two shows. **A "no footage here" conclusion needs the same evidence as a
positive one** — broken timestamps make a failed sample look like absence.

Two Smashing Pumpkins records, `d9b007dd78f2` and `32fafc677477` (Brixton 1996, `Disc1` / `Disc2`), can
never be re-captured: their nested folder no longer exists. Do not chase them.

### A sidecar's LINE-UP block gets imported as data
One QOTSA sidecar gave a record `EventOrFestival: Nick Oliveri` and `VenueName: bass, lead vocals`, and
another a setlist of band members — the importer took whatever line sat where it expected a value (as
with the Alanis "Friesland" city). Find any that remain:

```bash
python3 -c "
import json, re
for s in json.load(open('public/shows.json')):
    for k in ('VenueName','EventOrFestival','City'):
        v = (s.get(k) or '')
        if re.search(r'(?i)\b(vocals|guitar|bass|drums|keyboards|backing)\b', v):
            print(s['ShowID'], s['Artist'], k, repr(v))
"
```

### A circle test can lie — Pearl Jam, Austin City Limits 2009
`fa2699316abb` was flagged 4:3 (720×480, SAR 8:9) and is 16:9: the sidecar lineage `HD Broadcast>SD
Standalone DVD XP` is a widescreen broadcast squeezed by a recorder that always writes 4:3. A side-on
drum head reads too wide at any aspect, so it "passed" as 4:3; the owner caught it ("looks squished").
It was settled against a same-performer, same-era HD source (the 1920×1080 Storytellers) — §4.4's
method.

### A letterbox inside a 16:9-FLAGGED frame, and an invented container SAR — Limp Bizkit, Rock am Ring 2009
An MKV (`a82c7d813257`, SAR 247:176) and a DVD (`dd47c5fa0e57`, 16:9 flag, picture in rows 44–529)
of one show. Frame-matching put them at a constant 36.5 s offset with identical framing; only the DVD
carries the festival bug, so they are independent captures and neither is a crop. The DVD's whole frame
is therefore 3:2: captured at 864×576 with bars kept, `AspectRatio: "3:2"`, via a `showid`-scoped `dar`
override. Check 16:9-flagged DVDs for bars, and treat any container SAR other than 1:1, 8:9, 10:11,
16:15, 32:27, 40:33, 16:11, 64:45 or 4:3 as unexplained until proven.

### A letterbox is not necessarily 16:9 — measure it
Two QOTSA Eurockéennes discs, same taper and channel: the 2005 picture is rows 72-503 (exactly 16:9),
the 2007 picture rows 56-519 (1.66, nearer 5:3). Record the rows and the ratio they give. Both are legacy
crops (`a096956b26e1` `4:3 (letterboxed 16:9)`, `cdd7abcd3d24` `4:3 (letterboxed 5:3)`) — leave them.

### A record captured once can still have NO saved capture rule
A 2026-09-29 re-pick of 107 shows found 20 that would not plan: their mapping (two-disc sets,
time windows, a Blu-ray folder, a renamed folder, a drive typo) had been done by hand and never written
to `splits.json`. Prove each by re-hashing its `RepVideoFiles`, save the rule, and plan subsets with:

```bash
set -o pipefail      # so a refused plan stops the chain even through the pipe
python3 ~/VaultShots/plan_subset.py --label L --ids ids.json | tee plan.log && \
  ~/VaultShots/run_artist_noplan.sh L                  # ids.json: {artist: [ShowID, ...]}
```

### Five "FOTTP" discs held eighteen programmes
Stereophonics' `FOTTP 1/2/4/7/10` fan compilations were five records for eighteen titlesets, each a
separate programme, every record with its disc's whole sidecar as `Setlist` and one describing *Later*
2002 while keyed to Rock am Ring 2003. They are now one record per titleset, each keyed by a real content
hash over `VTS_NN_0..n.VOB`. **A disc named only by a volume number is a multi-show folder until swept.**

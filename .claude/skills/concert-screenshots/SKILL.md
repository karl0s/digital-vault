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

- `ffmpeg` + `ffprobe` with **libpostproc** (`ffmpeg -version | grep enable-postproc`) for
  `pp=lb` blend deinterlacing.
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
  misses entirely. Require ≥2 artist tokens, or a known alias (`30stm`).
- **Accept loose single files, not just directories.** A `.mkv`/`.ts` sitting at the drive
  root is a show. An `is_dir()` check silently drops these — it cost 5 of 21 shows.
- **Exclude backup/duplicate trees** (e.g. a "PC backup" folder) by path substring.
- Link back to `shows.json` **only when the match is strong** (≥3 distinctive token overlap).
  Weak name matching mapped 14 different folders onto 7 records. Record the link as metadata;
  never let it define identity.

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

### 4.1 Compute the target from SAR

```
target_w = round(width × SAR_num / SAR_den)   # round to even
target_h = height
```

Real examples from one artist's collection:

| Stored | SAR | Correct output | Naive output | Error |
|---|---|---|---|---|
| 704×576 | 12:11 | **768×576** | 704×576 | 8% squash |
| 720×576 | 64:45 | **1024×576** | 720×576 | **30% squash** |
| 720×576 | 16:15 | **768×576** | 720×576 | 7% squash |
| 720×480 | 32:27 | **854×480** | 720×480 | 16% squash |
| 1920×1080 | 1:1 | 1920×1080 | 1920×1080 | correct |

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

### 4.5 Filter chain and ORDER

```
crop=<w:h:x:y>          # only if letterboxed; strips bars FIRST
pp=lb                   # blend deinterlace, ONLY if interlaced, at native resolution
scale=<tw>:<th>:flags=lanczos
setsar=1
```

Order matters: deinterlace **before** scaling, or you blend already-resampled lines. Crop
before both.

### 4.6 Deinterlace conditionally

Read `field_order` from ffprobe. `tt`/`bb`/`tb`/`bt` = interlaced → deinterlace.
`progressive` → **do not touch it**; blending a progressive HD source softens it for nothing.

`pp=lb` (linear blend) is artifact-free on motion but soft. `bwdif` is sharper on stills.
Offer an A/B on one interlaced show before committing a whole artist.

---

## 5. Duration and seeking — containers lie

### 5.1 Measure true runtime by demuxing

**Failure this prevents:** a 472 MB VOB reported `duration=13.87s` and `bit_rate=283 Mbps`.
Six of 21 shows reported near-zero runtime, which would stack every frame at t=0.

Trust the container only when its duration implies a sane bitrate:

```python
if reported > 1 and total_bytes * 8 / reported < 30e6:
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

**QA gate:** if any show finishes with 0 usable frames, the run is not complete.

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

Any frame failing 5–7 is **deleted and logged**, never kept. Report the count.

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

---

## 11. Output naming and promotion

| Stage | Naming |
|---|---|
| Candidates | `work/<key>/<key>_c###_tHH-MM-SS.jpg` |
| Picks (staged) | `picks/<Folder Name>__<A|B|C|spare>.jpg` |
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

**Then verify against git, not the filesystem:** every manifest entry must map to a file that
is tracked *or staged*. A disk-only audit cannot catch this class of bug.

---

## 12. Pruning

Only after picks are locked **and verified to resolve**:

- **Keep:** every picked frame + the top-24 shortlist per show + all contact sheets.
- **Delete:** all other candidates.

Reference run: 7,509 frames / 598 MB → 506 frames / 36 MB. Keeping the shortlist means picks
can be revised without re-capturing.

---

## 13. End-to-end QA checklist

- [ ] Staging directory is outside the repo and outside the drive; assertion in place
- [ ] Work-dir keys unique — `len(set(keys)) == len(keys)`
- [ ] Every show has a plausible duration (no zeros; demuxed where the container lied)
- [ ] Interlaced shows deinterlaced; progressive shows untouched
- [ ] Every show's target dimensions derived from SAR, not assumed
- [ ] Suspicious aspect flags (SD 4:3 dated ≥2008, non-standard ratios) visually verified
- [ ] Letterbox checked at ≥2 timestamps
- [ ] Full-collection dimension audit reports **0 wrong dimensions**
- [ ] No show finished with 0 usable frames
- [ ] Every show retains ≥24 candidates after filtering (flag any that don't)
- [ ] Contact sheets built for every show
- [ ] Picks recorded by timestamp and **all resolve** to files
- [ ] Picks page shows real images, not index numbers
- [ ] Content traps identified and reported (compilations, split bills, awards shows)
- [ ] Collection drive unmodified; repo clean
- [ ] Pruning only after picks verified

---

## 14. Reference implementation

`shots.py` and `subject.py` in this skill directory implement the above.

```
python3 shots.py plan --artist "<Artist>"     # probe, compute targets, run gates
python3 shots.py capture --deint "pp=lb"      # extract + verify every frame
python3 shots.py score --top 24 --mindist 12  # filter crowds/graphics/blur, rank
python3 shots.py contact                      # contact sheet per show
python3 shots.py ab                           # deinterlace A/B comparison
```

Paths at the top of `shots.py` (`HD_ROOT`, `REPO`, `HOME`) are the only things to change per
collection. `data/overrides.json` holds per-show aspect corrections.

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
- [ ] Suspicious aspect flags (SD 4:3 dated ≥2008, non-standard ratios) visually verified
- [ ] Letterbox checked at ≥2 timestamps
- [ ] Full-collection dimension audit reports **0 wrong dimensions**
- [ ] No show finished with 0 usable frames
- [ ] Seek pass produced DISTINCT frames (not N copies of one) — check content hashes
- [ ] Every show retains ≥24 candidates after filtering (flag any that don't)
- [ ] Contact sheets built for every show
- [ ] Picks recorded by timestamp and **all resolve** to files
- [ ] Picks page shows real images, not index numbers
- [ ] Content traps identified and reported (compilations, split bills, awards shows)
- [ ] Collection drive unmodified; repo clean
- [ ] Pruning only after picks verified
- [ ] `picks/` regenerated after any `picks.json` edit; every pick resolved to a file
- [ ] Promotion sources from `picks/`, not `work/`
- [ ] Loose media files at the drive root checked for missing records
- [ ] New records: unique ShowID, unique checksum, valid date format
- [ ] Split bills given derived checksums, documented in Notes
- [ ] `git add -f` used; every manifest entry tracked or staged (verify against git, not disk)
- [ ] No verification step can pass silently on failure

---

## 17. Runbook — the exact order for one artist

Every step that lived only in my head across two artists caused a bug. This is the sequence;
follow it in order.

```bash
cd ~/VaultShots
A="Stone Temple Pilots"

# 1. SCOPE (seconds) - how many images are actually wrong? See §14.
#    If nothing is squashed and the stills are fine, stop here.

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
python3 scripts/health-check.py              # in the repo
git add -f public/images/ public/image-manifest.json
#    assert every manifest entry is tracked or staged (§11), then commit

# 9. ARCHIVE - park the run so the next artist starts clean
python3 shots.py archive
```

**Step 9 is not optional.** Leftover `picks.json` / `scores.json` from the previous artist
will silently skip or mis-resolve during the next promotion.

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

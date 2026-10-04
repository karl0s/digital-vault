---
name: concert-screenshots
description: Capture high-quality, correctly-proportioned screenshots from concert video on an external drive, for any band and any source format (DVD/VOB, Blu-ray, TS, MKV, MP4, HD broadcast). Use when asked to take, redo, grab or improve screenshots/stills/thumbnails for shows, or when existing images look squashed, stretched, blurry or wrong. The collection drive is read-only and capture is staged in ~/VaultShots; after the owner signs off, promotion writes the images and manifest into the repo, alongside any record corrections made during the run.
---

# Concert Screenshot Capture

A repeatable pipeline for pulling stills from a live-music collection. Derived from a full
run over 21 Thirty Seconds to Mars shows spanning nine distinct source formats. Every rule
below exists because something went wrong; the failure is documented alongside the fix so
you can recognise it rather than rediscover it.

---

## 0a. RUN IT OFFLINE — the cost of this task is attention, not compute

**Failure this prevents:** a 27-show artist burned a daily credit limit in about an hour. Almost
none of it was the capture. It was an assistant *babysitting* the capture — a tool call every
minute to check progress — and then reading one full-size contact sheet per show.

The arithmetic that matters:

| What | Cost |
|---|---|
| One contact sheet at 2400×1900 | **~6,000 vision tokens** |
| 27 of them | **~160,000 tokens, before a single decision** |
| One review montage of the 4 chosen picks × 27 shows, 300px thumbs | **~7,000 tokens total** |
| Each progress-check turn | a full context re-read, for one line of output |

**The default workflow is therefore:**

```bash
~/VaultShots/run_artist.sh "Incubus"      # plan → capture → score → contact → autopick
                                          # → materialise → review montage, then exits
```

Start it with `run_in_background: true`, **wait for the completion notification, and do not
poll.** Then read **one** image: `reports/review.jpg`.

- `autopick.py` chooses A/B/C/spare from `scores.json` with no model at all. The scorer already
  measures what the briefs ask for — `conc` for a close-up, `spread` for a wide, dHash distance
  so the four are not the same two seconds.
- `reviewsheet.py` builds the montage. 300px is enough to judge *is this a close-up, is this the
  right band, is this a title card*. It is not enough to judge fine focus — which is what the
  scorer is for.
- **Only pull a full contact sheet for a show the montage shows something wrong with.** One or
  two per artist, not twenty-seven.

**Hand-picking is a correction pass, not the first pass.** Auto-pick, look at the montage, and
override the handful that are wrong — `picks.json` is plain JSON and `shots.py picks`
re-materialises in seconds. On Incubus the auto-picker independently chose the same frame as a
human for several shows.

**What still needs eyes, and what does not:**

| Needs a model | Does not |
|---|---|
| Split bills — whose segment is this? | Which frame is sharpest |
| Title cards, adverts, wrong programme | Whether four picks are distinct |
| Is the record's identity right? | Geometry, dedup, blank detection |
| Final judgement on the montage | Anything already in `scores.json` |

For a split bill or an unidentified disc, build a **timeline sweep** (evenly spaced, 300px) — one
image, not a shortlist per show.

### 0a-0. Ask the owner BEFORE sweeping — they know the collection

The single largest waste in a long session is the model identifying discs the owner could name in
one line. Two examples from one artist: a titleset swept, montaged and still unidentified was
answered with "VTS_01 is a full Jet set"; another with "VTS_02 is T in the Park 2009". Each answer
cost the owner a sentence and had cost several decode-and-montage rounds to *not* establish.

So the order is: **`preflight.py` → one identification page → ask → then capture.** Build ONE html
page of every ambiguous titleset (§0a-1 sizing) and ask about all of them together, rather than
sweeping, guessing, being corrected, and re-picking one show at a time.

State plainly which ones you *can* identify from on-screen evidence and which you cannot; the
owner then only has to answer the gaps. Captions, channel bugs and credits settle many of them for
free — a CBS eye, an NBC peacock, "LIVE FROM NEW ZEALAND", "Dauerfernsehsendung", a
"Last Call with Carson Daly" credit roll.

### 0a-1. The montage ladder — spend resolution only where the question is

Identifying an unknown disc is a *search*, and search should start cheap and narrow. Measured
on a 16-programme compilation (~120 min):

| Step | What it answers | Cost |
|---|---|---|
| Whole disc, one row per titleset, 132px thumbs | where are the segment boundaries | ~4-5k |
| Six frames per titleset, 220px | what is each programme | ~5k |
| Two suspect rows, 220px | is that dark frame bad or just dark | ~1.5k |
| One titleset, full res 704px | reading an on-screen name caption | ~2.5k |

The whole disc was identified for well under the **~6,000 tokens a single full-size contact
sheet costs**. Never open a per-show contact sheet during identification — it answers a
question you have not asked yet.

**Escalate, do not broadcast.** Go up a rung only for the rows that are still ambiguous, and
only by as much as the question needs. "Is this a house tour or a stage?" is legible at 132px.
"Whose name is in the lower third?" needs full resolution — but only for that one titleset.

**Downscale the montage rather than dropping frames.** A 2679x5376 sheet is ~19k tokens; the
same sheet at 0.52 scale is ~5k and still answers the structural question. Losing frames loses
coverage; losing pixels usually does not.

### 0a-2. NEVER open a per-show contact sheet to choose a hero

**Failure this prevents:** a 60-show artist where 23 heroes had to be replaced after the owner
reviewed them, and ~20 contact sheets (~6,000 tokens each, ~120k in total) were read to fix
them — while producing *worse* picks than the cheaper method.

The contact sheet renders `scores.json`'s shortlist. That shortlist is ranked by a score that
rewards a sharp subject against a quiet background, so **on a dark or wide-camera source it is
systematically wide shots** — the close-up you need is not in it at any size. Measured on this
artist: on the three Philipshalle sources, Astoria, Madrid and Shepherd's Bush the shortlist
held **no close-up at all**, while a sweep of the same captures held a dozen each.

**Sweep the full capture instead**, at 150px, ~40 frames per show, three shows per image:

```python
fs  = sorted((Path("work")/key).glob("*.jpg"))
sel = fs[::max(1, len(fs)//40)][:40]        # whole runtime, evenly spaced
```

~4k tokens for three shows against ~6k for one contact sheet, and it contains everything the
show has rather than what one metric liked. Open a contact sheet only when you have a specific
question the sweep raised.

**`conc` does not find close-ups on a dark source either.** It measures how much one region
dominates the frame, which a bright wide shot satisfies as readily as a face. A conc-ranked
candidate montage built on this artist returned 104 frames of which almost all were wide
stages, and the sweep had to be run anyway. Skip it; go straight to the sweep.

### 0a-3. The cheapest order that still gets it right

Every expensive detour on the reference run came from doing these out of order.

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

A 60-show artist fits comfortably under ~60k tokens of review this way. The reference run spent
roughly four times that by reading contact sheets and re-picking one show at a time.


## 0b. RUN `preflight.py` BEFORE CAPTURING — one pass, not twenty round trips

```bash
python3 ~/VaultShots/preflight.py --artist "Kings Of Leon"
```

**Failure this prevents:** a 50-record artist where every structural fault was found *one at a
time, through conversation* — a disc that was three festivals, a record with no checksum, two
loose files at the drive root, nine wrong durations, a record whose metadata was entirely empty.
Each discovery cost a round trip. They are all detectable in one cheap read-only pass.

It reports five things, none of them a conclusion — each is a folder or record to LOOK at:

| Check | Why it matters |
|---|---|
| Records with no `ChecksumSHA1` | Cannot carry images at all — the checksum is the key |
| Duplicate groups that disagree | Sources of one show scatter on the site instead of sorting together |
| Loose media at the **drive root** | Folder discovery never reaches them |
| Folders with >1 titleset | A record usually covers only one of them |
| `DurationSec` vs `TotalSizeHuman` | An implied bitrate outside 0.3–40 Mb/s means the scan timed one VOB part |

Its matching is deliberately loose — artist tokens, the separator-stripped name, **and the
initials** — because `KOL` and `Janes` each hid shows behind a name that shares no token with the
artist.

**Known limitation:** the duration check false-positives on split records, which inherit the
whole disc's `TotalSizeHuman` while carrying one segment's duration.

### FOUR ways preflight and discovery reported "none" for things that were there

**Failure this prevents:** a single artist exposed four separate silent-shortfall bugs in one
session, three of them in the pass that exists specifically to prevent silent shortfalls. Every
one printed a clean, confident, wrong answer.

| Bug | What it printed | Why |
|---|---|---|
| `preflight` matched the artist with `==` | `PRE-FLIGHT silverchair 0 records` | the run was invoked lowercase; `shows.json` holds `Silverchair`. Checks 1, 2 and 5 then reported "none" for an artist with seven records |
| its initials alias was one letter | all 44 loose root files listed as candidates | `"".join(w[0] for w in artist.split())` is `"s"` for a single-word name, and `"s" in name` is true of everything. The R.E.M. empty-token bug with the sign flipped |
| its multi-titleset check looked one level deep | `4. FOLDERS WITH MORE THAN ONE TITLESET: none` | the folder held two whole nested discs with VOBs at each disc's root and no `VIDEO_TS` at all — eight titlesets, invisible |
| `discover()` required >=3 shared tokens to link | two folders `unlinked`, no message | `Silverchair - 1999 Australia` leaves `{1999, australia}` once the artist tokens are removed. The ceiling is 2, so an EXACT `FolderName` match could never link |

The fixes, all small:

```python
mine = [s for s in shows if (s.get("Artist") or "").casefold() == artist.casefold()]
if len(initials) < 2: initials = ""          # no alias for a single-word artist
for base in [d] + sorted(q for q in d.iterdir() if q.is_dir() and q.name != "VIDEO_TS"):
    for cand in (base/"VIDEO_TS", base):     # each nested disc is its own tree
        ...
if not strong:                               # exact FolderName is decisive on its own
    exact = [sh for sh in mine if (sh.get("FolderName") or "").strip().casefold()
                                  == base.strip().casefold()]
    if len(exact) == 1: best, strong = exact[0], True
    elif len(exact) > 1: print("AMBIGUOUS ... link by hand")   # never guess
```

Three things worth carrying forward:

- **Case-fold every artist comparison.** The artist name arrives from a shell argument and will not
  match the record's capitalisation.
- **Any derived alias needs a minimum length.** Initials, squashed names and token sets all degrade
  to "matches everything" when the source name is short, and the degradation is silent.
- **A link threshold must have an exact-match escape hatch.** A rule tuned to reject weak overlaps
  will reject perfect ones too when the name is short. Refuse ambiguity loudly; never first-match.

The nested-disc fix immediately surfaced a Kings of Leon folder
(`T in the Park 2007-08-24/Kings…`, five titlesets) that had been invisible to every previous run.

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

### Setlists cannot be lost silently — the guard blocks the push

`health-check.py` compares `Setlist` against the last commit and **fails** when songs would
disappear. It runs as the pre-push hook, so a loss cannot reach the remote.

- **Splits pass automatically.** Songs that move to a record which *gained* them are re-homed,
  not lost. Matching against any record in the file is far too loose — an artist plays the same
  songs every night, so dropping two real tracks from one show gets silently excused by another
  show that also plays them. The guard failed exactly this test before being tightened.
- **Deliberate removals need a reason on record**, in `scripts/setlist-removals-approved.json`,
  with the exact strings and a `why`. Anything removed without an entry blocks the push.

### A populated Setlist is not a checked Setlist

**Failure this prevents:** eleven records across two artists had `Setlist` fields full of things
that were never songs, and every one of them looked healthy because the field was non-empty and
the count was plausible.

| Record | What was in Setlist |
|---|---|
| Foo Fighters — Vancouver 1998 | **Green Day's thirteen songs**, under a Foo Fighters record |
| Foo Fighters — VH1 Storytellers | `Didn't; figure; out` — an English sentence split on spaces |
| Foo Fighters — Rock en Seine | three header lines + eight lines of DVD transfer notes |
| Foo Fighters — Reading 2012 | band, festival and venue lines + `Runnin Time - 2hrs 20m` |
| Chris Cornell — Argentina 2007 | `Full Concert`, `Cover Included`, `Thanx to PREACHER from BTARG` |

The cause is always the same: somebody pasted a sidecar wholesale into the field. The header
block and the trailer notes came along with the songs.

**Check the ends, not the middle.** The junk clusters at the top (band, venue, date, city) and
at the bottom (running time, lineage, credits, "thanx to"). A quick scan of the first and last
three entries of any long setlist finds nearly all of it.

Two entries that look like junk but are not: a segment the disc genuinely numbers as a track
(`Interview (cuts in)`, `Dave Talks`, `jam`) belongs in `Notes`, not deleted silently; and real
songs do collide with junk patterns — Kings of Leon's *Taper Jean Girl*, Clapton's *Running on
Faith*, Foo Fighters' *February Stars*. A detector that matches on a prefix will delete them.

### One recording, two bands — check WHOSE songs are in the record

**Failure this prevents:** the Vancouver 1998 record was filed under Foo Fighters and its
setlist was Green Day's. The scored shortlist was almost entirely Green Day too, so picking
from it would have shipped Green Day images under a Foo Fighters name.

On any folder whose name contains `+`, `&`, `with`, `VA -` or two artist names:

1. **Sweep the whole runtime** with an evenly-spaced sheet before looking at the shortlist. The
   shortlist answers "which frames look good", never "who is on stage".
2. **Find the boundary** and write it into `Notes` as a timestamp.
3. **Pick only inside the segment.**
4. **Check the setlist belongs to the artist on the record** — the fastest tell that a folder is
   a split bill at all.

Worked examples: Green Day hold Vancouver until ~00:47 with Foo Fighters from 00:57:30; Filter
occupy 03:38–06:07 of a 73-minute Experience Music Project broadcast otherwise full of Kid Rock,
Red Hot Chili Peppers, Eminem and Snoop Dogg.

### Splitting when the shows are NOT separable at file level

A titleset or VOB split gives each show its own real checksum. A **time-window** split cannot —
both sets live in one continuous stream. Derive the second record's identifiers instead, so they
are unique and reproducible:

```python
DISC       = "greenday"                       # short, stable discriminator
gd_showid  = sha1(folder_path      + "|" + DISC).hexdigest()[:12]
gd_checksum= sha1(primary_checksum + "|" + DISC).hexdigest()   # NOT a content hash
```

The discriminator is whatever separates the shows — the date, the venue, or the artist for a
split bill. Use the same value in both derivations.

The **primary** record keeps the folder's real `FolderPath`-derived ShowID and real
`ChecksumSHA1`. Record in both `Notes`: the sibling's ShowID, the segment boundary, and the fact
that the identifiers are derived — **not a content hash**, so nobody later mistakes it for a scan
artefact. Images key on `ChecksumSHA1`, so a derived checksum is what gives the second show its
own image slots. This is the one statement of the formula; §10b step 4 and §13 point here.

### Generated pages: percent-encode filenames

**Failure this prevents:** a folder named `PRO #1 + 2002-09-12 PRO #1` produced four dead images
on the picks page. A browser reads `#` as the start of a URL fragment, so the path truncated —
while the files were correct on disk and `check_report_links.py` passed, because it resolved the
raw string against a filesystem where `#` is an ordinary character.

- Build `src`/`href` with `urllib.parse.quote(name, safe="/")`, not HTML-escaping alone.
- Make the checker **cut at the first `#` before unquoting**, exactly as a browser does.

`&` needs URL-encoding for the same reason and has bitten this project before. HTML-escaping it
to `&amp;` is not the same fix.

### Read the sidecar for SETLIST too — not just for identity

**Failure this prevents:** sidecars were being opened to answer "is this one show or
two?" and then closed. Their setlists were never looked at. Seven artists went through
capture that way. The Jimmy Kimmel record created during the Chris Cornell run shipped
with an empty `Setlist` while a `Track List` sat in the same folder naming both songs.

At capture time, for every folder, extract from the sidecar in this order:

1. **Setlist** — a numbered track list. Write it, formatted to house style.
2. **Date, venue, city** — often more precise than the record.
3. **Lineage** — evidence for aspect and quality decisions.
4. **Segments that are not songs** — interviews, soundchecks. These go in `Notes`,
   never in `Setlist`.

Verify afterwards, per artist:

```bash
python3 scripts/audit-sidecar-setlists.py --artist "Bush"
```

**A record's existing setlist can be worse than empty.** Chris Cornell's Argentina 2007
`Setlist` opened with `Full Concert; Internal ProShot DVD (never aired); Cover Included;
Thanx to PREACHER from BTARG` — four provenance lines from the sidecar header, imported
as songs — and was missing two real tracks. A populated field is not a checked field.

**Comparing sidecar to record is harder than it looks.** Four rules the audit had to
learn, each from a false positive that would have trained the reader to ignore it:

| Trap | Example | Rule |
|---|---|---|
| Running times | `Spoonman (6:13)` | strip a trailing `(m:ss)` |
| MediaInfo dumps are numbered too | `000000 seconds of audio timestamp gaps.` | reject technical lines |
| Loose substring folder matching | a **Blink-182** folder pooled with a **30 Seconds to Mars** record | exact or suffix match only |
| Medleys are written differently everywhere | `Bela lugosi is dead - 4th of July` vs `Bela Lugosi's Dead / 4th of July` | word-overlap match for entries of 5+ words |

And one folder can hold several shows, so after a split the songs live across sibling
records — **pool every record derived from a folder** before calling anything missing.

### The recording outranks every external source

Captions, banners, backdrops, title cards and tickers are **primary evidence about this
recording**. A published setlist is crowd-sourced and routinely partial. When they disagree,
write what the video shows, mark a partial setlist `(incomplete)`, and put the conflict in
`Notes` so it stays visible.

Worked example: Rock in Rio 1991 captions `MY MICHELLE` on screen at 01:05:57, while setlist.fm
and the a-4-d fan archive both omit it from *both* possible nights. A full-runtime sweep
confirmed one continuous concert, so the sources are incomplete — not the disc.

**Do not stall on a date.** Use external sources to choose between candidates the recording
narrows down, commit to the best-evidenced one, and state the evidence. Rio was narrowed to two
nights by the band's own itinerary and settled by the pro-shot TV broadcast being the first
night, 20 January.

The recording also frequently identifies the show outright, and this has repeatedly beaten the
record: a "GUNS N' ROSES — WELCOME BACK TO THE RITZ" banner proved two records were one concert;
a Live Earth lower-third dated a Foo Fighters record to the day; an MTV caption bar supplied a
whole Tokyo Dome setlist.

**Read song captions with a strip sweep, not the capture.** The capture samples every ~5 s and a
title card is up for about that long, so it misses some. Decode only the caption region at 2 fps
to raw greyscale — one pass, no files per frame — then score each frame for bright, sharp-edged,
*static* strokes (text holds still while the picture moves) and montage one frame per run:

```bash
ffmpeg -i SRC -an -vf "fps=2,crop=iw*0.40:ih*0.14:0:ih*0.82,scale=480:-2,format=gray" -f rawvideo strip.gray
```

This is analysis, not capture, so hand-rolling ffmpeg is fine here. MPEG-2 has no VideoToolbox
decoder; drop `-hwaccel` or it floods the log and decodes nothing.

Worked example, Soundgarden Lollapalooza 2010 "Palladia Full": fifteen caption runs across 48:47,
and the second half **repeated the first** — the Searching, Spoonman, Rusty Cage and Blow Up
captions recurred exactly 30:45 later, and the frames at the seam showed the TV-PG card and the
programme title coming round again. The file was one airing of a seven-song edit plus eighteen
minutes of the rerun. The record held the twenty-song concert set. **A folder named "Full" is not
evidence of a full show, and a caption that appears twice means a repeat, not an encore.**

### Sidecars are authoritative for their own show

A sidecar inside the show's folder does not need corroboration. It was written from the
disc by whoever made it, so it is primary evidence about this recording. Read every one
before capture, and write what it says into the record with the filename in `Notes`.

Fenix Underground is the worked example: `Info/chris cornell dime torrent.txt` gave a
14-song setlist for a record that had none, and the lineage `Sky HDTV Receptor > Samsung
DVD Recorder R150 > DVD-R` - an HDTV source, which independently confirmed the 16:9 aspect
correction that a squashed still had prompted.

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

### The dedupe index is a CACHE — the drive is ground truth

**Failure this prevents:** `discover()` enumerated `units` from `MediaDeduper`'s sqlite index and
dropped any row whose path no longer existed — silently, via an `is_dir()` test. A folder renamed
on the drive since the index was built therefore vanished from the plan with no message at all,
and the show simply was not captured. On this collection **61 cached paths are dead and 7 drive
folders are not in the index at all**, spanning five artists.

Union the cache with a live top-level scan, and make the dead-path drop loud:

```python
known = {u["rel_path"] for u in units}
for q in sorted(HD_ROOT.iterdir()):        # the drive, right now
    if q.name not in known and (q.is_dir() or q.suffix.lower() in VIDEO_EXT):
        units.append({"rel_path": q.name, "kind": "dir" if q.is_dir() else "file"})
...
print("DEAD PATH %s in the index, not on the drive" % rel)      # never `continue` in silence
```

**Do not "fix" this by rescanning.** A full `dedupe.py scan` re-hashes ~46,000 files / 2.6 TB for
no correctness gain — the union above is instant and the index still earns its keep, because it
correctly models nested discs (`Artist/Disc 1`, `Compilation/rar`) that a naive one-level walk
either misses or double-counts.

### To find shows with NO record, match on SIZE not on name

Name matching is useless for this: the collection has been reorganised, so a folder's current
name often shares almost nothing with the record written from its old one. Comparing each drive
unit's media bytes against every record's `TotalSizeBytes` (±2%, plus one shared distinctive
token) cut 76 false candidates down to **20 genuinely undocumented units**. Tokenise the unit's
PARENT as well as its basename, or every `Disc 1` scores zero against its own record.

### Artist matching: four ways a show goes invisible

Both of these were found on Green Day, and each had silently dropped a show from the run.

**1. The squashed name.** A folder may write the artist as one word — `Greenday 1998-03-15 -
NHK Hall`. A `>=2 of {green, day}` token rule never matches it, and the show is simply never
seen. That folder had no record at all, so nothing else would have caught it either. Always
add the separator-stripped name as an alias:

```python
squashed = re.sub(r"[^a-z0-9]+", "", artist.casefold())
if len(squashed) > 4:
    ALIASES.add(squashed)
```

**2. Stopwords deciding ownership.** The cross-artist rejection rule (§2) compares how strongly
a folder matches OTHER artists. Counting every token let **Presidents of the USA** score 3 on
`{of, the, usa}` against `Green Day - 1998-04-17 - Bottom Of The Hill, San Francisco, CA, USA`
— beating Green Day's 2 on `{green, day}` — and the folder was skipped as theirs.

Score on **distinctive tokens only**. Strip articles and prepositions, and strip the geography
and format words that appear across half the collection: `usa us uk ca ny la live band pro shot
dvd tv hd hdtv ntsc pal ws concert show set master disc`. After stripping, Green Day scores 2
and Presidents of the USA scores 0.

The rejection rule is still right in principle — it exists because "Bush" pulled in
`Smashing Pumpkins - Shepherd's Bush Empire`. It just has to compare on words that identify.

**3. The joined-name record — and how split bills are filed now.** Two MusiquePlus tapes
(2000-11-14) were filed under a joined name: `Artist` literally `Incubus / Deftones`. An
exact-match filter (`s["Artist"] == artist`) saw neither band, so the shows were invisible to
BOTH artists' runs and to search on the site, and the folders were invisible to discovery because
nothing linked them. They sat unscreenshotted through a complete 27-show run and only surfaced
because the collector knew they existed.

**Settled by the owner, 2026-09-30: one record per band, per tape**, each time-windowed to that
band's performance only, with its own setlist and stills. A joint segment (the interview between
the sets) belongs to neither. The two tapes are now four records — Incubus `34f2923f1e57`,
`6aa691481fa9`; Deftones `d4081bb1afc6`, `70dabb713576`. The disc hash stays on the Incubus
record and the Deftones record carries a derived key ("Splitting when the shows are NOT
separable", above), as on the Bush / James Brown Woodstock disc (`668e6eb35ec7` /
`ba6597e650d8`). Since 2026-10-04 each such shared broadcast also has a Various Artists master
that both bands' records link to (`ParentShowID`, `SegmentStart`/`SegmentEnd`) — `9b53a1e2629d`
and `527cba4f7921` for the two tapes, `c741c689c2a7` for Woodstock — made with the `va-masters`
skill (§10). Split a new one only where the bands' sets are separable in time, and confirm with
the owner first.

No joined names remain, but match the artist as a **token of a separator-joined field**, not as
the whole field, so a new one cannot hide:

```python
parts = [x.strip() for x in re.split(r"[/+&]|\bwith\b|\band\b", s.get("Artist") or "")]
mine  = artist in parts or s.get("Artist") == artist
```

Then sweep for them directly before declaring a run complete:

```bash
python3 -c "
import json
a='Incubus'
for s in json.load(open('public/shows.json')):
    art=s.get('Artist') or ''
    if a.lower() in art.lower() and art != a: print(s['ShowID'], repr(art), s.get('FolderName'))
"
```

**4. The possessive apostrophe.** `Jane's Addiction` tokenises to `{jane, addiction}`, because
the apostrophe is a separator. Folders overwhelmingly spell it `Janes Addiction` → `{janes,
addiction}`. Overlap falls to 1, under the `>=2` rule, and **15 of 19 shows were dropped in
silence** — the run reported `ready: 4  skipped: 0` and looked like a clean success. Only the
four folders that happened to use an apostrophe survived.

Strip apostrophes **before** splitting, so the possessive collapses rather than fragments:

```python
x = x.replace("'", "").replace("\u2019", "")     # "Jane's" -> "janes"
```

Both spellings now yield `janes`. No regression for `Guns N' Roses`: its `N'` was a
single character and was always dropped.

**QA gate, and the general lesson:** compare the number of folders discovered against the number
of `shows.json` records for that artist, and *stop* if discovery found fewer. `skipped: 0` only
means nothing was rejected after matching — it says nothing about what never matched at all. A
silent shortfall is the default failure mode of every rule in this section.

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
`LETTERBOX` (`letterboxed - needs cropdetect`: a legacy two-part record, §4.3, which it cannot
check from metadata) or unknown geometry.

**It deliberately re-implements `fit_no_downsample` rather than importing it**, so the audit
still fails if the pipeline's rule regresses. Two independent statements of the rule are the
point; sharing one would let a bug hide from its own test.

Run with no arguments it prints the current collection-wide figures and ranks artists worst
first — that, not a number written here, is where progress lives. Most squashed images predate
this pipeline: they were written at raw pixel dimensions with no SAR correction at all.

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

### 4.3 Letterbox and pillarbox: KEEP the bars, MEASURE them at two or more timestamps

**House rule — the owner's: capture the whole stored frame, bars included. Never crop.** Losing
picture is worse than carrying bars, and a crop is per-source, so on a disc that mixes shapes
(§4.3b) it necessarily cuts the segments that fill the frame. Bars carrying a broadcaster's
captions or logo are kept for the same reason. He said it of three Supergrass discs at once
(2026-08-27) — *"keep aspect as is to capture all screen do not crop important details"* — and
made it the rule for every source on 2026-10-05.

Still **measure** the bars — the rows are evidence:

- Sample at ≥2 points (e.g. 30% and 55%) and only trust a **consistent** result. cropdetect on a
  single dark frame returns a bogus answer: one show sampled at 55% reported `636×556` when the
  true frame was full-width; a second sample at 30% exposed it. On VHS or off-air masters use a
  row profile instead (§4.3b).
- Write the picture's rows, and the ratio they give, into `Notes`. `AspectRatio` stays the
  **frame** ratio (next section).
- A picture that measures to a non-standard ratio inside a standard frame can mean the **flag** is
  wrong, not the bars (Limp Bizkit, Field lessons). Fixing a wrong flag with a `dar` override is
  not a crop, and is wanted (§4.4).

**Legacy:** the eight `crop` rules already in `data/overrides.json` predate this rule. Leave
them; add no new ones. If one is ever recaptured, its target comes from the **cropped** pixels
and the SAR, not the full frame's DAR (that mistake produced `606×404` instead of `720×404`).

### 4.3b cropdetect is BLIND to a VHS letterbox — profile rows from bright frames

`cropdetect` returned FULL FRAME on two letterboxed Supergrass discs, unanimously, over 1,026 and
3,486 samples. Their bars come off VHS and off-air masters and sit at luminance **8-20, never 0**.
No threshold separates that from dark picture.

Profile per-row luminance instead — but only over the **brightest** frames. An auto threshold across
all frames reads a dark stage as a bar and invents letterboxes; on this artist it reported ~2.0:1 on
three sources that are full-frame, and 3.05:1 on one, before the sampling was fixed.

```python
frames.sort(key=lambda r: -mean(r))
m = [mean(c) for c in zip(*frames[:max(10, len(frames)//3)])]   # then read the plateaus
```

Read the printed profile rather than trusting a computed edge. A real letterbox shows three flat
plateaus; a dark picture shows a gradient.

**A single disc can mix shapes.** MTV Five Night Stand letterboxes its concert and fills the frame
for its interviews, which is why cropdetect, a row profile and a rendered frame each gave a different
answer until frames were rendered at native size and looked at. A per-source crop is wrong there —
one reason the bars stay (§4.3).

### The two-part AspectRatio string means the images ARE cropped — legacy records only

`parse_dar` returns the SECOND ratio when the string contains "letterboxed" or "pillarboxed" —
the picture, not the frame — so the tools that read the record (`check_overrides.py`, the
"agrees with shows.json" gate) take the stills to be that shape, and `audit-image-geometry.py`
stops checking the show at all, listing it as `letterboxed - needs cropdetect`. The form
`4:3 (letterboxed 16:9)` therefore belongs only to legacy records whose images were cropped under
a `crop` rule (§4.3). **Never write it for a new capture:** with the bars kept, the record would
describe a shape the stills are not, and the audit would go blind to that show. Keep
`AspectRatio` as the frame ratio and put the measured rows in `Notes`.

### 4.4 Aspect-flag overrides — the flag itself can be wrong

**Failure this prevents:** a 2013 festival DVD declared `SAR 8:9 / DAR 4:3`. That is
*internally consistent*, so it passes every automated check — but the picture was visibly
squashed. A 2013 broadcast is 16:9; the flag was simply wrong.

Detection heuristic — flag for human review when:
- an SD source (704/720 × 480/576) declares **4:3**, has **no letterbox bars**, and the show is
  dated **2000 or later** (or undated) — see "A 4:3 flag with NO bars" below. The cutoff was
  2008 until six 2002–2004 UK broadcasts shipped squashed under it; or
- the computed aspect is **non-standard** (not within 2% of 4:3 or 16:9).

**Verification: never by eye.** Rendering one frame at both shapes and judging it — a drum
head, a face, body proportions — has been wrong three times on this collection (Pearl Jam ACL
2009, Silverchair Melbourne Park 1999, six Stereophonics UK TV sources), and the owner caught
every one. What settles a disputed shape is the owner's A/B (`aspect_ab.py`), a same-performer,
same-era source at an undisputed aspect, a rigid graphic shared with a source of known geometry,
or structure — all set out in the next two sections. Point-light measurements are invalid on SD.

Store overrides in a JSON file keyed by path fragment, with a `why` field recording the
evidence. Never bury an override in code.

### Adjudicate a disputed aspect against a KNOWN source — not by eye, and not off point lights

**Failure this prevents:** Silverchair's Melbourne Park 1999 was set to 16:9, captured, picked and
handed over, and the collection owner said the stills were squashed. He was right. The 16:9 call
came from rendering one frame at both shapes and looking at it — the exact unaided comparison
§4.4 above warns against, made in the same session by someone who had just read that warning.

The disc invites the mistake: `VTS_01_1` declares SAR 16:15 (4:3) while `VTS_01_2..5` declare
64:45 (16:9), on one continuous concert. ffprobe reports the concat's FIRST stream, so the shape
has to be adjudicated rather than read off — and adjudicating it by eye got it backwards.

**Point lights looked like the answer and are not — tested 2026-09-27.** A defocused point light
is circular on screen, so its stored-pixel h/w *should* be the SAR. On SD broadcast material it reads
near-square whatever the truth: Chris Cornell's Rock am Ring 2009 PAL DVD, true anamorphic 16:9
(expected h/w 1.422), read 1.000 / 1.000 / 0.909 / 1.000 over four frame samplings, 0.90 or 1.36 with
a minimum blob size, and 1.10 with sub-pixel intensity moments. Every one calls a 16:9 disc 4:3. The
same code reads exactly 1.000 on square-pixel HD — so a square-pixel control **cannot** reveal the
bias; control with a source of the geometry you are trying to detect. The "0.92" once quoted for
this disc agreed with the owner only because the method reads ~1 on everything SD. **Do not quote a
point-light number as evidence anywhere.**

What does settle a disputed shape: the owner's A/B (`aspect_ab.py`); a same-performer, same-era
source at an undisputed aspect (below); a rigid graphic shared with a source of known geometry; and
structure — two independent captures that share one framing are both uncropped (the Limp Bizkit
Rock am Ring 2009 case, Field lessons).

**Then corroborate against a source whose geometry is beyond doubt** (§4.4): same performer, same
era, undisputed aspect. Philipshalle Düsseldorf (720x576 PAL 4:3) sits four months from Melbourne
Park; the head matches at 768x576 and is broad and flattened at 1024x576.

Three smaller lessons from the same show:

- **A channel logo is a known-proportion reference and it can still be misread.** The Channel [V]
  bug is a square box. It was called "square at 16:9" when it is square at 4:3. Measure the box;
  do not look at it.
- **Where the disc's own flags disagree, pin the answer in `overrides.json` even when the default
  happens to be right.** Without a pin this show captures at 4:3 only because `VTS_01_1` sorts
  first. That is luck, not evidence, and it inverts silently if the VOB order ever changes.
- **An era prior is cheap and was ignored.** Australian television was 4:3 in 1999; widescreen came
  later. One line of context would have outweighed the whole eyeball comparison. Others that have
  held: UK TV widescreen from about 2000; SD festival broadcasts from 2008 usually 16:9; a sidecar
  lineage reading `HD Broadcast > SD DVD` makes any 4:3 flag suspect. A prior is a reason to
  look, not a verdict.

### A 4:3 flag with NO bars on a post-2000 broadcast is a SUSPECT — the owner judges it at both shapes

**Failure this prevents:** Stereophonics shipped six sources squashed — Headliners (Channel 4,
two copies), Re:covered (BBC Three), Later… with Jools Holland 2003 (BBC Two), Glastonbury 2002
(BBC) and Move 2004 (ITV). Every one is 720x576 SAR 16:15, a self-consistent 4:3 flag, with the
picture filling the frame. They are **full-height anamorphic 16:9 broadcasts that an off-air
recorder squeezed into a 4:3 frame.** The owner caught it on the picks page.

Why nothing caught it:

| Guard | Why it passed |
|---|---|
| gate 1 (SAR vs DAR) | the flags agree with each other — they are just wrong |
| cropdetect / row profile | there are no bars; the squeeze is horizontal and invisible to both |
| §4.4's "4:3 but dated 2008+" rule | these are 2002–2004 — UK terrestrial TV was widescreen years before |
| point-light measurement | the implementation used failed its own 16:9 control (Glasgow 2007, true 16:9, measured h/w 1.11 → "4:3"); it was rightly discarded, but nothing replaced it |
| a face compared across the hero montage | this is the unaided eyeball check §4.4 already warns against, and it cleared all six |

**The profile is the trigger, not the verdict.** On the same artist, WDR, SF2 and SIC broadcasts
of the same era with the same flag were genuinely 4:3, and so was a 2002 BBC Two *Later*. So a
4:3-flagged, bar-free, post-2000 source is not *assumed* 16:9 — it is **put in front of the owner
at both shapes before promotion**, which costs him one glance per source:

```bash
python3 ~/VaultShots/aspect_ab.py     # after capture; lists suspects, renders each hero at 4:3 AND 16:9
open ~/VaultShots/reports/<artist>_aspect_ab.html
```

It decodes nothing: stretching a 768x576 capture to 1024x576 *is* the 16:9 capture of that frame.
Add the page to the pre-promotion hand-off alongside the picks page, never after promotion. Record each source the owner
judges in `data/aspect_confirmed.json` (`{ShowID: {"dar": "4:3", ...}}`); `aspect_ab.py` skips those, so
an answered question is never asked twice. Nine Stereophonics sources were confirmed 4:3 this way.

**A dark foreground is not a letterbox.** `aspect_ab.py` once dropped Tool's Big Day Out Sydney 2011
(camcorder from the stands, 4:3 flag, really 16:9) as "has bars": the night crowd along the bottom
averaged luma 3-6 over ~50 rows. But most frames had pixels at 140-200 in those rows - phones, stage
spill. A real bar is black in EVERY frame, so a row now counts as bar only if its mean is dark AND the
95th percentile (over frames) of its brightest pixel stays under 48. The owner then confirmed 16:9 on
the A/B page (a point-light reading was also taken; that method is invalid on SD — see above).

**The A/B is the owner's call — do not pre-judge it.** Every eyeball verdict recorded here was
wrong at least once: faces cleared all six Stereophonics sources, and a side-on drum head passed
Pearl Jam's ACL 2009 as 4:3 (Field lessons). If a reference helps him, the useful one is a circle
square-on to the lens — a mic's grille ring seen head-on, present in nearly every hero frame. On
Headliners it reads visibly taller than wide at 768 and round at 1024. Never a face, and never a
drum shot from the side, which is foreshortened and reads too wide at any aspect.

**Confirmed → fix:** a `dar: "16:9"` override **scoped by `showid`** (split folders share a
`rel`), move the unit's old `work/<key>/` aside, re-plan, recapture that unit, re-materialise.
Timestamps are unchanged, so `picks.json` needs no edit. Write `AspectRatio: "16:9 (native)"` to
the record and say in `Notes` that the disc flag says 4:3.

### An explicit DAR override must not then FAIL gate 1

**Failure this prevents:** adding a `dar` override is the act of adjudicating a SAR/DAR
disagreement — and gate 1 then failed on that same disagreement, so the show was **skipped
entirely** and never captured. Every `dar` override was latently broken this way.

Mark the adjudication and let the gate print both numbers rather than block:

```python
t["dar_overridden"] = True                       # in the dar branch
g1 = d1 <= 0.01 or bool(t.get("dar_overridden")) # in gates()
```

The plausible-band gate must also judge the **overridden** shape, or a bogus implied ratio still
fails it.

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
| `dar` forced | `AspectRatio` → the true ratio, e.g. `16:9 (native)`; the disc's own flag goes in `Notes` |
| none — bars kept (§4.3) | `AspectRatio` stays the frame ratio; the measured picture rows and their ratio go in `Notes` |
| legacy `crop` only — add no new ones | `AspectRatio` → `4:3 (letterboxed 16:9)` / `16:9 (pillarboxed 3:2)` |

On those legacy records the two-part form matters: the FIRST ratio is the stored frame, the
SECOND is the real picture. Tools need both — `audit-aspect-vs-source.py` compares the source
flag against the frame, `check_overrides.py` the crop against the picture.
(`audit-image-geometry.py` does not check these records at all — §4.3, "The two-part
AspectRatio string".)

**This is now enforced, not merely documented.** `check_overrides.py` resolves every override
to its record and fails if the correction is missing; `promote.py` runs it in pre-flight and
refuses to write to the repo when it fails. Run it standalone any time:

```bash
python3 ~/VaultShots/check_overrides.py
```

Two things it taught us when first run against the existing overrides:

- **Match on tokens, and let an override name its record.** A raw substring test is too strict
  (`2013 Rock In Rio DVD` never appears verbatim in a FolderName written
  `2013-09-14, Rock In Rio, …`) and too loose (`BBC Radio 1` also lands inside Ladyhawke's
  `BBC Radio 1's Big Weekend`). Where a fragment is ambiguous, add `"showid"` to the override.
- **A (legacy) crop is in STORED pixels; compare after SAR.** `712:432` looks like 1.648 and
  reads as a mismatch against a correct `4:3 (letterboxed 16:9)` record — until PAL's 16:15
  turns it into 1.758. Derive SAR from the record's own frame ratio (`SAR = frame_dar × H / W`)
  so the check needs no drive access.

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
An internally consistent SAR/DAR pair can still be wrong (§4.4), so settle it with the evidence
§4.4 accepts — the owner's A/B, a same-performer same-era source of undisputed aspect, a shared
rigid graphic, structure — before changing anything. Never by rendering both shapes and looking.

### 4.5 Filter chain and ORDER

```
bwdif=mode=send_frame:parity=auto:deint=all    # ONLY if interlaced, at native resolution
scale=<tw>:<th>:flags=lanczos
setsar=1
```

Order matters: deinterlace **before** scaling, or you interpolate already-resampled lines.
No `crop` — bars are kept (§4.3). A legacy `crop` rule, where one still applies, runs first.

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
   select='lt(mod(n\,K)\,9)' , bwdif , select='eq(mod(n\,9)\,4)' , scale , setsar=1
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

Storage: at `-q:v 2`, four SD frames per show is roughly 200 KB — acceptable across the whole
collection for a repo that already ships the images. Do not lower quality to save space; drop
to three frames per show instead if it ever matters.

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

**A plausible bitrate is not proof either.** Oasis Glastonbury 2004 (three VOBs, 2.59 GB)
reported **34 min** against a true **1:27:13**: 10.2 Mb/s, well inside the window, so it was
trusted and 60% of the set would never have been sampled. A ~2.5x error on a DVD produces a
bitrate that still looks like a DVD. `shots.py plan` now **always demuxes a multi-part
`concat:` source**, as it already did for split units; the container is trusted only for a single
file. Cross-check against a sidecar's stated length whenever there is one.

**The demux fallback ITSELF fails on some discs.** On an MTV compilation,
`ffmpeg -i VOB -c copy -f null -` returned in 0.5 s on a 29 MB file having emitted only
`non monotonically increasing dts`, and ffprobe insisted on 16.8 s — for a file whose real
runtime was ~5 min. When timestamps are not merely wrong but *non-monotonic*, nothing that
reads timestamps can measure the file.

The method that always works is to **decode and count**:

```
ffmpeg -i SRC -vf "fps=1/20,scale=..." -vsync 0 out_%04d.jpg
duration ≈ (number of files) × 20
```

It costs a full decode pass, but it is the only measurement that cannot be lied to, and the
frames it produces are the sweep you were going to need anyway. Sixteen titlesets that ffprobe
called 3-30 **seconds** each measured 3-18 **minutes** each this way.

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

**PARTIAL stuck seeking is the commoner case and the "fewer than half distinct" rule misses it.**
A Pinkpop DVD's timestamps ran out at 20:04 while its content ran to 34:19, so every grab past
that point returned the same last frame: 165 identical images out of 409, i.e. 61% distinct —
comfortably above the threshold, so the fallback never fired and **40% of the show was one
repeated picture**. Judge the worst repeat as well as the overall count:

```python
top = max(Counter(hashes).values())
if len(seen) < max(2, len(hashes)//2) or top > max(4, 0.08*len(hashes)):
    discard and use the single decode pass
```

Tightened this way it fired on **six** further shows in the same artist that the old rule had
passed, three of them with 68, 163 and 195 repeats.

**A seek can succeed and land in a DIFFERENT SHOW.** `Red Hot Chili Peppers - Woodstock 1994 +
1999` is two broadcasts in one continuous stream whose timestamps are not monotonic across the join.
The '94 window's seek path returned 430 of 500 frames - distinct, valid, correctly sized, above every
yield and repeat threshold - and about 200 of them were the '99 festival. The single decode pass,
which counts frames, was correct at the same indices. Pin it for such a unit in `splits.json`:

```json
{"from": "0", "to": "64:10", "showid": "b77e1fdad0f6", "decode": "single", "label": "Woodstock '94"}
```

Verify every time-window unit of a two-show stream across its WHOLE run, not its first and last
frames: strip the broadcaster-bug corner from every 10th frame into one image (~1k tokens). Both
Woodstock units now read circle-V 50/50 and RTL 5 50/50.

**A container that under-reports its duration also under-samples the show.** The same disc's
record said 1203 s and its container 1204 s; the IFO said 2059 s and a frame count confirmed it.
Sampling the reported figure would have covered only the first 58% of the show. Cross-check
`DurationSec` against the IFO playback time before capture, not after (§0b check 5).

**On a WINDOWED unit, verify the rescue LANDED in the window.** A time-window split of the
Eurockéennes disc failed every one of its 120 seeks and the fallback recovered all 120. The
filenames read `t00-35-13` … `t00-41-58`, exactly the requested window — but those names are
computed from the request, not from the picture, so they say nothing about where the decode
actually started. Confirm from the pixels: the first recovered frame carried the disc's
`Supergrass (UK)` title card, which is what proved it. A fallback that silently swept from frame
0 would produce identically plausible filenames over the wrong act entirely.

**This applies to targeted single-frame re-captures too.** Grabbing one replacement frame
from an affected DVD with `-ss` will silently produce nothing. Use the same frame-number
select, computing `n = round(timestamp × fps)` for just the frames you need:

```
-vf "select='eq(n\,1125)+eq(n\,22500)+eq(n\,55625)'" -vsync 0 -frames:v 3
```

Output arrives in **decode order**, not the order you listed - sort your targets by timestamp
before zipping them back to their labels.

### 5.2b When timestamps are broken, INDEX is the only coordinate — not time

**Failure this prevents:** a sweep was built with `fps=1/20` and its thumbnails labelled
`i × 20 s`. Picks were chosen off that montage, converted with `n = round(t × fps)`, and
captured by frame number as §5.2 prescribes. **Every frame came back wrong** — the "close-up of
the singer" was the programme's presenter. Nothing errored; all eight frames were valid,
correctly sized and verified.

The reason: on a disc whose timestamps are broken, the `fps` filter's *own* output timing is
derived from those same broken timestamps. So thumbnail `i` is **not** at `i × 20` seconds, and
`t × fps` addresses a frame nobody ever looked at. The label was an assumption, not a
measurement.

**The rule: whatever filter chain produced the frames you reviewed must also produce the frames
you keep.** Address them by their index in that chain, never by converting the label back into
time.

```
# sweep (review)   : -vf "fps=1/20,scale=220:165"          -> thumb i
# capture (keep)   : -vf "<deint>,fps=1/20,scale=W:H"      -> frame i, same instant
```

Run the capture over the whole titleset and keep every frame — it is one decode either way, it
gives a full-resolution contact set for free, and it makes re-picking cost nothing. Name the
files by index-derived time so picks stay readable, but understand that name as a *label for
index i*, not as a seek target.

**Sanity check:** the capture must emit the SAME frame count as the sweep. 225 and 204 frames
against 225 and 204 thumbs is the proof the correspondence holds. A mismatch means the chains
diverged and every pick is now pointing at the wrong moment.

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

### Verify picks AFTER materialising, not from the picking montage

**Failure this prevents:** a hero was chosen off a candidate montage and turned out to be the
frame in the **next cell** — a wide shot where a close-up had been intended. Reading a dense
grid is exactly where off-by-one happens, and the label under a thumbnail is easy to associate
with its neighbour.

Choose from the montage, then render the **materialised picks** and look again. It costs one
small image and catches both this and the "same frame on two records" case (§6, "Two sources of
ONE broadcast need DIFFERENT moments").

### 6.2d-1 Sweep the STRUCTURE before concluding what a programme contains

**Failure this prevents:** a Musique Plus record's 24 scored candidates were *all* talking
heads, so the programme was about to be written off as an interview special with the best
interview frames chosen. A structure sweep — every ~10th captured frame, 152px, ~1.2k tokens —
showed it was roughly **half live performance**. The scorer had simply never surfaced it: a
sharp, evenly-lit face in a studio beats a moving performer under stage lighting every time.

The shortlist tells you what scored well. It does not tell you what is **in** the show. Before
picking from a shortlist that looks uniform — all interviews, all crowd, all one camera angle —
sweep the whole captured set once:

```python
fs = sorted((WORK/key).glob("*.jpg"))
sel = fs[::max(1, len(fs)//48)][:48]          # ~48 thumbs, whole runtime, one image
```

The same sweep answers "is this two programmes?" (§10b) and "does this show contain any
close-ups at all?" — one 967-frame audience recording contained none, which is worth knowing
*before* hunting for one.

**`scores.json` stores `file` as a bare filename, not a path.** Join it with `work/<key>/`
or every thumbnail in your montage renders as "missing".

### NEVER pick a frame from the montage alone — render it, then decide

**Failure this prevents:** reading a dense grid and choosing the cell *next to* the one intended.
It happened at least five times in one session — a hero that turned out to be the drummer, the
bassist, a wide, a stage light, and on one occasion the programme's host. Every time, the montage
label sat under a neighbouring thumbnail and the eye bridged the gap.

The fix costs one small image:

1. Choose candidates from the montage.
2. **Render those exact frames at full size, side by side, with their timestamps.**
3. Only then write them into `picks.json`.

A sharpness number printed under each candidate makes the choice objective where several are
similar — variance of the Laplacian, higher is crisper:

```python
a = np.asarray(Image.open(f).convert("L"), dtype=float)
lap = a[:-2,1:-1] + a[2:,1:-1] + a[1:-1,:-2] + a[1:-1,2:] - 4*a[1:-1,1:-1]
sharpness = lap.var()
```

It settled several picks this session: 102 against 29-93 for a Woodstock hero, 99 against 65-80
for a Muse close-up. It cannot tell you *who* is in the frame — only how crisp it is.

### The band may be four people who look alike

Kings of Leon are three brothers and a cousin; the Followills are hard to tell apart at 200px,
and picking "the one with the beard" fails. **The reliable tell is behavioural, not facial: the
singer is the one at the CENTRE MIC with no instrument, or singing into it.** Anyone holding a
bass, sitting behind a kit, or at the side of the stage is not the hero.

Verify the whole artist's heroes as ONE montage of just the A frames (§6.2d-2) — the owner
spotted the guitarist as hero in fourteen shows that way in a single glance.

### 6.2d-00 THE GATE GUARDS SLOT A ONLY — B/C/spare are where the junk lands

**Failure this prevents:** on Radiohead, 16 of 18 sources scored `DARK SOURCE`, and
autopick handed over **four television commercials as all four picks** for one show,
and the programme's **title card** in two slots of one record and three of another.
Every one of those would have passed `hero_gate.py`, because the gate only ever looks
at slot A.

The mechanism is the same one §6.2e describes, applied to the other three slots. On a
dark source the score rewards a bright, high-contrast, quiet-background frame — which
is exactly what a title card, a caption card and a television advert are. They are the
*best-scoring frames in the show*. So they do not merely survive into the shortlist,
they lead it.

**Hand-pick all four slots on EVERY artist. `DARK SOURCE` makes it worse; it is not the
trigger.** Supergrass flagged **zero** of its 18 shows dark, and still needed **14 of 18 heroes**
and **16 of 54 other slots** replaced. What autopick had put in those slots:

| Show | What was in a B/C/spare slot |
|---|---|
| VH2 Live Special | a **Manic Street Preachers** title card, and a second frame from the same non-Supergrass filler |
| Vol 3 TV Appearances | Jimmy Kimmel's *"To buy the CD, go to abc.com"* caption card |
| Köln VIVA | two `OVERDRIVE / SUPERGRASS / LOSE IT` caption cards |
| MTV Five Night Stand | a credit roll |
| Pinkpop | two dark silhouettes of a cameraman |
| Glange Fever | an abstract green light streak — no subject at all |

None of those shows was dark. A caption card, a credit roll and an advert are the
highest-contrast, quietest-background frames a programme contains, so they lead the shortlist
on *any* source; darkness only removes the competition. The order that costs least:

1. `autopick` → `shots.py picks` → `reviewsheet.py`.
2. Read **`reports/review.jpg` once** — ~6k vision tokens for the whole artist, all
   four slots per show. This is what catches commercials, title cards and four
   near-identical close-ups. It is not good enough to judge *identity*.
3. Sweep the full capture (§0a-2) and hand-write `picks.json` for every show.
4. Judge the hero separately at ≥340px (§6.2d-0).

**Two tells worth knowing.** An off-air recording whose sidecar says anything like
"original commercials included" will have adverts in roughly one frame in six — check
every slot, not just the hero. And a programme with a title card will usually have it
score in the top few, because a clean graphic on black is the highest-contrast,
quietest-background frame the show contains.

### Two sources of ONE broadcast need DIFFERENT moments

Ben Harper's Bonn 1998 exists as a DVB-S capture and a VHS master: two records, two checksums, the
same WDR broadcast frame for frame (the full-capture sweeps lined up — the same orange close-up at
00:13:58 in both). Picking the best frame per record independently would have put **the same four
pictures on two records**, because the same scorer ranks the same frames first.

When a show has more than one source, sweep them side by side before picking. If they align, choose
different timestamps for each record's slots — a different hero moment, a different wide. The sources
still differ in quality and bugs (here the VHS carried song captions, the DVB-S a Rockpalast logo), so
each keeps its own record; they just should not look like duplicates on the site.

### A non-artist segment inside ONE titleset must scope every slot

**Failure this prevents:** the VH2 Live Special disc is Supergrass for roughly 26 minutes and
then VH2 channel filler — another artist's video behind a "The Next Song Will Be Great" ident.
Two of its four auto-picked slots came from **after** that boundary. The record is one titleset,
one show, one unit, so nothing structural flagged it: `find_multishow` scores titlesets, and a
`vts` split has nothing to split on.

§10b already says to confirm each pick's timestamp falls inside the titleset the record covers
("A record can COVER one segment while its NAME describes another"). That is not enough when the
foreign material shares the titleset. **Where a sweep shows the artist's segment ending before
the file does, write the boundary into `Notes` and check every slot's timestamp against it — not
just slot A.**

The tell in the sweep is a change of programme grammar rather than of venue: an ident, a
different band's caption, a channel promo. It will not look like a different show, because it is
not — it is the same broadcast continuing past the performance.

### 6.2d-0 THE HERO RULE IS ENFORCED, NOT ADVISED — `hero_gate.py`

The three rules below are the collection owner's, stated 2026-08-25:

1. **Slot A is a close-up of the LEAD SINGER.** Always. Never another member,
   however much better the frame.
2. **Where the singer is barely filmed, use the tightest available shot OF THE
   SINGER** — not a better close-up of somebody else.
3. **Where no usable close-up of the singer exists at all, FLAG IT** for the owner
   to decide. Do not silently fall back to a wide.

This was already written down, in this file and in CLAUDE.md and in the assistant's
memory, and it was broken anyway across several artists — a guitarist as hero in
fourteen shows, then a TV presenter, a news reporter, a phone-in caller, the
bassist and a touring keyboardist. Every one cost the owner a review round and a
re-capture. **Prose does not hold. A gate does**, which is why the setlist-loss
guard has never once let a song disappear.

So `autopick` no longer confirms slot A: it emits it labelled `A?` as a suggestion
only. `promote.py` runs `hero_gate.py` in pre-flight and REFUSES unless, for every
show, either

- the A label no longer starts with `A?` **and** the ShowID appears in
  `data/hero_verified.json` with `checked_px >= 340` — because identity errors
  survive a thumbnail and did, twice, at 230px; or
- the ShowID appears in `data/no_closeup.json` with a reason, which is rule 3.

```bash
python3 hero_gate.py     # exit 1 and a REFUSE line per unconfirmed hero
```

Record a verification as you make it:

```json
{"3cbf2c1669ea": {"ts": "00-17-35", "checked_px": 360, "who": "lead singer, at the mic"}}
```

**Prove the gate fires before trusting it** (SKILL.md's own rule): set one A label
back to `A?` and confirm `promote.py` exits non-zero on both the dry run and
`--apply`. All four paths — unconfirmed, unverified, verified-too-small, flagged —
were exercised when it was built.

### 6.2d-2 The hero shot is the LEAD SINGER — the scorer cannot know who anyone is

**House rule, and it overrides the scorer:** slot **A** is a close-up of the **lead vocalist**,
preferably tight on the face. B/C/spare carry the rest. Applied to every artist, not just the
one that prompted it.

**Failure this prevents:** a 19-show artist was handed over with the *guitarist* as hero in most
shows. Nothing scored wrong — `conc` correctly found the tightest, sharpest close-up in each
show. It simply has no concept of *who*. Lead guitarists get more close-ups than singers on many
broadcasts, and on this artist the guitarist was shirtless and heavily tattooed, which reads as
high-contrast subject matter and scores well.

Identification is a model job and it is cheap. Work out the band's tells first, then apply them
across every show at once:

- The **singer holds a microphone and no instrument**; the guitarist almost always has a guitar.
- Costume and hair are stable within a tour but change wildly across decades — check per era,
  not once for the artist.
- Beware the two lookalike traps this run hit: the **drummer** behind a kit at a
  distance, and the **TV host** (a talk-show frame captioned with the host's name is the host,
  not the band).

**Verify the heroes as one image, not per show.** Build a single montage of the chosen A frame
from every show at ~300px and read it in one pass — ~2k tokens for 19 shows. Judging heroes
inside the 4-up review montage does not work; at 300px-per-row scale a guitarist close-up and a
singer close-up look identical.

**When no close-up of the singer exists, say so rather than substituting.** One audience-shot
2xDVD had 967 frames and not a single close-up of anybody — the camera never left the back of
the room. The honest hero is the widest-acceptable frame with the singer centre stage; a tight
shot of someone else is not a substitute.

**But prove it before saying it, and never re-use the claim.** On the reference run "this
audience recording has no close-up of anyone" was said of a disc that has one at 00:17:35, and
the claim was then repeated a second time from memory rather than re-checked. A sweep (§0a-2)
costs ~1.5k tokens and settles it. "No close-up exists" needs the same evidence as a positive
identification.

### The BACKING singer at his own mic defeats a 420px identity check

**Failure this prevents:** Supergrass's Glastonbury 2004 hero was Mick Quinn, the bassist, singing
backing vocals in tight close-up. It was verified at 420px and written to `hero_verified.json`; the
collection owner caught it on the review page. The who's-who for that artist had named Rob Coombes
(keyboards, the frontman's brother) as the lookalike risk and never considered the bassist.

A backing-vocal close-up is identical to a hero frame in composition — mouth open, at a mic, in
focus — so "is this a close-up of someone singing?" is not the question. Nor is the instrument
enough: the bassist has one too.

**Name the discriminator before picking, then check for it explicitly.** One physical feature that
separates the frontman from every other member, and one that survives a thumbnail: for Gaz Coombes
it is sideburns running down the jaw, and Mick Quinn is clean-shaven. Write it into the who's-who
next to the hero rule, not just the list of members.

Do NOT use hair colour or length. Under stage light both men read the same shade, and that is what
made the two frames look like the same person at 420px.

**When one hero is caught wrong, re-check every other source of the SAME performance.** Three
Supergrass records hold Glastonbury 2004 — a 4:3 master, a 16:9 master and a Palladia HD excerpt.
The misidentification was on the HD one, so the other two were re-checked in the same pass before
answering; both were right, and saying so is part of the answer. The same faces, lighting and
camera crew produce the same confusion twice as readily as once.

### 6.2d-3 Build the artist's WHO'S-WHO once, before picking anything

**Failure this prevents:** three separate misidentifications on one artist, each of which
reached the owner and had to be corrected by them — the most expensive way to find a mistake.

Identity is the single largest quality risk in this pipeline and the one thing no script can
check. Spend ~3k tokens at the START of an artist building a reference, then apply it everywhere:

1. Pull 6-8 frames spread across the artist's eras (a sweep row per era is enough).
2. Write down, per era: who fronts the centre mic, hair and build of each member, who plays what.
3. Note any **extra** people — touring keyboardists, horn players, guests, presenters.

**Never write an era's row without frames from that era.** On Ben Harper the 1996–98 row was drafted
from the 1999 sweep as "long hair tied back"; the first review montage showed a big afro in all three
1996–98 sources. It was corrected before any pick, but a wrong discriminator is worse than none — it
actively points the eye at the wrong person. If an era has no frames yet, leave its row blank until
the capture's review montage exists.

The traps that got through without it, all on one artist:

| What it looked like | What it was |
|---|---|
| A bald head at 230px | **Blonde hair slicked straight back** under heavy dark eye makeup — the bassist. Called the singer twice. |
| The bald man at the keyboard | The **touring keyboardist**. This band had TWO bald men on stage in 1998. |
| A long-haired man singing, 1993 | Correct — but the same frame set also held the **German TV presenter** in close-up |
| A face captioned in a news clip | An **MTV News reporter**, and separately a **phone-in caller** |

**Hair colour and head shape are not reliable at thumbnail size.** Verify every hero at **≥340px**
before it is written into `picks.json`. Two of the three errors above survived a 230px montage
and were obvious at 360px.

**A frame with two candidates in it is worth more than a tighter frame with one.** The
Spielbudenplatz hero was settled by choosing a shot where the singer *and* the keyboardist are
both visible — which makes the identification self-evidencing to whoever reads it next.

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
  timestamp, score and subject sharpness). It is a record of what scored, and useful for a
  specific question — **it is NOT how slots get chosen.** The sheet renders `scores.json`'s
  shortlist, which is systematically wide shots on a dark or wide-camera source, so the
  close-up you need is frequently not in it at any size. Pick from a full-capture sweep
  instead (§0a-2), and read `reports/review.jpg` once for all four slots of every show
  (§6.2d-00).
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

### picks.json KEYS must be unique per record too — not just the filenames

**Failure this prevents:** `autopick` derived its `picks.json` key as
`key.rsplit("__",1)[0][:40]` — stripping the unique hash and truncating. A two-DVD show stored
as `<parent>/DVD 1` and `<parent>/DVD 2` produced the **same** key for both. The second silently
overwrote the first, leaving 18 entries for 19 shows, and the survivor's timestamps then
resolved against the *other* disc's work directory, so one pick could not be found at all.

Use the **whole** work-directory key as the picks key. It is already unique by construction
(§2, "Work-directory keys MUST be unique"), and truncation is what destroys that guarantee.

**QA gate:** `len(picks) == len(shows_with_scores)`, and every picks key must match exactly one
state key. A fragment that matches two keys is an error, never a first-match win.

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

**A recording with several acts on it goes through the `va-masters` skill.** A festival
broadcast or TV compilation is filed as one Various Artists master plus one linked record per act
(`ParentShowID`, `SegmentStart`/`SegmentEnd`, that act's setlist and stills). **A capture run
never creates a standalone record for an act on such a disc:** if the artist's linked record
exists, capture its window; if not, name the disc in the hand-off and set it up with
`va-masters`. A two-band split bill is the same model at its smallest — one record per band per
tape, plus a master (§2, "Artist matching", item 3). Only a disc that is all one artist, or pairs
unrelated programmes, gets no master: each collection artist's unrecorded source on it becomes
its own record (va-masters, "Not every multi-programme disc is VA").

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

### The taper's OWN title card marks the join, and the broadcaster's REGION names the show

A disc named `Rock Am Ring 6th June 2003 + Rock Im Park 2003` held exactly that, in one continuous
`VTS_01` stream with no titleset boundary to split on. Two signals located and identified the join
between them, and both are cheap:

- **The card that opens the disc appears again at the join.** The taper's `CROSSCUT` card sits at
  `00:00` and again at `70:40`. Searching a sweep for a repeat of frame 0 finds the seam directly,
  where scanning for "the picture changes" finds every camera cut.
- **The broadcaster bug names the region, and the region names the festival.** `WDR` before the
  join (the Nürburgring is in WDR's area), `BR` after it (Rock im Park is in Nuremberg, Bavaria).
  Outfits changed with the bug while the painted drum kit and the sticker-covered PRS did not —
  same band, same tour, different night.

The record's own sidecar documented only the first show, and the folder name was the only hint the
second existed. **A `+` in a folder name is evidence even when the sidecar contradicts it**: the
sidecar describes what its author transcribed, not necessarily what they burned.

Both shows share one stream, so the second record needs a derived checksum (§10b step 4) — a
titleset split is not available however much tidier it would be.

### A prior session's prose conclusion is not evidence — re-derive it

A compilation record's `Notes` said "Supergrass appear around 45-62 min". That window holds two
other bands. The same note's Radiohead claim was exact because it cited the disc's burned-in card
by frame number; the Supergrass sentence cited nothing. Supergrass are at 34:51-42:28, found by
sweeping for the card, which reads `Supergrass (UK)` at frames 63,304-63,400.

Trust a prior note in proportion to the evidence it names. A frame number, a caption or a runtime
is evidence; "around" is a guess someone will later promote to fact.

**Cross-check a setlist's length against the segment runtime.** That record also carried a
twelve-song list labelled "the SUPERGRASS segment's setlist" for a segment of 7m38s. Twelve songs
is a festival set, not a two-song broadcast excerpt — the mismatch is visible without decoding
anything.

### A SECOND COMPLETE DISC can sit in a subfolder — and nothing in this pipeline sees it

**Failure this prevents:** `R.E.M. - T in the Park, 2008-07-13 + Oxegen 2008` held two full
`VIDEO_TS` trees — T in the Park in the root, and a whole different concert (Oxegen, 12 July,
off MTV2) in a subfolder. The scan writes one row per folder, so the Oxegen disc had no record,
no checksum and no images. Worse, the surviving row carried T in the Park's date with **Oxegen's**
event, venue, city and lineage, because whoever wrote it read the nested disc's sidecar.

Why the existing guards all miss it:

| Guard | Why it passes |
|---|---|
| `find_multishow.py` | scores titlesets inside ONE `VIDEO_TS`; two sibling trees read as one disc |
| `pick_source` | deliberately never recurses (§4.1c-2), so the nested tree is unreachable |
| a `vts` split | both discs are `VTS_01` — the titleset number cannot separate them |
| `preflight` "folders with >1 titleset" | each tree has one titleset, so neither is flagged |

The discriminator is the **directory**, so `data/splits.json` takes a `subdir` key:

```json
{"R.E.M. - T in the Park, 2008-07-13 + Oxegen 2008": [
   {"showid": "7af6be6f7f6a", "label": "T in the Park 2008-07-13"},
   {"subdir": "REM - Oxegen Festival 12 July 2008",
    "showid": "ff6b0c88d556", "label": "Oxegen 2008-07-12"}]}
```

**Detect it cheaply — count `VIDEO_TS` directories, not titlesets:**

```bash
find "$FOLDER" -type d -iname VIDEO_TS | wc -l     # >1 means more than one disc
```

Two follow-on traps, both of which bit on this folder:

1. **Keep the subdir readable in the unit's `rel`.** Squashing it to alphanumerics
   (`REM - Oxegen Festival 12 July 2008` → `REMOxegenFestival12J`) silently broke
   `data/overrides.json`, which is keyed by PATH FRAGMENT and matched against `rel` and
   `label`. The override written for the nested disc never applied — and nothing said so. (It
   was a `crop`, now legacy, §4.3; a `dar` fix fails exactly the same way.)
2. **`promote.py --propose-map` mapped BOTH units to the SAME record.** It matches on name,
   and the two units share a folder name. Build `data/promote_map.json` from each state
   entry's `ShowID` and assert the values are unique before applying, or one concert's stills
   land on the other's record.

Changing a split's shape also **changes the state key**, which is what `capture --only` filters
on. Re-read the key from `state.json` after any re-plan; an `--only` that matches nothing prints
one red line and exits 0.

### One `subdir` per split entry — a record spanning two nested discs cannot draw from both

`apply_splits` takes a single `subdir` per entry and `pick_source` takes a single folder, so a
capture unit lives inside exactly one disc tree. When a MERGED record covers material that spans
two nested discs — Silverchair's MuchMusic *Intimate & Interactive* runs across `Disc 1` VTS_01-03
and `Disc 2` VTS_01-02 — there is no way to express it as one unit. Two units would need two
ShowIDs, and promotion asserts those are unique.

Until the tool grows a list-valued `subdir`, **capture from the richer half and say so in `Notes`**.
Here Disc 2's 33 minutes are near-continuous performance while Disc 1's half is mostly VJ links,
audience Q&A and a *Speakers Corner* insert, so Disc 2 is the better candidate pool anyway. Trim
before the credit roll (`"to": "33:30"`) or it floods the shortlist (§5.2).

### Loose files, not a disc: the `files` split key

`pick_source` on a folder with no `VIDEO_TS` takes the **single largest** video file. That is wrong
twice over for a folder of per-song files — Soundgarden's Lollapalooza AMT folder is seven `.m2ts`
tracks, so only one song was ever captured — and for a folder holding two programmes as separate
files, like Jools Holland's `Extended Show` and `Live Show`. A split entry can name the files:

```json
{"files": ["Searching with my good eye closed.m2ts", "Rusty Cage.m2ts", "..."], "showid": "6ba8d09333cf"}
```

The unit concatenates them in the order given. A named file missing from the drive refuses the
unit rather than capturing a partial set. Seeking across the joins fails on `.m2ts`, so expect the
single-pass fallback (§5.2) — it is slow, not broken.

**The tag in `rel` must digest the file names, not count them.** It was first `L<count>`: the two
Jools parts both named one file, both tagged `L1`, got one `rel` and so one work directory, and the
second capture would have landed on the first. Now `L<count>-<sha1 of the names>[:6]`. Changing a
tag changes the key, so any unit already captured under the old key must be recaptured and its
stale `picks.json` entry dropped — `shots.py picks` reports it as `NO SHOW`.

Nothing about the record is wrong — the stills simply come from one half of the show. That is a
fact worth recording, not a fault worth hiding.

### The artist-matcher can widen as silently as it narrows — check the folder COUNT

Two separate discovery failures on one artist, both silent:

1. **Five of eight folders were named `QOTSA - …`**, which shares no token with
   `{queens, of, the, stone, age}`, and the squashed alias (`queensofthestoneage`) does not appear
   either. They would have been dropped without a word — the RATM case again. Fixed with a `qotsa`
   alias.
2. Then `plan` reported **16 folders for an 8-record artist**. `of` and `the` are both in the
   artist's token set and counted toward the `>=2 shared tokens` rule, so *"Flight of the
   Concordes HBO Master"* and *"Rolling Stone Magazine - 25 - The MTV Special"* matched. Matching
   now runs on **distinctive** tokens (`artist_toks - STOPWORDS`), which the cross-artist
   rejection rule already used. Only names carrying two or more stopwords were affected.

**The cheap check, every run: does the folder count roughly match the record count?**
Nine folders for eight records is a split. Sixteen for eight is a bug, and so is three.

### A folder can be DOUBLED — the same name nested inside itself

`Queens of the Stone Age - Landgraaf … (DVD) [PAL]/Queens of the Stone Age - Landgraaf … (DVD)
[PAL]/VIDEO_TS/`. `pick_source` looks at `folder/VIDEO_TS` then `folder`, never deeper, so the
outer shell yields "no video files" and the show looks skipped.

Here the dedupe index happened to hold the INNER directory as its own unit, so the show was
captured and correctly linked, and only the outer shell appeared as a `SKIP`. **Do not read that
skip as a miss, and do not read it as safe either — confirm the inner unit is present and has a
ShowID before capturing.** If the index had not held it, the show would have been lost in silence.
`data/splits.json`'s `subdir` key handles it if not.

### An informational gate that cries wolf gets ignored

The "agrees with shows.json" gate used `re.search` for the first `N:M` in the aspect string. For
the two-part form `4:3 (letterboxed 16:9)` — legacy cropped records, §4.3 — that is the FRAME
ratio, while `t["dar"]` is recomputed from the CROPPED pixels, so every correctly-recorded
letterboxed show printed `gate failed` next to a crop that was right. It never fed `ok`, so
nothing broke; the cost is that a gate which is wrong on the cases it exists for stops being
read. It now takes the last ratio when the string says letterboxed or pillarboxed, matching
`audit-image-geometry.py`'s `parse_dar`.

### Bars can carry burned-in graphics — measure rows, don't trust one cropdetect

On the Oxegen DVD, cropdetect returned `702:438:10:64` on 183 of 201 samples and
`702:490:10:42` on 17. The disagreement was the broadcaster's **MTV TWO logo and caption
overlaid in the upper black bar**, bright enough to read as picture.

A row-luminance profile settles it in one pass and costs one decode:

```python
# 64-wide x full-height greys, N frames -> where does the picture actually start?
rowmax = d.max(axis=(0, 2))     # brightest this row EVER gets across the disc
rowmean = d.mean(axis=(0, 2))
```

Rows 0-41 and 534-575 never exceeded luminance 5 — true bars. Rows 44-63 and 502-533 averaged
~2 but spiked to 250 — bars with graphics on them. The picture was 64-501. Re-measuring on
columns clear of the logo gave the same top edge, proving the bars set it, not the overlay.

**Measure the bars, not the side blanking.** The same source had ~10 dark columns at each edge.
Counting them out of the picture drags its ratio from 1.753 (1.4% off 16:9) to 1.71 — further
from the truth. Side blanking is a DVB artefact; the bars are the letterbox. (This disc, R.E.M.
Oxegen, is one of the legacy crops. Today the rows go into `Notes` and the whole frame is
captured, §4.3.)

### ASSUME a multi-titleset folder is several shows until proven otherwise

One artist, one session, and the count of folders holding more than one programme was **twelve**.
What they turned out to be:

- a disc named for one festival that held **three** (Reading 2009 + T in the Park + V Festival)
- a disc named `Glastonbury + Tpark + Vfest` that held exactly those three
- a "Big Day Out 2004" master whose first titleset was a **Jet** set and whose fourth held
  **Kings of Leon then Muse**, back to back
- a `Live & Videos` disc of **ten** titlesets: one concert, three TV slots, six promo videos
- a `KOL 1080` folder holding two `.ts` files — two different festivals, one record
- a show that simply **spanned two titlesets**, where the record covered only the first, losing
  half the performance

The naming tells you almost nothing. `+` in a folder name is a strong hint, but most of these had
no hint at all. **Sweep every multi-titleset folder before picking anything** (§0b finds them).

### A compilation disc hides ONE wanted segment among many unwanted ones

**Failure this prevents:** a folder named `<artist> - MTV Cribs 2002 + Others` was recorded as
containing no footage of the artist at all, and excluded from the run on that basis. It in fact
held **16 separate titlesets**, ~120 min, of which exactly one (VTS_15, 6.7 min) was the band's
own episode. The wrong conclusion had been reached by sampling the whole folder as ONE
concatenated stream — which, on a disc with broken timestamps (§5.1, §5.2b), samples almost
nothing while appearing to sample 500 frames.

This is the opposite problem to §10b. There, one folder holds several shows you want; here it
holds one show you want and fifteen you do not. Both are invisible for the same reason: the
scan records one row per folder.

**Procedure:**

1. **Enumerate titlesets, never concatenate them for identification.** `VTS_01 … VTS_NN` are
   separate programmes. `VTS_01_1..4` are PARTS of one programme and MUST be concatenated —
   treating parts as programmes reports the same show four times, and a per-titleset loop that
   clears its output directory will have each part erase the last.
2. **Sweep each titleset by sequential decode** (`fps=1/20`), which also measures it (§5.1).
3. **Build one montage, one row per titleset** and read it top to bottom (§0a-1).
4. **Look for the on-screen name caption.** Broadcast programmes caption their subject in the
   lower third, usually in the first seconds but sometimes minutes in. At 220px these are
   visible-but-unreadable; go to full resolution for that one titleset.
5. **Capture from the wanted titleset ALONE** — set the record's source to that VOB, not the
   concat of all of them.

**A titleset can be blank filler.** One was 3.2 min of solid blue: 192 frames, every one
uniform, ~91 MB of real MPEG-2 encoding nothing. Confirm with a stddev check rather than
assuming a decode failure — `stddev < 6` across every frame means there is genuinely nothing
there.

**Write what the other programmes are into `Notes`.** The next person to look at this record
will otherwise repeat the entire identification. Name them.

This section is about *finding* the artist's segment, not *filing* it. If the other programmes
are other acts, the disc is a multi-artist recording: it is filed through the `va-masters` skill
(§10), never as a standalone record made during a capture run.

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

### The record whose METADATA already fits one segment should keep that identity

When splitting, do not assume the original record represents the biggest part of the disc. The
`London 2003 + Jools Holland 2003` disc was ~53 min of concert and ~7 min of TV — but the
existing record's `EventOrFestival`, `VenueName` and its **three-song** `Setlist` all described
the *TV slot*. Keeping the original as the Jools Holland record meant no field had to be
rewritten into something it was not, and the setlist never moved. The bigger segment became the
derived record instead.

**Read the setlist length as evidence of which segment a record describes.** Three songs is a TV
appearance; twenty is a concert.

### A time-window split needs its OWN state entry and work directory

The derived record is not just a `shows.json` row. `shots.py picks` names output files from the
**state entry** (`FolderName` + `ShowID`), and resolves timestamps by globbing
`work/<key>/`. Two picks entries pointing at one state entry therefore collide on filename and
silently overwrite each other — the same class of bug as the picks-key collision above.

So for the second show: add a state entry with its own key and its own `ShowID`, create
`work/<newkey>/`, and copy in the frames it needs. Only then does each record get its own picks
entry and its own files.

### Merging two records that are ONE show

The mirror of splitting, and it happens whenever a concert spans two discs. Two records named
only `DVD 1` and `DVD 2` described the *media*, not the show.

1. **Name the show from the PARENT folder**, which is where the real identity lives —
   `Janes Addiction Columbus OH 2009-5-28 (aH 2xDVD Master)` gave artist, city, state and date.
   Read it before inventing anything; and expect typos (`1009-5-28` for 2009) — note them,
   never "fix" the drive.
2. **Keep the surviving record's real checksum.** Record the retired sibling's `ShowID` and
   `ChecksumSHA1` in `Notes` so the merge is reversible and traceable.
3. **Sum `DurationSec` and `TotalSizeHuman`** — they now describe the whole show.
4. **Put the images on ONE continuous timeline.** Frames from disc 2 must be offset by disc 1's
   runtime, or the set reads `00-25-39, 00-20-54, …` and looks like it jumps backwards. Offset,
   then name by the merged time:

   ```python
   merged_t = disc2_offset_seconds + disc1_duration_seconds     # 1254 + 2338 -> 00-59-52
   ```

5. **Then hunt the orphan.** See below — this is the step that is easy to miss.

### A folder linked to the WRONG record is invisible to every existing gate

**Failure this prevents:** the folder `Kings of Leon - TSB Arena Wellington NZ 2009` was linked in
the capture state to the ShowID of an **Australia Music Awards** record. Its frames were promoted
onto that record, overwriting a Various Artists show with Kings of Leon footage, while the
Wellington record — whose `FolderName` is an exact match for the folder — sat unclaimed with old
squashed images.

Neither guard fired. The unlinked-folder gate passed because the entry **had** a ShowID. The
promote-map uniqueness assert passed because only **one** picks entry claimed that record. A
wrong link is not a missing link and not a duplicate link.

Audit the links themselves — compare distinctive tokens of the folder name against the record's:

```python
if not (toks(state_folder) & toks(record_folder)):
    print("SUSPECT", state_folder, "->", record_folder, sid)
```

Zero overlap is not automatically wrong — a record legitimately named `kingsema2010` matched a
folder `Kings of Leon EMA Awards 2010`, confirmed by file size (212.04 MB record, 215 MB folder).
But every zero-overlap link must be **looked at**, and confirmed by something other than the name.

### Renaming a split record can STEAL another folder's link — a tie went to first-in-file

**Failure this prevents:** after splitting `Weezer - Reading + Rock am Ring 2005`, its WDR record
was renamed `... (VTS_03 - Rock am Ring 2005, WDR)`, as §10b requires. The separate MTV disc
`Weezer - Rock am Ring 2005` then scored 4 of 4 tokens against **both** that record and its own.
`discover()` kept the first record with the top score and only consulted an exact `FolderName`
match when the token score was *weak*. The MTV disc therefore planned under the WDR record's ShowID
**and checksum**, and both broadcasts would have promoted onto one record. The link column read
`4 tok`, which looks healthy.

`discover()` now refuses a tie at the top score (`tie N xK`, printed in red), and the exact-name
rule then settles it. Tied siblings named in the folder's own `splits.json` entry are expected and
stay quiet. The same bug was latent on STP: `Toronto 1993 - Night 2` tied with Night 1 and linked
to Night 1's record. It didn't ship only because that run's promote map was built by hand.

After ANY plan, check that the ShowIDs and checksums in `state.json` are unique and match
`shows.json`:

```python
ids = [u["ShowID"] for u in state["shows"]]
assert len(set(ids)) == len(ids)
assert all(u["Checksum"] == rec[u["ShowID"]]["ChecksumSHA1"] for u in state["shows"])
```

### A merge or a re-key ORPHANS images that `promote.py` cannot see

**Failure this prevents:** after retiring the DVD 2 record, its four images and its
`image-manifest.json` entry were still in the repo, now belonging to **no record at all**.
`promote.py`'s pre/post-flight passed cleanly — it compares manifest entries against files on
disk in both directions, and those four agreed with each other perfectly. What it never checks
is the manifest against `shows.json`. The same happens whenever a checksum changes: resolving a
temp-checksum stub to its real hash left the images filed under the placeholder on disk and in
the manifest — invisible on the site, counted by nothing.

After any merge, delete, split or re-key — not just after a capture — list manifest entries no
record references:

```bash
python3 -c "
import json
mani=json.load(open('public/image-manifest.json'))
cks={(s.get('ChecksumSHA1') or '').strip() for s in json.load(open('public/shows.json'))}
print([c for c in mani if c not in cks])"
```

`audit-image-geometry.py` reports the same thing as **`no show record`**. Delete the files and
the manifest entry only after asserting the checksum is genuinely unreferenced; use plain `rm`,
not `git rm` (nothing left staged, §11). Git history keeps the files.

### Prefer a TITLESET split — it yields REAL checksums, not derived ones

A time-window split has to derive identifiers (§2, "Splitting when the shows are NOT separable").
A **titleset** split does not: each show is its own file set, so each gets a genuine content
hash that behaves like every other key in the collection. Always check whether the shows fall
on titleset boundaries before reaching for derived ids.

```bash
python3 titleset_checksums.py "<folder name>"
```

**Hash the new record the same way its sibling was hashed.** On one disc the surviving record's
`ChecksumSHA1` was **not** the hash of the whole titleset — it was `sha1(VTS_01_1.VOB)`, the
titleset's *first VOB part*, matching its `RepVideoFiles`. The new record therefore used
`sha1(VTS_02_1.VOB)`. Two records of one disc keyed by two different conventions is a trap for
whoever reads them next.

**Prove which show the existing checksum describes; never assign it by reasoning.** Recomputing
gave a byte-exact match to `VTS_01_1.VOB`, which settled that the record was source 1a — a
question no amount of looking at metadata could have answered. `RepVideoFiles` tells you what to
hash.

**There are two conventions, and `titleset_checksums.py` now prints both.** Some records hash
`VTS_NN_1..n` only; others put the titleset's `VTS_NN_0.VOB` in front (Ben Harper's ACL record,
whose `RepVideoFiles` lists `VTS_02_0.VOB`). The tool used to print only the first, so that record
matched nothing and had to be proved by hand. It now prints a `with VTS_NN_0.VOB` line as well and
marks `<- MATCHES <ShowID>` against every record in `shows.json` — use whichever convention the
sibling matched for the new record.

### A record can COVER one segment while its NAME describes another

Two failures, same disc family, and both survive a montage review because the frames are all
genuine footage of the right band:

- A 7-titleset disc's record was named `MTV Studios` and carried `VenueName: MTV Studios`, but
  covered **only VTS_07** — a different, earlier concert. The MTV studio performance the name
  describes sat in VTS_04-06, uncovered.
- A folder holding **both** of a band's TV appearances had its record dated for the later one
  and covering VTS_01, while **every pick resolved inside VTS_02** — the earlier show. The
  record would have shipped images of the wrong performance.

**QA gate for any multi-show folder: check that each pick's timestamp falls inside the titleset
the record actually covers.** Sum the titleset runtimes to get each boundary in concat time, and
compare. The frames look right in isolation; only the arithmetic catches it.

```python
bounds = list(itertools.accumulate(titleset_seconds))   # concat-time end of each titleset
lo, hi = (bounds[i-1] if i else 0), bounds[i]           # i = titleset the record covers
assert all(lo <= secs(ts) < hi for _, ts in picks[key]), "picks are from the wrong titleset"
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

Whenever a checksum changes — a resolved stub, a corrected mis-key, a split — the images filed
under the old one stay behind. Audit and clean up as in "A merge or a re-key ORPHANS images"
above.

### Step 4 — Key the new record

**Prefer a real content hash** from the new record's own files ("Prefer a TITLESET split",
above). Only when two shows share one inseparable file (a single continuous VOB) fall back to a
derived key — formula and `Notes` wording in §2, "Splitting when the shows are NOT separable at
file level".

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
- `Artist` is the stored spelling — no leading "The" (§17 step 0 has the lookup).
- Set `ContentType` on every new record: `"Documentary"` when half or more of **that
  titleset's** runtime is people talking or narration over footage (interviews, making-of,
  behind-the-scenes, Cribs-style tours, rockumentaries, TV biographies); otherwise leave it
  absent. Storytellers, Unplugged and concert films with backstage inserts are not documentaries.
  Judge from the footage, never the title; for a borderline one,
  `python3 ~/VaultShots/doc_sweep.py <ShowID>` builds a 48-frame sweep (about ±7%, so put
  anything between roughly 42% and 58% to the owner). `RecordingType` says how it was filmed —
  Proshot, Soundboard, Audience — and is never `Documentary`; the health check rejects it.

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
- **Material the owner has decided gets no record** — a narrative short film, or the documentary
  footage he ruled out on 2026-10-04 (CLAUDE.md → Documentaries lists it). A documentary is
  otherwise a record like any other, with `ContentType: "Documentary"` (Step 5).

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
    {"vts": ["06"], "showid": "1b855d937789", "label": "Canada Day, Parliament Hill"}
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
- Do not invent a date for footage you cannot date. Leave `ShowDate` empty and say so —
  `VTS_06` above was identified as Canada Day on Parliament Hill from its landmarks and CBC bug
  (Step 2), and its date is still empty because the year cannot be sourced.
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

**Archive the finished artist before starting the next one.** `shots.py archive --name "<artist>"`
moves `picks/`, `contact/`, the report pages and the data files into `archive/<slug>/` and
deletes `picks.json` and `scores.json`. Skipping it means the next artist's `autopick --merge`
keeps the previous artist's picks and `promote.py` resolves against a stale state. Delete
`data/promote_map.json` too — see below.

**Hardcoded `VIDEO_TS/` is a silent no-op on discs that keep VOBs at the folder root.**
`titleset_checksums.py` printed the folder name and nothing else — which reads as "this disc has
no titlesets", not "I looked in the wrong place". Fall back to the folder root, and **exit with
an error when nothing is found** rather than returning quietly. Any tool that globs `VIDEO_TS`
has the same bug latent in it.

**CAPTURED is not RECORDED.** A documentary sat in staging with 500 frames and four picks and
**no `shows.json` record at all**, so it could never be promoted and did not exist on the site.
Nothing flagged it: it had no ShowID, so the gate filed it under "a new show, not a linking bug"
and moved on. When a state entry has picks but no ShowID, that is a show one step from being
lost — either create its record or say plainly that it has none.

**An EXACT FolderName match is not the only way a record exists.** The first version of the
unlinked-folder gate only refused when a record's `FolderName` matched the drive folder exactly.
A drive folder `Offspring - Live Wembley 2001` had a record named after the disc label,
`DVD-Offspring-LiveWembley2001` — no exact match, so the gate classified it "a new show" and
waved the silent skip straight through. It now falls back to distinctive-token overlap against
the artist's **unclaimed** records and refuses on 2+ shared tokens, printing the candidate ShowID.

**And that fallback needs the squashed-name rule too (§2).** `LiveWembley2001` is a single token,
so token overlap against `{wembley, 2001}` scored **zero** and the improved gate still missed it.
Count folder tokens that appear as substrings of the record's separator-stripped name:

```python
squashed = re.sub(r"[^a-z0-9]+", "", record_folder.casefold())
n = max(len(want & rtoks), sum(1 for w in want if len(w) >= 4 and w in squashed))
```

The general lesson: **every name-matching rule in this pipeline needs the squashed-name case.**
It has now caused three separate silent failures — artist discovery, promote-map linking, and the
gate written to catch the second one.

**An UNLINKED folder is now a hard stop — `promote.py` refuses rather than skipping.**

**Failure this prevents:** discovery finds a folder, `shows.json` holds its record, but the two
were never linked, so the state entry's `ShowID` is blank. Promotion then skips that show with a
one-line note, the run reports cleanly, and the show never reaches the repo. It happened on two
consecutive artists — Jane's Addiction (`Madrid 2008`, `TV Compilation 1` on the next one) — and
was caught both times only because someone asked "is anything missing?".

Pre-flight now separates the two meanings of a blank `ShowID`:

| Case | Meaning | Action |
|---|---|---|
| A record with that exact `FolderName` **exists** | linking bug | **refuse**, printing the ShowID to set |
| `FolderName` matches **>1** record | ambiguous | **refuse**, link by ShowID by hand |
| **No** record at all | a genuinely new show | note it and continue |

The third case must stay allowed — an unrecorded folder is how new shows are found (§10b).

It also reports coverage every run — `records for <artist>: N, of which M have picks` — and lists
records that will not be touched. Exclusions are legitimate (wrong-artist discs, music videos),
so that reports rather than blocks; but it must be **said**, never left to be noticed.

**Prove a guard fires before trusting it.** Blank one `ShowID` in `state.json`, confirm
`promote.py` exits non-zero on BOTH the dry run and `--apply`, then restore. A guard that has
only ever been seen passing is not a guard yet.

**`data/promote_map.json` PERSISTS BETWEEN ARTISTS — rebuild it every run.**

**Failure this prevents:** starting an artist's promotion with the previous artist's map still
on disk. `promote.py` looks up each pick fragment in the map, finds nothing, and skips the show
with `no confirmed shows.json record`. Every show is skipped, the run reports cleanly, and
nothing is written. It is a silent no-op, not an error. The map found in place at the start of
an Incubus promotion still held Guns N' Roses and Green Day entries.

Rebuild the map for the artist at hand from each state entry's **ShowID**, and assert the
values are unique. `--propose-map` is a drafting aid only and must not be trusted: it matches on
name, so two units that share a folder — every split — are proposed against the *same* record,
which would put one concert's stills on the other's. Store ShowIDs rather than FolderNames. A FolderName is matched by exact string: one character adrift
(`(Upgrade Version)` vs `(Upgrade)`, a stray trailing space) skips the show without complaint,
and the same string can match two records after a split. Validate as you write it:

```python
for frag, folder in confirmed.items():
    recs = [s for s in shows if (s.get("FolderName") or "").strip() == folder]
    assert len(recs) == 1, (frag, "matches %d records" % len(recs))
    assert (recs[0].get("ChecksumSHA1") or "").strip(), (frag, "no checksum")
    out[frag] = recs[0]["ShowID"]
```

**QA gate:** the dry-run plan must list as many shows as `picks.json` has entries, minus the
ones you deliberately excluded. Read that count before `--apply`; a short plan means the map is
stale, not that the shows are missing.

**The drive folder name and the record's FolderName can legitimately differ**, and the record
can be the correct one. A folder read `Bizarre Festival 2001` while its record read
`Bizarre Festival 2002`; the record was right — the setlist held six songs from an album
released after the 2001 festival. Resolve which is wrong from evidence before promoting, and
write the reasoning into `Notes` so it is not re-derived.

**What `promote.py` refuses on** — pre-flight, on the dry run and `--apply` alike:
1. `check_overrides.py` fails — an aspect override not mirrored into its record (§4.4)
2. `hero_gate.py` fails — a hero neither verified nor flagged (§6.2d-0)
3. the repo already has orphans — a manifest entry with no file, or a file with no entry
4. a discovered folder whose record exists but is not linked in `state.json` — unlinked,
   ambiguous, or a probable token match against an unclaimed record (above)

**What it only SKIPS**, listing each under `SKIPPED` — so read that list, and the plan's count:
a picks key with no `promote_map.json` entry, a map value that resolves to no record or to
several, a record with no checksum, a key with no capture state, picks that do not resolve, or
more than one staged file matching a tag.

**What it does not check — do these by hand around it:**
- Every show maps to a **confirmed** `shows.json` record — the map built from state ShowIDs
  (above), never a guess. Name matching alone mapped 14 drive folders onto 7 records in the
  reference run.
- `git status --short` in the repo first: note what is already modified — often another
  session's work — so this promotion's diff stays reviewable.
- Dry run first; `--apply` is a separate, explicit flag.
- After `--apply`, `python3 scripts/health-check.py` in the repo.

**Per show:**
1. Copy every existing `{checksum}_*.jpg` into `~/VaultShots/promote-backup/`, and the old
   manifest entries into its `_ledger.json`
2. Write picks to `{checksum}_01.jpg` … `_0N.jpg` in brief order (A, B, C, spare)
3. **Delete every `{checksum}_0M.jpg` where M > N.** This is the orphan step — it bites
   whenever the new pick count is lower than the old one.
4. Set `manifest[checksum] = [1..N]` exactly — contiguous, no gaps. (One show in the
   reference run had `[1, 2, 4]`; this normalises such gaps.)

**Post-flight — verified GLOBALLY, not just on what changed; exits non-zero on any failure:**
- 0 manifest entries without a file
- 0 files without a manifest entry
- **`shows.json` byte-identical** — promotion writes images and manifest only
- per-show disk slots == manifest slots

**Do NOT promote a show if it would reduce quality.** In the reference run two discs yielded
only one usable frame each (the band appeared briefly on someone else's programme), which
would have replaced three good images with one. Skip, report, and re-capture a targeted
window instead.

**Rollback.** Between `--apply` and the commit: for each checksum keyed in `_ledger.json`,
restore its files from `promote-backup/` and its old manifest entry from the ledger, and `rm`
any slot the promotion added. After the commit, git is the backup:
`git checkout <commit>^ -- public/images/<files> public/image-manifest.json` — it stages what it
restores, so commit by path at once — and `rm` any slot that commit added. If anything else has
touched the manifest since, restore only the affected entries.

**Clear `promote-backup/` once the run is committed.** It exists only to cover the gap between
promotion and commit; after that, git history holds every replaced image. Move it to the Trash
(§17 step 8). Left in place it only accumulates, and it is not a reliable record anyway: each
`--apply` rewrites `_ledger.json` and overwrites the backup of any checksum promoted again.

### Committing: on `main`, by explicit path, in one command — and never push

Screenshot runs are committed on **`main`** (`feat/browse-redesign` was merged and deleted on
2026-10-05). **Never push until the owner says** — every push to `main` deploys the live site.

The owner often runs two sessions in this repo at once, and a commit takes the whole shared
index — one session's commit has already swept in a deletion another had staged hours earlier.
So:

- **Never leave anything staged.** Delete with plain `rm`, never `git rm`.
- **Commit by naming exact paths, in one command:** `git commit -m … -- path1 path2`.
- Run `git status --short` immediately before. Anything you did not touch is the other
  session's — leave it out. If a file you need (`public/shows.json`) also carries its edits, ask
  before committing them.
- Never `git add -A`, `git add .` or `git add -f public/`: each sweeps in someone else's work.

**New files must be added — a commit by path never picks them up.** Until 2026-10-05 `public/`
and `.claude/skills/` were gitignored while their files were tracked, and that hid new files
completely: promotion added two new `_04.jpg` files (shows that went 3 slots to 4),
`git add public/images/` staged **zero additions**, and the manifest declared slots the deployed
site would 404 on. Every local check passed, because `health-check.py` inspects the **disk**,
not git. Both folders are now visible to git (third-party skills stay ignored), so a new image
or bundled script shows as `??` in `git status` — but `git commit -- <path>` still refuses an
untracked file, so add each new one by exact path, never with `-f` and never by directory, in
the same command as the commit:

```bash
cd ~/Desktop/Projects/the-vault
git status --short -- public/images .claude/skills               # NEW files show as ??
git add -- public/images/<ck>_04.jpg && \
git commit -m "feat(images): <Artist> — …" -- public/shows.json public/image-manifest.json \
    'public/images/<ck1>_*' 'public/images/<ck2>_*' <changed skill copies>
git status --short                                               # nothing staged afterwards
```

The deploy now runs the health check on a fresh checkout too, so an image that never reached
git fails the deploy instead of 404ing live — but catch it here, before the commit.

A quoted `'public/images/<ck>_*'` is a git pathspec, not a shell glob, so it also carries a slot
the promotion deleted; a pathspec that matches nothing aborts the commit rather than skipping.

**Then verify against git, not the filesystem** — every manifest entry must be a tracked file.
A disk-only audit cannot catch this class of bug:

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

**This was documented for a long time before it was true.** `promote.py` in fact resolved *only*
from `work/`, and the rule above sat in this file unimplemented. The cost: ten hand-made
corrections were applied by exchanging files in `picks/`, promotion silently resolved none of
them, and the run reported `promoted 13 shows` as though that were the whole job. Fixed to try
`picks/<...>_<ShowID[:6]>__<tag>.jpg` first and to refuse when a tag matches more than one
staged file. **Verify a documented rule is implemented before relying on it.**

**After any promotion, hash every slot against its staged pick.** It is one cheap loop and it is
the only check that catches a silent partial write:

```python
for slot, tag in ((1,"A"),(2,"B"),(3,"C"),(4,"spare")):
    assert md5(picks_file(sid, tag)) == md5(IMGS/("%s_%02d.jpg" % (ck, slot)))
```

### A hand-supplied still must be staged in `picks/` too

**Failure this prevents:** an image the owner dropped into `temp-images/` was copied straight to
`public/images/{checksum}_01.jpg`, and the next `promote.py --apply` overwrote it — because
promotion rewrites all four slots from `picks/`, where that frame did not exist. The owner saw
their pick revert.

Copy a hand-supplied still into **both** `public/images/` and `picks/<...>__A.jpg`, or promote
before staging it. If it has already been clobbered, recover it from `promote-backup/` before
the commit, or from git after it (§11, Rollback).

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

When capture *settings* change — geometry, deinterlacer, an override — the selections are still
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
`TotalSizeBytes` from the filesystem. Leave `Setlist` blank unless the folder's own sidecar gives
one (§2, "Read the sidecar for SETLIST too") — then write it in house format and name the file
in `Notes`. Record any uncertainty in `Notes` rather than inventing a value; use the
`YYYY-01-01` convention when only the year is known.

`Artist` is the stored spelling, no leading "The" (§17 step 0). Set `ContentType` exactly as in
§10b step 5: `"Documentary"` when half or more of the runtime is people talking or narration
over footage, otherwise absent — judged from the footage, not the title. `RecordingType` is how
it was filmed (Proshot, Soundboard, Audience) and is never `Documentary`.

**Validate before writing:** `ShowID` unique, `ChecksumSHA1` unique, `ShowDate` either empty
or exactly `YYYY-MM-DD`, and the record count increases by exactly the number added.

### Split bills need a DERIVED checksum

One folder holding two artists' sets needs **two records** so each act appears under its own
name with its own stills. But images are keyed by `ChecksumSHA1`, and in the reference
collection **no checksum is shared by two records** — sharing one would give both acts
identical pictures and break that invariant.

Give the second record a derived key, with the artist as the discriminator, and say so plainly
in `Notes` — formula and wording in §2, "Splitting when the shows are NOT separable at file
level". Filing (one record per band per tape, plus a master) is §2, "Artist matching", item 3.

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

### A RESUMED capture reports cached frames as successes

**Failure this prevents:** after correcting a show's aspect, `capture --only <key>` printed
`ok=500 bad=0` and `768x576 verified` and **wrote nothing at all**. Every frame was a cached
1024x576 file from the previous run, and the `verified` line came from the probe rather than from
a written frame. Picks were then re-materialised at the OLD geometry, so the whole correction was
a no-op that read as a clean success.

`capture` skips any output that already exists unless `--fresh` is given — correct for resuming an
interrupted run, wrong when the *settings* changed. The tally hid it by counting a cache hit as an
`ok`.

- **After any geometry, override or deinterlacer change, re-capture with `--fresh`.** It is scoped to
  the shows `--only` selected, so it is safe on a single unit.
- The tally now prints `cached=N` beside `ok`, so a no-op is visible. Prove it fires before
  trusting it: re-run without `--fresh` and confirm `cached` equals the frame count.
- **Verify the FILES, not the tally.** One `Image.open().size` over the work directory catches it
  instantly, and is what did.

§15 again, in the place it is easiest to forget: a counter that is right about what it measures and
wrong about what you think it measures.

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
      evidence in Notes — the override fixes capture, the record is what the collection knows
- [ ] `scripts/audit-aspect-vs-source.py --artist "<name>"` run; disagreements resolved
- [ ] Letterbox measured at ≥2 timestamps (row profile from bright frames on VHS or off-air,
      §4.3b); bars KEPT, rows in Notes, `AspectRatio` the frame ratio — no new `crop` rule (§4.3)
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
      DARK SOURCE. An artist with zero dark shows still needed 16 of 54 non-hero slots replaced
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
      documented in Notes (§2); every multi-act disc, split bills included, filed through
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

Every step that lived only in my head across two artists caused a bug. This is the sequence;
follow it in order.

```bash
cd ~/VaultShots                    # pipeline commands run HERE; repo commands (step 8) in the repo
R=~/Desktop/Projects/the-vault
A="Stone Temple Pilots"

# 0. SCOUT - one read-only pass, before any decode.
#    First confirm the name as STORED. Every artist is filed without a leading "The"
#    (`Killers`, `Strokes`, `Offspring`, `Verve`, `Prodigy`), and a wrong name gives a clean,
#    EMPTY report with no error (Field lessons, Killers). Case does not matter; spelling does.
#    a = one distinctive word of the name, lower-case:
python3 -c "import json; a='temple'
print({s['Artist'] for s in json.load(open('$R/public/shows.json')) if a in (s.get('Artist') or '').lower()})"
./scout.sh "$A"
#    Bundles preflight, multi-show detection, image-vs-record AND record-vs-source geometry,
#    sidecar setlists, split bills, and the list of sidecars to read.
#    READ EVERY SIDECAR IT LISTS. info.txt / *.nfo / *.md5 are written by whoever made the
#    disc and are the single most informative artefact available: across several artists they
#    have revealed a three-show disc, a wrong date, another band's setlist, a source lineage
#    and full setlists - all before decoding a frame.
#    Resolve every ambiguity BEFORE capturing. Stills of the wrong concert are not detectable
#    afterwards. Build ONE html page of what is still open, open it, ask the owner once.
#    Read "MENTIONED UNDER OTHER ARTISTS" too: a record filed under someone else can BE this
#    artist's show (Ben Harper's Last Call was 29 min of him under Various Artists). Most hits
#    are guest spots - the snippet says which.
#    Do NOT idle while the owner answers. Capture every UNAMBIGUOUS unit now, and pin any
#    ambiguous folder to its PROVEN titleset in splits.json first (Ben Harper: the ACL record's
#    checksum proved VTS_02, so it was pinned there and captured while VTS_01 awaited a yes).
#    Nothing whose identity is still open gets captured.
#    A disc with several ACTS on it is a Various Artists recording - it is filed through the
#    va-masters skill, never as a standalone record made here (§10).

# 1. WHO'S-WHO - before picking anything, not after (§6.2d-3)
#    data/whoswho_<artist>.md: who fronts the centre mic, who plays what, extra people, and
#    ONE physical discriminator for the frontman that survives a thumbnail. Not hair colour.

# 2. CAPTURE - plan, capture, score, contact, autopick, materialise, review sheet
./run_artist.sh "$A"        # run in the BACKGROUND, wait for the notification, do not poll
#    Use ./run_artist_noplan.sh when state.json has been deliberately pruned - re-running
#    plan rebuilds it and undoes the pruning.
#    Check the summary: 0 rejected, no show starved, picks attempted == resolved.
#    ADDING A UNIT LATER is cheap: write the record, add its splits.json entry, re-run this
#    same command. Existing units come back `cached=N` (nothing re-decoded), `autopick --merge`
#    keeps every hand-picked entry, and an existing split unit's key does not change when a
#    sibling entry is added. Back up data/picks.json first anyway.

# 3. REVIEW ALL FOUR SLOTS - reports/review.jpg, ONE read for the whole artist (§6.2d-00)
#    ~6k vision tokens. This is what catches commercials, title cards, credit rolls, channel
#    idents and other bands. Do this on EVERY artist, not only ones marked DARK SOURCE.

# 4. HEROES - sweep, never a contact sheet (§0a-2)
#    Sweep the full capture at 150px, ~40 frames per show, three shows per image, for every
#    show whose hero is wrong. autopick marks slot A "A?" because the scorer cannot know who
#    anyone is; on the last artist 14 of 18 were wrong.
#    Verify each hero at >=340px BEFORE writing it, checking for the who's-who discriminator.
#    Record it: data/hero_verified.json -> {"<ShowID>": {"ts": "...", "checked_px": 420}}
#    No usable close-up of the singer at all -> data/no_closeup.json with a reason, and say so.
python3 hero_gate.py                         # must pass before promote will run

# 5. MATERIALISE - after EVERY edit to picks.json, no exceptions
python3 shots.py --artist "$A" picks
#    Asserts attempted == resolved + unresolved. Anything UNRESOLVED must be re-captured
#    from source before going further (§5.2 for broken containers).

# 5b. ASPECT A/B - every 4:3-flagged, bar-free, post-2000 source at BOTH shapes (§4.4)
python3 aspect_ab.py
#    A self-consistent 4:3 flag on a squeezed 16:9 broadcast passes every gate; six
#    Stereophonics sources shipped squashed that way. Open this page WITH the picks page.

# 6. SHOW THE OWNER - a local page in his browser, never a Claude Artifact
./showpicks.sh "$A"; open reports/<artist>_aspect_ab.html
#    Refuses if the staged artist is not the one asked for, and refuses to open a page whose
#    images do not resolve. STOP HERE until he signs off - on the picks AND on every
#    source's shape.

# 7. PROMOTE - only after sign-off
#    Build data/promote_map.json from each state entry's ShowID, and assert the values are
#    UNIQUE. Do NOT use --propose-map: it matches on name, and two units that share a folder
#    (any split) both map to the same record - one concert's stills onto the other's record.
python3 promote.py                           # dry run - read the OLD->NEW column and SKIPPED
python3 promote.py --apply
#    It refuses on overrides, heroes, existing orphans and unlinked folders; it does NOT run
#    the health check or look at git (§11).

# 8. SYNC, VERIFY, COMMIT - on main, in the REPO, never pushed
./sync_skill_copies.sh "$A run"              # ~/VaultShots is the master; refreshes the repo's
                                             # skill copies, lists them, commits ~/VaultShots (§18)
cd "$R"
python3 scripts/health-check.py
python3 scripts/audit-image-geometry.py --artist "$A"  # must be 100% correct now
#    A deliberate Setlist removal needs an entry in scripts/setlist-removals-approved.json
#    or the push is blocked.
git status --short                           # what you did not touch is another session's
git status --short --ignored -- public/images .claude/skills   # NEW files show only as !!
git add -- <each new file> && git commit -m "feat(images): $A ..." -- <every path, by name>
#    One command, explicit paths, the changed skill copies included - full form in §11.
#    Nothing left staged. Every manifest entry a tracked file (§11). NEVER push: each push
#    to main deploys the live site, and the owner says when.
mv ~/VaultShots/promote-backup ~/.Trash/promote-backup-$(date +%Y%m%d-%H%M%S)
#    The backup only covers promotion -> commit; git holds everything now (§11).

# 9. ARCHIVE - LAST, and only after the commit
cd ~/VaultShots && python3 shots.py --artist "$A" archive
#    It clears work/ and moves picks/, which breaks the review page and forces a re-capture
#    for any later correction. Never run it before sign-off.
```

### `archive` must carry the pages' EVIDENCE, not just `picks/` and `contact/`

**Failure this prevents:** archiving Silverchair moved three report pages into `archive/silverchair/`
and rewrote `../picks/` to `picks/` correctly — and the scout page landed there with **21 broken
images**, because its evidence frames live in `ident/<artist>/_evidence/`. The carry-across logic
matched only directories sitting directly under `reports/`: it captured the bare token `ident` from
the rewritten path, looked for `reports/ident`, found nothing, and moved on in silence. The run
printed `0 asset dir(s) moved` and read as success.

This is the third time the same shape of bug has hit `archive` — the first emptied `picks/` from
under eight pages. Resolve **every** referenced path against both `reports/` and the staging root,
and copy per FILE keeping its relative path:

```python
for ref in set(re.findall(r'(?:src|href)="([^"#:]+)"', html)):
    ref = urllib.parse.unquote(ref.split("#")[0])
    if ref.startswith(("/", "http")) or (dest/ref).exists(): continue
    for root in (REPORTS, HOME):
        if (root/ref).is_file():
            (dest/ref).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(root/ref, dest/ref); break
```

Per file, never per tree: `ident/` holds **every** artist's evidence, so `copytree` + `rmtree` on it
would take the whole collection's identification work with one artist's archive.

**Verify by rendering, not by the counter.** Walk every `src`/`href` in every archived page and
assert the target exists on disk. Silverchair now reports 21 assets carried and 0 missing across
three pages; before the fix the same counter said 0 and 0 was wrong.

**`promote-backup/` is not the rollback plan once a run is committed.** `promote.py` writes it on
every `--apply`, and it covers only the gap between promotion and commit; after the commit, git
history holds the replaced images and the directory is pure duplication. Trash it at step 8 and
roll back with git (§11).

### Scale expectations

| Shows | Frames | Capture | Review |
|---:|---:|---|---|
| 7 | ~3,500 | ~20 min | `review.jpg` once, one hero montage, a sweep image per 3 shows whose hero is wrong |
| 21 | ~7,500 | ~45 min | the same — still one `review.jpg` and one hero montage; sweeps only where needed |

Never per-show contact sheets (§0a-2).

Storage runs ~600 MB during capture, dropping to ~50 MB after pruning (§12).

### Outcomes that are NOT failures

- **"No true close-up exists in this source."** Wide-camera arena broadcasts genuinely have
  none. Label the pick as the closest available; do not pass a wide shot off as a close-up.
- **Fewer than four picks** on a compilation where the artist appears briefly.
- **A show skipped at promotion** because promoting would replace more good images with fewer.

Say these plainly. A thin, honest result beats a padded one.

---

## 18. Reference implementation

**`~/VaultShots/` holds the master copy of every pipeline script. The scripts in this skill
directory, and in `.claude/skills/va-masters/`, are copies** — kept in the repo so the tools are
versioned and backed up with the site. Edit and run only the `~/VaultShots/` versions; a repo
copy that differs is stale, never a fork to merge back. `~/VaultShots/sync_skill_copies.sh`
refreshes every copy from its live namesake, lists what changed, then commits `~/VaultShots`
itself to its own local git with the message given as its argument (`--check` lists only,
commits nothing, and exits 1 if any copy differs). `~/VaultShots` has no remote by the owner's
choice (2026-10-05), so that local commit is its only history — it once went nine days without
one. Run it at the end of every run, after promotion and before the commit,
and commit what it lists with the run (§17 step 8). To bundle a NEW script, copy it into the
skill folder once and `git add` that exact path (§11); the sync keeps it current from then on.
`shots.py` and `subject.py` implement most of this file.

```
python3 shots.py --artist "<Artist>" plan    # probe, compute targets, run gates
#   --artist is a GLOBAL flag and must precede the subcommand. `plan` requires it (there is
#   no default) and resolves it case-insensitively to the stored spelling, warning loudly
#   with suggestions when nothing is filed under it. The other subcommands read the artist
#   from data/state.json.
python3 shots.py capture                      # extract + verify every frame
python3 shots.py score --top 24 --mindist 12  # filter crowds/graphics/blur, rank
python3 shots.py contact                      # contact sheet per show
python3 shots.py index                        # HTML index of all sheets
python3 shots.py picks                        # materialise picks/ + picks page
python3 shots.py archive                      # park a finished artist
python3 shots.py ab                           # deinterlace A/B comparison

python3 promote.py                            # dry run
python3 promote.py --apply                    # write images + manifest
#   promote.py --propose-map exists but matches on NAME: two units sharing a folder (any
#   split) both map to the same record. Build data/promote_map.json from ShowIDs instead.

./scout.sh "<Artist>"                         # one read-only pass before any decode (§17 step 0)
./run_artist.sh "<Artist>"                    # plan -> capture -> score -> autopick -> picks
./run_artist_noplan.sh "<Label>"              # same, without PLAN, for a pruned or subset state.json
python3 plan_subset.py --label L --ids ids.json   # plan only listed ShowIDs ({artist: [ShowID,…]});
                                              # REFUSES if any yields no unit (Field lessons)
./showpicks.sh "<Artist>"                     # materialise, verify links, open for the owner
python3 hero_gate.py                          # refuse promotion until every hero is verified
python3 aspect_ab.py                          # every 4:3-flagged, bar-free, post-2000 source at both shapes
python3 doc_sweep.py <ShowID> [...]           # 48-frame sweep for the Documentary call -> doc_sweeps/
python3 reconcile.py                          # records vs the drive -> data/reconcile.json
python3 find_undocumented.py                  # folders with no record, matched on SIZE not name
python3 fix_paths.py                          # repair FolderPath after a drive remount (reads data/reconcile.json)
./sync_skill_copies.sh "<msg>"                # refresh the repo's copies; commit ~/VaultShots
```

Working files live under `~/VaultShots/data/` — `state.json`, `picks.json`, `splits.json`,
`overrides.json` (per-show aspect corrections), `promote_map.json`, `reconcile.json` and
`reconcile.py`'s `hash_cache.json` among them — never a session scratchpad.

**The paths are hard-coded to this machine.** Not only `shots.py` (`HD_ROOT`, `REPO`, `HOME`,
`DEDUPE_DB`): `preflight.py`, `scout.sh`, `promote.py`, `aspect_ab.py`, `check_overrides.py`,
`find_multishow.py`, `find_undocumented.py`, `reconcile.py`, `fix_paths.py`,
`titleset_checksums.py`, `doc_sweep.py` and `bp.py` name `/Users/ko/...`,
`~/Desktop/Projects/the-vault` or `/Volumes/Live Music` themselves. Moving the collection or the
repo means finding them all:

```bash
grep -n '/Users/ko\|Desktop/Projects\|/Volumes/' ~/VaultShots/*.py ~/VaultShots/*.sh
```

---

## Field lessons — collection traps

Lessons from capture runs across the collection, moved here from CLAUDE.md on 2026-10-05. Most
already had a home in this file, and the index says where. The rest follow in full.

| Lesson | Where it lives |
|---|---|
| Reach the display shape by growing the under-sampled axis — never downscale, never upscale past native to make two shows match | §4.1, §4.1b |
| Two audits: images vs record (squashed stills), record vs source (records that are themselves wrong) | §4.1c; §4.4, "Auditing records against the SOURCE" |
| A record's `AspectRatio` is frequently wrong — write the correction back with its evidence | §4.4, "WRITE THE CORRECTION BACK" |
| Look at a record's CURRENT stills before trusting its identity | below |
| The capture pass finds the collection's gaps; "no footage here" needs the same evidence as a positive | below |
| A record can cover one titleset while its name describes another | §10b, "A record can COVER one segment while its NAME describes another" |
| Compilation discs: one wanted segment among many | §10b, "A compilation disc hides ONE wanted segment" |
| Split bills: one record per band, per tape | §2, "Artist matching", item 3 |
| A nested folder can hold a SECOND COMPLETE DISC | §10b, "A SECOND COMPLETE DISC can sit in a subfolder" |
| A sidecar's LINE-UP block imported as data | below |
| A circle test can lie — Pearl Jam, ACL 2009 | below |
| A 4:3 flag with no bars on a post-2000 broadcast can be a squeezed 16:9 | §4.4, "A 4:3 flag with NO bars" |
| Point lights do NOT measure the aspect of an SD source | §4.4, "Adjudicate a disputed aspect against a KNOWN source" |
| A letterbox inside a 16:9-FLAGGED frame; an invented container SAR — Limp Bizkit | below |
| cropdetect cannot see a VHS letterbox | §4.3b |
| The two-part `AspectRatio` form means the images are cropped — now legacy only | §4.3, "The two-part AspectRatio string" |
| A letterbox is not necessarily 16:9 — measure it | below |
| A seek can land in the OTHER show — Woodstock 1994 + 1999 | §5.2, "A seek can succeed and land in a DIFFERENT SHOW"; its three RHCP matching traps below |
| An artist filed without its article returns ZERO records — Killers | below |
| A record captured once can have NO saved capture rule | below |
| A folder can glue the artist's name to the date | below |
| Five "FOTTP" discs held eighteen programmes | below |
| An artist name of single letters matched EVERY folder — R.E.M. | below |
| A prior session's "appears around X" is a guess | §10b, "A prior session's prose conclusion is not evidence" |
| One folder can hold more than one show; read every sidecar | §10b — Step 1 (`find_multishow.py`), Step 2 (sidecars); §17 step 0 |
| Check for orphaned images after any merge, delete or re-key | §10b, "A merge or a re-key ORPHANS images" |
| Run `preflight.py` before capturing | §0b |
| Assume a multi-titleset folder is several shows | §10b, "ASSUME a multi-titleset folder is several shows" |
| Image A is always a close-up of the lead singer | §6.2d-0, §6.2d-2 |
| Hand-pick all four slots, on every artist | §6.2d-00 |
| The bassist singing backing vocals | §6.2d-2, "The BACKING singer at his own mic" |
| Reviewing costs more than capturing | §0a, §0a-1 |

### Look at a record's CURRENT stills before trusting its identity

On 30 Seconds to Mars, three records were showing the wrong thing on the live site and no audit
could say so: a "Kooks" record showing 30STM (it held the wrong titleset's hash), a "Last Call"
record showing Carson Daly's other guests (keyed to the wrong titleset of a VA compilation), and
a "Late Show" record whose only image was a black frame, over footage of a different band on a
different talk show. Geometry audits pass all three — the images agree with the record. The
last, `e814e4732ab9`, was re-filed with the owner's agreement (2026-10-02) as Nickel Creek under
the Late Night #6 2005 master, of whose VTS_14 it is a byte-identical copy.

The capture pass is also the most reliable way this collection finds its own gaps: shows with
**no record at all**, records holding **another band's setlist**, records whose **dimensions
disagree with the disc**, folders holding **two shows** (§10b), and a record stating its folder
held **none of the artist's footage** when 1 of its 16 titlesets was their own episode (§10b,
compilation discs).

**A "no footage here" conclusion needs the same evidence as a positive one.** On a disc whose
container reports bad timestamps, sampling can appear to cover two hours while covering seconds
(§5.1, §5.2b), so absence looks identical to a failed scan. Re-check before excluding.

Two Smashing Pumpkins records, `d9b007dd78f2` and `32fafc677477` (Brixton 1996, `Disc1` /
`Disc2`), can never be re-captured: they point at a nested folder that no longer exists on the
drive. Do not chase them.

### A sidecar's LINE-UP block gets imported as data — into three different fields

Queens of the Stone Age had one sidecar section land in two records, two different ways:

| Record | Field | Value it was given | Where it came from |
|---|---|---|---|
| `8e8d56e0a5f7` | `EventOrFestival` | `Nick Oliveri` | the 2nd name in `Lineup:` |
| `8e8d56e0a5f7` | `VenueName` | `bass, lead vocals` | that name's instrument credit |
| `cdd7abcd3d24` | `Setlist` | `Complete show; Josh Homme; Joey Castillo; …` | the whole `Line up :` block as tracks |

The same class as the Alanis "Friesland" case (§10b, an uploader's home town read as the city):
**the importer took whatever line sat where it expected a value.** The tell is a field holding a
person's name, an instrument or a role:

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

Read the whole sidecar before trusting any field derived from it, and check the **first and
last three** setlist entries (§2, "A populated Setlist is not a checked Setlist") — a line-up
block sits at the top or the bottom.

### A circle test can lie — Pearl Jam, Austin City Limits 2009

`fa2699316abb` declared 4:3 (720x480, SAR 8:9) and was internally consistent, so no gate caught
it. It is 16:9: the sidecar's lineage is `HD Broadcast>SD Standalone DVD XP`, a widescreen
broadcast squeezed into a 4:3 frame by a recorder that writes a 4:3 flag whatever it is fed.
There are no bars, so nothing looks wrong until you look at a face — which is how the owner
caught it ("looks squished"), after an automated check had cleared it.

- **The drum-head circle test got it backwards.** A kit shot from the side is foreshortened
  horizontally, so its head reads *too wide* at any aspect and the frame "passes" as 4:3.
- **What settled it was a source whose geometry is beyond doubt**: a square-pixel HD capture of
  the same performer from the same era, the 1920x1080 Storytellers. Rendered against it, the
  disputed face was narrow and elongated at 4:3 and matched exactly at 16:9. That is §4.4's
  same-performer, same-era method — evidence. Judging the disputed frame at both shapes on its
  own is not.
- A lineage reading `HD Broadcast > SD DVD` makes a 4:3 flag suspect before anything is decoded.

### A letterbox inside a 16:9-FLAGGED frame, and a container SAR that is simply invented — Limp Bizkit, Rock am Ring 2009

The show existed twice: an MKV (`a82c7d813257`) flagged SAR 247:176, displaying at 2.06:1, and a
DVD (`dd47c5fa0e57`) flagged 16:9 whose picture sits in rows 44–529 behind digital-black bars,
displaying at 2.11:1. Neither audit caught the DVD: cropdetect and the letterbox checks only
looked for bars in 4:3 frames, and "16:9 flag, 16:9 record" agreed. The tell was the scout — the
MKV's geometry came back UNKNOWN (an empty `AspectRatio` and a SAR no standard produces), and
probing it led to the DVD.

What settled it was **structure, not measurement.** Frame-matching the two (64×36 grey
thumbnails, normalised, the DVD's bars cut off for the comparison only) put them at a constant
36.5 s offset with identical framing — but only the DVD carries a Rock am Ring logo bug, so they
are independent captures, and two captures sharing one framing means neither is a crop. Other
broadcasts of the festival are full-frame 16:9. The DVD's whole frame is therefore 3:2 (16:9
picture × 576/486): captured at 864×576 **with the bars kept**, `AspectRatio: "3:2"`, through a
`showid`-scoped `dar` override — keep-bars (§4.3) and a flag fix (§4.4) in one record.

- Check a 16:9-flagged DVD for bars the same way as a 4:3 one.
- Treat a non-standard container SAR — anything not 1:1, 8:9, 10:11, 16:15, 32:27, 40:33, 16:11,
  64:45 or 4:3 — as unexplained until proven.
- Where a disc's own VOBs declare **different** aspects, pin the answer in `overrides.json` even
  when the default happens to be right (§4.4). VOB sort order is not evidence.

### A letterbox is not necessarily 16:9 — measure it

Two Queens of the Stone Age Eurockéennes discs: same taper, same DVD recorder, same channel, both
4:3 PAL with the Europe 2 TV logo burned into the upper bar. The 2005 disc's picture is rows
72-503 = 432 rows, exactly 16:9. **The 2007 disc's is rows 56-519 = 464 rows, which is 1.66 —
nearer 5:3.** Both letterboxes are symmetric about the frame centre, so neither is a mis-measure.

Assuming 16:9 would have thrown away 32 rows of real picture under a crop, and today would put a
wrong ratio in `Notes`. Record the rows and the ratio they actually give (§4.3). Both discs were
captured before the keep-bars rule and are legacy crops — `a096956b26e1` is recorded
`4:3 (letterboxed 16:9)` and `cdd7abcd3d24` `4:3 (letterboxed 5:3)`, matching their cropped
images. Leave them as they are.

### Three RHCP matching traps (the Woodstock 1994 + 1999 run)

The two-show-stream seek trap from that run is in §5.2. Three smaller ones from the same artist:

- **Ten folders are named `RHCP …`**, which shares no token with the name. An `rhcp` alias now
  catches them — the QOTSA case again (§10b, "The artist-matcher can widen as silently as it
  narrows").
- **A record can be claimed for an artist only through `splits.json`** — Rolling Stone 25's one
  RHCP chapter. Discovery now honours such claims.
- **A folder shared by two artists** now plans only the current artist's split part.

### An artist filed without its article returns ZERO records, silently — `Killers`

Since 2026-10-04 every artist is stored without a leading "The" — `Killers`, `Strokes`,
`Offspring`, `Verve`, `Prodigy` (CLAUDE.md → Metadata conventions → Artist). `scout.sh "The
Killers"` printed a clean report of `0 records` with every section empty — no error, no hint —
while five shows sat under the shorter name. Case no longer matters (`shots.py plan` resolves the
name case-insensitively and warns, with suggestions, when nothing is filed under it); the article
and the spelling still do. Before any run, confirm the stored spelling (§17 step 0):

```bash
python3 -c "
import json; a='killers'
print({s['Artist'] for s in json.load(open('public/shows.json')) if a in (s.get('Artist') or '').lower()})"
```

### A record captured once can still have NO saved capture rule — re-picks fail

The 2026-09-29 tier-2 hero review re-picked 107 already-captured shows, and 20 would not plan:
their split or disc mapping had been done by hand at first capture and never written to
`~/VaultShots/data/splits.json`. Two-disc sets (`Disc 1/`, `Disc 2/`), time-window splits, a
Blu-ray `BDMV/STREAM/` folder, a folder renamed on the drive (`DVD-Offspring-LiveWembley2001` →
`Offspring - Live Wembley 2001`) and a drive-side typo (`Columbus OH 1009-5-28`) all dropped out
silently in a plain artist run. Prove each by re-hashing its `RepVideoFiles`, then save the rule
— and write every hand mapping into `splits.json` in the session that makes it.

For a subset of shows across artists, `plan_subset.py` plans only the listed ShowIDs and
**refuses** if any produces no unit:

```bash
set -o pipefail      # so a refused plan stops the chain even through the pipe
python3 ~/VaultShots/plan_subset.py --label L --ids ids.json | tee plan.log && \
  ~/VaultShots/run_artist_noplan.sh L                  # ids.json: {artist: [ShowID, ...]}
```

### A folder can glue the artist's name to the date — `stereophonics2003-06-07dvd`

That tokenises to `{stereophonics2003, 06, 07dvd}`: no token equals `stereophonics`, so `plan`
reported `ready: 28  skipped: 0` for 29 records and the Rock am Ring 2003 disc was never
captured. `shots.py` now accepts the squashed artist name followed **only by digits**; checked
across all 168 artists then in the collection, it changed exactly that one match. The count
check (folders found vs records, §2) is what caught it — run it every time.

### Five "FOTTP" discs held eighteen programmes

Stereophonics' fan compilations `FOTTP 1/2/4/7/10` were five records for **eighteen titlesets,
each a separate programme** (festival sets, *Later*, *Headliners*, *Re:covered*, talk shows, two
documentaries). Every existing record had its disc's whole sidecar pasted in as its `Setlist`, and
one (`f4445e77f8e6`) described *Later* 2002 while its checksum is Rock am Ring 2003. They are now
one record per titleset, each keyed by a real content hash over that titleset's
`VTS_NN_0..n.VOB` (§10b, "Prefer a TITLESET split"). A disc named only by a volume number is a
§10b multi-show folder until swept.

### An artist name of single letters matched EVERY folder on the drive — R.E.M.

`toks("R.E.M.")` split to `{r, e, m}`, all discarded by the `len > 1` filter, leaving the
artist's token set **empty**. `need = min(2, len(artist_toks))` (§2) fell to 0, and the
`>= need` test passed for everything: `plan` reported **144 shows ready** for a nine-show artist
and flagged nothing. Fixed in `shots.py` by collapsing dotted initialisms to one token (`r.e.m.`
→ `rem`, `n.e.r.d` → `nerd`) so artist and folder names meet, plus a guard that refuses to match
anything when a name yields no usable token.

**A matcher that silently widens is more dangerous than one that fails.** §2 documents the
opposite failure — too-strict matching dropping shows in silence. This is the same bug with the
sign flipped, and the folder-count check catches both.

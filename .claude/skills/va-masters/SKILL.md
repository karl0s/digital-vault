---
name: va-masters
description: Turn a multi-artist recording (festival broadcast, TV compilation, split-bill disc) into one Various Artists MASTER record plus one LINKED record per act, each with its own time window, setlist and stills, linked back to the master. Use when working through the Various Artists checklist, or whenever a disc holds more than one act.
---

# Various Artists masters and linked records

**`Notes` is public; `PrivateNotes` never reaches the site.** The running order, sources, billing
and every other note this procedure writes go in `PrivateNotes`; `Notes` holds only an info file
from the disc's own folder, pasted verbatim (CLAUDE.md → *Notes and PrivateNotes*).

The owner's model, stated 2026-09-30:

- The **master** is the whole recording as it exists on this disc — filed under
  `Various Artists`, full runtime, 4 stills of up to 4 *different* acts.
- Every act on it becomes a **linked record**: filed under the act, only that act's
  minutes, only that act's setlist, 4 stills of that act only, and a link back to the
  master ("Part of …").
- A linked record describes **this disc's copy, honestly**. If the collection already has
  a longer copy of the same set from another disc, do NOT reuse or link it — make a new
  record from this disc's shorter real version and name the other copy in `PrivateNotes`.
  ("dont use unrelated existing longer recordings from another source — that is lying.")

Progress lives in `~/VaultShots/data/va_tracker.json` and renders to
`~/VaultShots/reports/va_checklist.html` (`python3 ~/VaultShots/va_checklist.py`). Work it
top to bottom, one master at a time. Always re-render and `open` the checklist after a
status change — the owner reads it, not the terminal.

## Data model (see CLAUDE.md → shows.json)

| Field | On | Value |
|---|---|---|
| `ParentShowID` | linked record | the master's ShowID |
| `SegmentStart` / `SegmentEnd` | linked record | `H:MM:SS` on the **master's** timeline |

The drawer (`components/ShowDrawer.tsx`) renders the link and the master's
"On this recording" list from these alone; song counts come from each linked record's
`Setlist`. `scripts/health-check.py` fails a dangling/hidden/nested parent or a bad segment.

## Per master — the steps

### 1. Map the disc (read-only)
```bash
python3 ~/VaultShots/dvd_chapters.py "/Volumes/Live Music/<folder>"          # titleset lengths + chapter marks
python3 ~/VaultShots/titleset_checksums.py "<folder>"                        # which titleset each existing record keys
```
- Read every sidecar (`Info.txt`, `*.nfo`, `EXTRAS/…`). A sidecar listing acts, lengths and
  songs is truth on its own (Pinkpop 1994/95 gave all three).
- **Chapter marks are often automatic** (every 6 or 10 minutes) — they are not songs.
  Uneven chapter lengths usually are songs; even ones never are.
- **The disc index can under-report** (Popkomm 2006: IFO says 32 min, the stream runs 2 h).
  Trust decoded frames over the IFO for length.
- Records on Big Daddy rips are often keyed on the **first VOB only** — `shasum` that one
  file to prove a match when the whole-titleset hash does not.

### 2. Break down the acts
Frames every 5 s are pre-decoded under `~/VaultShots/va_frames/<tag>/v<VTS>_NNNNN.jpg`
(frame N = (N−1)×5 s into that titleset; override the directory with `VA_FRAMES=<dir>`). They
are an index, not a clock — on concatenated or timestamp-broken streams they drift by minutes
(see "Frame-count everything" below). Build a chapter-marked sheet and read it:
```bash
python3 ~/VaultShots/va_sheet30.py <tag> "<folder>" 3 out.jpg     # 1 frame / 15 s, chapter starts in red
```
For each act record: start, end (master timeline = titlesets concatenated in order),
length, song count, setlist, and **how we know**. Song-count sources, best first:
1. the disc's sidecar;
2. on-screen song captions (WDR/BBC/MTV caption many songs);
3. a published setlist of the full set — mark the count `N?` and say the broadcast may be
   an edit. Never present an event setlist as the broadcast's without saying so.
A count you cannot establish is `?`, never a guess.

Write the acts into the tracker (`acts: [{artist,start,end,songs,setlist,source,existing}]`),
set `status: proposed`, render, open. **The owner decides which acts get records.**

### 3. Create the records
- **Master**: new ShowID `sha1(FolderPath + "|MASTER|<name>")[:12]`; `ChecksumSHA1` = real
  content hash of all its titlesets' VOBs in order; `Artist: Various Artists`; full
  `DurationSec`; `PrivateNotes` = the running order (`H:MM:SS-H:MM:SS  Act (N songs)`) + sources.
- **Linked record per act**: if the act is exactly one titleset, key it by that titleset's
  real content hash; if it is a time window inside a titleset, use a derived key
  `sha1(<titleset hash> + "|<Act>")` and say so in `PrivateNotes`. Set `ParentShowID`,
  `SegmentStart`, `SegmentEnd`, `Setlist`, `DurationSec` (the act's length only).
- **`Artist` is the collection's stored name, never the on-screen billing.** Look it up
  before writing (CLAUDE.md → Metadata conventions → Artist): no leading "The", the band's
  own spelling, "Person & the Band" under the person. All 23 "The X" artists the collection
  ever had came from this step copying a caption, and four of them split an artist in two
  (`The Prodigy` beside `Prodigy`). Put the billing as captioned in `PrivateNotes`.
- **Set `ContentType` on every new record, master and linked alike** (CLAUDE.md → Documentaries):
  `"Documentary"` when half or more of that record's runtime is people talking or narration over
  footage — an interview segment, a making-of, a behind-the-scenes piece — otherwise absent. A
  performance with host links is not a documentary. Judge from the frames, not the caption;
  `python3 ~/VaultShots/doc_sweep.py <ShowID>` sweeps a borderline one. `RecordingType` is how
  it was filmed and is never `Documentary`.
- An existing record that turns out to be one act of the master (e.g. the misfiled
  Pinkpop "Various Artists / DVD" record = the Rollins Band titleset) is **re-filed** as that
  act's linked record — keep its ShowID and checksum, fix Artist/date/setlist.
- Copy festival metadata from CLAUDE.md's canonical table (Pinkpop → Megaland, Landgraaf).
- Run `python3 scripts/health-check.py`; any removed setlist lines need an approval entry.

### 4. Capture
Pin every unit in `~/VaultShots/data/splits.json` (subdir / vts / from–to / decode single),
then plan and capture only those records, as in the concert-screenshots skill:
```bash
set -o pipefail            # so a refused plan stops the chain even through the pipe
python3 ~/VaultShots/plan_subset.py --label "VA Mnn" --ids ids.json | tee plan.log && \
  ~/VaultShots/run_artist_noplan.sh "VA Mnn"          # ids.json: {artist: [ShowID, ...]}
```
Picks, all hand-chosen, heroes verified at ≥340 px:
- master: slot A a lead-singer close-up of the most prominent act; the four slots spread
  over **different acts** (two acts → two each);
- linked record: the usual A/B/C/spare, that act only.
Build the before/after page (`python3 ~/VaultShots/bp.py TAG TITLE STATE NOTES.json`), open it, and point the owner at the local dev site
(`localhost:5173/digital-vault/`, search the festival) to check the links.

### 5. Close
After sign-off, in this order (concert-screenshots §11 and §17 steps 7-9 have the detail):
1. `python3 ~/VaultShots/promote.py --apply` (map built from state ShowIDs).
2. `~/VaultShots/sync_skill_copies.sh "<master> VA run"` — `~/VaultShots` holds the master of
   every script; the copies beside this file are refreshed from it, whatever it lists joins the
   commit, and it commits `~/VaultShots` itself (local git; no remote).
3. In the repo: `python3 scripts/health-check.py`, then commit on `main` by explicit path in ONE
   command (`feat(shows): <master> master + N linked records`), new files `git add`ed by exact
   path. Nothing left staged. **Never push** — each push to `main` deploys the live site; the
   owner says when.
4. Move `~/VaultShots/promote-backup` to `~/.Trash` — it only covers promotion → commit.
5. Archive the run, set the tracker entry `status: done` with the commit hash, re-render and
   open the checklist.

## Done so far
- **M01 Pinkpop 1994** — master `7efb4ead53d8`, SP `952d5f624f7a`, RATM `07346400f7e5`
- **M02 Pinkpop 1995** — master `884a7250626e` + 6 linked (Live, Danzig, Bad Religion, Biohazard, FNM, Rollins Band — the last re-filed from the misfiled VA record `44e20e4e66fd`).
- **M03 Phoenix 1996** — master `fb321cdafdbe` (re-filed VA record) + 11 linked, one titleset, time windows on chapter marks; each act dated to its own festival day, master to the month.
- **M04 Glastonbury 1997** — one master per volume (owner: acts repeat across volumes; one big record would get messy). 22 linked; unidentified segments stay inside the master, described. Vol 5 captions every act/song; an act with no visible face goes in `no_closeup.json`.
- **M05/M07 Reading 1997/1998** — a band appearing twice in one master gets ONE linked record with both songs; SegmentStart/End = first clip, both windows in PrivateNotes (owner, 2026-10-01). MTV magazine formats: find clips with a caption-strip scan, then read boundaries from 10 s frames.
- **Nested disc folders** (`Set/Disc 2 - …`) are indexed as their OWN units: a split keyed by the parent folder does not apply to a record whose folder IS the subfolder — key that rule by the subfolder name (RRTF 2000 EJ, Filter captured the whole disc until fixed). Always check each unit's `duration` in state against its window before picking.
- **Low-resolution sources** (352x240, 352x288): the owner asked for stills enlarged to the standard size (720x540 NTSC, 768x576 PAL) via an `upscale_to` override in `overrides.json` - per folder or per ShowID, and say so in PrivateNotes. Ask before applying it to a new source.
- **M14-M23, B01-B10, C01 (2026-10-02..04)** — checklist complete (41/41). Lessons:
  - **Frame-count everything.** The pre-decoded 5-second index frames drift by minutes on concatenated or
    timestamp-broken streams (Reading 2006 by up to 2 min, the MTV $2 Bill disc by 4). Decode with
    `select='not(mod(n,K))'` and convert with the disc's real fps (NTSC is 30000/1001 — reading an NTSC
    disc at 25 fps made correct boundaries look 20% wrong on MTV Spring Break 93).
  - **`-reinit_filter 0` for frame-counted decodes.** A stream whose format changes mid-way makes ffmpeg
    rebuild the filter graph, restarting `select`'s `n` at 0: a window 36 min in returned 0 frames (rc=0).
    `shots.py` now passes it for `decode: single` units; pass it in ad-hoc decodes too.
  - **TV compilations (Last Call, Conan, Leno):** one titleset per episode, in air-date order. Identify
    from the CD the host holds up and the desk guest, then match TVmaze (`api.tvmaze.com/shows/<id>/episodes`)
    or Wikipedia's season lists; file dates confirm the order.
  - **Interleaved episodes** (VH1 Storytellers Train/Fuel): the bands alternate, so a per-titleset split
    is wrong. Use the "act appears twice" rule and check every act record's hero is that act's singer —
    the Train record had shown Fuel's singer.
  - **Not every multi-programme disc is VA.** All-one-artist discs (Aerosmith compilation #123) and
    discs pairing unrelated programmes get no master; each collection artist's unrecorded source becomes
    its own record (owner, 2026-10-04).
  - **A record keyed to the wrong titleset** (Incubus Cribs: VTS_05, an HGTV show) is re-keyed with the
    owner's OK: rename the image files and the manifest key, keep ShowID and stills.

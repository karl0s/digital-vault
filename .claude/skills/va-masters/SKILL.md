---
name: va-masters
description: Turn a multi-artist recording (festival broadcast, TV compilation, split-bill disc) into one Various Artists MASTER record plus one LINKED record per act, each with its own time window, setlist and stills, linked back to the master. Use when working through the Various Artists checklist, or whenever a disc holds more than one act.
---

# Various Artists masters and linked records

The owner's model, stated 2026-09-30:

- The **master** is the whole recording as it exists on this disc — filed under
  `Various Artists`, full runtime, 4 stills of up to 4 *different* acts.
- Every act on it becomes a **linked record**: filed under the act, only that act's
  minutes, only that act's setlist, 4 stills of that act only, and a link back to the
  master ("Part of …").
- A linked record describes **this disc's copy, honestly**. If the collection already has
  a longer copy of the same set from another disc, do NOT reuse or link it — make a new
  record from this disc's shorter real version and name the other copy in `Notes`.
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
Frames every 5 s are pre-decoded under the scratchpad (`va/f5/<tag>/v<VTS>_NNNNN.jpg`,
frame N = (N−1)×5 s into that titleset). Build a chapter-marked sheet and read it:
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
  `DurationSec`; `Notes` = the running order (`H:MM:SS-H:MM:SS  Act (N songs)`) + sources.
- **Linked record per act**: if the act is exactly one titleset, key it by that titleset's
  real content hash; if it is a time window inside a titleset, use a derived key
  `sha1(<titleset hash> + "|<Act>")` and say so in `Notes`. Set `ParentShowID`,
  `SegmentStart`, `SegmentEnd`, `Setlist`, `DurationSec` (the act's length only).
- An existing record that turns out to be one act of the master (e.g. the misfiled
  Pinkpop "Various Artists / DVD" record = the Rollins Band titleset) is **re-filed** as that
  act's linked record — keep its ShowID and checksum, fix Artist/date/setlist.
- Copy festival metadata from CLAUDE.md's canonical table (Pinkpop → Megaland, Landgraaf).
- Run `python3 scripts/health-check.py`; any removed setlist lines need an approval entry.

### 4. Capture
Pin every unit in `~/VaultShots/data/splits.json` (subdir / vts / from–to / decode single),
then `plan_subset.py --label "VA Mnn" --ids ids.json` and `run_artist_noplan.sh`, as in the
concert-screenshots skill. Picks, all hand-chosen, heroes verified at ≥340 px:
- master: slot A a lead-singer close-up of the most prominent act; the four slots spread
  over **different acts** (two acts → two each);
- linked record: the usual A/B/C/spare, that act only.
Build the before/after page (`~/VaultShots/bp.py TAG TITLE STATE NOTES.json`), open it, and point the owner at the local dev site
(`localhost:5173/digital-vault/`, search the festival) to check the links.

### 5. Close
After sign-off: `promote.py --apply` (map built from state ShowIDs), health check, commit
(`feat(shows): <master> master + N linked records`), archive the run, set the tracker entry
`status: done` with the commit hash, re-render and open the checklist.

## Done so far
- **M01 Pinkpop 1994** — master `7efb4ead53d8`, SP `952d5f624f7a`, RATM `07346400f7e5`
- **M02 Pinkpop 1995** — master `884a7250626e` + 6 linked (Live, Danzig, Bad Religion, Biohazard, FNM, Rollins Band — the last re-filed from the misfiled VA record `44e20e4e66fd`).
- **M03 Phoenix 1996** — master `fb321cdafdbe` (re-filed VA record) + 11 linked, one titleset, time windows on chapter marks; each act dated to its own festival day, master to the month.
- **M04 Glastonbury 1997** — one master per volume (owner: acts repeat across volumes; one big record would get messy). 22 linked; unidentified segments stay inside the master, described. Vol 5 captions every act/song; an act with no visible face goes in `no_closeup.json`.
- **M05/M07 Reading 1997/1998** — a band appearing twice in one master gets ONE linked record with both songs; SegmentStart/End = first clip, both windows in Notes (owner, 2026-10-01). MTV magazine formats: find clips with a caption-strip scan, then read boundaries from 10 s frames.
- **Nested disc folders** (`Set/Disc 2 - …`) are indexed as their OWN units: a split keyed by the parent folder does not apply to a record whose folder IS the subfolder — key that rule by the subfolder name (RRTF 2000 EJ, Filter captured the whole disc until fixed). Always check each unit's `duration` in state against its window before picking.
- **Low-resolution sources** (352x240, 352x288): the owner asked for stills enlarged to the standard size (720x540 NTSC, 768x576 PAL) via an `upscale_to` override in `overrides.json` - per folder or per ShowID, and say so in Notes. Ask before applying it to a new source.

# The Vault — Claude Project Guide

## What this project is
A personal archive and browser for a private collection of concert video recordings.
Live site: https://karl0s.github.io/digital-vault/

The frontend is a React 18 + Vite 6 SPA (Tailwind v4, `motion`, zustand, base-ui,
MiniSearch). All show data lives in a flat JSON file (`public/shows.json`). Images are static
files served from `public/images/`. There is no backend.

---

## Repository layout

```
public/
  shows.json            ← master show data (source of truth, hand-curated)
  image-manifest.json   ← maps checksum → available image slot indices
  images/               ← {checksum}_01.jpg … _04.jpg per show
  images/temp-images/   ← staging for hand-taken stills (gitignored; empty after every task)
  fonts/                ← self-hosted woff2 (fonts/README.md)

App.tsx                 ← root: views, search input, drawer state
main.tsx                ← entry; DEV-only playground gate
components/             ← cards, grids, ShowDrawer, ArtistsView, TopNav, HeroSearch, FeaturedRows
  CloseButton.tsx       ← shared close button — use this for ALL close buttons
  shell/                ← AppShell, Sidebar, MobileTabBar
  filters/              ← FilterBar, FacetPopover, YearRangePopover, YearHistogram
  logos/                ← HalationLogo (the wordmark)
src/
  hooks/                ← useShows (data + getNotes + getImageUrl), useBrowseResults, useSearchEngine, useDebounce
  store/filters.ts      ← zustand filter store, synced to the URL
  lib/                  ← url.ts (canonical URL state), brush.ts (year-brush maths), motion.ts, cn.ts
  search/               ← searchIndex.ts (MiniSearch, field prefixes), facets.ts (filter, count, sort)
styles/globals.css      ← Tailwind entry and global CSS (imported by main.tsx)
dist/                   ← BUILD OUTPUT — never commit this, CI owns it
data-pipeline/          ← historical drive-scan scripts and CSVs (see Data pipeline)
docs/                   ← browse-redesign-spec.md — the Browse design and how the build departs from it
tools/
  add-temp-images.py    ← temp-images → slots + manifest, verified (see Temp images workflow)
  show-editor/          ← Karl's metadata editor; build.py renders index.html (gitignored)
scripts/
  health-check.py       ← integrity validator (pre-push hook, and the deploy)
  audit-*.py            ← read-only audits: image geometry, aspect vs source, sidecar setlists
  consistency-audit.py  ← read-only: same festival or same show recorded with different venue/city/country
  check-*.ts, check-perf.mjs ← the `npm run check` suite (see Browse architecture → Guards)
  perf/bench.mjs        ← measures Browse + drawer in headless Chromium (npm run perf)
  thumbs.mjs            ← card thumbnails, built into dist/thumbs/
  site-data.mjs         ← shows-lite.json + show-notes.json, derived from shows.json at build
  vite-plugin-*.mjs     ← wire thumbs.mjs and site-data.mjs into vite.config.ts
  setlist-removals-approved.json ← deliberate setlist removals the health check accepts
_playground/            ← dev-only UI experiments, never imported by the live app
  branding/             ← logo and typographic effect experiments
  grid/                 ← card layout and filter chip experiments
  proximity/            ← cursor-proximity hover experiments
.claude/skills/         ← concert-screenshots, va-masters (tracked); the rest are local only
.claude/commands/       ← /shots and /picks (screenshot runs)
```

---

## Playground

`_playground/` is a sandbox for UI experiments. Each subdirectory is a topic area.
Experiments are routed automatically via `import.meta.glob` + `React.lazy` in `PlaygroundRouter.tsx`.
Experiments and their notes are tracked in git, so they are backed up.

**Dev only — the playground never ships.** `main.tsx` gates the router behind
`import.meta.env.DEV` and loads it with a dynamic `import()`. Vite substitutes a
literal `false` for that flag in a production build, so Rollup drops the branch
and the glob with it: `dist/` contains no playground code at all.

Two consequences worth knowing:
- Run experiments with `npm run dev` and visit `/playground`. They are
  unreachable in a preview or deployed build by design.
- Keep the import dynamic and inside the `if`. A top-level
  `import { PlaygroundRouter } from './PlaygroundRouter'` is unconditional and
  bundles every experiment back into `dist/` regardless of the DEV check.

### Rules
- Every playground subfolder **must** have exactly one MD file, named for its topic (`branding/logo.md`, `grid/grid.md`, `proximity/proximity.md`).
- The MD file covers **all** TSX variants in the folder — not just v1. Update it as new variants are added.
- MD filename must not include a version number. The versions table inside the file tracks individual variants.
- TSX files are named `v{N}-{slug}.tsx` (e.g. `v3-halation-per-letter.tsx`). The MD file is just `{topic}.md`.

### MD file structure (required sections)
```
# {Topic} Playground — Reference & Progress Notes

## Goal
One paragraph: what is being explored and why.

## Versions
| File | Description |
|---|---|
| `v1-...tsx` | What this version tried |
| `v2-...tsx` | What changed |
...

## Key Decisions / Techniques
Document non-obvious choices: rejected approaches, why a technique was chosen,
known constraints. Enough context that future work can pick up without re-deriving.

## Live Site Integration  ← only if extracted to the real app
File path, props, usage examples.
```

Additional sections (effect vocabulary, locked defaults, filter chains, etc.) are added
as needed when complexity warrants it. Follow the depth of `branding/logo.md` as a reference.

---

## Deployment

- **Every push to `main` deploys the live site** — so nothing is pushed until Karl says
  (Git workflow).
- **GitHub Actions** (`.github/workflows/deploy.yml`) runs `python3 scripts/health-check.py`
  and `npm run check`, then `npm run build`, and publishes `dist/` to GitHub Pages. A failing
  check stops the deploy; the live site keeps the previous version.
- Vite copies everything from `public/` into `dist/`; the plugins add `thumbs/`,
  `shows-lite.json` and `show-notes.json`.
- `dist/` is gitignored and CI-owned — **never commit it**.

---

## The data model

### What the site loads (derived at build time)
`public/shows.json` is the source of truth and still deploys untouched, but the site does
not load it. Every build (and `npm run dev`) derives two files from it —
`scripts/site-data.mjs`, wired in by `scripts/vite-plugin-site-data.mjs`:

- `shows-lite.json` — every record minus `Notes` and the pipeline-only fields in
  `DROPPED` (`FolderPath`, `RepVideoFiles`, `Lineage`, `LastScannedAt`, …). Loaded first:
  about a quarter of the full file (566 → 136 KB gzipped on 2026-10-05).
- `show-notes.json` — `{ ShowID: Notes }`, loaded straight after.

Nothing to do when editing `shows.json`; the derived files follow it. Two rules for code:
**read Notes only through `getNotes`** from `useShows` (show objects on the site carry no
`Notes`), and **before displaying a field, check it is not in `DROPPED`** — if it is,
remove it from the list, or it will be blank on the live site. `npm run check:perf`
fails on either mistake. If the derived files are ever missing, the site falls back to
the full `shows.json`.

### shows.json
Flat JSON array of show objects. Key fields:

| Field | Type | Notes |
|---|---|---|
| `ShowID` | 12-char hex string | Unique identifier |
| `Artist` | string | Must match exactly (used for grouping). No leading "The" — see Metadata conventions → Artist |
| `ShowDate` | `YYYY-MM-DD` or `""` | Empty = undated; sorts last. Rules: Metadata conventions → ShowDate |
| `EventOrFestival` | string | Festival/event name e.g. "Glastonbury Festival", "MTV Unplugged" |
| `VenueName` | string | Physical venue name — not the festival name |
| `City` | string | |
| `Country` | string | |
| `RecordingType` | string | "Proshot", "Soundboard", "Audience": how it was **filmed**. Never "Documentary"; the health check rejects it |
| `ContentType` | `"Documentary"` or absent | What the record **is**. Absent = a live show. Drives the sidebar's Live / Documentaries filter, the card badge and the drawer pill. See *Documentaries* below |
| `ChecksumSHA1` | 40-char hex string | SHA1 of the source file; used as image key |
| `Notes` | string | Free text; temp checksum stubs have "TEMP CHECKSUM - update when files are scanned" here |
| `Hidden` | `"Yes"` or absent | Keeps the record in `shows.json` but off the site — filtered once in `src/hooks/useShows.ts`. For two records of one recording where only one should show; set `DuplicateOf` to the shown record and say why in `Notes`. Do **not** reuse `DuplicateOf` alone to hide: Jay-Z and Jack White carry it and are meant to show |
| `ParentShowID` | ShowID or absent | Set on a record cut from a multi-artist **master** recording (a festival broadcast, a talk-show compilation). The drawer shows a "Part of …" link to the master; the master's drawer lists every record pointing at it under "On this recording". One level only; the master must not be hidden. Checked by the health check |
| `SegmentStart` / `SegmentEnd` | `H:MM:SS` | Where that linked record sits on the master's timeline. Always set together with `ParentShowID` |

### Documentaries — `ContentType`

**The owner's rule: a record is a Documentary when half or more of its runtime is people
talking or narration over footage.** Standalone interviews, making-of, behind-the-scenes, MTV
Cribs-style shows, rockumentaries and TV biographies count. Storytellers, Unplugged and concert
films with backstage inserts do not. Judge it from the footage, never from the title: the Vines
titleset named "VTS_04 - documentary" is three-quarters live performance, and Foo Fighters MSG
2008's Notes claimed "about half interviews" when a full sweep found almost none.

The first full pass ran on 2026-10-04: every record's stills read blind, every folder name
checked against each artist's known documentaries, and a 48-frame sweep across the whole
programme for every borderline record. The owner decided all 87 candidates on a review page.
29 records are Documentary. Each changed record says why in `Notes` under `CONTENT TYPE (2026-10-04)`.
Before that pass, "Documentary" lived in `RecordingType` on 15 records, and 11 of them were
concerts (Rockpalast, Haldern, Weezer *Across the Sea*).

Set `ContentType` whenever a new record is created, the VA-master and screenshot procedures
included. To measure a borderline programme, use the read-only sweep tool, which samples MPEG
streams by byte position so broken DVD timestamps cannot misplace a frame:

```bash
python3 ~/VaultShots/doc_sweep.py <ShowID> [<ShowID> ...]   # contact sheets in ~/VaultShots/doc_sweeps/
```

Count the frames that are talking, interviews, archive or behind-the-scenes against the
performance frames. With 48 frames the estimate is about ±7%, so put anything between roughly
42% and 58% to the owner.

Four pieces of documentary footage have no record **by the owner's choice** (2026-10-04, "not
important"). Do not propose them again: the Cornell WDR interview (VTS_01 of the Audioslave `rar/`
disc), the interviews in VTS_03 of `Kings of Leon - BDO 2006 and 2004`, and the making-of (VTS_03)
and EPK (VTS_04) in `Supergrass - Pinkpop Festival Dutch TV 1997`.

### image-manifest.json
Maps `ChecksumSHA1 → [1, 2, 3, 4]` (array of available slot indices).
Only slots listed here are served — if a slot isn't in the array, the image is assumed missing.

---

## Image conventions

- Images are named `{ChecksumSHA1}_01.jpg`, `_02.jpg`, `_03.jpg`, `_04.jpg`
- Only `.jpg` format
- Up to 4 images per show; slot 1 is the primary (shown on cards)
- **All slots within a show must share identical pixel dimensions**
- When adding/replacing images:
  1. Copy new files to `public/images/` with correct `{checksum}_0{n}.jpg` name
  2. Update `public/image-manifest.json` to reflect the new set of indices
  3. **Never** leave files in `public/images/temp-images/` — clean it up every task

### Card thumbnails — build output, never committed

Cards do not load the originals. Every build makes a 640px-wide WebP of each slot-1
image (`scripts/thumbs.mjs`, run by the Vite plugin in `vite.config.ts`) and ships it as
`dist/thumbs/{checksum}_01.webp`. A card is at most ~580 real pixels wide even on a 3×
phone, so the thumbnail carries more detail than any card shows; it is encoded at WebP
quality 90 with sharp-YUV chroma. Originals are untouched and still serve the drawer
header and the image viewer.

- **Nothing to do when images change.** Thumbnails are regenerated from `public/images/`
  by content hash on the next build (or `npm run dev`); replaced images get new ones,
  removed ones are dropped. The images workflow above is unchanged.
- **Never commit them, never put them in `public/`.** They live in
  `node_modules/.cache/vault-thumbs/` (and the deploy's Actions cache), outside anything
  git tracks.
- **A missing thumbnail is not an error.** The card falls back to the original, so a
  fresh `npm run dev` looks the same while it builds them in the background (~80 s for
  ~1,200 the first time, then incremental).
- Only slot 1 has a thumbnail; `getImageUrl(checksum, 1, 'thumb')` gives its URL.

### Image geometry — display shape, not stored shape

DVD and broadcast pixels are not square. An image written at the source's raw
`Width`×`Height` is **squashed** — 720×576 PAL displays as 4:3 or 16:9, never as its stored
1.25 ratio. The correct output is derived from the sample aspect ratio.

**Rule: reach the display shape by growing the under-sampled axis. Never downscale, and
never upscale past native just to make two shows match.** Sizes legitimately differ by
broadcast standard; what must be exact is the aspect ratio.

| Source | Standard | Display | Correct output |
|---|---|---|---|
| 720×576 | PAL | 4:3 | 768×576 |
| 720×576 | PAL | 16:9 | 1024×576 |
| 720×480 | NTSC | 4:3 | 720×540 |
| 720×480 | NTSC | 16:9 | 854×480 |
| 704×480 | NTSC | 4:3 | 704×528 |
| 1440×1080 | — | 16:9 | 1920×1080 |
| 1280×720 / 1920×1080 | — | 16:9 | unchanged |

Audit the whole collection at any time — read-only, changes nothing:

```bash
python3 scripts/audit-image-geometry.py                     # images vs record
python3 scripts/audit-image-geometry.py --artist "Nirvana"  # detail for one artist
python3 scripts/audit-aspect-vs-source.py --artist "Nirvana"   # record vs SOURCE
```

The two audits answer different questions. The first compares the **images** to the
**record** — it catches squashed stills, and lists images that belong to no record
(`no show record`: run it after merging, deleting or re-keying any record). The second
compares the **record** to the **source on the drive** — it catches records that are
themselves wrong, which the first cannot, because when the record is wrong the images agree
with it and the check passes.

On 2026-10-05 the first passed 96.3% of records with images (another 2.1% the right shape but
larger than target) and flagged 20: 4 squashed, 3 undersized, 1 inconsistent, 1 of unknown
geometry, and 11 legacy letterboxed records it cannot check (below). Run it for the current
list; do not copy one in here.

**A record's `AspectRatio` is often wrong.** Discs declare 4:3 for a 16:9 broadcast that an
off-air recorder squeezed, and nothing in the flags shows it. Where a capture finds a wrong
aspect, write the correction back to the record in the same session, with the evidence in
`Notes`.

**Letterbox bars are kept, always** (the owner, 2026-10-05). Capture the whole stored frame;
`AspectRatio` is the **frame** ratio; the measured letterbox rows go in `Notes`. Correcting a
wrong aspect flag is still right — that fixes the display shape, it crops nothing. The two-part
form `4:3 (letterboxed 16:9)` survives only on legacy records whose images were cropped to the
picture, and the geometry audit cannot check them — it reports each as `letterboxed - needs
cropdetect`. Never write it for a new capture.

**Look at a record's CURRENT stills before trusting its identity.** A geometry audit passes a
record keyed to the wrong titleset, or showing another band, as long as the shape is right: on
30 Seconds to Mars three records were showing the wrong footage on the live site.

Two Smashing Pumpkins records (`d9b007dd78f2`, `32fafc677477`) can never be corrected: they point
at a nested folder that no longer exists on the drive, so their stills cannot be re-taken.

Capture and replacement is handled by the `concert-screenshots` skill
(`.claude/skills/concert-screenshots/SKILL.md`), which owns the full procedure, the fixed
encode settings (lanczos, `-q:v 2`, `yuvj420p`, `setsar=1`, no sharpening or colour changes)
and the read-only safety rules. Do not hand-roll ffmpeg calls for this.

**Collection traps found during capture** (multi-show folders, titleset/name mismatches,
sidecar import errors, aspect traps, matcher bugs) are in the concert-screenshots skill,
section "Field lessons — collection traps". Read it before any capture or record-splitting
work.

### Temp images workflow
User drops images into `public/images/temp-images/` then asks Claude to assign them to a show.

**Temp image filename convention**: files are always named `vlcsnap-YYYY-MM-DD-HHhMMmSSsNNN.jpg`.
The user references the hero image by the last 3 digits (`NNN` — the milliseconds portion), e.g. `'839' hero` means the file ending in `s839.jpg` goes to `_01`.

**Slot ordering**: hero image → `_01`. Remaining images in ascending timestamp order (alphabetical by filename) unless the user specifies otherwise.

**Use `tools/add-temp-images.py`** — it performs the steps below and verifies the result:

```bash
python3 tools/add-temp-images.py --show "irving plaza" --hero s257           # dry run: prints the plan
python3 tools/add-temp-images.py --show "irving plaza" --hero s257 --apply   # writes it
```

`--show` is a substring of Artist + FolderName (add `--artist` to narrow it). It refuses an
ambiguous or empty match, an image whose shape is more than 2% off the record's `AspectRatio`,
and a repo that already has missing or orphaned images. With `--apply` it backs up the replaced
slots to `~/VaultShots/promote-backup/`, writes the slots, deletes surplus ones, rewrites the
manifest as `[1..N]`, checks `shows.json` is untouched and nothing is orphaned collection-wide,
and empties `temp-images/`. It does not pick between copies by `TotalSizeHuman` — narrow
`--show` until one record matches.

The steps, for when doing it by hand:
1. Identify target show (by FolderPath, FolderName, ShowID, or description). When multiple versions of the same show exist, disambiguate by `TotalSizeHuman` — the user will specify the size.
2. Get the show's `ChecksumSHA1` from shows.json
3. Check what slots currently exist on disk: `ls public/images/{checksum}*`
4. Copy temp images to `public/images/{checksum}_0{n}.jpg` in the correct order
5. Update manifest indices to exactly match the new slot set
6. **Delete any old slot files on disk that are no longer in the manifest** — this always happens when replacing 4 images with 3. Skipping this step leaves orphaned files and broken UI image paths.
7. **Delete temp images** before completing the task

---

## Temp checksum stubs

When a show is created before files are physically scanned, a random 40-char hex is generated
as a placeholder checksum. These stubs are identified by:
- `Notes` field contains `"TEMP CHECKSUM - update when files are scanned"`

Shows with temp checksums — **none remain**. Regenerate this list rather than
hand-editing it; earlier versions have twice drifted out of date:

```bash
python3 -c "
import json
for s in sorted(json.load(open('public/shows.json')), key=lambda x: (x['Artist'], x.get('ShowDate') or 'zzzz')):
    if 'TEMP CHECKSUM' in (s.get('Notes') or ''):
        print(s['ShowID'], s['Artist'], s.get('ShowDate') or '(undated)')
"
```

Resolved on 2026-08-24: Radiohead Jools Holland, Soundgarden SNL 1996-05-18 and
STP Bizarre 2001-08-18, each confirmed by the sidecar in its own folder. Resolved on
2026-09-25: RHCP Woodstock 1999, by a time-window split of `Woodstock 1994 + 1999` (it carries a
derived checksum, explained in its `Notes`). Resolved on 2026-09-26, the last five, all STP and all by
their OWN existing images: the Unplugged stub was the Palladia HD rebroadcast, WAAF was VTS_02 of
`VH1 + WAAF 2000`, New York 2010 was an HD broadcast of the Blender Theater show, the "2010 Tour"
stub was the Palladia broadcast of the Riviera Theatre 2010-03-27 (it had the wrong date, venue and
setlist), and TV Compilation 6 was a duplicate of a record created a month later for the same file.

**Match a stub by CONTENT, never by name.** Two folders that a name-and-size audit
called undocumented were already recorded under names sharing nothing with them —
`Bon Jovi - Nokia Theatre` is filed as `STREAM` and the Kings of Leon EMAs as
`kingsema2010`. Hash the representative media and compare against every existing
`ChecksumSHA1` before writing anything.

When the real SHA1 is available: update `ChecksumSHA1` in shows.json, rename the image files,
and update the manifest key. Clear the Note.

---

## Git workflow

### Branch, commit, push (settled 2026-10-05)
- **Work is committed straight to `main`.** `feat/browse-redesign` is merged and deleted.
- **Never push until Karl says.** Every push to `main` deploys the live site.
- **Commit by explicit path, in one command**, and never leave anything staged — parallel
  sessions share one git index, so whatever another session staged rides along in yours:
  `git commit -m "…" -- path/one path/two`. A new file needs adding first, in the same
  command: `git add path/new && git commit -m "…" -- path/new path/other`.
- **Add by explicit path, never by directory, and never with `-f`.** `public/` is no longer
  gitignored, so `-f` is not needed; the old `git add -f public/` habit re-committed
  `public/.DS_Store`.

### What git tracks
- `dist/` — never; CI builds it.
- `_playground/` — tracked (experiments and notes are backed up); still never shipped.
- `.claude/skills/` — only `concert-screenshots/` and `va-masters/` are tracked; third-party
  design skills stay local and gitignored. `.claude/settings.local.json` is ignored.
- `public/images/temp-images/` and `tools/show-editor/index.html` are ignored.
- **Tailwind v4 reads class names from every file git does not ignore.** Tracking a folder that
  is not the site makes it part of the production stylesheet unless `styles/globals.css` excludes
  it with `@source not` (as it does `public/`, `_playground/` and `.claude/`). Un-ignoring those
  three on 2026-10-05 added ~6 kB of unused CSS before the exclusions went in.

### Push 408 timeouts
GitHub occasionally returns `HTTP 408` on push. The commit is always created successfully — just retry `git push origin main` immediately. It succeeds on the second attempt.

### Health check
`scripts/health-check.py` runs from a local pre-push hook and again in the deploy.
- **Blocks:** a `ShowDate` that is not a real `YYYY-MM-DD` or blank; a record without
  `ShowID` or `Artist`; duplicate ShowIDs; a `ParentShowID` that is not a record, is a hidden
  master of a shown record, is itself linked, or comes without `SegmentStart` < `SegmentEnd`
  (`H:MM:SS`); a `ContentType` other than `Documentary`, or "Documentary" in `RecordingType`;
  one artist under two names, or a name starting with "The"; a manifest slot whose file is
  missing; **setlist loss**.
- **Setlist loss** — a song gone from a `Setlist`. Songs that moved to a record which gained
  them (a split) pass; a deliberate removal needs an entry in
  `scripts/setlist-removals-approved.json` giving the exact strings and the reason. It compares
  the working tree with `HEAD`, so it sees only **uncommitted** changes: run the health check
  before committing a `shows.json` edit. Once committed, a loss passes the hook and the deploy.
- **Warns only:** checksums missing from the manifest, orphaned images, temp checksums, files
  left in `temp-images/`, records with no checksum, deprecated or garbage `EventOrFestival`
  values, a "N shows" figure in README or CLAUDE.md more than 2% off the data, and uncommitted
  README/CLAUDE.md edits.

Run it manually anytime:
```bash
python3 scripts/health-check.py
```

### Commit message style
Uses conventional commits:
- `feat(shows):` — new show record or image added
- `fix(shows):` — metadata correction
- `feat(images):` — image replacement/addition
- `chore:` — sync, cleanup
- `feat(ui):` — frontend component changes
- `fix(ui):` — frontend bug fixes

Always end with:
```
Co-Authored-By: Claude <noreply@anthropic.com>
```
Unversioned on purpose — the model name would otherwise need updating every
time the model changes, and it goes stale silently.

---

## Metadata conventions

These rules apply every time any field in `shows.json` is created or edited. No exceptions.

---

### Artist
One artist, one exact string. The artist view and the A–Z directory group on it, so a band under
two spellings shows half its records in each. Settled with the owner on 2026-10-04, when four
artists were split this way (`Prodigy` / `The Prodigy`, `Datsuns`, `Roots`, `Fun Lovin' Criminals`) —
every one by a linked record that copied the billing off the screen.

- **No leading "The"** — `Strokes`, `Killers`, `Prodigy`, `Fray`, `Who`. Search still finds
  "The Strokes" (`normaliseArtist` drops the article).
- **The band's own spelling** — `Fun Lovin' Criminals`, not the folder's `Fun Loving`.
- **"Person & the Band" is filed under the person** — `Iggy Pop` (billed Iggy & the Stooges),
  `Neil Young` (& Crazy Horse), `Tom Petty`, `Bob Marley`, `Juliette Lewis` (and the Licks). Say
  the billing in `Notes`. Not a band whose name merely contains "the": `Echo & the Bunnymen`.
- **Small words lower-case** — `Kings of Leon`, `Alice in Chains`, `Queens of the Stone Age`.
- **Solo careers are separate artists** — Chris Cornell is not Soundgarden.

**Before creating any record, and before any per-artist run, look up the stored spelling** and
reuse it exactly. Most tools match `Artist` exactly and fail silently: `scout.sh "The Killers"`
printed a clean report of `0 records` while five sat under `Killers`. (`shots.py plan` now
resolves the stored spelling regardless of case and warns loudly on a name with no records.)

```bash
python3 -c "
import json; a='prodigy'
print({s['Artist'] for s in json.load(open('public/shows.json')) if a in (s.get('Artist') or '').lower()})"
```

The health check blocks a push when two names differ only by case, a leading "The",
punctuation, `&`/`and` or accents, or when any name starts with "The". It cannot see a spelling
difference (`Lovin'` / `Loving`) — the lookup above is what catches those.

---

### Split bills — one record per band, per tape
A tape with two bands' sets gets **one record per band**, time-windowed to that band's
performance, each with its own setlist (the owner, 2026-09-30). A joined name such as
`Incubus / Deftones` is invisible to an exact-match filter on either band, on the site and in
every per-artist run. The two MusiquePlus tapes of 2000-11-14 became Incubus `34f2923f1e57`,
`6aa691481fa9` and Deftones `d4081bb1afc6`, `70dabb713576`; the joint interview between the
sets belongs to neither. Since the two-act-disc pass each tape is also a Various Artists master
(`9b53a1e2629d`, `527cba4f7921`) with the band records linked to it — the `va-masters` procedure,
which is how any new split bill is filed. Split only where the sets are separable in time, and
confirm with the owner first. Check for a joined name before calling an artist finished:

```bash
python3 -c "
import json
a='Incubus'
for s in json.load(open('public/shows.json')):
    art=s.get('Artist') or ''
    if a.lower() in art.lower() and art != a: print(s['ShowID'], repr(art))
"
```

---

### Duplicate recordings
When the same show exists as multiple recordings (different sources), all versions must share:
- Identical `ShowDate`
- Identical `EventOrFestival`
- Identical `VenueName`
- Identical `City` and `Country`

The record with the most complete metadata is the reference; others are updated to match.
Always scan for duplicates when editing any of these fields.

---

### ShowDate
- Format: `YYYY-MM-DD` or `""` — nothing else ever
- Only year known → `YYYY-01-01`
- Only year + month known → `YYYY-MM-01`
- Compilations, documentaries, rockumentaries, TV-only specials with no air/performance date → `""`
- Never use `"0000-00-00"`, `"Compilation"`, or any other placeholder string
- Undated records sort last in both sort directions, and drop out of a year range unless the
  viewer ticks "include undated"

---

### Mojibake — U+FFFD
None remains in any field (2026-10-05). Keep it that way: read a latin-1 or cp1252 sidecar in
its true encoding before pasting from it — the Artifact publisher refuses any page containing U+FFFD.

### Country
- Always the full English country name — never abbreviations or codes
- `"United States"` not `"USA"` / `"US"` / `"U.S.A."`
- `"United Kingdom"` not `"UK"` / `"U.K."`
- `"Netherlands"` not `"The Netherlands"` — confirmed collection-wide convention
- `"South Korea"` not `"Korea"`
- Apply consistently across all duplicate recordings of the same show

---

### VenueName
- Use the name the venue had **at the time of the show** — not its current or modern branding
- Examples:
  - "Brixton Academy" for shows before 2011 (became O2 Academy Brixton in 2011)
  - "Wembley Stadium" not "EE Wembley Stadium" for older shows
  - "The Shoreline Amphitheatre" not "Shoreline Amphitheater at Mountain View" for older shows
- Strip any date prefixes (e.g. `"2001-08-16 - Festival Name"` → `"Festival Name"`)
- `VenueName` is the physical venue only — festival name goes in `EventOrFestival`

### Known festival metadata (established conventions)
When enriching or correcting shows for these festivals, use exactly these values.
These are canonical — do not introduce variants.

| Festival / Show | EventOrFestival | VenueName | City | Country | Notes |
|---|---|---|---|---|---|
| Pinkpop | `Pinkpop` | `Megaland` | `Landgraaf` | `Netherlands` | |
| Roskilde Festival | `Roskilde Festival` | `Dyrskuepladsen` | `Roskilde` | `Denmark` | |
| Rock im Park | `Rock im Park` | `Frankenstadion` | `Nuremberg` | `Germany` | Not `Nürnberg` — 3 of the 4 records; Pearl Jam `386ef26dbe15` still says `Nürnberg` |
| Eurockéennes (Belfort) | `Eurockéennes Festival` | `Presqu'île de Malsaucy` | `Belfort` | `France` | Not `Les Eurockéennes` |
| Lowlands | `Lowlands Festival` | `Evenemententerrein Walibi Holland` | `Biddinghuizen` | `Netherlands` | Not just `Lowlands` |
| SWU (Brazil) | `SWU Music & Arts Festival` | _(blank)_ | `Itu - Sao Paulo` | `Brazil` | Not `SWU Festival` |
| Letterman | `David Letterman` | `Ed Sullivan Theater` | `New York` | `United States` | |
| Jools Holland | `Jools Holland` | `BBC Television Centre` | `London` | `United Kingdom` | |
| Tonight Show (Fallon) | `Jimmy Fallon` | `30 Rockefeller Plaza` | `New York` | `United States` | Shows from 2014 onward |
| Tonight Show (Leno) | `Jay Leno` | `NBC Studios` | `Burbank` | `United States` | Shows before 2014 |
| Conan (all eras) | `Conan O'Brien` | _(blank)_ | _(varies)_ | `United States` | Covers both NBC Late Night and TBS Conan eras |
| Jimmy Kimmel | `Jimmy Kimmel` | `El Capitan Theatre` | `Los Angeles` | `United States` | |
| Carson Daly | `Carson Daly` | _(blank)_ | `New York` | `United States` | |
| Saturday Night Live | `Saturday Night Live` | `30 Rockefeller Plaza` | `New York` | `United States` | |
| KROQ Almost Acoustic Christmas | `KROQ Almost Acoustic Christmas` | _(blank)_ | `Los Angeles` | `United States` | Annual KROQ radio event |
| MuchMusic (intimate) | `Much Music Intimate & Interactive` | `Chum City Building` | `Toronto` | `Canada` | `&` not `and` |
| Nissan Live Sets | `Nissan Live Sets on Yahoo! Music` | _(blank)_ | _(varies)_ | `United States` | Full name always |
| Farm Club | `Farm Club` | _(blank)_ | `Los Angeles` | `United States` | USA Network late-night music show (2000–2001) |
| Leeds Festival | `Leeds Festival` | `Bramham Park` | `Leeds` | `United Kingdom` | 2003 onward; settled on Reading 2006 (M21) |
| Reading + Leeds, site unknown | `Reading and Leeds Festival` | _(blank)_ | _(blank)_ | `United Kingdom` | Only when the footage names neither site — check stage banners ("Carling Weekend Reading") first |

---

### EventOrFestival
- Festival/event name only — never include dates, venue, or city in this field
- Examples: `"Glastonbury Festival"`, `"Rock am Ring"`, `"MTV Unplugged"`, `"Jools Holland"` — host-led talk shows use the host's name (see the table above)
- Leave blank if it was a standard headline show with no named event/festival

---

### Setlist format
**Always** a single semicolon-separated string. Never newlines, numbered lists, or bullet points.

```
Song One; Song Two; Song Three; Encore break; Song Four; Song Five
```

Rules:
- Songs separated by `; ` (semicolon + space)
- Encore separator is exactly `Encore break` (capitalised, no dashes or symbols)
- No track numbers, no bullet points, no newlines
- Covers noted inline: `In the Flesh (Pink Floyd cover)`
- Acoustic versions noted inline: `Just Because (Acoustic)`
- If a setlist is partial/incomplete, append ` (incomplete)` at the end of the string

### Setlist sourcing

**The recording outranks everything.** What is captioned, printed or visible on screen is
primary evidence about *this* recording. Where a published setlist disagrees with the video,
the video wins — write it, mark a partial list `(incomplete)`, and record the conflict in
`Notes`. Rock in Rio 1991 captions `MY MICHELLE` on screen while four published sources omit
it from either possible night; the sources are simply incomplete.

The same applies to dates: use external sources to choose between candidates the recording
narrows down, then **commit to the best-evidenced one** and say why in `Notes`. A stated
judgement beats an empty field.

Verify a whole artist at once — read-only:

```bash
python3 scripts/audit-sidecar-setlists.py --artist "Bush"
```

**Exception, and check it first: a sidecar inside the show's own folder is truth on its
own.** `*.nfo`, `*.txt`, `info.txt`, `*.md5` — these were written by whoever made the disc,
from the disc. They are primary evidence about *this recording*, not a reconstruction of the
event, so the rule below does not apply to them. Write the setlist, and say in `Notes` which
file it came from. House formatting still applies.

For everything else, before writing any setlist **2+ independent sources must agree** on the
songs and order.

Acceptable sources (ranked by reliability):
1. setlist.fm (check user-confirmed count — higher = more reliable)
2. Official band site tour pages (e.g. janesaddiction.org/tour)
3. Published concert reviews (Rolling Stone, NME, Billboard, Pitchfork, local press)
4. YouTube full-show videos with confirmed date/venue
5. Fan forums or Dime A Dozen NFO files with eyewitness accounts

If only 1 source is found, or sources conflict: leave `Setlist` blank and note the conflict.
Never infer or reconstruct a setlist from tour averages or nearby-show patterns alone.

---

### Setlists that are populated but wrong

A non-empty `Setlist` is not a checked one. Eleven records were found holding things that were
never songs, always from a sidecar pasted in wholesale — header lines at the top (band, venue,
date, city) and trailer notes at the bottom (running time, lineage, credits, "thanx to"). One
held **another band's entire setlist**; another held `Didn't; figure; out`, an English sentence
split on spaces.

Check the **first and last three entries** of any long setlist — that is where the junk sits.

```bash
python3 scripts/audit-sidecar-setlists.py --artist "Foo Fighters"
```

Two things that look like junk but are not: a segment the disc numbers as a track
(`Interview (cuts in)`, `jam`) belongs in `Notes` rather than being deleted silently, and real
songs collide with junk patterns — Kings of Leon's *Taper Jean Girl*, Clapton's *Running on
Faith*.

### Common corrections to watch for
- `EventOrFestival` containing a date string → replace with the festival name only
- `VenueName` containing date prefixes → strip the date
- Venue using modern branding for a historic show → use name from the time of the show
- Rockumentaries, documentaries, compilations, TV-only shows → `ShowDate` should be `""`
- `Country` using abbreviation → expand to full name
- Setlist using newlines or numbered format → convert to semicolon format

---

## Data pipeline

Located in `data-pipeline/` — numbered Python scripts for scanning physical hard drives:

```
01_scan_hd_shows/     catalog_shows_v3_1.py — scans a drive, outputs CSV + checksums
04_merge_hd_csvs_identify_duplicates/     merge_catalogs_safe.py — merges multiple drive CSVs
05_merge_csvs/        enrichment scripts
07_merge_csvs_create_single_master/  merge_drives_master.py
08_final_create_master_CSV/          final merge → shows.json
```

**These CSV files are historical archives — do not edit them.**
The live source of truth is `public/shows.json`, corrected by hand record by record since the
pipeline last ran. **Never copy the pipeline's output over it** (the old summary in
`data-pipeline/README/` says to; it is superseded).
The pipeline is only re-run when a new hard drive is added to the collection.
The workflow for adding a new drive is not yet finalised.

---

## Metadata enrichment workflow

This is a **recurring weekly task**. Each session picks an artist (or a batch of artists) and enriches their shows in `shows.json` — filling in missing or placeholder values for dates, setlists, venue names, and event/festival names.

No API keys, no scripts, no external accounts needed. Claude handles all research inline using web search.

---

### What gets enriched

| Field | Missing/placeholder state | Target state |
|---|---|---|
| `ShowDate` | `YYYY-01-01` (year only) or `YYYY-MM-01` (year+month) | Full `YYYY-MM-DD` |
| `Setlist` | Empty string `""` | Semicolon-separated song list |
| `EventOrFestival` | Empty or generic string | Correct festival/event name |
| `VenueName` | Empty, approximate, or uses modern branding | Name at time of show |

---

### How to identify the show

Each show record contains clues that narrow down the exact date and event, even when the metadata is sparse. Claude should check these fields in order:

1. `FolderPath` and `FolderName` — often contain the date (`19961023`), venue shorthand, or event name encoded in the folder structure
2. `Notes` — may contain recording lineage text, broadcast source, or eyewitness descriptions that identify the show
3. `EventOrFestival` — if already present, use it as the primary search anchor
4. `City` + `Country` + approximate year — narrows the search to regional shows in that window
5. `VenueName` — cross-reference with known venue histories

---

### Research rules

- **2+ independent sources must agree** before any field is written. Never write from a single source.
- **A search engine's summary is not a source — only a page you fetched and read is.** On Ben Harper's
  Last Call record the search tool's summary stated "episodes May 2, 3, 4 and 5, 2006" as fact; no
  fetched page confirmed it (IMDb blocked, TheTVDB listed only a 2009 episode), so the date stayed
  year-only and the lead went into `Notes`. A summary can point at where to look; it never counts
  toward the two.
- Acceptable sources and their ranking: Metadata conventions → Setlist sourcing. The same
  exceptions apply — the recording and a sidecar in the show's own folder outrank them.
- If only 1 source is found, or sources conflict: leave the field unchanged and note the conflict in a comment to the user
- Never infer or reconstruct a setlist from tour averages or nearby-show patterns alone
- For `VenueName`: use the name the venue had **at the time of the show**, not its current branding

---

### Batching and confirmation workflow

1. Claude scans `shows.json` for the requested artist and lists all shows with missing/placeholder fields
2. Claude researches each show and prepares a **proposal batch** — all proposed changes for that artist in one message
3. User reviews the batch and confirms (or rejects individual entries)
4. Claude writes only the confirmed changes to `shows.json`
5. Claude runs the health check and commits with `fix(shows):` or `feat(shows):` prefix

**Never write to `shows.json` before the user confirms the batch.**

### Karl's own edits — the Show Editor
`python3 tools/show-editor/build.py` renders `tools/show-editor/index.html` (gitignored; rebuild
after any `shows.json` change) — one self-contained page, A–Z by artist, editing the curatorial
fields while technical ones stay locked. It writes nothing: Karl copies a text patch
(`EDITS FOR N SHOWS … from: / to:`) and pastes it into a session. Apply it exactly as written
and change nothing else — his own edits need no second source — then run the health check and
commit.

---

### Trigger phrases

Start a session with any of these:

> "Check [Artist] for missing setlists"
> "Enrich [Artist] shows — dates, setlists, venues"
> "Pick up metadata enrichment — do [Artist] next"
> "Continue enrichment from last session"

Claude will scan the artist's shows, identify gaps, research each one, and present the full proposal batch for review before writing anything.

---

## Hard drives in the collection

`MasterDriveName` is the drive a record was **originally catalogued from**, not where it lives
now (below). Counted from `public/shows.json` on 2026-10-05; sizes are GiB, each folder counted
once (linked records share their master's folder) — multiply by 1.074 for the decimal GB on
drive labels.

| `MasterDriveName` | Records | Size | Notes |
|---|---:|---:|---|
| Seagate Expansion Drive | 628 (52%) | 1,364 GiB | The largest single source |
| Big Daddy | 533 (44%) | 1,025 GiB | Same era mix as the Seagate |
| Live Music | 47 | 100 GiB | |
| `Untitled` (DVD archive) | 3 | 6 GiB | 316 folders scanned; 313 were byte-identical duplicates and were dropped |
| _(blank)_ | 4 | 5 GiB | Added by hand after the scan |
| **Total** | **1215 records** | **~2,500 GiB** | ~2.4 TiB. 10 records have no recorded size |

**The physical collection now lives on one drive, `Live Music`** (`/Volumes/Live Music`),
which every capture and audit script reads. Most records still name their original drive in
`MasterDriveName` and `FolderPath`, so the tools resolve folders by name and content hash rather
than by stored path (concert-screenshots skill).

**Both original drives span the same eras** — 1990s and 2000s heavy, with a 2010s tail.

### Duplication across media — as of the original scan
Raw scans totalled **1,421 show folders / 3,931 GiB (3.84 TiB)** across three volumes;
deduplication left 829 unique records / 2,441 GiB, so roughly **1,490 GiB was redundant
copies**. The `Untitled` volume is a DVD backup archive. Its one non-duplicate entry
(`Mainly Hunting - Target 2009`, filed under artist "DVDs") is not a concert recording and is
intentionally excluded.

---

## Front-end performance

Measured, not guessed. On 2026-10-02 the drawer took 400–600 ms to open on a Mac
(~1.9 s at 4× CPU throttle, a stand-in for a phone) and Browse scrolled at ~6 fps on a
phone-class CPU. `e2d6d54` brought the drawer to ~25 ms (~145 ms at 4×) and halved JS
memory. These rules keep it there. `npm run check:perf` (part of `npm run check`) fails on
every one of them except the last, `content-visibility`, which nothing checks:

- **No motion components inside `ShowCard`.** Its hover and focus layers are CSS
  (`group-hover`, `group-focus-visible`). Browse renders every show — ~1,200 cards — and
  four `motion.div`s per card was ~4,600 animated components re-rendering together. Use
  `motion` for one-off elements (drawer, hero), never per card. The vendored animation
  skills in `.claude/skills/` do not know this; this rule wins.
- **`AnimatePresence` around views or grids sets `presenceAffectsLayout={false}`.** At
  its default it hands every motion component beneath it a new context object on every
  render, which re-renders them all straight past `React.memo`. This was the single
  biggest cost.
- **Props that reach cards are stable.** `ShowCard` and `ShowGrid` are memoised: pass
  `onSelect={onShowClick}`, never `onClick={() => …}`. `getImageUrl` (useShows) and
  `handleShowClick` (App) are `useCallback`s. One inline arrow re-renders every card.
- **`inert` behind the drawer waits for the animation.** It goes on when the drawer
  finishes sliding in and comes off when it finishes sliding out (`drawerSettled` in App,
  `onSettled` in ShowDrawer). Toggling it restyles every element on the page (~26k on
  Browse); inside the click that delayed the drawer's first frame by ~100 ms (Mac) /
  ~0.5 s (phone). Nothing is exposed meanwhile: the backdrop covers the page and focus is
  moved into the drawer and trapped from its first frame.
- **Card images use native `loading="lazy"`** in `LazyImage`. No per-image
  IntersectionObserver, and no `translateZ(0)` or `will-change` — each pins a compositor
  layer per card.
- **Cards load the build thumbnail, not the original** (see Image conventions → Card
  thumbnails), with the original as `fallbackSrc`. Anything shown large — the drawer
  header, the viewer — uses the original; the drawer header shows the thumbnail first and
  fades the original in over it.
- **The first load is the trimmed show list, not `shows.json`** (see The data model →
  What the site loads). Notes arrive afterwards in their own lookup, never merged into the
  show objects: replacing every object would re-render every memoised card.
- **Fonts are self-hosted** (`public/fonts/README.md`), and DM Sans is preloaded. Never
  add a Google Fonts `<link>`: it is render-blocking, so nothing paints until a
  third-party server has answered.
- **No `content-visibility` on cards** — tried three ways and rejected. On the card
  button it clips the hover zoom and shadow. On the image it stops lazy loading until the
  card is nearly on screen, so cards scroll in blank. On the overlays and caption it made
  fast scrolling choppier and no longer sped up the drawer once `inert` was deferred.

**Measure before and after** any change to cards, grids, the drawer or image loading:

```bash
npm run perf               # build, serve, check drawer behaviour, time it, apply budgets (~4 min)
npm run perf -- --quick    # one run per CPU speed (~2 min)
npm run perf -- --url https://karl0s.github.io/digital-vault/   # probe any server, e.g. live
```

Single runs on this Mac swing widely (one drawer timing went 140 ms → 17 ms between
identical runs), so compare medians of alternating runs, never one against one. Chrome.app
will not start headless from a sandboxed shell; the script uses Playwright's headless
shell from `~/Library/Caches/ms-playwright/` when it is there.

Still open: virtualising Browse, only if a real phone still stutters. It costs in-page
Cmd+F, and what it would remove — grid first render and the stall when `inert` lands
after the drawer settles — is small on a Mac.

---

## Browse architecture

The Browse redesign went live on 2026-10-05. Its reasoning, and where the build departs from
it, is in `docs/browse-redesign-spec.md`. What a change must not break:

**Shell** (`components/shell/`). `AppShell` = fixed `TopNav` (search only, no wordmark) +
`Sidebar` (md and up) + `<main>` + `MobileTabBar` (below md). The sidebar is a flex sibling,
not an overlay, so content reflows rather than sliding under it. It is `expanded` (256px) or
`rail` (72px, a small label under each icon), toggled by its own Collapse button and kept in
`localStorage` under `vault:sidebar` (default expanded at every width). Its top group sets the
destination (Browse, Artists); its lower group toggles the `type` facet (Live shows,
Documentaries). Below md the sidebar is not rendered: the tab bar offers Browse · Artists ·
Search, padded by `env(safe-area-inset-bottom)`, and `<main>` carries `pb-20` so the last row
clears it. There is no Live/Documentaries control on mobile.

**Views** (`App.tsx`). Browse (the default): `HeroSearch` masthead (wordmark and tagline;
collapses to zero height while anything filters), sticky `FilterBar`, then — only when nothing
filters — `FeaturedRows` and an "All shows" heading, then `ShowGrid` of `results`. Artists:
`ArtistsView`, an A–Z directory with a sticky letter rail, flowed in CSS columns. Picking an
artist puts its name in the search and renders `SearchResultsGrid` in place, so clearing goes
back to the directory. A failed load renders one error state for every view.

**State** (`src/store/filters.ts`, zustand): `view, q, from, to, undated, country, festival,
type, sort`. Read the whole state only as `useFilterStore(useShallow(selectFilterState))` —
`selectFilterState` builds a new object per call, and without `useShallow` zustand v5 re-renders
until React throws ("getSnapshot should be cached"). Single fields take plain selectors. The
search input is local to App; only its debounced value (150 ms) reaches the store.

**URL** (`src/lib/url.ts`) is the store's serialisation, and it is canonical: keys in the fixed
order above; facet values slugified, de-duplicated and sorted; defaults (`view=browse`,
`sort=year-desc`, `undated` off) and empty values omitted. Query params on the root path, never
path segments — GitHub Pages has no SPA fallback. Facet, query, range and sort changes
`replaceState`; `setView` `pushState`s, so Back steps between destinations, not checkboxes.
`initFilterUrlSync` (once, in App) rehydrates on popstate. Every filter write passes through
`commitFilterState` — the one seam reserved for analytics.

**Pipeline** (`src/hooks/useBrowseResults.ts`): text query → MiniSearch id set → facets → sort,
all synchronous `useMemo`s. `src/search/facets.ts` counts each facet against every *other*
active filter, so an option's count is what selecting it yields; zero-count options are
disabled, never hidden. An empty `Country` or `EventOrFestival` becomes the `NONE` sentinel
(`'none'`, labelled "Unknown location" / "No festival") so those records stay reachable. `type`
is `ContentType` slugified, `live` when absent. Undated records sort last both ways and are
excluded from a year range unless `undated=1`.

**Controls** (`components/filters/`). `FilterBar`: Years, Country and Festival triggers;
removable chips and Clear all while anything is set; the result count (`aria-live`) and sort.
`FacetPopover` is a base-ui `Popover` (focus, Escape, outside click, positioning) — its `z-50`
belongs on the `Positioner`; a text filter appears above 15 options. `YearRangePopover`: decade
chips (decades with 5+ records), the `YearHistogram` brush, From/To inputs (the keyboard and
screen-reader path) and "Include undated". The brush maths is pure, in `src/lib/brush.ts`; the
store is written on pointer-up only, never during a drag.

**Grids.** `GRID_COLS` (exported by `FeaturedRows.tsx`) is the one column set for every grid:
2 → md 4 → lg 5 → xl 6 → 2xl 7. `ShowGrid` (Browse) is memoised and deliberately unanimated;
`SearchResultsGrid` (Artists-view search) has its own header and the "N more shows feature a song
called …" suggestion. Browse content, `TopNav` and `FilterBar` sit in `max-w-[1924px] mx-auto`;
`SearchResultsGrid` and `ArtistsView` use `max-w-[1860px]`.

**Guards.** `npm run check` = `check:perf` (Front-end performance), `check:url` (canonical
serialisation), `check:facets` (counts against the real `shows.json`), `check:store` (stable
selector snapshots), `check:brush` (brush geometry) and `typecheck`. Run it after touching any
of these files; the deploy runs it too.

---

## UI patterns

### Close buttons
All close buttons use the shared `CloseButton` component (`components/CloseButton.tsx`).
Style: `bg-white/10 hover:bg-white/20 rounded-full`, icon `w-5 h-5 md:w-6 md:h-6`.
Pass positioning via `className` prop — the component handles appearance only.
Standard coordinates: `top-4 right-4` mobile, `top-6 right-6` desktop.
Currently used in: `ShowDrawer` (drawer close + image overlay close).

**ShowDrawer close button positioning**: the button is rendered **outside** the scrollable content div (sibling to it, inside the fixed drawer `motion.div`). This is intentional — placing it inside the scroll div with `sticky` caused it to occupy flow space on mobile and push the hero image down. With `absolute top-4 right-4 md:fixed md:top-6 md:right-6` it floats over the hero image on mobile without consuming layout space.

### Mobile input focus and iOS keyboard
iOS Safari only raises the software keyboard when `input.focus()` is called within the **same synchronous call stack** as the user gesture (tap). Any async path — `setTimeout`, `useEffect`, `Promise.then` — loses the gesture context and the keyboard is silently ignored.

When a mobile input is conditionally rendered (e.g. a search bar that mounts on tap), use `flushSync` from `react-dom` to force a synchronous React render, then call `.focus()` immediately:

```tsx
import { flushSync } from 'react-dom';

onClick={() => {
  flushSync(() => setInputVisible(true)); // renders the input into the DOM synchronously
  inputRef.current?.focus();             // still within the tap gesture — keyboard opens
}}
```

Both ways into the mobile search do this: `TopNav`'s search button, and the tab bar's Search
item (`handleMobileSearchClick` in App, which opens TopNav's field through its controlled
`mobileSearchOpen` prop and focuses `mobileSearchInputRef`).

Also ensure mobile inputs have `font-size: 16px` (`text-base`) or larger. iOS auto-zooms the page when focusing any input with `font-size < 16px`.

### Masthead (HeroSearch)
Wordmark (`HalationLogo`) and tagline, nothing else — the only place the brand appears. Always
mounted, animating to `height: 0 / opacity: 0` while filtering (`isSearching={filtered}` from
App, i.e. any query, range or facet). It uses motion's `animate` prop, not `AnimatePresence`,
so nothing above the grid unmounts mid-keystroke.

### ShowDrawer — sizing and modal behaviour
On mobile the drawer is full width and `h-dvh` (`height: 100dvh`), sliding up from the bottom — **not** `h-[88vh]` or `h-screen`. `dvh` is the dynamic viewport height unit: the browser recalculates it live as the URL bar appears or disappears, so the drawer always fills exactly the visible screen. Do not change this to a static `vh` value. From md it slides in from the right at `58vw` (`52vw` from lg).

It is a modal: `role="dialog"`, focus moves in on open and is trapped, Escape closes the image
viewer first and then the drawer, focus returns to the card that opened it, and body scroll is
locked. The page behind goes `inert` only once the slide-in finishes (Front-end performance).

### Drawer metadata layout (ShowDrawer)
**Hero area** (over the header image):
1. Artist name — large display font
2. Single subtitle line — `Date · EventOrFestival (or VenueName if no event) · Country (or City, Country if no event)` — built as a filtered join with ` · ` separator; "Date Unknown" if `ShowDate` is empty
3. Badge pills row — `ContentType` (violet), `RecordingType`, Duration (Clock icon + auto-formatted `DurationSec`), `TVStandard` — each only rendered if the field has a value

**Below the hero**, in order: a "Part of …" link to the master (linked records only), the
Screenshots strip, an "On this recording" list of linked records with their time windows and
song counts (masters only), then the content grid. Following either link swaps the show inside
the open drawer and resets it to the top.

**Content grid**:
- Two columns from md (`md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]`): the main column holds Setlist, then Notes; the side column holds Technical in a tinted panel (`md:rounded-lg md:border md:bg-white/4`). Below md they stack in that order and Technical folds behind a **Technical details** toggle (`techOpen`, reset per show)
- **The Setlist heading always renders**, so nothing else can take the place people read as the setlist (owner's decision 2026-10-06; until then Technical slid into the first column on the 483 shows with no songs). With no songs it says `No setlist yet`, `Documentary, no setlist` (`ContentType`), or, on a master, `Each act's songs are on its own page, under On this recording`
- Column labels use `text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400`
- Setlist: numbered `<ol>` from the semicolon-split `Setlist`. `Encore break` renders as an ordinary numbered item — there is no divider (the song counts under "On this recording" do leave it out)
- Technical: `{ label, value, mono }` rows (`techRows`) — Video, Aspect, Standard, Container, Audio, Channels, Sample rate, Size, Files; label `w-16 text-xs text-gray-400`, value `text-gray-200` (`font-mono` for codec-like values); only rows with a value are rendered, and the panel is left out when there are none
- Notes: from `getNotes`; `whitespace-pre-wrap wrap-break-word font-mono text-xs text-gray-400`; collapsed to `max-h-72` (about 14 lines, level with the Technical panel) with a gradient fade; **More ⌄ / Less ⌃** buttons toggle `notesExpanded` state. The fade and More appear only when the collapsed text really overflows (`notesOverflow`, measured by a ResizeObserver on the notes element), never from a character count: the old "over 320 characters" rule clipped short many-line notes with no button and showed a useless one on 108 others. `wrap-break-word` is intentional — pipeline notes often contain long unbroken strings (URLs, codec lines, filenames) that would overflow the container on mobile and cause the browser to zoom

The Source & Files accordion has been removed — drive/folder/file metadata is no longer shown in the drawer.

**Tailwind v4 note**: use `bg-linear-to-t` not `bg-gradient-to-t` for gradient classes — the latter triggers a deprecation warning in v4.

### In-drawer screenshot thumbnails (ShowDrawer)
The screenshots grid is responsive:
- **Mobile**: `flex overflow-x-auto scrollbar-hide` — single horizontal scroll row. Each thumbnail is `w-[42%] shrink-0` so two fit fully in view with ~16% of the third peeking to signal scrollability.
- **Desktop** (`md+`): `grid grid-cols-4` — standard 4-column grid, `w-full` per item.

Both layouts share the same mapped element so `layoutId` refs for the image viewer animation are stable.

### In-drawer image viewer (ShowDrawer)
`ShowDrawer` manages image viewing internally — there is no external lightbox call.

Key state:
- `expandedFromIndex: number | null` — which thumbnail was clicked; anchors the `layoutId` for the open/close animation; set to `null` to close
- `viewingIndex: number` — which image is currently displayed; changes on prev/next without affecting the `layoutId` anchor

How it works:
- Each thumbnail is wrapped in `<motion.div layoutId={`drawer-img-${show.ShowID}-${idx}`}>` 
- The overlay renders a `<motion.div>` with the same `layoutId` matching `expandedFromIndex` — motion animates the element between thumbnail and expanded positions
- Prev/next buttons and ← → (both wrap around) and the dots only update `viewingIndex`; close always zooms back to the original thumbnail
- The drawer's own close button is hidden (`!isImageExpanded`) while the viewer is open to prevent z-index conflicts with the overlay's close button

---

## Featured shows

`components/FeaturedRows.tsx` → `FEATURED_IDS`: hand-picked ShowIDs (14, a multiple of 7 so
they fill whole rows at 2xl), shuffled once per load and shown on Browse only while nothing
filters. A missing ID drops out silently. The comment beside each ID says why that copy was
chosen — keep doing that.

---

## Key stats
Recomputed from `public/shows.json`, not maintained by hand:

```bash
python3 -c "
import json, collections
d = json.load(open('public/shows.json'))
a = collections.Counter(s['Artist'] for s in d)
f = collections.Counter(s['EventOrFestival'] for s in d if s.get('EventOrFestival'))
print(len(d), 'shows /', len(a), 'artists /', sum(s.get('Hidden') == 'Yes' for s in d), 'hidden /',
      sum(bool(s.get('ParentShowID')) for s in d), 'linked /', sum(s.get('ContentType') == 'Documentary' for s in d), 'documentaries')
print(a.most_common(9)); print(f.most_common(7))
"
```

As of 2026-10-05:
- **1215 shows** across **304 artists**. One is `Hidden`; 256 are linked records cut from 43
  masters; 29 are documentaries
- Top artists by volume: Stone Temple Pilots (101), Smashing Pumpkins (65), Kings of Leon (56),
  Various Artists (44), Soundgarden (36), Foo Fighters (34), Red Hot Chili Peppers (32),
  Incubus (29), Stereophonics (29)
- Top festivals: Glastonbury Festival (71), Reading Festival (64), Rock am Ring (53),
  Big Day Out (34), Pinkpop (33), MTV Unplugged (25), Jay Leno (24)

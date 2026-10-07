# The Vault — Claude Project Guide

## What this project is
A personal archive and browser for a private collection of concert video recordings.
Live site: https://karl0s.github.io/digital-vault/

React 18 + Vite 6 SPA (Tailwind v4, `motion`, zustand, base-ui, MiniSearch). All show data is one
flat JSON file (`public/shows.json`); images are static files in `public/images/`. No backend.

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
docs/
  frontend.md           ← front-end architecture and UI patterns — read before any UI change
  browse-redesign-spec.md ← the Browse design and how the build departs from it
tools/
  add-temp-images.py    ← temp-images → slots + manifest, verified (see Temp images workflow)
  show-editor/          ← Karl's metadata editor; build.py renders index.html (gitignored)
scripts/
  health-check.py       ← integrity validator (pre-push hook, and the deploy)
  audit-*.py            ← read-only audits: image geometry, aspect vs source, sidecar setlists
  consistency-audit.py  ← read-only: same festival or same show recorded with different venue/city/country
  check-*.ts, check-perf.mjs, search-precision.ts ← the `npm run check` suite (see Checks)
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

`_playground/` holds UI experiments, one topic per subfolder, routed by `import.meta.glob` +
`React.lazy` in `PlaygroundRouter.tsx`. Tracked in git (backed up), **never shipped**: `main.tsx`
loads the router with a dynamic `import()` inside `if (import.meta.env.DEV)`, which a production
build replaces with `false`, so Rollup drops it and the glob. Run with `npm run dev` at
`/playground`. Keep that import dynamic and inside the `if` — a top-level import bundles every
experiment into `dist/`.

Rules:
- Each subfolder has exactly one MD file named for its topic (`branding/logo.md`), no version
  number, covering **all** TSX variants in the folder.
- TSX files are `v{N}-{slug}.tsx` (e.g. `v3-halation-per-letter.tsx`).
- The MD file has: `# {Topic} Playground — Reference & Progress Notes`, `## Goal` (one paragraph),
  `## Versions` (table: file → what it tried or changed), `## Key Decisions / Techniques`
  (rejected approaches, why, constraints), and `## Live Site Integration` only if extracted (file
  path, props, usage). Add sections as complexity warrants; `branding/logo.md` sets the depth.

---

## Deployment

- **Every push to `main` deploys the live site** — so nothing is pushed until Karl says.
- GitHub Actions (`.github/workflows/deploy.yml`) runs `python3 scripts/health-check.py` and
  `npm run check`, then `npm run build`, and publishes `dist/` to GitHub Pages. A failing check
  stops the deploy; the live site keeps the previous version. A newer push cancels a deploy still
  running.
- Vite copies `public/` into `dist/`; the plugins add `thumbs/`, `shows-lite.json` and
  `show-notes.json`. `dist/` is gitignored and CI-owned — **never commit it**.

---

## The data model

### What the site loads (derived at build time)
`public/shows.json` is the source of truth; the site does not load it. Every build (and `npm run
dev`) derives three files from it (`scripts/site-data.mjs`, wired in by
`scripts/vite-plugin-site-data.mjs`):

- `shows-lite.json` — every record minus `Notes` and the pipeline-only fields in `DROPPED`
  (`FolderPath`, `RepVideoFiles`, `Lineage`, `LastScannedAt`, …). Loaded first, about a quarter of
  the full file.
- `show-notes.json` — `{ ShowID: Notes }`, loaded straight after.
- `shows.json` — the full records minus the `PRIVATE` fields (`PrivateNotes`), written over the
  copy Vite publishes. The site's fallback; never carries a private field.

Nothing to do when editing `shows.json`. Two rules for code: **read Notes only through
`getNotes`** from `useShows` (show objects on the site carry no `Notes`), and **before displaying a
field, check it is not in `DROPPED`**, or it will be blank on the live site. `npm run check:perf`
fails on either, and on any published file carrying a `PRIVATE` field or site code reading one. If
the derived files are missing, the site falls back to `shows.json`.

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
| `Notes` | string | **Public.** Only text pasted verbatim from the show's own sidecar files, each under `---- filename ----`. Shown in the drawer. See *Notes and PrivateNotes* |
| `PrivateNotes` | string or absent | **Never on the site.** Everything Claude or Karl writes: provenance, corrections and their evidence, capture and identity notes. See *Notes and PrivateNotes* |
| `Hidden` | `"Yes"` or absent | Keeps the record in `shows.json` but off the site (filtered in `src/hooks/useShows.ts`). For two records of one recording where only one should show: set `DuplicateOf` to the shown record and say why in `PrivateNotes`. `DuplicateOf` alone does **not** hide (Jay-Z and Jack White carry it and are meant to show) |
| `ParentShowID` | ShowID or absent | Set on a record cut from a multi-artist **master** recording (festival broadcast, talk-show compilation). The drawer links to the master ("Part of …"); the master's drawer lists its records under "On this recording". One level only; the master must not be hidden. Checked by the health check |
| `SegmentStart` / `SegmentEnd` | `H:MM:SS` | Where that linked record sits on the master's timeline. Always set together with `ParentShowID` |

### Notes and PrivateNotes
**The owner's rule (2026-10-07): `Notes` is public and holds only sidecar text; everything else
goes in `PrivateNotes`, which never reaches the site.**
- `Notes` — the text of an info file from the show's **own folder** (`info.txt`, `*.nfo`, `*.txt`),
  pasted verbatim under `---- filename ----`. Nothing else: no headings, summaries or comments of
  ours, and no file from outside the show's folder (a PC backup on the drive holds personal files).
- `PrivateNotes` — every word Claude or Karl writes: why a field changed and the evidence, splits
  and links, capture and aspect notes, identity checks, dated headings like `CONTENT TYPE (date)`.
  When in doubt, it goes here. Add new entries at the end, each starting with what and when.
- Visible to Karl in the Show Editor; `npm run check:perf` fails if it is ever published.

### Documentaries — `ContentType`
**The owner's rule: a record is a Documentary when half or more of its runtime is people talking
or narration over footage.** Standalone interviews, making-of, behind-the-scenes, MTV Cribs-style
shows, rockumentaries and TV biographies count. Storytellers, Unplugged and concert films with
backstage inserts do not. Judge from the footage, never the title or the notes. Each changed record
says why in `PrivateNotes` under `CONTENT TYPE (date)`.

Set `ContentType` whenever a record is created, the VA-master and screenshot procedures included.
For a borderline programme, use the read-only sweep tool (it samples by byte position, so broken
DVD timestamps cannot misplace a frame), then count talking/interview/archive/behind-the-scenes
frames against performance frames. 48 frames give about ±7%, so put anything between roughly 42%
and 58% to the owner.

```bash
python3 ~/VaultShots/doc_sweep.py <ShowID> [<ShowID> ...]   # contact sheets in ~/VaultShots/doc_sweeps/
```

Four pieces of documentary footage have no record **by the owner's choice** (2026-10-04). Do not
propose them again: the Cornell WDR interview (VTS_01 of the Audioslave `rar/` disc), the
interviews in VTS_03 of `Kings of Leon - BDO 2006 and 2004`, and the making-of (VTS_03) and EPK
(VTS_04) in `Supergrass - Pinkpop Festival Dutch TV 1997`.

### image-manifest.json
Maps `ChecksumSHA1 → [1, 2, 3, 4]` (available slot indices). Only listed slots are served.

---

## Image conventions

- Images are `{ChecksumSHA1}_01.jpg` … `_04.jpg`, JPEG only, up to 4 per show; slot 1 is the
  primary (shown on cards).
- **All slots within a show share identical pixel dimensions.**
- When adding or replacing: copy to `public/images/` with the right name, update
  `public/image-manifest.json` to the new set of indices, and **never** leave files in
  `public/images/temp-images/`.

### Card thumbnails — build output, never committed
Cards load a 640px-wide WebP of slot 1 (`dist/thumbs/{checksum}_01.webp`, made by
`scripts/thumbs.mjs` at WebP quality 90 with sharp-YUV chroma); originals serve the drawer header
and the image viewer. Thumbnails regenerate from `public/images/` by content hash on every build
or `npm run dev`, so **there is nothing to do when images change**. They live in
`node_modules/.cache/vault-thumbs/` (and the deploy's Actions cache) — never commit them or put
them in `public/`. A missing thumbnail is not an error: the card falls back to the original.
`getImageUrl(checksum, 1, 'thumb')` gives the URL; only slot 1 has one.

### Image geometry — display shape, not stored shape
DVD and broadcast pixels are not square: an image written at the source's raw `Width`×`Height` is
**squashed** (720×576 PAL displays as 4:3 or 16:9, never 1.25). **Reach the display shape by
growing the under-sampled axis. Never downscale, and never upscale past native to make two shows
match.** Sizes legitimately differ by broadcast standard; the aspect ratio must be exact.

| Source | Standard | Display | Correct output |
|---|---|---|---|
| 720×576 | PAL | 4:3 | 768×576 |
| 720×576 | PAL | 16:9 | 1024×576 |
| 720×480 | NTSC | 4:3 | 720×540 |
| 720×480 | NTSC | 16:9 | 854×480 |
| 704×480 | NTSC | 4:3 | 704×528 |
| 1440×1080 | — | 16:9 | 1920×1080 |
| 1280×720 / 1920×1080 | — | 16:9 | unchanged |

Read-only audits:

```bash
python3 scripts/audit-image-geometry.py                     # images vs record
python3 scripts/audit-image-geometry.py --artist "Nirvana"  # detail for one artist
python3 scripts/audit-aspect-vs-source.py --artist "Nirvana"   # record vs SOURCE
```

The first compares the **images** to the **record**: squashed stills, and images that belong to no
record (`no show record`; run it after merging, deleting or re-keying any record). The second compares the
**record** to the **source on the drive**, which catches a wrong record the first cannot (the
images agree with it). Run them for the current list; never copy one in here.

- **A record's `AspectRatio` is often wrong** (discs declare 4:3 for a squeezed 16:9 broadcast).
  Where a capture finds a wrong aspect, correct the record in the same session, evidence in
  `PrivateNotes`.
- **Letterbox bars are kept, always** (owner, 2026-10-05). Capture the whole stored frame;
  `AspectRatio` is the **frame** ratio; measured letterbox rows go in `PrivateNotes`. Correcting a wrong
  aspect flag is still right — it crops nothing. The form `4:3 (letterboxed 16:9)` survives only on
  legacy records whose images were cropped (the audit reports them as `letterboxed - needs
  cropdetect`); never write it for a new capture.
- **Look at a record's CURRENT stills before trusting its identity.** The geometry audit passes a
  record keyed to the wrong titleset, or showing another band, if the shape is right.
- Two Smashing Pumpkins records (`d9b007dd78f2`, `32fafc677477`) can never be corrected: their
  nested folder no longer exists on the drive.

Capture and replacement belong to the `concert-screenshots` skill
(`.claude/skills/concert-screenshots/SKILL.md`): the procedure, the fixed encode settings
(lanczos, `-q:v 2`, `yuvj420p`, `setsar=1`, no sharpening or colour changes) and the read-only
safety rules. Never hand-roll ffmpeg for this. Read its "Field lessons — collection traps" before
any capture or record-splitting work.

### Temp images workflow
Karl drops stills into `public/images/temp-images/`, named `vlcsnap-YYYY-MM-DD-HHhMMmSSsNNN.jpg`,
and names the hero by the last three digits (`'839' hero` = the file ending `s839.jpg` → `_01`).
The rest follow in ascending timestamp (filename) order unless he says otherwise. Use the tool:

```bash
python3 tools/add-temp-images.py --show "irving plaza" --hero s257           # dry run: prints the plan
python3 tools/add-temp-images.py --show "irving plaza" --hero s257 --apply   # writes it
```

`--show` is a substring of Artist + FolderName (`--artist` narrows it). It refuses an ambiguous or
empty match, an image more than 2% off the record's `AspectRatio`, and a repo with missing or
orphaned images. `--apply` backs up replaced slots to `~/VaultShots/promote-backup/`, writes the
slots, deletes surplus ones, rewrites the manifest as `[1..N]`, checks nothing else changed, and
empties `temp-images/`. Where two copies of a show exist, narrow `--show` (Karl names the copy by
`TotalSizeHuman`).

By hand: find the record and its `ChecksumSHA1`; `ls public/images/{checksum}*`; copy the stills to
`{checksum}_0{n}.jpg` in order; set the manifest to exactly the new slots; **delete old slot files
no longer in the manifest** (replacing 4 with 3 always leaves one); delete the temp images.

---

## Temp checksum stubs
A record created before its files were scanned gets a random 40-char placeholder checksum, marked
by `"TEMP CHECKSUM - update when files are scanned"` in `PrivateNotes`. None remain; list any with:

```bash
python3 -c "
import json
for s in sorted(json.load(open('public/shows.json')), key=lambda x: (x['Artist'], x.get('ShowDate') or 'zzzz')):
    if 'TEMP CHECKSUM' in (s.get('Notes') or '') + (s.get('PrivateNotes') or ''):
        print(s['ShowID'], s['Artist'], s.get('ShowDate') or '(undated)')
"
```

**Match a stub by CONTENT, never by name**: hash the representative media and compare against
every existing `ChecksumSHA1` before writing anything (folders are often filed under unrelated
names, e.g. `Bon Jovi - Nokia Theatre` as `STREAM`). With the real SHA1: update `ChecksumSHA1`,
rename the image files, update the manifest key, clear the Note.

---

## Git workflow

- **Work is committed straight to `main`. Never push until Karl says** — every push deploys.
- **Commit by explicit path, in one command**, and never leave anything staged — parallel sessions
  share one git index: `git commit -m "…" -- path/one path/two`. A new file is added in the same
  command: `git add path/new && git commit -m "…" -- path/new path/other`.
- **Add by explicit path, never by directory, never with `-f`** (the old `git add -f public/`
  habit re-committed `public/.DS_Store`).
- Git ignores `dist/`, `public/images/temp-images/`, `tools/show-editor/index.html`,
  `.claude/settings.local.json`, and every `.claude/skills/` folder except `concert-screenshots/`
  and `va-masters/` (the design skills are local). `_playground/` is tracked but never shipped.
- **Tailwind v4 reads class names from every file git does not ignore.** A tracked folder that is
  not the site must be excluded in `styles/globals.css` with `@source not` (as `public/`,
  `_playground/`, `.claude/`, `docs/`, `data-pipeline/`, `scripts/`, `tools/` and the two
  Markdown files at the root are), or its words become production CSS.
- GitHub occasionally returns `HTTP 408` on push; the commit is fine — retry `git push origin main`.

### Health check
`scripts/health-check.py` runs from the local pre-push hook and in the deploy. Run it anytime:
`python3 scripts/health-check.py`.
- **Blocks:** a `ShowDate` that is not a real `YYYY-MM-DD` or blank; a record without `ShowID` or
  `Artist`; duplicate ShowIDs; a `ParentShowID` that is not a record, is a hidden master of a shown
  record, is itself linked, or lacks `SegmentStart` < `SegmentEnd` (`H:MM:SS`); a `ContentType`
  other than `Documentary`, or "Documentary" in `RecordingType`; one artist under two names, or a
  name starting with "The"; a manifest slot whose file is missing; **setlist loss**.
- **Setlist loss** — a song gone from a `Setlist`. Songs that moved to a record which gained them
  (a split) pass; a deliberate removal needs an entry in `scripts/setlist-removals-approved.json`
  with the exact strings and the reason. It compares the working tree with `HEAD`, so it sees only
  **uncommitted** changes: run it before committing a `shows.json` edit.
- **Warns only:** checksums missing from the manifest, orphaned images, temp checksums, files left
  in `temp-images/`, records with no checksum, deprecated or garbage `EventOrFestival` values, a
  "N shows" figure in README or CLAUDE.md more than 2% off the data, uncommitted README/CLAUDE.md
  edits.

### Commit message style
Conventional commits: `feat(shows):` new record or image · `fix(shows):` metadata correction ·
`feat(images):` image replacement/addition · `chore:` sync, cleanup · `feat(ui):` / `fix(ui):`
frontend. Always end with (unversioned on purpose, so it never goes stale):
```
Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Metadata conventions

These rules apply every time any field in `shows.json` is created or edited. No exceptions.

### Artist
One artist, one exact string — the artist view and A–Z directory group on it, so two spellings
split a band's records (owner, 2026-10-04).
- **No leading "The"** — `Strokes`, `Killers`, `Prodigy`, `Fray`, `Who`. Search still finds
  "The Strokes" (`normaliseArtist` drops the article).
- **The band's own spelling** — `Fun Lovin' Criminals`, not the folder's `Fun Loving`.
- **"Person & the Band" is filed under the person** — `Iggy Pop`, `Neil Young`, `Tom Petty`,
  `Bob Marley`, `Juliette Lewis`; say the billing in `PrivateNotes`. Not a band whose name merely
  contains "the": `Echo & the Bunnymen`.
- **Small words lower-case** — `Kings of Leon`, `Alice in Chains`, `Queens of the Stone Age`.
- **Solo careers are separate artists** — Chris Cornell is not Soundgarden.

**Before creating any record or starting any per-artist run, look up the stored spelling** and
reuse it exactly; most tools match `Artist` exactly and fail silently on a variant. The health
check catches case, "The", punctuation, `&`/`and` and accent variants, but not spelling ones
(`Lovin'` / `Loving`):

```bash
python3 -c "
import json; a='prodigy'
print({s['Artist'] for s in json.load(open('public/shows.json')) if a in (s.get('Artist') or '').lower()})"
```

### Split bills — one record per band, per tape
A tape with two bands' sets gets **one record per band**, time-windowed to that band's set, each
with its own setlist (owner, 2026-09-30); a joined name like `Incubus / Deftones` is invisible to
an exact-match filter on either band. File it with the `va-masters` procedure (a Various Artists
master plus linked records). Split only where the sets are separable in time, and confirm with the
owner first. Before calling an artist finished, check for a joined name:

```bash
python3 -c "
import json
a='Incubus'
for s in json.load(open('public/shows.json')):
    art=s.get('Artist') or ''
    if a.lower() in art.lower() and art != a: print(s['ShowID'], repr(art))
"
```

### Duplicate recordings
Every recording of the same show shares an identical `ShowDate`, `EventOrFestival`, `VenueName`,
`City` and `Country`. The most complete record is the reference; update the others to match, and
scan for duplicates whenever you edit any of these fields.

### ShowDate
- `YYYY-MM-DD` or `""` — nothing else, ever (no `"0000-00-00"`, `"Compilation"` or placeholders).
- Only the year known → `YYYY-01-01`; year and month → `YYYY-MM-01`.
- Compilations, documentaries, rockumentaries and TV-only specials with no air/performance date → `""`.

### Text encoding
No U+FFFD (mojibake) in any field. Read a latin-1 or cp1252 sidecar in its true encoding before
pasting from it — the Artifact publisher refuses any page containing U+FFFD.

### Country
Always the full English name, consistently across duplicate recordings: `United States` (not
`USA`/`US`), `United Kingdom` (not `UK`), `Netherlands` (not `The Netherlands`), `South Korea`.

### VenueName
- The name the venue had **at the time of the show**: "Brixton Academy" before 2011 (then O2
  Academy Brixton), "Wembley Stadium" not "EE Wembley Stadium", "The Shoreline Amphitheatre" not
  "Shoreline Amphitheater at Mountain View" for older shows.
- The physical venue only (the festival goes in `EventOrFestival`); strip date prefixes
  (`"2001-08-16 - Festival Name"` → `"Festival Name"`).

### Known festival metadata (canonical — do not introduce variants)

| Festival / Show | EventOrFestival | VenueName | City | Country | Notes |
|---|---|---|---|---|---|
| Pinkpop | `Pinkpop` | `Megaland` | `Landgraaf` | `Netherlands` | |
| Roskilde Festival | `Roskilde Festival` | `Dyrskuepladsen` | `Roskilde` | `Denmark` | |
| Rock im Park | `Rock im Park` | `Frankenstadion` | `Nuremberg` | `Germany` | Not `Nürnberg` |
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
| Leeds Festival | `Leeds Festival` | `Bramham Park` | `Leeds` | `United Kingdom` | 2003 onward |
| Reading + Leeds, site unknown | `Reading and Leeds Festival` | _(blank)_ | _(blank)_ | `United Kingdom` | Only when the footage names neither site — check stage banners ("Carling Weekend Reading") first |

### EventOrFestival
The festival or event name only — never dates, venue or city. Host-led talk shows use the host's
name (table above). Leave blank for a standard headline show with no named event.

### Setlist format
**Always** one semicolon-separated string — never newlines, numbers or bullets:

```
Song One; Song Two; Song Three; Encore break; Song Four; Song Five
```

- Songs separated by `; ` (semicolon + space); the encore separator is exactly `Encore break`.
- Covers inline: `In the Flesh (Pink Floyd cover)`; acoustic versions inline: `Just Because (Acoustic)`.
- A partial setlist ends with ` (incomplete)`.

### Setlist sourcing
- **The recording outranks everything.** What is captioned, printed or visible on screen is
  primary evidence about *this* recording. Where a published setlist disagrees, the video wins:
  write it, mark a partial list `(incomplete)`, record the conflict in `PrivateNotes`. Dates
  likewise: use external sources to choose between candidates the recording narrows down, then
  **commit to the best-evidenced one** and say why in `PrivateNotes`.
- **A sidecar inside the show's own folder is truth on its own** (`*.nfo`, `*.txt`, `info.txt`,
  `*.md5`) — written from the disc by whoever made it. Check it first; write the setlist, paste the
  file verbatim into `Notes` under `---- filename ----`, and say in `PrivateNotes` that the setlist
  came from it. House formatting still applies.
- Otherwise **2+ independent sources must agree** on songs and order, ranked: setlist.fm (check
  the user-confirmed count) · official band tour pages · published reviews (Rolling Stone, NME,
  Billboard, Pitchfork, local press) · YouTube full-show videos with confirmed date/venue · fan
  forums or Dime A Dozen NFOs with eyewitness accounts. With one source, or a conflict, leave it
  blank and note the conflict. Never reconstruct a setlist from tour averages or nearby shows.

```bash
python3 scripts/audit-sidecar-setlists.py --artist "Bush"   # read-only: sidecar songs missing from records
```

### Setlists that are populated but wrong
A non-empty `Setlist` is not a checked one. Sidecars pasted in wholesale leave header lines at the
top (band, venue, date, city) and trailer notes at the bottom (running time, lineage, credits,
"thanx to") — check the **first and last three entries** of any long setlist. A disc-numbered
segment (`Interview (cuts in)`, `jam`) belongs in `PrivateNotes` rather than being deleted silently, and
real songs collide with junk patterns (*Taper Jean Girl*, *Running on Faith*, *Pumping On Your
Stereo*).

---

## Data pipeline

`data-pipeline/` holds the numbered scripts that scanned the original hard drives:

```
01_scan_hd_shows/     catalog_shows_v3_1.py — scans a drive, outputs CSV + checksums
04_merge_hd_csvs_identify_duplicates/     merge_catalogs_safe.py — merges multiple drive CSVs
05_merge_csvs/        enrichment scripts
07_merge_csvs_create_single_master/  merge_drives_master.py
08_final_create_master_CSV/          final merge → shows.json
```

**Its CSVs are historical archives — do not edit them.** `public/shows.json` has been corrected by
hand record by record since; **never copy the pipeline's output over it** (the summary in
`data-pipeline/README/` says to; it is superseded). The pipeline reruns only when a new drive is
added, and that workflow is not finalised.

**The scanner reads every folder it is pointed at, music or not, and pastes text from any file it
finds — and the repo is public.** The Big Daddy scan walked a PC backup (`Karls PC before it dies/`)
and committed text from Karl's personal documents; on 2026-10-07 those 19 rows were purged from
every commit and force-pushed. Before committing any scan output, check its folder paths and Notes
for anything that is not a show.

### Drives
`MasterDriveName` is the drive a record was **originally catalogued from** (mostly `Seagate
Expansion Drive` or `Big Daddy`). **The whole collection now lives on one drive, `Live Music`**
(`/Volumes/Live Music`), which every capture and audit script reads; because records still carry
their original `FolderPath`, the tools resolve folders by name and content hash, not stored path.

---

## Metadata enrichment workflow

A **recurring task**: each session picks an artist (or batch) and fills missing or placeholder
`ShowDate` (year- or month-only → full date), `Setlist`, `EventOrFestival` and `VenueName`.
Research is inline web search; no scripts or accounts needed.

Identify each show from, in order: `FolderPath` / `FolderName` (dates, venue shorthand, event
names), `Notes` and `PrivateNotes` (lineage, broadcast source, eyewitness text), `EventOrFestival`, `City` + `Country`
+ year, `VenueName`.

Research rules:
- **2+ independent sources must agree** before any field is written (ranking: Setlist sourcing;
  the recording and a sidecar in the show's own folder outrank them).
- **A search engine's summary is not a source — only a page you fetched and read is.** It can point
  at where to look; it never counts toward the two.
- With one source, or a conflict, leave the field unchanged and tell the owner.

Workflow: scan the artist's records → research → present **all** proposed changes as one numbered
batch on a review page with an A (keep) / B (change) choice per row → write only what the owner
chooses → health check → commit (`fix(shows):` / `feat(shows):`). **Never write to `shows.json`
before the owner confirms.** Trigger phrases: "Check [Artist] for missing setlists", "Enrich
[Artist] shows", "Pick up metadata enrichment — do [Artist] next", "Continue enrichment".

### Karl's own edits — the Show Editor
`python3 tools/show-editor/build.py` renders `tools/show-editor/index.html` (gitignored; rebuild
after any `shows.json` change): one page, A–Z by artist, curatorial fields editable, technical ones
locked. It writes nothing — Karl pastes a text patch (`EDITS FOR N SHOWS … from: / to:`) into a
session. Apply it exactly as written, change nothing else (his edits need no second source), run
the health check and commit.

---

## Front-end performance

Measured, not guessed: these rules took the drawer from 400–600 ms to open to ~30 ms. `npm run
check:perf` (part of `npm run check`) enforces all but the last:

- **No motion components inside `ShowCard`.** Its hover and focus layers are CSS (`group-hover`,
  `group-focus-visible`); ~1,200 cards × animated components re-render together. Use `motion` for
  one-off elements (drawer, hero), never per card. This rule beats the vendored animation skills.
- **`AnimatePresence` around views or grids sets `presenceAffectsLayout={false}`** — at its
  default it re-renders every motion component beneath it past `React.memo`. The biggest cost.
- **Props that reach cards are stable.** `ShowCard` and `ShowGrid` are memoised: pass
  `onSelect={onShowClick}`, never `onClick={() => …}`. `getImageUrl` (useShows) and
  `handleShowClick` (App) are `useCallback`s. One inline arrow re-renders every card.
- **`inert` behind the drawer waits for the animation** — on when the slide-in finishes, off when
  the slide-out finishes (`drawerSettled` in App, `onSettled` in ShowDrawer). Toggling it restyles
  the whole page; inside the click it delayed the first frame. The backdrop covers the page and
  focus is trapped meanwhile.
- **Card images use native `loading="lazy"`** in `LazyImage` — no per-image IntersectionObserver,
  no `translateZ(0)` or `will-change` (each pins a compositor layer per card).
- **Cards load the build thumbnail**, with the original as `fallbackSrc`; anything shown large uses
  the original (the drawer header fades it in over the thumbnail).
- **The first load is the trimmed show list**, not `shows.json`. Notes arrive afterwards in their
  own lookup, never merged into the show objects (that would re-render every memoised card).
- **Fonts are self-hosted** (`public/fonts/README.md`), DM Sans preloaded. Never add a Google
  Fonts `<link>` — it is render-blocking.
- **No `content-visibility` on cards** (unchecked) — rejected three ways: on the button it clips
  the hover zoom and shadow; on the image it delays lazy loading so cards scroll in blank; on the
  overlays it made fast scrolling choppier.

**Measure before and after** any change to cards, grids, the drawer or image loading:

```bash
npm run perf               # build, serve, check drawer behaviour, time it, apply budgets (~4 min)
npm run perf -- --quick    # one run per CPU speed (~2 min)
npm run perf -- --url https://karl0s.github.io/digital-vault/   # probe any server, e.g. live
```

Single runs swing widely, so compare medians, never one run against one. The script uses
Playwright's headless shell from `~/Library/Caches/ms-playwright/` (Chrome.app will not start
headless from a sandboxed shell). Still open: virtualising Browse, only if a real phone stutters
(it costs in-page Cmd+F).

---

## Front-end architecture and UI patterns

**Read `docs/frontend.md` before changing anything in `components/`, `App.tsx`, `src/` or `styles/`.**
It holds the Browse architecture (shell, views, filter state, canonical URL, results pipeline,
controls, grids) and the UI patterns (close buttons, the iOS keyboard rule, the masthead, and the
show drawer's sizing, modal behaviour, layout, screenshots and image viewer). Keep it current
when you change any of them.

### Checks
`npm run check` = `check:perf` (Front-end performance), `check:url` (canonical
serialisation), `check:facets` (counts against the real `shows.json`), `check:store` (stable
selector snapshots), `check:brush` (brush geometry), `check:search` (every artist view returns
exactly that artist's shows, plus hand-checked search cases; `scripts/search-precision.ts`) and
`typecheck`. Run it after any code change; the deploy runs it too.

---

## Featured shows
`components/FeaturedRows.tsx` → `FEATURED_IDS`: 14 hand-picked ShowIDs (a multiple of 7, filling
whole rows at 2xl), shuffled once per load, shown on Browse only while nothing filters. A missing ID
drops out silently. The comment beside each ID says why that copy was chosen — keep doing that.

---

## Key stats
Recompute rather than quote — numbers here go stale:

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

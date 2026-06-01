# The Vault — Claude Project Guide

## What this project is
A personal archive and browser for a private collection of concert video recordings.
Live site: https://karl0s.github.io/digital-vault/

The frontend is a React/Vite SPA. All show data lives in a flat JSON file (`public/shows.json`).
Images are static files served from `public/images/`. There is no backend.

---

## Repository layout

```
public/
  shows.json            ← master show data (source of truth)
  image-manifest.json   ← maps checksum → available image slot indices
  images/               ← {checksum}_01.jpg … _04.jpg per show
  images/temp-images/   ← staging folder for new images (should always be empty after a task)

dist/                   ← BUILD OUTPUT — never commit this, CI owns it
components/             ← React components
  CloseButton.tsx       ← shared close button (semi-transparent style) — use this for ALL close buttons
src/hooks/              ← custom React hooks
data-pipeline/          ← numbered Python scripts for scanning hard drives → CSV → shows.json
scripts/
  health-check.py       ← integrity validator (runs automatically as pre-push hook)
_playground/            ← isolated UI experiments, never imported by the live app
  branding/             ← logo and typographic effect experiments
  grid/                 ← card layout and filter chip experiments
```

---

## Playground

`_playground/` is a sandbox for UI experiments. Each subdirectory is a topic area.
Experiments are routed automatically via `import.meta.glob` + `React.lazy` in `PlaygroundRouter.tsx`.

### Rules
- Every playground subfolder **must** have exactly one MD file named after the folder (e.g. `branding/logo.md`, `grid/grid.md`).
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

- **GitHub Actions** (`.github/workflows/deploy.yml`) runs `npm run build` on every push to `main`
- Vite copies everything from `public/` into `dist/` at build time
- The built `dist/` is deployed to GitHub Pages — **never manually commit `dist/`**
- `dist/` is already in `.gitignore` and should stay that way

---

## The data model

### shows.json
Flat JSON array of show objects. Key fields:

| Field | Type | Notes |
|---|---|---|
| `ShowID` | 12-char hex string | Unique identifier |
| `Artist` | string | Must match exactly (used for grouping) |
| `ShowDate` | `YYYY-MM-DD` or `""` | Empty = undated; sorts to end of results |
| `EventOrFestival` | string | Festival/event name e.g. "Glastonbury", "MTV Unplugged" |
| `VenueName` | string | Physical venue name — not the festival name |
| `City` | string | |
| `Country` | string | |
| `RecordingType` | string | "Proshot", "Soundboard", "Audience" |
| `ChecksumSHA1` | 40-char hex string | SHA1 of the source file; used as image key |
| `Notes` | string | Free text; temp checksum stubs have "TEMP CHECKSUM - update when files are scanned" here |

### ShowDate rules
- Format is always `YYYY-MM-DD` or empty string `""`
- Compilations, documentaries, TV shows with no specific date → set to `""`
- When only year is known, use `YYYY-01-01` as a placeholder
- Shows with empty or non-date ShowDate sort to the **end** of all result lists
- Never use placeholder strings like `"0000-00-00"` or `"Compilation"`

### image-manifest.json
Maps `ChecksumSHA1 → [1, 2, 3, 4]` (array of available slot indices).
Only slots listed here are served — if a slot isn't in the array, the image is assumed missing.

---

## Image conventions

- Images are named `{ChecksumSHA1}_01.jpg`, `_02.jpg`, `_03.jpg`, `_04.jpg`
- Only `.jpg` format
- Up to 4 images per show; slot 1 is the primary (shown on cards)
- When adding/replacing images:
  1. Copy new files to `public/images/` with correct `{checksum}_0{n}.jpg` name
  2. Update `public/image-manifest.json` to reflect the new set of indices
  3. **Never** leave files in `public/images/temp-images/` — clean it up every task

### Temp images workflow
User drops images into `public/images/temp-images/` then asks Claude to assign them to a show.

**Temp image filename convention**: files are always named `vlcsnap-YYYY-MM-DD-HHhMMmSSsNNN.jpg`.
The user references the hero image by the last 3 digits (`NNN` — the milliseconds portion), e.g. `'839' hero` means the file ending in `s839.jpg` goes to `_01`.

**Slot ordering**: hero image → `_01`. Remaining images in ascending timestamp order (alphabetical by filename) unless the user specifies otherwise.

Steps:
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

Shows with temp checksums (as of last update):
| ShowID | Show | Date |
|---|---|---|
| `88b30e27e380` | STP — WAAF | 2000-01-01 |
| `f0516c90fab9` | STP — New York (Proshot) | 2010-01-01 |
| `864ba0fb6931` | STP — 2010 Tour | 2010-08-20 |
| `7df1b178e2a2` | RHCP — Woodstock 1999 | 1999-01-01 |

When the real SHA1 is available: update `ChecksumSHA1` in shows.json, rename the image files,
and update the manifest key. Clear the Note.

---

## Git workflow

### Always use force-add for public/
`public/` is listed in `.gitignore` (Gatsby leftover) but its files are tracked.
Always use `git add -f public/` or `git add -f public/shows.json` etc.

### Never commit dist/
`dist/` is built by CI. Never `git add dist/` — it will be ignored correctly.

### Push 408 timeouts
GitHub occasionally returns `HTTP 408` on push. The commit is always created successfully — just retry `git push origin main` immediately. It succeeds on the second attempt.

### Health check runs automatically
A pre-push hook runs `scripts/health-check.py` before every push.
- **Warnings** (temp checksums, orphaned images, empty checksums) — printed but don't block
- **Errors** (bad dates, missing images listed in manifest, duplicate ShowIDs) — block the push

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
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## Metadata conventions

These rules apply every time any field in `shows.json` is created or edited. No exceptions.

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

---

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

---

### EventOrFestival
- Festival/event name only — never include dates, venue, or city in this field
- Examples: `"Glastonbury"`, `"Rock am Ring"`, `"MTV Unplugged"`, `"Later w/ Jools Holland"`
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
Before writing any setlist, **2+ independent sources must agree** on the songs and order.

Acceptable sources (ranked by reliability):
1. setlist.fm (check user-confirmed count — higher = more reliable)
2. Official band site tour pages (e.g. janesaddiction.org/tour)
3. Published concert reviews (Rolling Stone, NME, Billboard, Pitchfork, local press)
4. YouTube full-show videos with confirmed date/venue
5. Fan forums or Dime A Dozen NFO files with eyewitness accounts

If only 1 source is found, or sources conflict: leave `Setlist` blank and note the conflict.
Never infer or reconstruct a setlist from tour averages or nearby-show patterns alone.

---

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
The live source of truth is `public/shows.json`.
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
- Acceptable sources (ranked by reliability):
  1. setlist.fm (check user-confirmed count — higher = more reliable)
  2. Official band site tour pages
  3. Published concert reviews (Rolling Stone, NME, Billboard, Pitchfork, local press)
  4. YouTube full-show videos with confirmed date/venue
  5. Fan forums or Dime A Dozen NFO files with eyewitness accounts
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

| Drive | Contents |
|---|---|
| Big Daddy | Main collection — bulk of all shows |
| Seagate Expansion Drive | Overflow + 2010–2013 era shows |

---

## UI patterns

### Content container width
The homepage and nav share a standard max-width container to keep content visually centred on wide screens:

- `max-w-[1924px] mx-auto` — used in `FeaturedRows` (outer wrapper) and `TopNav` (inner content wrapper). Caps the content area on ultra-wide screens so rows don't stretch edge-to-edge.
- `max-w-[1860px] mx-auto` — used in `SearchResultsGrid`. Same effective inner width as FeaturedRows (1924px − 64px outer padding already applied by `App.tsx`).

When adding any new full-width homepage section, wrap its content in `max-w-[1924px] mx-auto`. The nav background spans the full viewport; only its inner flex div gets the max-width wrapper.

### Homepage row card widths
On **mobile** (`< md`), each `FeaturedRow` renders as a 2-column CSS grid flowing vertically — no horizontal scroll, no fades, no arrows. All cards in the row are visible.

On **desktop** (`md+`), `FeaturedRows` uses viewport-calc card widths at the same breakpoints as `SearchResultsGrid`:

```
md:     calc((100vw - 64px - 36px) / 4)          ← 4 visible (= search grid)
lg:     calc((100vw - 64px - 48px) / 5)          ← 5 visible (= search grid)
xl:     calc((100vw - 64px - 60px) / 6)          ← 6 visible (= search grid)
2xl:    calc((min(100vw,1924px) - 64px - 72px) / 6.5)  ← 6.5 with scroll peek
```

At `2xl` the homepage shows 6.5 (one fewer than the grid's 7) to preserve the visible scroll peek.

### Homepage row fade gradients
Desktop only. In `FeaturedRow` (inside `FeaturedRows.tsx`), the left/right edge fades are **always visible** when there is content to scroll — they are separate `pointer-events-none` divs, not part of the arrow buttons. The arrow buttons (`z-20`) are hover-only (`opacity-0` → `opacity-100` on `isRowHovered`). The fade divs (`z-10`) have no opacity transition.

This means desktop users always see the scroll affordance without needing to hover first. On mobile the grid layout makes fades and arrows unnecessary.

### Search results grid
`SearchResultsGrid` uses CSS `grid` with responsive column counts — no fixed card widths (columns size automatically via `1fr`):

```
grid-cols-2  →  md:grid-cols-4  →  lg:grid-cols-5  →  xl:grid-cols-6  →  2xl:grid-cols-7
```

Card widths at each breakpoint match the homepage row cards (same calc denominators), so both views feel visually consistent.

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

Also ensure mobile inputs have `font-size: 16px` (`text-base`) or larger. iOS auto-zooms the page when focusing any input with `font-size < 16px`.

### Hero section (HeroSearch)
The hero title block (site name, subtitle, quick-search pills) is always mounted but animates to
`height: 0 / opacity: 0` when `isSearching` is true. It is driven by Framer Motion's `animate` prop
(not `AnimatePresence`) so the nav search input is never unmounted while typing.
`App.tsx` passes `isSearching={isSearching || showAllMode}` to collapse it in both search and all-shows mode.

### ShowDrawer — mobile sizing
On mobile the drawer is `h-dvh` (`height: 100dvh`) — **not** `h-[88vh]` or `h-screen`. `dvh` is the dynamic viewport height unit: the browser recalculates it live as the URL bar appears or disappears, so the drawer always fills exactly the visible screen. Do not change this to a static `vh` value.

### Drawer metadata layout (ShowDrawer)
The drawer hero area and content grid follow this fixed structure:

**Hero area** (top of drawer, above thumbnails):
1. Artist name — large display font
2. Single subtitle line — `Date · EventOrFestival (or VenueName if no event) · Country (or City, Country if no event)` — built as a filtered join with ` · ` separator; "Date Unknown" if `ShowDate` is empty
3. Badge pills row — RecordingType, Duration (Clock icon + auto-formatted `DurationSec`), TVStandard — each only rendered if the field has a value

**Content grid** (below thumbnails):
- 3 columns on `md+`: Setlist | Technical | Notes
- Column count is dynamic — `md:grid-cols-3` when all three exist, `md:grid-cols-2` when only two, no grid class when only one
- Column labels use `text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600`
- Setlist: numbered list from semicolon-split `Setlist` field; `Encore break` rendered as a divider line
- Technical: array of `{ label, value }` rows — label fixed `w-16 text-gray-500`, value `text-white`; only rows with a value are rendered
- Notes: `whitespace-pre-wrap wrap-break-word font-mono text-xs text-gray-400`; truncated to `max-h-40` with a gradient fade when collapsed; **More ⌄ / Less ⌃** buttons toggle `notesExpanded` state; button only shown when `Notes.length > 320`. `wrap-break-word` is intentional — pipeline notes often contain long unbroken strings (URLs, codec lines, filenames) that would overflow the container on mobile and cause the browser to zoom

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
- The overlay renders a `<motion.div>` with the same `layoutId` matching `expandedFromIndex` — Framer Motion animates the element between thumbnail and expanded positions
- Navigating prev/next only updates `viewingIndex`; close always zooms back to the original thumbnail
- The drawer's own close button is hidden (`!isImageExpanded`) while the viewer is open to prevent z-index conflicts with the overlay's close button

---

## Featured shows (homepage)

`components/FeaturedRows.tsx` contains `FEATURED_IDS` — an array of ShowIDs shown in the
"Featured" row on the homepage. Edit this array to add/remove featured shows.

Current quick-search pills are defined in `components/HeroSearch.tsx` → `QUICK_SEARCHES`.

---

## Key stats (as of last update)
- **823 shows** across **165 artists**
- Top artists by volume: STP (78), Smashing Pumpkins (58), Kings of Leon (44),
  Foo Fighters (31), Soundgarden (31), RHCP (25), Incubus (24), Faith No More (20),
  Jane's Addiction (19)
- Top festivals: Rock am Ring (39), Glastonbury Festival (28), Reading Festival (25),
  MTV Unplugged (19), Bizarre Festival (19), Pinkpop (18), VH1 Storytellers (16)

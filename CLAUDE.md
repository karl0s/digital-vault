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
src/hooks/              ← custom React hooks
data-pipeline/          ← numbered Python scripts for scanning hard drives → CSV → shows.json
scripts/
  health-check.py       ← integrity validator (runs automatically as pre-push hook)
```

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
Steps:
1. Identify target show (by FolderPath, FolderName, ShowID, or description)
2. Get the show's `ChecksumSHA1` from shows.json
3. Copy temp images to `public/images/{checksum}_0{n}.jpg` in the requested order
4. Update manifest indices
5. **Delete temp images** before completing the task

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
| `864ba0fb6931` | STP — Chicago (Proshot) | 2010-01-01 |
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

## Metadata consistency rules

When the same show exists as multiple recordings (different sources), all versions must share:
- Identical `ShowDate`
- Identical `EventOrFestival`
- Identical `VenueName`
- Identical `City` and `Country`

The record with the most complete metadata is used as the reference; others are updated to match.

### Common corrections to watch for
- `EventOrFestival` accidentally containing a date string → replace with the festival name
- `VenueName` containing date prefixes like `"2001-08-16 - Festival Name"` → strip the date
- Venue names using modern branding for historic shows (e.g. "O2 Academy Brixton" for a 1996
  show — should be "Brixton Academy", O2 naming started 2011)
- Rockumentaries, documentaries, compilations, and TV-only shows → `ShowDate` should be `""`

---

## Data pipeline

Located in `data-pipeline/` — numbered Python scripts for scanning physical hard drives:

```
01_scan_hd_shows/     catalog_shows_v3_1.py — scans a drive, outputs CSV + checksums
04_merge_hd_csvs/     merge_catalogs_safe.py — merges multiple drive CSVs
05_merge_csvs/        enrichment scripts
07_merge_csvs_create_single_master/  merge_drives_master.py
08_final_create_master_CSV/          final merge → shows.json
```

**These CSV files are historical archives — do not edit them.**
The live source of truth is `public/shows.json`.
The pipeline is only re-run when a new hard drive is added to the collection.
The workflow for adding a new drive is not yet finalised.

---

## Metadata enrichment agent

`scripts/enrich-metadata.py` uses Claude claude-sonnet-4-6 with web search to look up exact
dates, venues, cities and countries for shows with placeholder metadata.

**Setup** (one time — free, no payment):
```bash
# 1. Create a free account at https://www.setlist.fm
# 2. Go to https://www.setlist.fm/settings/api → Apply for an API key
# 3. Add it to your shell:
echo 'export SETLISTFM_API_KEY=your-key-here' >> ~/.zshrc && source ~/.zshrc
```

**Common usage:**
```bash
# All shows with YYYY-01-01 placeholder dates
python3 scripts/enrich-metadata.py

# One artist only
python3 scripts/enrich-metadata.py --artist "Stone Temple Pilots"

# Single show by ShowID
python3 scripts/enrich-metadata.py --id abc123def456

# Preview without writing
python3 scripts/enrich-metadata.py --dry-run

# Limit batch size
python3 scripts/enrich-metadata.py --limit 5
```

The script: queries setlist.fm per show → scores matches against known fields →
collects all proposals → shows a full diff → asks for one confirmation →
writes to `public/shows.json`. Uses no AI — pure setlist.fm data.
After writing, always run the health check and commit.

---

## Hard drives in the collection

| Drive | Contents |
|---|---|
| Big Daddy | Main collection — bulk of all shows |
| Seagate Expansion Drive | Overflow + 2010–2013 era shows |

---

## Featured shows (homepage)

`components/FeaturedRows.tsx` contains `FEATURED_IDS` — an array of ShowIDs shown in the
"Featured" row on the homepage. Edit this array to add/remove featured shows.

Current quick-search pills are defined in `components/HeroSearch.tsx` → `QUICK_SEARCHES`.

---

## Key stats (as of last update)
- **823 shows** across **165 artists**
- Top artists by volume: STP (75), RHCP (52), Soundgarden (46), Smashing Pumpkins (40),
  Foo Fighters (31), Radiohead (28), Rage Against the Machine (26), Kings of Leon (25),
  Pearl Jam (24), Jane's Addiction (23)
- Top festivals: Rock am Ring (36), Glastonbury (27), Reading (19), MTV Unplugged (18),
  Pinkpop (16), VH1 Storytellers (16)

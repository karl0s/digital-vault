# The Vault: Project Overview and Technical Architecture

A local-first cataloging system for a large private collection of live concert recordings, combining structured metadata, rich media screenshots, and a Netflix-style browsing experience deployed to GitHub Pages.

This document is the current authoritative technical specification.

---

## 1. Project Purpose

The Vault creates a single, authoritative source of truth for a private collection of rare concert recordings. Each show includes:

- Artist, date, venue, city, country
- Taper lineage and recording source info
- Technical metadata (file formats, codecs, disc structures, VOB/TS groups)
- Thumbnails (up to 4 per show, extracted from the video)
- Setlist
- Master hard-drive reference

The project delivers:

- A cleaned, structured **master CSV** representing the entire collection
- A unified **shows.json** derived from the CSV
- A **static website** hosted on GitHub Pages: dark mode, Netflix-style, fast
- A data pipeline requiring minimal manual effort once set up

---

## 2. Current Collection Stats

- **819 shows** across multiple artists
- **726 shows** with known dates (recovered via automated metadata scanning)
- **9 shows** marked "Compilation" (multi-date collections)
- **84 shows** with no recoverable date
- Images: up to 4 thumbnails per show, stored as `{ChecksumSHA1}_01.jpg` through `_04.jpg`

---

## 3. High-Level Workflow

### Step 1 — Scan Hard Drives
Automated Python scripts scan each show folder across multiple external drives:
- Read TXT/NFO/DOC files for metadata (venue, lineage, taper info, setlists)
- Detect and group VOB/TS video files
- Extract technical specs (codec, resolution, duration, file size)
- Capture folder name and path as metadata fallbacks

Output: per-drive CSV files in `data-pipeline/01_scan_hd_shows/`

### Step 2 — Screenshot Extraction
Automated screenshot generation using VLC or mpv:
- 3–4 full-resolution frames extracted at predictable timestamps
- Named `{ChecksumSHA1}_01.jpg` through `_{n}.jpg`
- Placed directly in `public/images/`

### Step 3 — Merge & Deduplicate
Python scripts in `data-pipeline/04_merge_hd_csvs_identify_duplicates/` and `data-pipeline/05_merge_csvs/`:
- Merge per-drive CSVs into a single dataset
- Identify and flag duplicates using `ChecksumSHA1`
- Enrich with checksum data

### Step 4 — Create Master CSV
Scripts in `data-pipeline/07_merge_csvs_create_single_master/` and `data-pipeline/08_final_create_master_CSV/`:
- Produce a single authoritative `MASTER_merged_shows.csv`
- Clean artist names, venue names, event/festival names
- Recover dates from folder names, file names, and embedded notes
- Output `shows.json` for the web app

### Step 5 — Publish to Web App
Copy or symlink the output `shows.json` to `public/shows.json`, then push to `main`. GitHub Actions handles the rest.

---

## 4. Project Structure

```
the-vault/
  App.tsx                          # Root React component
  components/
    FeaturedRows.tsx               # Home page — curated horizontal rows
    HeroSearch.tsx                 # Top search bar
    TopNav.tsx                     # Navigation bar
    ShowCard.tsx                   # Individual show card
    SearchResultsGrid.tsx          # Search results layout
    ShowDrawer.tsx                 # Slide-out detail panel
    ArtistRow.tsx                  # Single horizontal scroll row
    Sidebar.tsx                    # Artist navigation sidebar
    ImageLightbox.tsx              # Full-screen image viewer
    LazyImage.tsx                  # Lazy-loading image with placeholder
  src/
    hooks/
      useSearchEngine.ts           # MiniSearch index setup
      useSearchAndFilter.ts        # Filter logic — field-specific, decade keywords
      useGeoLocation.ts            # IP geolocation (ipapi.co)
      useShows.ts                  # Data loading
      useDebounce.ts               # Search debounce
      useKeyboardNavigation.ts     # Keyboard nav
      useScrollSpy.ts              # Sidebar scroll tracking
    main.tsx                       # React entry point
    index.css                      # Global styles
  public/
    shows.json                     # Master show data (flat JSON array)
    images/                        # Thumbnails: {ChecksumSHA1}_01.jpg etc.
  data-pipeline/
    01_scan_hd_shows/              # Per-drive scan scripts and output CSVs
    04_merge_hd_csvs_identify_duplicates/
    05_merge_csvs/
    07_merge_csvs_create_single_master/
    08_final_create_master_CSV/    # Final master CSV + shows.json output
    README/                        # This document
  .github/
    workflows/
      deploy.yml                   # GitHub Actions — auto-deploy on push to main
  vite.config.ts
  tsconfig.json
  package.json
  README.md                        # Main project README
```

---

## 5. Development Workflow

The UI is built directly in the codebase using React/TypeScript. There is no external design tool or sync script.

### Day-to-day

```bash
# Start local dev server
npm run dev
# Preview at: http://localhost:5173/digital-vault/
```

Edit any file in `components/`, `src/hooks/`, or `App.tsx`. Changes reflect instantly via hot module reloading.

### Committing and deploying

```bash
git add <files>
git commit -m "feat: description of change"
git push origin main
```

GitHub Actions picks up the push, builds the project, and deploys to GitHub Pages automatically. The live site updates within ~2 minutes.

- **Live URL**: `https://karl0s.github.io/digital-vault/`
- **GitHub repo**: `https://github.com/karl0s/digital-vault`

### Branch policy

Work directly on `main` for routine changes. Feature branches are fine for larger changes but must be merged into `main` to deploy. Delete merged branches when done.

---

## 6. Data Format

`public/shows.json` is a **flat JSON array** — not wrapped in any outer object:

```json
[
  {
    "ShowID": "abc123",
    "Artist": "Stone Temple Pilots",
    "ShowDate": "1993-01-01",
    "EventOrFestival": "",
    "VenueName": "Fresno Civic Auditorium",
    "City": "Fresno",
    "Country": "United States",
    "RecordingType": "Audience",
    "ChecksumSHA1": "def456...",
    ...
  }
]
```

### ShowDate conventions

| Value | Meaning |
|-------|---------|
| `"1994-08-16"` | Exact date known |
| `"1994-01-01"` | Year known, exact date unknown |
| `"Compilation"` | Multi-date collection spanning more than one year |
| `""` (empty) | Date completely unknown |

### Display priority on cards

The UI picks the most specific available descriptor for each show:

- **Line 1 (title)**: `EventOrFestival` → `VenueName` → `Artist`
- **Line 2 (subtitle)**: `EventOrFestival` → `VenueName` → `City, Country`

Keep `EventOrFestival` for festivals, TV appearances, and documentaries. Use `VenueName` for straight concert venues.

---

## 7. Search Capabilities

The search engine (MiniSearch) supports:

- **General**: prefix + fuzzy matching across all text fields
- **Field-specific**: `artist:`, `venue:`, `city:`, `country:`, `type:`, `song:`, `year:`, `event:`, `drive:`, `codec:`
- **Decade keywords**: `nineties`, `90s`, `eighties`, `80s`, `2000s`, `00s`, `2010s`, `10s`, etc.
- **Compound**: `nirvana nineties`, `soundboard 2000s`

---

## 8. Future Enhancements

- Automated date recovery pipeline (run as part of CSV generation, not post-hoc)
- Nightly backup of `shows.json` + `public/images/`
- Admin interface for manually correcting metadata without editing JSON directly
- Optional password protection for the GitHub Pages deployment

---

## 9. Summary

The Vault is a:
- **Code-first** project — UI built directly in React/TypeScript, no design tool intermediary
- **Git-driven** — push to `main` deploys automatically
- **Data-pipeline-backed** — Python scripts produce the `shows.json` that powers the UI
- **Private collection** — concert files remain on local drives; only metadata and thumbnails are published

Development: `npm run dev` → edit → browser refreshes instantly.
Deploy: `git push origin main` → live in ~2 minutes.

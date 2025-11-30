# 🎬 Show Catalog Automation — Project Summary (v3, Nov 2025)

---

## 1. Purpose

This project automates the cataloguing and presentation of a large **live concert video collection** stored across several external hard drives.  
It produces a **structured master dataset** used to generate:

- A searchable **Netflix-style React web application** ("The Vault") with show cards, screenshots, and detailed metadata.  
- Integration with **media servers** like Jellyfin, Plex, or Kodi.  
- A canonical **CSV / JSON archive** for analysis, merging, and deduplication.  

The system eliminates manual entry, normalizes metadata (artist, date, venue, type, etc.), and guarantees stable identifiers and checksums across all drives.

---

## 2. Tools and Workflow

### Operating Environment
- **macOS Ventura 13.7.8 (22H730)** — iMac 27-inch (2017)  
- **CPU:** 3.4 GHz Quad-Core Intel Core i5  
- **RAM:** 52 GB DDR4  
- **Shell:** zsh (default Terminal shell)

### Installed Dependencies

| Tool | Purpose |
|------|----------|
| **Python 3** | Drive scanning & metadata extraction |
| **Homebrew** | macOS package manager |
| **ffmpeg / ffprobe** | Media analysis & screenshots |
| **exiftool** | Fallback metadata extraction |
| **python-docx** | Reads `.docx` info files |
| **textutil** | macOS-native `.doc` / `.rtf` parser |
| **hashlib, os, pathlib, re** | Core Python modules |
| **pandas** | CSV handling and merging |
| **json** | JSON export for the site |
| **Node.js / npm** | JavaScript runtime & package manager |
| **Vite** | Build tool for React application |
| **React** | Frontend framework |
| **Tailwind CSS v4** | Styling framework |
| **TypeScript** | Type-safe JavaScript |

---

### Workflow Summary (2025)

1. **Scan an external drive to extract metadata:**

   ```bash
   python3 ~/Desktop/catalog_shows_v3_1.py /Volumes/Big\ Daddy \
     --output ~/Desktop/NEW_MASTER_merged_shows_2025-11-06_2113.csv \
     --checksums --drive-id
   ```

   - Recursively scans all show folders.  
   - Extracts metadata from text, DOC, and NFO files.  
   - Writes a unified CSV (one row per show).  
   - Uses SHA-1 hashes for stable IDs.

2. **Special case – Untitled HD (subfolder DVDs path):**

   ```bash
   python3 ~/Desktop/catalog_shows_v3_1.py /Volumes/Untitled/DVDs \
     --output ~/Desktop/NEW_MASTER_merged_shows_2025-11-06_2113.csv \
     --checksums --drive-id
   ```

   This drive has its shows under `/DVDs`, so the root path must include it.

3. **Merge or update the master CSV** (if new drives are scanned).  
   - Manual edits (e.g. Artist, Venue, Setlist) are **preserved**.  
   - The merge logic compares both `ShowID` and `ChecksumSHA1`.  
   - Always keep the latest master file on the Desktop, e.g.:  
     `NEW_MASTER_merged_shows_2025-11-06_2113.csv`

4. **Generate screenshots** for shows on a given drive:  

   ```bash
   cd ~/Desktop
   python3 test_screenshots_by_drive.py
   ```

   - Reads the master merged CSV defined in the script header:  
     `MASTER_CSV_PATH = Path("/Users/ko/Desktop/NEW_MASTER_merged_shows_2025-11-06_2113.csv")`
   - Filters shows by `MasterDriveName` (set via `DRIVE_FILTER`).  
   - Captures 4 screenshots per show (`*_01.jpg` to `*_04.jpg`).  
   - Preserves **original aspect ratio**, scaling down only if the longest side > **1280px** (no upscaling).  
   - Skips existing images (safe to re-run anytime).  
   - Output screenshots: `/Users/ko/Desktop/build/images/`  
   - Log CSV: `~/Desktop/screenshot_capture_report_YYYYMMDD_HHMMSS.csv`

   **Examples (in the script header):**  
   - For Big Daddy HD  
     ```python
     DRIVE_FILTER = "BIG DADDY"
     ```  
   - For Untitled HD  
     ```python
     DRIVE_FILTER = "UNTITLED"
     ```  

5. **Convert CSV to shows.json** (for the React app):

   - ChatGPT or a conversion script transforms the CSV into JSON format.
   - The JSON structure should match the schema expected by the React app.
   - Output: `/public/shows.json`

6. **Add images to the React project:**

   ```bash
   # Copy all 800+ screenshots to the public images folder
   cp ~/Desktop/build/images/* /path/to/the-vault/public/images/
   ```

   - Images **must** go in `/public/images/` (not `/dist/images/` or `/src/images/`)
   - The build process automatically copies them to `/dist/images/`
   - Reference format in `shows.json`: `"image": "/images/concert-photo-1.jpg"`

7. **Build the React application:**

   ```bash
   cd /path/to/the-vault
   npm install              # Install dependencies (first time only)
   npm run build            # Build static site to /dist folder
   ```

   - **Prerequisites:** Node.js and npm must be installed
   - **First time setup:** Run `npm install` to install all dependencies including:
     - Vite (build tool)
     - React (UI framework)
     - Tailwind CSS v4 (styling)
     - @tailwindcss/postcss (PostCSS plugin)
   - Output: Static HTML/CSS/JS files in `/dist/` folder
   - The `/dist/images/` folder contains copies of all images from `/public/images/`

8. **Preview the site locally:**

   ```bash
   npm run preview
   ```

   Visit → **http://localhost:4173**

9. **Deploy to Netlify:**

   - Upload the entire `/dist` folder to Netlify via drag-and-drop or CLI
   - The site is now live as a static website (no backend required)

---

## 3. Build Specification

### Objective

Create a permanent, extensible dataset describing every concert folder by combining:

- Extracted text & notes  
- Technical video/audio details  
- Drive source information  
- Derived attributes (artist, event, date, type, etc.)

---

### Unified Data Schema (2025)

| Category | Field | Description |
|-----------|--------|-------------|
| **Identification** | `ShowID` | SHA-1 of folder path |
| | `ChecksumSHA1` | File hash (unique across drives) |
| | `DuplicateOf` | If show already exists on another drive |
| **Artist & Event** | `Artist`, `ShowDate`, `EventOrFestival` | Standardized metadata |
| | `VenueName`, `City`, `Country` | Inferred from notes or folder |
| **Recording Details** | `RecordingType`, `Generation`, `Lineage`, `SourceEquipment` | Capture chain info |
| **Folder Metadata** | `FolderPath`, `MasterDriveName`, `MasterDriveID` | Physical location context |
| **Video Summary** | `Container`, `RepVideoFiles`, `Width`, `Height`, `AspectRatio`, `DurationSec`, `TVStandard` | Video data |
| **Audio Summary** | `AudioCodec`, `AudioChannels`, `AudioSampleRate` | Audio properties |
| **Content** | `Setlist`, `Notes`, `ExtractionWarnings` | Text content |
| **Administrative** | `LastScannedAt` | Timestamp of last scan |

---

### Output Formats

| Format | Description |
|---------|--------------|
| **CSV** | Editable master file (default output from Python scripts) |
| **JSON** | Data format consumed by React app (`/public/shows.json`) |
| **HTML/CSS/JS** | Final static site in `/dist` folder (built by Vite) |

---

## 4. Media Drive Context (2025)

| Drive Name | Path Example | Notes |
|-------------|--------------|-------|
| **Big Daddy HD** | `/Volumes/Big Daddy/` | Standard structure |
| **Untitled HD** | `/Volumes/Untitled/DVDs/` | Shows live under `/DVDs` subfolder |
| **Archive_HD** | `/Volumes/Archive_HD/` | Typical Proshot material |
| **VideoVault_2** | `/Volumes/VideoVault_2/` | Mixed formats |
| **Seagate** | `/Volumes/Seagate/` | Backup or duplicate drive |

Typical show structure examples:

- `/Artist/Year – Venue/VIDEO_TS/*.VOB`  
- `/Artist/ShowName/INFO/*.TXT`  
- Some drives have single files in folders (`.MKV`, `.MP4`, `.TS`, etc.)

---

## 5. Project Purpose Recap

Enable a **consistent metadata pipeline** for all drives that produces:

- Uniform structure for all concerts.  
- A visually browsable Netflix-style catalog ("The Vault").  
- High-quality screenshots at native aspect ratio.  
- Deduplication across multiple drives using `ChecksumSHA1`.  
- Safe re-runs without data loss or overwriting existing images/edits.
- Static deployment to Netlify with no backend required.

---

## 6. Major Enhancements Since v2

| Area | Update |
|-------|---------|
| **Frontend Framework** | Migrated from Python-generated HTML to React + Vite + Tailwind CSS v4. |
| **UI Design** | Netflix-style interface with top nav, A-Z sidebar, horizontally scrolling artist rows, and slide-out drawer for show details. |
| **Build Process** | Uses npm/Vite build system; outputs to `/dist` folder for static deployment. |
| **Screenshot Engine** | Preserves native aspect ratio; scales only if longest side > 1280px. |
| **Untitled Drive Handling** | Made explicit that `/Volumes/Untitled/DVDs` is the root scan path. |
| **Image Management** | All images go in `/public/images/` and are automatically copied to `/dist/images/` during build. |
| **Deployment** | Switched from GitHub Pages to Netlify for static hosting. |
| **Safety Enhancements** | Images and manual CSV edits are never overwritten by default. |

---

## 7. Current Stable Commands

### 📀 Catalog a Drive (any HD)

**Big Daddy HD example:**

```bash
python3 ~/Desktop/catalog_shows_v3_1.py /Volumes/Big\ Daddy \
  --output ~/Desktop/NEW_MASTER_merged_shows_2025-11-06_2113.csv \
  --checksums --drive-id
```

- Update the `/Volumes/...` path to match the drive you are scanning.  
- Always point `--output` to your **current master CSV** on the Desktop.

### 📀 Catalog the Untitled HD (uses /DVDs/)

```bash
python3 ~/Desktop/catalog_shows_v3_1.py /Volumes/Untitled/DVDs \
  --output ~/Desktop/NEW_MASTER_merged_shows_2025-11-06_2113.csv \
  --checksums --drive-id
```

- Required because the shows for this drive are under `/DVDs`.

### 🎞️ Generate Screenshots (per drive)

```bash
cd ~/Desktop
python3 test_screenshots_by_drive.py
```

Before running, open `test_screenshots_by_drive.py` and confirm:

```python
MASTER_CSV_PATH = Path("/Users/ko/Desktop/NEW_MASTER_merged_shows_2025-11-06_2113.csv")
DRIVE_FILTER = "BIG DADDY"   # or "UNTITLED", "SEAGATE", etc.
OUTPUT_DIR = Path("/Users/ko/Desktop/build/images")
```

- Outputs screenshots: `~/Desktop/build/images/`  
- Writes log report: `~/Desktop/screenshot_capture_report_YYYYMMDD_HHMMSS.csv`  
- Skips any screenshots that already exist (never overwrites).  

### 📷 Add Images to React Project

```bash
# Copy all screenshots to the public images folder
cp ~/Desktop/build/images/* /path/to/the-vault/public/images/
```

**CRITICAL:** Images must go in `/public/images/` (not `/dist/images/` or `/src/images/`)

### 🌐 Build React Website ("The Vault")

```bash
cd /path/to/the-vault

# First time only: Install dependencies
npm install

# Install Tailwind CSS PostCSS plugin (if not already installed)
npm install -D @tailwindcss/postcss

# Build the static site
npm run build
```

- **Prerequisites:** Requires Node.js and npm
- **PostCSS config:** Ensure `postcss.config.js` exists in the root directory
- **Outputs:** Static files to `/dist/` folder
- **Images:** Automatically copies `/public/images/` to `/dist/images/`
- **Shows data:** Reads from `/public/shows.json`

### 👀 Preview Site Locally

```bash
cd /path/to/the-vault
npm run preview
```

Then open in browser: **http://localhost:4173**

Or use development mode with hot reload:

```bash
npm run dev
```

Then open: **http://localhost:5173**

### 🚀 Deploy to Netlify

**Option 1: Drag and Drop**
1. Build the site: `npm run build`
2. Open Netlify in browser
3. Drag the `/dist` folder to Netlify's deploy zone

**Option 2: Netlify CLI**
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

### ✅ Quick Checklist Build / Review

View a small portion of the master CSV in Terminal:

```bash
head -n 20 ~/Desktop/NEW_MASTER_merged_shows_2025-11-06_2113.csv
```

Or open the CSV in **Excel** or **Numbers** and use it as a visual checklist.

---

## 8. Website Overview (React App)

| Component | Description |
|------------|-------------|
| **Framework** | React + TypeScript + Vite |
| **Styling** | Tailwind CSS v4 with custom dark theme |
| **Data Input** | Reads `/public/shows.json` (converted from master CSV) |
| **Images** | Stored in `/public/images/` and referenced as `/images/{filename}.jpg` |
| **Top Navigation** | Search bar, filters, and branding |
| **Left Sidebar** | A-Z artist navigation for quick access |
| **Main Content** | Horizontally scrollable rows of show cards grouped by artist |
| **Show Cards** | Display artist, date, venue, and thumbnail image |
| **Detail Drawer** | Right-hand slide-out drawer with full metadata, setlist, notes, and screenshots |
| **Responsive** | Works on desktop and mobile browsers |
| **Build Output** | Static HTML/CSS/JS in `/dist` folder |
| **Deployment** | Netlify static hosting (no backend required) |

### Key React Components

- **App.tsx** — Main application entry point
- **TopNav.tsx** — Top navigation bar with search
- **Sidebar.tsx** — A-Z artist navigation
- **ArtistRow.tsx** — Horizontal scrolling row of shows for one artist
- **ShowCard.tsx** — Individual show card with thumbnail
- **ShowDrawer.tsx** — Slide-out panel with show details
- **ImageLightbox.tsx** — Full-screen image viewer for screenshots

---

## 9. Environment Paths and Defaults

| Path | Purpose |
|-------|----------|
| `~/Desktop/catalog_shows_v3_1.py` | Primary drive scanning script |
| `~/Desktop/test_screenshots_by_drive.py` | Per-drive screenshot generator |
| `~/Desktop/NEW_MASTER_merged_shows_2025-11-06_2113.csv` | Current master metadata CSV |
| `~/Desktop/build/images/` | Central screenshot output folder from Python scripts |
| `/path/to/the-vault/` | React application root directory |
| `/path/to/the-vault/public/images/` | **Image source folder (PUT 800+ IMAGES HERE)** |
| `/path/to/the-vault/public/shows.json` | JSON data file consumed by React app |
| `/path/to/the-vault/dist/` | **Build output folder (UPLOAD THIS TO NETLIFY)** |
| `/path/to/the-vault/postcss.config.js` | PostCSS configuration for Tailwind CSS |
| `/Volumes/[DriveName]/` | Mounted HDDs (e.g. Big Daddy, Untitled/DVDs, Seagate) |

---

## 10. Troubleshooting

### "vite: command not found"

**Problem:** Node modules are not installed.

**Solution:**
```bash
cd /path/to/the-vault
npm install
```

### "Cannot find module '@tailwindcss/postcss'"

**Problem:** Tailwind CSS PostCSS plugin is not installed.

**Solution:**
```bash
npm install -D @tailwindcss/postcss
```

### Styles not appearing

**Problem:** PostCSS config is missing or build is stale.

**Solution:**
```bash
# Ensure postcss.config.js exists in root
# Then rebuild:
npm run build
npm run preview
```

### Images not showing

**Problem:** Images are in the wrong folder.

**Solution:**
- Images must be in `/public/images/` (not `/dist/images/` or `/src/images/`)
- Run `npm run build` to copy them to `/dist/images/`
- Check that `shows.json` references images as `"/images/filename.jpg"`

---

## 11. Future Roadmap (2026)

- 🧩 Add WebP image conversion to shrink screenshot sizes.  
- 🔄 Incremental re-scan of drives (only new/changed folders).  
- 🧾 Automated per-drive summary reports (PDF or CSV).  
- 🌐 Add sort options to the UI (by date, artist, drive, recording type, etc.).  
- 🔍 Enhanced search with fuzzy matching and advanced filters.
- 🧰 Unified CLI wrapper (`catalog`, `screenshot`, `build`) to simplify commands.  
- 🧠 AI-assisted setlist completion from incomplete notes or filenames.
- 📊 Analytics dashboard showing collection statistics.
- 🎨 Theme customization options (beyond dark/light mode).

---

## 12. Change Log (v2 → v3)

| Category | Change |
|-----------|---------|
| **Frontend Architecture** | Complete migration from Python-generated HTML to React + Vite + Tailwind CSS. |
| **UI/UX** | Netflix-style interface with top nav, A-Z sidebar, artist rows, and slide-out drawer. |
| **Build System** | Switched to npm/Vite workflow with `/dist` output folder. |
| **Styling** | Tailwind CSS v4 with PostCSS pipeline; dark theme by default. |
| **Screenshot Engine** | Updated to preserve original aspect ratio and only downscale when needed (max 1280px). |
| **Untitled Drive Handling** | Made explicit that `/Volumes/Untitled/DVDs` is the root scan path. |
| **Image Management** | Centralized in `/public/images/`; auto-copied to `/dist/images/` during build. |
| **Deployment** | Migrated from GitHub Pages to Netlify static hosting. |
| **Data Format** | Master CSV converted to JSON (`shows.json`) for React consumption. |
| **Safety** | Confirmed that `/public/images/` is never deleted or overwritten by builds. |
| **Docs** | Updated all commands and paths to reflect new React/Vite workflow. |

---

## 13. AI Reference Instructions (ChatGPT)

> This document summarizes Karl Olsen's **Show Catalog Automation** project as of **November 2025**.  

### For ChatGPT assisting with CSV creation/cleaning:

When helping to prepare the CSV file for this project, ensure:

1. **CSV Format:** Output matches the schema in Section 3 (Unified Data Schema)
2. **Required Fields:** At minimum include: `Artist`, `ShowDate`, `VenueName`, `City`, `Country`, `RecordingType`, `ChecksumSHA1`
3. **Image References:** If the CSV will be converted to JSON, ensure image filenames match the format: `{ChecksumSHA1}_01.jpg` through `{ChecksumSHA1}_04.jpg`
4. **Date Format:** Use ISO format (YYYY-MM-DD) for `ShowDate`
5. **Consistency:** Artist names should be consistent across all rows (e.g., don't mix "The Beatles" and "Beatles")
6. **Special Characters:** Properly escape commas and quotes in CSV fields

### For Claude (Figma Make) building the React UI:

When helping to build or modify "The Vault" React application:

1. **Project Setup:**
   - React + TypeScript + Vite
   - Tailwind CSS v4 (no version in imports)
   - Data source: `/public/shows.json`
   - Images: `/public/images/` (referenced as `/images/` in code)

2. **UI Requirements:**
   - Netflix-style dark theme
   - Top navigation with search
   - Left sidebar with A-Z artist navigation
   - Main content: horizontally scrollable artist rows
   - Right drawer: slide-out show details
   - Responsive design

3. **Build Process:**
   - `npm install` — Install dependencies
   - `npm run build` — Build to `/dist`
   - `npm run preview` — Preview at localhost:4173

4. **Important Rules:**
   - Never modify `/public/images/` contents
   - Build output goes to `/dist` (ready for Netlify)
   - PostCSS config must exist for Tailwind to work
   - All images go in `/public/images/` before build

---

📁 **File Name:**  
`ShowCatalog_Project_Summary_v3.md`

---

**Last Updated:** November 26, 2025  
**Project Name:** The Vault — Live Concert Archive Browser  
**Status:** Production Ready (awaiting final data and images)

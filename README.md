# The Vault — Concert Archive Browser

A Netflix-style web interface for browsing a private collection of live concert recordings. Built with React, TypeScript, and Vite. Deployed automatically to GitHub Pages on every push to `main`.

---

## Features

### Home Page
- **Curated Featured Rows**: Horizontal scrollable rows — "Shows Near You" (geo-personalised), "Top Artists", "Featured", and "Soundboard Recordings"
- **Geo-Location Row**: Silently detects your city/country via IP and surfaces matching shows at the top — no browser prompt, no API key required. Falls back to country-level if no city matches. Row is hidden if no shows match or the lookup fails
- **Horizontal Scroll Rows**: Each row has fade gradients and arrow controls that appear on hover
- **Quick-Search Pills**: One-click artist/decade filter buttons on the hero page
- **All Shows Button**: Ghost link next to pills — lists every show in the collection alphabetically by artist

### Search
- **Hero Search Bar**: Always-visible at the top; results replace the home page instantly as you type
- **Chronological Results**: Search results sorted newest-first; undated and compilation shows sorted to the end
- **Full-Text MiniSearch**: Prefix + fuzzy matching across all metadata fields with field boosts (Artist 4×, RecordingType 2×, Year 2×)
- **Field-Specific Filters**: Prefix any query with a field name:
  - `artist:pearl jam` `venue:house of blues` `city:london` `country:uk`
  - `type:soundboard` `song:black` `year:1994` `event:glastonbury` `drive:seagate`
- **Decade Keywords**: Type `nineties`, `90s`, `eighties`, `80s`, `seventies`, `2000s`, `00s` etc. to filter by decade
- **Compound Queries**: Combine decade + other terms — `nirvana nineties`, `soundboard 2000s`

### Show Cards
- **Context-Aware Metadata**: Home page shows Artist + Venue/Event; search results show Venue/Event instead of artist (artist is already in the search box)
- **Smart Location Line**: Prioritises `EventOrFestival` → `VenueName` → `City, Country` — one line, no redundancy
- **Hover Overlay**: Recording type badge (black, bottom-right corner) + duration + artist name in search mode
- **Lazy Image Loading**: Thumbnails load progressively with artist-coloured placeholders

### Show Detail
- **Slide-Out Drawer**: Full metadata panel — technical specs, setlist, lineage, source equipment, drive reference
- **Image Lightbox**: Full-screen image viewer with keyboard navigation (arrow keys, ESC)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS v4 |
| Animations | Framer Motion (`motion/react`) |
| Icons | Lucide React |
| Search | MiniSearch |
| Geo-location | ipapi.co (no API key, cached in `sessionStorage`) |
| Deployment | GitHub Pages via GitHub Actions |

---

## Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/karl0s/digital-vault.git
cd digital-vault
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```

Opens at `http://localhost:5173/digital-vault/` with hot module reloading.

### 4. Build for Production
```bash
npm run build
```

Outputs optimised static files to `/dist/`. Not needed for deployment — GitHub Actions handles the build automatically on push. **Do not commit `/dist/`** — it is gitignored and CI-owned.

---

## Deployment

Deployment is fully automated via **GitHub Actions**. There are no manual steps.

- **Trigger**: Any push to `main`
- **Process**: GitHub Actions checks out the repo, runs `npm install` + `npm run build`, and deploys `/dist/` to GitHub Pages
- **Live URL**: `https://karl0s.github.io/digital-vault/`
- **Build time**: ~2 minutes from push to live
- **Config**: `.github/workflows/deploy.yml`

To deploy: commit your changes and `git push origin main`. That's it.

---

## Data Format

`public/shows.json` is a **flat JSON array** of show objects (not wrapped in any outer object):

```json
[
  {
    "ShowID": "unique-id-12345",
    "Artist": "Smashing Pumpkins",
    "ShowDate": "1995-10-23",
    "EventOrFestival": "Mellon Collie Tour",
    "VenueName": "Chicago Theatre",
    "City": "Chicago",
    "Country": "United States",
    "RecordingType": "Proshot",
    "Generation": "Master",
    "Lineage": "Broadcast > VHS > DVD > encode",
    "SourceEquipment": "Professional broadcast camera",
    "FolderName": "SP_19951023_Chicago",
    "FolderPath": "/Volumes/Big Daddy/Concerts/SP_19951023_Chicago",
    "MasterDriveName": "Big Daddy",
    "RepVideoFiles": "SP_19951023_01.vob; SP_19951023_02.vob",
    "Container": ".vob",
    "VideoCodec": "mpeg2video",
    "Width": "720",
    "Height": "576",
    "DurationSec": "5400",
    "AspectRatio": "4:3 (native)",
    "TVStandard": "PAL",
    "AudioCodec": "ac3",
    "AudioChannels": "2",
    "AudioSampleRate": "48000",
    "FileCount": "4",
    "TotalSizeHuman": "4.2 GB",
    "ChecksumSHA1": "abc123def456...",
    "Setlist": "Rhinoceros; Soma; Bullet with Butterfly Wings; Tonight Tonight",
    "Notes": "Excellent broadcast quality. Sourced from BBC2 transmission."
  }
]
```

### Key Field Notes

| Field | Notes |
|-------|-------|
| `ShowDate` | Format `YYYY-MM-DD`. Year-only dates stored as `YYYY-01-01`. Undated shows (compilations, TV-only, documentaries) use empty string `""` — they sort to the end of all result lists |
| `ChecksumSHA1` | Links to thumbnail images — `public/images/{ChecksumSHA1}_01.jpg` through `_04.jpg` |
| `EventOrFestival` | Takes display priority over `VenueName` on cards. Use for festivals, TV appearances, documentaries |
| `VenueName` | Used when no event/festival applies — e.g. "Madison Square Gardens", "House of Blues" |
| `RecordingType` | Shown as a black badge (bottom-right of card on hover) — `Soundboard`, `Audience`, `Proshot` |
| `Setlist` | Semicolon-separated song titles; rendered as a numbered list in the drawer |
| `DurationSec` | Integer seconds; auto-formatted as `2h 15m` in the UI |

### Thumbnail Images

Images live flat in `public/images/` and follow this naming convention:

```
public/images/{ChecksumSHA1}_01.jpg   ← primary thumbnail
public/images/{ChecksumSHA1}_02.jpg
public/images/{ChecksumSHA1}_03.jpg
public/images/{ChecksumSHA1}_04.jpg
```

The `_01.jpg` image is used as the card thumbnail. All four are prefetched on card hover for the drawer lightbox.

---

## Search Guide

| Query | What it does |
|-------|-------------|
| `pearl jam` | Full-text search across all fields |
| `artist:pearl jam` | Artist field only |
| `venue:house of blues` | Venue field only |
| `city:london` | City field only |
| `country:uk` | Country field only |
| `type:soundboard` | Recording type filter |
| `song:black` | Setlist search |
| `year:1994` | Year filter |
| `event:glastonbury` | Festival/event filter |
| `drive:seagate` | Master drive filter |
| `codec:mpeg2` | Video codec filter |
| `nineties` or `90s` | All shows from 1990–1999 |
| `eighties` or `80s` | All shows from 1980–1989 |
| `seventies` or `70s` | All shows from 1970–1979 |
| `2000s` or `00s` | All shows from 2000–2009 |
| `2010s` or `10s` | All shows from 2010–2019 |
| `nirvana nineties` | Nirvana shows from the 90s |
| `soundboard 2000s` | Soundboard recordings from 2000–2009 |

---

## Key Files

### Components

| File | Purpose |
|------|---------|
| `App.tsx` | Root component — data loading, state, mode switching (home / search) |
| `components/FeaturedRows.tsx` | Home page — geo row + curated horizontal scroll rows |
| `components/HeroSearch.tsx` | Top search input |
| `components/TopNav.tsx` | Navigation bar |
| `components/ShowCard.tsx` | Individual show card — renders differently in home vs search mode |
| `components/SearchResultsGrid.tsx` | Search results layout and header |
| `components/ShowDrawer.tsx` | Slide-out detail panel |
| `components/ArtistRow.tsx` | Single horizontal scrollable row of show cards |
| `components/Sidebar.tsx` | Artist navigation sidebar |
| `components/ImageLightbox.tsx` | Full-screen image viewer |
| `components/LazyImage.tsx` | Lazy-loading image with colour placeholder |
| `components/ImageWithFallback.tsx` | Image component with automatic fallback on load error |

### Hooks

| File | Purpose |
|------|---------|
| `src/hooks/useSearchEngine.ts` | Builds and configures the MiniSearch index |
| `src/hooks/useSearchAndFilter.ts` | All filter logic — field-specific, decade keywords, general search |
| `src/hooks/useGeoLocation.ts` | Silent IP geolocation via ipapi.co with sessionStorage cache |
| `src/hooks/useShows.ts` | Fetches and parses `shows.json` |
| `src/hooks/useDebounce.ts` | Debounces the search input |
| `src/hooks/useKeyboardNavigation.ts` | Keyboard navigation for drawer and lightbox |
| `src/hooks/useScrollSpy.ts` | Tracks scroll position for the sidebar |

### Scripts & Config

| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite build config — `base` set to `/digital-vault/` for GitHub Pages |
| `tsconfig.json` | TypeScript configuration |
| `.github/workflows/deploy.yml` | GitHub Actions CI/CD — builds and deploys on push to `main` |
| `scripts/health-check.py` | Integrity validator — checks shows, images, manifest, dates, temp stubs. Runs automatically as a pre-push git hook. Errors block push; warnings are informational |
| `scripts/enrich-metadata.py` | Metadata enrichment agent — uses Claude claude-sonnet-4-6 + web search to find exact dates, venues and locations for shows with placeholder metadata. See CLAUDE.md for setup and usage |
| `CLAUDE.md` | Full project guide for Claude — conventions, data model, workflows, hard rules |

---

## Troubleshooting

**Images not loading?**
- Confirm `ChecksumSHA1` is present in `shows.json`
- Check images exist at `public/images/{ChecksumSHA1}_01.jpg`
- Check DevTools → Network tab for 404 errors

**Shows not appearing?**
- Confirm `shows.json` is a flat array — not `{"items": [...]}` or any other wrapper
- Check browser console (F12) for JSON parse errors
- Ensure every record has `ShowID` and `Artist`

**"Shows Near You" row not appearing?**
- The row only shows if ≥3 shows match your city or country
- Check DevTools → Application → Session Storage for the `vault_geo` key
- Some ad blockers block ipapi.co — the row simply won't appear in that case, which is expected

**Deployment not updating after a push?**
- Check the Actions tab in the GitHub repo for build status and logs
- GitHub Pages CDN can take 1–2 minutes after a successful deploy

---

## License

Personal archive browser. Ensure you have rights to any content you catalogue.

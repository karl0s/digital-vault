# The Vault — Current Architecture

*Documented: 2026-04-30. Branch: feature/search-ui (pre-migration baseline)*

---

## Stack

| Layer | Technology |
|---|---|
| UI Framework | React 18 + TypeScript (strict) |
| Build | Vite 6, base path `/digital-vault/` |
| Styling | Tailwind CSS v4 + PostCSS |
| Animations | Framer Motion (motion/react v12) |
| Icons | Lucide React |
| Deployment | GitHub Actions → GitHub Pages (auto on push to main) |

---

## Directory Structure

```
the-vault/
├── App.tsx                        # Root component — state orchestration
├── main.tsx                       # React entry point
├── index.html                     # HTML template
├── vite.config.ts                 # base: '/digital-vault/'
├── components/
│   ├── ArtistRow.tsx              # Horizontal scroll row per artist
│   ├── ShowCard.tsx               # Individual show thumbnail card
│   ├── ShowDrawer.tsx             # Right/bottom detail panel
│   ├── TopNav.tsx                 # Search bar + mobile menu
│   ├── Sidebar.tsx                # Fixed A-Z sidebar (desktop only)
│   ├── LazyImage.tsx              # IntersectionObserver lazy loading
│   ├── ImageLightbox.tsx          # Full-screen image viewer
│   └── hooks/useLazyImage.ts      # Image load hook
├── src/
│   ├── data/sampleShows.ts        # Fallback demo data (8 shows)
│   └── hooks/
│       ├── useShows.ts            # Load shows.json + image URL resolution
│       ├── useSearchAndFilter.ts  # Filter shows + group by artist
│       ├── useKeyboardNavigation.ts
│       └── useScrollSpy.ts        # Track viewport artist for sidebar
├── public/
│   ├── shows.json                 # ~3,000 shows, 1.75 MB
│   └── images/                   # {checksum}_0{1-4}.jpg thumbnails
└── .github/workflows/deploy.yml   # CI/CD pipeline
```

---

## Data Model

Primary source: `public/shows.json` — array of Show objects (~3,000 entries, 1.75 MB).

```typescript
interface Show {
  ShowID: string;           // Unique hex ID (12 chars)
  Artist: string;
  ShowDate: string;         // YYYY-MM-DD (can be empty)
  VenueName: string;
  City: string;
  Country: string;
  RecordingType?: string;   // e.g. "Soundboard", "Audience"
  Setlist: string;          // Songs separated by semicolons
  ChecksumSHA1?: string;    // Used as image key: {checksum}_0{1-4}.jpg
  DurationSec: string;
  VideoCodec: string;
  Width: string; Height: string;
  AspectRatio?: string;     // "16:9 (native)" | "4:3 (native)"
  TVStandard?: string;      // "PAL" | "NTSC"
  AudioCodec?: string;
  TotalSizeHuman: string;
  Notes: string;
  ImageCount?: number;
  MasterDriveName: string;
  // ... additional metadata fields
}
```

Shows.json supports two formats: plain array `Show[]` or `{ items: Show[] }`.

---

## Data Flow

```
shows.json (fetch on mount)
    └─ useShows()
          ├─ Parse: array OR { items: [...] }
          ├─ Fallback: sampleShows.ts if fetch fails
          └─ getImageUrl(checksum, index) → base + images/{checksum}_0{index}.jpg

useSearchAndFilter(shows, searchQuery)
    ├─ Filter: string matching (general OR field:value syntax)
    │   Fields: artist, type, country, city, venue, event, song, year, drive, codec
    ├─ Group: by Artist → Record<string, Show[]>
    └─ Sort: artists A-Z

App.tsx state
    ├─ searchQuery: string
    ├─ selectedShow: Show | null (controls drawer)
    └─ lightboxImage: string | null

Render tree
    TopNav → search input → setSearchQuery
    Sidebar → letter click → scrollIntoView
    ArtistRow[] → ShowCard[] → onClick → setSelectedShow
    ShowDrawer → detail panel → ImageLightbox
```

---

## Search (pre-migration)

Simple string `includes()` matching across:
- Artist, VenueName, City, Country, ShowDate, EventOrFestival, RecordingType, Setlist, Notes

Field-specific syntax supported: `artist:pearl jam`, `type:soundboard`, `year:1999`, etc.

No fuzzy matching. No prefix search. No relevance ranking.

---

## Navigation Model

**Primary (pre-migration):** A-Z alphabetical browse
- Desktop: Fixed sidebar with letter buttons, hover dropdown lists artists
- Mobile: Hamburger menu → alphabet grid

**Secondary:** Search bar (top center, always visible)

**Keyboard:** Arrow keys navigate rows/cards; Enter opens drawer; Escape closes drawer

**ScrollSpy:** `useScrollSpy` tracks which artist is in viewport → highlights sidebar letter

---

## Image Architecture

- Location: `public/images/{checksum}_0{1-4}.jpg`
- Card thumbnail: `_01.jpg` (loaded lazily via IntersectionObserver, 400px threshold)
- Drawer gallery: `_01` through `_04` (prefetched on hover/click)
- Fallback: color-coded placeholder with artist initials

---

## Deployment

- `git push main` → GitHub Actions runs `npm run build` → uploads `/dist/` to GitHub Pages
- Live: `https://karl0s.github.io/digital-vault/`
- No staging environment; direct main-branch deploy

# The Vault - Concert Archive Browser

A Netflix-style web interface for browsing private collection of live concert recordings. Built with React, TypeScript, and Vite for fast development and optimized static hosting.

## Features

- **Netflix-Style Dark UI**: Polished, responsive interface with smooth animations and blur effects
- **Artist Grouping**: Shows organized by artist in horizontal scrollable rows
- **A-Z Navigation**: Quick-jump sidebar to navigate by artist name
- **Real-Time Search**: Filter shows by artist, venue, city, country, date, recording type, setlist, or notes
- **Detailed Drawer**: Right-hand slide-out panel with comprehensive metadata, technical specs, and source information
- **Image Lightbox**: Full-screen image viewer with keyboard navigation (arrow keys, ESC to close)
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Aspect Ratio Detection**: Automatically detects and renders 16:9 and 4:3 screenshots at correct aspect ratios
- **Backdrop Blur**: Netflix-style blurred background when drawer is open

## Tech Stack

- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion (motion/react)
- **Icons**: Lucide React
- **Image Loading**: Lazy image loading with placeholder support

## Installation & Setup

### 1. Clone the Repository
```bash
git clone <repo-url>
cd /Users/ko/Desktop/Projects/the-vault
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Add Your Data
Place your `shows.json` file in the `/public` directory:
```
/public/shows.json
```

See **Data Format** section below for structure requirements.

### 4. (Optional) Add Screenshot Images
If using the Python data pipeline to generate screenshots and metadata, place generated images in:
```
/public/images/
```

Images should be named: `{ChecksumSHA1}_01.jpg`, `{ChecksumSHA1}_02.jpg`, etc.

### 5. Run Development Server
```bash
npm run dev
```

This starts a local Vite dev server (typically `http://localhost:5173`) with hot module reloading. Your changes will reflect instantly in the browser.

### 6. Build for Production
```bash
npm run build
```

Outputs optimized static files to `/dist/` ready for deployment.

### 7. Git Workflow

**Make your changes, then commit and push:**

```bash
# Check status
git status

# Stage changes
git add .

# Commit with descriptive message
git commit -m "feat: Add aspect ratio detection for 16:9 shows"

# Push to remote
git push origin main
```

## Data Pipeline & Workflow

The `shows.json` file is the foundation of this application. Here's the complete workflow to create it:

### Step 1: Gather Show Metadata
Use MediaInfo (or similar) to extract technical details from your video files:
- Dimensions (width, height)
- Duration
- Codec information
- Aspect ratio (16:9 native, 4:3 native, 4:3 letterboxed 16:9, etc.)
- Audio specs

Store this metadata in a structured format (CSV, JSON, or database).

### Step 2: Generate Screenshots
Use the Python data pipeline in `/data-pipeline/` to:
1. Extract 4 screenshots from each video file
2. Generate consistent aspect ratio images
3. Create checksums (SHA1) for image organization

**Python Pipeline Files:**
- `data-pipeline/generate_screenshots.py` - Extracts frames from videos
- `data-pipeline/generate_metadata.py` - Collates technical metadata

Run the pipeline:
```bash
cd data-pipeline
python generate_screenshots.py --input /path/to/videos
python generate_metadata.py --input /path/to/metadata.csv
```

This outputs:
- Screenshot images (saved to `/public/images/`)
- Metadata JSON ready to merge

### Step 3: Assemble shows.json
Combine all metadata into a single `shows.json` file with the structure below.

### Step 4: Validate & Test
1. Place `shows.json` in `/public/`
2. Run `npm run dev`
3. Check browser DevTools Console for any data loading errors
4. Verify shows appear, search works, and images load

## Data Format

Place your `shows.json` file in the `/public` directory. The application expects the following structure:

```json
{
  "generated_at": "2025-12-08",
  "items": [
    {
      "ShowID": "unique-id-12345",
      "Artist": "Smashing Pumpkins",
      "ShowDate": "2000-05-23",
      "EventOrFestival": "Universal City Festival",
      "VenueName": "Universal Amphitheater",
      "City": "Los Angeles",
      "Country": "US",
      "RecordingType": "Proshot",
      "Generation": "1st Gen",
      "Lineage": "Source chain description",
      "SourceEquipment": "Professional broadcast equipment",
      "FolderName": "SP_20000523_LA",
      "FolderPath": "/Volumes/Archive/Concerts/SP_20000523_LA",
      "MasterDriveName": "Archive_Drive_001",
      "RepVideoFiles": "SP_20000523_LA_01.m2ts; SP_20000523_LA_02.m2ts",
      "Container": ".m2ts",
      "VideoCodec": "mpeg2video",
      "Width": "1920",
      "Height": "1080",
      "DurationSec": "7200",
      "AspectRatio": "16:9 (native)",
      "TVStandard": "NTSC",
      "AudioCodec": "ac3",
      "AudioChannels": "2",
      "AudioSampleRate": "48000",
      "FileCount": "2",
      "TotalSizeHuman": "8.5 GB",
      "ChecksumSHA1": "abc123def456...",
      "Setlist": "Cherub Rock; Quiet; Bullet with Butterfly Wings; Tonight Tonight; The End is the Beginning is the End",
      "Notes": "Excellent quality proshot from the Pumpkins' 2000 reunion tour"
    }
  ]
}
```

### Required Fields
- `ShowID`, `Artist`, `MasterDriveName`, `FolderPath`, `VideoCodec`, `Width`, `Height`, `Container`, `FileCount`, `TotalSizeHuman`, `ChecksumSHA1`

### Optional Fields
- `ShowDate`, `EventOrFestival`, `RecordingType`, `Generation`, `SourceEquipment`, `AspectRatio`, `TVStandard`, `AudioCodec`, `AudioChannels`, `AudioSampleRate`, `Setlist`, `Notes`

### Notes on Data
- **AspectRatio**: Examples: `"16:9 (native)"`, `"4:3 (native)"`, `"4:3 (letterboxed 16:9)"` — used to render screenshots at correct aspect ratio
- **ChecksumSHA1**: Unique identifier; matches image filenames (`{ChecksumSHA1}_01.jpg`, `{ChecksumSHA1}_02.jpg`, etc.)
- **ShowDate**: Format `YYYY-MM-DD`; can be empty for unknown dates
- **DurationSec**: Duration in seconds; automatically formatted as hours/minutes in UI
- **Setlist**: Semicolon-separated list of songs; rendered as numbered list in drawer

## Key Files to Customize

### Components
- **`/components/ShowCard.tsx`** - Individual show card component; edit to change card layout, aspect ratio handling, hover effects
- **`/components/ShowDrawer.tsx`** - Detail panel that slides in from the right; edit to change drawer layout, metadata display, or add new sections
- **`/components/ArtistRow.tsx`** - Horizontal scrollable row of shows per artist; edit to change row layout or scrolling behavior
- **`/components/SearchBar.tsx`** - Search input and filtering logic; edit to add new search fields or change filter behavior
- **`/components/LazyImage.tsx`** - Lazy-loading image component with placeholders; edit for custom image loading or caching

### Styling & Theme
- **`/src/globals.css`** - Global Tailwind utilities and custom CSS; edit overlay darkness (`rgba(0, 0, 0, 0.7)`), backdrop blur strength (`blur(8px)`), or transition timings
- **`/src/index.css`** - Additional global styles and animation definitions
- **`tailwind.config.ts`** - Tailwind configuration; add custom colors, spacing, or breakpoints

### Data & Logic
- **`/src/App.tsx`** - Main app component; handles data loading, artist grouping, and state management
- **`/src/index.tsx`** - Entry point and React DOM rendering
- **`/public/shows.json`** - Your show data (create this file)

### Configuration
- **`vite.config.ts`** - Vite build settings
- **`tsconfig.json`** - TypeScript configuration
- **`tailwind.config.ts`** - Tailwind CSS theme customization

## Customization Guide

### Change Overlay Darkness & Blur
Edit `/src/globals.css`:
```css
.bg-black\/60,
.overlay-backdrop {
  background-color: rgba(0, 0, 0, 0.7); /* Adjust alpha: 0.3–0.9 */
  backdrop-filter: blur(8px); /* Adjust blur: 4px–12px */
}
```

### Change Card Styling
Edit `/components/ShowCard.tsx`:
- Card width: `w-full md:w-64 md:sm:w-72 ...` classes
- Border radius: `rounded-lg` class
- Shadow effects: `shadow-2xl` class
- Hover scale: `md:scale-105` on hover state

### Change Color Scheme
Edit `/src/globals.css` or `tailwind.config.ts`:
- Background: `bg-black`, `bg-[#141414]`
- Accent (Netflix red): `bg-[#E50914]`
- Text: `text-white`, `text-gray-300`, `text-gray-400`

### Add New Show Metadata Fields
1. Update `/src/App.tsx` types to include new field
2. Add field to your `shows.json` structure
3. Display in `/components/ShowDrawer.tsx` by adding new section

## Deployment

### GitHub Pages / Static Hosting
1. Build the project: `npm run build`
2. Deploy the `/dist/` folder to your static host
3. Ensure `/public/shows.json` is copied to the deployment

### Vercel / Netlify
1. Connect your git repo
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Ensure `public/shows.json` is included in deployment

## Browser Support

- Modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- Mobile browsers (iOS Safari 14+, Chrome Mobile)
- Requires JavaScript enabled

## Troubleshooting

**Images not loading?**
- Confirm `ChecksumSHA1` field is present in shows.json
- Verify images exist at `/public/images/{ChecksumSHA1}_01.jpg`, etc.
- Check browser DevTools Network tab for 404 errors

**Shows not appearing?**
- Validate `shows.json` syntax (use JSONLint)
- Ensure required fields are present: `ShowID`, `Artist`, `MasterDriveName`, `FolderPath`, `VideoCodec`, `Width`, `Height`, `Container`, `FileCount`, `TotalSizeHuman`, `ChecksumSHA1`
- Check browser console (F12) for parsing errors

**Slow performance?**
- Lazy image loading is enabled by default
- Consider reducing number of shows or using a CDN for images
- Check DevTools Performance tab for bottlenecks

## Tips for Best Results

1. **Image Quality**: Screenshots should be at least 800px wide for crisp card display
2. **Aspect Ratio**: Ensure accurate `AspectRatio` values so images render correctly
3. **Show Dates**: Accurate `ShowDate` values enable sorting and filtering
4. **Setlist Format**: Use semicolons to separate songs (e.g., `"Song 1; Song 2; Song 3"`)
5. **Technical Notes**: Include MediaInfo or equipment details in `Notes` field for reference
6. **File Organization**: Keep folder paths consistent and accessible for archival reference

## License

This is a personal archive browser. Ensure you have rights to any content you catalog.

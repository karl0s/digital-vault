# The Vault

A browser for a private archive of live concert video: around twelve hundred recordings —
festival sets, TV appearances, pro-shot and audience tapes, documentaries — each with its
date, venue, setlist, technical details and up to four stills taken from the footage. Browse
the whole collection, narrow it by year, country, event, quality, PAL/NTSC, length or setlist,
search by artist, song, venue or date (any format; abbreviations like RATM and terms like "hd" or
"pal" too) — results grouped into artists, shows and songs, with a "Did you mean" for a misspelt
name — or work through the A–Z artist directory. Copies of one show are compared side by side
(source and broadcaster, frame rate, bitrate, size);
results switch to a dense list and download as a spreadsheet (CSV); every show has a link of its
own that previews it when pasted; recent additions are marked. It is built for video traders
(`docs/ux-research/`). There is no backend: the site is static and all show data is one JSON file.

**Live:** https://karl0s.github.io/digital-vault/

## Tech stack

React 18 + TypeScript · Vite 6 · Tailwind CSS v4 · `motion` (animation) · zustand (filter
state, synced to the URL) · base-ui (popovers) · MiniSearch (search) · sharp (card thumbnails,
built at deploy time).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173/digital-vault/
```

UI experiments live in `_playground/` and are served at `/playground` by `npm run dev` only —
they are never part of a build.

## Build and check

```bash
npm run build                     # static site in dist/ (never committed)
npm run check                     # type-check, performance guard rails, URL/facet/store/brush/search/show-page tests
npm run perf                      # times Browse and the show drawer in headless Chromium
python3 scripts/health-check.py   # data integrity: dates, images, manifest, setlists, artist names, added dates, no taper names
```

## Deploy

Push to `main`. GitHub Actions (`.github/workflows/deploy.yml`) runs the health check and
`npm run check`, then builds and publishes `dist/` to GitHub Pages. If a check fails nothing
is deployed and the live site keeps the previous version.

## Data

`public/shows.json` is the source of truth: a flat, hand-curated array of show records.
Stills live in `public/images/` as `{ChecksumSHA1}_01.jpg` … `_04.jpg`, listed in
`public/image-manifest.json`. The build derives what the site actually loads — a trimmed show
list, the notes separately, 640px WebP card thumbnails, and a page per show for link previews —
so none of that is edited by hand.

See [`CLAUDE.md`](CLAUDE.md) for conventions, the data model and architecture.

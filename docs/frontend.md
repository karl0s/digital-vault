# Front-end architecture and UI patterns

How the site is put together, and the patterns a UI change must keep. Read this before changing
anything in `components/`, `App.tsx`, `src/` or `styles/`. The performance rules and the checks
every change must pass are in `CLAUDE.md` (Front-end performance, Checks).

---

## Breakpoints

Defined once, in `styles/globals.css` (`@theme`): Tailwind's defaults minus `sm`, plus `3xl`. Use
only these prefixes, and test a layout change at each tier's size.

| Tier | Prefix | From | Test at | Typical screens |
|---|---|---|---|---|
| Phone | (none) | 0 | 390 × 844 | phones, portrait and landscape |
| Tablet | `md:` | 768px | 820 × 1180 | iPad portrait, narrow windows |
| Small laptop | `lg:` | 1024px | 1180 × 820 | iPad landscape, small laptops |
| Laptop | `xl:` | 1280px | 1440 × 900 | 13–14" laptops |
| Desktop | `2xl:` | 1536px | 1728 × 1117 | 15–16" laptops |
| Large desktop | `3xl:` | 1920px | 2560 × 1440 | 24–27" monitors |

`md` is the phone/desktop switch (tab bar, drawer direction). `sm` is removed: nothing used
it, and the phone layout runs to 767px. JavaScript mirrors `md` in one place, `ShowDrawer`'s
`matchMedia('(min-width: 768px)')`; keep the two in step.

---

## Browse architecture

Design reasoning, and where the build departs from it: `docs/browse-redesign-spec.md`. What a
change must not break:

**One page** (owner, 2026-10-13). No sidebar, no top bar, no Artists destination, no type filter.
`App.tsx` renders: the `HeroSearch` masthead (collapses to zero height while anything filters), the
sticky `FilterBar`, then — while nothing filters — `FeaturedRows` and `ArtistDirectory` (every
artist A–Z in CSS columns under a small "All artists" label with the count, no page title or letter rail).
Filtering replaces both: a query renders `SearchResultsGrid` (title, Found N, Clear search, the song hint); facets alone render `ShowGrid`. A failed
load renders one error state.

**Width.** Every block uses `CONTENT_WIDTH` (`src/lib/layout.ts`): the width the content had beside
the old 256px sidebar, centred — from lg `min(1924px, 100vw − 16rem)`, full width below lg. The bar,
Featured shows, the artist list and results share one left edge at every size.

**Shell** (`components/shell/`). `AppShell` = `<main>` + `MobileTabBar` (below md, padded by
`env(safe-area-inset-bottom)`; `<main>` carries `pb-20` to clear it). The tab bar's three items are
jumps on the page: Browse (clear filters, top), Artists (the artist list, lit while it is on
screen), Search (focuses the bar's field inside the tap).

**The artist list.** The Artists tab, **All artists** on an artist's results and an old
`?view=artists` link all call App's `goToDirectory` (the bar's own All artists jump went, owner
2026-10-13): clear every filter, open the masthead
without animating (`HeroSearch instant`, or its 0.28s growth moves the list mid-scroll), then scroll
to the list measured against the bar's height at that moment (the bar loses its count row in the
same render). Picking an artist runs the exact-artist facet and writes the store at once, not after
the search debounce. `directoryInView` (read on scroll, re-rendering only when it flips) lights the
Artists tab.

**State** (`src/store/filters.ts`, zustand): `q, from, to, undated, country, festival, sort`. Read
the whole state only as `useFilterStore(useShallow(selectFilterState))` — without `useShallow`,
zustand v5 re-renders until React throws ("getSnapshot should be cached"). Single fields take plain
selectors. The search input is local to App; only its debounced value (150 ms) reaches the store.

**URL** (`src/lib/url.ts`) is the store's canonical serialisation: keys in the fixed order above;
facet values slugified, de-duplicated and sorted; defaults (`sort=year-desc`, `undated` off) and
empty values omitted. Query params on the root path, never path segments (GitHub Pages has no SPA
fallback). Every change `replaceState`s. `initFilterUrlSync` (once, in App) rehydrates on popstate.
Every filter write passes through `commitFilterState` — the one seam reserved for analytics. The
retired `view` and `type` params are dropped on parse; `view=artists` is honoured once by App.

**Pipeline** (`src/hooks/useBrowseResults.ts`): text query → MiniSearch id set → facets → sort,
all synchronous `useMemo`s.

**Search** (`src/search/searchIndex.ts`, owner 2026-10-13). An exact artist name opens the artist
view; `field:` prefixes filter one field; anything else is free text, and its results come back
**grouped by why they matched** (`searchShows` → `groups` in the hook): **artist** (the query
starts words of the name: "stone" → Stone Temple Pilots, Rolling Stones; from two letters), **show**
(date, venue, city, country, event, recording type), **song** (only the setlist matched; the card
names the song, matched letters lit). Content words match literally — **no fuzzy matching**
("stone" found "stole"); only the last word, from four letters, is a prefix. Typos are offered,
never run: when nothing matches, a **Did you mean** names artists a typo away (edit distance with
swapped letters, `suggestArtists`), or failing that the query with a misspelt place or event
corrected (`suggestQuery`). `npm run check:search` holds golden cases for all of it. `src/search/facets.ts` counts each facet against every *other* active
filter, so an option's count is what selecting it yields; zero-count options are disabled, never
hidden. An empty `Country` or `EventOrFestival` becomes the `NONE` sentinel (`'none'`, "Unknown
location" / "No event"). Undated records sort last both ways and are excluded from a year range
unless `undated=1`.

**Controls** (`components/filters/`). `FilterBar` (`sticky top-0`, `data-filter-bar`): the search
field (a pill like the controls beside it; `text-base` below md), then Years, Country and Event —
one row from lg, the search on its own
line below it, the controls scrolling sideways on a phone. Then removable chips and Clear all while
anything is set, and — only while filtering — the result count and sort; the count's `aria-live`
region is always mounted (visually hidden), since one inside a `display:none` row is silent.
`FacetPopover` is a base-ui `Popover` — its `z-50` belongs on the `Positioner`; a text filter
appears above 15 options. `minTotal` leaves out options with fewer shows in the whole collection
(`listedOptions` in `facets.ts`; a selected one stays): Country and Event list only values with 6+
shows (owner, 2026-10-13), and search still finds the rest by name. Event is the `festival` facet
relabelled (most of it is TV programmes); its URL key stays `festival`. `EVENT_GROUPS`
(`src/lib/url.ts`) folds names that are one event into one option — Reading Festival, Leeds Festival
and Reading and Leeds Festival are "Reading & Leeds" (owner, 2026-10-13) — while each record, the
drawer and search keep the record's own name; an old link to a folded name lands on the group. `YearRangePopover`: decade chips (decades with 5+ records), the
`YearHistogram` brush, From/To inputs (the keyboard and screen-reader path) and "Include undated".
Brush maths is pure, in `src/lib/brush.ts`; the store is written on pointer-up only.

**Grids.** `GRID_COLS` (exported by `FeaturedRows.tsx`) is the one column set for every grid:
2 → md 4 → lg 5 → xl 6, six at most (owner, 2026-10-15), with a 14px row gap since a card carries no
caption below it. `ShowGrid` is memoised and deliberately unanimated;
`SearchResultsGrid` has its own header and the "N more shows feature a song called …" suggestion;
for free text it renders the groups in order — **Artists** as tiles (round portrait, name, count,
chevron; each spans two `GRID_TRACKS` columns so its edges meet the cards'; six, then Show all),
then **Shows** and **Songs** as card grids — or the Did you mean. A tile's portrait is the owner's
pick in `ARTIST_PORTRAITS` (`src/lib/portraits.ts`), else the newest show's slot 1, whatever the
filters or sort; picks are made on `tools/artist-portraits/build.py`'s page and pasted back. Under
the title, the count and a **Clear search** pill (`bg-white/10`, 32px tall — a standalone control,
so WCAG 2.5.8's 24px target applies; an artist opened from the list reads **All artists** with a
back chevron instead). It is the results' one way out; the empty state only suggests what to try.
`ArtistDirectory` is memoised; its `columns-[240px]` keeps every name untruncated. Its hierarchy
(owner, 2026-10-13): letters in Bebas Neue 36px (`--font-display`); names on the letter's edge, the
row's hover fill bleeding 12px past it (`-mx-3`); rows 32px from md, 36px on a phone; show counts
at `text-white/17`, back to `gray-400` on the row's hover or focus. Tried and dropped: thumbnails per
row, fading the other letters on hover, white names for 5+ show artists.

---

## UI patterns

### Show card (ShowCard)
"Cinematic" (owner, 2026-10-15; designed as direction 02 on
`~/VaultShots/reports/show-card-directions.html`). The 4:3 still is the card (`rounded-[10px]`):
- On a bottom gradient (`from-black/90 via-black/55 via-30% to-transparent to-62%`): the title,
  then `event · year`. The title is the artist, or on an artist's page (`searchMode="artist"`) the
  event, since the artist is the same on every card. In the line under it the name truncates and the
  year never does; undated reads "Undated".
- Top-right: the length (`1h 42m`, `24 min`). Top-left: a badge only when the record is not a plain
  live show: Documentary (`ContentType`) or Excerpt (`ParentShowID`). How it was filmed gets none:
  Pro-shot, Audience and HD badges were dropped (owner, 2026-10-15).
- A song match in search (`songHits`) adds a ♪ line under the title, matched letters lit, and the
  gradient reaches higher (`to-72%`).
- Hover and keyboard focus crossfade to the show's second still (in 200ms, out 300ms, ease-out, so it
  starts at once); the text never moves. The second still is slot 2's build WebP (the original if the
  WebP is missing): it mounts on the first hover or focus, alone and at high priority, and the drawer's
  prefetch of the four originals follows once it has loaded (or after 300ms), at low priority. Its
  hover class applies only once loaded (two frames later, so a cached still still fades rather than
  snapping). On a mouse device `src/lib/hoverPreload.ts` has usually fetched it already from the
  card's `data-hover-src` — the cards on screen, once scrolling rests — so the first hover finds it in
  the cache: first visible ~70ms, fully shown at the end of the 200ms fade (2026-10-16, 20 Mbit/s;
  ~0.45–0.65 s on the live site before preloading, ~1 s before the WebP). Tailwind's `hover:` applies on hover-capable devices only, so a tap never
  triggers it. Focus ring: `ring-2 ring-white/85 ring-offset-2`. Title 14px, 15px from 2xl.
- Tried and dropped on the way (2026-10-14/15): text revealed on hover (place, song count), a
  colour-graded gig-poster style, face-detected art direction of the crop.

### Close buttons
All close buttons use `components/CloseButton.tsx` (`bg-white/10 hover:bg-white/20 rounded-full`,
icon `w-5 h-5 md:w-6 md:h-6`); pass positioning via `className` — standard `top-4 right-4` mobile,
`top-6 right-6` desktop. In `ShowDrawer` the close button sits **outside** the scroll div (sibling,
inside the fixed drawer `motion.div`) as `absolute top-4 right-4 md:fixed md:top-6 md:right-6`, so
on mobile it floats over the hero without taking layout space. It also carries `drawer-dock-close`,
which settles it into the docked header bar on scroll (Drawer metadata layout).

### Mobile input focus and iOS keyboard
iOS Safari raises the keyboard only when `input.focus()` runs in the **same synchronous call
stack** as the tap; `setTimeout`, `useEffect` or a promise loses it silently. For an input that
mounts on tap, render synchronously with `flushSync`, then focus:

```tsx
import { flushSync } from 'react-dom';

onClick={() => {
  flushSync(() => setInputVisible(true)); // renders the input into the DOM synchronously
  inputRef.current?.focus();             // still within the tap gesture — keyboard opens
}}
```

The search field no longer mounts on tap: it lives in the sticky `FilterBar`, always mounted, so
the tab bar's Search item focuses it directly inside the tap (`handleSearchTab` in App) and needs
no `flushSync`. Keep the pattern for any input that does mount on tap. Mobile inputs use
`font-size` 16px (`text-base`) or larger, or iOS zooms the page on focus.

### Masthead (HeroSearch)
Wordmark (`HalationLogo`) and tagline only — the one place the brand appears. Always mounted,
animating to `height: 0 / opacity: 0` while filtering (`isSearching={filtered}` from App). It uses
motion's `animate` prop, not `AnimatePresence`, so the search field in the bar below keeps its
place and focus mid-keystroke. `instant` skips the animation for the jump to the artist list.

### ShowDrawer — sizing and modal behaviour
On mobile: full width, `h-dvh` (live dynamic viewport height, so it always fills the visible screen
as the URL bar moves — never a static `vh`), sliding up from the bottom. From md: slides in from the
right at `58vw`, then `52vw` from lg, `41.6vw` from 2xl and `33.3vw` from 3xl (picked per breakpoint
by the owner, 2026-10-12). It is a modal: `role="dialog"`, focus moves in on open and is
trapped, Escape closes the image viewer first and then the drawer — and only that: App's "Escape
clears the search" waits while a show is open, so the results behind survive (F5) — focus returns
to the card, body
scroll is locked, and the page behind goes `inert` once the slide-in finishes.

### Drawer metadata layout (ShowDrawer)
**Hero** (over the header image): artist name (display font); one subtitle line `Date ·
EventOrFestival · VenueName · City, Country`, each part only when set and once (the venue is
dropped when it repeats the event or the city), "Date Unknown" when undated. The place shows for
festival and TV shows too (owner, 2026-10-16; it was hidden on ~700). Badge pills —
`ContentType` (violet), `RecordingType`, Duration (Clock icon + formatted `DurationSec`), the
quality label (`quality()` in `src/lib/specs.ts`: HD 1080, HD 720, SD 576, SD 480, Low-res; the
resolution as its `title`), and `TVStandard` for SD and low-res copies only — on HD records the
field is unreliable — each only when set.

The header is a **minimum** height — `min-h-56` (224px) on phones, `21.5vh` from md (owner,
2026-10-12) — not a fixed one. The title block sits in the flow at its foot (`flex flex-col
justify-end`; the image, its 55% wrapper, the gradient and the no-image initials are `absolute`
behind it), so a header shorter than its title grows to hold it instead of clipping it: the title
needs about 130–150px on a phone and about 160px on desktop. `pr-16 md:pr-20` keeps the title clear
of the close button.

**The header docks on scroll** (owner, 2026-10-12, the "Photo" bar). It is `sticky` with a negative
`top` (minus the distance between its height at rest and docked), so it rides up until only the
title is left on screen, then stays: name, subtitle and badges become a bar at the top of the
drawer, about 107px on desktop and 122px on a phone. The docking effect in `ShowDrawer` measures
both heights (after the first frame, on drawer resize, once fonts load) and writes `--p` (0 at rest,
1 docked) onto the drawer from the scroll position; the `drawer-dock-*` rules in
`styles/globals.css` follow it — the name eases 56 → 28px (32 → 24px on a phone), the subtitle 16 →
14px from md, the padding tightens, a fade appears under the bar, and the close button moves to the
bar's middle and shrinks 48 → 40px from md. The photo stays at the top of the bar, darkening into
the drawer colour. Scroll-linked, so it never re-renders the drawer and has nothing for reduced
motion to remove. Docked, a tap on the bar scrolls back to the top (`scrollContainerToTop` in
`src/lib/motion.ts`). The image and gradient clip in their own `absolute inset-0 overflow-hidden`
wrapper, not on the header, so the fade can hang below it.

**Below the hero**, in order: a "Part of …" link to the master (linked records), the Screenshots
strip, an "On this recording" list of linked records with time windows and song counts (masters),
then the content grid. Following either link swaps the show in the open drawer and scrolls to top.
Drive/folder/file metadata is not shown.

**Content grid**:
- Two columns from md (`md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]`): the main column holds
  Setlist, then Notes; the side column holds Technical in a tinted panel
  (`md:rounded-lg md:border md:bg-white/4`). Below md they stack in that order and Technical folds behind a **Technical
  details** toggle (`techOpen`, reset per show).
- **The Setlist heading always renders** (owner, 2026-10-06), so nothing else takes the place
  people read as the setlist. With no songs it says `No setlist yet`, `Documentary, no setlist`
  (`ContentType`), or on a master `Each act's songs are on its own page, under On this recording`.
- Column labels: `text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400`.
- Setlist: numbered `<ol>` from the semicolon-split `Setlist`; `Encore break` is an ordinary
  numbered item (the "On this recording" song counts leave it out).
- Technical: `techRows` of `{ label, value, mono }` — Video, Resolution, Aspect, Standard (SD
  only), Container, Audio, Channels, Sample rate, Folder; label `w-16 text-xs text-gray-400`, value
  `text-gray-200`; only rows with a value, and no panel when there are none. Values are in traders'
  words, from `src/lib/specs.ts` (MPEG-2, H.264, Dolby Digital (AC-3), LPCM, DVD-Video (VOB),
  MPEG-TS, Stereo, 5.1, 48 kHz; "(native)" dropped from the aspect); an unknown codec shows as
  stored. **Folder** joins size and file count ("2.71 GB · 8 files"), since both describe the
  whole folder, which can hold more than this show.
- Provenance, under a hairline in the same panel (owner, 2026-10-16): **Generation** as a row, then
  **Lineage** — `lineageChains` splits the field on ` | ` (separate sources or passes) and on arrows
  (`>`, `->`, `=>`, `>>`, `→`; the steps of one), and each chain renders as an `<ol>` on a thin rule
  with a dot per step, source first; a second chain sits `mt-3` below the first. A lineage without
  arrows is one step. `shows.json` names no taper (CLAUDE.md → *Tapers are never named*), so the
  drawer shows the field as it is.
- Notes: from `getNotes` — public sidecar text only; `PrivateNotes` never ships (CLAUDE.md); `whitespace-pre-wrap wrap-break-word font-mono text-xs text-gray-400`
  (`wrap-break-word` stops long unbroken strings overflowing on mobile). Always shown in full
  (owner, 2026-10-12): no clamp, no More / Less.

Tailwind v4: use `bg-linear-to-t`, not `bg-gradient-to-t` (deprecated).

### In-drawer screenshots and image viewer (ShowDrawer)
- Thumbnails: on mobile one `flex overflow-x-auto scrollbar-hide` row, each `w-[42%] shrink-0` so
  two fit with the third peeking; from md a `grid grid-cols-4`. Both share one mapped element so
  the viewer's `layoutId`s stay stable.
- The viewer is internal (no external lightbox). `expandedFromIndex` (the clicked thumbnail; anchors
  `layoutId={`drawer-img-${show.ShowID}-${idx}`}` for the open/close animation; `null` closes) and
  `viewingIndex` (the image shown; prev/next, ← →, and the dots change only this, wrapping around).
  Going back always zooms back to the original thumbnail.
- The viewer covers the drawer at `z-30`, above the sticky header (`z-20`) and below the drawer's
  close button (`z-60`). **× means one thing everywhere** (owner, 2026-10-12): the drawer's close
  button stays visible over the viewer and closes the show. Its twin on the left, a round **Back**
  button (`ChevronLeft`, same style, `aria-label="Back to the show"`), returns to the thumbnails;
  beside it the artist name and `Screenshot N of M · Open full size` — the original JPEG in a new
  tab, at 100% (the viewer fits the drawer, too small to judge an encode), set like the docked
  header bar; a click on the link does not count as a click in the dark around the picture. Both carry
  the docking transform (`drawer-dock-back`, `drawer-dock-follow`), so they line up with × whether
  or not the header is docked. Back also on Esc and on a click in the dark around the picture.
- Focus: Back takes focus when the viewer opens; going back returns it to the thumbnail
  (`data-thumb`). The drawer content behind the viewer is `inert` while it is open, and the focus
  trap skips it.

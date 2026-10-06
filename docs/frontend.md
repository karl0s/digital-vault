# Front-end architecture and UI patterns

How the site is put together, and the patterns a UI change must keep. Read this before changing
anything in `components/`, `App.tsx`, `src/` or `styles/`. The performance rules and the checks
every change must pass are in `CLAUDE.md` (Front-end performance, Checks).

---

## Browse architecture

Design reasoning, and where the build departs from it: `docs/browse-redesign-spec.md`. What a
change must not break:

**Shell** (`components/shell/`). `AppShell` = fixed `TopNav` (search only, no wordmark) + `Sidebar`
(md and up) + `<main>` + `MobileTabBar` (below md). The sidebar is a flex sibling, not an overlay,
so content reflows. It is `expanded` (256px) or `rail` (72px, small label under each icon),
toggled by its Collapse button and kept in `localStorage` under `vault:sidebar` (default
expanded). Its top group sets the destination (Browse, Artists); its lower group toggles the
`type` facet (Live shows, Documentaries). Below md the tab bar offers Browse · Artists · Search,
padded by `env(safe-area-inset-bottom)`; `<main>` carries `pb-20` to clear it. No
Live/Documentaries control on mobile.

**Views** (`App.tsx`). Browse (default): `HeroSearch` masthead (collapses to zero height while
anything filters), sticky `FilterBar`, then — only when nothing filters — `FeaturedRows` and an
"All shows" heading, then `ShowGrid` of `results`. Artists: `ArtistsView`, an A–Z directory with a
sticky letter rail in CSS columns; picking an artist puts its name in the search and renders
`SearchResultsGrid` in place, so clearing returns to the directory. A failed load renders one error
state for every view.

**State** (`src/store/filters.ts`, zustand): `view, q, from, to, undated, country, festival, type,
sort`. Read the whole state only as `useFilterStore(useShallow(selectFilterState))` — without
`useShallow`, zustand v5 re-renders until React throws ("getSnapshot should be cached"). Single
fields take plain selectors. The search input is local to App; only its debounced value (150 ms)
reaches the store.

**URL** (`src/lib/url.ts`) is the store's canonical serialisation: keys in the fixed order above;
facet values slugified, de-duplicated and sorted; defaults (`view=browse`, `sort=year-desc`,
`undated` off) and empty values omitted. Query params on the root path, never path segments
(GitHub Pages has no SPA fallback). Facet, query, range and sort changes `replaceState`; `setView`
`pushState`s, so Back steps between destinations. `initFilterUrlSync` (once, in App) rehydrates on
popstate. Every filter write passes through `commitFilterState` — the one seam reserved for
analytics.

**Pipeline** (`src/hooks/useBrowseResults.ts`): text query → MiniSearch id set → facets → sort,
all synchronous `useMemo`s. `src/search/facets.ts` counts each facet against every *other* active
filter, so an option's count is what selecting it yields; zero-count options are disabled, never
hidden. An empty `Country` or `EventOrFestival` becomes the `NONE` sentinel (`'none'`, "Unknown
location" / "No festival"). `type` is `ContentType` slugified, `live` when absent. Undated records
sort last both ways and are excluded from a year range unless `undated=1`.

**Controls** (`components/filters/`). `FilterBar`: Years, Country and Festival triggers; removable
chips and Clear all while anything is set; the result count (`aria-live`) and sort. `FacetPopover`
is a base-ui `Popover` — its `z-50` belongs on the `Positioner`; a text filter appears above 15
options. `YearRangePopover`: decade chips (decades with 5+ records), the `YearHistogram` brush,
From/To inputs (the keyboard and screen-reader path) and "Include undated". Brush maths is pure,
in `src/lib/brush.ts`; the store is written on pointer-up only, never during a drag.

**Grids.** `GRID_COLS` (exported by `FeaturedRows.tsx`) is the one column set for every grid:
2 → md 4 → lg 5 → xl 6 → 2xl 7. `ShowGrid` (Browse) is memoised and deliberately unanimated;
`SearchResultsGrid` (Artists-view search) has its own header and the "N more shows feature a song
called …" suggestion. Browse content, `TopNav` and `FilterBar` sit in `max-w-[1924px] mx-auto`;
`SearchResultsGrid` and `ArtistsView` use `max-w-[1860px]`.

---

## UI patterns

### Close buttons
All close buttons use `components/CloseButton.tsx` (`bg-white/10 hover:bg-white/20 rounded-full`,
icon `w-5 h-5 md:w-6 md:h-6`); pass positioning via `className` — standard `top-4 right-4` mobile,
`top-6 right-6` desktop. In `ShowDrawer` the close button sits **outside** the scroll div (sibling,
inside the fixed drawer `motion.div`) as `absolute top-4 right-4 md:fixed md:top-6 md:right-6`, so
on mobile it floats over the hero without taking layout space.

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

Both ways into the mobile search do this: `TopNav`'s search button, and the tab bar's Search item
(`handleMobileSearchClick` in App, via TopNav's controlled `mobileSearchOpen` prop and
`mobileSearchInputRef`). Mobile inputs use `font-size` 16px (`text-base`) or larger, or iOS zooms
the page on focus.

### Masthead (HeroSearch)
Wordmark (`HalationLogo`) and tagline only — the one place the brand appears. Always mounted,
animating to `height: 0 / opacity: 0` while filtering (`isSearching={filtered}` from App). It uses
motion's `animate` prop, not `AnimatePresence`, so nothing above the grid unmounts mid-keystroke.

### ShowDrawer — sizing and modal behaviour
On mobile: full width, `h-dvh` (live dynamic viewport height, so it always fills the visible screen
as the URL bar moves — never a static `vh`), sliding up from the bottom. From md: slides in from the
right at `58vw` (`52vw` from lg). It is a modal: `role="dialog"`, focus moves in on open and is
trapped, Escape closes the image viewer first and then the drawer, focus returns to the card, body
scroll is locked, and the page behind goes `inert` once the slide-in finishes.

### Drawer metadata layout (ShowDrawer)
**Hero** (over the header image): artist name (display font); one subtitle line `Date ·
EventOrFestival (or VenueName if no event) · Country (or City, Country if no event)`, "Date
Unknown" when undated; badge pills — `ContentType` (violet), `RecordingType`, Duration (Clock icon
+ formatted `DurationSec`), `TVStandard`, each only when set.

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
- Technical: `techRows` of `{ label, value, mono }` — Video, Aspect, Standard, Container, Audio,
  Channels, Sample rate, Size, Files; label `w-16 text-xs text-gray-400`, value `text-gray-200`
  (`font-mono` for codec-like values); only rows with a value, and no panel when there are none.
- Notes: from `getNotes`; `whitespace-pre-wrap wrap-break-word font-mono text-xs text-gray-400`
  (`wrap-break-word` stops long unbroken strings overflowing on mobile); collapsed to `max-h-72`
  (about 14 lines) with a gradient fade and **More ⌄ / Less ⌃** (`notesExpanded`). The fade and More
  appear only when the collapsed text really overflows (`notesOverflow`, measured by a
  ResizeObserver), never from a character count.

Tailwind v4: use `bg-linear-to-t`, not `bg-gradient-to-t` (deprecated).

### In-drawer screenshots and image viewer (ShowDrawer)
- Thumbnails: on mobile one `flex overflow-x-auto scrollbar-hide` row, each `w-[42%] shrink-0` so
  two fit with the third peeking; from md a `grid grid-cols-4`. Both share one mapped element so
  the viewer's `layoutId`s stay stable.
- The viewer is internal (no external lightbox). `expandedFromIndex` (the clicked thumbnail; anchors
  `layoutId={`drawer-img-${show.ShowID}-${idx}`}` for the open/close animation; `null` closes) and
  `viewingIndex` (the image shown; prev/next, ← →, and the dots change only this, wrapping around).
  Close always zooms back to the original thumbnail. The drawer's own close button is hidden while
  the viewer is open, to avoid z-index conflicts.

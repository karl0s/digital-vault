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

**State** (`src/store/filters.ts`, zustand): `q, from, to, undated, country, festival, quality,
standard, length, setlist, sort, layout`. Sort and layout are view preferences: Clear all keeps
them, and neither counts as filtering. Read
the whole state only as `useFilterStore(useShallow(selectFilterState))` — without `useShallow`,
zustand v5 re-renders until React throws ("getSnapshot should be cached"). Single fields take plain
selectors. The search input is local to App; only its debounced value (150 ms) reaches the store.

**URL** (`src/lib/url.ts`) is the store's canonical serialisation: keys in the fixed order above;
facet values slugified, de-duplicated and sorted; defaults (`sort=year-desc`, `undated` off) and
empty values omitted. Query params on the root path, never path segments (GitHub Pages has no SPA
fallback). Every change `replaceState`s. `initFilterUrlSync` (once, in App) rehydrates on popstate.
Every filter write passes through `commitFilterState` — the one seam reserved for analytics. The
retired `view` and `type` params are dropped on parse; `view=artists` is honoured once by App.

**The open show is in the URL** (owner, 2026-10-16; docs/ux-research F3, F4): `?show=<ShowID>`,
after the filter params and outside `FilterState` (`SHOW_PARAM`, `readShowParam`, `withShowParam`
in `src/lib/url.ts`; `commitFilterState` keeps it, and the history entry's state, when filters
change). Opening a show from the page `pushState`s an entry marked `{ vaultShow: true }`, so the
browser's Back and the phone's back gesture close the drawer instead of leaving the site; a show
opened inside the drawer ("Part of", "On this recording") `replaceState`s, so one Back still closes
it. Closing with × or Escape steps back over our entry (`history.back()`), or, for a show that
arrived in a link, removes the param. A link opens its show once the data loads; an ID that names
no show is dropped. App's popstate listener follows the URL both ways (Forward reopens), and
`initFilterUrlSync` skips a popstate that leaves the filters unchanged, so closing a show does not
recompute the results in its first frame. The tab title names the open show. `handleShowClick` is
the analytics seam for recordings, as `commitFilterState` is for filters. The site's own link
previews come from the page description and Open Graph tags in `index.html`.

**A page per show** (F3, 2026-10-17; `scripts/show-pages.ts`, `vite-plugin-show-pages.ts`):
`show/<ShowID>/` for every visible record, built with the site, so a link pasted into WhatsApp,
iMessage, Discord or a forum previews that show — crawlers don't run the app, so the tags must be
in the HTML. Each page has the show's title (`Artist · date · event`, the tab title's words),
a description (place, then quality, length, source, as `specs.ts` words them), its slot-1 JPEG
with its size as `og:image` (median 49 KB, under WhatsApp's limit; WebP thumbnails don't preview
everywhere), `noindex`, and a script that `location.replace`s to `../../?show=<ShowID>`, so a
person lands on the show and Back skips the page. **Copy link / Share and the CSV hand out this
URL** (`showLink`); the site's own URL bar keeps `?show=`. `npm run dev` serves the pages too.
The build also writes `404.html`: an old `show/<ShowID>/` link (a record since re-keyed, merged
or hidden) opens in the site, which drops an unknown ID; any other missing path goes home.
`npm run check:pages` builds every page from the data and checks it.

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
corrected (`suggestQuery`). `npm run check:search` holds golden cases for all of it.

**Trader queries** (owner, 2026-10-16; docs/ux-research F6, F8):
- **Dates** in any common format — `1996-05-24`, `24.05.1996`, `05/24/1996`, `24 May 1996`,
  `24. Mai 1996`, `May 1996`, `'97` — are taken out of the query (`src/search/dates.ts`) and
  filter `ShowDate`; the words left are searched among those shows (`searchWithin`). Slashed or
  dashed dates with both parts ≤ 12 are read both ways; dotted ones day first. Month names in seven
  languages, without "mars". A bare two-digit year ("Rock am Ring 97") is tried only when the
  words alone find nothing. If a date reading finds nothing, the words are tried as typed.
- **Initials** open an artist (RATM, FNM, KOL, 30STM, NIN, GNR…): worked out for names of three
  words or more (`artistInitials`), unique ones only, never a name's own spelling; hand aliases
  (`ARTIST_ALIASES`: STP, RHCP, SP…) win; MAS is left out.
- **Other names** are indexed beside each show, not rewritten into the query, so a word that is
  also a song title still finds the song (`src/search/aliases.ts`): `aka` — countries and cities
  in other languages and spellings (uk, brasil, deutschland, holland, koln/koeln, lisboa…),
  event short names (rar, titp, bdo, acl, snl, glasto, lolla); `tech` — hd/sd/lowres with the
  line count (1080, 1080i, 576…), pal/ntsc (SD only, as the drawer), pro shot, aud, doc, dvd,
  mkv, lpcm, ac3, mpeg2, h264. "us", "america", "england" and "rip" are left out (song words).
- **Fields** anywhere and several at once, quoted or not: `artist:"pearl jam" year:2000 pinkpop`
  (`parseFields`; a value runs to the next field, so free words go first). Fields: artist, type,
  country, city, venue, event, song, note, year, date, drive, codec; accents ignored. Plurals and
  `festival:` work too (`FIELD_ALIASES`: `songs:creep`, `festival:pinkpop`) — they used to find
  nothing, with no hint why.
- **No "Did you mean"** for an abbreviation (all capitals, up to six), a known place or spec word
  (`KNOWN_TERMS`), or a query with a date or decade: a near spelling there is a wrong guess.
- **Empty results** (`SearchResultsGrid`): when the search finds shows but the filters hide them
  all, it names the filters and offers "Show N without the filter(s)" (`clearFilters` keeps the
  query); otherwise it says what the search understands — dates, abbreviations, one-field
  searches. The field's placeholder reads "Artist, song, venue, date…". `src/search/facets.ts` counts each facet against every *other* active
filter, so an option's count is what selecting it yields; zero-count options are disabled, never
hidden. An empty `Country` or `EventOrFestival` becomes the `NONE` sentinel (`'none'`, "Unknown
location" / "No event"). Undated records sort last both ways and are excluded from a year range
unless `undated=1`.

**Controls** (`components/filters/`). `FilterBar` (`sticky top-0`, `data-filter-bar`): the search
field (a pill like the controls beside it; `text-base` below md), then Years, Country, Event and
More filters —
one row from lg, the search on its own
line below it, the controls scrolling sideways on a phone. Then removable chips and Clear all while
anything is set, and — only while filtering — the results row: the count, Grid / List, CSV and
the sort (below); the count's `aria-live`
region is always mounted (visually hidden), since one inside a `display:none` row is silent.
**On a phone the results row folds while scrolling down** (F18, 2026-10-17): a passive scroll
listener in `FilterBar` sets `data-folded` on the bar once it is stuck and the page moves down,
and removes it on the way up — DOM only, never React state. Folded, the row (`data-results-row`)
is `h-0` and the bar takes its measured height as `margin-bottom` (`--fold`), in the same frame,
so nothing below moves. Not animated: tried, and mid-animation the row and the margin didn't sum
to the same height, the browser's scroll anchoring nudged the page, and the nudge read as
scrolling up. On desktop the listener returns before any layout read.
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

**The results row** (while filtering): the count, then **Grid / List** (`layout`; `layout=list`
in the URL, after `sort`), **CSV** (from md) and the sort — newest, oldest, artist A–Z, **length,
longest first**, or **recently added** (`AddedOn`, the collection at launch after).

**What's new** (`src/lib/added.ts`, docs/ux-research F11; owner 2026-10-16, "start from today"):
records added since carry `AddedOn` (CLAUDE.md → AddedOn). Above Featured shows, **Recently
added** lists those added in the last 60 days, newest first, two rows at most, and is absent
while there are none. A card carries a badge for 30 days: **New** when the show wasn't held,
**Better copy** when its picture (HD, SD, low-res, then lines) beats every copy held before it,
otherwise **New copy** — worked out from `copiesOf`, never stored. The drawer's Technical panel
gives the date ("Added 2026-10-20 · better copy"), and the CSV an Added column.

**List layout** (`components/ShowList.tsx`, docs/ux-research F10): the same results in the same
order as a dense table, for scanning an artist's run or reconciling a spreadsheet. A real `<table>`
whose columns join as the screen widens — on a phone date, artist (event and city under it) and
quality (length under it); from md event, place, length; from lg venue, PAL/NTSC, songs; from xl
source and folder size. With a free-text query it is one table of every result, not the groups.
Clicking anywhere on a row opens the show; the artist is the row's button, so the keyboard reaches
every row, and the row click focuses it first so the drawer hands focus back there. Memoised, and
mounted only in list layout. **Printing** is for the list: the bar, masthead, tab bar and Clear
pill are `print:hidden`, the shell and table go black on white, every column prints.

**CSV** (`src/lib/csv.ts`): the results on screen, in their order, generated in the browser and
named for the search and filters (`the-vault-pearl-jam-2026-10-16.csv`); **Download the full list**
beside All artists gives the whole collection, A–Z. Columns: Artist, Date (`dateName`), Event,
Venue, City, Country, Type (Live, Excerpt, Documentary), Source, Quality, Resolution, Standard
(SD only), Video, Audio, Container, Length (min, a number), Folder size, Generation, Lineage,
Songs, Setlist, Link (`showLink`). UTF-8 with a BOM and CRLF, so Excel reads the accents; a cell
starting with `= + - @` is prefixed with `'`. Only published fields — never one in `DROPPED` or
`PRIVATE`.

**More filters** (`MoreFiltersPopover`; owner-agreed 2026-10-16, docs/ux-research F12): the specs
traders decide by, in one popover after Event — **Quality** (HD 1080, HD 720, SD, Low-res, from
`quality()`), **Standard** (PAL, NTSC; SD and low-res copies only, as the drawer: HD records have
none), **Length** (under 10 min, 10–30, 30–60, 1–1½ hours, over 1½ hours) and **Setlist** (has one,
none yet). Closed lists, defined once in `src/lib/specFilters.ts` (URL value, label, `specValue`);
each is a facet like Country — URL keys `quality`, `standard`, `length`, `setlist` after
`festival`, values a link cannot invent dropped on parse, OR within a group and AND across, live
counts, the same option rows (`FacetOptionButton`, shared with `FacetPopover`), chips, and named in
the empty state. Options keep the file's order, never by count: they are scales. Two columns from
md, one on a phone. **Source** (Pro-shot, Audience) joins once the blank records are filled in:
with 27% blank it would hide shows.

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
at `text-white/50`, the quietest legible level (5.3:1), brightening to `gray-300` on the row's hover
or focus (the owner's "Ghost" `white/17`, 1.7:1, failed WCAG AA and was lifted with F13, 2026-10-16). Tried and dropped: thumbnails per
row, fading the other letters on hover, white names for 5+ show artists.

---

## UI patterns

### Readability (F13, 2026-10-16)
Traders are mostly 40–60 (docs/ux-research). The floor, everywhere:
- **Text contrast at least 4.5:1** against `#141414` (WCAG 2.2 AA). The quietest text is `text-white/50`
  (5.3:1: counts beside headings, the A–Z counts); secondary text is `gray-400` (≈6.8:1).
  `gray-500` is for icons and chevrons only (3.8:1 passes the 3:1 for non-text), and `gray-600`
  for disabled options only (exempt).
- **Text 12px (`text-xs`) or more.** Labels, counts, the tab bar, the year axis. The one exception
  is the cards' badges at 11px, `text-2xs` (a theme token in `styles/globals.css`, in rem).
- **Sizes in rem**, Tailwind's scale or rem values, so text follows the browser's font-size
  setting; avoid new `text-[Npx]`.
- Layout holds at 150% and 200% browser zoom: no sideways scroll (the drawer's screenshot strip
  swipes by design).

### Show card (ShowCard)
"Cinematic" (owner, 2026-10-15; designed as direction 02 on
`~/VaultShots/reports/show-card-directions.html`). The 4:3 still is the card (`rounded-[10px]`):
- On a bottom gradient (`from-black/90 via-black/55 via-30% to-transparent to-70%`), three lines:
  the title; the place (event, else venue, city or country); and the **spec line**, `date ·
  quality` (`2010-06-05 · HD 1080`; F2, owner 2026-10-16). The title is the artist, or on an
  artist's page (`searchMode="artist"`) the event, with the venue or city under it, since the artist
  is the same on every card. Each line truncates on its own. The date is in full so two shows in one
  year differ (`dateName` in `src/lib/specs.ts`, the site's one date format: cards, drawer, share line, tab title): the year-only placeholder `YYYY-01-01` reads as the
  year, and undated as "Undated". The quality is `quality()`'s label, as in the drawer.
- The button's `title` holds the whole name, place and spec line, for what a narrow card cuts short.
- One row across the top: badges left, the length right (`lengthName`: `1h 42m`, `24 min`, the one
  length format on the site); badges wrap under each other rather than run beneath the length. A
  badge only when the record is not a plain live show: **New**, **Better copy** or **New copy**
  (emerald) for 30 days after its `AddedOn` (`src/lib/added.ts`), Documentary (`ContentType`) or
  Excerpt (`ParentShowID`) — and, dark and quieter, **N copies** when the collection holds the show more
  than once (`copyCount` in `src/lib/copies.ts`, below), so look-alike cards say why. How it was
  filmed gets none: Pro-shot, Audience and HD badges were dropped (owner, 2026-10-15).
- A song match in search (`songHits`) adds a ♪ line under the title, matched letters lit, and the
  gradient reaches higher (`to-80%`).
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
Wordmark (`HalationLogo`), tagline, and one quiet line saying what the site is (F16,
2026-10-17): "A private collection of 1,213 concert videos by 303 artists, 1965–2015", counted
from the shows by App (`collectionSummary`), so it never goes stale; it fades in when the data
loads. The one place the brand appears. Always mounted,
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
dropped when it repeats the event or the city). The date is `dateName`, as on the cards: a year-only
`YYYY-01-01` reads as the year, and undated as "Undated". The place shows for
festival and TV shows too (owner, 2026-10-16; it was hidden on ~700). Badge pills —
`ContentType` (violet), `RecordingType` as traders write it (`sourceName`: "Pro-shot"), Duration
(Clock icon + `lengthName`), the
quality label (`quality()` in `src/lib/specs.ts`: HD 1080, HD 720, SD 576, SD 480, Low-res; the
resolution as its `title`), and `TVStandard` for SD and low-res copies only — on HD records the
field is unreliable — each only when set. Last, a **Share** pill (an action, so rounded-full and
lighter than the badges; F4): the share sheet on touch devices with `navigator.share` (titled with
a one-line reference — `Artist · date · event · quality · length` — and `showLink()`: the show's
own page, `show/<ShowID>/`, with no search or filters, which previews that show when pasted — see
*A page per show*), otherwise "Copy link". That puts the link alone on the clipboard
as plain text, so it pastes into an address bar or chat as a working link, and as rich text the
reference linked to the show, so it pastes into an email by name; then it reads "Copied" for two
seconds. Never the two joined as plain text: pasted into an address bar that was not a URL. Its click
stops propagation, since a click on the docked bar scrolls to the top.

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
**N recordings of this show** (below), then the content grid. Following either link swaps the show in the open drawer and scrolls to top.
Drive/folder/file metadata is not shown.

**Recordings of this show** (F2, 2026-10-16) — when `copiesOf(show)` holds more than one: a row
per copy, longest first, giving quality, length, and the specs that tell copies apart (source,
video, container, audio and channels, PAL/NTSC for SD, folder size, "excerpt"), with the song
count from md. The open copy is a plain row marked "This copy" (`aria-current`); the others are
buttons that swap the drawer to that copy, as the links above do. `src/lib/copies.ts` groups the
visible shows once per catalogue load (useShows) on CLAUDE.md's duplicate rule — artist, date,
event, venue, city and country — plus `ContentType`, so a backstage documentary from the night is
not a copy of the set; an excerpt is, since a trader wants to know the full set exists. Undated
records have no copies. Module state, not a prop, so the memoised cards keep their props.

**Content grid**:
- Two columns from md (`md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]`): the main column holds
  Setlist, then Notes; the side column holds Technical in a tinted panel
  (`md:rounded-lg md:border md:bg-white/4`). Below md they stack in that order and Technical folds behind a **Technical
  details** toggle (`techOpen`, reset per show).
- **The Setlist heading always renders** (owner, 2026-10-06), so nothing else takes the place
  people read as the setlist. With no songs it says `No setlist yet`, `Documentary, no setlist`
  (`ContentType`), or on a master `Each act's songs are on its own page, under On this recording`.
- Column labels: `text-xs font-semibold uppercase tracking-[0.2em] text-gray-400` — the page's section
  labels (Featured shows, All artists, Shows) in the same style.
- Setlist: an `<ol>` from the semicolon-split `Setlist`, songs numbered 1..N; `Encore break` is an
  unnumbered divider ("Encore", then "Encore 2"…; `role="separator"`), so it neither takes a number
  nor counts (F15, 2026-10-17). Opened from a song search, the matched song is lit: App passes the
  search's `songHits` for this show, and that row gets a tint and the typed letters in bold, as on
  the card, with "(the song you searched for)" for screen readers.
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
- Notes: from `getNotes` — public sidecar text only; `PrivateNotes` never ships (CLAUDE.md); `whitespace-pre-wrap wrap-break-word font-mono text-[0.8125rem] text-gray-400` (13px: long reading)
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

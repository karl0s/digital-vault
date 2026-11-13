# Front-end architecture and UI patterns

How the site is put together, and the patterns a UI change must keep. Read this before changing
anything in `components/`, `App.tsx`, `src/` or `styles/`. The performance rules and the checks
every change must pass are in `CLAUDE.md` (Front-end performance, Checks).

---

## Breakpoints

Defined once, in `styles/globals.css` (`@theme`): Tailwind's defaults minus `sm`, plus `3xl`. Use
only these prefixes, and test a layout change at each tier's size. (The card grid's one-column
step below 400px went with the mobile audit, 2026-11-08: two columns on every phone; see Grids.)
Two helpers there for phones (docs/ux-research/06-mobile-audit.md): the `phone-landscape:` variant
(a touch screen held sideways, under 500px tall: no masthead) and the `touch-target` utility (an
invisible 44px touch area below md around a control that looks smaller; the element must be
positioned).

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
the search debounce, and **jumps** to the top (`jumpToY`, src/lib/motion.ts): a smooth scroll was
cut short as the list gave way to the shorter results, and the artist opened at its bottom (R1,
2026-11-08; clearing a search and the Browse tab jump too). Picked from the list, the place is
remembered (`azReturnY`): **All artists**, and the Artists tab while that artist is open, return to
it rather than to A (R6). `directoryInView` (read on scroll, re-rendering only when it flips) lights
the Artists tab, and on a phone shows the **letter index** (`components/LetterIndex.tsx`, R6): a
rail at the right edge under the bar, a tap or a drag down it jumps to a letter (the letter shown
large beside the thumb while dragging), the letter on screen lit — scroll work DOM only. The list
keeps 32px of right padding on a phone for it, and its rows are 44px there (R12).

**State** (`src/store/filters.ts`, zustand): `q, from, to, undated, country, festival, quality,
source, standard, length, setlist, sort, layout`. Sort and layout are view preferences: Clear all keeps
them, and neither counts as filtering. Read
the whole state only as `useFilterStore(useShallow(selectFilterState))` — without `useShallow`,
zustand v5 re-renders until React throws ("getSnapshot should be cached"). Single fields take plain
selectors. The search input is local to App; only its debounced value (150 ms) reaches the store.

**URL** (`src/lib/url.ts`) is the store's canonical serialisation: keys in the fixed order above;
facet values slugified, de-duplicated and sorted; defaults (`sort=year-desc`, `undated` off) and
empty values omitted. Query params on the root path, never path segments (GitHub Pages has no SPA
fallback). `initFilterUrlSync` (once, in App) rehydrates on popstate.

**Back steps through the site** (R5, 2026-11-08; it used to leave it after any search). A change
that moves to another view **adds** a history entry (`commitFilterState`, src/store/filters.ts): an
artist opened and the jump to the A–Z list (both call `stepHistory`), the page going from the
landing to results or back, and a new search typed once the last had settled — two seconds without
a change, or Enter (`settleQuery`). Every other change replaces the entry: a search refined letter by
letter, four filters ticked, the sort. Before adding one, the entry being left takes the scroll
position (`y` in its state, with `searchType: 'artist'` for an artist's view). On Back or Forward to
a view (not a show opening or closing) App restores both: its popstate listener runs before the
store's (declared first) and renders the masthead set to snap at once (`flushSync`), and the jump
waits two frames, since motion opens the masthead in the first and a jump made before it is pushed
down by its height. `history.scrollRestoration` is `manual`: the browser's own guess was made
against the page before it changed. Opening or closing a show is not a view change: the page behind
stays put (closing with × marks its own `history.back()`, `closingShowRef`, so the popstate it causes
is not taken for one). The search field starts from the URL's query, so a search link doesn't clear
and re-set it on load (which added two entries).
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
  (`ARTIST_ALIASES`: STP, RHCP, SP…) win; MAS is left out. They also work **beside other words**, in
  any order: "ratm swu", "swu ratm", "fnm bizarre 97", "rock am ring 2010 30stm" (R3, 2026-11-08).
  Tried only when the words as typed find nothing: the shorthand narrows to that artist's shows and
  the other words, dates included, are searched among them (`resolveShorthand`, `searchWords`), so
  no search that already worked changes. Only shorthand counts this way, never a plain name ("live",
  "tool").
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
field (a pill like the controls beside it; `text-base` below md; in a `form role="search"` with
`enterKeyHint="search"`, so Enter or the phone keyboard's Search key is one submit — App settles
the search for Back and, on a touch screen, closes the keyboard, R4), then — from md — Years,
Country, Event and More filters, one row from lg, the search on its own line below it on a tablet.
Then removable chips and Clear all while anything is set, and — only while filtering — the results
row: the count, Grid / List, CSV and the sort (below); the count's `aria-live` region is always
mounted (visually hidden), since one inside a `display:none` row is silent.
**On a phone** (R7, R8, R13, 2026-11-08; with four filters the bar and chips took 44% of the screen)
the bar is the search and one row of 44px controls (`data-results-row`): **Filters** (with how many
are set) opening `FilterSheet`, then while filtering the count (the word "shows" goes under 368px),
the other layout's icon and the sort — the phone's own picker lying invisible over a label of the
choice, so it is as wide as "Newest", not its longest option — and on the landing **New · N** (the
New filter, one tap; it leaves the sort alone). No popovers or chips below md: they are in the
sheet. The row steps aside (`h-0`) while the search field has focus, so results show above the
keyboard (four on a Galaxy, none before).
**`FilterSheet`** (phones): every filter in a base-ui `Dialog` from the bottom, 86% of the screen —
Years (decade chips, From and To typed and applied on leaving the field, Include undated), Event and
Country (what is chosen as chips, the rest behind "Add …" with a field to narrow them; 6+ shows, as
the popovers), then More filters' groups — as 44px chips with live counts, dimmed at 0, applied as
they are tapped; Clear all (the filters, not the search), × and "Show N shows" at the foot close it,
as do a tap outside, Escape and a drag down on the header. It closes if the screen grows past md.
**The phone's row folds while scrolling down through results** (F18, 2026-10-17): a passive scroll
listener in `FilterBar` sets `data-folded` on the bar once it is stuck, something filters, and the
page moves down, and removes it on the way up (and on returning to the landing) — DOM only, never
React state. Not on the landing: the jump to the A–Z list lands under the bar's full height.
Folded, the row is `h-0` and the bar takes its measured height as `margin-bottom` (`--fold`), in the
same frame, so nothing below moves. Not animated: tried, and mid-animation the row and the margin
didn't sum to the same height, the browser's scroll anchoring nudged the page, and the nudge read
as scrolling up. On desktop the listener returns before any layout read.
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
records added since carry `AddedOn` (CLAUDE.md → AddedOn). **No "Recently added" row** on the
landing (owner, 2026-10-29: Featured only for now; how to bring it back is commented in
`FeaturedRows.tsx`). A card carries a badge for 90 days (`BADGE_DAYS`; 30 until 2026-11-07, owner): **New** when the show wasn't held,
and **New** too for a copy of a show already held (the card has no room for "New copy", owner
2026-10-29); the drawer's Added line tells them apart, worked out from `copiesOf`, never stored.
**AddedOn is the owner's New Zealand date**, up to 13 hours ahead of UTC: `addedWithin` counts -1 day as
today, or a show added today would have no badge, and be missing from the New filter, until UTC reached
that date (found 2026-11-07).
**No label judges one copy against another**: "Better copy" was removed (owner, 2026-10-29). The drawer's Technical panel
gives the date ("Added 2026-10-29 · new copy"), and the CSV an Added column.

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
beside All artists gives the whole collection, A–Z. Columns: Artist, Date (`isoDate`: "2001",
"2001-05" or "2001-05-24", so partial dates still sort), Event,
Venue, City, Country, Type (Live, Excerpt, Documentary), Source, Broadcaster, Quality, Resolution, Standard
(SD only), Video, Audio, Container, Frame rate, Scan, Video kbps, Audio kbps, Disc, Menu, Chapters,
Show size (the drive scan's), Length (min, a number), Folder size, Generation, Lineage,
Songs, Setlist, Link (`showLink`). UTF-8 with a BOM and CRLF, so Excel reads the accents; a cell
starting with `= + - @` is prefixed with `'`. Only published fields — never one in `DROPPED` or
`PRIVATE`.

**More filters** (`MoreFiltersPopover`; owner-agreed 2026-10-16, docs/ux-research F12): the specs
traders decide by, in one popover after Event — **Source** (Pro-shot, Audience, from
`RecordingType`; added 2026-10-17, once every record had one), **Quality** (HD 1080, HD 720, SD, Low-res, from
`quality()`), **Standard** (PAL, NTSC; SD and low-res copies only, as the drawer: HD records have
none), **Length** (under 10 min, 10–30, 30–60, 1–1½ hours, over 1½ hours) and **Setlist** (has one,
none yet) and **Added** (New: exactly the shows whose card says New, the badge's own `BADGE_DAYS` window; owner
2026-11-07). Closed lists, defined once in `src/lib/specFilters.ts` (URL value, label, `specValue`);
each is a facet like Country — URL keys `source`, `quality`, `standard`, `length`, `setlist`, `added` after
`festival`, values a link cannot invent dropped on parse, OR within a group and AND across, live
counts, the same option rows (`FacetOptionButton`, shared with `FacetPopover`), chips, and named in
the empty state. Options keep the file's order, never by count: they are scales. Two columns from
md; on a phone the same groups are in the filter sheet, as chips.

**Grids.** `GRID_COLS` (exported by `FeaturedRows.tsx`) is the one column set for every grid:
2 on phones → md 3 (lg too) → xl 4 → 2xl 5 → 3xl 6 (owner, 2026-10-19, picked on
`~/VaultShots/reports/card-columns.html`, made by `~/VaultShots/card_columns.py`; phones under 400px
had one column until the mobile audit, R2, 2026-11-08: one card per screen became four to six, and
three columns was tried and could not be read), with a 14px row gap and 12px between columns since
a card carries no caption below it — 10px and 8px on a phone. A grid's first `PRIORITY_CARDS` (4)
cards load their stills eagerly and at high priority (R14; `priority` on `ShowCard` and
`LazyImage`). `ShowGrid` is memoised and deliberately unanimated;
`SearchResultsGrid` has its own header and the "N more shows feature a song called …" suggestion;
**on a phone the header goes** (R4: the query is in the field, the count in the bar, the field's ×
clears), kept for screen readers; an artist keeps its All artists pill (44px), and a section label
with no other section beside it is visually hidden;
for free text it renders the groups in order — **Artists** as tiles (round portrait, name, count,
chevron; one card wide from md so its edges meet the cards' and no row leaves a hole, the full
width on a phone (both columns), a long name on two lines; six, then Show all),
then **Shows** and **Songs** as card grids — or the Did you mean. A tile's portrait is the owner's
pick in `ARTIST_PORTRAITS` (`src/lib/portraits.ts`), else the newest show's slot 1, whatever the
filters or sort; picks are made on `tools/artist-portraits/build.py`'s page and pasted back. Under
the title, the count and a **Clear search** pill (`bg-white/10`, 32px tall — a standalone control,
so WCAG 2.5.8's 24px target applies; an artist opened from the list reads **All artists** with a
back chevron instead). It is the results' one way out; the empty state only suggests what to try.
`ArtistDirectory` is memoised; its `columns-[240px]` keeps every name untruncated. Its hierarchy
(owner, 2026-10-13): letters in Bebas Neue 36px (`--font-display`); names on the letter's edge, the
row's hover fill bleeding 12px past it (`-mx-3`); rows 32px from md, 44px on a phone (36px until the mobile audit, R12); show counts
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
  year differ (`dateName` in `src/lib/specs.ts`, the site's one date format: cards, list, drawer,
  share line, tab title, link previews): as much of the date as is known — "2010-06-05", "May 2001"
  for a `DatePrecision` of month, "2001" for `YYYY-01-01` (unless marked a real day) — and
  "Undated", or "Compilation" for an undated record with a `Title` — "Compilation 1994–1996" when it has
  `Parts` (the years they span; `compilationSpan`). A compilation's or film's `Title`
  stands where the event goes, on the card, the list, the drawer, the CSV and link previews
  (`eventName`, 2026-11-03). The quality is `quality()`'s label, as in the drawer.
- The button's `title` holds the whole name, place and spec line, for what a narrow card cuts short.
- One row across the top: badges left, the length right (`lengthName`: `1h 42m`, `24 min`, the one
  length format on the site); badges wrap under each other rather than run beneath the length. A
  badge only when the record is not a plain live show: **New**
  (emerald) for 90 days after its `AddedOn` (`src/lib/added.ts`), Documentary (`ContentType`) or
  Excerpt (`ParentShowID`) — and, dark and quieter, **N copies** when the collection holds the show more
  than once (`copyCount` in `src/lib/copies.ts`, below), so look-alike cards say why. How it was
  filmed gets none: Pro-shot, Audience and HD badges were dropped (owner, 2026-10-15).
- **NFT** (`NFT: "Yes"`, owner 2026-11-02): not for trade. Not a top badge but a quiet outlined chip on
  the title line, after the name, which truncates around it; the button's `title` ends "Not for trade".
  The list view puts the same chip after the artist, and the drawer a larger one beside its title
  (body face, read as ", not for trade"). Previewed on `~/VaultShots/reports/nft-badge-preview.html`.
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
All close buttons use `components/CloseButton.tsx` (`p-3 bg-white/10 hover:bg-white/20 rounded-full`,
icon `w-5 h-5 md:w-6 md:h-6`: 44px on a phone, a thumb's target, R12 — 36px until 2026-11-08 — and
48px from md); pass positioning via `className` — standard `top-4 right-4` mobile,
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
`font-size` 16px (`text-base`) or larger, or iOS zooms the page on focus — the filter sheet's
fields too. The keyboard's Search key closes the keyboard on a touch screen (`pointer: coarse`;
`handleSearchSubmit`), never on desktop, where the field keeps focus.

### Masthead (HeroSearch)
Wordmark (`HalationLogo`) and one line that is both the tagline and what the site is (F16;
owner, 2026-10-18): "1,213 live shows worth reliving.", in the tagline's spaced capitals, counted
from the shows by App (`collectionSummary`) so it never goes stale. It fades in once the data has
loaded; until then it holds its place unseen. The one place the brand appears. Always mounted,
animating to `height: 0 / opacity: 0` while filtering (`isSearching={filtered}` from App). It uses
motion's `animate` prop, not `AnimatePresence`, so the search field in the bar below keeps its
place and focus mid-keystroke. `instant` skips the animation for the jump to the artist list and for
Back and Forward. **On a phone it is shorter** (R10, 2026-11-08): padding 18/12px (40/32 from md),
the wordmark 48% of the column (70%), the line 12px (the floor, F13) with 0.2em spacing, the
bottom fade 48px — about 93px, so the first four shows are on the first screen. Held sideways
(`phone-landscape:`) it is not shown at all.

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
dropped when it repeats the event or the city). The date is `dateName`, as on the cards, and says
outright when it is partial (`dateCaveat`, F7): "2001 (date unknown)", "May 2001 (day unknown)". The place shows for
festival and TV shows too (owner, 2026-10-16; it was hidden on ~700). Badge pills —
`ContentType` (violet), `RecordingType` as traders write it with its channel where known
(`sourceWithChannel`: "Pro-shot · BBC Three"; `Broadcaster`, tools/broadcaster, 2026-10-18), Duration
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
drawer, about 107px on desktop and 56px on a phone (below). The docking effect in `ShowDrawer` measures
both heights (after the first frame, on drawer resize, once fonts load) and writes `--p` (0 at rest,
1 docked) onto the drawer from the scroll position; the `drawer-dock-*` rules in
`styles/globals.css` follow it — the name eases 56 → 28px (32 → 24px on a phone), the subtitle 16 →
14px from md, the padding tightens, a fade appears under the bar, and the close button moves to the
bar's middle and shrinks 48 → 40px from md. The photo stays at the top of the bar, darkening into
the drawer colour. Scroll-linked, so it never re-renders the drawer and has nothing for reduced
motion to remove. Docked, a tap on the bar scrolls back to the top (`scrollContainerToTop` in
`src/lib/motion.ts`). The image and gradient clip in their own `absolute inset-0 overflow-hidden`
wrapper, not on the header, so the fade can hang below it.

**On a phone the docked bar is one line** (R11, 2026-11-08; it was about 150px with the subtitle and
badges): the name (24px, one line, cut short with "…") with the date beside it
(`.drawer-dock-date`), about 56px. The subtitle and badges shrink with `--p` from their heights at
rest (`--sub-h`, `--badges-h`, written by `measure()`) and fade; they clip only while moving
(`data-dock-moving`), so Share's touch area works at rest. `data-dock-line` puts the name on one line
and shows the date. For a name that wraps at rest, `measure()` finds where the wrapped title would
outgrow the part of the header still on screen and switches a step earlier, so the name never slips
off the top. Docking takes about 168px of scroll on a phone (74 before). From md, unchanged.

**Below the hero**, in order: a "Part of …" link to the master (linked records), the Screenshots
strip, an "On this recording" list of linked records with time windows and song counts (masters),
**N recordings of this show** (below), then the content grid. Following either link swaps the show in the open drawer and scrolls to top.
Drive/folder/file metadata is not shown.

**Recordings of this show** (F2, 2026-10-16) — when `copiesOf(show)` holds more than one: a row
per copy, longest first, giving quality, length, and the specs that tell copies apart, in the order
a trader ranks them: source and broadcaster, frame rate and scan in shorthand ("25i", "29.97i", "50p",
`frameShort`), the video codec at its bitrate ("MPEG-2 8.9 Mb/s"), container, audio and
channels, PAL/NTSC for SD, the show's own size (else its folder's), "excerpt"; the song count from
md. The open copy is a plain row marked "This copy" (`aria-current`); the others are
buttons that swap the drawer to that copy, as the links above do. **On a phone each copy is a
block** (R9, 2026-11-08; the specs had wrapped into a 150px column): the quality and length, "This
copy" or "Open ›" at the right; then the specs that differ from the other copies as lit (amber)
chips; then "Same: …", the specs every copy shares. The label adds "differences lit". The same
`copySpecs` list feeds both; from md, the row as before. `src/lib/copies.ts` groups the
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
- A compilation with `Parts` lists the same songs in groups, each under "date · programme · place"
  (`compilationParts`), numbered on across the groups (owner, 2026-11-03).
- Technical: `techRows` of `{ label, value, mono }` — Video, Resolution, Frame rate ("25 fps,
  interlaced"), Aspect, Standard (SD only), Container, Disc ("DVD-5 · menu · 8 chapters"; none
  for a plain file), Audio (with "2 tracks" where several), Channels, Sample rate, Bitrate ("8.9
  Mb/s video · 384 kb/s audio"), Show size (only where it differs from the folder), Folder,
  Added. Frame rate, disc and bitrate come from the drive scan (`tools/drive-scan`, 2026-10-18;
  `frameName`, `discName`, `kbpsName` in `src/lib/specs.ts`); label `w-16 text-xs text-gray-400`, value
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
  `viewingIndex` (the image shown; prev/next, ← →, and the dots change only this, wrapping around;
  a swipe changes it too, without wrapping). Going back always zooms back to the original thumbnail.
- **Swipe** (touch screens, 2026-11-13; `src/hooks/useSwipePager.ts`): a finger anywhere in the
  picture area moves between the stills. The picture follows the finger 1:1; at release the
  gesture's momentum is projected forward (Apple's 0.998 deceleration) to choose the still, so a
  short flick is enough, one still per gesture; a critically damped spring (response 0.32 s, no
  bounce) carries on at the finger's own speed; past the first or last still it resists (rubber
  band) and comes back; a touch on a still settling catches it. The counter and dots change at
  release. Up-and-down and pinch-zoom stay the browser's (`touch-action: pan-y pinch-zoom`, dropped
  while zoomed in, so the finger pans the page). A mouse never drives it: arrows, dots and keys as
  before.
- How the swipe is built: the `layoutId` frame never moves, so its zoom from the thumbnail is
  unchanged; a strip inside it does, by `style.transform` written from the gesture, never React
  state. React renders once per still, at release, and a layout effect re-bases the strip in that
  same commit, so nothing jumps. One keyed `<img>` per still: the one shown is in the flow and
  sizes the frame, as before; the others are `absolute`, a page to either side (`--swipe-page`,
  measured per gesture: the still plus 24px, or more so a neighbour always enters from the edge),
  and `invisible` except while the strip has `data-moving`. Changing still swaps no `src` and
  fetches nothing (the drawer's thumbnails have already loaded the originals). The viewer clips
  (`overflow-hidden`), so a still never shows outside the drawer.
- The viewer covers the drawer at `z-30`, above the sticky header (`z-20`) and below the drawer's
  close button (`z-60`). **× means one thing everywhere** (owner, 2026-10-12): the drawer's close
  button stays visible over the viewer and closes the show. Its twin on the left, a round **Back**
  button (`ChevronLeft`, same style, `aria-label="Back to the show"`), returns to the thumbnails;
  beside it the artist name and `Screenshot N of M · Open full size` — the original JPEG in a new
  tab, at 100% (the viewer fits the drawer, too small to judge an encode), set like the docked
  header bar; a click on the link does not count as a click in the dark around the picture. Both carry
  the docking transform (`drawer-dock-back`, `drawer-dock-follow`), so they line up with × whether
  or not the header is docked. Back also on Esc and on a click in the dark around the picture.
- Touch (R12, phones): Back, Previous and Next are 44px, the dots 44px buttons around the same
  small dot, "Open full size" and Share keep their look with a 44px `touch-target`, and the
  Technical details toggle is a 44px row.
- Focus: Back takes focus when the viewer opens; going back returns it to the thumbnail
  (`data-thumb`). The drawer content behind the viewer is `inert` while it is open, and the focus
  trap skips it.

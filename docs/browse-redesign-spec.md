# Browse Redesign — Phase 1 Spec

Branch: `feat/browse-redesign` · Base: `main @ 2ce2395` · Status: spec, not yet built

## Why

The archive exposes one of thirteen metadata dimensions: artist. Search is a
**recall** interface — it only works if you already know the answer. User feedback
("average", "want to filter by specific metadata") is the signature of people
browsing a collection whose shape they cannot see. They don't know there are 40
Rock am Ring sets or shows from Chile, so they cannot ask for them.

The goal is not "add filters". It is to **make the shape of the collection
legible**, and let people move through it by recognition.

---

## Decisions locked

| Decision | Outcome |
|---|---|
| Facets for Phase 1–2 | **Era/decade · Year · Country · Festival** |
| Recording type as a filter | **Dropped** — 48% blank, and screenshots already reveal audience vs proshot |
| Recording-type badge on cards | **Remove** — most are proshot, so the badge carries no information. Keep it in the drawer |
| Genre | **Parked** — too many cross-genre artists to label honestly |
| Documentaries | New `ContentType` field; owner does a tagging pass extending the existing 18 |
| Shell | YouTube-style persistent sidebar + filter bar |
| URL state | **Query params on the root path** |
| Analytics | GA later, not now — but the URL seam is built from commit one |
| Map | Last. Ambitious, agency-grade, `Cobe` earmarked |
| Mobile navigation | **Bottom tab bar**, not an overlay sheet |
| Landing view | **Straight into the browse grid** (provisional — "for now") |
| Sort | **Year newest / Year oldest / Artist A–Z.** Never "recently added" |

### Why query params, not path segments

GitHub Pages has no SPA fallback and the repo has no `404.html`. A path route like
`/digital-vault/browse/1990s` **404s before any JS runs** — the same trap that hid
the playground. Query params on the root (`/digital-vault/?era=1990s`) work today
with zero configuration.

---

## Data reality

Every facet below was measured against `public/shows.json` (829 shows). Coverage
drives the design — a facet over a sparse field silently hides the archive and
costs more trust than it earns.

| Facet | Coverage | Notes |
|---|---|---|
| Era / decade | 92% (765) | 1990s (242) + 2000s (376) = 75% of the archive |
| Year | 92% | **142 shows are `YYYY-01-01`** — year known, day unknown. Year filters work; date filters do not |
| Country | 84% (694) | ⚠️ `England` (8) and `US` (2) must fold into `United Kingdom` / `United States` before shipping |
| Festival | 59% (488) | 154 distinct. 23 appear 5+ times (295 shows); 91 appear exactly once |
| Recording type | 48% | Dropped as a facet |
| Documentary | 18 tagged | Not derivable — `Notes` keyword matching is noise from pipeline lineage text |

### Phase 0 — data work, lands on `main` not this branch

`shows.json` is edited nearly every session (8 of the last 10 data commits). Keeping
data changes on `main` means this branch only ever conflicts on `.tsx` files.

1. **Normalise `Country`** — fold `England`→`United Kingdom`, `US`→`United States`.
   Without this the country facet ships with duplicate rows on day one.
2. **Add `ContentType`** — `Live` · `Documentary` · `TV session` · `Compilation`.
   Derive a first pass, hand-verify the ~150 ambiguous ones.

> The 64 undated shows are **not** documentaries. They are TV compilations and
> multi-show tapes — *Video Hits*, *MTV EMAs*, *HBO Reverb*, *TV Collection Master
> VHS Tapes*. Do not conflate "undated" with "documentary".

---

## Information architecture

YouTube's chip bar is a **single-select topic switcher**, not a faceted filter.
Copying it literally would produce something worse than the current search. Take
YouTube's *shell*; take faceted search's *semantics*.

- **Sidebar = destinations.** Stable, always present.
- **Filter bar = refinement** within the current destination. Multi-select.

```
┌────────────┬──────────────────────────────────────────────────┐
│ ☰ THE VAULT│  [search…]                                  ⌘K   │
├────────────┼──────────────────────────────────────────────────┤
│ ⌂ Home     │  Era ▾   Year ▾   Country ▾   Festival ▾         │
│ ▦ All shows│  ┌──────────────────────────────────┐            │
│ ♪ Artists  │  │ 1990s ×  │ Germany ×             │  Clear all │
│ ⛭ Festivals│  └──────────────────────────────────┘            │
│ ⌘ Map      │  38 shows · Sort: Newest ▾                       │
│ ─────────  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐      │
│ ▶ Live     │  │card│ │card│ │card│ │card│ │card│ │card│      │
│ ⏺ Docs     │  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘      │
│ ⧉ TV       │                                                  │
└────────────┴──────────────────────────────────────────────────┘
```

The lower sidebar group (Live / Docs / TV) is powered by `ContentType` and is the
answer to "separate documentaries from live shows". It reads as navigation, not as
a filter, which is correct — it is a different *kind* of thing, not a refinement.

---

## Sidebar

| State | Width | When |
|---|---|---|
| Expanded | `256px` | Desktop default, `≥1280px` |
| Rail | `72px`, icons only, labels on hover | Toggled, or default `768–1279px` |
| **Bottom tab bar** | Full width, fixed to the bottom edge | `<768px` — replaces the sidebar entirely |

### Mobile: bottom tab bar

Below `768px` there is **no sidebar at all**. Destinations move to a fixed bottom
bar, which suits a phone better than a hamburger-and-sheet: one tap instead of two,
and it sits under the thumb rather than at the top-left corner.

- Four items maximum — **Browse · Artists · Search · Map**. `ContentType`
  (Live/Docs/TV) demotes to a facet on mobile rather than a nav item; there isn't
  room for seven destinations and a tab bar with seven items is a menu in disguise.
- Height `56px` + `env(safe-area-inset-bottom)`. Without the safe-area padding the
  bar sits under the iOS home indicator.
- The results grid needs matching bottom padding or the last row hides behind it.
- Icons carry visible labels; icon-only tab bars fail recognition for infrequent users.
- Active item gets `aria-current="page"`.

This is a genuine divergence from YouTube, which uses a sheet. A tab bar is the
better phone pattern and the parallel is not worth preserving here.

- Toggle state persists to `localStorage`.
- Rail items need accessible names — icon-only buttons get `aria-label`.
- The sidebar is a `<nav>` landmark; the current destination carries `aria-current="page"`.
- Mobile overlay is a modal: focus trap, `inert` background, Escape to close.
  **Use base-ui rather than hand-rolling** — `ShowDrawer` already proves how much
  of that contract is easy to miss.

---

## Filter bar

### Interaction model

Each facet is a trigger button opening a popover containing:

- a checkbox list, multi-select
- **a live count per option**, recomputed against the *current* selection
- a text filter inside the popover once options exceed ~15 (Country: 47, Festival: 154)
- options yielding zero results are **disabled, not hidden**

Selected values render as removable chips beneath the trigger row, plus **Clear all**
once any facet is active.

### Faceted counts — the detail that separates this from an amateur build

Counts must reflect what *would* happen, not raw totals. For facet `F`, compute
counts against the result set filtered by **every facet except `F` itself**.
Otherwise selecting `1990s` shows `Germany (123)` while clicking it yields 31, and
the interface has lied.

829 records is small — this is a synchronous `useMemo` over an in-memory array. No
backend, no debounce, no async states.

Disabling rather than hiding zero-count options is deliberate: the interface teaches
you the shape of the collection instead of silently rearranging under your cursor.

### Degradation over sparse data

Every facet needs an explicit answer for missing values — this is where naive filter
UIs lose trust.

| Facet | Missing | Treatment |
|---|---|---|
| Country | 135 shows | An explicit **"Unknown location"** option, counted like any other |
| Festival | 341 shows | An explicit **"No festival / headline show"** option |
| Era, Year | 64 shows | Fold into the existing **"Undated"** group |

A show with no country is *not* silently excluded — it is reachable through a named
option. Never let a record become unreachable through the UI.

### Festival's long tail

154 events, 91 appearing exactly once. Show the 23 with 5+ shows, then
**"Show all 154"** behind the popover's text filter. A flat list of 154 is unusable.

---

## Sort

Three options. The labels matter more than usual here.

| Label in UI | Field | Direction |
|---|---|---|
| `Year — newest first` | `ShowDate` | desc (default) |
| `Year — oldest first` | `ShowDate` | asc |
| `Artist A–Z` | `Artist` | `localeCompare`, `sensitivity: 'base'` |

**Why not "Newest".** `LastScannedAt` is populated on 819 of 829 shows, so
"recently added to the collection" is a real, available sort — which makes a bare
"Newest" genuinely ambiguous on an archive of decades-old concerts. Labelling the
axis (`Year — …`) removes the ambiguity at zero cost. Sorting by acquisition date
is explicitly **not wanted**.

**Undated handling.** Reuse the existing `sortChronological` in
`src/search/searchIndex.ts`, which already groups undated shows deterministically
and sorts them last.

> The 64 undated shows sort **last in both directions.** Undated is not "year zero" —
> flipping to oldest-first must not surface 64 unknowns above a 1968 recording.

The 142 `YYYY-01-01` stubs sort within their year, which is correct: the year is
real, only the day is unknown.

---

## URL schema

```
/digital-vault/?era=1990s,2000s&country=germany,united-kingdom&festival=rock-am-ring&year=1998&q=nirvana&sort=newest
```

### Canonical serialization — required from the first commit

| Rule | Reason |
|---|---|
| Params emitted in fixed order: `q, era, year, country, festival, type, sort` | Two orderings of the same view must never produce two URLs |
| Multi-values sorted alphabetically, comma-joined | `era=1990s,2000s` and `era=2000s,1990s` are the same view |
| Empty facets omitted entirely | No `?era=&country=` noise |
| Values slugified: lowercase, spaces → `-` | `united-kingdom`, `rock-am-ring` |

Without this, GA splits one logical view across many rows and **historical data
cannot be repaired retroactively** — you would be comparing pre- and post-fix data
that do not share a shape. Five lines of code that must exist before the first URL does.

### The GA seam

One choke-point function that every filter mutation routes through:

```ts
function commitFilterState(next: FilterState) {
  const url = serializeFilters(next);   // canonical
  history.replaceState(null, '', url);  // replaceState, not push — see below
  // GA hook lands here later. Nothing else calls gtag.
}
```

`replaceState` while adjusting facets, `pushState` only on destination change.
Otherwise ticking four checkboxes buries the back button under four history entries.

---

## State

`zustand` store, single source of truth, hydrated from the URL on load:

```ts
interface FilterState {
  q: string;
  era: string[];          // ['1990s']
  year: number[];         // [1998]
  country: string[];      // ['germany']
  festival: string[];
  contentType: string[];  // ['live'] — drives the sidebar group
  sort: 'newest' | 'oldest' | 'artist';
}
```

URL is the serialization format; the store is the runtime. On mount, parse URL →
store. On change, store → `commitFilterState`. One direction each way, no loops.

---

## Component inventory

| Component | Action |
|---|---|
| `AppShell` | **New** — sidebar + content grid |
| `Sidebar` | **New** — rail/expanded/overlay |
| `FilterBar` | **New** — facet triggers + chip row |
| `FacetPopover` | **New** — base-ui popover, checkbox list, counts, search |
| `ActiveFilterChips` | **New** |
| `ResultsHeader` | **New** — count + sort |
| `useFacetCounts` | **New** — the counting engine |
| `src/lib/url.ts` | **New** — canonical serializer + parser |
| `src/store/filters.ts` | **New** — zustand |
| `SearchResultsGrid` | **Modify** — receives filtered results, keeps its grid |
| `ShowCard` | **Modify** — remove the recording-type badge |
| `TopNav` | **Modify** — sidebar toggle; Artists pill moves into the sidebar |
| `HeroSearch` | **Modify** — homepage only; pills become facet shortcuts |
| `ShowDrawer` | **Unchanged** now; candidate to move onto base-ui Dialog later |
| `App.tsx` | **Modify** — parked `showAllMode` gets its sidebar entry point back |

Note: "All shows" mode is currently parked and unreachable. The sidebar's **All shows**
item is its intended entry point — see the `PARKED` comment in `App.tsx`.

---

## Motion

Filtering is a **high-frequency** action. The governing rule: it must not animate.

| Interaction | Treatment |
|---|---|
| Grid updates on filter change | **No animation.** Swap instantly. Animating 300 cards is the worst available option |
| Chip add / remove | 150ms opacity only. **No layout animation** — it reshuffles every neighbouring chip |
| Facet popover | scale `0.96→1` + opacity, 150–200ms `ease-out`, `transform-origin` at the trigger. Never `scale(0)` |
| Sidebar collapse | 200ms `ease-out` on `grid-template-columns` |
| Map, first load, empty states | Delight allowed — these are rare moments |

`<MotionConfig reducedMotion="user">` is already in place and covers all of it.

**Rejected:** NumberFlow on the result count. It fits on paper, but that count is the
highest-frequency element on the screen and animating it contradicts the rule above.

---

## Libraries

From `/pick-ui-library`:

| Need | Library | Phase |
|---|---|---|
| Popovers, menus, mobile sidebar sheet | **base-ui** | 1 |
| Shared filter state | **zustand** | 1 |
| Conditional classNames / variants | **clsx** + **cva** | 1 |
| Command palette | **cmdk** | 3 |
| 3D globe | **Cobe** | 3 |
| Animation | **motion** | installed |

**Virtuoso — deferred, but the case got stronger. Measure in Phase 1.**

The original reasoning was: worst case 829 rows, under the 1,000 threshold, and
filtering only shrinks it. Landing straight in the browse grid **weakens that
argument** — the unfiltered 829 is no longer a rare worst case, it is the *default
first paint on every cold load*.

Rough shape of the problem: 829 cards × ~15 DOM nodes ≈ 12,000 nodes on mount.
`LazyImage` still defers image bytes via IntersectionObserver, so the network cost
stays bounded; the exposure is initial render time and scroll jank.

Still not adding it blind — `@tanstack/react-virtual` was removed in `76452e6` as
unused and re-adding a virtualizer on a hunch repeats that mistake. **Action:** build
the grid unvirtualized, profile the unfiltered landing on a mid-range phone, and add
Virtuoso if it stutters. Decide with a number, not a guess.

The default-slice question below may remove the problem entirely.

---

## Phasing

| Phase | Scope | Lands on |
|---|---|---|
| **0 — Data** | Normalise `Country`; add `ContentType` | `main` |
| **1 — Shell** | Sidebar, URL state + serializer, filter bar with Era · Year · Country · Festival, faceted counts, remove card badge | this branch |
| **2 — Depth** | Sort, festival long-tail search, `ContentType` sidebar group, saved views | this branch |
| **3 — Delight** | ⌘K palette, Geography page + globe | this branch |

Merge **per phase**, not once at the end. Three small merges beat one large one,
especially against a `main` that keeps absorbing data changes.

---

## Landing view

Decision: land straight in the browse grid. This turns the site from a homepage
into a tool, and pulls two loose threads.

### What happens to the hero

`HeroSearch` currently owns the wordmark, the tagline, and six quick-search pills.
Landing in the grid means it no longer has a screen to live on. Proposed disposition
rather than deletion — the `HalationLogo` in particular is the product of a whole
playground folder of work and should not be collateral damage:

| Element | Moves to |
|---|---|
| `HalationLogo` wordmark | Sidebar header, top-left — the YouTube position |
| Quick-search pills | **Pinned options at the top of the Artist facet** (see chrome budget below) |
| "Live music worth reliving." tagline | Sidebar footer |
| `HeroSearch.tsx` | Deleted once the above have homes |

### What the grid shows on arrival — LOCKED: curated strip + full grid

One horizontal `FeaturedRow` above the full grid, preserving the editorial work in
`FEATURED_IDS`. Keeps the tool framing while giving the eye somewhere to land before
the wall of cards, and it is closest to what YouTube's home actually does.

#### The strip is conditional — this is the load-bearing rule

**The featured strip renders only when no filter is active.** The moment any facet
or query is applied, it disappears and the view becomes pure results.

A curated strip sitting above filtered results is actively wrong: it ignores the
filter the user just set, so it reads as either broken or as results that don't
match. Two states, one rule:

| State | Renders |
|---|---|
| No filters, no query | Featured strip → results header → full grid, `Year — newest first` |
| Any filter or query active | Results header → filtered grid. **No strip** |

#### Vertical chrome budget

Option 3 stacks a lot above the first card. The running total on arrival:

```
header / search          ~64px
filter bar               ~52px
[active chips]           ~40px   (conditional — only when filtering)
featured strip          ~260px   (conditional — only when NOT filtering)
results header           ~40px
─────────────────────────────
first card at            ~416px on arrival, ~196px once filtering
```

The two conditional rows are mutually exclusive by the rule above, which is what
keeps this from becoming four stacked bars. Nothing further may be added above the
grid without removing something.

#### Consequence: the quick-search pills fold into the Artist facet

With a featured strip already above the grid, a separate "Jump to" pill row would be
a fourth bar of chrome competing with it. The six pills become **pinned options at
the top of the Artist facet popover** instead — same shortcut, no extra chrome, and
they gain the counts every other facet option has.

The tagline moves to the sidebar footer.

---

## Build order — Phase 1

Bottom-up: everything downstream depends on the first two, and both are pure
functions that can be verified without any UI.

| # | Slice | Notes |
|---|---|---|
| 1 | `src/lib/url.ts` — canonical serializer + parser | Pure. Must exist before any URL does |
| 2 | `src/store/filters.ts` — zustand + URL hydration | Pure. One direction each way |
| 3 | `useFacetCounts` — the counting engine | Pure `useMemo` over 829 records |
| 4 | `AppShell` + `Sidebar` + mobile tab bar | Structure before controls |
| 5 | `FilterBar` + `FacetPopover` (base-ui) | Era · Year · Country · Festival |
| 6 | `ActiveFilterChips` + `ResultsHeader` + sort | |
| 7 | Landing composition — conditional strip, grid | Wire `FeaturedRow`, retire `HeroSearch` |
| 8 | `ShowCard` — remove recording-type badge | Small, independent |
| 9 | **Measure** unfiltered grid on a mid-range phone | Decides the Virtuoso question |

Slices 1–3 carry no visual change and are individually testable — good first commit
boundary. Phase 1 is unblocked by Phase 0 except the `Country` facet, which will
show `England` and `US` as separate rows until the data lands on `main`.

---

## Open questions

1. **Analytics tool** — GA confirmed, later. No action now beyond the seam.

### Resolved

- ~~Mobile navigation~~ → bottom tab bar
- ~~Landing view~~ → browse grid (provisional)
- ~~Sort options~~ → Year newest / Year oldest / Artist A–Z
- ~~Arrival composition~~ → curated strip + full grid, strip hidden while filtering
- ~~Quick-search pills~~ → pinned options in the Artist facet
- ~~Tagline~~ → sidebar footer

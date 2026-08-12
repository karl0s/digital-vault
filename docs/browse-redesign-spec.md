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
| Overlay | Full sheet over content | `<768px`, opened from the hamburger |

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

**Virtuoso deliberately deferred.** The threshold is 1,000+ rows; the worst case here
is 829 and filtering only shrinks it. `LazyImage` already defers the real cost.
`@tanstack/react-virtual` was removed in `76452e6` as unused — do not re-add a
virtualizer without a measurement showing the grid stutters.

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

## Open questions

1. **Sidebar on mobile** — overlay sheet (spec'd) or bottom tab bar? Overlay matches
   YouTube; a tab bar suits a phone-first audience better. Needs a call before Phase 1.
2. **Default landing view** — keep the current hero, or land straight in the filtered
   browse grid? The hero is beautiful but adds a click before the archive appears.
3. **Sort options** — Newest / Oldest / Artist proposed. Anything else worth having?
4. **Analytics tool** — GA confirmed, later. No action now beyond the seam.

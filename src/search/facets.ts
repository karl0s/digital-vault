import { Show } from '../../App';
import { FACET_KEYS, FacetKey, FilterState, NONE, SortKey, slugify } from '../lib/url';

/**
 * Faceted filtering, counting and sorting over the show catalogue.
 *
 * Pure functions over an in-memory array. 829 records is small enough that every
 * count is recomputed synchronously on each interaction — no debounce, no async,
 * no backend.
 */

// ─── derivation ──────────────────────────────────────────────────────────────

/**
 * Each show reduced to its facet values once, so filtering never re-parses
 * dates or re-slugifies strings on every keystroke.
 */
export interface DerivedShow {
  show: Show;
  era: string;        // '1990s' | NONE
  year: number | null;
  country: string;    // slug | NONE
  festival: string;   // slug | NONE
  type: string;       // slug, defaults to 'live'
  artist: string;
  /** Sortable date key; '' for undated, which always sorts last. */
  dateKey: string;
}

function deriveEra(showDate: string): string {
  const m = /^(\d{4})/.exec(showDate);
  if (!m) return NONE;
  return `${m[1].slice(0, 3)}0s`;
}

function deriveYear(showDate: string): number | null {
  const m = /^(\d{4})/.exec(showDate);
  return m ? Number.parseInt(m[1], 10) : null;
}

/**
 * ContentType is a Phase 0 field that does not exist on most records yet.
 * Until it lands, everything untagged reads as 'live' — except the 18 shows
 * already carrying RecordingType 'Documentary', which are honoured now so the
 * facet is useful before the tagging pass completes.
 */
function deriveType(show: Show): string {
  const explicit = (show as Show & { ContentType?: string }).ContentType;
  if (explicit && explicit.trim()) return slugify(explicit);
  if ((show.RecordingType || '').toLowerCase().includes('documentary')) return 'documentary';
  return 'live';
}

export function deriveShow(show: Show): DerivedShow {
  const date = (show.ShowDate || '').trim();
  return {
    show,
    era: deriveEra(date),
    year: deriveYear(date),
    country: show.Country?.trim() ? slugify(show.Country) : NONE,
    festival: show.EventOrFestival?.trim() ? slugify(show.EventOrFestival) : NONE,
    type: deriveType(show),
    artist: show.Artist,
    dateKey: /^\d{4}/.test(date) ? date : '',
  };
}

export function deriveAll(shows: Show[]): DerivedShow[] {
  return shows.map(deriveShow);
}

// ─── matching ────────────────────────────────────────────────────────────────

function facetValueOf(d: DerivedShow, facet: FacetKey): string {
  switch (facet) {
    case 'country': return d.country;
    case 'festival': return d.festival;
    case 'type': return d.type;
  }
}

const TYPE_LABELS: Record<string, string> = {
  live: 'Live shows',
  documentary: 'Documentaries',
};

/**
 * Human label for an option. Values are slugs, so the label comes from the
 * record's original string — that keeps "Rock am Ring" readable rather than
 * showing "rock-am-ring", without needing a reverse slug table.
 *
 * The NONE sentinel is labelled per facet: the data meaning is identical
 * ("field is empty") but "Unknown location" and "No festival" say different
 * things to a reader.
 */
function facetLabelOf(d: DerivedShow, facet: FacetKey): string {
  switch (facet) {
    case 'country': return d.show.Country?.trim() || 'Unknown location';
    case 'festival': return d.show.EventOrFestival?.trim() || 'No festival';
    case 'type': return TYPE_LABELS[d.type] ?? d.type;
  }
}

/**
 * Does this show fall inside the active year range?
 *
 * Undated shows are out unless explicitly opted in — a show with no date is not
 * "in" 1993-2011 — but when no range is set at all they are simply included,
 * because then nothing is being asked about years.
 */
function matchesYear(d: DerivedShow, state: FilterState): boolean {
  const bounded = state.from !== null || state.to !== null;

  if (d.year === null) return bounded ? state.undated : true;
  if (state.from !== null && d.year < state.from) return false;
  if (state.to !== null && d.year > state.to) return false;
  return true;
}

/**
 * Does this show survive the active filters?
 *
 * `except` omits one facet, which is what makes counts honest — see
 * `computeFacetCounts`. Within a facet the test is OR; across facets it is AND.
 */
function matches(
  d: DerivedShow,
  state: FilterState,
  searchIds: Set<string> | null,
  except?: FacetKey | 'year',
): boolean {
  if (searchIds && !searchIds.has(d.show.ShowID)) return false;
  if (except !== 'year' && !matchesYear(d, state)) return false;

  for (const facet of FACET_KEYS) {
    if (facet === except) continue;
    const selected = state[facet];
    if (selected.length === 0) continue;
    const value = facetValueOf(d, facet);
    if (!selected.map(String).includes(value)) return false;
  }
  return true;
}

// ─── counting ────────────────────────────────────────────────────────────────

export interface FacetOption {
  value: string;
  /** Display string — the record's original text, not the slug. */
  label: string;
  count: number;
  selected: boolean;
}

export type FacetCounts = Record<FacetKey, FacetOption[]>;

/**
 * Counts per option, computed against every facet EXCEPT the one being counted.
 *
 * This is the difference between a real faceted search and a checkbox list. Count
 * a facet against its own selection and picking '1990s' still advertises
 * 'Germany (123)' while actually yielding 31 — the interface has lied. Excluding
 * the facet answers the question the user is really asking: "if I also picked
 * this, how many would I get?"
 *
 * Zero-count options are still returned, so the UI can disable rather than hide
 * them. Hiding makes options vanish under the cursor and conceals the shape of
 * the collection; disabling teaches it.
 */
export function computeFacetCounts(
  derived: DerivedShow[],
  state: FilterState,
  searchIds: Set<string> | null,
): FacetCounts {
  const counts = {} as FacetCounts;

  for (const facet of FACET_KEYS) {
    const tally = new Map<string, number>();
    const labels = new Map<string, string>();

    // Every value in the corpus starts at zero so options never disappear.
    for (const d of derived) {
      const value = facetValueOf(d, facet);
      tally.set(value, 0);
      if (!labels.has(value)) labels.set(value, facetLabelOf(d, facet));
    }

    for (const d of derived) {
      if (!matches(d, state, searchIds, facet)) continue;
      const value = facetValueOf(d, facet);
      tally.set(value, (tally.get(value) ?? 0) + 1);
    }

    const selected = new Set(state[facet].map(String));
    counts[facet] = [...tally.entries()]
      .map(([value, count]) => ({
        value,
        label: labels.get(value) ?? value,
        count,
        selected: selected.has(value),
      }))
      .sort(sortFacetOptions(facet));
  }

  return counts;
}

/**
 * Era and year read as ordered scales; everything else is ranked by count so the
 * useful options surface above a long tail (154 festivals, 91 of them singletons).
 * NONE always sinks to the bottom — it is a fallback, not a headline.
 */
function sortFacetOptions(_facet: FacetKey) {
  return (a: FacetOption, b: FacetOption): number => {
    if (a.value === NONE) return 1;
    if (b.value === NONE) return -1;
    if (b.count !== a.count) return b.count - a.count;
    return a.value.localeCompare(b.value);
  };
}

// ─── year histogram ──────────────────────────────────────────────────────────

export interface YearBin {
  year: number;
  count: number;
}

export interface YearHistogram {
  bins: YearBin[];
  minYear: number;
  maxYear: number;
  /** Tallest bar, for scaling. 1 rather than 0 so an empty result cannot divide by zero. */
  peak: number;
  /** Undated shows surviving every other filter — the checkbox's live count. */
  undatedCount: number;
}

/**
 * Per-year counts for the brush, computed against every filter EXCEPT the year
 * range itself.
 *
 * Excluding its own range is what keeps the control usable: count the histogram
 * against its own selection and every bar outside the range collapses to zero
 * the moment you drag, leaving nothing to aim at. The bars must always show the
 * full distribution as it stands under the *other* filters.
 *
 * Bins are contiguous — years with no shows are present with count 0 — so the
 * x-axis stays linear in time and gaps read as genuinely empty rather than
 * being silently closed up.
 */
export function computeYearHistogram(
  derived: DerivedShow[],
  state: FilterState,
  searchIds: Set<string> | null,
): YearHistogram {
  const tally = new Map<number, number>();
  let undatedCount = 0;

  for (const d of derived) {
    if (!matches(d, state, searchIds, 'year')) continue;
    if (d.year === null) { undatedCount++; continue; }
    tally.set(d.year, (tally.get(d.year) ?? 0) + 1);
  }

  const dated = [...tally.keys()];
  if (dated.length === 0) {
    return { bins: [], minYear: 0, maxYear: 0, peak: 1, undatedCount };
  }

  const minYear = Math.min(...dated);
  const maxYear = Math.max(...dated);
  const bins: YearBin[] = [];
  for (let year = minYear; year <= maxYear; year++) {
    bins.push({ year, count: tally.get(year) ?? 0 });
  }

  return {
    bins,
    minYear,
    maxYear,
    peak: Math.max(1, ...bins.map(b => b.count)),
    undatedCount,
  };
}

// ─── filtering + sorting ─────────────────────────────────────────────────────

export function applyFilters(
  derived: DerivedShow[],
  state: FilterState,
  searchIds: Set<string> | null,
): Show[] {
  return derived.filter(d => matches(d, state, searchIds)).map(d => d.show);
}

/**
 * Undated shows sort last in BOTH directions.
 *
 * Undated is not "year zero" — flipping to oldest-first must not surface 64
 * unknowns above a 1968 recording. Ties break on artist then ShowID so the order
 * is stable across renders rather than depending on array order.
 */
export function sortShows(shows: Show[], sort: SortKey): Show[] {
  const out = [...shows];

  if (sort === 'artist') {
    return out.sort(
      (a, b) =>
        a.Artist.localeCompare(b.Artist, undefined, { sensitivity: 'base' }) ||
        (b.ShowDate || '').localeCompare(a.ShowDate || '') ||
        a.ShowID.localeCompare(b.ShowID),
    );
  }

  const dir = sort === 'year-asc' ? 1 : -1;
  return out.sort((a, b) => {
    const ad = /^\d{4}/.test(a.ShowDate || '') ? a.ShowDate : '';
    const bd = /^\d{4}/.test(b.ShowDate || '') ? b.ShowDate : '';
    if (!ad && !bd) {
      return (
        (a.EventOrFestival || '').localeCompare(b.EventOrFestival || '', undefined, { numeric: true }) ||
        a.ShowID.localeCompare(b.ShowID)
      );
    }
    if (!ad) return 1;
    if (!bd) return -1;
    return ad.localeCompare(bd) * dir ||
      a.Artist.localeCompare(b.Artist) ||
      a.ShowID.localeCompare(b.ShowID);
  });
}

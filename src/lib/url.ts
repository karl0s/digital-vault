/**
 * Canonical URL serialization for filter state.
 *
 * One logical view must always produce exactly one URL string. If it doesn't,
 * analytics splits that view across several rows and the history can never be
 * repaired — you'd be comparing data from before and after the fix that don't
 * share a shape. That is why this module exists before any URL does.
 *
 * The four rules, all enforced by `serializeFilters`:
 *   1. keys emitted in a fixed order, never object-key order
 *   2. multi-values sorted, so ?country=france,germany == ?country=germany,france
 *   3. empty facets omitted entirely — no ?country=&festival=
 *   4. values slugified, so casing and spacing can't fork a URL
 *
 * Query params on the root path, not path segments: GitHub Pages has no SPA
 * fallback and this repo has no 404.html, so /browse/1990s would 404 before any
 * JS runs. See docs/browse-redesign-spec.md.
 */

export type SortKey = 'year-desc' | 'year-asc' | 'artist';

export const DEFAULT_SORT: SortKey = 'year-desc';

/**
 * There is one page (2026-10-13): the Artists destination became the A–Z list
 * under Featured shows, so there is no `view` any more. An old `?view=artists`
 * link is honoured once by App, which jumps to that list.
 */
export const LEGACY_VIEW_PARAM = 'view';

/**
 * Sentinel for "this field is empty on the record".
 *
 * A show with no Country must stay reachable — dozens have none, and hundreds
 * have no festival. They get a real, selectable facet option rather than
 * silently dropping out of every filtered view. The UI labels it per facet
 * ("Unknown location" vs "No event"); the data meaning is the same.
 */
export const NONE = 'none';

export interface FilterState {
  q: string;
  /**
   * Inclusive year range. `null` on either end means unbounded, which is why
   * the serializer never needs to know the archive's actual span — a new 1962
   * recording cannot make a hardcoded bound go stale.
   */
  from: number | null;
  to: number | null;
  /**
   * Undated shows are excluded from a year range by default: a show with no
   * date is not "in" 1993-2011. This opts them back in, so they stay
   * reachable rather than silently vanishing whenever a range is set.
   */
  undated: boolean;
  country: string[];
  festival: string[];
  sort: SortKey;
}

export const EMPTY_FILTERS: FilterState = {
  q: '',
  from: null,
  to: null,
  undated: false,
  country: [],
  festival: [],
  sort: DEFAULT_SORT,
};

/**
 * Multi-select facets only. The year range is deliberately not one of these —
 * it is a range with its own controls, not a list of checkboxes.
 */
export const FACET_KEYS = ['country', 'festival'] as const;
export type FacetKey = (typeof FACET_KEYS)[number];

/** Rule 1. Emission order is fixed here and nowhere else. */
const PARAM_ORDER = [
  'q', 'from', 'to', 'undated', 'country', 'festival', 'sort',
] as const;

/** Rejects nonsense years from a hand-edited URL without pinning the data span. */
const YEAR_FLOOR = 1900;
const YEAR_CEILING = 2100;

function parseYear(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= YEAR_FLOOR && n <= YEAR_CEILING ? n : null;
}

const SORT_KEYS: readonly SortKey[] = ['year-desc', 'year-asc', 'artist'];

/**
 * Lowercase, strip accents, collapse anything non-alphanumeric to single dashes.
 *
 * Both sides get slugified — the URL value and the value read off the show — so
 * there is no reverse lookup table to keep in sync. A useful side effect: casing
 * variants in the data ("Rock Am Ring" vs "Rock am Ring") collapse to one facet
 * option instead of two.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // combining diacritics: Eurockéennes -> eurockeennes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

/**
 * FilterState -> canonical query string, including the leading "?".
 * Returns "" when nothing is active, so the bare URL stays clean.
 */
export function serializeFilters(state: FilterState): string {
  const parts: string[] = [];

  for (const key of PARAM_ORDER) {
    if (key === 'q') {
      const q = state.q.trim();
      if (q) parts.push(`q=${encodeURIComponent(q)}`);
      continue;
    }

    if (key === 'sort') {
      // Rule 3: the default is implied, never spelled out.
      if (state.sort !== DEFAULT_SORT) parts.push(`sort=${state.sort}`);
      continue;
    }

    if (key === 'from' || key === 'to') {
      const value = state[key];
      if (value !== null) parts.push(`${key}=${value}`);
      continue;
    }

    if (key === 'undated') {
      // Only the non-default is spelled out, same rule as sort.
      if (state.undated) parts.push('undated=1');
      continue;
    }

    const values = uniqueSorted(state[key]);
    if (values.length) parts.push(`${key}=${values.map(encodeURIComponent).join(',')}`);
  }

  return parts.length ? `?${parts.join('&')}` : '';
}

function readList(params: URLSearchParams, key: string): string[] {
  const raw = params.get(key);
  if (!raw) return [];
  return uniqueSorted(raw.split(',').map(v => slugify(decodeURIComponent(v))));
}

/** Query string -> FilterState. Unknown params and junk values are dropped. */
export function parseFilters(search: string): FilterState {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);

  const rawSort = params.get('sort') as SortKey | null;

  let from = parseYear(params.get('from'));
  let to = parseYear(params.get('to'));
  // A reversed range is a typo, not an empty result set. Swap rather than
  // silently returning nothing.
  if (from !== null && to !== null && from > to) [from, to] = [to, from];

  return {
    q: (params.get('q') ?? '').trim(),
    from,
    to,
    undated: params.get('undated') === '1',
    country: readList(params, 'country'),
    festival: readList(params, 'festival'),
    sort: rawSort && SORT_KEYS.includes(rawSort) ? rawSort : DEFAULT_SORT,
  };
}

/** True when anything is filtering — the featured strip renders only when this is false. */
export function isFiltered(state: FilterState): boolean {
  return (
    state.q.trim().length > 0 ||
    state.from !== null ||
    state.to !== null ||
    state.undated ||
    FACET_KEYS.some(key => state[key].length > 0)
  );
}

/** Count of active facet values, for the "Clear all" affordance. */
export function activeFilterCount(state: FilterState): number {
  const facets = FACET_KEYS.reduce((n, key) => n + state[key].length, 0);
  // A range counts once however many ends are set — it reads as one chip.
  const range = state.from !== null || state.to !== null ? 1 : 0;
  return facets + range + (state.undated ? 1 : 0) + (state.q.trim() ? 1 : 0);
}

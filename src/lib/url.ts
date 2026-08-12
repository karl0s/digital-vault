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
 *   2. multi-values sorted, so ?era=1990s,2000s == ?era=2000s,1990s
 *   3. empty facets omitted entirely — no ?era=&country=
 *   4. values slugified, so casing and spacing can't fork a URL
 *
 * Query params on the root path, not path segments: GitHub Pages has no SPA
 * fallback and this repo has no 404.html, so /browse/1990s would 404 before any
 * JS runs. See docs/browse-redesign-spec.md.
 */

export type SortKey = 'year-desc' | 'year-asc' | 'artist';

export const DEFAULT_SORT: SortKey = 'year-desc';

/**
 * Destinations. Not a facet — a destination decides *what* you are looking at,
 * facets refine it. Lives in the URL anyway so a view can be linked and shared,
 * and it is emitted first because it is the coarsest part of the address.
 */
export type ViewKey = 'browse' | 'artists';

export const DEFAULT_VIEW: ViewKey = 'browse';

const VIEW_KEYS: readonly ViewKey[] = ['browse', 'artists'];

/**
 * Sentinel for "this field is empty on the record".
 *
 * A show with no Country must stay reachable — 135 of them have none, and 341
 * have no festival. They get a real, selectable facet option rather than
 * silently dropping out of every filtered view. The UI labels it per facet
 * ("Unknown location" vs "No festival"); the data meaning is the same.
 */
export const NONE = 'none';

export interface FilterState {
  view: ViewKey;
  q: string;
  era: string[];
  year: number[];
  country: string[];
  festival: string[];
  type: string[];
  sort: SortKey;
}

export const EMPTY_FILTERS: FilterState = {
  view: DEFAULT_VIEW,
  q: '',
  era: [],
  year: [],
  country: [],
  festival: [],
  type: [],
  sort: DEFAULT_SORT,
};

/** Facet keys only — `q` and `sort` are not facets and are handled separately. */
export const FACET_KEYS = ['era', 'year', 'country', 'festival', 'type'] as const;
export type FacetKey = (typeof FACET_KEYS)[number];

/** Rule 1. Emission order is fixed here and nowhere else. */
const PARAM_ORDER = ['view', 'q', 'era', 'year', 'country', 'festival', 'type', 'sort'] as const;

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

function uniqueSortedNums(values: number[]): number[] {
  return [...new Set(values.filter(n => Number.isFinite(n)))].sort((a, b) => a - b);
}

/**
 * FilterState -> canonical query string, including the leading "?".
 * Returns "" when nothing is active, so the bare URL stays clean.
 */
export function serializeFilters(state: FilterState): string {
  const parts: string[] = [];

  for (const key of PARAM_ORDER) {
    if (key === 'view') {
      // Default destination is implied, same rule as default sort.
      if (state.view !== DEFAULT_VIEW) parts.push(`view=${state.view}`);
      continue;
    }

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

    if (key === 'year') {
      const years = uniqueSortedNums(state.year);
      if (years.length) parts.push(`year=${years.join(',')}`);
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
  const rawView = params.get('view') as ViewKey | null;
  const years = (params.get('year') ?? '')
    .split(',')
    .map(v => Number.parseInt(v, 10))
    // Bounded to plausible concert years so ?year=99999999 can't reach the UI.
    .filter(n => Number.isFinite(n) && n >= 1900 && n <= 2100);

  return {
    view: rawView && VIEW_KEYS.includes(rawView) ? rawView : DEFAULT_VIEW,
    q: (params.get('q') ?? '').trim(),
    era: readList(params, 'era'),
    year: uniqueSortedNums(years),
    country: readList(params, 'country'),
    festival: readList(params, 'festival'),
    type: readList(params, 'type'),
    sort: rawSort && SORT_KEYS.includes(rawSort) ? rawSort : DEFAULT_SORT,
  };
}

/** True when nothing is filtering — drives whether the featured strip renders. */
export function isFiltered(state: FilterState): boolean {
  return (
    state.q.trim().length > 0 ||
    FACET_KEYS.some(key => state[key].length > 0)
  );
}

/** Count of active facet values, for the "Clear all" affordance. */
export function activeFilterCount(state: FilterState): number {
  return FACET_KEYS.reduce((n, key) => n + state[key].length, 0) + (state.q.trim() ? 1 : 0);
}

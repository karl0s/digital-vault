import { create } from 'zustand';
import {
  DEFAULT_SORT,
  EMPTY_FILTERS,
  FACET_KEYS,
  FacetKey,
  FilterState,
  Layout,
  SortKey,
  parseFilters,
  readShowParam,
  serializeFilters,
  withShowParam,
} from '../lib/url';

/**
 * Filter state, with the URL as its serialization format.
 *
 * One direction each way: URL -> store on load and on back/forward, store -> URL
 * on every mutation. Never a loop — `applyingFromUrl` guards the return trip,
 * because writing the URL inside a popstate handler would fight the browser.
 */

interface FilterActions {
  /** Add or remove one value from a facet. */
  toggleFacet: (facet: FacetKey, value: string | number) => void;
  /** Replace a facet's values outright. */
  setFacet: (facet: FacetKey, values: (string | number)[]) => void;
  setQuery: (q: string) => void;
  /** Commit a year range. Nulls mean unbounded; call with (null, null) to clear. */
  setYearRange: (from: number | null, to: number | null) => void;
  toggleUndated: () => void;
  setSort: (sort: SortKey) => void;
  setLayout: (layout: Layout) => void;
  clearFacet: (facet: FacetKey) => void;
  clearAll: () => void;
  /** Every filter off, the search kept: the way out of an empty result. */
  clearFilters: () => void;
  /** Back/forward and initial hydration. Does not write the URL back. */
  hydrateFromUrl: (search: string) => void;
}

export type FilterStore = FilterState & FilterActions;

/**
 * The single choke-point every filter mutation passes through.
 *
 * When GA lands it hooks here and nowhere else — the alternative is hunting a
 * dozen scattered setter calls later. Keeping the seam empty costs nothing now.
 */
function commitFilterState(next: FilterState): void {
  if (typeof window === 'undefined') return;

  // The open show's param rides along, and so does the history entry's state:
  // a search typed just before a show opened must not drop the show from the
  // URL, nor the marker that lets closing it step back (App).
  const query = withShowParam(serializeFilters(next), readShowParam(window.location.search));
  const url = `${window.location.pathname}${query}${window.location.hash}`;

  // replaceState, not pushState: ticking four checkboxes should not bury the
  // back button under four entries.
  window.history.replaceState(window.history.state, '', url);

  // GA seam — intentionally empty. Nothing else in the app may call gtag.
  // trackFilterView(query)
}

/** True while applying an external URL change, to suppress the write-back. */
let applyingFromUrl = false;

function readInitialState(): FilterState {
  if (typeof window === 'undefined') return EMPTY_FILTERS;
  return parseFilters(window.location.search);
}

/** Values are compared as strings so numeric years and slugs share one path. */
function toggleValue(list: (string | number)[], value: string | number): string[] {
  const key = String(value);
  const current = list.map(String);
  return current.includes(key) ? current.filter(v => v !== key) : [...current, key];
}

// Every remaining facet holds slug strings — years moved to a range and are no
// longer a multi-select facet, so the numeric special case is gone.

/** Every facet empty: Country, Event and the "More filters". */
const NO_FACETS = Object.fromEntries(FACET_KEYS.map(key => [key, []])) as unknown as Pick<FilterState, FacetKey>;

export const useFilterStore = create<FilterStore>((set, get) => {
  /** Applies a partial change, then syncs the URL unless we came from the URL. */
  const apply = (patch: Partial<FilterState>) => {
    set(patch as Partial<FilterStore>);
    if (!applyingFromUrl) {
      const s = get();
      commitFilterState(selectFilterState(s));
    }
  };

  return {
    ...readInitialState(),

    toggleFacet: (facet, value) => {
      apply({ [facet]: toggleValue(get()[facet], value) } as Partial<FilterState>);
    },

    setFacet: (facet, values) => {
      apply({ [facet]: values.map(String) } as Partial<FilterState>);
    },

    setQuery: q => apply({ q }),

    // Called on pointerup, never during a drag: handle positions live in
    // component state while the gesture runs so replaceState stays off the
    // 60fps path.
    setYearRange: (from, to) => {
      const lo = from !== null && to !== null ? Math.min(from, to) : from;
      const hi = from !== null && to !== null ? Math.max(from, to) : to;
      apply({ from: lo, to: hi });
    },

    toggleUndated: () => apply({ undated: !get().undated }),

    setSort: sort => apply({ sort }),

    setLayout: layout => apply({ layout }),

    clearFacet: facet => apply({ [facet]: [] } as Partial<FilterState>),

    // Sort and layout deliberately survive "clear all" — view preferences, not
    // filters: resetting them would reorder or redraw results the user is reading.
    clearAll: () =>
      apply({ q: '', from: null, to: null, undated: false, ...NO_FACETS }),

    clearFilters: () =>
      apply({ from: null, to: null, undated: false, ...NO_FACETS }),

    hydrateFromUrl: search => {
      applyingFromUrl = true;
      try {
        set(parseFilters(search) as Partial<FilterStore>);
      } finally {
        applyingFromUrl = false;
      }
    },
  };
});

/**
 * Wires browser back/forward to the store. Call once, from the app root.
 * Returns a teardown so StrictMode's double-invoke doesn't stack listeners.
 */
export function initFilterUrlSync(): () => void {
  if (typeof window === 'undefined') return () => {};

  // Opening and closing a show moves through history too (App, ?show=). Those
  // steps leave the filters as they were, so they are skipped here: hydrating
  // would hand every subscriber new arrays and recompute the results in the
  // frame the drawer is closing.
  const onPopState = () => {
    const store = useFilterStore.getState();
    if (serializeFilters(parseFilters(window.location.search)) === serializeFilters(selectFilterState(store))) return;
    store.hydrateFromUrl(window.location.search);
  };

  window.addEventListener('popstate', onPopState);
  return () => window.removeEventListener('popstate', onPopState);
}

/** Plain snapshot of the serializable state, without the actions. */
export function selectFilterState(s: FilterState): FilterState {
  return {
    q: s.q, from: s.from, to: s.to, undated: s.undated,
    country: s.country, festival: s.festival,
    quality: s.quality, standard: s.standard, length: s.length, setlist: s.setlist,
    sort: s.sort, layout: s.layout,
  };
}

export { DEFAULT_SORT };

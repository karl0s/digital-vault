import { create } from 'zustand';
import {
  DEFAULT_SORT,
  EMPTY_FILTERS,
  FacetKey,
  FilterState,
  SortKey,
  ViewKey,
  parseFilters,
  serializeFilters,
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
  /** Change destination. Pushes history rather than replacing — see below. */
  setView: (view: ViewKey) => void;
  setSort: (sort: SortKey) => void;
  clearFacet: (facet: FacetKey) => void;
  clearAll: () => void;
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

  const query = serializeFilters(next);
  const url = `${window.location.pathname}${query}${window.location.hash}`;

  // replaceState, not pushState: ticking four checkboxes should not bury the
  // back button under four entries. Destination changes push; refinement replaces.
  window.history.replaceState(null, '', url);

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

/** Years live in state as numbers; every other facet as slug strings. */
function coerce(facet: FacetKey, values: string[]): string[] | number[] {
  if (facet !== 'year') return values;
  return values.map(v => Number.parseInt(v, 10)).filter(Number.isFinite);
}

export const useFilterStore = create<FilterStore>((set, get) => {
  /** Applies a partial change, then syncs the URL unless we came from the URL. */
  const apply = (patch: Partial<FilterState>) => {
    set(patch as Partial<FilterStore>);
    if (!applyingFromUrl) {
      const s = get();
      commitFilterState({
        view: s.view, q: s.q, era: s.era, year: s.year, country: s.country,
        festival: s.festival, type: s.type, sort: s.sort,
      });
    }
  };

  return {
    ...readInitialState(),

    toggleFacet: (facet, value) => {
      const next = toggleValue(get()[facet], value);
      apply({ [facet]: coerce(facet, next) } as Partial<FilterState>);
    },

    setFacet: (facet, values) => {
      apply({ [facet]: coerce(facet, values.map(String)) } as Partial<FilterState>);
    },

    setQuery: q => apply({ q }),

    // Destination changes push a history entry; facet refinements replace one.
    // Back should step between places you visited, not undo every checkbox.
    setView: view => {
      set({ view });
      const s = get();
      const next: FilterState = {
        view: s.view, q: s.q, era: s.era, year: s.year,
        country: s.country, festival: s.festival, type: s.type, sort: s.sort,
      };
      if (typeof window !== 'undefined') {
        const query = serializeFilters(next);
        window.history.pushState(null, '', `${window.location.pathname}${query}${window.location.hash}`);
      }
    },

    setSort: sort => apply({ sort }),

    clearFacet: facet => apply({ [facet]: [] } as Partial<FilterState>),

    // Sort deliberately survives "clear all" — it is a view preference, not a
    // filter, and resetting it would silently reorder results the user is reading.
    clearAll: () => apply({ q: '', era: [], year: [], country: [], festival: [], type: [] }),

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

  const onPopState = () => {
    useFilterStore.getState().hydrateFromUrl(window.location.search);
  };

  window.addEventListener('popstate', onPopState);
  return () => window.removeEventListener('popstate', onPopState);
}

/** Plain snapshot of the serializable state, without the actions. */
export function selectFilterState(s: FilterStore): FilterState {
  return {
    view: s.view, q: s.q, era: s.era, year: s.year, country: s.country,
    festival: s.festival, type: s.type, sort: s.sort,
  };
}

export { DEFAULT_SORT };

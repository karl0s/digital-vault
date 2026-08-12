import { useMemo } from 'react';
import { Show } from '../../App';
import { FilterState } from '../lib/url';
import { FacetCounts, applyFilters, computeFacetCounts, deriveAll, sortShows } from '../search/facets';
import { getSongSuggestion, resolveArtist, runSearch, SongSuggestion } from '../search/searchIndex';
import { useSearchEngine } from './useSearchEngine';

/**
 * One pipeline for the browse view:
 *
 *   text query -> id set -> facet filter -> sort
 *
 * Text search and facets used to be separate systems that never met — the query
 * produced its own result list while the facet engine sat unused. Ordering
 * matters: search narrows first and facets refine *within* that, so the counts a
 * facet shows always describe the results actually on screen.
 *
 * Every step is synchronous. A full recount measures well under a frame on 829
 * records, which is why there is no debounce here.
 */

export interface BrowseResults {
  /** Filtered and sorted, ready to render. */
  results: Show[];
  /** Per-facet options with counts, for the filter bar. */
  counts: FacetCounts;
  /** Total before facets, after text search — for "38 of 240". */
  matchedByQuery: number;
  songSuggestion: SongSuggestion | null;
}

export function useBrowseResults(shows: Show[], state: FilterState): BrowseResults {
  const index = useSearchEngine(shows);

  // Derived once per catalogue load, not per keystroke.
  const derived = useMemo(() => deriveAll(shows), [shows]);

  const query = state.q.trim();

  /**
   * null means "no query", which is different from "a query that matched
   * nothing" — the latter is an empty Set and correctly filters everything out.
   */
  const searchIds = useMemo(() => {
    if (!query) return null;
    return new Set(runSearch(shows, query, index).map(s => s.ShowID));
  }, [shows, query, index]);

  const counts = useMemo(
    () => computeFacetCounts(derived, state, searchIds),
    [derived, state, searchIds],
  );

  const results = useMemo(
    () => sortShows(applyFilters(derived, state, searchIds), state.sort),
    [derived, state, searchIds],
  );

  const songSuggestion = useMemo(() => {
    // Field-scoped queries ("song:kiss") are already explicit; nothing to suggest.
    if (!query || /^\w+:/.test(query)) return null;
    return getSongSuggestion(shows, query, resolveArtist(query, index.artistNames));
  }, [shows, query, index]);

  return {
    results,
    counts,
    matchedByQuery: searchIds ? searchIds.size : shows.length,
    songSuggestion,
  };
}

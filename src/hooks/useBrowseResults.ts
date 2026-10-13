import { useMemo } from 'react';
import { Show } from '../../App';
import { FilterState } from '../lib/url';
import {
  FacetCounts,
  YearHistogram,
  applyFilters,
  computeFacetCounts,
  computeYearHistogram,
  deriveAll,
  sortShows,
} from '../search/facets';
import { getSongSuggestion, resolveArtist, searchShows, SongHit, SongSuggestion } from '../search/searchIndex';
import { useSearchEngine } from './useSearchEngine';
import type { NotesGetter } from './useShows';
import { Portrait, portraitsByArtist } from '../lib/portraits';

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
 * Every step is synchronous. A full recount measures well under a frame on ~1,200
 * records, which is why there is no debounce here.
 */

/** An artist offered as a whole: their shows that pass the filters, in order. */
export interface ArtistMatch {
  name: string;
  shows: Show[];
  /** The tile's picture, best first (src/lib/portraits.ts). */
  portraits: Portrait[];
}

const NO_PORTRAITS: Portrait[] = [];

/**
 * A free-text query's results, grouped by why they matched — artists first,
 * then shows (date, place, event), then songs. Every group is already
 * filtered and sorted; together they hold exactly `results`.
 */
export interface ResultGroups {
  artists: ArtistMatch[];
  shows: Show[];
  songs: Show[];
  songHits: Map<string, SongHit[]>;
  /** Close spellings of an artist, when nothing matched. */
  didYouMean: ArtistMatch[];
  /** Otherwise, the query with a misspelt place or event corrected. */
  correctedQuery: string | null;
}

export interface BrowseResults {
  /** Filtered and sorted, ready to render. */
  results: Show[];
  /** Per-facet options with counts, for the filter bar. */
  counts: FacetCounts;
  /** Per-year bins for the range brush, excluding the year filter itself. */
  histogram: YearHistogram;
  /** Total before facets, after text search — for "38 of 240". */
  matchedByQuery: number;
  songSuggestion: SongSuggestion | null;
  /** Null for an artist view, a decade alone, or a field filter other than song:. */
  groups: ResultGroups | null;
}

export function useBrowseResults(shows: Show[], state: FilterState, getNotes?: NotesGetter): BrowseResults {
  const index = useSearchEngine(shows);

  // Derived once per catalogue load, not per keystroke.
  const derived = useMemo(() => deriveAll(shows), [shows]);

  const query = state.q.trim();

  /**
   * null means "no query", which is different from "a query that matched
   * nothing" — the latter is an empty Set and correctly filters everything out.
   */
  // getNotes changes once, when Notes arrive, so a `note:` search fills in.
  const search = useMemo(
    () => (query ? searchShows(shows, query, index, getNotes) : null),
    [shows, query, index, getNotes],
  );
  const searchIds = useMemo(() => (search ? new Set(search.shows.map(s => s.ShowID)) : null), [search]);

  const counts = useMemo(
    () => computeFacetCounts(derived, state, searchIds),
    [derived, state, searchIds],
  );

  const histogram = useMemo(
    () => computeYearHistogram(derived, state, searchIds),
    [derived, state, searchIds],
  );

  const results = useMemo(
    () => sortShows(applyFilters(derived, state, searchIds), state.sort),
    [derived, state, searchIds],
  );

  const portraits = useMemo(() => portraitsByArtist(shows), [shows]);

  const groups = useMemo((): ResultGroups | null => {
    const grouped = search?.grouped;
    if (!grouped) return null;

    const byArtist = new Map<string, Show[]>(grouped.artists.map(name => [name, []]));
    const showMatches: Show[] = [];
    const songMatches: Show[] = [];
    for (const show of results) {
      const kind = grouped.kind.get(show.ShowID);
      if (kind === 'artist') byArtist.get(show.Artist)?.push(show);
      else if (kind === 'show') showMatches.push(show);
      else songMatches.push(show);
    }

    // A suggestion counts what following it would show under the current
    // filters, and is dropped if that is nothing.
    const didYouMean = grouped.didYouMean
      .map(name => ({
        name,
        shows: sortShows(applyFilters(derived, state, new Set(shows.filter(s => s.Artist === name).map(s => s.ShowID))), state.sort),
        portraits: portraits.get(name) ?? NO_PORTRAITS,
      }))
      .filter(a => a.shows.length > 0);

    return {
      artists: [...byArtist]
        .map(([name, list]) => ({ name, shows: list, portraits: portraits.get(name) ?? NO_PORTRAITS }))
        .filter(a => a.shows.length > 0),
      shows: showMatches,
      songs: songMatches,
      songHits: grouped.songs,
      didYouMean,
      correctedQuery: grouped.correctedQuery,
    };
  }, [search, results, derived, state, shows, portraits]);

  const songSuggestion = useMemo(() => {
    // Field-scoped queries ("song:kiss") are already explicit; nothing to suggest.
    if (!query || /^\w+:/.test(query)) return null;
    return getSongSuggestion(shows, query, resolveArtist(query, index.artistNames));
  }, [shows, query, index]);

  return {
    results,
    counts,
    histogram,
    matchedByQuery: searchIds ? searchIds.size : shows.length,
    songSuggestion,
    groups,
  };
}

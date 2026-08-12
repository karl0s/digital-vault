import { useMemo } from 'react';
import { Show } from '../../App';
import { useSearchEngine } from './useSearchEngine';
import { runSearch, resolveArtist, getSongSuggestion } from '../search/searchIndex';

export function useSearchAndFilter(shows: Show[], searchQuery: string) {
  const index = useSearchEngine(shows);

  const filteredShows = useMemo(
    () => runSearch(shows, searchQuery, index),
    [shows, searchQuery, index],
  );

  // When a query resolves to an artist but is also a song word ("Kiss",
  // "Hole"), offer the song search rather than silently hiding it.
  const songSuggestion = useMemo(() => {
    const query = searchQuery.trim();
    if (!query || /^\w+:/.test(query)) return null;
    return getSongSuggestion(shows, query, resolveArtist(query, index.artistNames));
  }, [shows, searchQuery, index]);

  return { filteredShows, songSuggestion };
}

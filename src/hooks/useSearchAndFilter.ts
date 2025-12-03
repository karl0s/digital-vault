import { useMemo } from 'react';
import { Show } from '../App';

/**
 * Custom hook to handle search filtering and artist grouping.
 * Returns filtered shows grouped by artist and sorted alphabetically.
 */
export function useSearchAndFilter(shows: Show[], searchQuery: string) {
  // Filter shows based on search query
  const filteredShows = useMemo(() => {
    return shows.filter(show => {
      if (!searchQuery) return true;
      
      const query = searchQuery.toLowerCase().trim();
      
      // Check for field-specific filters (e.g., "artist:pearl jam", "type:soundboard", "song:alive")
      const fieldMatch = query.match(/^(\w+):(.+)$/);
      
      if (fieldMatch) {
        const [, field, value] = fieldMatch;
        const searchValue = value.toLowerCase().trim();
        
        switch (field) {
          case 'artist':
            return show.Artist.toLowerCase().includes(searchValue);
          case 'type':
            return show.RecordingType?.toLowerCase().includes(searchValue) || false;
          case 'country':
            return show.Country.toLowerCase().includes(searchValue);
          case 'city':
            return show.City.toLowerCase().includes(searchValue);
          case 'venue':
            return show.VenueName.toLowerCase().includes(searchValue);
          case 'event':
            return show.EventOrFestival?.toLowerCase().includes(searchValue) || false;
          case 'song':
            return show.Setlist.toLowerCase().includes(searchValue);
          case 'year':
            return show.ShowDate.includes(searchValue);
          case 'drive':
            return show.MasterDriveName.toLowerCase().includes(searchValue);
          case 'codec':
            return show.VideoCodec.toLowerCase().includes(searchValue);
          default:
            // Unknown field, fall back to general search
            return (
              show.Artist.toLowerCase().includes(query) ||
              show.VenueName.toLowerCase().includes(query) ||
              show.City.toLowerCase().includes(query) ||
              show.Country.toLowerCase().includes(query) ||
              show.ShowDate.includes(query) ||
              (show.EventOrFestival && show.EventOrFestival.toLowerCase().includes(query)) ||
              (show.RecordingType && show.RecordingType.toLowerCase().includes(query)) ||
              show.Setlist.toLowerCase().includes(query) ||
              show.Notes.toLowerCase().includes(query)
            );
        }
      }
      
      // General search (no field prefix)
      return (
        show.Artist.toLowerCase().includes(query) ||
        show.VenueName.toLowerCase().includes(query) ||
        show.City.toLowerCase().includes(query) ||
        show.Country.toLowerCase().includes(query) ||
        show.ShowDate.includes(query) ||
        (show.EventOrFestival && show.EventOrFestival.toLowerCase().includes(query)) ||
        (show.RecordingType && show.RecordingType.toLowerCase().includes(query)) ||
        show.Setlist.toLowerCase().includes(query) ||
        show.Notes.toLowerCase().includes(query)
      );
    });
  }, [shows, searchQuery]);

  // Group shows by artist
  const groupedShows = useMemo(() => {
    return filteredShows.reduce((acc, show) => {
      const artist = show.Artist;
      if (!acc[artist]) {
        acc[artist] = [];
      }
      acc[artist].push(show);
      return acc;
    }, {} as Record<string, Show[]>);
  }, [filteredShows]);

  // Sort artists alphabetically
  const sortedArtists = useMemo(() => {
    return Object.keys(groupedShows).sort();
  }, [groupedShows]);

  return {
    filteredShows,
    groupedShows,
    sortedArtists,
  };
}

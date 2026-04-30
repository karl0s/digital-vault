import { useMemo } from 'react';
import { Show } from '../../App';
import { useSearchEngine } from './useSearchEngine';

export function useSearchAndFilter(shows: Show[], searchQuery: string) {
  const { ms, showById } = useSearchEngine(shows);

  const filteredShows = useMemo(() => {
    if (!searchQuery) return shows;

    const query = searchQuery.toLowerCase().trim();

    // Field-specific filters: "artist:pearl jam", "type:soundboard", etc.
    const fieldMatch = query.match(/^(\w+):(.+)$/);
    if (fieldMatch) {
      const [, field, value] = fieldMatch;
      const v = value.toLowerCase().trim();
      return shows.filter(show => {
        switch (field) {
          case 'artist':  return show.Artist.toLowerCase().includes(v);
          case 'type':    return show.RecordingType?.toLowerCase().includes(v) ?? false;
          case 'country': return show.Country.toLowerCase().includes(v);
          case 'city':    return show.City.toLowerCase().includes(v);
          case 'venue':   return show.VenueName.toLowerCase().includes(v);
          case 'event':   return show.EventOrFestival?.toLowerCase().includes(v) ?? false;
          case 'song':    return show.Setlist.toLowerCase().includes(v);
          case 'year':    return show.ShowDate.includes(v);
          case 'drive':   return show.MasterDriveName.toLowerCase().includes(v);
          case 'codec':   return show.VideoCodec.toLowerCase().includes(v);
          default:
            return (
              show.Artist.toLowerCase().includes(query) ||
              show.VenueName.toLowerCase().includes(query) ||
              show.City.toLowerCase().includes(query) ||
              show.Country.toLowerCase().includes(query) ||
              show.ShowDate.includes(query) ||
              (show.EventOrFestival?.toLowerCase().includes(query) ?? false) ||
              (show.RecordingType?.toLowerCase().includes(query) ?? false) ||
              show.Setlist.toLowerCase().includes(query) ||
              show.Notes.toLowerCase().includes(query)
            );
        }
      });
    }

    // General search — MiniSearch with prefix + fuzzy matching
    const results = ms.search(searchQuery);
    return results.map(r => showById[r.id]).filter(Boolean) as Show[];
  }, [shows, searchQuery, ms, showById]);

  const groupedShows = useMemo(() => {
    return filteredShows.reduce((acc, show) => {
      if (!acc[show.Artist]) acc[show.Artist] = [];
      acc[show.Artist].push(show);
      return acc;
    }, {} as Record<string, Show[]>);
  }, [filteredShows]);

  const sortedArtists = useMemo(() => Object.keys(groupedShows).sort(), [groupedShows]);

  return { filteredShows, groupedShows, sortedArtists };
}

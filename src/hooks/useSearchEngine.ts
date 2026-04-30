import { useMemo } from 'react';
import MiniSearch from 'minisearch';
import { Show } from '../../App';

interface SearchDoc {
  id: string;
  artist: string;
  year: string;
  venue: string;
  city: string;
  country: string;
  type: string;
  event: string;
  searchText: string;
}

function toSearchDoc(show: Show): SearchDoc {
  const year = show.ShowDate ? show.ShowDate.split('-')[0] : '';
  return {
    id: show.ShowID,
    artist: show.Artist,
    year,
    venue: show.VenueName,
    city: show.City,
    country: show.Country,
    type: show.RecordingType || '',
    event: show.EventOrFestival || '',
    searchText: [
      show.Artist,
      year,
      show.VenueName,
      show.City,
      show.Country,
      show.EventOrFestival || '',
      show.RecordingType || '',
      show.Setlist,
      show.Notes,
    ].join(' '),
  };
}

export function useSearchEngine(shows: Show[]) {
  return useMemo(() => {
    const ms = new MiniSearch<SearchDoc>({
      fields: ['artist', 'year', 'venue', 'city', 'country', 'type', 'event', 'searchText'],
      storeFields: ['id'],
      searchOptions: {
        prefix: true,
        fuzzy: 0.15,
        boost: { artist: 4, type: 2, year: 2, event: 1.5 },
        combineWith: 'AND',
      },
    });

    const showById: Record<string, Show> = {};
    const docs = shows.map(show => {
      showById[show.ShowID] = show;
      return toSearchDoc(show);
    });

    if (docs.length > 0) ms.addAll(docs);

    return { ms, showById };
  }, [shows]);
}

import { useMemo } from 'react';
import { Show } from '../../App';
import { useSearchEngine } from './useSearchEngine';

// Maps decade keywords → [startYear, endYear] (inclusive)
const DECADE_MAP: Record<string, [number, number]> = {
  'fifties':    [1950, 1959],
  '50s':        [1950, 1959],
  'sixties':    [1960, 1969],
  '60s':        [1960, 1969],
  'seventies':  [1970, 1979],
  '70s':        [1970, 1979],
  'eighties':   [1980, 1989],
  '80s':        [1980, 1989],
  'nineties':   [1990, 1999],
  '90s':        [1990, 1999],
  'thousands':  [2000, 2009],
  'noughties':  [2000, 2009],
  '2000s':      [2000, 2009],
  '00s':        [2000, 2009],
  'tens':       [2010, 2019],
  '2010s':      [2010, 2019],
  '10s':        [2010, 2019],
  'twenties':   [2020, 2029],
  '2020s':      [2020, 2029],
  '20s':        [2020, 2029],
};

function getShowYear(show: Show): number {
  return parseInt(show.ShowDate?.split('-')[0] || '0');
}

function isUndated(show: Show): boolean {
  const date = show.ShowDate || '';
  if (!date) return true;                   // empty string
  if (!/^\d{4}/.test(date)) return true;   // "Compilation" or any non-year string
  if (date.startsWith('0000')) return true; // 0000-00-00
  return false;
}

function sortChronological(a: Show, b: Show): number {
  const aUndated = isUndated(a);
  const bUndated = isUndated(b);
  if (aUndated && bUndated) return 0;
  if (aUndated) return 1;
  if (bUndated) return -1;
  // Most recent first — ShowDate is YYYY-MM-DD so string comparison works
  return (b.ShowDate || '').localeCompare(a.ShowDate || '');
}

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
      }).sort(sortChronological);
    }

    // Decade search — detect decade keyword anywhere in the query
    const words = query.split(/\s+/);
    const decadeWord = words.find(w => DECADE_MAP[w]);
    if (decadeWord) {
      const [start, end] = DECADE_MAP[decadeWord];
      const decadeFiltered = shows.filter(show => {
        const year = getShowYear(show);
        return year >= start && year <= end;
      });

      // If there are other words alongside the decade, run them through
      // MiniSearch on the decade-filtered subset
      const remainingWords = words.filter(w => w !== decadeWord).join(' ').trim();
      if (!remainingWords) return [...decadeFiltered].sort(sortChronological);

      const remainingResults = ms.search(remainingWords);
      const matchingIds = new Set(remainingResults.map(r => r.id));
      return decadeFiltered.filter(show => matchingIds.has(show.ShowID)).sort(sortChronological);
    }

    // General search — MiniSearch with prefix + fuzzy matching
    const results = ms.search(searchQuery);
    return (results.map(r => showById[r.id]).filter(Boolean) as Show[]).sort(sortChronological);
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

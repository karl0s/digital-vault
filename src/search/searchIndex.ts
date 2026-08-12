import MiniSearch from 'minisearch';
import type { Show } from '../../App';

/**
 * Pure search logic — no React, no DOM.
 *
 * Lives outside the hooks so it can be imported directly by
 * `scripts/search-precision.ts`, which scores every artist view for
 * precision and recall. Keeping the index config in one place means the
 * test harness can never drift from what the app actually runs.
 */

export interface SearchDoc {
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

export const SEARCH_FIELDS = [
  'artist', 'year', 'venue', 'city', 'country', 'type', 'event', 'searchText',
] as const;

/**
 * Prefix and fuzzy matching are applied PER TERM, not globally.
 *
 * Blanket `prefix: true` + `fuzzy: 0.15` turned short tokens into near
 * wildcards: "R.E.M." tokenises to r/e/m, and a 1-character prefix match hits
 * almost every document in the collection. Same for common-word artist names
 * like Who, Tool, Cake and Live.
 *
 * Long terms keep the forgiving behaviour that makes search feel good
 * ("radioh" → Radiohead, "soundgardn" → Soundgarden).
 */
export const SEARCH_OPTIONS = {
  prefix: (term: string) => term.length >= 4,
  fuzzy: (term: string) => (term.length >= 5 ? 0.15 : false),
  boost: { artist: 4, type: 2, year: 2, event: 1.5 },
  combineWith: 'AND' as const,
};

export function toSearchDoc(show: Show): SearchDoc {
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
      // Setlist stays indexed so users can find shows by song.
      //
      // Notes is deliberately NOT indexed. It is largely data-pipeline exhaust
      // (codec lines, lineage text, filenames) and name-drops other bands,
      // which made it the single largest source of cross-artist contamination.
      // It remains searchable via the explicit "note:" prefix.
      show.Setlist,
    ].join(' '),
  };
}

export interface SearchIndex {
  ms: MiniSearch<SearchDoc>;
  showById: Record<string, Show>;
  artistNames: string[];
}

export function createSearchIndex(shows: Show[]): SearchIndex {
  const ms = new MiniSearch<SearchDoc>({
    fields: [...SEARCH_FIELDS],
    storeFields: ['id'],
    searchOptions: SEARCH_OPTIONS,
  });

  const showById: Record<string, Show> = {};
  const seenArtists = new Set<string>();
  const docs = shows.map(show => {
    showById[show.ShowID] = show;
    seenArtists.add(show.Artist);
    return toSearchDoc(show);
  });

  if (docs.length > 0) ms.addAll(docs);

  return { ms, showById, artistNames: [...seenArtists].sort() };
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

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
  if (!/^\d{4}/.test(date)) return true;    // "Compilation" or any non-year string
  if (date.startsWith('0000')) return true; // 0000-00-00
  return false;
}

export function sortChronological(a: Show, b: Show): number {
  const aUndated = isUndated(a);
  const bUndated = isUndated(b);
  if (aUndated && bUndated) {
    // Deterministic grouping for undated shows (compilations, docs, TV specials).
    // Order by event/title so like-titled entries (e.g. "TV Compilation 1..6")
    // cluster together numerically — regardless of the input order, which for
    // general search is MiniSearch relevance order, NOT shows.json file order.
    const byEvent = (a.EventOrFestival || '').localeCompare(b.EventOrFestival || '', undefined, { numeric: true });
    return byEvent !== 0 ? byEvent : a.ShowID.localeCompare(b.ShowID);
  }
  if (aUndated) return 1;
  if (bUndated) return -1;
  // Most recent first — ShowDate is YYYY-MM-DD so string comparison works
  return (b.ShowDate || '').localeCompare(a.ShowDate || '');
}

// ---------------------------------------------------------------------------
// Artist resolution
// ---------------------------------------------------------------------------

/**
 * Shorthand a user might type that should open a specific artist's view.
 * Keys are compared after normalisation, so punctuation and case are ignored.
 * Extend freely — anything not listed simply falls through to normal search.
 */
export const ARTIST_ALIASES: Record<string, string> = {
  stp: 'Stone Temple Pilots',
  rhcp: 'Red Hot Chili Peppers',
  qotsa: 'Queens of the Stone Age',
  smp: 'Smashing Pumpkins',
  rem: 'R.E.M.',
};

/** Lowercase and strip everything that isn't alphanumeric. */
function normaliseArtist(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Decide whether a query names an artist exactly.
 *
 * An artist view must be a structured facet, not a text search — otherwise a
 * setlist annotation like "Vasoline (Stone Temple Pilots cover)" drags a Velvet
 * Revolver show into the Stone Temple Pilots view. Matching is exact after
 * normalisation, so "R.E.M." / "rem" / "Jane's Addiction" / "janes addiction"
 * all resolve, while partial text ("stone temple") stays a normal search.
 *
 * Returns the canonical Artist value, or null if the query isn't an artist name.
 */
export function resolveArtist(query: string, artistNames: string[]): string | null {
  const key = normaliseArtist(query);
  if (!key) return null;

  const alias = ARTIST_ALIASES[key];
  if (alias && artistNames.includes(alias)) return alias;

  return artistNames.find(name => normaliseArtist(name) === key) ?? null;
}

/** Every show by exactly this artist, newest first. */
export function getArtistShows(shows: Show[], artist: string): Show[] {
  return shows.filter(show => show.Artist === artist).sort(sortChronological);
}

export interface ArtistEntry {
  name: string;
  count: number;
}

export interface ArtistGroup {
  /** "#" for names starting with a digit or symbol, otherwise A–Z */
  letter: string;
  artists: ArtistEntry[];
}

/**
 * Every artist in the collection with their show count, grouped A–Z.
 *
 * Built from the full show list rather than the current search results, so the
 * directory always shows the whole catalogue. Recognition beats recall: the
 * count is the information scent an empty search box cannot provide.
 */
export function getArtistDirectory(shows: Show[]): ArtistGroup[] {
  const counts = new Map<string, number>();
  for (const show of shows) {
    counts.set(show.Artist, (counts.get(show.Artist) ?? 0) + 1);
  }

  const entries: ArtistEntry[] = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const groups = new Map<string, ArtistEntry[]>();
  for (const entry of entries) {
    const first = entry.name[0]?.toUpperCase() ?? '#';
    const letter = /[A-Z]/.test(first) ? first : '#';
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter)!.push(entry);
  }

  // "#" sorts before A so numeric names ("30 Seconds to Mars") lead the index.
  return [...groups.entries()]
    .sort(([a], [b]) => (a === '#' ? -1 : b === '#' ? 1 : a.localeCompare(b)))
    .map(([letter, artists]) => ({ letter, artists }));
}

export interface SongSuggestion {
  /** What the user typed, e.g. "Kiss" */
  term: string;
  /** Shows featuring a song by that name that are NOT already in the artist view */
  count: number;
  /** Query to run when the hint is followed */
  query: string;
}

/**
 * Some band names are also ordinary song words — Kiss, Hole, Live, Queen.
 * Those queries resolve to the artist facet, which is almost always what the
 * user wanted, but it silently hides a real song search: "Hole" returns the
 * band's 1 show while 58 shows feature a song with "Hole" in the title.
 *
 * This surfaces that second reading as an offer rather than mixing it into the
 * results. Returns null when there is nothing extra to suggest.
 */
export function getSongSuggestion(
  shows: Show[],
  query: string,
  resolvedArtist: string | null,
): SongSuggestion | null {
  if (!resolvedArtist) return null;

  const term = query.trim();
  const needle = term.toLowerCase();
  if (!needle) return null;

  const extra = shows.filter(
    show => show.Artist !== resolvedArtist && songTitles(show.Setlist).some(t => t.includes(needle)),
  ).length;

  return extra > 0 ? { term, count: extra, query: `song:${term}` } : null;
}

/**
 * Song titles from a setlist, with parenthetical annotations removed.
 *
 * Setlists carry inline annotations by convention — "(Radiohead cover)",
 * "(Acoustic)", "(Live 1999)". A raw substring match treats those as song
 * titles, which would claim a show "features a song called Radiohead" when it
 * actually covers one. Stripping the parentheses keeps the hint honest.
 */
function songTitles(setlist: string): string[] {
  return (setlist || '')
    .split(';')
    .map(track => track.replace(/\([^)]*\)/g, '').trim().toLowerCase())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Query execution
// ---------------------------------------------------------------------------

function runFieldFilter(shows: Show[], field: string, value: string, query: string): Show[] {
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
      case 'note':    return show.Notes.toLowerCase().includes(v);
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

/**
 * Resolve a query string to the exact list of shows it should display.
 * Mirrors the previous inline logic in `useSearchAndFilter` exactly.
 */
export function runSearch(shows: Show[], searchQuery: string, index: SearchIndex): Show[] {
  if (!searchQuery) return shows;

  const { ms, showById } = index;
  const query = searchQuery.toLowerCase().trim();

  // Field-specific filters: "artist:pearl jam", "type:soundboard", etc.
  const fieldMatch = query.match(/^(\w+):(.+)$/);
  if (fieldMatch) {
    const [, field, value] = fieldMatch;
    return runFieldFilter(shows, field, value, query);
  }

  // Artist view — an exact artist name is a facet, never a text search.
  // Checked before decade/general search so an artist name always wins.
  const artist = resolveArtist(query, index.artistNames);
  if (artist) return getArtistShows(shows, artist);

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
}

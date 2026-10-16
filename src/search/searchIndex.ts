import MiniSearch, { type SearchResult } from 'minisearch';
import type { Show } from '../../App';
import { placeAliases, techAliases, KNOWN_TERMS } from './aliases';
import { extractDates } from './dates';

/**
 * Pure search logic — no React, no DOM.
 *
 * Lives outside the hooks so it can be imported directly by
 * `scripts/search-precision.ts`, which scores every artist view for
 * precision and recall. Keeping the index config in one place means the
 * test harness can never drift from what the app actually runs.
 */

interface SearchDoc {
  id: string;
  artist: string;
  year: string;
  venue: string;
  city: string;
  country: string;
  type: string;
  event: string;
  /** Other names for the place and event: "uk", "koln", "titp" (aliases.ts). */
  aka: string;
  /** How it was made, in traders' words: "hd 1080", "pal", "pro shot", "lpcm" (aliases.ts). */
  tech: string;
  songs: string;
}

/**
 * Everything about the show itself — who, when, where, how it was filmed. A
 * free-text match found here is a "show" match; one that needs `songs` to
 * match is a "song" match. The split is what lets results group by why they
 * matched (SearchResultsGrid).
 */
const SHOW_FIELDS = ['artist', 'year', 'venue', 'city', 'country', 'type', 'event', 'aka', 'tech'] as const;
const SEARCH_FIELDS = [...SHOW_FIELDS, 'songs'] as const;

/** Lower case without accents: "bjork" finds Björk, "nurnberg" Nürnberg. */
function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** MiniSearch's own tokeniser, kept so highlighting splits words the same way. */
const WORD = /[^\n\r\p{Z}\p{P}]+/gu;

/**
 * Words match literally. Only the LAST word of a query, the one still being
 * typed, matches as a prefix ("soundg" → Soundgarden), and only from four
 * letters: "R.E.M." tokenises to r/e/m, and a one-letter prefix hits nearly
 * every record. Earlier words are whole, so "black hole" never reaches
 * "Blackbird" through a prefix on "black".
 *
 * No fuzzy matching on content (owner, 2026-10-13). It read "stone" as
 * "stole" and "creep" as "creed": near-misses in setlists that nobody typing
 * a word expects. Misspelt ARTIST names are still caught, as a "Did you mean"
 * (suggestArtists), never silently mixed into the results.
 */
const SEARCH_OPTIONS = {
  prefix: (term: string, i: number, terms: string[]) => i === terms.length - 1 && term.length >= 4,
  fuzzy: false,
  boost: { artist: 4, type: 2, year: 2, event: 1.5 },
  combineWith: 'AND' as const,
};

function toSearchDoc(show: Show): SearchDoc {
  const year = show.ShowDate ? show.ShowDate.split('-')[0] : '';
  return {
    id: show.ShowID,
    artist: show.Artist,
    year,
    venue: show.VenueName,
    city: show.City,
    country: show.Country,
    type: [show.RecordingType, show.ContentType].filter(Boolean).join(' '),
    event: show.EventOrFestival || '',
    aka: placeAliases(show),
    tech: techAliases(show),
    // Setlist is indexed so shows can be found by song.
    //
    // Notes is deliberately NOT indexed. It is largely data-pipeline exhaust
    // (codec lines, lineage text, filenames) and name-drops other bands,
    // which made it the single largest source of cross-artist contamination.
    // It remains searchable via the explicit "note:" prefix.
    songs: show.Setlist || '',
  };
}

interface SearchIndex {
  ms: MiniSearch<SearchDoc>;
  showById: Record<string, Show>;
  artistNames: string[];
  /** Shows per artist, for ranking artist matches and suggestions. */
  artistCounts: Map<string, number>;
}

export function createSearchIndex(shows: Show[]): SearchIndex {
  const ms = new MiniSearch<SearchDoc>({
    fields: [...SEARCH_FIELDS],
    storeFields: ['id'],
    processTerm: fold,
    searchOptions: SEARCH_OPTIONS,
  });

  const showById: Record<string, Show> = {};
  const artistCounts = new Map<string, number>();
  const docs = shows.map(show => {
    showById[show.ShowID] = show;
    artistCounts.set(show.Artist, (artistCounts.get(show.Artist) ?? 0) + 1);
    return toSearchDoc(show);
  });

  if (docs.length > 0) ms.addAll(docs);

  return { ms, showById, artistNames: [...artistCounts.keys()].sort(), artistCounts };
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

function sortChronological(a: Show, b: Show): number {
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
const ARTIST_ALIASES: Record<string, string> = {
  stp: 'Stone Temple Pilots',
  rhcp: 'Red Hot Chili Peppers',
  qotsa: 'Queens of the Stone Age',
  smp: 'Smashing Pumpkins',
  sp: 'Smashing Pumpkins',
  rem: 'R.E.M.',
};

/**
 * Initials the site works out for itself, for any artist of three words or
 * more: RATM, FNM, KOL, NIN, MSP, BRMC, 30STM (docs/ux-research, finding F6).
 * A number stays whole ("30"); an apostrophe joins its word ("Jane's" is one
 * word, so Jane's Addiction gets no initials rather than the wrong ones). Two
 * artists with the same initials get neither, and initials that spell another
 * artist's name never win. Left out: MAS (Mumford & Sons), a Spanish word.
 */
const INITIALS_DENY = new Set(['mas']);
const initialsCache = new WeakMap<string[], Map<string, string>>();

function artistInitials(artistNames: string[]): Map<string, string> {
  const cached = initialsCache.get(artistNames);
  if (cached) return cached;
  const names = new Set(artistNames.map(normaliseArtist));
  const byKey = new Map<string, string[]>();
  for (const name of artistNames) {
    const words = fold(name).replace(/['’]/g, '').replace(/&/g, ' and ').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    const w = words.length > 1 && words[0] === 'the' ? words.slice(1) : words;
    if (w.length < 3) continue;
    const key = w.map(x => (/^\p{N}+$/u.test(x) ? x : x[0])).join('');
    if (key.length < 3 || INITIALS_DENY.has(key) || names.has(key)) continue;
    byKey.set(key, [...(byKey.get(key) ?? []), name]);
  }
  const initials = new Map([...byKey].filter(([, list]) => list.length === 1).map(([key, [name]]) => [key, name]));
  initialsCache.set(artistNames, initials);
  return initials;
}

/**
 * Lowercase, drop a leading "The", read "&" as "and", and strip everything that
 * isn't alphanumeric. Artists are filed without the article (CLAUDE.md →
 * Artist), so "The Strokes" must still find "Strokes".
 */
function normaliseArtist(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/^the\s+/, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');
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

  return artistNames.find(name => normaliseArtist(name) === key) ?? artistInitials(artistNames).get(key) ?? null;
}

/** Every show by exactly this artist, newest first. */
function getArtistShows(shows: Show[], artist: string): Show[] {
  return shows.filter(show => show.Artist === artist).sort(sortChronological);
}

interface ArtistEntry {
  name: string;
  count: number;
}

interface ArtistGroup {
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

/** The fields a query can name: "artist:pearl jam", "song:creep", "year:1997". */
const FIELDS = ['artist', 'type', 'country', 'city', 'venue', 'event', 'song', 'note', 'year', 'date', 'drive', 'codec'] as const;
type Field = typeof FIELDS[number];

/**
 * The same fields as people also type them (F6): plurals, and "festival" for
 * event. "songs:creep" found nothing before, with no hint why.
 */
const FIELD_ALIASES: Record<string, Field> = {
  artists: 'artist', types: 'type', countries: 'country', cities: 'city', venues: 'venue',
  events: 'event', festival: 'event', festivals: 'event', songs: 'song', notes: 'note',
  years: 'year', dates: 'date', drives: 'drive', codecs: 'codec',
};

/** Substring match on one field, accents ignored ("venue:nurburgring"). */
function fieldMatches(show: Show, field: Field, value: string, getNotes: NotesOf): boolean {
  const v = fold(value.trim());
  const has = (text?: string) => fold(text ?? '').includes(v);
  switch (field) {
    case 'artist':  return has(show.Artist);
    case 'type':    return has(show.RecordingType) || has(show.ContentType);
    case 'country': return has(show.Country);
    case 'city':    return has(show.City);
    case 'venue':   return has(show.VenueName);
    case 'event':   return has(show.EventOrFestival);
    case 'song':    return has(show.Setlist);
    case 'note':    return has(getNotes(show));
    case 'year':
    case 'date':    return show.ShowDate.includes(v);
    case 'drive':   return has(show.MasterDriveName);
    case 'codec':   return has(show.VideoCodec);
  }
}

/**
 * Field filters anywhere in the query, several at once, quoted or not:
 * `artist:"pearl jam" year:2000 pinkpop`. A value runs to the next field or the
 * end ("song:black hole sun"), so free words go before the fields. Null when
 * the query names no known field ("re: sessions" stays free text).
 */
function parseFields(query: string): { fields: [Field, string][]; rest: string } | null {
  const fields: [Field, string][] = [];
  const known = [...FIELDS, ...Object.keys(FIELD_ALIASES)].join('|');
  const rx = new RegExp(`(?:^|\\s)(${known}):\\s*("[^"]*"?|[^\\s"]+(?:\\s+(?!(?:${known}):)[^\\s"]+)*)`, 'gi');
  const rest = query.replace(rx, (_, field: string, value: string) => {
    const name = field.toLowerCase();
    fields.push([FIELD_ALIASES[name] ?? (name as Field), value.replace(/^"|"$/g, '')]);
    return ' ';
  });
  return fields.length ? { fields, rest: rest.replace(/\s+/g, ' ').trim() } : null;
}

// ---------------------------------------------------------------------------
// Why a show matched — grouped free-text results
// ---------------------------------------------------------------------------

/**
 * Free-text results group by why they matched (owner, 2026-10-13):
 *   artist — the query spells part of the artist's name ("stone" → Stone
 *            Temple Pilots). Offered as the artist, above everything else.
 *   show   — the date, place, event or recording type matched.
 *   song   — only a song in the setlist did ("stone" → Like a Rolling Stone).
 */
export type MatchKind = 'artist' | 'show' | 'song';

/** A setlist entry that matched, and the matched letters as [start, end). */
export interface SongHit {
  title: string;
  ranges: [number, number][];
}

export interface GroupedMatches {
  kind: Map<string, MatchKind>;
  /** Artists whose name matches the query, best first. */
  artists: string[];
  /** Per song match, the entries that matched, in setlist order. */
  songs: Map<string, SongHit[]>;
  /** Close spellings of an artist, offered only when nothing matched. */
  didYouMean: string[];
  /** Otherwise, the query with a misspelt place or event corrected. */
  correctedQuery: string | null;
}

export interface SearchOutcome {
  shows: Show[];
  /** Null for an artist view, a decade alone, or a field filter other than song:. */
  grouped: GroupedMatches | null;
}

/** A name or query as words: folded, "&" read as "and", no leading "The". */
function nameWords(value: string): string[] {
  const words = fold(value).replace(/&/g, ' and ').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return words.length > 1 && words[0] === 'the' ? words.slice(1) : words;
}

/**
 * Artists whose name the query starts: every typed word begins a word of the
 * name ("stone" → Stone Temple Pilots, Queens of the Stone Age, Rolling
 * Stones; "smash pump" → Smashing Pumpkins), or the query begins the name run
 * together ("rem" → R.E.M., "acdc" → AC/DC). From two letters, so artists
 * offer themselves while a name is still being typed. Names the query starts
 * rank first, then the most shows.
 */
export function matchArtists(query: string, index: SearchIndex): string[] {
  const typed = nameWords(query);
  const joined = typed.join('');
  if (joined.length < 2) return [];

  const hits: { name: string; starts: boolean; count: number }[] = [];
  for (const name of index.artistNames) {
    const words = nameWords(name);
    const starts = words.join('').startsWith(joined);
    if (!starts && !typed.every(t => words.some(w => w.startsWith(t)))) continue;
    hits.push({ name, starts, count: index.artistCounts.get(name) ?? 0 });
  }
  return hits
    .sort((a, b) => Number(b.starts) - Number(a.starts) || b.count - a.count || a.name.localeCompare(b.name))
    .map(h => h.name);
}

/**
 * Optimal string alignment distance: Levenshtein, plus two swapped
 * neighbours counting as one typo — "gredn" for "garden" is two.
 */
function editDistance(a: string, b: string): number {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let before: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      let d = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, before[j - 2] + 1);
      cur[j] = d;
    }
    before = prev;
    prev = cur;
  }
  return prev[b.length];
}

/** Typos forgiven in a word this long: none under four letters, then 1, 2, 3. */
function typoBudget(length: number): number {
  return length < 4 ? 0 : length <= 5 ? 1 : length <= 8 ? 2 : 3;
}

/**
 * From a typed word to a word of a name, or to its start when the name word
 * is longer, so an unfinished word counts too ("soundgred" → Soundgarden).
 */
function distanceToWord(typed: string, word: string): number {
  if (word.length <= typed.length) return editDistance(typed, word);
  let best = Infinity;
  for (let k = Math.max(1, typed.length - 1); k <= Math.min(word.length, typed.length + 1); k++) {
    best = Math.min(best, editDistance(typed, word.slice(0, k)));
  }
  return best;
}

/**
 * "Did you mean": artists a typo away from the query, for when nothing
 * matched at all ("soundgredn" → Soundgarden, "chilli peppers" → Red Hot
 * Chili Peppers, "foo figters" → Foo Fighters). Compared run together, which
 * forgives a stray or missing space, then word by word. Only the closest
 * spellings are offered, at most three, the artist with most shows first.
 *
 * Artist names only. Fuzzy matching on songs and notes was what made "stone"
 * find "stole"; a name is a short list of known strings, where a near-miss is
 * almost always a typo.
 */
export function suggestArtists(query: string, index: SearchIndex): string[] {
  const typed = nameWords(query);
  const joined = typed.join('');
  if (joined.length < 4) return [];

  const found: { name: string; distance: number; count: number }[] = [];
  for (const name of index.artistNames) {
    const words = nameWords(name);
    let distance = distanceToWord(joined, words.join(''));
    if (distance > typoBudget(joined.length)) {
      distance = 0;
      for (const t of typed) {
        const best = Math.min(...words.map(w => distanceToWord(t, w)));
        if (best > typoBudget(t.length)) { distance = Infinity; break; }
        distance += best;
      }
    }
    if (distance <= typoBudget(joined.length)) {
      found.push({ name, distance, count: index.artistCounts.get(name) ?? 0 });
    }
  }
  if (!found.length) return [];

  const closest = Math.min(...found.map(f => f.distance));
  return found
    .filter(f => f.distance === closest)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 3)
    .map(f => f.name);
}

/** Where and what a show was: the words a misspelt place or event is corrected against. */
const PLACE_FIELDS = ['venue', 'city', 'country', 'event'];

/**
 * "Did you mean" for a place or event, when nothing matched and no artist is
 * close: each word that finds nothing is swapped for the nearest word among
 * venues, cities, countries and events ("glastonbry" → glastonbury, "wembly"
 * → wembley), and the corrected query is offered if it finds shows. Offered,
 * never run: these were silent fuzzy matches before 2026-10-13.
 */
function suggestQuery(query: string, index: SearchIndex): string | null {
  const words = query.toLowerCase().trim().split(/\s+/);
  let changed = false;
  const fixed = words.map(word => {
    const budget = typoBudget(word.length);
    if (!budget || index.ms.search(word, { prefix: word.length >= 4 }).length) return word;
    const seen = new Map<string, number>();
    for (const r of index.ms.search(word, { fields: PLACE_FIELDS, fuzzy: budget, prefix: false })) {
      for (const term of r.terms) seen.set(term, (seen.get(term) ?? 0) + 1);
    }
    const target = fold(word);
    const best = [...seen]
      .map(([term, count]) => ({ term, count, distance: editDistance(target, term) }))
      .filter(c => c.distance <= budget)
      .sort((a, b) => a.distance - b.distance || b.count - a.count)[0];
    if (!best) return word;
    changed = true;
    return best.term;
  });
  if (!changed) return null;
  const corrected = fixed.join(' ');
  return index.ms.search(corrected).length ? corrected : null;
}

/**
 * The setlist entries a song match came from. A multi-word query can match
 * across songs ("black" in one, "hole" in another); the entries answering the
 * most query words win, so "black hole" shows Black Hole Sun alone.
 */
function songHits(setlist: string, result: SearchResult): SongHit[] {
  // Each index word that matched in the setlist, with the typed word it answers.
  const answers = new Map<string, string>();
  for (const [term, fields] of Object.entries(result.match)) {
    if (!fields.includes('songs')) continue;
    const typed = result.queryTerms.filter(q => term.startsWith(q)).sort((a, b) => b.length - a.length)[0];
    answers.set(term, typed ?? term);
  }

  const entries = (setlist || '').split(';').map(t => t.trim()).filter(Boolean).map(title => {
    const ranges: [number, number][] = [];
    const answered = new Set<string>();
    for (const m of title.matchAll(WORD)) {
      const typed = answers.get(fold(m[0]));
      if (typed === undefined) continue;
      answered.add(typed);
      // Light only the letters typed: "Stone" in "Stoned".
      ranges.push([m.index!, m.index! + Math.min(typed.length, m[0].length)]);
    }
    return { title, ranges, score: answered.size };
  });

  const best = Math.max(0, ...entries.map(e => e.score));
  return best === 0 ? [] : entries.filter(e => e.score === best).slice(0, 3).map(({ title, ranges }) => ({ title, ranges }));
}

/** song: is a plain substring filter, so its hits are substrings too. */
function songHitsBySubstring(setlist: string, needle: string): SongHit[] {
  return (setlist || '').split(';').map(t => t.trim()).filter(Boolean).flatMap(title => {
    const at = title.toLowerCase().indexOf(needle);
    return at < 0 ? [] : [{ title, ranges: [[at, at + needle.length]] as [number, number][] }];
  }).slice(0, 3);
}

/**
 * Free text over a pool of shows (every show, or a decade's): artist matches
 * by name, then MiniSearch, each result tagged with why it matched.
 */
function textSearch(pool: Show[], query: string, index: SearchIndex, quiet = false): SearchOutcome {
  const artists = matchArtists(query, index);
  const byArtist = new Set(artists);
  const inPool = new Set(pool.map(s => s.ShowID));
  const kind = new Map<string, MatchKind>();
  const songs = new Map<string, SongHit[]>();
  const found: Show[] = [];

  for (const show of pool) {
    if (!byArtist.has(show.Artist)) continue;
    kind.set(show.ShowID, 'artist');
    found.push(show);
  }

  const onShowFields = new Set(index.ms.search(query, { fields: [...SHOW_FIELDS] }).map(r => r.id));
  for (const result of index.ms.search(query)) {
    const show = index.showById[result.id];
    if (!show || !inPool.has(show.ShowID) || kind.has(show.ShowID)) continue;
    found.push(show);
    if (onShowFields.has(show.ShowID)) {
      kind.set(show.ShowID, 'show');
    } else {
      kind.set(show.ShowID, 'song');
      songs.set(show.ShowID, songHits(show.Setlist, result));
    }
  }

  // No "Did you mean" for an abbreviation ("XTC" is not a typo of a name), a
  // known place or spec word, or a query that came with a date or decade
  // (`quiet`): a near spelling there is a wrong suggestion, not a helpful one.
  const words = query.trim().split(/\s+/);
  const unsuggestable = quiet || /^[A-Z0-9&]{2,6}$/.test(query.trim()) || words.every(w => KNOWN_TERMS.has(fold(w)));
  const didYouMean = found.length || unsuggestable ? [] : suggestArtists(query, index);
  return {
    shows: found.sort(sortChronological),
    grouped: {
      kind, artists, songs, didYouMean,
      correctedQuery: found.length || didYouMean.length || unsuggestable ? null : suggestQuery(query, index),
    },
  };
}

// ---------------------------------------------------------------------------
// Query execution
// ---------------------------------------------------------------------------

/**
 * Notes are not on the site's show objects (they load separately), so the
 * two paths that search them take a lookup. The default reads the record,
 * which is right for anything holding the full shows.json.
 */
type NotesOf = (show: Show) => string;
const notesOnRecord: NotesOf = show => show.Notes ?? '';

/** The shows a query displays. */
export function runSearch(shows: Show[], searchQuery: string, index: SearchIndex, getNotes: NotesOf = notesOnRecord): Show[] {
  return searchShows(shows, searchQuery, index, getNotes).shows;
}

/** The shows a query displays, and — for free text and song: — why each matched. */
export function searchShows(shows: Show[], searchQuery: string, index: SearchIndex, getNotes: NotesOf = notesOnRecord): SearchOutcome {
  if (!searchQuery) return { shows, grouped: null };

  const query = searchQuery.toLowerCase().trim();

  // Field filters, alone or with free words: "song:creep", "artist:pearl year:2000 pinkpop".
  const parsed = parseFields(query);
  if (parsed) {
    const pool = shows.filter(show => parsed.fields.every(([field, value]) => fieldMatches(show, field, value, getNotes)));
    if (parsed.rest) return searchWithin(pool, parsed.rest, index);
    const song = parsed.fields.find(([field]) => field === 'song');
    if (!song) return { shows: pool.sort(sortChronological), grouped: null };
    const needle = fold(song[1].trim());
    return {
      shows: pool.sort(sortChronological),
      grouped: {
        kind: new Map(pool.map(s => [s.ShowID, 'song' as const])),
        artists: [],
        songs: new Map(pool.map(s => [s.ShowID, songHitsBySubstring(s.Setlist, needle)])),
        didYouMean: [],
        correctedQuery: null,
      },
    };
  }

  // Artist view — an exact artist name, alias or initials is a facet, never a
  // text search. Checked before dates and decades so an artist name always wins.
  const artist = resolveArtist(query, index.artistNames);
  if (artist) return { shows: getArtistShows(shows, artist), grouped: null };

  const outcome = searchWithin(shows, searchQuery, index);

  // "Rock am Ring 97": a bare two-digit number is tried as a year, but only
  // when the words alone found nothing — it may be a song ("99 Problems").
  if (!outcome.shows.length && /(?:^|\s)\d{2}(?=\s|$)/.test(query)) {
    const asYear = searchWithin(shows, query.replace(/(^|\s)(\d{2})(?=\s|$)/g, "$1'$2"), index);
    if (asYear.shows.length) return asYear;
  }
  return outcome;
}

/**
 * Free text within a pool of shows: dates and a decade narrow the pool
 * (extractDates, DECADE_MAP), the remaining words are searched in it. If a date
 * reading finds nothing, the words are tried as typed ("30 Seconds to Mars
 * May 2010" when the show was in June still finds the band).
 */
function searchWithin(pool: Show[], text: string, index: SearchIndex): SearchOutcome {
  const { dates, rest } = extractDates(text);
  let narrowed = pool;
  for (const d of dates) narrowed = narrowed.filter(show => d.prefixes.some(p => show.ShowDate.startsWith(p)));

  const words = rest.split(/\s+/).filter(Boolean);
  const decadeWord = words.find(w => DECADE_MAP[w]);
  if (decadeWord) {
    const [start, end] = DECADE_MAP[decadeWord];
    narrowed = narrowed.filter(show => {
      const year = getShowYear(show);
      return year >= start && year <= end;
    });
  }
  const remaining = words.filter(w => w !== decadeWord).join(' ');
  if (!dates.length && !decadeWord) return textSearch(pool, text, index);
  if (!remaining) return { shows: [...narrowed].sort(sortChronological), grouped: null };

  const found = textSearch(narrowed, remaining, index, true);
  if (found.shows.length || !dates.length) return found;
  const literal = textSearch(pool, text, index, true);
  return literal.shows.length ? literal : found;
}

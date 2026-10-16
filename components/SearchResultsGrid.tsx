import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { Show } from '../App';
import { ShowCard } from './ShowCard';
import { LazyImage } from './LazyImage';
import { GRID_COLS, GRID_TRACKS } from './FeaturedRows';
import { CONTENT_WIDTH } from '../src/lib/layout';
import type { SongSuggestion } from '../src/search/searchIndex';
import type { ArtistMatch, ResultGroups } from '../src/hooks/useBrowseResults';
import type { ImageUrlGetter } from '../src/hooks/useShows';

interface SearchResultsGridProps {
  shows: Show[];
  query: string;
  searchType?: 'artist' | 'general';
  transitionKey?: number;
  songSuggestion?: SongSuggestion | null;
  /** A free-text query's results by why they matched; null renders one grid. */
  groups?: ResultGroups | null;
  onShowClick: (show: Show) => void;
  /** Opens an artist from an artist tile or a "Did you mean". */
  onArtistSelect?: (artist: string) => void;
  onClear: () => void;
  onSearch?: (query: string) => void;
  /** Set while filters narrow the results: their labels, and what the search finds without them. */
  withoutFilters?: { count: number; labels: string[]; onClear: () => void } | null;
  getImageUrl: ImageUrlGetter;
}

/** Artist tiles shown before "Show all": two rows from xl, three on a tablet. */
const ARTIST_PREVIEW = 6;

const SECTION_LABEL = 'mb-3 flex items-baseline gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400';
const SECTION_COUNT = 'font-normal normal-case tracking-normal tabular-nums text-gray-500';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function SearchResultsGrid({ shows, query, searchType, transitionKey, songSuggestion, groups, onShowClick, onArtistSelect, onClear, onSearch, withoutFilters, getImageUrl }: SearchResultsGridProps) {
  // Explicit type from the call site wins; fall back to inferring from results for free-text searches
  const isSingleArtist = shows.length > 0 && shows.every(s => s.Artist === shows[0].Artist);
  const cardMode: 'artist' | 'search' = searchType === 'artist'
    ? 'artist'
    : searchType === 'general'
      ? 'search'
      : isSingleArtist ? 'artist' : 'search';

  // Nothing matched: an artist a typo away, or failing that the query with a
  // misspelt place or event corrected. Offered, never run for you.
  const suggestions = groups && shows.length === 0 ? groups.didYouMean : [];
  const corrected = groups && shows.length === 0 && suggestions.length === 0 ? groups.correctedQuery : null;

  return (
    <div className={`${CONTENT_WIDTH} pt-8`}>
      {/* Results header */}
      <div className="mb-6">
        <h2 className="text-4xl font-bold text-white">“{query}”</h2>
        {/* The summary row: what was found, and the way out of it, side by
            side — the control sits beside the thing it clears. */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-gray-400 text-sm">
            {shows.length === 0
              ? 'No shows match'
              : <>Found <span className="text-gray-200 tabular-nums">{shows.length}</span> {shows.length === 1 ? 'show' : 'shows'}</>}
          </p>
          <ClearButton onClick={onClear} back={searchType === 'artist'} />
        </div>

        {/* "Kiss" and "Hole" are bands AND song words. The artist view wins,
            but the song search stays one click away instead of disappearing. */}
        {songSuggestion && onSearch && (
          <button
            onClick={() => onSearch(songSuggestion.query)}
            className="cursor-pointer group mt-3 flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors duration-200"
          >
            <span aria-hidden="true" className="text-gray-500 group-hover:text-gray-300 transition-colors">↳</span>
            <span>
              <span className="text-gray-200 tabular-nums">{songSuggestion.count}</span>
              {' '}more {songSuggestion.count === 1 ? 'show features' : 'shows feature'} a song called
              {' '}<span className="text-gray-200">“{songSuggestion.term}”</span>
            </span>
            <span aria-hidden="true" className="opacity-0 group-hover:opacity-100 transition-opacity">›</span>
          </button>
        )}
      </div>

      {suggestions.length > 0 && onArtistSelect ? (
        // Nothing matched, but the query is a typo away from an artist.
        <section aria-labelledby="results-did-you-mean">
          <h3 id="results-did-you-mean" className={SECTION_LABEL}>Did you mean</h3>
          <ArtistTiles artists={suggestions} onSelect={onArtistSelect} getImageUrl={getImageUrl} />
        </section>
      ) : corrected && onSearch ? (
        <section aria-labelledby="results-did-you-mean">
          <h3 id="results-did-you-mean" className={SECTION_LABEL}>Did you mean</h3>
          <button
            type="button"
            onClick={() => onSearch(corrected)}
            className="group inline-flex cursor-pointer items-center gap-2.5 rounded-full border border-white/10 bg-white/7 py-2 pl-4 pr-3 text-[15px] text-white transition-colors duration-150 hover:border-white/20 hover:bg-white/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
          >
            <Search className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
            {corrected}
            <ChevronRight className="h-4 w-4 text-gray-500 transition duration-150 group-hover:translate-x-0.5 group-hover:text-gray-200" aria-hidden="true" />
          </button>
        </section>
      ) : shows.length === 0 && withoutFilters && withoutFilters.count > 0 ? (
        // The search finds shows; the filters hide them all (F8). Say which
        // filters, and offer the shows without them, rather than blame the
        // spelling of a query that is fine.
        <div className="py-24 text-center">
          <p className="text-gray-300 text-base">
            No “{query}” shows with {withoutFilters.labels.length === 1 ? 'this filter' : 'these filters'}: {withoutFilters.labels.join(', ')}
          </p>
          <button
            type="button"
            onClick={withoutFilters.onClear}
            className="group mt-5 inline-flex cursor-pointer items-center gap-2.5 rounded-full border border-white/10 bg-white/7 py-2 pl-4 pr-3 text-[15px] text-white transition-colors duration-150 hover:border-white/20 hover:bg-white/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
          >
            Show {withoutFilters.count} without the {withoutFilters.labels.length === 1 ? 'filter' : 'filters'}
            <ChevronRight className="h-4 w-4 text-gray-500 transition duration-150 group-hover:translate-x-0.5 group-hover:text-gray-200" aria-hidden="true" />
          </button>
        </div>
      ) : shows.length === 0 ? (
        <div className="py-24 text-center">
          {/* The way out is the Clear beside the count, always in one place;
              this says what to try instead, including what the search
              understands (F6): dates, abbreviations and one-field searches. */}
          <p className="text-gray-300 text-base">No shows found for “{query}”</p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-400">
            Try an artist, a song, a place or a date: <span className="text-gray-300">1996-05-24</span>,{' '}
            <span className="text-gray-300">May 1996</span> and abbreviations like <span className="text-gray-300">RATM</span> work too.
          </p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-400">
            Or search one field: <span className="font-mono text-[13px] text-gray-300">song:creep · venue:brixton · event:pinkpop · year:1997</span>
          </p>
        </div>
      ) : (
        // presenceAffectsLayout={false}: see the matching comment in App.tsx.
        <AnimatePresence mode="wait" presenceAffectsLayout={false}>
          <motion.div
            key={transitionKey ?? cardMode}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            {groups ? (
              /*
                Grouped by why each show matched (owner, 2026-10-13): artists
                first, as artists — a tile opens the artist, so "stone" offers
                Stone Temple Pilots once rather than as 101 cards burying every
                song below them. Then shows found by date, place or event, then
                shows found by a song, each card saying which song.
              */
              <div className="space-y-10">
                {groups.artists.length > 0 && onArtistSelect && (
                  <section aria-labelledby="results-artists">
                    <h3 id="results-artists" className={SECTION_LABEL}>
                      Artists <span className={SECTION_COUNT}>{groups.artists.length}</span>
                    </h3>
                    {/* Keyed by query, so a new search starts folded again. */}
                    <ArtistTiles key={query} artists={groups.artists} onSelect={onArtistSelect} getImageUrl={getImageUrl} preview />
                  </section>
                )}
                {groups.shows.length > 0 && (
                  <section aria-labelledby="results-shows">
                    <h3 id="results-shows" className={SECTION_LABEL}>
                      Shows <span className={SECTION_COUNT}>{groups.shows.length}</span>
                    </h3>
                    <div className={GRID_COLS}>
                      {groups.shows.map(show => (
                        <ShowCard
                          key={show.ShowID}
                          show={show}
                          onSelect={onShowClick}
                          getImageUrl={getImageUrl}
                          searchMode="search"
                        />
                      ))}
                    </div>
                  </section>
                )}
                {groups.songs.length > 0 && (
                  <section aria-labelledby="results-songs">
                    <h3 id="results-songs" className={SECTION_LABEL}>
                      Songs <span className={SECTION_COUNT}>in {plural(groups.songs.length, 'show', 'shows')}</span>
                    </h3>
                    <div className={GRID_COLS}>
                      {groups.songs.map(show => (
                        <ShowCard
                          key={show.ShowID}
                          show={show}
                          onSelect={onShowClick}
                          getImageUrl={getImageUrl}
                          searchMode="search"
                          songHits={groups.songHits.get(show.ShowID)}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            ) : (
              // Shared with the landing sections so card size and spacing match
              // across every view. Defined once in FeaturedRows.
              <div className={GRID_COLS}>
                {shows.map((show) => (
                  <ShowCard
                    key={show.ShowID}
                    show={show}
                    onSelect={onShowClick}
                    getImageUrl={getImageUrl}
                    searchMode={cardMode}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

/**
 * Leaving the results. A real button, not an underlined word: it stands on
 * its own rather than inside a sentence, so it needs a 24px target (WCAG
 * 2.5.8; this is 32px) and a label that says what it does. The translucent
 * pill is the site's control style (the drawer's close, the filter chips).
 * An artist opened from the list goes back to the list, so says so.
 */
function ClearButton({ onClick, back }: { onClick: () => void; back: boolean }) {
  const Icon = back ? ChevronLeft : X;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-white/10 pl-2.5 pr-3.5 text-sm text-gray-200 transition-colors duration-150 hover:bg-white/20 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {back ? 'All artists' : 'Clear search'}
    </button>
  );
}

interface ArtistTilesProps {
  artists: ArtistMatch[];
  onSelect: (artist: string) => void;
  getImageUrl: ImageUrlGetter;
  /** Fold to the first ARTIST_PREVIEW, with a Show all. */
  preview?: boolean;
}

/**
 * Artists as tiles, not cards: a round portrait, the name and a count, and a
 * chevron, because a tile goes somewhere (the artist) where a card opens a
 * show. Each spans two card columns of the grid below, so their edges line up
 * with the cards at every size.
 */
function ArtistTiles({ artists, onSelect, getImageUrl, preview }: ArtistTilesProps) {
  const [expanded, setExpanded] = useState(false);
  const folded = preview && !expanded && artists.length > ARTIST_PREVIEW;
  const shown = folded ? artists.slice(0, ARTIST_PREVIEW) : artists;

  return (
    <>
      <div className={`${GRID_TRACKS} gap-3`}>
        {shown.map(artist => (
          <ArtistTile key={artist.name} artist={artist} onSelect={onSelect} getImageUrl={getImageUrl} />
        ))}
      </div>
      {folded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 cursor-pointer text-sm text-gray-400 underline underline-offset-2 transition-colors hover:text-white"
        >
          Show all {artists.length} artists
        </button>
      )}
    </>
  );
}

function ArtistTile({ artist, onSelect, getImageUrl }: { artist: ArtistMatch; onSelect: (artist: string) => void; getImageUrl: ImageUrlGetter }) {
  // The owner's pick, else the newest show's slot 1 — a close-up of the
  // singer, which crops well to a circle. Whatever the filters or sort.
  const portrait = artist.portraits.find(p => getImageUrl(p.checksum, p.slot));
  const initials = artist.name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  return (
    <button
      type="button"
      onClick={() => onSelect(artist.name)}
      className="group col-span-2 flex cursor-pointer items-center gap-3 rounded-xl border border-white/6 bg-white/4 p-2 pr-4 text-left transition-colors duration-150 hover:border-white/12 hover:bg-white/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
    >
      {portrait ? (
        <LazyImage
          src={getImageUrl(portrait.checksum, portrait.slot, 'thumb')}
          fallbackSrc={getImageUrl(portrait.checksum, portrait.slot)}
          alt=""
          className="h-14 w-14 shrink-0 overflow-hidden rounded-full"
          placeholderColor="bg-neutral-800"
        />
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-sm font-semibold text-white/40">
          {initials}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium leading-snug text-white">{artist.name}</span>
        <span className="block text-xs tabular-nums text-gray-400">{plural(artist.shows.length, 'show', 'shows')}</span>
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-gray-500 transition duration-150 group-hover:translate-x-0.5 group-hover:text-gray-200"
        aria-hidden="true"
      />
    </button>
  );
}

import { motion, AnimatePresence } from 'motion/react';
import { Show } from '../App';
import { ShowCard } from './ShowCard';
import type { SongSuggestion } from '../src/search/searchIndex';

interface SearchResultsGridProps {
  shows: Show[];
  query: string;
  searchType?: 'artist' | 'general';
  transitionKey?: number;
  songSuggestion?: SongSuggestion | null;
  onShowClick: (show: Show) => void;
  onClear: () => void;
  /** Names where `onClear` actually lands — it differs per call site. */
  clearLabel?: string;
  onSearch?: (query: string) => void;
  getImageUrl: (checksum: string, index: number) => string | null;
}

export function SearchResultsGrid({ shows, query, searchType, transitionKey, songSuggestion, onShowClick, onClear, clearLabel = 'Clear search', onSearch, getImageUrl }: SearchResultsGridProps) {
  // Explicit type from the call site wins; fall back to inferring from results for free-text searches
  const isSingleArtist = shows.length > 0 && shows.every(s => s.Artist === shows[0].Artist);
  const cardMode: 'artist' | 'search' = searchType === 'artist'
    ? 'artist'
    : searchType === 'general'
      ? 'search'
      : isSingleArtist ? 'artist' : 'search';

  return (
    <div className="max-w-[1860px] mx-auto">
      {/* Results header */}
      <div className="mb-6">
        <h2 className="text-4xl font-bold text-white">“{query}”</h2>
        <div className="flex items-center gap-3 mt-1">
          <p className="text-gray-400 text-sm">
            Found <span className="text-gray-200 tabular-nums">{shows.length}</span> {shows.length === 1 ? 'show' : 'shows'}
          </p>
          <button
            onClick={onClear}
            className="text-xs text-gray-400 hover:text-white transition-colors underline underline-offset-2"
          >
            Clear
          </button>
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

      {shows.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-gray-400 text-base">No shows found for “{query}”</p>
          <button
            onClick={onClear}
            className="mt-3 text-sm text-gray-400 hover:text-white transition-colors underline underline-offset-2"
          >
            {clearLabel}
          </button>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={transitionKey ?? cardMode}
            className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-x-3 gap-y-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            {shows.map((show) => (
              <div key={show.ShowID}>
                <ShowCard
                  show={show}
                  onClick={() => onShowClick(show)}
                  getImageUrl={getImageUrl}
                  searchMode={cardMode}
                />
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

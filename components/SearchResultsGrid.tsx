import { motion, AnimatePresence } from 'motion/react';
import { Show } from '../App';
import { ShowCard } from './ShowCard';

interface SearchResultsGridProps {
  shows: Show[];
  query: string;
  searchType?: 'artist' | 'general';
  transitionKey?: number;
  onShowClick: (show: Show) => void;
  onClear: () => void;
  getImageUrl: (checksum: string, index: number) => string | null;
}

export function SearchResultsGrid({ shows, query, searchType, transitionKey, onShowClick, onClear, getImageUrl }: SearchResultsGridProps) {
  // Explicit type from the call site wins; fall back to inferring from results for free-text searches
  const isSingleArtist = shows.length > 0 && shows.every(s => s.Artist === shows[0].Artist);
  const cardMode: 'artist' | 'search' = searchType === 'artist'
    ? 'artist'
    : searchType === 'general'
      ? 'search'
      : isSingleArtist ? 'artist' : 'search';

  return (
    <div>
      {/* Results header */}
      <div className="mb-6">
        <h2 className="text-4xl font-bold text-white">"{query}"</h2>
        <div className="flex items-center gap-3 mt-1">
          <p className="text-gray-500 text-sm">
            Found <span className="text-gray-300 tabular-nums">{shows.length}</span> {shows.length === 1 ? 'show' : 'shows'}
          </p>
          <button
            onClick={onClear}
            className="text-xs text-gray-700 hover:text-gray-400 transition-colors underline underline-offset-2"
          >
            Clear
          </button>
        </div>
      </div>

      {shows.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-gray-600 text-base">No shows found for "{query}"</p>
          <button
            onClick={onClear}
            className="mt-3 text-sm text-gray-500 hover:text-white transition-colors underline underline-offset-2"
          >
            Browse all shows
          </button>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={transitionKey ?? cardMode}
            className="flex flex-wrap gap-x-3 gap-y-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            {shows.map((show) => (
              <div key={show.ShowID} className="w-[280px]">
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

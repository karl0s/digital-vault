import { motion } from 'motion/react';
import { Show } from '../App';
import { ShowCard } from './ShowCard';

interface SearchResultsGridProps {
  shows: Show[];
  query: string;
  onShowClick: (show: Show) => void;
  onClear: () => void;
  getImageUrl: (checksum: string, index: number) => string | null;
}

export function SearchResultsGrid({ shows, query, onShowClick, onClear, getImageUrl }: SearchResultsGridProps) {
  return (
    <div>
      {/* Results header */}
      <div className="mb-6 flex items-baseline gap-3">
        <p className="text-gray-500 text-sm">
          <span className="text-white font-semibold tabular-nums">{shows.length}</span>
          {' '}{shows.length === 1 ? 'result' : 'results'} for{' '}
          <span className="text-white">"{query}"</span>
        </p>
        <button
          onClick={onClear}
          className="text-xs text-gray-700 hover:text-gray-400 transition-colors underline underline-offset-2"
        >
          Clear
        </button>
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
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-3 gap-y-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {shows.map((show) => (
            <ShowCard
              key={show.ShowID}
              show={show}
              onClick={() => onShowClick(show)}
              getImageUrl={getImageUrl}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}

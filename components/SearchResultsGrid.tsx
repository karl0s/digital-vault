import { motion, AnimatePresence } from 'motion/react';
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
      <div className="mb-6 flex items-center gap-4">
        <p className="text-gray-400 text-sm md:text-base">
          <span className="text-white font-medium">{shows.length}</span>{' '}
          {shows.length === 1 ? 'result' : 'results'} for{' '}
          <span className="text-white">"{query}"</span>
        </p>
        <button
          onClick={onClear}
          className="text-sm text-gray-500 hover:text-white transition-colors underline underline-offset-2"
        >
          Clear
        </button>
      </div>

      {shows.length === 0 ? (
        <div className="py-20 text-center text-gray-500">
          <p className="text-lg">No shows found</p>
          <p className="text-sm mt-1">Try a different search or{' '}
            <button onClick={onClear} className="text-white hover:underline">browse all shows</button>
          </p>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.025 } },
          }}
        >
          <AnimatePresence>
            {shows.map((show) => (
              <motion.div
                key={show.ShowID}
                variants={{
                  hidden: { opacity: 0, scale: 0.92 },
                  visible: { opacity: 1, scale: 1, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } },
                }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                layout
              >
                <ShowCard
                  show={show}
                  onClick={() => onShowClick(show)}
                  getImageUrl={getImageUrl}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

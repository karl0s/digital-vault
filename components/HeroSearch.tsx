import { ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

interface HeroSearchProps {
  totalShows: number;
  onSearch: (query: string) => void;
  onBrowseAll: () => void;
}

const QUICK_SEARCHES = ['Pearl Jam', 'Soundboard', '1990s', 'Japan', 'Radiohead', 'USA'];

export function HeroSearch({ totalShows, onSearch, onBrowseAll }: HeroSearchProps) {
  return (
    <div className="flex flex-col items-center px-4 pt-6 pb-8 text-center">
      <motion.div
        className="w-full max-w-2xl"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.h1
          className="text-3xl md:text-5xl font-bold mb-1 tracking-tight"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          THE VAULT
        </motion.h1>

        <motion.p
          className="text-gray-500 mb-5 text-xs md:text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.12 }}
        >
          {totalShows > 0 ? `${totalShows.toLocaleString()} live shows` : 'Loading…'}
        </motion.p>

        {/* Quick-search pills */}
        <motion.div
          className="flex flex-wrap justify-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.18 }}
        >
          {QUICK_SEARCHES.map((tag) => (
            <button
              key={tag}
              onClick={() => onSearch(tag)}
              className="px-4 py-1.5 rounded-full text-sm bg-white/5 hover:bg-white/12 text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all"
            >
              {tag}
            </button>
          ))}
        </motion.div>

        {/* Browse all link */}
        <motion.button
          onClick={onBrowseAll}
          className="mt-5 text-xs text-gray-600 hover:text-gray-300 transition-colors flex items-center gap-1 mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.24 }}
        >
          Browse all artists <ChevronRight className="w-3 h-3" />
        </motion.button>
      </motion.div>
    </div>
  );
}

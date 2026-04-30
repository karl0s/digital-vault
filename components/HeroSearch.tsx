import { useRef, useEffect } from 'react';
import { Search, X, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

interface HeroSearchProps {
  value: string;
  onChange: (query: string) => void;
  totalShows: number;
  onBrowseAll: () => void;
}

const QUICK_SEARCHES = ['Pearl Jam', 'Soundboard', '1990s', 'Japan', 'Radiohead', 'USA'];

export function HeroSearch({ value, onChange, totalShows, onBrowseAll }: HeroSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[55vh] px-4 text-center">
      <motion.div
        className="w-full max-w-2xl"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.h1
          className="text-5xl md:text-7xl font-bold mb-3 tracking-tight"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
        >
          THE VAULT
        </motion.h1>

        <motion.p
          className="text-gray-500 mb-10 text-sm md:text-base"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          {totalShows > 0 ? `${totalShows.toLocaleString()} live shows` : 'Loading…'}
        </motion.p>

        {/* Search input */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search artists, venues, countries, years…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-white/8 border border-white/15 text-white placeholder-gray-600 rounded-2xl px-6 py-5 pl-14 text-lg md:text-xl focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30 focus:bg-white/12 transition-all"
          />
          {value && (
            <button
              onClick={() => onChange('')}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </motion.div>

        {/* Quick-search tags */}
        <motion.div
          className="flex flex-wrap justify-center gap-2 mt-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          {QUICK_SEARCHES.map((tag) => (
            <button
              key={tag}
              onClick={() => onChange(tag)}
              className="px-4 py-1.5 rounded-full text-sm bg-white/5 hover:bg-white/12 text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all"
            >
              {tag}
            </button>
          ))}
        </motion.div>

        {/* Browse all link */}
        <motion.button
          onClick={onBrowseAll}
          className="mt-8 text-sm text-gray-600 hover:text-gray-300 transition-colors flex items-center gap-1 mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          Browse all artists <ChevronRight className="w-4 h-4" />
        </motion.button>
      </motion.div>
    </div>
  );
}

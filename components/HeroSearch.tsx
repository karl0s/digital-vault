import { motion } from 'motion/react';

export type SearchType = 'artist' | 'general';

interface HeroSearchProps {
  onSearch: (query: string, type?: SearchType) => void;
  onBrowseAll: () => void;
}

const QUICK_SEARCHES: { label: string; query: string; type: SearchType }[] = [
  { label: 'Soundgarden',          query: 'Soundgarden',          type: 'artist'  },
  { label: 'Stone Temple Pilots',  query: 'Stone Temple Pilots',  type: 'artist'  },
  { label: 'Smashing Pumpkins',    query: 'Smashing Pumpkins',    type: 'artist'  },
  { label: "Jane's Addiction",     query: "Jane's Addiction",     type: 'artist'  },
  { label: 'Radiohead',            query: 'Radiohead',            type: 'artist'  },
  { label: '1990s',                query: 'nineties',             type: 'general' },
];

export function HeroSearch({ onSearch, onBrowseAll }: HeroSearchProps) {
  return (
    <div className="relative flex flex-col items-center px-4 pt-28 pb-16 text-center overflow-hidden">
      {/* Atmospheric radial glow — faint red from above, like stage lighting */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 90% 55% at 50% -5%, rgba(229,9,20,0.10) 0%, transparent 65%)',
        }}
      />
      {/* Subtle bottom vignette to blend into rows below */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, transparent, #141414)',
        }}
      />

      <div className="relative w-full max-w-5xl">
        {/* Main title */}
        <motion.h1
          className="leading-none text-white select-none"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(72px, 14vw, 160px)',
            letterSpacing: '0.06em',
          }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          THE VAULT
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="text-gray-500 mt-3 mb-10 text-sm md:text-base tracking-widest uppercase"
          style={{ letterSpacing: '0.25em' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          A collection of rare live recordings
        </motion.p>

        {/* Quick-search pills + All Shows */}
        <motion.div
          className="flex flex-wrap justify-center items-center gap-2 mb-8"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.22 }}
        >
          {QUICK_SEARCHES.map(({ label, query, type }) => (
            <button
              key={label}
              onClick={() => onSearch(query, type)}
              className="px-4 py-1.5 rounded-full text-sm text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 border border-white/8 hover:border-white/20 transition-all duration-200"
            >
              {label}
            </button>
          ))}
          <span className="text-white/10 select-none mx-1">|</span>
          <button
            onClick={onBrowseAll}
            className="text-sm text-gray-600 hover:text-gray-300 transition-colors duration-200 tracking-wide"
          >
            All Shows →
          </button>
        </motion.div>

      </div>
    </div>
  );
}

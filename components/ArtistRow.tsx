import { ShowCard } from './ShowCard';
import { Show } from '../App';
import { useRef, useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';

interface ArtistRowProps {
  artist: string;
  shows: Show[];
  onShowClick: (show: Show) => void;
  focusedShowId?: string | null;
  opacity?: number;
  isCenter?: boolean;
  getImageUrl?: (checksum: string, index: number) => string | null;
  allArtists?: string[];
  onArtistJump?: (artist: string) => void;
  currentArtist?: string;
}

export function ArtistRow({
  artist, shows, onShowClick, focusedShowId, opacity = 1,
  isCenter = false, getImageUrl, allArtists = [], onArtistJump, currentArtist,
}: ArtistRowProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isRowHovered, setIsRowHovered] = useState(false);

  const sortedShows = [...shows].sort((a, b) => {
    const yearA = a.ShowDate ? a.ShowDate.split('-')[0] : '0000';
    const yearB = b.ShowDate ? b.ShowDate.split('-')[0] : '0000';
    return yearB.localeCompare(yearA);
  });

  useEffect(() => {
    if (isDropdownOpen && dropdownRef.current && allArtists.length > 0) {
      const currentIndex = allArtists.indexOf(artist);
      if (currentIndex >= 0) dropdownRef.current.scrollTop = currentIndex * 44;
    }
  }, [isDropdownOpen, artist, allArtists]);

  useEffect(() => {
    if (isDropdownOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isDropdownOpen]);

  const handleArtistClick = (selectedArtist: string) => {
    setIsDropdownOpen(false);
    document.body.style.overflow = '';
    if (onArtistJump) {
      setTimeout(() => onArtistJump(selectedArtist), 50);
    }
  };

  return (
    // Outer div holds the id/data attributes and the scroll-spy opacity (CSS transition)
    <div
      id={`artist-${artist.replace(/\s+/g, '-')}`}
      data-artist={artist}
      style={{ opacity, transition: 'opacity 0.4s ease' }}
    >
      <motion.div
        className="mb-24"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        onMouseEnter={() => setIsRowHovered(true)}
        onMouseLeave={() => setIsRowHovered(false)}
      >
        {/* Artist heading */}
        <div className="relative px-4 md:px-8 mb-4 lg:mb-5">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-baseline gap-3 group/heading"
          >
            <h2
              className="leading-none text-white tracking-wide"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(28px, 4vw, 52px)',
                letterSpacing: '0.04em',
              }}
            >
              {artist}
            </h2>
            <span className="text-xs text-gray-700 tabular-nums hidden md:inline">
              {shows.length} {shows.length === 1 ? 'show' : 'shows'}
            </span>
            <ChevronDown
              className={`w-5 h-5 text-gray-600 transition-all duration-200 hidden md:block ${
                isRowHovered ? 'opacity-100' : 'opacity-0'
              } ${isDropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Artist jump dropdown */}
          {isDropdownOpen && allArtists.length > 0 && (
            <div
              ref={dropdownRef}
              className="hidden md:block absolute top-full left-4 md:left-8 mt-2 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 max-h-[55vh] overflow-y-auto z-100"
              onMouseLeave={() => setIsDropdownOpen(false)}
            >
              {allArtists.map((artistName) => (
                <button
                  key={artistName}
                  onClick={() => handleArtistClick(artistName)}
                  className={`block text-left w-full px-5 py-3 text-sm hover:bg-white/8 transition-colors whitespace-nowrap ${
                    artistName === currentArtist ? 'bg-white/5 text-white font-medium' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {artistName}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Desktop: horizontal scroll */}
        <div className="hidden md:flex gap-3 overflow-x-auto overflow-y-visible py-6 px-4 md:px-8 scrollbar-hide relative">
          {sortedShows.map((show, index) => (
            <motion.div
              key={show.ShowID}
              className="w-[280px] shrink-0"
              initial={{ opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.35, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
            >
              <ShowCard
                show={show}
                onClick={() => onShowClick(show)}
                focused={show.ShowID === focusedShowId}
                getImageUrl={getImageUrl}
              />
            </motion.div>
          ))}
          {/* Right fade */}
          <div className="absolute right-0 top-0 bottom-0 w-24 pointer-events-none bg-linear-to-l from-[#141414] to-transparent" />
        </div>

        {/* Mobile: 2-column grid */}
        <div className="md:hidden grid grid-cols-2 gap-3 px-4 py-4">
          {sortedShows.map((show, index) => (
            <motion.div
              key={show.ShowID}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-20px' }}
              transition={{ duration: 0.35, delay: index * 0.03, ease: [0.16, 1, 0.3, 1] }}
            >
              <ShowCard
                show={show}
                onClick={() => onShowClick(show)}
                focused={show.ShowID === focusedShowId}
                getImageUrl={getImageUrl}
              />
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

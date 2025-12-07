import { ShowCard } from './ShowCard';
import { Show } from '../App';
import { useRef, useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';

interface ArtistRowProps {
  artist: string;
  shows: Show[];
  onShowClick: (show: Show) => void;
  focusedShowId?: string;
  isCenter?: boolean;
  getImageUrl?: (checksum: string, index: number) => string | null;
  allArtists?: string[];
  onArtistJump?: (artist: string) => void;
  currentArtist?: string;
}

export function ArtistRow({ artist, shows, onShowClick, focusedShowId, isCenter = false, getImageUrl, allArtists = [], onArtistJump, currentArtist }: ArtistRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isRowHovered, setIsRowHovered] = useState(false);
  
  // Sort shows by year (newest first)
  const sortedShows = [...shows].sort((a, b) => {
    const yearA = a.ShowDate ? a.ShowDate.split('-')[0] : '0000';
    const yearB = b.ShowDate ? b.ShowDate.split('-')[0] : '0000';
    return yearB.localeCompare(yearA); // Descending order (newest first)
  });

  // Scroll to current artist when dropdown opens
  useEffect(() => {
    if (isDropdownOpen && dropdownRef.current && allArtists.length > 0) {
      const currentIndex = allArtists.indexOf(artist);
      if (currentIndex >= 0) {
        // Scroll to show current artist at top (each item is roughly 44px tall)
        dropdownRef.current.scrollTop = currentIndex * 44;
      }
    }
  }, [isDropdownOpen, artist, allArtists]);

  // Prevent page scroll when dropdown is open
  useEffect(() => {
    if (isDropdownOpen) {
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Restore body scroll
        document.body.style.overflow = '';
      };
    }
  }, [isDropdownOpen]);

  const handleArtistClick = (selectedArtist: string) => {
    setIsDropdownOpen(false);
    // Restore body scroll immediately
    document.body.style.overflow = '';
    
    if (onArtistJump) {
      // Small delay to ensure dropdown closes and scroll is restored
      setTimeout(() => {
        onArtistJump(selectedArtist);
      }, 50);
    }
  };

  return (
    <motion.div
      id={`artist-${artist.replace(/\s+/g, '-')}`}
      data-artist={artist}
      className="mb-32"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setIsRowHovered(true)}
      onMouseLeave={() => setIsRowHovered(false)}
    >
      <div className="relative px-4 mb-4 lg:mb-6">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-3 group"
        >
          <h2 className="text-xl md:text-[40px] font-bold text-[32px]">{artist}</h2>
          <ChevronDown 
            className={`w-6 h-6 text-gray-600 transition-all duration-300 hidden md:block ${
              isRowHovered ? 'opacity-100' : 'opacity-0'
            } ${isDropdownOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Dropdown Menu - desktop only */}
        {isDropdownOpen && allArtists.length > 0 && (
          <div 
            ref={dropdownRef}
            className="hidden md:block absolute top-full left-4 mt-2 bg-black/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 max-h-[60vh] overflow-y-auto z-[100]"
            onMouseLeave={() => setIsDropdownOpen(false)}
          >
            {allArtists.map((artistName) => (
              <button
                key={artistName}
                onClick={() => handleArtistClick(artistName)}
                className={`block text-left px-5 py-3 hover:bg-white/10 transition-colors whitespace-nowrap ${
                  artistName === currentArtist ? 'bg-white/5 text-white' : 'text-gray-300'
                }`}
              >
                {artistName}
              </button>
            ))}
          </div>
        )}
      </div>
      
      <div className="relative">
        {/* Desktop: horizontal scroll */}
        <div 
          ref={scrollRef}
          className="hidden md:flex gap-2 md:gap-3 lg:gap-4 overflow-x-auto overflow-y-visible py-8 px-4 scrollbar-hide"
        >
          {sortedShows.map((show, index) => (
            <motion.div
              key={show.ShowID}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ 
                duration: 0.4, 
                delay: index * 0.05,
                ease: [0.16, 1, 0.3, 1]
              }}
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

        {/* Mobile: 2-column grid */}
        <div className="md:hidden grid grid-cols-2 gap-3 px-4 py-4">
          {sortedShows.map((show, index) => (
            <motion.div
              key={show.ShowID}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ 
                duration: 0.4, 
                delay: index * 0.03,
                ease: [0.16, 1, 0.3, 1]
              }}
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
        
        {/* Fade out indicator on right if more shows exist beyond viewport - desktop only */}
        <div className="hidden md:block absolute right-0 top-0 bottom-0 w-24 md:w-32 lg:w-40 bg-gradient-to-l from-[#141414] to-transparent pointer-events-none" />
      </div>
    </motion.div>
  );
}
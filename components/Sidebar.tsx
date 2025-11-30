import { useState, useRef, useEffect } from 'react';
import { Home } from 'lucide-react';

interface SidebarProps {
  artists: string[];
  activeLetter: string;
  onLetterClick: (letter: string) => void;
  onArtistClick: (artist: string) => void;
}

export function Sidebar({ artists, activeLetter, onLetterClick, onArtistClick }: SidebarProps) {
  const [hoveredLetter, setHoveredLetter] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0 });
  const letterRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isOverMenuRef = useRef(false);
  const isOverLetterRef = useRef(false);

  // Get unique first letters from artists
  const availableLetters = Array.from(new Set(artists.map(a => a[0].toUpperCase()))).sort();

  // Group artists by first letter
  const artistsByLetter = artists.reduce((acc, artist) => {
    const letter = artist[0].toUpperCase();
    if (!acc[letter]) {
      acc[letter] = [];
    }
    acc[letter].push(artist);
    return acc;
  }, {} as Record<string, string[]>);

  // Update menu position when letter is hovered
  useEffect(() => {
    if (hoveredLetter && letterRefs.current[hoveredLetter]) {
      const letterElement = letterRefs.current[hoveredLetter];
      const rect = letterElement.getBoundingClientRect();
      // Position menu relative to the hovered letter
      setMenuPosition({ top: rect.top });
    }
  }, [hoveredLetter]);

  // Check if letter should have no max-height (S-Z only)
  const shouldExpandFully = (letter: string) => {
    return letter >= 'S'; // All S-Z letters get full expansion
  };

  const closeMenuWithDelay = () => {
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    // Only close if we're not over either the letter or menu
    hoverTimeoutRef.current = setTimeout(() => {
      if (!isOverLetterRef.current && !isOverMenuRef.current) {
        setHoveredLetter(null);
      }
    }, 100);
  };

  const handleLetterMouseEnter = (letter: string) => {
    // Clear any pending close
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    isOverLetterRef.current = true;
    setHoveredLetter(letter);
  };

  const handleLetterMouseLeave = () => {
    isOverLetterRef.current = false;
    closeMenuWithDelay();
  };

  const handleMenuMouseEnter = () => {
    // Clear any pending close
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    isOverMenuRef.current = true;
  };

  const handleMenuMouseLeave = () => {
    isOverMenuRef.current = false;
    closeMenuWithDelay();
  };

  return (
    <>
      <aside className="fixed left-0 top-0 bottom-0 w-16 bg-black/50 backdrop-blur-sm border-r border-white/10 flex flex-col items-center py-6 z-30 overflow-y-auto">
        <button 
          className="p-3 hover:bg-white/10 rounded-lg transition-colors mb-4"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <Home className="w-5 h-5" />
        </button>

        <div className="w-full h-px bg-white/10 mb-4" />

        {/* Show all available letters vertically */}
        <div className="flex flex-col items-center gap-1">
          {availableLetters.map(letter => {
            const isActive = activeLetter === letter;
            
            return (
              <button
                key={letter}
                ref={(el) => (letterRefs.current[letter] = el)}
                onClick={() => {
                  const firstArtist = artistsByLetter[letter][0];
                  onArtistClick(firstArtist);
                }}
                onMouseEnter={() => handleLetterMouseEnter(letter)}
                onMouseLeave={handleLetterMouseLeave}
                className={`w-full py-2 text-center transition-all duration-200 ${
                  letter === activeLetter
                    ? 'text-white text-2xl scale-125 font-bold'
                    : 'text-gray-500 text-sm hover:text-gray-300'
                }`}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Artist submenu on letter hover - positioned relative to hovered letter */}
      {hoveredLetter && artistsByLetter[hoveredLetter] && (
        <>
          {/* Hover bridge - overlaps with sidebar edge to catch slow mouse movement */}
          <div 
            className="fixed left-12 w-68 z-40"
            style={{ 
              top: `${menuPosition.top - 20}px`,
              height: `${(artistsByLetter[hoveredLetter].length * 36) + 72}px`,
              pointerEvents: 'auto'
            }}
            onMouseEnter={handleMenuMouseEnter}
            onMouseLeave={handleMenuMouseLeave}
          />
          
          <div 
            className="fixed left-16 bg-[#181818] border border-white/10 z-50 shadow-2xl rounded-r-lg"
            style={{ 
              top: `${menuPosition.top}px`,
              width: artistsByLetter[hoveredLetter].length > 8 ? '32rem' : '16rem',
              ...(shouldExpandFully(hoveredLetter) 
                ? { height: 'auto', maxHeight: 'none', overflowY: 'visible' }
                : { maxHeight: '400px', overflowY: 'auto' }
              )
            }}
            onMouseEnter={handleMenuMouseEnter}
            onMouseLeave={handleMenuMouseLeave}
          >
            <div className="p-3">
              <h3 className="text-xs text-gray-400 mb-2 px-2">{hoveredLetter}</h3>
              <div 
                className={artistsByLetter[hoveredLetter].length > 8 
                  ? "grid grid-cols-2 gap-x-4 gap-y-0.5" 
                  : "space-y-0.5"
                }
              >
                {artistsByLetter[hoveredLetter].map(artist => (
                  <button
                    key={artist}
                    onClick={() => {
                      onArtistClick(artist);
                      setHoveredLetter(null);
                    }}
                    className="w-full text-left px-3 py-2 rounded text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    {artist}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
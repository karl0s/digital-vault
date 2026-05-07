import { Search, Menu, X } from 'lucide-react';
import { useRef, useState } from 'react';

interface TopNavProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  artists?: string[];
  onArtistJump?: (artist: string) => void;
  hasSidebar?: boolean;
  searchInputRef?: React.RefObject<HTMLInputElement>;
}

export function TopNav({ searchQuery, onSearchChange, artists = [], onArtistJump, hasSidebar = false, searchInputRef }: TopNavProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAlphabet, setShowAlphabet] = useState(false);
  const localRef = useRef<HTMLInputElement>(null);
  const inputRef = searchInputRef ?? localRef;

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const artistsByLetter = artists.reduce((acc, artist) => {
    const letter = artist[0].toUpperCase();
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(artist);
    return acc;
  }, {} as Record<string, string[]>);

  const handleLetterClick = (letter: string) => {
    const firstArtist = artistsByLetter[letter]?.[0];
    if (firstArtist && onArtistJump) {
      onArtistJump(firstArtist);
      setIsMobileMenuOpen(false);
      setShowAlphabet(false);
    }
  };

  return (
    <nav className={`fixed top-0 left-0 ${hasSidebar ? 'md:left-16' : ''} right-0 z-40 bg-linear-to-b from-black/90 to-transparent backdrop-blur-sm`}>
      <div className="flex items-center gap-3 px-4 md:px-8 py-3">
        {/* Mobile menu button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 hover:bg-white/10 rounded transition-colors shrink-0"
          aria-label="Menu"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Search bar — always visible */}
        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search artist, song, venue, country, year…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-white/8 border border-white/12 text-white placeholder-gray-600 rounded-xl px-4 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-white/25 focus:border-white/25 focus:bg-white/10 transition-all text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => { onSearchChange(''); inputRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-black/95 border-t border-white/10 animate-in slide-in-from-top duration-200">
          <div className="px-4 py-3 space-y-3">
            {/* Mobile always shows search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search…"
                value={searchQuery}
                onChange={(e) => { onSearchChange(e.target.value); setIsMobileMenuOpen(false); }}
                className="bg-white/10 border border-white/20 text-white placeholder-gray-400 rounded px-4 py-2 pl-10 w-full focus:outline-none focus:ring-2 focus:ring-white/30 text-sm"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>

            <button
              onClick={() => setShowAlphabet(!showAlphabet)}
              className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              <Menu className="w-4 h-4" />
              Jump to Artist
            </button>

            {showAlphabet && (
              <div className="pt-2 border-t border-white/10">
                <div className="flex flex-wrap gap-2">
                  {alphabet.map((letter) => {
                    const hasArtists = artistsByLetter[letter]?.length > 0;
                    return (
                      <button
                        key={letter}
                        onClick={() => hasArtists && handleLetterClick(letter)}
                        className={`w-8 h-8 rounded transition-colors text-sm ${
                          hasArtists
                            ? 'bg-white/10 hover:bg-white/20 text-white'
                            : 'bg-white/5 text-gray-600 cursor-not-allowed'
                        }`}
                        disabled={!hasArtists}
                      >
                        {letter}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

import { Search, Menu, X } from 'lucide-react';
import { useState } from 'react';

interface TopNavProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  artists?: string[];
  onArtistJump?: (artist: string) => void;
}

export function TopNav({ searchQuery, onSearchChange, artists = [], onArtistJump }: TopNavProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAlphabet, setShowAlphabet] = useState(false);

  // Group artists by first letter
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
    <nav className="fixed top-0 left-0 md:left-16 right-0 z-40 bg-gradient-to-b from-black to-transparent">
      <div className="flex items-center justify-between md:justify-center px-4 md:px-8 py-4">
        {/* Mobile menu button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 hover:bg-white/10 rounded transition-colors"
          aria-label="Menu"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        {/* Search bar */}
        <div className="relative group flex-1 md:flex-none">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-black/70 border border-white/20 text-white placeholder-gray-400 rounded px-4 py-2 pl-10 w-full md:w-96 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all text-sm md:text-base"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          
          {/* Search hint tooltip - desktop only */}
          <div className="hidden md:block absolute top-full right-0 mt-2 bg-black/95 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-400 w-72 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none">
            <div className="mb-1 text-white">Field filters:</div>
            <div className="space-y-0.5 font-mono">
              <div><span className="text-gray-500">artist:</span> pearl jam</div>
              <div><span className="text-gray-500">song:</span> alive</div>
              <div><span className="text-gray-500">type:</span> soundboard</div>
              <div><span className="text-gray-500">country:</span> usa</div>
              <div><span className="text-gray-500">year:</span> 1999</div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-black/95 border-t border-white/10 animate-in slide-in-from-top duration-200">
          <div className="px-4 py-3">
            <button
              onClick={() => setShowAlphabet(!showAlphabet)}
              className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              <Search className="w-4 h-4" />
              Jump to Artist
            </button>
            
            {showAlphabet && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="flex flex-wrap gap-2">
                  {alphabet.map((letter) => {
                    const hasArtists = artistsByLetter[letter]?.length > 0;
                    return (
                      <button
                        key={letter}
                        onClick={() => hasArtists && handleLetterClick(letter)}
                        className={`w-8 h-8 rounded transition-colors ${
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
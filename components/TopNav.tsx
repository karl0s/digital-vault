import { Search, X } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';

interface TopNavProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onLogoClick?: () => void;
  artists?: string[];
  onArtistJump?: (artist: string) => void;
  hasSidebar?: boolean;
  searchInputRef?: React.RefObject<HTMLInputElement>;
}

export function TopNav({ searchQuery, onSearchChange, onLogoClick, artists = [], onArtistJump, hasSidebar = false, searchInputRef }: TopNavProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const localRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = searchInputRef ?? localRef;

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 48);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (isMobileSearchOpen) {
      setTimeout(() => mobileInputRef.current?.focus(), 50);
    }
  }, [isMobileSearchOpen]);

  const artistsByLetter = artists.reduce((acc, artist) => {
    const letter = artist[0].toUpperCase();
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(artist);
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <nav
      className={`fixed top-0 left-0 ${hasSidebar ? 'md:left-16' : ''} right-0 z-40 transition-all duration-300 border-b ${
        isScrolled
          ? 'bg-[#141414]/97 backdrop-blur-md border-white/6'
          : 'bg-linear-to-b from-black/80 via-black/40 to-transparent border-transparent'
      }`}
    >
      <div className="flex items-center gap-4 px-4 md:px-8 h-14">
        {/* Brand wordmark */}
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); onLogoClick ? onLogoClick() : window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="shrink-0 select-none"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <span className="text-xl md:text-2xl tracking-[0.15em] text-white hover:text-[#E50914] transition-colors duration-200">
            THE VAULT
          </span>
        </a>

        {/* Desktop search — always visible */}
        <div className="relative hidden md:block flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Artist, song, venue, year…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-white/7 border border-white/10 text-white placeholder-gray-600 rounded-lg px-4 py-2 pl-9 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 focus:bg-white/10 transition-all text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => { onSearchChange(''); inputRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex-1" />

        {/* Mobile search toggle */}
        <button
          className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
          onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
          aria-label="Search"
        >
          {isMobileSearchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile search bar */}
      {isMobileSearchOpen && (
        <div className="md:hidden px-4 pb-3 border-t border-white/6 bg-[#141414]/97 backdrop-blur-md">
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <input
              ref={mobileInputRef}
              type="text"
              placeholder="Artist, song, venue, year…"
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
              }}
              className="w-full bg-white/[0.07] border border-white/10 text-white placeholder-gray-600 rounded-lg px-4 py-2.5 pl-10 focus:outline-none focus:ring-1 focus:ring-white/20 focus:bg-white/10 transition-all text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => { onSearchChange(''); mobileInputRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

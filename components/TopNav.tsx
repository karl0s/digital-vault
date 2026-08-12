import { Search, X } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { HalationLogo } from './logos/HalationLogo';
import { scrollToTop } from '../src/lib/motion';

interface TopNavProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onLogoClick?: () => void;
  onArtistsClick?: () => void;
  isArtistsActive?: boolean;
  searchInputRef?: React.RefObject<HTMLInputElement>;
  /** Controlled so the mobile tab bar's Search item can open this. */
  mobileSearchOpen?: boolean;
  onMobileSearchOpenChange?: (open: boolean) => void;
}

export function TopNav({
  searchQuery, onSearchChange, onLogoClick, onArtistsClick, isArtistsActive = false,
  searchInputRef, mobileSearchOpen, onMobileSearchOpenChange,
}: TopNavProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [uncontrolledMobileSearch, setUncontrolledMobileSearch] = useState(false);

  // Controlled when the host passes a value, uncontrolled otherwise.
  const isMobileSearchOpen = mobileSearchOpen ?? uncontrolledMobileSearch;
  const setIsMobileSearchOpen = (open: boolean) => {
    setUncontrolledMobileSearch(open);
    onMobileSearchOpenChange?.(open);
  };
  const localRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = searchInputRef ?? localRef;

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 48);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-40 transition-colors duration-300 border-b ${
        isScrolled
          ? 'bg-[#141414]/97 backdrop-blur-md border-white/6'
          : 'bg-linear-to-b from-black/80 via-black/40 to-transparent border-transparent'
      }`}
    >
      <div className="max-w-[1924px] mx-auto">
        <div className="flex items-center gap-4 px-4 md:px-8 h-16">
          {/* Brand wordmark */}
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); onLogoClick ? onLogoClick() : scrollToTop(); }}
            className="shrink-0 select-none"
            aria-label="The Vault — home"
          >
            <HalationLogo scale={0.19} />
          </a>

          {/* Artist directory — the recognition path. Persistent on every
              screen so the catalogue is browsable without knowing a name.
              Uses the site's pill idiom (see HeroSearch quick-searches); the
              active state is that pill's hover state, held open. */}
          <button
            onClick={onArtistsClick}
            aria-current={isArtistsActive ? 'page' : undefined}
            className={`cursor-pointer shrink-0 px-4 py-1.5 rounded-full text-sm border transition-colors duration-200 ${
              isArtistsActive
                ? 'text-white bg-white/10 border-white/20'
                : 'text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border-white/8 hover:border-white/20'
            }`}
          >
            Artists
          </button>

          {/* Desktop search — always visible */}
          <div className="relative hidden md:block flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Artist, song, venue, year…"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-white/7 border border-white/10 text-white placeholder-gray-400 rounded-lg px-4 py-2 pl-9 focus:border-white/20 focus:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 transition-colors text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => { onSearchChange(''); inputRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
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
            onClick={() => {
              if (!isMobileSearchOpen) {
                flushSync(() => setIsMobileSearchOpen(true));
                mobileInputRef.current?.focus();
              } else {
                setIsMobileSearchOpen(false);
              }
            }}
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
                className="w-full bg-white/[0.07] border border-white/10 text-white placeholder-gray-400 rounded-lg px-4 py-2.5 pl-10 focus:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 transition-colors text-base"
              />
              {searchQuery && (
                <button
                  onClick={() => { onSearchChange(''); mobileInputRef.current?.focus(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Show } from '../App';
import { ShowCard } from './ShowCard';
import { useGeoLocation } from '../src/hooks/useGeoLocation';

const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

interface FeaturedRowProps {
  title: string;
  shows: Show[];
  onShowClick: (show: Show) => void;
  getImageUrl: (checksum: string, index: number) => string | null;
}

function FeaturedRow({ title, shows, onShowClick, getImageUrl }: FeaturedRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [isRowHovered, setIsRowHovered] = useState(false);

  const SCROLL_AMOUNT = 560;

  const updateGradients = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 2);
    setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateGradients();
    el.addEventListener('scroll', updateGradients, { passive: true });
    const ro = new ResizeObserver(updateGradients);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', updateGradients); ro.disconnect(); };
  }, [shows, updateGradients]);

  const scrollLeft = () => scrollRef.current?.scrollBy({ left: -SCROLL_AMOUNT, behavior: 'smooth' });
  const scrollRight = () => scrollRef.current?.scrollBy({ left: SCROLL_AMOUNT, behavior: 'smooth' });

  if (shows.length === 0) return null;

  return (
    <motion.div
      className="mb-10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setIsRowHovered(true)}
      onMouseLeave={() => setIsRowHovered(false)}
    >
      {/* Row title */}
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500 mb-3 px-4 md:px-8">
        {title}
      </h2>

      <div className="relative group/row">
        {/* Scroll container */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto px-4 md:px-8 pb-6 scrollbar-hide"
        >
          {shows.map((show) => (
            <div key={show.ShowID} className="w-[280px] shrink-0">
              <ShowCard show={show} onClick={() => onShowClick(show)} getImageUrl={getImageUrl} />
            </div>
          ))}
        </div>

        {/* Left fade — always visible when scrolled right */}
        {showLeft && (
          <div
            className="absolute left-0 top-0 bottom-6 w-24 pointer-events-none z-10"
            style={{ background: 'linear-gradient(to right, #141414 20%, transparent)' }}
          />
        )}

        {/* Left arrow — hover only */}
        {showLeft && (
          <button
            onClick={scrollLeft}
            className={`absolute left-2 top-0 bottom-6 z-20 flex items-center transition-opacity duration-200 ${isRowHovered ? 'opacity-100' : 'opacity-0'}`}
            aria-label="Scroll left"
          >
            <div className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-colors duration-150">
              <ChevronLeft className="w-4 h-4 text-white" />
            </div>
          </button>
        )}

        {/* Right fade — always visible when more content to scroll */}
        {showRight && (
          <div
            className="absolute right-0 top-0 bottom-6 w-24 pointer-events-none z-10"
            style={{ background: 'linear-gradient(to left, #141414 20%, transparent)' }}
          />
        )}

        {/* Right arrow — hover only */}
        {showRight && (
          <button
            onClick={scrollRight}
            className={`absolute right-2 top-0 bottom-6 z-20 flex items-center justify-end transition-opacity duration-200 ${isRowHovered ? 'opacity-100' : 'opacity-0'}`}
            aria-label="Scroll right"
          >
            <div className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-colors duration-150">
              <ChevronRight className="w-4 h-4 text-white" />
            </div>
          </button>
        )}
      </div>
    </motion.div>
  );
}

interface FeaturedRowsProps {
  shows: Show[];
  onShowClick: (show: Show) => void;
  getImageUrl: (checksum: string, index: number) => string | null;
}

export function FeaturedRows({ shows, onShowClick, getImageUrl }: FeaturedRowsProps) {
  const geo = useGeoLocation();

  const sections = useMemo(() => {
    if (shows.length === 0) return null;

    const artistShows: Record<string, Show[]> = {};
    shows.forEach((show) => {
      if (!artistShows[show.Artist]) artistShows[show.Artist] = [];
      artistShows[show.Artist].push(show);
    });

    const TOP_ARTISTS = ['Stone Temple Pilots', 'Smashing Pumpkins', 'Soundgarden', 'Supergrass'];
    const topArtistShows = shuffle(
      TOP_ARTISTS.flatMap(name => {
        const list = artistShows[name];
        if (!list) return [];
        return shuffle(list).slice(0, 2);
      })
    );

    const FEATURED_IDS = [
      '3d97ae42ed27', 'ccd7ed3c2fa4', '3fe2d2713abb',
      '3620031b5215', 'e16f55a36df2', '4dba0c8ff6ae', '6cd303bce708',
      '730be7647294', 'a939ab1baf17',
    ];
    const showById = new Map(shows.map(s => [s.ShowID, s]));
    const recent = shuffle(FEATURED_IDS.map(id => showById.get(id)).filter(Boolean) as Show[]);

    const soundboards = shows
      .filter((s) => s.RecordingType?.toLowerCase().includes('soundboard'))
      .sort((a, b) => (b.ShowDate || '').localeCompare(a.ShowDate || ''))
      .slice(0, 24);

    const countryCandidates = (() => {
      if (!geo?.countryName) return [];
      const names = [geo.countryName];
      if (geo.countryName === 'United Kingdom') {
        if (geo.region) names.push(geo.region);
        names.push('UK', 'Britain');
      }
      if (geo.countryName === 'United States') names.push('USA', 'US');
      return names.map(n => n.toLowerCase());
    })();

    let geoShows: Show[] = [];
    let geoRowTitle = 'Shows Near You';

    if (geo) {
      if (geo.city) {
        const cityMatches = shows.filter(s =>
          s.City?.toLowerCase() === geo.city!.toLowerCase()
        );
        if (cityMatches.length >= 3) {
          geoShows = shuffle(cityMatches).slice(0, 24);
          geoRowTitle = `Shows from ${geo.city}`;
        }
      }
      if (geoShows.length === 0 && countryCandidates.length > 0) {
        const countryMatches = shows.filter(s =>
          countryCandidates.includes(s.Country?.toLowerCase() || '')
        );
        if (countryMatches.length >= 3) {
          geoShows = shuffle(countryMatches).slice(0, 24);
          const label = (geo.countryName === 'United Kingdom' && geo.region)
            ? geo.region
            : geo.countryName;
          geoRowTitle = `Shows from ${label}`;
        }
      }
    }

    return { topArtistShows, recent, soundboards, geoShows, geoRowTitle };
  }, [shows, geo]);

  if (!sections) {
    return (
      <div className="px-4 md:px-8 py-8 max-w-[1924px] mx-auto">
        <div className="animate-pulse space-y-10">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <div className="h-3 bg-white/5 rounded w-32 mb-4" />
              <div className="flex gap-3">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div key={j} className="shrink-0 w-[280px] aspect-4/3 bg-white/5 rounded-md" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-16 max-w-[1924px] mx-auto">
      {sections.recent.length > 0 && (
        <FeaturedRow
          title="Featured"
          shows={sections.recent}
          onShowClick={onShowClick}
          getImageUrl={getImageUrl}
        />
      )}
      <FeaturedRow
        title="Top Artists"
        shows={sections.topArtistShows}
        onShowClick={onShowClick}
        getImageUrl={getImageUrl}
      />
      {sections.geoShows.length > 0 && (
        <FeaturedRow
          title={sections.geoRowTitle}
          shows={sections.geoShows}
          onShowClick={onShowClick}
          getImageUrl={getImageUrl}
        />
      )}
      {sections.soundboards.length > 0 && (
        <FeaturedRow
          title="Soundboard Recordings"
          shows={sections.soundboards}
          onShowClick={onShowClick}
          getImageUrl={getImageUrl}
        />
      )}
    </div>
  );
}

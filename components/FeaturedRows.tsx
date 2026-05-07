import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Show } from '../App';
import { ShowCard } from './ShowCard';

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

  if (shows.length === 0) return null;

  return (
    <motion.div
      className="mb-10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <h2 className="text-lg md:text-xl font-bold mb-3 px-4 md:px-8">{title}</h2>
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto px-4 md:px-8 pb-4 scrollbar-hide"
        >
          {shows.map((show) => (
            <div key={show.ShowID} className="shrink-0">
              <ShowCard show={show} onClick={() => onShowClick(show)} getImageUrl={getImageUrl} />
            </div>
          ))}
        </div>
        {/* Left fade */}
        <div
          className="absolute left-0 top-0 bottom-4 w-20 pointer-events-none transition-opacity duration-300"
          style={{
            opacity: showLeft ? 1 : 0,
            background: 'linear-gradient(to right, #141414 15%, transparent)',
          }}
        />
        {/* Right fade */}
        <div
          className="absolute right-0 top-0 bottom-4 w-20 pointer-events-none transition-opacity duration-300"
          style={{
            opacity: showRight ? 1 : 0,
            background: 'linear-gradient(to left, #141414 15%, transparent)',
          }}
        />
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
  const sections = useMemo(() => {
    if (shows.length === 0) return null;

    // Group shows by artist
    const artistShows: Record<string, Show[]> = {};
    shows.forEach((show) => {
      if (!artistShows[show.Artist]) artistShows[show.Artist] = [];
      artistShows[show.Artist].push(show);
    });

    // Top artists: 2 random shows per artist, shuffled
    const TOP_ARTISTS = ['Stone Temple Pilots', 'Smashing Pumpkins', 'Soundgarden', 'Supergrass'];
    const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);
    const topArtistShows = shuffle(
      TOP_ARTISTS.flatMap(name => {
        const artistShowList = artistShows[name];
        if (!artistShowList) return [];
        return shuffle(artistShowList).slice(0, 2);
      })
    );

    // Featured: curated list by ShowID
    const FEATURED_IDS = [
      '3d97ae42ed27', // Soundgarden - MTV Live N Loud 1996
      'ac9aea292913', // STP - House of Blues 1999 (Claudia)
      'afe8655f1236', // STP - Unplugged 1993 + Big Empty
      '3fe2d2713abb', // Lenny Kravitz - Unplugged 1994 (Ad Aerts)
      '3620031b5215', // STP - VH1 + WAAF 2000
      'a062c6d4ee9f', // Audioslave - Compilation 79 Hideki
      '4dba0c8ff6ae', // Nirvana - Live N Loud 1993-11-18 Seattle
      '6cd303bce708', // Rage Against the Machine - 1994 - 1996
      '730be7647294', // RHCP - MSG NYC 1996-02-09
      'a939ab1baf17', // Radiohead - 10spot, New York City 1997
    ];
    const showById = new Map(shows.map(s => [s.ShowID, s]));
    const recent = FEATURED_IDS.map(id => showById.get(id)).filter(Boolean) as Show[];

    // Soundboard recordings
    const soundboards = shows
      .filter((s) => s.RecordingType?.toLowerCase().includes('soundboard'))
      .sort((a, b) => (b.ShowDate || '').localeCompare(a.ShowDate || ''))
      .slice(0, 24);

    // By decade (newest first)
    const byDecade: Record<string, Show[]> = {};
    shows.forEach((show) => {
      const year = parseInt(show.ShowDate?.split('-')[0] || '0');
      if (year >= 1960 && year <= 2030) {
        const decade = `${Math.floor(year / 10) * 10}s`;
        if (!byDecade[decade]) byDecade[decade] = [];
        byDecade[decade].push(show);
      }
    });

    const decadeRows = Object.entries(byDecade)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([decade, decadeShows]) => ({
        decade,
        shows: decadeShows
          .sort((a, b) => (b.ShowDate || '').localeCompare(a.ShowDate || ''))
          .slice(0, 24),
      }));

    return { topArtistShows, recent, soundboards, decadeRows };
  }, [shows]);

  if (!sections) {
    return (
      <div className="px-4 md:px-8 py-8">
        <div className="animate-pulse space-y-8">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <div className="h-6 bg-white/5 rounded w-40 mb-4" />
              <div className="flex gap-3">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div key={j} className="shrink-0 w-64 aspect-4/3 bg-white/5 rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-12">
      <FeaturedRow
        title="Top Artists"
        shows={sections.topArtistShows}
        onShowClick={onShowClick}
        getImageUrl={getImageUrl}
      />
      {sections.recent.length > 0 && (
        <FeaturedRow
          title="Featured"
          shows={sections.recent}
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
      {sections.decadeRows.map(({ decade, shows: decadeShows }) => (
        <FeaturedRow
          key={decade}
          title={decade}
          shows={decadeShows}
          onShowClick={onShowClick}
          getImageUrl={getImageUrl}
        />
      ))}
    </div>
  );
}

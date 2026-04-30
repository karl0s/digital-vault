import { useMemo } from 'react';
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
  if (shows.length === 0) return null;
  return (
    <motion.div
      className="mb-10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <h2 className="text-lg md:text-xl font-bold mb-3 px-4 md:px-8">{title}</h2>
      <div className="flex gap-3 overflow-x-auto px-4 md:px-8 pb-4 scrollbar-hide">
        {shows.map((show) => (
          <div key={show.ShowID} className="flex-shrink-0">
            <ShowCard show={show} onClick={() => onShowClick(show)} getImageUrl={getImageUrl} />
          </div>
        ))}
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

    // Top artists by show count → pick their most recent show
    const topArtistShows = Object.entries(artistShows)
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 20)
      .map(([, artistShows]) =>
        [...artistShows].sort((a, b) => (b.ShowDate || '').localeCompare(a.ShowDate || ''))[0]
      )
      .filter(Boolean) as Show[];

    // Recently added (by LastScannedAt)
    const recent = [...shows]
      .filter((s) => s.LastScannedAt)
      .sort((a, b) => (b.LastScannedAt! > a.LastScannedAt! ? 1 : -1))
      .slice(0, 24);

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
                  <div key={j} className="flex-shrink-0 w-64 aspect-[4/3] bg-white/5 rounded-lg" />
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
          title="Recently Added"
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

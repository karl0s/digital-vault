import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Show } from '../App';
import { ShowCard } from './ShowCard';

/**
 * Landing sections.
 *
 * Cards use the SAME grid as SearchResultsGrid rather than the horizontal
 * scroller this file used to own. Two layouts for one card type meant the
 * landing and the results never quite matched: the scroller sized cards from
 * the viewport (6.5 visible at 2xl, to leave a scroll peek) while the grid
 * sized them from column count (7 at 2xl). Same breakpoints, different widths,
 * visible seam when moving between the two.
 *
 * One grid, one set of column counts, defined once in GRID_COLS below.
 */

/**
 * Shared with SearchResultsGrid — if these diverge the landing stops matching
 * the results again. 7 columns at 2xl is why the Featured set is exactly 7:
 * it fills one clean row on a wide screen.
 */
export const GRID_COLS =
  'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-x-3 gap-y-6';

interface FeaturedSectionProps {
  title: string;
  shows: Show[];
  onShowClick: (show: Show) => void;
  getImageUrl: (checksum: string, index: number) => string | null;
}

function FeaturedSection({ title, shows, onShowClick, getImageUrl }: FeaturedSectionProps) {
  if (shows.length === 0) return null;

  return (
    <motion.section
      className="mb-10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <h2 className="mb-3 px-4 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 md:px-8">
        {title}
      </h2>
      <div className={`${GRID_COLS} px-4 md:px-8`}>
        {shows.map(show => (
          <ShowCard
            key={show.ShowID}
            show={show}
            onClick={() => onShowClick(show)}
            getImageUrl={getImageUrl}
          />
        ))}
      </div>
    </motion.section>
  );
}

/**
 * Hand-picked landing set, in display order. Exactly 7 so it fills one row at
 * 2xl. Where the archive holds several copies of a show, the ID here is the
 * best copy — largest file, complete date, setlist present.
 */
const FEATURED_IDS = [
  '7ba32801defb', // Stone Temple Pilots — MTV Unplugged, 1993-11-17 (3.24 GB, largest of 4 copies)
  '6b3751fea69f', // Jane's Addiction — Brixton Academy, 2003-09-30 (3.60 GB, dated copy)
  '3d97ae42ed27', // Soundgarden — MTV Live & Loud, 1996-09-20 (1.72 GB)
  '3fe2d2713abb', // Lenny Kravitz — MTV Unplugged, 1994 (1.45 GB, dated copy)
  '6cd303bce708', // Rage Against the Machine — Rock am Ring, 1996-05-24
  '730be7647294', // Red Hot Chili Peppers — Madison Square Gardens, 1996-02-09
  'a939ab1baf17', // Radiohead — New York, 1997-12-19
];

interface FeaturedRowsProps {
  shows: Show[];
  onShowClick: (show: Show) => void;
  getImageUrl: (checksum: string, index: number) => string | null;
}

export function FeaturedRows({ shows, onShowClick, getImageUrl }: FeaturedRowsProps) {
  const sections = useMemo(() => {
    if (shows.length === 0) return null;

    const byId = new Map(shows.map(s => [s.ShowID, s]));
    // Order follows FEATURED_IDS, not the catalogue — this row is curated, and
    // a missing ID drops out silently rather than leaving a hole.
    const featured = FEATURED_IDS.map(id => byId.get(id)).filter(Boolean) as Show[];

    const soundboards = shows
      .filter(s => s.RecordingType?.toLowerCase().includes('soundboard'))
      .sort((a, b) => (b.ShowDate || '').localeCompare(a.ShowDate || ''))
      .slice(0, 14);

    return { featured, soundboards };
  }, [shows]);

  if (!sections) {
    return (
      <div className="mx-auto max-w-[1924px] px-4 py-8 md:px-8" role="status" aria-label="Loading shows">
        <div className="animate-pulse space-y-10">
          {[1, 2].map(i => (
            <div key={i}>
              <div className="mb-4 h-3 w-32 rounded bg-white/5" />
              <div className={GRID_COLS}>
                {Array.from({ length: 7 }, (_, j) => (
                  <div key={j} className="aspect-4/3 rounded-md bg-white/5" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1924px] pb-16">
      <FeaturedSection
        title="Featured"
        shows={sections.featured}
        onShowClick={onShowClick}
        getImageUrl={getImageUrl}
      />
      <FeaturedSection
        title="Soundboard Recordings"
        shows={sections.soundboards}
        onShowClick={onShowClick}
        getImageUrl={getImageUrl}
      />
    </div>
  );
}

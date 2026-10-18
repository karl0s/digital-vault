import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Show } from '../App';
import { CONTENT_WIDTH } from '../src/lib/layout';
import { ShowCard } from './ShowCard';
import { RECENT_DAYS, addedWithin } from '../src/lib/added';
import { sortShows } from '../src/search/facets';

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
 * the results again. The owner's columns (2026-10-19, picked on
 * ~/VaultShots/reports/card-columns.html): one under 400px, two on other phones,
 * three on tablets and small laptops, four on laptops, five on desktops, six
 * from 1920px. The Cinematic card carries its text on the picture, so it wants
 * to be wide; 400px (25rem) is the one width the site's breakpoints don't name. The row
 * gap is tight for the same reason — there is no caption under a card.
 * GRID_TRACKS is the columns alone, for the artist tiles above search results.
 */
export const GRID_TRACKS = 'grid grid-cols-1 min-[25rem]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6';
export const GRID_COLS = `${GRID_TRACKS} gap-x-3 gap-y-3.5`;

/**
 * Fisher–Yates. Deliberately not `sort(() => Math.random() - 0.5)`, which this
 * file used to use: comparator-based shuffles are not uniform, and with a small
 * fixed set the bias is visible as certain shows favouring certain positions
 * across reloads.
 */
function shuffle<T>(input: T[]): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

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
      <div className={CONTENT_WIDTH}>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
          {title}
        </h2>
        <div className={GRID_COLS}>
          {shows.map(show => (
            <ShowCard
              key={show.ShowID}
              show={show}
              onSelect={onShowClick}
              getImageUrl={getImageUrl}
            />
          ))}
        </div>
      </div>
    </motion.section>
  );
}

/**
 * Hand-picked landing set: 12, two full rows of six (owner, 2026-10-15, after
 * dropping Strokes and Supergrass), shuffled into a new order on every visit.
 * Where the archive holds several copies of a show, the ID here is the chosen
 * copy, noted where it is not simply the largest.
 */
const FEATURED_IDS = [
  // 539 MB copy, chosen deliberately over the three larger ones (up to 3.24 GB).
  'ccd7ed3c2fa4', // Stone Temple Pilots — MTV Unplugged, 1993-11-17
  '6b3751fea69f', // Jane's Addiction — Brixton Academy, 2003-09-30 (3.60 GB, dated copy)
  '3d97ae42ed27', // Soundgarden — MTV Live & Loud, 1996-09-20 (1.72 GB)
  '3fe2d2713abb', // Lenny Kravitz — MTV Unplugged, 1994 (1.45 GB, dated copy)
  '6cd303bce708', // Rage Against the Machine — Rock am Ring, 1996-05-24
  '730be7647294', // Red Hot Chili Peppers — Madison Square Gardens, 1996-02-09
  'a939ab1baf17', // Radiohead — New York, 1997-12-19
  '761b022efa1e', // Beastie Boys — SECC Glasgow, 1999-05-03 (3.15 GB, of four Glasgow copies)
  '4dba0c8ff6ae', // Nirvana — MTV Live & Loud, Pier 48 Seattle, 1993-12-13 (the 38-min broadcast)
  'bfac3916a5f1', // Smashing Pumpkins — Belfort, 1997-07-04 (4.34 GB; EventOrFestival blank)
  'b3adea22181d', // Blur — Glastonbury Festival, 2009-06-28
  'd6f2b50df44c', // Foo Fighters — Melbourne, 2000-02-01 (1.61 GB, the 2000 copy)
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
    // Curated set, shuffled once per load so the landing looks different on
    // each visit and no show is permanently buried on the second row. A missing
    // ID drops out silently rather than leaving a hole.
    //
    // Shuffling inside useMemo keyed on `shows` is what keeps it to once per
    // load: re-randomising on every render would reorder the grid under the
    // pointer whenever anything else in the tree updated.
    const featured = shuffle(
      FEATURED_IDS.map(id => byId.get(id)).filter(Boolean) as Show[],
    );

    // What's new (F11): the latest additions, newest first, two rows at most.
    // Absent until something has been added in the last RECENT_DAYS.
    const recent = sortShows(shows.filter(s => addedWithin(s, RECENT_DAYS)), 'added').slice(0, 12);

    return { featured, recent };
  }, [shows]);

  if (!sections) {
    return (
      <div className={`${CONTENT_WIDTH} py-8`} role="status" aria-label="Loading shows">
        <div className="animate-pulse">
          <div className="mb-4 h-3 w-32 rounded bg-white/5" />
          <div className={GRID_COLS}>
            {Array.from({ length: FEATURED_IDS.length }, (_, j) => (
              <div key={j} className="aspect-4/3 rounded-[10px] bg-white/5" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-6">
      <FeaturedSection
        title="Recently added"
        shows={sections.recent}
        onShowClick={onShowClick}
        getImageUrl={getImageUrl}
      />
      <FeaturedSection
        title="Featured shows"
        shows={sections.featured}
        onShowClick={onShowClick}
        getImageUrl={getImageUrl}
      />
    </div>
  );
}

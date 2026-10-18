import { motion } from 'motion/react';
import { HalationLogo } from './logos/HalationLogo';

interface HeroSearchProps {
  /** Collapses the block to zero height while a search or filter is active. */
  isSearching?: boolean;
  /**
   * Open or close without animating. Set for one render when App jumps to the
   * artist list: a masthead growing over 0.28s would move the list while the
   * page scrolls to it, and the jump would land short.
   */
  instant?: boolean;
  /** The tagline, with the count from the data (F16): "1,213 live shows worth reliving." */
  summary?: string;
}

/**
 * Landing masthead: the wordmark, and one line that is both the tagline and
 * what the site is: "1,213 live shows worth reliving.".
 *
 * This is the only place the brand appears. Search and the filters live in
 * the filter bar directly below it, and the Featured grid is the landing's
 * entry point rather than a row of shortcuts competing with it.
 *
 * Always mounted, animating to zero height rather than unmounting, so the
 * search field in the bar below keeps its place and focus mid-keystroke.
 */
export function HeroSearch({ isSearching = false, instant = false, summary }: HeroSearchProps) {
  return (
    <motion.div
      style={{ overflow: 'hidden' }}
      // Printing is for the list (F10): no masthead on paper.
      className="print:hidden"
      animate={isSearching ? { opacity: 0, height: 0 } : { opacity: 1, height: 'auto' }}
      transition={instant ? { duration: 0 } : {
        opacity: { duration: 0.18, ease: 'easeOut' },
        height: { duration: 0.28, ease: [0.4, 0, 0.2, 1] },
      }}
    >
      {/* Static inner wrapper owns all padding — keeps it out of the height animation */}
      <div className="relative flex flex-col items-center overflow-hidden px-4 pt-10 pb-8 text-center">
        {/* Atmospheric radial glow — faint red from above, like stage lighting */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 90% 55% at 50% -5%, rgba(229,9,20,0.10) 0%, transparent 65%)',
          }}
        />
        {/* Subtle bottom vignette to blend into the grid below */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-24"
          style={{ background: 'linear-gradient(to bottom, transparent, #141414)' }}
        />

        <div className="relative w-full max-w-5xl">
          <motion.div
            className="flex w-full justify-center"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <HalationLogo scale={1} style={{ width: '70%', height: 'auto' }} />
          </motion.div>

          {/* One line, the tagline and what the site is (owner, 2026-10-18):
              "1,213 live shows worth reliving." It fades in once the data has
              counted the shows; until then the line holds its place unseen,
              so nothing moves and the old wording never flashes. */}
          <motion.p
            className="-mt-2 text-sm uppercase tracking-widest text-gray-400 md:text-base"
            style={{ letterSpacing: '0.25em' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: summary ? 1 : 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            {summary || 'Live shows worth reliving.'}
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
}

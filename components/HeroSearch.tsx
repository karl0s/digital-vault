import { motion } from 'motion/react';
import { HalationLogo } from './logos/HalationLogo';

interface HeroSearchProps {
  /** Collapses the block to zero height while a search or filter is active. */
  isSearching?: boolean;
}

/**
 * Landing masthead: wordmark and tagline, nothing else.
 *
 * This is the only place the brand appears — the header and sidebar were both
 * carrying it and that was duplicate chrome. The quick-search pills and the
 * "All artists" link that used to sit here are gone too: artist navigation
 * lives in the sidebar, and the Featured grid below is now the landing's
 * entry point rather than a row of shortcuts competing with it.
 *
 * Always mounted, animating to zero height rather than unmounting, so the nav
 * search input never disappears mid-keystroke.
 */
export function HeroSearch({ isSearching = false }: HeroSearchProps) {
  return (
    <motion.div
      style={{ overflow: 'hidden' }}
      animate={isSearching ? { opacity: 0, height: 0 } : { opacity: 1, height: 'auto' }}
      transition={{
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

          <motion.p
            className="-mt-2 text-sm uppercase tracking-widest text-gray-400 md:text-base"
            style={{ letterSpacing: '0.25em' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            Live music worth reliving.
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
}

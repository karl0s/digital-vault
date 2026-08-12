import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Show } from '../App';
import { getArtistDirectory } from '../src/search/searchIndex';

interface ArtistsViewProps {
  shows: Show[];
  onArtistSelect: (artist: string) => void;
}

/**
 * The artist index — a browsable A–Z directory of the whole collection.
 *
 * Exists because open search demands recall: you can only find an artist if you
 * already know they're in the archive. This is the recognition path. Every
 * artist carries a show count so the shape of the collection is legible at a
 * glance (44% of artists have a single show; the top 12 are half the archive).
 *
 * Selecting an artist runs the exact-artist facet, never a text search.
 *
 * LAYOUT — each letter is a self-contained vertical list, so reading a letter
 * is a single top-to-bottom scan with no left-right zig-zag. The blocks are
 * flowed with CSS multi-column + break-inside:avoid rather than placed on an
 * aligned grid: letter groups range from 1 artist (U) to 15 (B, S), and an
 * aligned grid makes every row as tall as its tallest letter, leaving ~36%
 * of the page as holes. Column packing keeps it tight and roughly 2 screens.
 *
 * Styling follows the established site vocabulary:
 *   - page header      → matches SearchResultsGrid (text-4xl bold + gray-500 sub)
 *   - section label    → matches FeaturedRows row titles
 *   - letter chips     → matches the circular controls in FeaturedRows/CloseButton
 *   - container width  → max-w-[1860px], same as SearchResultsGrid
 */
export function ArtistsView({ shows, onArtistSelect }: ArtistsViewProps) {
  const groups = useMemo(() => getArtistDirectory(shows), [shows]);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [flashLetter, setFlashLetter] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const railRef = useRef<HTMLDivElement>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalArtists = groups.reduce((n, g) => n + g.artists.length, 0);

  /**
   * True when the blocks are stacked in one column (mobile). Measured from the
   * DOM rather than a breakpoint guess, because the column count is decided by
   * CSS `column-width`, not by a named breakpoint.
   */
  const isSingleColumn = useCallback(() => {
    const els = groups.map(g => sectionRefs.current[g.letter]).filter(Boolean) as HTMLElement[];
    if (els.length < 2) return true;
    const left = els[0].getBoundingClientRect().left;
    return els.every(el => Math.abs(el.getBoundingClientRect().left - left) < 1);
  }, [groups]);

  /**
   * Track the letter being read — but only in the single-column layout, where
   * document order and vertical order agree. Once the blocks flow into columns,
   * several letters share the same vertical band and "the current letter" stops
   * having a meaning, so the rail drops its highlight rather than lying.
   */
  useEffect(() => {
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!isSingleColumn()) {
          setActiveLetter(null);
          return;
        }
        // The reading line sits a fifth of the way down the space below the
        // rail, not flush against it — otherwise a section only counts as
        // current once its heading has fully cleared the rail, leaving the
        // previous letter highlighted while its content fills the screen.
        const railBottom = railRef.current?.getBoundingClientRect().bottom ?? 120;
        const line = railBottom + Math.max(24, (window.innerHeight - railBottom) * 0.2);
        let current = groups[0]?.letter ?? null;
        for (const { letter } of groups) {
          const el = sectionRefs.current[letter];
          if (!el) continue;
          if (el.getBoundingClientRect().top <= line) current = letter;
          else break;
        }
        setActiveLetter(current);
      });
    };

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      cancelAnimationFrame(raf);
    };
  }, [groups, isSingleColumn]);

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  /**
   * Jumping in a packed multi-column layout can scroll barely at all — the
   * target may already be on screen, just in a different column. A brief
   * highlight on the destination confirms the jump landed.
   */
  const jumpTo = (letter: string) => {
    sectionRefs.current[letter]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setFlashLetter(letter);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashLetter(null), 1200);
  };

  // `shows` starts empty while shows.json is in flight and useShows exposes no
  // loading flag, so without this the directory renders "0 artists · 0 shows"
  // over a blank page on an early click.
  if (groups.length === 0) {
    return (
      <motion.div
        key="artists"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="px-4 md:px-8 pt-10"
      >
        <div className="max-w-[1860px] mx-auto">
          <h2 className="text-4xl font-bold text-white">Artists</h2>
          <p className="text-gray-400 text-sm mt-1">Loading the archive…</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="artists"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="pt-10"
    >
      {/* Page header — same scale and rhythm as the search results header */}
      <div className="px-4 md:px-8">
        <div className="max-w-[1860px] mx-auto mb-6">
          <h2 className="text-4xl font-bold text-white">Artists</h2>
          <p className="text-gray-400 text-sm mt-1">
            <span className="text-gray-200 tabular-nums">{totalArtists}</span> artists ·{' '}
            <span className="text-gray-200 tabular-nums">{shows.length}</span> shows
          </p>
        </div>
      </div>

      {/* A–Z jump rail. Sticky below the nav, and matching its surface
          treatment so the two read as one layer while scrolling. The rail sits
          OUTSIDE the max-w wrapper so its background reaches the viewport edge
          like the nav's does; only its contents are capped. Capping the bar
          itself left a visible seam against the nav above 1892px. */}
      <div
        ref={railRef}
        className="sticky top-16 z-20 py-3 bg-[#141414]/97 backdrop-blur-md border-b border-white/6"
      >
        <div className="relative max-w-[1860px] mx-auto px-4 md:px-8">
          {/* Mobile: one horizontally scrolling strip (same idiom as the drawer
              thumbnails) so the pinned rail stays compact instead of eating a
              third of the screen. Desktop: wraps to a single row. */}
          <div className="flex gap-1 overflow-x-auto scrollbar-hide md:flex-wrap md:overflow-x-visible">
            {groups.map(({ letter }) => {
              const highlighted = letter === activeLetter || letter === flashLetter;
              return (
                <button
                  key={letter}
                  onClick={() => jumpTo(letter)}
                  aria-label={`Jump to ${letter}`}
                  aria-current={letter === activeLetter ? 'true' : undefined}
                  className={`cursor-pointer shrink-0 w-10 h-10 md:w-8 md:h-8 rounded-full text-xs font-semibold transition-colors duration-150 ${
                    highlighted
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
          {/* 27 letters overflow a phone by ~3.4×, and scrollbar-hide removes
              the only other cue that the strip scrolls. */}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-linear-to-l from-[#141414] to-transparent md:hidden" />
        </div>
      </div>

      <div className="px-4 md:px-8">
        <div className="max-w-[1860px] mx-auto">
        {/*
          column-width (not column-count) so the browser fits as many columns as
          the viewport allows: 4 at 1280px, 5 at 1440, 6 at 1680, 7 at 1920.
          Every resulting column lands at 244–286px.

          Those numbers are load-bearing. The widest row in the collection is
          "Creedence Clearwater Revival" at 234px, so 244px is the floor that
          keeps every artist name un-truncated; an 8th column would drop to
          211px and clip the five longest names. The 24px gutter (rather than
          32px) is what buys the 7th column without going under that floor.
        */}
        <div className="mt-8 pb-8 columns-[240px] gap-x-6">
          {groups.map(({ letter, artists }) => (
            <section
              key={letter}
              data-letter={letter}
              ref={el => { sectionRefs.current[letter] = el; }}
              /* break-inside-avoid keeps a letter's list whole — a block never
                 splits across two columns. scroll-mt clears nav (64px) + the
                 sticky rail, which is 64px on mobile and 56px on desktop. */
              className="break-inside-avoid mb-8 scroll-mt-36"
            >
              {/* The letter is the primary wayfinding anchor in a packed
                  multi-column index, so it carries real weight: white and bold,
                  one size step below the "Artists" page title (text-4xl). No
                  tracking — it applied trailing letter-spacing to a single
                  character. The jump flash is a background highlight rather
                  than a colour change, echoing the rail's active chip. */}
              <h3 className="mb-1">
                <span
                  className={`inline-block text-2xl font-bold leading-tight text-white rounded-md px-2 -mx-2 transition-colors duration-300 ${
                    letter === flashLetter ? 'bg-white/10' : 'bg-transparent'
                  }`}
                >
                  {letter}
                </span>
              </h3>
              <div className="flex flex-col">
                {artists.map(({ name, count }) => (
                  <button
                    key={name}
                    onClick={() => onArtistSelect(name)}
                    className="cursor-pointer group flex items-baseline justify-between gap-3 text-left px-3 py-2 rounded-md hover:bg-white/10 transition-colors duration-150"
                  >
                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors truncate">
                      {name}
                    </span>
                    <span className="text-xs text-gray-400 group-hover:text-gray-200 tabular-nums shrink-0 transition-colors">
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
        </div>
      </div>
    </motion.div>
  );
}

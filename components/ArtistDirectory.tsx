import { forwardRef, memo, useMemo } from 'react';
import { Show } from '../App';
import { getArtistDirectory } from '../src/search/searchIndex';
import { CONTENT_WIDTH } from '../src/lib/layout';

interface ArtistDirectoryProps {
  shows: Show[];
  onArtistSelect: (artist: string) => void;
}

/**
 * Every artist A–Z, under Featured shows (owner, 2026-10-13).
 *
 * It was the Artists destination; it now follows the curated row on the one
 * page, and its page header and A–Z jump rail went with the destination. "All
 * artists" in the filter bar and the phone's Artists tab jump here.
 *
 * Exists because open search demands recall: you can only find an artist if
 * you already know they're in the archive. This is the recognition path. Every
 * artist carries a show count so the shape of the collection is legible at a
 * glance (44% of artists have a single show; the top 12 are half the archive).
 * Selecting one runs the exact-artist facet, never a text search.
 *
 * LAYOUT — each letter is a self-contained vertical list, so reading a letter
 * is a single top-to-bottom scan with no left-right zig-zag. The blocks are
 * flowed with CSS multi-column + break-inside:avoid rather than placed on an
 * aligned grid: letter groups range from 1 artist (U) to 15 (B, S), and an
 * aligned grid makes every row as tall as its tallest letter, leaving ~36%
 * of the page as holes. Column packing keeps it tight.
 *
 * Memoised: its props are stable, so opening the drawer skips ~300 buttons.
 */
export const ArtistDirectory = memo(forwardRef<HTMLElement, ArtistDirectoryProps>(function ArtistDirectory(
  { shows, onArtistSelect },
  ref,
) {
  const groups = useMemo(() => getArtistDirectory(shows), [shows]);

  // `shows` starts empty while the data is in flight; Featured shows carries
  // the loading state above, so this simply waits.
  if (groups.length === 0) return null;

  return (
    <section ref={ref} aria-labelledby="all-artists" className="pt-2">
      <h2 id="all-artists" className="sr-only">All artists</h2>
      <div className={CONTENT_WIDTH}>
        {/*
          column-width (not column-count) so the browser fits as many columns as
          the viewport allows. Every resulting column lands at 244–286px.

          Those numbers are load-bearing. The widest row in the collection is
          "Creedence Clearwater Revival" at 234px, so 244px is the floor that
          keeps every artist name un-truncated; one more column would clip the
          five longest names. The 24px gutter (rather than 32px) buys a column
          without going under that floor.
        */}
        <div className="columns-[240px] gap-x-6 border-t border-white/6 pb-8 pt-8">
          {groups.map(({ letter, artists }) => (
            // break-inside-avoid keeps a letter's list whole — a block never
            // splits across two columns.
            <section key={letter} aria-label={letter} className="mb-8 break-inside-avoid">
              {/* The letter is the wayfinding anchor in a packed multi-column
                  index, so it carries real weight: white and bold. No tracking
                  — it applied trailing letter-spacing to a single character. */}
              <h3 className="mb-1 text-2xl font-bold leading-tight text-white">{letter}</h3>
              <div className="flex flex-col">
                {artists.map(({ name, count }) => (
                  <button
                    key={name}
                    onClick={() => onArtistSelect(name)}
                    className="group flex cursor-pointer items-baseline justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors duration-150 hover:bg-white/10"
                  >
                    <span className="truncate text-sm text-gray-300 transition-colors group-hover:text-white">
                      {name}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-gray-400 transition-colors group-hover:text-gray-200">
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}));

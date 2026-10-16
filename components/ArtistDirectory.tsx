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
 * you already know they're in the archive. This is the recognition path.
 * Selecting one runs the exact-artist facet, never a text search.
 *
 * HIERARCHY (owner, 2026-10-13) — scanning down a long list, so three levels
 * and one edge: the letter (Bebas Neue, the display face, 36px) is the anchor
 * the eye jumps between; the name is what it reads; the show count is there
 * but barely (white 17%), coming back on the row being pointed at. Names line
 * up exactly under their letter — the row's hover fill bleeds out past that
 * edge instead of indenting the text. Tried and dropped: thumbnails per row,
 * fading the other letters on hover, white names for 5+ show artists.
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
  const artistCount = useMemo(() => groups.reduce((n, g) => n + g.artists.length, 0), [groups]);

  // `shows` starts empty while the data is in flight; Featured shows carries
  // the loading state above, so this simply waits.
  if (groups.length === 0) return null;

  return (
    <section ref={ref} aria-labelledby="all-artists" className="pt-2">
      <div className={CONTENT_WIDTH}>
        {/* Labelled like Featured shows above it: what the section is, and how many. */}
        <h2 id="all-artists" className="mb-3 flex items-baseline gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
          All artists
          <span className="font-normal tracking-normal tabular-nums text-white/50">{artistCount}</span>
        </h2>
        {/*
          column-width (not column-count) so the browser fits as many columns as
          the viewport allows. Every resulting column lands at 244–286px.

          Those numbers are load-bearing. The widest name in the collection is
          "Creedence Clearwater Revival" at 193px, and with the row's
          padding bled out into the gutter (below) the name has the whole
          column, so every artist stays un-truncated with room to spare. The
          24px gutter (rather than 32px) buys a column; the 12px bleed of each
          row's hover fill takes half of it.
        */}
        <div className="columns-[240px] gap-x-6 border-t border-white/6 pb-8 pt-8">
          {groups.map(({ letter, artists }) => (
            // break-inside-avoid keeps a letter's list whole — a block never
            // splits across two columns.
            <section key={letter} aria-label={letter} className="mb-8 break-inside-avoid md:mb-7">
              {/* The wayfinding anchor in a packed multi-column index, in the
                  display face the drawer uses for artist names. */}
              <h3 className="mb-1.5 font-(family-name:--font-display) text-[36px] leading-none tracking-[0.02em] text-white">
                {letter}
              </h3>
              {/* -mx-3: the names sit on the letter's edge; the hover fill
                  bleeds past it. Rows are 32px from md, 36px on a phone. */}
              <div className="-mx-3 flex flex-col">
                {artists.map(({ name, count }) => (
                  <button
                    key={name}
                    onClick={() => onArtistSelect(name)}
                    className="group flex cursor-pointer items-baseline justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors duration-150 hover:bg-white/10 md:py-1.5"
                  >
                    <span className="truncate text-sm text-gray-300 transition-colors group-hover:text-white group-focus-visible:text-white">
                      {name}
                    </span>
                    {/* Quiet until the row is pointed at: the number is for
                        when you look for it, not for scanning. White/50 is the
                        quietest that is still legible (5.3:1, AA); the owner's
                        "Ghost" 1.7:1 (2026-10-13) failed it (F13, 2026-10-16). */}
                    <span className="shrink-0 text-xs tabular-nums text-white/50 transition-colors group-hover:text-gray-300 group-focus-visible:text-gray-300">
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

import { Music2, Search, X } from 'lucide-react';
import { RefObject } from 'react';
import { cn } from '../../src/lib/cn';
import { CONTENT_WIDTH } from '../../src/lib/layout';
import { FacetKey, SortKey } from '../../src/lib/url';
import { FacetCounts, YearHistogram } from '../../src/search/facets';
import { useFilterStore } from '../../src/store/filters';
import { FacetPopover } from './FacetPopover';
import { YearRangePopover } from './YearRangePopover';

/**
 * The page's one sticky bar (owner, 2026-10-13): search, "All artists", then
 * the facets. It replaced the fixed top bar, whose search lined up with the
 * old sidebar rather than the shows; it sits on the shared content width, so
 * every control starts on the same edge as the cards below it.
 *
 * Three stacked pieces, two of them conditional:
 *   1. search, All artists, facet triggers — always
 *   2. active filter chips                 — only while something is selected
 *   3. result count + sort                 — only while filtering; until then
 *      the page shows Featured shows and the artist list, which have no count
 *      or order to set
 *
 * data-filter-bar is how App finds it to measure: the jump to the artist list
 * scrolls to just under it, whatever height it has wrapped to.
 */

// Years are handled by their own range control, not as a multi-select facet.
// Both list only values with 6+ shows (owner, 2026-10-13); the rest are still
// found by searching their name. 'festival' is labelled Event because most of
// it is TV programmes, but keeps its key, so old links still work.
const FACETS: { key: FacetKey; label: string; minTotal?: number }[] = [
  { key: 'country', label: 'Country', minTotal: 6 },
  { key: 'festival', label: 'Event', minTotal: 6 },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'year-desc', label: 'Year — newest first' },
  { key: 'year-asc', label: 'Year — oldest first' },
  { key: 'artist', label: 'Artist A–Z' },
];

interface FilterBarProps {
  counts: FacetCounts;
  histogram: YearHistogram;
  resultCount: number;
  /** Anything filtering: shows the count and sort row. */
  filtered: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchInputRef: RefObject<HTMLInputElement>;
  /** Clears everything and jumps to the artist list. */
  onAllArtists: () => void;
  /** The artist list is on screen under the bar. */
  allArtistsActive: boolean;
}

const PILL = 'flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors duration-150';

export function FilterBar({
  counts, histogram, resultCount, filtered, searchQuery, onSearchChange, searchInputRef, onAllArtists, allArtistsActive,
}: FilterBarProps) {
  const state = useFilterStore();
  const { toggleFacet, clearFacet, clearAll, setSort, setYearRange, toggleUndated } = state;

  const facetChips = FACETS.flatMap(({ key }) =>
    counts[key]
      .filter(o => o.selected)
      .map(o => ({
        id: `${key}:${o.value}`,
        label: o.label,
        remove: () => toggleFacet(key, o.value),
      })),
  );

  // The range reads as one chip however many ends are set — "1993–2011" is a
  // single idea, and two chips would imply they can be removed separately.
  const rangeChip =
    state.from !== null || state.to !== null
      ? {
          id: 'years',
          label:
            state.from !== null && state.to !== null && state.from === state.to
              ? `${state.from}`
              : `${state.from ?? '…'}–${state.to ?? '…'}`,
          remove: () => setYearRange(null, null),
        }
      : null;

  const undatedChip = state.undated
    ? { id: 'undated', label: 'Incl. undated', remove: toggleUndated }
    : null;

  const active = [rangeChip, undatedChip, ...facetChips].filter(Boolean) as {
    id: string; label: string; remove: () => void;
  }[];

  return (
    // z-30: above the grid, under the phone tab bar (z-40) and the drawer (z-50).
    <div data-filter-bar className="sticky top-0 z-30 border-b border-white/6 bg-[#141414]/97 backdrop-blur-md">
      <div className={CONTENT_WIDTH}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-3 py-3">
          {/* One of the pills: same height and roundness as the controls beside
              it. text-base below md, or iOS zooms the page on focus. */}
          <div className="relative w-full lg:w-auto lg:min-w-[260px] lg:max-w-md lg:flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 md:h-3.5 md:w-3.5" aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Artist, song, venue, year…"
              aria-label="Search shows"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="w-full rounded-full border border-white/10 bg-white/7 py-2 pl-10 pr-9 text-base text-white placeholder-gray-400 transition-colors focus:border-white/25 focus:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 md:py-1.5 md:pl-9 md:text-sm [&::-webkit-search-cancel-button]:hidden"
            />
            {searchQuery && (
              <button
                onClick={() => { onSearchChange(''); searchInputRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400 transition-colors hover:text-white"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Scrolls sideways on a phone, so the next control peeks in. */}
          <div className="-mx-4 flex w-full items-center gap-2 overflow-x-auto px-4 scrollbar-hide md:mx-0 md:px-0 lg:w-auto lg:overflow-visible">
            {/* Beside the search: the other way to find someone. A jump, not a
                filter, so it has no chevron; lit while the list is on screen. */}
            <button
              onClick={onAllArtists}
              aria-current={allArtistsActive ? 'true' : undefined}
              className={cn(
                PILL,
                allArtistsActive
                  ? 'border-white/20 bg-white/10 text-white'
                  : 'border-white/8 bg-white/5 text-gray-400 hover:border-white/20 hover:bg-white/10 hover:text-white',
              )}
            >
              <Music2 className="h-3.5 w-3.5" aria-hidden="true" />
              All artists
            </button>
            <span className="mx-1 h-6 w-px shrink-0 bg-white/10" aria-hidden="true" />
            <YearRangePopover histogram={histogram} />
            {FACETS.map(({ key, label, minTotal }) => (
              <FacetPopover
                key={key}
                label={label}
                options={counts[key]}
                minTotal={minTotal}
                selectedCount={state[key].length}
                onToggle={value => toggleFacet(key, value)}
                onClear={() => clearFacet(key)}
              />
            ))}
          </div>
        </div>

        {active.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pb-3">
            {active.map(chip => (
              <button
                key={chip.id}
                onClick={chip.remove}
                className="flex cursor-pointer items-center gap-1.5 rounded-full bg-white/10 py-1 pl-3 pr-2 text-sm text-white transition-colors duration-150 hover:bg-white/20"
                aria-label={`Remove filter ${chip.label}`}
              >
                {chip.label}
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ))}
            <button
              onClick={clearAll}
              className="cursor-pointer px-2 py-1 text-sm text-gray-400 underline underline-offset-2 transition-colors hover:text-white"
            >
              Clear all
            </button>
          </div>
        )}

        {/* The count is announced when filters change — otherwise a screen-
            reader user gets no feedback that anything happened. The live
            region is always mounted and visually hidden: the visible row below
            is display:none until something filters, and a region inside it
            would be silent at the very moment it appears. */}
        <p className="sr-only" aria-live="polite">
          {filtered ? `${resultCount} ${resultCount === 1 ? 'show' : 'shows'}` : ''}
        </p>
        <div className={cn('items-center justify-between gap-4 pb-3', filtered ? 'flex' : 'hidden')}>
          <p className="text-sm text-gray-400" aria-hidden="true">
            <span className="tabular-nums text-gray-200">{resultCount}</span>
            {resultCount === 1 ? ' show' : ' shows'}
          </p>

          <label className="flex shrink-0 items-center gap-2 text-sm text-gray-400">
            <span className="sr-only md:not-sr-only">Sort</span>
            <select
              value={state.sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className={cn(
                'cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70',
              )}
            >
              {SORTS.map(s => (
                <option key={s.key} value={s.key} className="bg-[#1f1f1f]">
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}

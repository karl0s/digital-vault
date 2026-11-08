import { ChevronDown, Download, LayoutGrid, List, Search, SlidersHorizontal, X } from 'lucide-react';
import { RefObject, useEffect, useRef, useState } from 'react';
import { BADGE_DAYS } from '../../src/lib/added';
import { cn } from '../../src/lib/cn';
import { CONTENT_WIDTH } from '../../src/lib/layout';
import { FACET_KEYS, FacetKey, SortKey } from '../../src/lib/url';
import { FacetCounts, YearHistogram } from '../../src/search/facets';
import { useFilterStore } from '../../src/store/filters';
import { FacetPopover } from './FacetPopover';
import { FilterSheet } from './FilterSheet';
import { MoreFiltersPopover } from './MoreFiltersPopover';
import { YearRangePopover } from './YearRangePopover';

/**
 * The page's one sticky bar (owner, 2026-10-13): search, then the facets. The
 * "All artists" jump that sat between them went the same day (owner) — the
 * list is under Featured shows, and the phone's Artists tab still jumps there. It replaced the fixed top bar, whose search lined up with the
 * old sidebar rather than the shows; it sits on the shared content width, so
 * every control starts on the same edge as the cards below it.
 *
 * Three stacked pieces, two of them conditional:
 *   1. search, facet triggers — always
 *   2. active filter chips                 — only while something is selected
 *   3. result count + sort                 — only while filtering; until then
 *      the page shows Featured shows and the artist list, which have no count
 *      or order to set
 *
 * data-filter-bar is how App finds it to measure: the jump to the artist list
 * scrolls to just under it, whatever height it has wrapped to.
 *
 * PHONES (docs/ux-research/06-mobile-audit.md, R7, R8, R13): with four filters
 * on, the bar and the chips under it took 44% of the screen. Below md the bar
 * is the search, then one 44px row: Filters (with how many are set), and while
 * filtering the count, list or cards, and the sort — or, on the landing, New.
 * Filters opens every filter in a sheet from the bottom (FilterSheet), which
 * holds the chips too. The row folds while scrolling down. From md the bar is
 * as it was: the popovers, the chips, the results row.
 */

// Years are handled by their own range control, not as a multi-select facet.
// Both list only values with 6+ shows (owner, 2026-10-13); the rest are still
// found by searching their name. 'festival' is labelled Event because most of
// it is TV programmes, but keeps its key, so old links still work.
const FACETS: { key: FacetKey; label: string; minTotal?: number }[] = [
  { key: 'country', label: 'Country', minTotal: 6 },
  { key: 'festival', label: 'Event', minTotal: 6 },
];

// `short`: the phone's row has room for one word; its picker lists the labels.
const SORTS: { key: SortKey; label: string; short: string }[] = [
  { key: 'year-desc', label: 'Year — newest first', short: 'Newest' },
  { key: 'year-asc', label: 'Year — oldest first', short: 'Oldest' },
  { key: 'artist', label: 'Artist A–Z', short: 'A–Z' },
  { key: 'length', label: 'Length — longest first', short: 'Longest' },
  { key: 'added', label: 'Recently added', short: 'Added' },
];

interface FilterBarProps {
  counts: FacetCounts;
  histogram: YearHistogram;
  resultCount: number;
  /** Anything filtering: shows the count and sort row. */
  filtered: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  /** Enter, or the phone keyboard's Search key (App: settles the search, closes the keyboard). */
  onSearchSubmit: () => void;
  searchInputRef: RefObject<HTMLInputElement>;
  /** Downloads the results on screen as a CSV (F10). */
  onDownloadCsv: () => void;
}

export function FilterBar({
  counts, histogram, resultCount, filtered, searchQuery, onSearchChange, onSearchSubmit, searchInputRef, onDownloadCsv,
}: FilterBarProps) {
  const state = useFilterStore();
  const barRef = useRef<HTMLDivElement>(null);

  // The phone's filter sheet (R8). Closed if the screen grows past a phone's,
  // where the popovers take over.
  const [sheetOpen, setSheetOpen] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 48rem)');
    const onChange = () => { if (desktop.matches) setSheetOpen(false); };
    desktop.addEventListener('change', onChange);
    return () => desktop.removeEventListener('change', onChange);
  }, []);

  // F18: on a phone the bar took a fifth of the screen. While scrolling down
  // through results, the phone's row of controls (Filters, the count, layout,
  // sort) folds away; it comes back on the way up. Not on the landing: the
  // jump to the A–Z list lands under the bar's full height. Written to the DOM, never React state: a scroll
  // listener must not re-render the bar. The bar gives the row's height back
  // as margin (--fold), so nothing under it moves while it folds.
  const filteredRef = useRef(filtered);
  filteredRef.current = filtered;
  // Back to the landing: unfolded, or the row would stay hidden there.
  useEffect(() => { if (!filtered) barRef.current?.removeAttribute('data-folded'); }, [filtered]);
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const phone = window.matchMedia('(max-width: 47.99rem)');
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastY;
      if (Math.abs(dy) < 8) return;
      lastY = y;
      const folded = bar.hasAttribute('data-folded');
      if (folded) {
        // Back on the way up, or when the screen is no longer a phone's.
        if (dy < 0 || !phone.matches) bar.removeAttribute('data-folded');
        return;
      }
      // Measured as it folds: its height is the margin that stands in for it.
      const row = bar.querySelector<HTMLElement>('[data-results-row]');
      if (dy > 0 && filteredRef.current && phone.matches && bar.getBoundingClientRect().top <= 0 && row && row.offsetHeight > 0) {
        bar.style.setProperty('--fold', `${row.offsetHeight}px`);
        bar.setAttribute('data-folded', '');
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const { toggleFacet, clearFacet, clearAll, setSort, setLayout, setYearRange, toggleUndated } = state;

  // A chip per selected value, Country and Event first, then "More filters".
  const facetChips = FACET_KEYS.flatMap(key =>
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

  // The landing's one tap to what's new (R13): the New filter, as in More
  // filters, with how many shows it holds.
  const newCount = counts.added.find(o => o.value === 'new')?.count ?? 0;
  const otherLayout = state.layout === 'grid' ? 'list' : 'grid';

  return (
    // z-30: above the grid, under the phone tab bar (z-40) and the drawer (z-50).
    <div
      ref={barRef}
      data-filter-bar
      className="group/bar sticky top-0 z-30 border-b border-white/6 bg-[#141414]/97 backdrop-blur-md print:hidden max-md:data-folded:mb-(--fold)"
    >
      <div className={CONTENT_WIDTH}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-3 py-3 max-md:pb-2.5">
          {/* One of the pills: same height and roundness as the controls beside
              it. text-base below md, or iOS zooms the page on focus. A form,
              so a phone's keyboard offers Search, and Enter is one event. */}
          <form
            role="search"
            onSubmit={e => { e.preventDefault(); onSearchSubmit(); }}
            className="relative w-full lg:w-auto lg:min-w-[260px] lg:max-w-md lg:flex-1"
          >
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 md:h-3.5 md:w-3.5" aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Artist, song, venue, date…"
              aria-label="Search shows"
              enterKeyHint="search"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="w-full rounded-full border border-white/10 bg-white/7 py-2 pl-10 pr-9 text-base max-md:h-11 text-white placeholder-gray-400 transition-colors focus:border-white/25 focus:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 md:py-1.5 md:pl-9 md:text-sm [&::-webkit-search-cancel-button]:hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { onSearchChange(''); searchInputRef.current?.focus(); }}
                // touch-target: a 44px area on a phone around the small × (R12).
                className="touch-target absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400 transition-colors hover:text-white"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </form>

          {/* From md. Scrolls sideways on a tablet, so the next control peeks in. */}
          <div className="hidden w-full items-center gap-2 overflow-x-auto scrollbar-hide md:flex lg:w-auto lg:overflow-visible">
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
            <MoreFiltersPopover counts={counts} />
          </div>
        </div>

        {/* Phones: one row of controls (R7). Folds while scrolling down, and
            steps aside while the search is being typed, so the results show
            above the keyboard (R4). */}
        <div data-results-row className="overflow-hidden md:hidden group-data-folded/bar:h-0 group-has-[input:focus]/bar:h-0">
          <div className="flex items-center gap-1.5 pb-2.5">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-haspopup="dialog"
              className={cn(
                'flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors duration-150',
                active.length > 0 ? 'border-white/22 bg-white/12 text-white' : 'border-white/10 bg-white/5 text-gray-200',
              )}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Filters
              {active.length > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-semibold tabular-nums text-[#111]">
                  {active.length}<span className="sr-only"> set</span>
                </span>
              )}
            </button>
            {filtered ? (
              <>
                <p className="min-w-0 flex-1 truncate pl-1 text-sm text-gray-400" aria-hidden="true">
                  <span className="tabular-nums text-gray-200">{resultCount}</span>
                  {/* The word goes on the narrowest phones, before the number is cut. */}
                  <span className="max-[23rem]:hidden">{resultCount === 1 ? ' show' : ' shows'}</span>
                </p>
                {/* The other layout, one tap away (F10). */}
                <button
                  type="button"
                  onClick={() => setLayout(otherLayout)}
                  aria-label={otherLayout === 'list' ? 'Show as a list' : 'Show as cards'}
                  title={otherLayout === 'list' ? 'List' : 'Grid'}
                  className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-200"
                >
                  {otherLayout === 'list' ? <List className="h-4 w-4" aria-hidden="true" /> : <LayoutGrid className="h-4 w-4" aria-hidden="true" />}
                </button>
                {/* The sort: the phone's own picker, as wide as the choice on
                    show. A select is as wide as its longest option, so the real
                    one lies invisible over a label of the current choice. */}
                <label className="relative flex h-11 shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/5 pl-3.5 pr-2.5 text-sm text-white has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-white/70">
                  <span aria-hidden="true">{SORTS.find(s => s.key === state.sort)?.short}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                  <select
                    value={state.sort}
                    onChange={e => setSort(e.target.value as SortKey)}
                    aria-label="Sort"
                    className="absolute inset-0 cursor-pointer opacity-0"
                  >
                    {SORTS.map(s => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </label>
              </>
            ) : newCount > 0 && (
              <button
                type="button"
                onClick={() => toggleFacet('added', 'new')}
                aria-label={`New: ${newCount} shows added in the last ${BADGE_DAYS} days`}
                className="flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-gray-200"
              >
                <span className="h-[7px] w-[7px] rounded-full bg-emerald-300" aria-hidden="true" />
                New · <span className="tabular-nums">{newCount}</span>
              </button>
            )}
          </div>
        </div>
        <FilterSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          counts={counts}
          histogram={histogram}
          resultCount={resultCount}
          activeCount={active.length}
        />

        {active.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pb-3 max-md:hidden">
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
        {/* From md: the results row. (On a phone the row above folds while
            scrolling down, in one frame, not animated: the row's height and
            the margin standing in for it must change together, or the
            browser's scroll anchoring nudges the page and the nudge reads as
            scrolling back up; tried, 2026-10-17.) */}
        <div className={cn('max-md:hidden', !filtered && 'hidden')}>
        <div className={cn('items-center justify-between gap-4 pb-3', filtered ? 'flex' : 'hidden')}>
          <p className="whitespace-nowrap text-sm text-gray-400" aria-hidden="true">
            <span className="tabular-nums text-gray-200">{resultCount}</span>
            {resultCount === 1 ? ' show' : ' shows'}
          </p>

          <div className="flex min-w-0 items-center gap-2">
          {/* Grid or list (F10), then the list as a spreadsheet. */}
          <div role="group" aria-label="Layout" className="flex shrink-0 rounded-lg border border-white/10 bg-white/5 p-0.5">
            {([['grid', 'Grid', LayoutGrid], ['list', 'List', List]] as const).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => setLayout(value)}
                aria-pressed={state.layout === value}
                title={label}
                className={cn(
                  'flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/70',
                  state.layout === value ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only lg:not-sr-only">{label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onDownloadCsv}
            disabled={resultCount === 0}
            title={`Download these ${resultCount} shows as a spreadsheet (CSV)`}
            // From md: a spreadsheet is a desk task, and a phone's row has no room.
            className="hidden h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 text-sm text-gray-300 md:flex transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            CSV
          </button>

          <label className="flex min-w-0 shrink items-center gap-2 text-sm text-gray-400">
            <span className="sr-only xl:not-sr-only">Sort</span>
            <select
              value={state.sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className={cn(
                // Capped on a phone, where the count and layout share the row.
                'min-w-0 max-w-[12rem] cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white md:max-w-none',
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
      </div>
    </div>
  );
}

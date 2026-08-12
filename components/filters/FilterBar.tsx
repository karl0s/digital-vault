import { X } from 'lucide-react';
import { cn } from '../../src/lib/cn';
import { FacetKey, SortKey } from '../../src/lib/url';
import { FacetCounts } from '../../src/search/facets';
import { useFilterStore } from '../../src/store/filters';
import { FacetPopover } from './FacetPopover';

/**
 * Sticky refinement bar for the browse view.
 *
 * Three stacked pieces, two of them conditional:
 *   1. facet triggers        — always
 *   2. active filter chips   — only while something is selected
 *   3. result count + sort   — always
 *
 * Browse only. The A–Z directory is a different kind of surface and refining it
 * by era would mean explaining what an artist's era is.
 */

const FACETS: { key: FacetKey; label: string }[] = [
  { key: 'era', label: 'Era' },
  { key: 'year', label: 'Year' },
  { key: 'country', label: 'Country' },
  { key: 'festival', label: 'Festival' },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'year-desc', label: 'Year — newest first' },
  { key: 'year-asc', label: 'Year — oldest first' },
  { key: 'artist', label: 'Artist A–Z' },
];

interface FilterBarProps {
  counts: FacetCounts;
  resultCount: number;
}

export function FilterBar({ counts, resultCount }: FilterBarProps) {
  const state = useFilterStore();
  const { toggleFacet, clearFacet, clearAll, setSort } = state;

  const active = FACETS.flatMap(({ key }) =>
    counts[key]
      .filter(o => o.selected)
      .map(o => ({ facet: key, value: o.value, label: o.label })),
  );

  return (
    // top-16 clears the fixed header. z-30 sits under the header (z-40) and the
    // drawer (z-50) but above the grid.
    <div className="sticky top-16 z-30 border-b border-white/6 bg-[#141414]/97 backdrop-blur-md">
      <div className="mx-auto max-w-[1924px] px-4 md:px-8">
        <div className="flex gap-2 overflow-x-auto py-3 scrollbar-hide">
          {FACETS.map(({ key, label }) => (
            <FacetPopover
              key={key}
              label={label}
              options={counts[key]}
              selectedCount={state[key].length}
              onToggle={value => toggleFacet(key, value)}
              onClear={() => clearFacet(key)}
            />
          ))}
        </div>

        {active.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pb-3">
            {active.map(chip => (
              <button
                key={`${chip.facet}:${chip.value}`}
                onClick={() => toggleFacet(chip.facet, chip.value)}
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

        <div className="flex items-center justify-between gap-4 pb-3">
          {/* aria-live so the count is announced when filters change — otherwise
              a screen-reader user gets no feedback that anything happened. */}
          <p className="text-sm text-gray-400" aria-live="polite">
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

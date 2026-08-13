import { Popover } from '@base-ui/react/popover';
import { Check, ChevronDown, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '../../src/lib/cn';
import { FacetOption } from '../../src/search/facets';

/**
 * One facet: a trigger, and a popover of multi-select options with live counts.
 *
 * base-ui owns focus trapping, outside-click dismissal, Escape, and positioning.
 * Hand-rolling that is how you end up with the focus bugs the drawer had.
 */

interface FacetPopoverProps {
  label: string;
  options: FacetOption[];
  selectedCount: number;
  onToggle: (value: string) => void;
  onClear: () => void;
  /** Show the in-popover text filter above this many options. */
  searchThreshold?: number;
}

export function FacetPopover({
  label,
  options,
  selectedCount,
  onToggle,
  onClear,
  searchThreshold = 15,
}: FacetPopoverProps) {
  const [needle, setNeedle] = useState('');

  const showSearch = options.length > searchThreshold;

  const visible = useMemo(() => {
    const n = needle.trim().toLowerCase();
    if (!n) return options;
    // Selected options always stay visible, or filtering the list would appear
    // to silently discard choices the user has already made.
    return options.filter(o => o.selected || o.label.toLowerCase().includes(n));
  }, [options, needle]);

  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(
          'flex cursor-pointer shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors duration-150',
          selectedCount > 0
            ? 'border-white/20 bg-white/10 text-white'
            : 'border-white/8 bg-white/5 text-gray-400 hover:border-white/20 hover:bg-white/10 hover:text-white',
        )}
      >
        {label}
        {selectedCount > 0 && (
          <span className="tabular-nums text-xs text-gray-300">{selectedCount}</span>
        )}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </Popover.Trigger>

      <Popover.Portal>
        {/* z-50 must live on the Positioner: that is the element base-ui
              positions, and the portal otherwise sits at z-auto and loses to the
              sticky filter bar's z-30. */}
          <Popover.Positioner sideOffset={8} align="start" className="z-50">
          <Popover.Popup
            className={cn(
              'max-h-[min(26rem,60dvh)] w-[17rem] overflow-hidden rounded-xl border border-white/10',
              'bg-[#1f1f1f] shadow-2xl shadow-black/60 outline-none',
              // Scale from the trigger, never from scale(0) — see docs/browse-redesign-spec.md.
              'origin-[var(--transform-origin)] transition-[opacity,transform] duration-150 ease-out',
              'data-[starting-style]:scale-[0.96] data-[starting-style]:opacity-0',
              'data-[ending-style]:scale-[0.96] data-[ending-style]:opacity-0',
            )}
          >
            {showSearch && (
              <div className="relative border-b border-white/8 p-2">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
                  aria-hidden="true"
                />
                <input
                  value={needle}
                  onChange={e => setNeedle(e.target.value)}
                  placeholder={`Filter ${label.toLowerCase()}…`}
                  aria-label={`Filter ${label} options`}
                  className="w-full rounded-md bg-white/5 py-1.5 pl-8 pr-2 text-sm text-white placeholder-gray-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                />
              </div>
            )}

            <div className="max-h-80 overflow-y-auto p-1.5">
              {visible.length === 0 && (
                <p className="px-2 py-6 text-center text-sm text-gray-400">No matches</p>
              )}

              {visible.map(option => {
                // Disabled, not hidden: options vanishing under the cursor is
                // disorienting, and hiding them conceals the collection's shape.
                const unavailable = option.count === 0 && !option.selected;
                return (
                  <button
                    key={option.value}
                    onClick={() => onToggle(option.value)}
                    disabled={unavailable}
                    aria-pressed={option.selected}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150',
                      unavailable
                        ? 'cursor-not-allowed text-gray-600'
                        : 'cursor-pointer text-gray-200 hover:bg-white/10',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                        option.selected ? 'border-white bg-white' : 'border-white/25',
                      )}
                      aria-hidden="true"
                    >
                      {option.selected && <Check className="h-3 w-3 text-black" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    <span className="shrink-0 tabular-nums text-xs text-gray-400">
                      {option.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedCount > 0 && (
              <div className="border-t border-white/8 p-1.5">
                <button
                  onClick={onClear}
                  className="w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-sm text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                >
                  Clear {label.toLowerCase()}
                </button>
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

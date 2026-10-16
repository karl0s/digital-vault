import { Popover } from '@base-ui/react/popover';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../src/lib/cn';
import { SPEC_FACETS, SPEC_FACET_KEYS, SpecFacet, SpecFacetKey } from '../../src/lib/specFilters';
import { FacetCounts, FacetOption } from '../../src/search/facets';
import { useFilterStore } from '../../src/store/filters';
import { FacetOptionButton } from './FacetPopover';

/**
 * "More filters" (docs/ux-research F12, agreed 2026-10-16): quality, PAL or
 * NTSC, length and setlist in one popover beside Event, so the bar keeps three
 * controls. Each group is a facet like Country — OR within a group, AND across
 * — with the same live counts and the same option rows. Options come in the
 * order src/lib/specFilters.ts gives, never by count: these are scales.
 */
export function MoreFiltersPopover({ counts }: { counts: FacetCounts }) {
  const toggleFacet = useFilterStore(s => s.toggleFacet);
  const clearFacet = useFilterStore(s => s.clearFacet);
  const selectedCount = useFilterStore(s => SPEC_FACET_KEYS.reduce((n, key) => n + s[key].length, 0));

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
        More filters
        {selectedCount > 0 && <span className="tabular-nums text-xs text-gray-300">{selectedCount}</span>}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </Popover.Trigger>

      <Popover.Portal>
        {/* z-50 on the Positioner, as in FacetPopover. */}
        <Popover.Positioner sideOffset={8} align="start" collisionPadding={16} className="z-50">
          <Popover.Popup
            className={cn(
              'flex max-h-[min(36rem,70dvh)] w-[min(34rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-white/10',
              'bg-[#1f1f1f] shadow-2xl shadow-black/60 outline-none',
              'origin-[var(--transform-origin)] transition-[opacity,transform] duration-150 ease-out',
              'data-[starting-style]:scale-[0.96] data-[starting-style]:opacity-0',
              'data-[ending-style]:scale-[0.96] data-[ending-style]:opacity-0',
            )}
          >
            <div className="grid gap-x-3 gap-y-4 overflow-y-auto p-3 md:grid-cols-2">
              {SPEC_FACET_KEYS.map(key => (
                <Group key={key} facet={key} options={counts[key]} onToggle={value => toggleFacet(key, value)} />
              ))}
            </div>

            {selectedCount > 0 && (
              <div className="border-t border-white/8 p-1.5">
                <button
                  onClick={() => SPEC_FACET_KEYS.forEach(key => clearFacet(key))}
                  className="w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-sm text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                >
                  Clear more filters
                </button>
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Group({ facet, options, onToggle }: {
  facet: SpecFacetKey;
  options: FacetOption[];
  onToggle: (value: string) => void;
}) {
  const { label, hint, options: defined }: SpecFacet = SPEC_FACETS[facet];
  const byValue = new Map(options.map(o => [o.value, o]));
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 px-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
        {label}
        {hint && <span className="ml-2 font-normal normal-case tracking-normal text-white/50">{hint}</span>}
      </legend>
      {defined.map(o => {
        const option = byValue.get(o.value) ?? { value: o.value, label: o.label, count: 0, total: 0, selected: false };
        return <FacetOptionButton key={o.value} option={option} label={o.label} onToggle={onToggle} />;
      })}
    </fieldset>
  );
}

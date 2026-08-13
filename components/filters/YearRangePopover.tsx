import { Popover } from '@base-ui/react/popover';
import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../../src/lib/cn';
import { YearHistogram as YearHistogramData } from '../../src/search/facets';
import { useFilterStore } from '../../src/store/filters';
import { YearHistogram } from './YearHistogram';

/**
 * The Years control: decade presets, a brushable histogram, and From/To inputs.
 *
 * Replaces what were two near-identical dropdowns (Era and Year) — the same
 * axis at two zoom levels. Three layers on purpose:
 *
 *   chips      the 90% case, one tap, and how people actually think about music
 *   histogram  exploration — answers "where is this collection deep?"
 *   inputs     precision, keyboard, screen readers, and mobile
 *
 * The inputs are not a consolation prize. The brush is unusable without a
 * pointer, so they are the accessible path to the same state.
 */

interface YearRangePopoverProps {
  histogram: YearHistogramData;
}

function decadesWithin(minYear: number, maxYear: number): number[] {
  const first = Math.floor(minYear / 10) * 10;
  const out: number[] = [];
  for (let d = first; d <= maxYear; d += 10) out.push(d);
  return out;
}

export function YearRangePopover({ histogram }: YearRangePopoverProps) {
  const { bins, minYear, maxYear, peak, undatedCount } = histogram;

  const from = useFilterStore(s => s.from);
  const to = useFilterStore(s => s.to);
  const undated = useFilterStore(s => s.undated);
  const setYearRange = useFilterStore(s => s.setYearRange);
  const toggleUndated = useFilterStore(s => s.toggleUndated);

  /**
   * Draft is what the brush is currently showing. It exists so the count can
   * update every frame while the committed value — and therefore the URL —
   * only changes on release.
   */
  const [draft, setDraft] = useState<{ from: number; to: number } | null>(null);

  // Drop the draft whenever the committed range changes from elsewhere: a chip,
  // Clear all, or the back button. Without this a stale draft would keep
  // showing a range that is no longer applied.
  useEffect(() => { setDraft(null); }, [from, to]);

  const shownFrom = draft?.from ?? from;
  const shownTo = draft?.to ?? to;
  const hasRange = shownFrom !== null || shownTo !== null;

  const lo = shownFrom ?? minYear;
  const hi = shownTo ?? maxYear;

  // The live count is just the sum of the visible bars in range — the histogram
  // already excludes the year filter, so no second code path is needed.
  const inRange = bins.reduce((n, b) => (b.year >= lo && b.year <= hi ? n + b.count : n), 0);
  const total = inRange + (undated ? undatedCount : 0);

  const triggerLabel = hasRange
    ? lo === hi ? `Years · ${lo}` : `Years · ${lo}–${hi}`
    : 'Years';

  function applyDecade(start: number) {
    const end = Math.min(start + 9, maxYear);
    const clampedStart = Math.max(start, minYear);
    // Clicking an already-active decade clears it, so the chip is a toggle
    // rather than a one-way door.
    if (from === clampedStart && to === end) setYearRange(null, null);
    else setYearRange(clampedStart, end);
  }

  function commitInput(which: 'from' | 'to', raw: string) {
    const parsed = Number.parseInt(raw, 10);
    const value = Number.isFinite(parsed) ? Math.min(maxYear, Math.max(minYear, parsed)) : null;
    if (which === 'from') setYearRange(value, to ?? maxYear);
    else setYearRange(from ?? minYear, value);
  }

  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(
          'flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors duration-150',
          hasRange || undated
            ? 'border-white/20 bg-white/10 text-white'
            : 'border-white/8 bg-white/5 text-gray-400 hover:border-white/20 hover:bg-white/10 hover:text-white',
        )}
      >
        <span className="tabular-nums">{triggerLabel}</span>
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="start">
          <Popover.Popup
            className={cn(
              'z-50 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-white/10 bg-[#1f1f1f] p-3',
              'shadow-2xl shadow-black/60 outline-none',
              'origin-[var(--transform-origin)] transition-[opacity,transform] duration-150 ease-out',
              'data-[starting-style]:scale-[0.96] data-[starting-style]:opacity-0',
              'data-[ending-style]:scale-[0.96] data-[ending-style]:opacity-0',
            )}
          >
            <div className="mb-3 flex flex-wrap gap-1.5">
              {decadesWithin(minYear, maxYear).map(d => {
                const active = from === Math.max(d, minYear) && to === Math.min(d + 9, maxYear);
                return (
                  <button
                    key={d}
                    onClick={() => applyDecade(d)}
                    aria-pressed={active}
                    className={cn(
                      'cursor-pointer rounded-full border px-2.5 py-1 text-xs tabular-nums transition-colors duration-150',
                      active
                        ? 'border-white/25 bg-white text-black'
                        : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white',
                    )}
                  >
                    {d}s
                  </button>
                );
              })}
            </div>

            {/* Interactive on pointer devices only. At ~6px per year a phone
                drag cannot land accurately, so there it reads as a chart and
                the inputs below do the work. */}
            <div className="pointer-events-none md:pointer-events-auto">
              <YearHistogram
                bins={bins}
                minYear={minYear}
                maxYear={maxYear}
                peak={peak}
                from={shownFrom}
                to={shownTo}
                onDrag={(f, t) => setDraft({ from: f, to: t })}
                onCommit={(f, t) => { setDraft(null); setYearRange(f, t); }}
              />
            </div>

            <div className="mt-3 flex items-center gap-2">
              <label className="flex flex-1 items-center gap-1.5 text-xs text-gray-400">
                From
                <input
                  type="number"
                  inputMode="numeric"
                  min={minYear}
                  max={maxYear}
                  value={shownFrom ?? ''}
                  placeholder={String(minYear)}
                  onChange={e => commitInput('from', e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm tabular-nums text-white placeholder-gray-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                />
              </label>
              <label className="flex flex-1 items-center gap-1.5 text-xs text-gray-400">
                To
                <input
                  type="number"
                  inputMode="numeric"
                  min={minYear}
                  max={maxYear}
                  value={shownTo ?? ''}
                  placeholder={String(maxYear)}
                  onChange={e => commitInput('to', e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm tabular-nums text-white placeholder-gray-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                />
              </label>
            </div>

            <button
              onClick={toggleUndated}
              aria-pressed={undated}
              className="mt-3 flex w-full cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 text-left text-sm text-gray-200 transition-colors hover:bg-white/10"
            >
              <span
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                  undated ? 'border-white bg-white' : 'border-white/25',
                )}
                aria-hidden="true"
              >
                {undated && <Check className="h-3 w-3 text-black" strokeWidth={3} />}
              </span>
              <span className="flex-1">Include undated</span>
              <span className="tabular-nums text-xs text-gray-400">{undatedCount}</span>
            </button>

            <div className="mt-3 flex items-center justify-between border-t border-white/8 pt-2.5">
              <p className="text-sm text-gray-400">
                <span className="tabular-nums text-gray-200">{total}</span>
                {total === 1 ? ' show' : ' shows'}
              </p>
              {(hasRange || undated) && (
                <button
                  onClick={() => { setDraft(null); setYearRange(null, null); if (undated) toggleUndated(); }}
                  className="cursor-pointer text-sm text-gray-400 underline underline-offset-2 transition-colors hover:text-white"
                >
                  Reset
                </button>
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

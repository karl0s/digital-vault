import { Dialog } from '@base-ui/react/dialog';
import { Plus, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../src/lib/cn';
import { SPEC_FACETS, SPEC_FACET_KEYS, SpecFacetKey } from '../../src/lib/specFilters';
import { FacetCounts, FacetOption, YearHistogram, listedOptions } from '../../src/search/facets';
import { useFilterStore } from '../../src/store/filters';
import { CloseButton } from '../CloseButton';
import { decadesWithin } from './YearRangePopover';

/**
 * Phones: every filter in one sheet from the bottom of the screen
 * (docs/ux-research/06-mobile-audit.md, R8). The popovers ran off the bottom
 * of a phone's screen — More filters by 64–114px, so "New" could not be
 * reached — and their 32px rows were small for a thumb. Here every choice is a
 * 44px chip with its live count, the same facets and counts as the popovers
 * (an option that would find nothing is dimmed, never hidden), and "Show N
 * shows" stays at the foot. Choices apply as they are made, as in the
 * popovers; the button only closes the sheet. Desktop keeps the popovers.
 *
 * base-ui's Dialog owns the modal part: focus moves in and is trapped, Escape
 * and a tap outside close it, the page behind doesn't scroll. A drag down on
 * the header closes it too, as a phone's own sheets do.
 */

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  counts: FacetCounts;
  histogram: YearHistogram;
  resultCount: number;
  /** How many filters are set: Clear all shows while there are any. */
  activeCount: number;
}

export function FilterSheet({ open, onOpenChange, counts, histogram, resultCount, activeCount }: FilterSheetProps) {
  const toggleFacet = useFilterStore(s => s.toggleFacet);
  const clearFilters = useFilterStore(s => s.clearFilters);
  const popupRef = useRef<HTMLDivElement>(null);
  const dragFrom = useRef<number | null>(null);

  // Drag the header down to close. The sheet follows the finger (an inline
  // transform, beside the `translate` the open and close transitions use) and
  // closes past 96px; short of that it springs back.
  const drag = {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if ((e.target as HTMLElement).closest('button')) return;
      dragFrom.current = e.clientY;
      e.currentTarget.setPointerCapture(e.pointerId);
      if (popupRef.current) popupRef.current.style.transitionDuration = '0s';
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (dragFrom.current === null || !popupRef.current) return;
      popupRef.current.style.transform = `translateY(${Math.max(0, e.clientY - dragFrom.current)}px)`;
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      if (dragFrom.current === null) return;
      const dy = e.clientY - dragFrom.current;
      dragFrom.current = null;
      const el = popupRef.current;
      if (el) { el.style.transitionDuration = ''; el.style.transform = ''; }
      if (dy > 96) onOpenChange(false);
    },
  };

  return (
    <Dialog.Root open={open} onOpenChange={next => onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className="fixed inset-0 z-50 bg-black/60 transition-opacity duration-300 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 md:hidden"
        />
        <Dialog.Popup
          ref={popupRef}
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex h-[86dvh] flex-col rounded-t-2xl bg-[#1c1c1c] shadow-[0_-10px_40px_rgb(0_0_0/0.6)] outline-none md:hidden',
            'transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full',
          )}
        >
          {/* Header: the grabber, the title, Clear all and ×. Dragging it closes the sheet. */}
          <div className="shrink-0 touch-none border-b border-white/7" {...drag}>
            <div className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-white/25" aria-hidden="true" />
            <div className="flex items-center gap-2 py-1.5 pl-4 pr-2">
              <Dialog.Title className="flex-1 text-[1.0625rem] font-semibold text-white">Filters</Dialog.Title>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="h-11 cursor-pointer px-2 text-[0.9375rem] text-gray-300 underline underline-offset-[3px]"
                >
                  Clear all
                </button>
              )}
              <CloseButton onClick={() => onOpenChange(false)} aria-label="Close filters" />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
            <YearsSection histogram={histogram} />
            <FacetSection
              title="Event"
              noun="an event"
              options={counts.festival}
              minTotal={6}
              onToggle={value => toggleFacet('festival', value)}
            />
            <FacetSection
              title="Country"
              noun="a country"
              options={counts.country}
              minTotal={6}
              onToggle={value => toggleFacet('country', value)}
            />
            {SPEC_FACET_KEYS.map(key => (
              <SpecSection key={key} facet={key} options={counts[key]} onToggle={value => toggleFacet(key, value)} />
            ))}
          </div>

          <div className="shrink-0 border-t border-white/7 px-4 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex h-[50px] w-full cursor-pointer items-center justify-center rounded-xl bg-white text-base font-semibold text-[#111] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
            >
              {resultCount === 0
                ? 'No shows match — remove a filter'
                : `Show ${resultCount.toLocaleString('en')} ${resultCount === 1 ? 'show' : 'shows'}`}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const HEADING = 'mt-5 mb-2.5 flex items-baseline gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400';
const HINT = 'font-normal normal-case tracking-normal text-white/50';

/** One choice: 44px, its count beside it; white when chosen, dimmed when it would find nothing. */
function Chip({ label, count, selected, onClick, removable = false }: {
  label: string;
  count?: number;
  selected: boolean;
  onClick: () => void;
  removable?: boolean;
}) {
  const unavailable = count === 0 && !selected;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={unavailable}
      aria-pressed={removable ? undefined : selected}
      aria-label={removable ? `Remove filter ${label}` : undefined}
      className={cn(
        'inline-flex h-11 max-w-full items-center gap-2 rounded-full border px-3.5 text-[0.9375rem] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70',
        selected ? 'border-white bg-white text-[#111]' : 'border-white/12 bg-white/5 text-gray-200',
        unavailable ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
      )}
    >
      <span className="truncate">{label}</span>
      {count !== undefined && !removable && (
        <span className={cn('shrink-0 text-[0.8125rem] tabular-nums', selected ? 'text-[#444]' : 'text-gray-400')}>{count}</span>
      )}
      {removable && <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
    </button>
  );
}

/** Decades, a From–To pair typed in, and Include undated: the Years popover's choices. */
function YearsSection({ histogram }: { histogram: YearHistogram }) {
  const { bins, minYear, maxYear, undatedCount } = histogram;
  const from = useFilterStore(s => s.from);
  const to = useFilterStore(s => s.to);
  const undated = useFilterStore(s => s.undated);
  const setYearRange = useFilterStore(s => s.setYearRange);
  const toggleUndated = useFilterStore(s => s.toggleUndated);

  // Typed years apply when the field is left or Enter is pressed, not per
  // digit: "1" on its way to "1995" is not a year.
  const [draft, setDraft] = useState({ from: '', to: '' });
  useEffect(() => { setDraft({ from: from === null ? '' : String(from), to: to === null ? '' : String(to) }); }, [from, to]);
  const commit = () => {
    const year = (raw: string) => {
      const n = Number.parseInt(raw, 10);
      return Number.isFinite(n) ? Math.min(maxYear, Math.max(minYear, n)) : null;
    };
    const f = year(draft.from), t = year(draft.to);
    if (f !== from || t !== to) setYearRange(f, t);
  };

  const decades = decadesWithin(bins, minYear, maxYear);
  const decadeCount = (d: number) => bins.reduce((n, b) => (b.year >= d && b.year <= d + 9 ? n + b.count : n), 0);

  return (
    <section aria-labelledby="sheet-years">
      <h3 id="sheet-years" className={HEADING}>Years</h3>
      <div className="flex flex-wrap gap-2">
        {decades.map(d => {
          const lo = Math.max(d, minYear), hi = Math.min(d + 9, maxYear);
          const active = from === lo && to === hi;
          return (
            <Chip
              key={d}
              label={`${d}s`}
              count={decadeCount(d)}
              selected={active}
              onClick={() => (active ? setYearRange(null, null) : setYearRange(lo, hi))}
            />
          );
        })}
      </div>
      <div className="mt-2.5 flex gap-2.5">
        {(['from', 'to'] as const).map(end => (
          <label key={end} className="flex h-11 flex-1 items-center gap-2 rounded-[10px] border border-white/14 px-3 focus-within:border-white/40">
            <span className="text-[0.8125rem] text-gray-400">{end === 'from' ? 'From' : 'To'}</span>
            {/* 16px, or iOS zooms the page on focus. */}
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              enterKeyHint="done"
              value={draft[end]}
              placeholder={String(end === 'from' ? minYear : maxYear)}
              onChange={e => setDraft(d => ({ ...d, [end]: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
              onBlur={commit}
              onKeyDown={e => { if (e.key === 'Enter') { commit(); e.currentTarget.blur(); } }}
              className="w-full min-w-0 bg-transparent text-base tabular-nums text-white placeholder-gray-500 outline-none"
            />
          </label>
        ))}
      </div>
      <div className="mt-2.5">
        <Chip label="Include undated" count={undatedCount} selected={undated} onClick={toggleUndated} />
      </div>
    </section>
  );
}

/**
 * Event and Country: long lists, so what is chosen shows as chips, and the
 * rest open behind "Add …" with a field to narrow them. The same options as the
 * popovers: values with 6+ shows, by count; search finds the rest by name.
 */
function FacetSection({ title, noun, options, minTotal, onToggle }: {
  title: string;
  noun: string;
  options: FacetOption[];
  minTotal: number;
  onToggle: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [needle, setNeedle] = useState('');
  const listed = useMemo(() => listedOptions(options, minTotal), [options, minTotal]);
  const chosen = listed.filter(o => o.selected);
  const visible = useMemo(() => {
    const n = needle.trim().toLowerCase();
    return n ? listed.filter(o => o.selected || o.label.toLowerCase().includes(n)) : listed;
  }, [listed, needle]);
  const id = `sheet-${title.toLowerCase()}`;

  return (
    <section aria-labelledby={id}>
      <h3 id={id} className={HEADING}>
        {title}
        {chosen.length > 0 && <span className={HINT}>{chosen.length} chosen</span>}
      </h3>
      {!expanded ? (
        <>
          {chosen.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {chosen.map(o => <Chip key={o.value} label={o.label} selected removable onClick={() => onToggle(o.value)} />)}
            </div>
          )}
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-expanded={false}
            className="flex h-11 w-full cursor-pointer items-center gap-2 rounded-[10px] border border-dashed border-white/20 px-3 text-left text-[0.9375rem] text-gray-400"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {chosen.length ? `Add another` : `Add ${noun}`}…
          </button>
        </>
      ) : (
        <>
          <div className="relative mb-2.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              value={needle}
              onChange={e => setNeedle(e.target.value)}
              placeholder={`Filter ${title.toLowerCase()}…`}
              aria-label={`Filter ${title} options`}
              enterKeyHint="done"
              className="h-11 w-full rounded-[10px] border border-white/14 bg-white/5 pl-9 pr-3 text-base text-white placeholder-gray-500 outline-none focus:border-white/40"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {visible.length === 0 && <p className="py-2 text-sm text-gray-400">No matches</p>}
            {visible.map(o => (
              <Chip key={o.value} label={o.label} count={o.count} selected={o.selected} onClick={() => onToggle(o.value)} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** Source, Quality, Standard, Length, Setlist, Added: closed lists, in their own order. */
function SpecSection({ facet, options, onToggle }: {
  facet: SpecFacetKey;
  options: FacetOption[];
  onToggle: (value: string) => void;
}) {
  const { label, hint, options: defined } = SPEC_FACETS[facet] as { label: string; hint?: string; options: { value: string; label: string }[] };
  const byValue = new Map(options.map(o => [o.value, o]));
  const id = `sheet-${facet}`;
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className={HEADING}>
        {label}
        {hint && <span className={HINT}>{hint}</span>}
      </h3>
      <div className="flex flex-wrap gap-2">
        {defined.map(o => {
          const option = byValue.get(o.value);
          return (
            <Chip
              key={o.value}
              label={o.label}
              count={option?.count ?? 0}
              selected={option?.selected ?? false}
              onClick={() => onToggle(o.value)}
            />
          );
        })}
      </div>
    </section>
  );
}

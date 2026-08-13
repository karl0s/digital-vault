import { useRef, useState } from 'react';
import {
  Handle,
  Track,
  dragHandle,
  dragNew,
  nearestHandle,
  rangeToSpan,
  xToYear,
} from '../../src/lib/brush';
import { YearBin } from '../../src/search/facets';

/**
 * Shows-per-year, with a draggable range over it.
 *
 * Rendered in viewBox units — exactly one unit per year — so bar and selection
 * geometry is integer-exact at any rendered size and never needs measuring.
 * Only pointer events need real pixels, and those measure the element directly.
 *
 * Three gestures: click a bar for one year, drag the track for a range, drag an
 * edge to adjust. Dragging past the opposite edge swaps roles rather than
 * sticking (see src/lib/brush.ts, which is where the maths is tested).
 *
 * Not an ARIA slider. It is a picture of the distribution — the From/To inputs
 * beside it are the real control for keyboard and screen readers. A fake slider
 * role here would be worse than none.
 */

const VIEW_H = 100;

interface YearHistogramProps {
  bins: YearBin[];
  minYear: number;
  maxYear: number;
  peak: number;
  /** Draft range — may be null on either end, meaning unbounded. */
  from: number | null;
  to: number | null;
  /** Fires continuously during a drag, for the live count. */
  onDrag: (from: number, to: number) => void;
  /** Fires once on release — the only thing that reaches the store. */
  onCommit: (from: number, to: number) => void;
}

type DragMode =
  | { kind: 'handle'; handle: Handle }
  | { kind: 'new'; anchorX: number }
  | null;

export function YearHistogram({
  bins, minYear, maxYear, peak, from, to, onDrag, onCommit,
}: YearHistogramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const modeRef = useRef<DragMode>(null);
  const liveRef = useRef<{ from: number; to: number } | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const n = Math.max(1, bins.length);
  // In viewBox space one unit is one year, so trackWidth === column count.
  const viewTrack: Track = { trackWidth: n, minYear, maxYear };

  const selFrom = from ?? minYear;
  const selTo = to ?? maxYear;
  const hasRange = from !== null || to !== null;
  const sel = rangeToSpan(selFrom, selTo, viewTrack);

  /** Pointer x in element pixels, plus a track measured in the same units. */
  function measure(e: React.PointerEvent): { x: number; track: Track } | null {
    const el = svgRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      track: { trackWidth: rect.width, minYear, maxYear },
    };
  }

  function handlePointerDown(e: React.PointerEvent) {
    const m = measure(e);
    if (!m) return;
    // Capture so the drag survives the pointer leaving the element — without
    // it, sliding off the edge silently drops the gesture.
    svgRef.current?.setPointerCapture(e.pointerId);

    const grabbed = hasRange ? nearestHandle(m.x, selFrom, selTo, m.track) : null;

    if (grabbed) {
      modeRef.current = { kind: 'handle', handle: grabbed };
      liveRef.current = { from: selFrom, to: selTo };
    } else {
      const year = xToYear(m.x, m.track);
      modeRef.current = { kind: 'new', anchorX: m.x };
      liveRef.current = { from: year, to: year };
      onDrag(year, year);
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    const m = measure(e);
    if (!m) return;

    const mode = modeRef.current;
    if (!mode) {
      setHovered(xToYear(m.x, m.track));
      return;
    }

    const live = liveRef.current ?? { from: selFrom, to: selTo };

    if (mode.kind === 'handle') {
      const next = dragHandle(mode.handle, m.x, live.from, live.to, m.track);
      // The handle can change identity mid-drag when it crosses its opposite;
      // keep tracking whichever edge is now under the pointer.
      modeRef.current = { kind: 'handle', handle: next.handle };
      liveRef.current = { from: next.from, to: next.to };
      onDrag(next.from, next.to);
    } else {
      const next = dragNew(mode.anchorX, m.x, m.track);
      liveRef.current = next;
      onDrag(next.from, next.to);
    }
  }

  function endDrag(e: React.PointerEvent) {
    if (!modeRef.current) return;
    svgRef.current?.releasePointerCapture(e.pointerId);
    modeRef.current = null;
    const live = liveRef.current;
    if (live) onCommit(live.from, live.to);
  }

  const label =
    `Shows per year, ${minYear} to ${maxYear}. ` +
    (hasRange ? `Showing ${selFrom} to ${selTo}.` : 'No range selected.');

  return (
    <div className="relative select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${n} ${VIEW_H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
        // touch-action:none stops a horizontal drag from scrolling the page.
        className="h-24 w-full cursor-crosshair touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => { if (!modeRef.current) setHovered(null); }}
      >
        {hasRange && (
          <rect x={sel.x} y={0} width={sel.width} height={VIEW_H} className="fill-white/8" />
        )}

        {bins.map((bin, i) => {
          const inRange = bin.year >= selFrom && bin.year <= selTo;
          // Empty years still draw a 1px sliver so the axis reads as continuous
          // and a gap looks deliberate rather than like a rendering fault.
          const h = bin.count === 0 ? 1.5 : Math.max(2, (bin.count / peak) * VIEW_H);
          return (
            <rect
              key={bin.year}
              x={i + 0.1}
              y={VIEW_H - h}
              width={0.8}
              height={h}
              className={
                bin.count === 0
                  ? 'fill-white/10'
                  : inRange
                    ? 'fill-white/70'
                    : 'fill-white/20'
              }
            />
          );
        })}

        {hasRange && (
          <>
            <rect x={sel.x} y={0} width={0.12} height={VIEW_H} className="fill-white" />
            <rect x={sel.x + sel.width - 0.12} y={0} width={0.12} height={VIEW_H} className="fill-white" />
          </>
        )}
      </svg>

      {/* Hover readout, positioned as a percentage so it tracks the viewBox. */}
      {hovered !== null && !modeRef.current && (
        <div
          className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-[#0d0d0d] px-1.5 py-0.5 text-[11px] tabular-nums text-white shadow-lg"
          style={{ left: `${((hovered - minYear + 0.5) / n) * 100}%` }}
        >
          {hovered} · {bins.find(b => b.year === hovered)?.count ?? 0}
        </div>
      )}

      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-gray-400">
        <span>{minYear}</span>
        <span>{maxYear}</span>
      </div>
    </div>
  );
}

/**
 * Pure geometry for the year-range brush.
 *
 * The pointer handling itself cannot be verified outside a browser, so
 * everything that can go subtly wrong — off-by-one at the edges, inverted
 * drags, clamping, handle hit-testing — is pulled out here where Node can
 * check it. What is left in the component is event plumbing.
 *
 * Model: `count` discrete year columns of equal width across `trackWidth`.
 * Column i spans [i*w, (i+1)*w), so year boundaries fall between columns and a
 * click anywhere inside a bar selects that bar.
 */

export interface Track {
  trackWidth: number;
  minYear: number;
  maxYear: number;
}

function columnCount({ minYear, maxYear }: Track): number {
  return Math.max(1, maxYear - minYear + 1);
}

export function clampYear(year: number, { minYear, maxYear }: Track): number {
  return Math.min(maxYear, Math.max(minYear, year));
}

/** Pointer x (relative to the track's left edge) -> the year under it. */
export function xToYear(x: number, track: Track): number {
  const n = columnCount(track);
  const w = track.trackWidth / n;
  if (w <= 0) return track.minYear;
  // floor, not round: the whole width of a bar belongs to that bar.
  const index = Math.floor(x / w);
  return clampYear(track.minYear + index, track);
}

/** Left edge of a year's column. */
export function yearToX(year: number, track: Track): number {
  const n = columnCount(track);
  const w = track.trackWidth / n;
  return (clampYear(year, track) - track.minYear) * w;
}

/** Full pixel span of a year's column, for drawing a bar or a selection edge. */
export function yearToSpan(year: number, track: Track): { x: number; width: number } {
  const n = columnCount(track);
  const w = track.trackWidth / n;
  return { x: yearToX(year, track), width: w };
}

/** Pixel span covering an inclusive year range — the selection overlay. */
export function rangeToSpan(
  from: number,
  to: number,
  track: Track,
): { x: number; width: number } {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const start = yearToX(lo, track);
  const end = yearToX(hi, track) + yearToSpan(hi, track).width;
  return { x: start, width: end - start };
}

export type Handle = 'from' | 'to';

/**
 * Which handle is under the pointer, if either.
 *
 * `threshold` is in pixels and should be generous — the handle renders as a
 * hairline but needs a finger-sized catch area. Ties go to the nearer edge, and
 * when both are equidistant (a one-year selection) `from` wins so the pair
 * cannot deadlock.
 */
export function nearestHandle(
  x: number,
  from: number,
  to: number,
  track: Track,
  threshold = 12,
): Handle | null {
  const fromX = yearToX(from, track);
  const toX = yearToX(to, track) + yearToSpan(to, track).width;

  const dFrom = Math.abs(x - fromX);
  const dTo = Math.abs(x - toX);

  if (dFrom > threshold && dTo > threshold) return null;
  return dFrom <= dTo ? 'from' : 'to';
}

/**
 * Apply a drag to an existing range.
 *
 * Dragging a handle past its opposite swaps roles rather than refusing to move,
 * which is what makes a drag feel continuous instead of hitting an invisible
 * wall. The returned `handle` is the one now under the pointer, so the caller
 * can keep tracking it.
 */
export function dragHandle(
  handle: Handle,
  x: number,
  from: number,
  to: number,
  track: Track,
): { from: number; to: number; handle: Handle } {
  const year = xToYear(x, track);

  if (handle === 'from') {
    return year > to
      ? { from: to, to: year, handle: 'to' }
      : { from: year, to, handle: 'from' };
  }
  return year < from
    ? { from: year, to: from, handle: 'from' }
    : { from, to: year, handle: 'to' };
}

/** A fresh drag across empty track: anchor where it started, follow the pointer. */
export function dragNew(
  anchorX: number,
  x: number,
  track: Track,
): { from: number; to: number } {
  const a = xToYear(anchorX, track);
  const b = xToYear(x, track);
  return { from: Math.min(a, b), to: Math.max(a, b) };
}

/** True when the range covers everything, i.e. it is equivalent to no filter. */
export function isFullSpan(
  from: number | null,
  to: number | null,
  track: Track,
): boolean {
  return (
    (from === null || from <= track.minYear) &&
    (to === null || to >= track.maxYear)
  );
}

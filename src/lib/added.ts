/**
 * What's new (docs/ux-research F11). `AddedOn` (YYYY-MM-DD) is set on every
 * record created from 2026-10-16, the owner's start date: the records before
 * it are the collection at launch and carry none (their IDs are in
 * scripts/collection-at-launch.json, and the health check blocks a new record
 * without a date). Git history can't stand in: most records first seen in
 * October 2026 were splits and re-filings, not new recordings.
 *
 * Whether an addition is a new show or an upgrade isn't stored: it is worked
 * out from the show's other copies (src/lib/copies.ts) — a better copy when
 * its picture beats every copy held before it.
 */

import type { Show } from '../../App';
import { copiesOf } from './copies';
import { quality } from './specs';

/** How long a show stays in the "Recently added" row. */
export const RECENT_DAYS = 60;
/** How long its card carries the badge. */
export const BADGE_DAYS = 30;

const DAY = 86_400_000;

/** Days since the record was added; null for the collection at launch. */
export function daysSinceAdded(show: Pick<Show, 'AddedOn'>, now = Date.now()): number | null {
  if (!show.AddedOn || !/^\d{4}-\d{2}-\d{2}$/.test(show.AddedOn)) return null;
  return Math.floor((now - Date.parse(`${show.AddedOn}T00:00:00Z`)) / DAY);
}

export const addedWithin = (show: Pick<Show, 'AddedOn'>, days: number, now = Date.now()): boolean => {
  const d = daysSinceAdded(show, now);
  return d !== null && d >= 0 && d < days;
};

export type AddedKind = 'new' | 'better-copy' | 'new-copy';

export const ADDED_LABEL: Record<AddedKind, string> = {
  new: 'New',
  'better-copy': 'Better copy',
  'new-copy': 'New copy',
};

/** HD over SD over low-res, then more lines: the order traders rank a picture. */
function pictureRank(show: Show): number {
  const q = quality(show);
  if (!q) return 0;
  return (q.tier === 'hd' ? 3 : q.tier === 'sd' ? 2 : 1) * 10_000 + (parseInt(show.Height, 10) || 0);
}

/**
 * A new show, or another copy of one already held — a better one when its
 * picture beats every copy that was here before it. Copies added the same day
 * or later don't count against it.
 */
export function addedKind(show: Show): AddedKind {
  const before = copiesOf(show).filter(c => c !== show && (!c.AddedOn || (show.AddedOn && c.AddedOn < show.AddedOn)));
  if (before.length === 0) return 'new';
  return pictureRank(show) > Math.max(...before.map(pictureRank)) ? 'better-copy' : 'new-copy';
}

/** Newest additions first; the collection at launch after them, newest show first. */
export function compareAdded(a: Show, b: Show): number {
  return (b.AddedOn || '').localeCompare(a.AddedOn || '');
}

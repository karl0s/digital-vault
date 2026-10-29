/**
 * What's new (docs/ux-research F11). `AddedOn` (YYYY-MM-DD) is set on every
 * record created from 2026-10-16, the owner's start date: the records before
 * it are the collection at launch and carry none (their IDs are in
 * scripts/collection-at-launch.json, and the health check blocks a new record
 * without a date). Git history can't stand in: most records first seen in
 * October 2026 were splits and re-filings, not new recordings.
 *
 * Whether an addition is a new show or another copy of one isn't stored: it is
 * worked out from the show's other copies (src/lib/copies.ts). No label judges
 * one copy against another — "Better copy" was removed (owner, 2026-10-29).
 */

import type { Show } from '../../App';
import { copiesOf } from './copies';

/** How long a show stays in the "Recently added" row (hidden for now: FeaturedRows.tsx). */
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

export type AddedKind = 'new' | 'new-copy';

export const ADDED_LABEL: Record<AddedKind, string> = {
  new: 'New',
  'new-copy': 'New copy',
};

/** A new show, or another copy of one already held. Copies added the same day or later don't count. */
export function addedKind(show: Show): AddedKind {
  const before = copiesOf(show).filter(c => c !== show && (!c.AddedOn || (show.AddedOn && c.AddedOn < show.AddedOn)));
  return before.length === 0 ? 'new' : 'new-copy';
}

/** Newest additions first; the collection at launch after them, newest show first. */
export function compareAdded(a: Show, b: Show): number {
  return (b.AddedOn || '').localeCompare(a.AddedOn || '');
}

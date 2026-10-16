/**
 * Every recording of the same show, for the cards' "N copies" and the drawer's
 * comparison (docs/ux-research, F2). One show is the same artist, date, event,
 * venue, city and country — CLAUDE.md's rule for duplicate recordings, which
 * keeps those identical across copies — and the same kind of programme: a
 * backstage documentary from the night is not a copy of the set. An excerpt
 * of a broadcast is a copy of the full set: a trader wants to know both exist.
 * An undated record has no copies: there is nothing to match it on.
 *
 * Built once per catalogue load (useShows), read by every card. Module state
 * rather than a prop so the memoised cards keep their props as they were.
 */
import type { Show } from '../../App';

let byShow = new Map<string, Show[]>();

const showKey = (s: Show) =>
  s.ShowDate
    ? [s.Artist, s.ShowDate, s.EventOrFestival, s.VenueName, s.City, s.Country, s.ContentType].map(v => v || '').join('\u0000')
    : '';

export function indexCopies(shows: Show[]): void {
  const next = new Map<string, Show[]>();
  for (const show of shows) {
    const key = showKey(show);
    if (!key) continue;
    const list = next.get(key);
    if (list) list.push(show);
    else next.set(key, [show]);
  }
  byShow = next;
}

/** The recordings of this show, this one included, longest first. */
export function copiesOf(show: Show): Show[] {
  const key = showKey(show);
  const list = key ? byShow.get(key) : undefined;
  if (!list || list.length < 2) return [show];
  return [...list].sort((a, b) => (parseInt(b.DurationSec, 10) || 0) - (parseInt(a.DurationSec, 10) || 0));
}

/** How many recordings of this show the collection holds (1 when it is the only one). */
export function copyCount(show: Show): number {
  const key = showKey(show);
  return (key && byShow.get(key)?.length) || 1;
}

/**
 * Store contract checks.
 *
 * Run: npm run check:store
 *
 * These exist because of a real bug: `selectFilterState` builds a fresh object
 * per call, zustand v5 reads selectors through useSyncExternalStore, and an
 * unstable snapshot makes React re-render until it throws "Maximum update depth
 * exceeded". Nothing in the type system or the build catches that — it only
 * appears at runtime in a browser.
 */

import { EMPTY_FILTERS } from '../src/lib/url';
import { selectFilterState, useFilterStore } from '../src/store/filters';

let failures = 0;
let checks = 0;

function ok(label: string, pass: boolean, detail = ''): void {
  checks++;
  if (pass) console.log(`  ok   ${label}`);
  else { failures++; console.log(`  FAIL ${label}${detail ? `\n         ${detail}` : ''}`); }
}

function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every(k => Object.is(a[k], b[k]));
}

const store = useFilterStore;

console.log('\nsnapshot stability (the infinite-loop guard)');
{
  const a = selectFilterState(store.getState());
  const b = selectFilterState(store.getState());

  ok(
    'selector output is shallow-equal across calls on unchanged state',
    shallowEqual(a as never, b as never),
    'useShallow cannot bail out of re-render — this is the infinite loop',
  );

  // Documents WHY useShallow is mandatory at the call site. If this ever starts
  // passing, the selector was memoised and the useShallow wrapper is redundant.
  ok(
    'selector output is NOT reference-equal (so useShallow is required)',
    a !== b,
    'selector now returns a stable reference; the useShallow note in App.tsx is stale',
  );
}

console.log('\nfacet arrays are replaced, never mutated');
{
  const before = store.getState().country;
  store.getState().toggleFacet('country', 'germany');
  const after = store.getState().country;
  ok('toggling produces a new array reference', before !== after);
  ok('the previous array is untouched', before.length === 0);
  ok('the new array holds the value', after.map(String).includes('germany'));
}

console.log('\nactions');
{
  store.getState().toggleFacet('country', 'japan');
  ok('multi-select accumulates', store.getState().country.length === 2);

  store.getState().toggleFacet('country', 'japan');
  ok('toggling the same value removes it', store.getState().country.map(String).join() === 'germany');

  store.getState().setQuery('nirvana');
  store.getState().setFacet('festival', ['rock-am-ring']);
  ok('setFacet replaces outright', store.getState().festival.join() === 'rock-am-ring');

  store.getState().setYearRange(2011, 1993);
  ok('setYearRange normalises a reversed range',
     store.getState().from === 1993 && store.getState().to === 2011);

  store.getState().setYearRange(null, null);
  ok('setYearRange(null, null) clears the range',
     store.getState().from === null && store.getState().to === null);

  store.getState().setYearRange(1990, 1999);
  store.getState().toggleUndated();
  ok('toggleUndated flips on', store.getState().undated === true);
  store.getState().toggleUndated();
  ok('toggleUndated flips off', store.getState().undated === false);

  store.getState().setYearRange(1990, 1999);
  store.getState().toggleUndated();
  store.getState().setSort('artist');
  store.getState().clearAll();
  const s = store.getState();
  ok('clearAll empties every facet', s.country.length === 0 && s.festival.length === 0);
  ok('clearAll clears the range', s.from === null && s.to === null);
  ok('clearAll clears undated', s.undated === false);
  ok('clearAll clears the query', s.q === '');
  ok('clearAll preserves sort (a view preference, not a filter)', s.sort === 'artist');

  store.getState().setView('artists');
  ok('setView changes destination', store.getState().view === 'artists');

  store.getState().setQuery('pearl jam');
  store.getState().setView('browse');
  ok('setView clears the query so a destination is a destination', store.getState().q === '');
}

console.log('\nhydration');
{
  store.getState().hydrateFromUrl('?view=artists&from=1993&to=2011&undated=1&country=germany&sort=year-asc');
  const s = store.getState();
  ok('hydrate restores view', s.view === 'artists');
  ok('hydrate restores the range', s.from === 1993 && s.to === 2011);
  ok('hydrate restores undated', s.undated === true);
  ok('hydrate restores facets', s.country.join() === 'germany');
  ok('hydrate restores sort', s.sort === 'year-asc');

  store.getState().hydrateFromUrl('');
  // Compared by value, not shallowly: parseFilters builds fresh arrays each
  // call, so two structurally identical states are never reference-equal.
  // Harmless here (hydration happens on popstate, not during render) but it is
  // why the snapshot check above needs useShallow rather than Object.is.
  ok('hydrating an empty URL resets to defaults',
    JSON.stringify(selectFilterState(store.getState())) === JSON.stringify(EMPTY_FILTERS));
}

console.log(`\n${checks - failures}/${checks} passed`);
if (failures > 0) { console.log(`${failures} FAILED\n`); process.exit(1); }
console.log('Store contract holds.\n');

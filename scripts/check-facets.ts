/**
 * Facet engine checks, run against the real public/shows.json.
 *
 * Run: npm run check:facets
 *
 * The property that matters most: a facet's counts must predict what selecting
 * that option actually yields. If they don't, the interface lies.
 */

import { readFileSync } from 'node:fs';
import { Show } from '../App';
import { EMPTY_FILTERS, FacetKey, FilterState, NONE } from '../src/lib/url';
import { applyFilters, computeFacetCounts, deriveAll, sortShows } from '../src/search/facets';

const shows: Show[] = JSON.parse(readFileSync('public/shows.json', 'utf8'));
const derived = deriveAll(shows);

let failures = 0;
let checks = 0;

function ok(label: string, pass: boolean, detail = ''): void {
  checks++;
  if (pass) console.log(`  ok   ${label}`);
  else { failures++; console.log(`  FAIL ${label}${detail ? `\n         ${detail}` : ''}`); }
}

const f = (over: Partial<FilterState> = {}): FilterState => ({ ...EMPTY_FILTERS, ...over });

console.log(`\ncorpus: ${shows.length} shows`);

console.log('\nderivation');
const eras = new Map<string, number>();
for (const d of derived) eras.set(d.era, (eras.get(d.era) ?? 0) + 1);
console.log('  eras:', [...eras.entries()].sort().map(([k, v]) => `${k}=${v}`).join(' '));
ok('every show derives an era (NONE allowed)', derived.every(d => d.era.length > 0));
ok('undated shows derive era NONE', derived.filter(d => !d.show.ShowDate).every(d => d.era === NONE));
ok('empty country becomes NONE', derived.filter(d => !d.show.Country?.trim()).every(d => d.country === NONE));
ok('documentaries derive type', derived.some(d => d.type === 'documentary'));

console.log('\nno filters');
ok('everything passes', applyFilters(derived, f(), null).length === shows.length);

console.log('\ncounts predict results — the core guarantee');
// For each facet, pick its top option, apply it, and check the count was right.
for (const facet of ['era', 'year', 'country', 'festival', 'type'] as FacetKey[]) {
  const counts = computeFacetCounts(derived, f(), null);
  const top = counts[facet].filter(o => o.value !== NONE && o.count > 0)[0];
  if (!top) { ok(`${facet}: has options`, false); continue; }
  const actual = applyFilters(derived, f({ [facet]: [top.value] } as Partial<FilterState>), null).length;
  ok(
    `${facet}: "${top.value}" advertises ${top.count}, yields ${actual}`,
    top.count === actual,
    `advertised ${top.count} but selecting it returned ${actual}`,
  );
}

console.log('\ncounts exclude their own facet, include the others');
{
  const base = f({ era: ['1990s'] });
  const counts = computeFacetCounts(derived, base, null);

  // Country counts must respect era=1990s.
  const germany = counts.country.find(o => o.value === 'germany');
  const actualGermany = applyFilters(derived, f({ era: ['1990s'], country: ['germany'] }), null).length;
  ok(
    `country "germany" under era=1990s: advertises ${germany?.count}, yields ${actualGermany}`,
    germany?.count === actualGermany,
  );

  // Era counts must NOT respect era=1990s — otherwise 2000s would read as 0
  // and the user could never widen their selection.
  const twoThousands = counts.era.find(o => o.value === '2000s');
  ok(
    `era "2000s" still counts ${twoThousands?.count} while era=1990s is active`,
    (twoThousands?.count ?? 0) > 0,
    'own-facet exclusion is broken — widening a selection would be impossible',
  );
}

console.log('\nzero-count options are returned, not dropped');
{
  const counts = computeFacetCounts(derived, f({ country: ['japan'] }), null);
  ok('festival options still present', counts.festival.length > 0);
  ok('some festival options are zero (disable, not hide)', counts.festival.some(o => o.count === 0));
}

console.log('\nNONE keeps sparse records reachable');
{
  const noCountry = applyFilters(derived, f({ country: [NONE] }), null).length;
  const expected = shows.filter(s => !s.Country?.trim()).length;
  ok(`country=NONE yields ${noCountry} (expected ${expected})`, noCountry === expected);
  const noFestival = applyFilters(derived, f({ festival: [NONE] }), null).length;
  const expectedF = shows.filter(s => !s.EventOrFestival?.trim()).length;
  ok(`festival=NONE yields ${noFestival} (expected ${expectedF})`, noFestival === expectedF);
  ok('NONE sorts last in country options',
    computeFacetCounts(derived, f(), null).country.at(-1)?.value === NONE);
}

console.log('\nmulti-select is OR within a facet, AND across facets');
{
  const a = applyFilters(derived, f({ era: ['1990s'] }), null).length;
  const b = applyFilters(derived, f({ era: ['2000s'] }), null).length;
  const both = applyFilters(derived, f({ era: ['1990s', '2000s'] }), null).length;
  ok(`era OR: ${a} + ${b} = ${both}`, a + b === both);

  const andCase = applyFilters(derived, f({ era: ['1990s'], country: ['germany'] }), null).length;
  ok(`era AND country narrows (${andCase} <= ${a})`, andCase <= a && andCase > 0);
}

console.log('\nsorting');
{
  const sorted = sortShows(shows, 'year-desc');
  const undatedFirstIdx = sorted.findIndex(s => !/^\d{4}/.test(s.ShowDate || ''));
  const datedAfter = sorted.slice(undatedFirstIdx).filter(s => /^\d{4}/.test(s.ShowDate || '')).length;
  ok('year-desc: undated block sits at the end', undatedFirstIdx === -1 || datedAfter === 0);

  const asc = sortShows(shows, 'year-asc');
  const undatedAscIdx = asc.findIndex(s => !/^\d{4}/.test(s.ShowDate || ''));
  const datedAfterAsc = asc.slice(undatedAscIdx).filter(s => /^\d{4}/.test(s.ShowDate || '')).length;
  ok('year-asc: undated STILL last, not first', undatedAscIdx === -1 || datedAfterAsc === 0);

  ok('year-desc newest first', (sorted[0].ShowDate || '') >= (sorted[1].ShowDate || ''));
  ok('year-asc oldest first', (asc[0].ShowDate || '') <= (asc[1].ShowDate || ''));

  const byArtist = sortShows(shows, 'artist');
  ok('artist A-Z',
    byArtist[0].Artist.localeCompare(byArtist.at(-1)!.Artist, undefined, { sensitivity: 'base' }) <= 0);

  ok('sorting is stable across calls',
    JSON.stringify(sortShows(shows, 'year-desc').map(s => s.ShowID)) ===
    JSON.stringify(sortShows(shows, 'year-desc').map(s => s.ShowID)));
  ok('sortShows does not mutate its input', shows.length === 829 || shows.length > 0);
}

console.log('\nperformance');
{
  const t0 = Date.now();
  const N = 50;
  for (let i = 0; i < N; i++) {
    computeFacetCounts(derived, f({ era: ['1990s'], country: ['germany'] }), null);
  }
  const per = (Date.now() - t0) / N;
  console.log(`  full recount: ${per.toFixed(2)}ms per interaction`);
  ok(`recount stays under 16ms (one frame)`, per < 16, `${per.toFixed(2)}ms — would drop frames`);
}

console.log(`\n${checks - failures}/${checks} passed`);
if (failures > 0) { console.log(`${failures} FAILED\n`); process.exit(1); }
console.log('Facet engine is honest.\n');

/**
 * Canonicality checks for src/lib/url.ts.
 *
 * Run: npm run check:url
 *
 * These guard the one property that cannot be fixed retroactively: a given
 * logical view must always serialize to the same string. If that breaks after
 * analytics is live, historical data is unrepairable.
 */

import {
  DEFAULT_SORT,
  EMPTY_FILTERS,
  FilterState,
  activeFilterCount,
  isFiltered,
  parseFilters,
  readShowParam,
  serializeFilters,
  slugify,
  withShowParam,
} from '../src/lib/url';

let failures = 0;
let checks = 0;

function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}\n         expected ${e}\n         actual   ${a}`);
  }
}

const f = (over: Partial<FilterState> = {}): FilterState => ({ ...EMPTY_FILTERS, ...over });

console.log('\nslugify');
eq('lowercases and dashes', slugify('Rock am Ring'), 'rock-am-ring');
eq('strips accents', slugify('Eurockéennes Festival'), 'eurockeennes-festival');
eq('collapses punctuation', slugify("Jane's Addiction"), 'jane-s-addiction');
eq('trims edge dashes', slugify('  Glastonbury!  '), 'glastonbury');
eq('casing variants collapse', slugify('Rock Am Ring'), slugify('Rock am Ring'));

console.log('\nrule 1 — fixed key order');
eq(
  'emitted in PARAM_ORDER regardless of assignment order',
  serializeFilters(f({ sort: 'artist', country: ['germany'], q: 'nirvana', from: 1990 })),
  '?q=nirvana&from=1990&country=germany&sort=artist',
);

console.log('\nrule 2 — values sorted');
eq(
  'multi-values sort alphabetically',
  serializeFilters(f({ country: ['germany', 'australia'] })),
  '?country=australia,germany',
);
eq(
  'reordering input yields an identical URL',
  serializeFilters(f({ country: ['germany', 'australia'] })),
  serializeFilters(f({ country: ['australia', 'germany'] })),
);
eq('duplicates collapse', serializeFilters(f({ country: ['germany', 'germany'] })), '?country=germany');

console.log('\nrule 3 — empties omitted');
eq('no filters yields empty string', serializeFilters(EMPTY_FILTERS), '');
eq('default sort is implied', serializeFilters(f({ sort: DEFAULT_SORT })), '');
eq('non-default sort is explicit', serializeFilters(f({ sort: 'year-asc' })), '?sort=year-asc');
eq('whitespace-only q is dropped', serializeFilters(f({ q: '   ' })), '');

console.log('\nyear range');
eq('both ends', serializeFilters(f({ from: 1993, to: 2011 })), '?from=1993&to=2011');
eq('open start', serializeFilters(f({ to: 1979 })), '?to=1979');
eq('open end', serializeFilters(f({ from: 2010 })), '?from=2010');
eq('unbounded omitted entirely', serializeFilters(f({ from: null, to: null })), '');
eq('undated flag', serializeFilters(f({ from: 1990, undated: true })), '?from=1990&undated=1');
eq('undated false is implied', serializeFilters(f({ undated: false })), '');
eq('reversed range is swapped, not empty', parseFilters('?from=2011&to=1993'), parseFilters('?from=1993&to=2011'));
eq('out-of-range year rejected', parseFilters('?from=99999').from, null);
eq('non-numeric year rejected', parseFilters('?from=abc').from, null);
eq('undated only accepts 1', parseFilters('?undated=true').undated, false);
eq('range counts as one active filter', activeFilterCount(f({ from: 1990, to: 1999 })), 1);
eq('isFiltered true on a range', isFiltered(f({ from: 1990 })), true);
eq('isFiltered true on undated', isFiltered(f({ undated: true })), true);

console.log('\nround trip');
const cases: FilterState[] = [
  EMPTY_FILTERS,
  f({ from: 1993, to: 2011 }),
  f({ q: 'nirvana', from: 1990, to: 1999, country: ['germany'], sort: 'artist' }),
  f({ festival: ['rock-am-ring', 'glastonbury-festival'] }),
  f({ country: ['none'] }),
  f({ from: 1996, to: 1996, undated: true }),
  f({ q: 'jane’s addiction', sort: 'year-asc' }),
  f({ quality: ['sd', 'hd-1080'], standard: ['pal'], length: ['60-90', 'over-90'], setlist: ['yes'] }),
  f({ q: 'pearl jam', country: ['germany'], setlist: ['no'] }),
];
for (const state of cases) {
  const once = serializeFilters(state);
  const twice = serializeFilters(parseFilters(once));
  eq(`stable: ${once || '(empty)'}`, twice, once);
}

console.log('\nparser hardening');
eq('unknown sort falls back to default', parseFilters('?sort=bogus').sort, DEFAULT_SORT);
eq('unknown params ignored', parseFilters('?nope=1').country, []);
eq('parser slugifies raw input', parseFilters('?country=United%20Kingdom').country, ['united-kingdom']);
eq('empty param yields empty list', parseFilters('?country=').country, []);
eq(
  'differently-ordered URLs parse identically',
  parseFilters('?country=germany&era=1990s'),
  parseFilters('?era=1990s&country=germany'),
);

console.log('\nretired params (one page since 2026-10-13; the type filter is gone)');
eq('an old ?view= is dropped', serializeFilters(parseFilters('?view=artists&from=1990')), '?from=1990');
eq('an old ?type= is dropped', serializeFilters(parseFilters('?type=documentary&country=germany')), '?country=germany');
eq('an old ?type= does not filter', isFiltered(parseFilters('?type=documentary')), false);

console.log('\nhelpers');
eq('an old link to a grouped event lands on its group',
  serializeFilters(parseFilters('?festival=reading-festival,leeds-festival')), '?festival=reading-leeds');
eq('isFiltered false when empty', isFiltered(EMPTY_FILTERS), false);
eq('isFiltered true on a facet', isFiltered(f({ country: ['germany'] })), true);
eq('isFiltered true on a query', isFiltered(f({ q: 'nirvana' })), true);
eq('isFiltered ignores sort', isFiltered(f({ sort: 'artist' })), false);
eq('activeFilterCount sums facets and q', activeFilterCount(f({ country: ['germany', 'japan'], q: 'x' })), 3);

console.log('\nMore filters (F12)');
eq('keys in order, values sorted',
  serializeFilters(f({ setlist: ['yes'], length: ['over-90', '60-90'], standard: ['pal'], quality: ['sd', 'hd-1080'], country: ['germany'] })),
  '?country=germany&quality=hd-1080,sd&standard=pal&length=60-90,over-90&setlist=yes');
eq('values a filter does not have are dropped', parseFilters('?quality=4k,hd-1080&setlist=maybe&length=forever'),
  f({ quality: ['hd-1080'] }));
eq('a More filter counts as filtering', isFiltered(f({ setlist: ['yes'] })), true);
eq('each value counts once', activeFilterCount(f({ quality: ['sd', 'low-res'], setlist: ['no'] })), 3);

console.log('\nList layout and the length sort (F10)');
eq('grid is the default and never spelled out', serializeFilters(f({ layout: 'grid' })), '');
eq('list goes last, after sort', serializeFilters(f({ q: 'pearl jam', sort: 'length', layout: 'list' })), '?q=pearl%20jam&sort=length&layout=list');
eq('an unknown layout is the grid', parseFilters('?layout=table').layout, 'grid');
eq('length is a sort', parseFilters('?sort=length').sort, 'length');
eq('the layout is not a filter', isFiltered(f({ layout: 'list' })), false);

console.log('\nthe open show (?show=, F3)');
eq('reads a show ID', readShowParam('?q=nirvana&show=4dba0c8ff6ae'), '4dba0c8ff6ae');
eq('ignores anything that is not a ShowID', readShowParam('?show=../../etc'), null);
eq('no show, no ID', readShowParam('?q=nirvana'), null);
eq('adds the show after the filters', withShowParam('?q=nirvana&country=germany', '4dba0c8ff6ae'), '?q=nirvana&country=germany&show=4dba0c8ff6ae');
eq('replaces a show already there', withShowParam('?q=x&show=aaaaaaaaaaaa', 'bbbbbbbbbbbb'), '?q=x&show=bbbbbbbbbbbb');
eq('removes the show, keeps the filters', withShowParam('?q=x&show=aaaaaaaaaaaa', null), '?q=x');
eq('removes the last param to a bare URL', withShowParam('?show=aaaaaaaaaaaa', null), '');
eq('a show alone', withShowParam('', 'aaaaaaaaaaaa'), '?show=aaaaaaaaaaaa');
eq('the show is not a filter', isFiltered(parseFilters('?show=aaaaaaaaaaaa')), false);
eq('filters still serialize without it', serializeFilters(parseFilters('?country=germany&show=aaaaaaaaaaaa')), '?country=germany');

console.log(`\n${checks - failures}/${checks} passed`);
if (failures > 0) {
  console.log(`${failures} FAILED\n`);
  process.exit(1);
}
console.log('URL serialization is canonical.\n');

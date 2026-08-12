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
  serializeFilters,
  slugify,
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
  serializeFilters(f({ sort: 'artist', country: ['germany'], q: 'nirvana', era: ['1990s'] })),
  '?q=nirvana&era=1990s&country=germany&sort=artist',
);

console.log('\nrule 2 — values sorted');
eq(
  'multi-values sort alphabetically',
  serializeFilters(f({ era: ['2000s', '1990s'] })),
  '?era=1990s,2000s',
);
eq(
  'reordering input yields an identical URL',
  serializeFilters(f({ country: ['germany', 'australia'] })),
  serializeFilters(f({ country: ['australia', 'germany'] })),
);
eq('years sort numerically, not lexically', serializeFilters(f({ year: [1998, 1985, 2010] })), '?year=1985,1998,2010');
eq('duplicates collapse', serializeFilters(f({ era: ['1990s', '1990s'] })), '?era=1990s');

console.log('\nrule 3 — empties omitted');
eq('no filters yields empty string', serializeFilters(EMPTY_FILTERS), '');
eq('default sort is implied', serializeFilters(f({ sort: DEFAULT_SORT })), '');
eq('non-default sort is explicit', serializeFilters(f({ sort: 'year-asc' })), '?sort=year-asc');
eq('whitespace-only q is dropped', serializeFilters(f({ q: '   ' })), '');

console.log('\nround trip');
const cases: FilterState[] = [
  EMPTY_FILTERS,
  f({ era: ['1990s'] }),
  f({ q: 'nirvana', era: ['1990s', '2000s'], country: ['germany'], year: [1998], sort: 'artist' }),
  f({ festival: ['rock-am-ring', 'glastonbury-festival'] }),
  f({ country: ['none'] }),
  f({ q: 'jane’s addiction', sort: 'year-asc' }),
];
for (const state of cases) {
  const once = serializeFilters(state);
  const twice = serializeFilters(parseFilters(once));
  eq(`stable: ${once || '(empty)'}`, twice, once);
}

console.log('\nparser hardening');
eq('unknown sort falls back to default', parseFilters('?sort=bogus').sort, DEFAULT_SORT);
eq('out-of-range years dropped', parseFilters('?year=99999999,1998').year, [1998]);
eq('non-numeric years dropped', parseFilters('?year=abc').year, []);
eq('unknown params ignored', parseFilters('?nope=1').era, []);
eq('parser slugifies raw input', parseFilters('?country=United%20Kingdom').country, ['united-kingdom']);
eq('empty param yields empty list', parseFilters('?era=').era, []);
eq(
  'differently-ordered URLs parse identically',
  parseFilters('?country=germany&era=1990s'),
  parseFilters('?era=1990s&country=germany'),
);

console.log('\nhelpers');
eq('isFiltered false when empty', isFiltered(EMPTY_FILTERS), false);
eq('isFiltered true on a facet', isFiltered(f({ era: ['1990s'] })), true);
eq('isFiltered true on a query', isFiltered(f({ q: 'nirvana' })), true);
eq('isFiltered ignores sort', isFiltered(f({ sort: 'artist' })), false);
eq('activeFilterCount sums facets and q', activeFilterCount(f({ era: ['1990s', '2000s'], q: 'x' })), 3);

console.log(`\n${checks - failures}/${checks} passed`);
if (failures > 0) {
  console.log(`${failures} FAILED\n`);
  process.exit(1);
}
console.log('URL serialization is canonical.\n');

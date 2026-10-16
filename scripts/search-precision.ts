/**
 * Search precision harness.
 *
 * Scores every artist view in the collection against the app's REAL search
 * code (imported from src/search/searchIndex.ts — not a copy), so the numbers
 * here always reflect what the site actually does.
 *
 * For each artist name we ask: "if a user opens this artist's view, do they get
 * exactly that artist's shows?"
 *
 *   false positive = a show by a DIFFERENT artist appearing in the view
 *   false negative = one of the artist's own shows missing from the view
 *
 * Run:  npm run check:search                      (part of npm run check and the deploy)
 *       node scripts/search-precision.ts --verbose   (list every false positive; Node 22.6+)
 *
 * Exits 1 on any false positive, false negative, or failed golden or grouping case.
 */

import fs from 'node:fs';
import { createSearchIndex, runSearch, resolveArtist, getSongSuggestion, searchShows } from '../src/search/searchIndex.ts';
import type { Show } from '../App';

const VERBOSE = process.argv.includes('--verbose');

// Relative to the repo root, where npm runs it — like the other checks. Not
// derived from import.meta.url: `npm run check:search` bundles this file into
// node_modules/.cache first, so its own location is not the repo.
const shows: Show[] = JSON.parse(fs.readFileSync('public/shows.json', 'utf8'));
const index = createSearchIndex(shows);
const artistNames = index.artistNames;

/**
 * Golden cases — specific queries with a hand-checked expectation.
 * These encode bugs we have actually seen, so they can never silently return.
 */
const GOLDEN: { query: string; mustExclude?: string[]; mustInclude?: string[]; note: string }[] = [
  { query: 'Stone Temple Pilots', mustExclude: ['Velvet Revolver'],
    note: 'VR setlist contains "(Stone Temple Pilots cover)"' },
  { query: 'Soundgarden', mustExclude: ['Audioslave'],
    note: 'Audioslave setlist covers Soundgarden songs' },
  { query: 'Radiohead', mustExclude: ['Korn', 'Neil Finn'],
    note: 'covers / notes name-drop Radiohead' },
  { query: "Jane's Addiction", mustExclude: ['White Stripes'],
    note: 'apostrophe tokenisation + cover annotation' },
  { query: 'Smashing Pumpkins', mustExclude: ['Tool'], note: 'cover annotation' },
  { query: 'Nirvana', mustExclude: ["Fun Lovin' Criminals", "Jane's Addiction"],
    note: 'cover annotation' },
  { query: 'Foo Fighters', mustExclude: ['Them Crooked Vultures', "Jane's Addiction"],
    note: 'shared-member name-drops' },
  { query: 'Live', mustInclude: ['Live'],
    note: 'common-word artist name — must not match the whole collection' },
  { query: 'R.E.M.', mustInclude: ['R.E.M.'],
    note: 'punctuation tokenises to r/e/m and prefix-matches everything' },
  { query: 'Tool', mustInclude: ['Tool'], note: 'common-word artist name' },
  { query: 'Who', mustInclude: ['Who'], note: 'common-word artist name' },
  { query: 'Cake', mustInclude: ['Cake'], note: 'common-word artist name' },
  { query: 'The Strokes', mustInclude: ['Strokes'],
    note: 'artists are filed without a leading "The"; typing it must still open the view' },
  { query: 'The Who', mustInclude: ['Who'], note: 'leading "The" on a common-word name' },
  { query: 'Echo and the Bunnymen', mustInclude: ['Echo & the Bunnymen'], note: '"and" for "&"' },
];

interface Row {
  artist: string;
  real: number;
  returned: number;
  truePos: number;
  falsePos: number;
  falseNeg: number;
  foreign: Show[];
}

const rows: Row[] = artistNames.map(artist => {
  const returned = runSearch(shows, artist, index);
  const real = shows.filter(s => s.Artist === artist).length;
  const truePos = returned.filter(s => s.Artist === artist).length;
  const foreign = returned.filter(s => s.Artist !== artist);
  return {
    artist, real, returned: returned.length, truePos,
    falsePos: foreign.length, falseNeg: real - truePos, foreign,
  };
});

const totalFP = rows.reduce((n, r) => n + r.falsePos, 0);
const totalFN = rows.reduce((n, r) => n + r.falseNeg, 0);
const contaminated = rows.filter(r => r.falsePos > 0);
const incomplete = rows.filter(r => r.falseNeg > 0);

const microPrecision = rows.reduce((n, r) => n + r.truePos, 0) /
  Math.max(rows.reduce((n, r) => n + r.returned, 0), 1);
const microRecall = rows.reduce((n, r) => n + r.truePos, 0) /
  Math.max(rows.reduce((n, r) => n + r.real, 0), 1);

console.log('\n' + '='.repeat(66));
console.log('  ARTIST VIEW PRECISION');
console.log('='.repeat(66));
console.log(`  collection            ${shows.length} shows / ${artistNames.length} artists`);
console.log(`  precision             ${(microPrecision * 100).toFixed(2)}%`);
console.log(`  recall                ${(microRecall * 100).toFixed(2)}%`);
console.log(`  false positives       ${totalFP}   (foreign shows shown in an artist view)`);
console.log(`  false negatives       ${totalFN}   (artist's own shows missing)`);
console.log(`  contaminated views    ${contaminated.length}/${artistNames.length}`);
console.log(`  incomplete views      ${incomplete.length}/${artistNames.length}`);

if (contaminated.length) {
  console.log('\n  WORST OFFENDERS');
  console.log('  ' + '-'.repeat(62));
  [...contaminated].sort((a, b) => b.falsePos - a.falsePos).slice(0, 15).forEach(r => {
    const junk = (r.falsePos / Math.max(r.returned, 1) * 100).toFixed(0);
    console.log(`  ${String(r.falsePos).padStart(4)} foreign / ${String(r.real).padStart(3)} real  ${String(junk).padStart(3)}% junk   ${r.artist}`);
  });
}

if (VERBOSE && contaminated.length) {
  console.log('\n  EVERY FALSE POSITIVE');
  console.log('  ' + '-'.repeat(62));
  [...contaminated].sort((a, b) => b.falsePos - a.falsePos).forEach(r => {
    console.log(`\n  ${r.artist} (${r.falsePos}):`);
    r.foreign.slice(0, 25).forEach(s =>
      console.log(`     [${s.Artist}] ${s.ShowDate || 'undated'} — ${s.EventOrFestival || s.VenueName || ''}`));
    if (r.foreign.length > 25) console.log(`     … and ${r.foreign.length - 25} more`);
  });
}

console.log('\n' + '='.repeat(66));
console.log('  GOLDEN CASES');
console.log('='.repeat(66));

let goldFail = 0;
for (const g of GOLDEN) {
  const returned = runSearch(shows, g.query, index);
  const got = new Set(returned.map(s => s.Artist));
  const problems: string[] = [];

  for (const bad of g.mustExclude ?? []) {
    if (got.has(bad)) problems.push(`leaked "${bad}"`);
  }
  for (const good of g.mustInclude ?? []) {
    const expected = shows.filter(s => s.Artist === good).length;
    const actual = returned.filter(s => s.Artist === good).length;
    if (actual !== expected) problems.push(`got ${actual}/${expected} of "${good}"`);
  }
  // Any artist view should return only that artist when the query IS an artist name,
  // or another way of writing one ("The Strokes") — a single mustInclude names it.
  const viewOf = artistNames.includes(g.query) ? g.query
    : g.mustInclude?.length === 1 ? g.mustInclude[0] : null;
  if (viewOf) {
    const foreign = returned.filter(s => s.Artist !== viewOf).length;
    if (foreign > 0) problems.push(`${foreign} foreign shows`);
  }

  if (problems.length) {
    goldFail++;
    console.log(`  FAIL  ${g.query.padEnd(22)} ${problems.join('; ')}`);
    console.log(`        ${g.note}`);
  } else {
    console.log(`  pass  ${g.query.padEnd(22)} ${returned.length} shows, all correct`);
  }
}

/**
 * Band names that are also ordinary song words. The artist facet must win, but
 * the song search must still be offered — otherwise the search box promises
 * "song" and silently fails to deliver for these queries.
 */
console.log('\n' + '='.repeat(66));
console.log('  SONG-COLLISION HINTS');
console.log('='.repeat(66));

const COLLISIONS = ['Kiss', 'Hole', 'Live', 'Queen', 'Train', 'Bush', 'Radiohead', 'Soundgarden'];
let hintFail = 0;
for (const q of COLLISIONS) {
  const artist = resolveArtist(q, artistNames);
  const hint = getSongSuggestion(shows, q, artist);
  const facet = runSearch(shows, q, index).length;
  if (!artist) {
    hintFail++;
    console.log(`  FAIL  ${q.padEnd(12)} did not resolve to an artist`);
    continue;
  }
  const viaPrefix = runSearch(shows, `song:${q}`, index).length;
  console.log(`  pass  ${q.padEnd(12)} facet ${String(facet).padStart(3)} show(s)` +
    (hint ? `  → hint: "${hint.count} more feature a song called “${hint.term}”" (song: → ${viaPrefix})`
          : `  → no hint (no other setlist matches)`));
}

/**
 * Free-text grouping (owner, 2026-10-13): artists above shows above songs,
 * words matched literally (no "stole" for "stone"), every song card able to
 * say which song, and a "Did you mean" for a misspelt artist — only when
 * nothing matched.
 */
console.log('\n' + '='.repeat(66));
console.log('  FREE-TEXT GROUPING');
console.log('='.repeat(66));

const GROUPING: { query: string; artists?: string[]; didYouMean?: string[]; corrected?: string; note: string }[] = [
  { query: 'stone', artists: ['Stone Temple Pilots', 'Queens of the Stone Age', 'Rolling Stones'], didYouMean: [],
    note: 'artists offered first; no fuzzy "stole"' },
  { query: 'creep', artists: [], didYouMean: [], note: 'no fuzzy "creed" / Creed' },
  { query: 'black hole', artists: [], didYouMean: [], note: 'earlier words whole: no "blackbird"' },
  { query: 'radiohead glastonbury', artists: [], didYouMean: [], note: 'artist + event across fields' },
  { query: 'soundgredn', didYouMean: ['Soundgarden'], note: 'two swapped letters and a missing one' },
  { query: 'soundgardn', didYouMean: ['Soundgarden'], note: 'was a silent fuzzy match' },
  { query: 'radiohed', didYouMean: ['Radiohead'], note: 'missing letter' },
  { query: 'chilli peppers', didYouMean: ['Red Hot Chili Peppers'], note: 'word by word' },
  { query: 'foo figters', didYouMean: ['Foo Fighters'], note: 'typo in the second word' },
  { query: 'pumkins', didYouMean: ['Smashing Pumpkins'], note: 'one word of a longer name' },
  { query: 'glastonbry', didYouMean: [], corrected: 'glastonbury', note: 'a misspelt event is offered as a search' },
  { query: 'foo fighters wembly', didYouMean: [], corrected: 'foo fighters wembley', note: 'only the misspelt word changes' },
];

const fold = (v: string) => v.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const wordsOf = (v: string) => fold(v).split(/[\n\r\p{Z}\p{P}]+/u).filter(Boolean);
const searchable = (s: Show) => wordsOf([s.Artist, s.ShowDate.slice(0, 4), s.VenueName, s.City, s.Country,
  s.EventOrFestival, s.RecordingType, s.ContentType, s.Setlist].filter(Boolean).join(' '));

let groupFail = 0;
for (const g of GROUPING) {
  const { shows: found, grouped } = searchShows(shows, g.query, index);
  const problems: string[] = [];
  if (!grouped) problems.push('not grouped');
  else {
    if (g.artists && grouped.artists.join('|') !== g.artists.join('|')) {
      problems.push(`artists [${grouped.artists.join(', ')}]`);
    }
    if (g.didYouMean && grouped.didYouMean.join('|') !== g.didYouMean.join('|')) {
      problems.push(`did you mean [${grouped.didYouMean.join(', ')}]`);
    }
    if ((g.corrected ?? null) !== grouped.correctedQuery) problems.push(`corrected to ${grouped.correctedQuery}`);
    // Every word literal; only the last, from four letters, may be a prefix.
    const typed = wordsOf(g.query);
    const last = typed[typed.length - 1];
    const loose = found.filter(s => grouped.kind.get(s.ShowID) !== 'artist').filter(s => {
      const words = searchable(s);
      return !typed.slice(0, -1).every(t => words.includes(t)) ||
        !words.some(w => (last.length >= 4 ? w.startsWith(last) : w === last));
    });
    if (loose.length) problems.push(`${loose.length} near-miss matches, e.g. ${loose[0].Artist} ${loose[0].ShowDate}`);
    const silent = found.filter(s => grouped.kind.get(s.ShowID) === 'song' && !grouped.songs.get(s.ShowID)?.length);
    if (silent.length) problems.push(`${silent.length} song matches with no song to show`);
  }
  if (problems.length) {
    groupFail++;
    console.log(`  FAIL  ${g.query.padEnd(22)} ${problems.join('; ')}`);
    console.log(`        ${g.note}`);
  } else {
    const n = (k: string) => found.filter(s => grouped!.kind.get(s.ShowID) === k).length;
    console.log(`  pass  ${g.query.padEnd(22)} ${grouped!.artists.length} artists / ${n('show')} shows / ${n('song')} songs` +
      (grouped!.didYouMean.length ? `  → did you mean ${grouped!.didYouMean.join(', ')}` : '') +
      (grouped!.correctedQuery ? `  → did you mean “${grouped!.correctedQuery}”` : ''));
  }
}

/**
 * Queries the way traders type them (docs/ux-research, finding F6): dates in
 * every format, abbreviations, other names for places and events, tech terms,
 * several field filters at once. Every expectation is worked out from the data,
 * not hard-coded, so it holds as the collection grows.
 */
console.log('\n' + '='.repeat(66));
console.log('  TRADER QUERIES');
console.log('='.repeat(66));

const ids = (list: Show[]) => new Set(list.map(s => s.ShowID));
const height = (s: Show) => parseInt(s.Height, 10) || 0;
const width = (s: Show) => parseInt(s.Width, 10) || 0;
const tier = (s: Show) => (height(s) >= 700 ? 'hd' : width(s) <= 360 || height(s) <= 300 ? 'low' : 'sd');
const on = (date: string) => shows.filter(s => s.ShowDate === date);
const TRADER: { query: string; exactly?: Show[]; includes?: Show[]; artist?: string | null; noSuggestion?: boolean; note: string }[] = [
  ...['1996-05-24', '1996/05/24', '24.05.1996', '24.05.96', '24/05/1996', '05/24/1996', 'May 24 1996',
    'May 24, 1996', '24 May 1996', '24th May 1996', '24. Mai 1996'].map(query => ({
    query, exactly: on('1996-05-24'), note: 'one date, every format' })),
  { query: '1996-05', exactly: shows.filter(s => s.ShowDate.startsWith('1996-05')), note: 'year and month' },
  { query: 'May 1996', exactly: shows.filter(s => s.ShowDate.startsWith('1996-05')), note: 'month by name' },
  { query: "May '96", exactly: shows.filter(s => s.ShowDate.startsWith('1996-05')), note: 'two-digit year' },
  { query: '08/06/1992', exactly: [...on('1992-06-08'), ...on('1992-08-06')], note: 'ambiguous: read both ways' },
  { query: 'rage 1996-05-24', exactly: on('1996-05-24').filter(s => s.Artist === 'Rage Against the Machine'), note: 'artist and date' },
  { query: "rock am ring '97", exactly: shows.filter(s => s.EventOrFestival === 'Rock am Ring' && s.ShowDate.startsWith('1997')), note: 'apostrophe year' },
  { query: 'rock am ring 97', exactly: shows.filter(s => s.EventOrFestival === 'Rock am Ring' && s.ShowDate.startsWith('1997')), note: 'bare two-digit year, when the words alone find nothing' },
  ...([['RATM', 'Rage Against the Machine'], ['FNM', 'Faith No More'], ['KOL', 'Kings of Leon'], ['30STM', '30 Seconds to Mars'],
    ['NIN', 'Nine Inch Nails'], ['SP', 'Smashing Pumpkins'], ['GNR', "Guns N' Roses"], ['rhcp', 'Red Hot Chili Peppers']] as const)
    .map(([query, artist]) => ({ query, artist, note: 'initials open the artist' })),
  { query: 'mas', artist: null, note: 'a Spanish word, not Mumford & Sons' },
  { query: 'XYZQ', noSuggestion: true, note: 'an unknown abbreviation is not "corrected" into a name' },
  { query: 'soundboard', noSuggestion: true, note: 'a spec word is not "corrected" into Soundgarden' },
  { query: 'uk', includes: shows.filter(s => s.Country === 'United Kingdom'), note: 'country short name' },
  { query: 'brasil', includes: shows.filter(s => s.Country === 'Brazil'), note: 'country in its own language' },
  { query: 'deutschland', includes: shows.filter(s => s.Country === 'Germany'), note: 'country in its own language' },
  ...['koln', 'köln', 'koeln'].map(query => ({ query, includes: shows.filter(s => s.City === 'Cologne'), note: 'city in its own language' })),
  { query: 'titp', includes: shows.filter(s => s.EventOrFestival === 'T in the Park'), note: 'event short name' },
  { query: 'glasto 1997', exactly: shows.filter(s => s.EventOrFestival === 'Glastonbury Festival' && s.ShowDate.startsWith('1997')), note: 'event short name with a year' },
  { query: 'hd', exactly: shows.filter(s => tier(s) === 'hd'), note: 'HD copies' },
  { query: 'lowres', exactly: shows.filter(s => tier(s) === 'low'), note: 'low-resolution copies' },
  { query: 'pal', exactly: shows.filter(s => tier(s) !== 'hd' && s.TVStandard === 'PAL'), note: 'PAL, SD only (as the drawer shows it)' },
  { query: 'artist:pearl year:2000', exactly: shows.filter(s => s.Artist.toLowerCase().includes('pearl') && s.ShowDate.includes('2000')), note: 'two fields at once' },
  { query: 'venue:"brixton academy"', exactly: shows.filter(s => s.VenueName.toLowerCase().includes('brixton academy')), note: 'a quoted value' },
  { query: 'pinkpop artist:pearl jam', exactly: shows.filter(s => s.Artist === 'Pearl Jam' && s.EventOrFestival === 'Pinkpop'), note: 'free words and a field' },
];

let traderFail = 0;
for (const t of TRADER) {
  const { shows: found, grouped } = searchShows(shows, t.query, index);
  const got = ids(found);
  const problems: string[] = [];
  if (t.exactly) {
    const want = ids(t.exactly);
    if (!want.size) problems.push('test has no expected shows');
    const missing = [...want].filter(id => !got.has(id)).length;
    const extra = [...got].filter(id => !want.has(id)).length;
    if (missing || extra) problems.push(`${missing} missing, ${extra} extra (got ${got.size}, want ${want.size})`);
  }
  if (t.includes) {
    const missing = t.includes.filter(s => !got.has(s.ShowID)).length;
    if (!t.includes.length) problems.push('test has no expected shows');
    if (missing) problems.push(`${missing} of ${t.includes.length} missing`);
  }
  if (t.artist !== undefined) {
    const resolved = resolveArtist(t.query.toLowerCase(), artistNames);
    if (resolved !== t.artist) problems.push(`resolved to ${resolved ?? 'nothing'}`);
  }
  if (t.noSuggestion && (grouped?.didYouMean.length || grouped?.correctedQuery)) {
    problems.push(`suggested ${grouped?.didYouMean.join(', ') || grouped?.correctedQuery}`);
  }
  if (problems.length) {
    traderFail++;
    console.log(`  FAIL  ${t.query.padEnd(26)} ${problems.join('; ')}`);
    console.log(`        ${t.note}`);
  } else {
    console.log(`  pass  ${t.query.padEnd(26)} ${t.artist !== undefined ? `→ ${t.artist ?? 'no artist'}` : `${got.size} shows`}  (${t.note})`);
  }
}

console.log('\n' + '='.repeat(66));
const clean = goldFail === 0 && hintFail === 0 && groupFail === 0 && traderFail === 0 && totalFP === 0 && totalFN === 0;
console.log(`  ${clean ? 'ALL CLEAN' : `${goldFail} golden failures, ${hintFail} hint failures, ${groupFail} grouping failures, ${traderFail} trader-query failures, ${totalFP} false positives, ${totalFN} false negatives`}`);
console.log('='.repeat(66) + '\n');

process.exit(clean ? 0 : 1);

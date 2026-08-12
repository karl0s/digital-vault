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
 * Run:  node scripts/search-precision.ts
 *       node scripts/search-precision.ts --verbose   (list every false positive)
 *
 * Node 22.6+ strips TypeScript types natively, so this runs with no build step.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSearchIndex, runSearch, resolveArtist, getSongSuggestion } from '../src/search/searchIndex.ts';
import type { Show } from '../App';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERBOSE = process.argv.includes('--verbose');

const shows: Show[] = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'public/shows.json'), 'utf8'),
);
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
  { query: 'Nirvana', mustExclude: ['Fun Loving Criminals', "Jane's Addiction"],
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
  // Any artist view should return only that artist when the query IS an artist name.
  if (artistNames.includes(g.query)) {
    const foreign = returned.filter(s => s.Artist !== g.query).length;
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

console.log('\n' + '='.repeat(66));
const clean = goldFail === 0 && hintFail === 0 && totalFP === 0 && totalFN === 0;
console.log(`  ${clean ? 'ALL CLEAN' : `${goldFail} golden failures, ${hintFail} hint failures, ${totalFP} false positives, ${totalFN} false negatives`}`);
console.log('='.repeat(66) + '\n');

process.exit(clean ? 0 : 1);

/**
 * Performance guard rails for the browse grid and the show drawer.
 *
 * Run: npm run check:perf   (also part of npm run check)
 *
 * Each rule below is a regression that was measured, not guessed. Together
 * they took the drawer from ~450 ms to ~25 ms on a Mac (2026-10-02). None of
 * them shows up as a type error or a failed build: the page just quietly gets
 * slow again. Static checks over the source are crude, but they catch the
 * realistic ways back in — someone adding motion to a card, an inline arrow
 * on a memoised prop, or AnimatePresence around a grid without the flag.
 *
 * To measure rather than lint: npm run perf (scripts/perf/bench.mjs).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DROPPED, LITE_FILE } from './site-data.mjs';

let failures = 0;
let checks = 0;

function ok(label, pass, detail = '') {
  checks++;
  if (pass) console.log(`  ok   ${label}`);
  else { failures++; console.log(`  FAIL ${label}${detail ? `\n         ${detail}` : ''}`); }
}

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
// Comments explain the rules in prose, so strip them before matching code.
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const app = code('App.tsx');
const card = code('components/ShowCard.tsx');
const lazy = code('components/LazyImage.tsx');
const shows = code('src/hooks/useShows.ts');
const cardHosts = ['components/ShowGrid.tsx', 'components/FeaturedRows.tsx', 'components/SearchResultsGrid.tsx'];

console.log('Cards');
ok('ShowCard imports no motion library',
  !/from\s+['"](motion\/react|framer-motion|motion)['"]/.test(card),
  'Hover/focus layers must stay CSS (group-hover). ~4 motion components per card meant ~4,600 on Browse, all re-rendering together.');
ok('ShowCard is memoised',
  /export const ShowCard = memo\(/.test(card),
  'Without memo, every state change in App (opening the drawer) re-renders every card.');

for (const host of cardHosts) {
  const src = code(host);
  const tags = src.match(/<ShowCard\b[\s\S]*?\/>/g) || [];
  const inline = tags.filter(t => /=\{\s*(\([^)]*\)|\w+)\s*=>/.test(t));
  ok(`${host}: no inline arrow props on <ShowCard>`,
    inline.length === 0,
    'A new function per render defeats memo. Pass a stable handler (onSelect={onShowClick}).');
  const presences = src.match(/<AnimatePresence\b[^>]*>/g) || [];
  ok(`${host}: every AnimatePresence sets presenceAffectsLayout={false}`,
    presences.every(t => t.includes('presenceAffectsLayout={false}')),
    'At its default, AnimatePresence gives every motion component beneath it a new context each render, past memo.');
}

console.log('App');
ok('the AnimatePresence around the views sets presenceAffectsLayout={false}',
  /<AnimatePresence\b[^>]*presenceAffectsLayout=\{false\}[^>]*>\s*\{mainContent\}/.test(app),
  'This one wraps every grid on the site. Without the flag, opening the drawer re-rendered ~4,600 card layers.');
ok('handleShowClick is stable (useCallback)',
  /const handleShowClick = useCallback\(/.test(app),
  'It reaches every memoised card as onSelect; a new function each render re-renders them all.');
ok('inert waits for the drawer animation, not the click',
  /drawerSettled\s*\?\s*\(\s*\{\s*inert/.test(app) && !/selectedShow\s*\?\s*\(\s*\{\s*inert/.test(app),
  'Toggling inert restyles the whole page (~24k elements). Keyed on selectedShow it delays the drawer by 100 ms+ (Mac) / 0.5 s (phone).');

console.log('Images');
ok('cards load the build thumbnail, with the original as fallback',
  /getImageUrl\(show\.ChecksumSHA1, 1, 'thumb'\)/.test(card) && /src=\{thumbUrl\}/.test(card) && /fallbackSrc=\{imageUrl\}/.test(card),
  'Cards show ~580 real pixels at most; the originals are 720–1920 px. Thumbnails: scripts/thumbs.mjs.');
ok('the build makes the thumbnails',
  /thumbnails\(\)/.test(code('vite.config.ts')),
  'Without the plugin dist/thumbs/ is empty and every card silently falls back to the full original.');
ok('getImageUrl is stable (useCallback)',
  /const getImageUrl = useCallback\(/.test(shows),
  'It is a prop of every memoised card.');
ok('LazyImage uses native lazy loading',
  /loading="lazy"/.test(lazy) && !/IntersectionObserver/.test(lazy),
  'One observer per image was 1,100+ observers on Browse, and loaded later than the browser does.');
ok('LazyImage does not pin images to their own compositor layer',
  !/translateZ|will-?change/i.test(lazy),
  'translateZ(0) or will-change on every card image is a permanent layer each — over a thousand on Browse.');

console.log('Show data');
const useShowsSrc = code('src/hooks/useShows.ts');
ok(`the site loads ${LITE_FILE} first, not the full shows.json`,
  useShowsSrc.indexOf(LITE_FILE) !== -1 && useShowsSrc.indexOf(LITE_FILE) < useShowsSrc.indexOf('shows.json`'),
  'shows.json is 4x the download (534 vs 131 KB gzipped); it is only the fallback.');
ok('the build writes the derived show data',
  /siteData\(\)/.test(code('vite.config.ts')),
  'Without the plugin every load falls back to the full shows.json.');

// Every file the browser runs. Field reads are `.Field`; the Show interface
// in App.tsx declares them all, so it is skipped.
const appFiles = ['App.tsx', 'main.tsx'];
for (const dir of ['components', 'src']) {
  const walk = d => readdirSync(d).forEach(f => {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?)$/.test(f)) appFiles.push(p);
  });
  walk(dir);
}
const appCode = Object.fromEntries(appFiles.map(f => {
  let src = code(f);
  if (f === 'App.tsx') src = src.replace(/export interface Show \{[\s\S]*?\n\}/, '');
  return [f, src];
}));
const reads = (field, except = []) => Object.entries(appCode)
  .filter(([f, src]) => !except.includes(f) && new RegExp(`\\.${field}\\b`).test(src))
  .map(([f]) => f);
const droppedReads = DROPPED.flatMap(field => reads(field).map(f => `${field} in ${f}`));
ok('no code reads a field the site data drops',
  droppedReads.length === 0,
  `${droppedReads.join(', ')} — remove the field from DROPPED in scripts/site-data.mjs, or it is blank on the live site.`);
const notesReads = reads('Notes', ['src/hooks/useShows.ts', 'src/search/searchIndex.ts']);
ok('Notes are read only through getNotes',
  notesReads.length === 0,
  `${notesReads.join(', ')} reads show.Notes, which the site's data does not carry. Use useShows' getNotes.`);

console.log('Fonts');
const html = read('index.html');
ok('no third-party font stylesheet in index.html',
  !/fonts\.(googleapis|gstatic)\.com/.test(html),
  'A Google Fonts <link> is render-blocking: nothing paints until another server answers. Self-host (public/fonts/README.md).');
ok('the body font is preloaded',
  /rel="preload" href="\.\/fonts\/dm-sans-latin\.woff2"/.test(html),
  'Without it DM Sans is only requested once the CSS is parsed, and text renders twice.');

console.log(`\n${checks - failures}/${checks} passed`);
if (failures > 0) process.exit(1);

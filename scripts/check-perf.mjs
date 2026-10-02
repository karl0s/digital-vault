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

import { readFileSync } from 'node:fs';

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
ok('getImageUrl is stable (useCallback)',
  /const getImageUrl = useCallback\(/.test(shows),
  'It is a prop of every memoised card.');
ok('LazyImage uses native lazy loading',
  /loading="lazy"/.test(lazy) && !/IntersectionObserver/.test(lazy),
  'One observer per image was 1,100+ observers on Browse, and loaded later than the browser does.');
ok('LazyImage does not pin images to their own compositor layer',
  !/translateZ|will-?change/i.test(lazy),
  'translateZ(0) or will-change on every card image is a permanent layer each — over a thousand on Browse.');

console.log(`\n${checks - failures}/${checks} passed`);
if (failures > 0) process.exit(1);

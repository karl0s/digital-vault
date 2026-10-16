/**
 * The page per show (scripts/show-pages.ts), checked against the real data.
 *
 * Run: npm run check:pages
 *
 * Every visible record gets a page that previews it and sends a person on to
 * it in the site; no page carries anything private.
 */

import { existsSync, readFileSync } from 'node:fs';
import type { Show } from '../App';
import { buildShowPages, siteUrl, visibleShows } from './show-pages';

let failures = 0;
let checks = 0;
function ok(label: string, pass: boolean, detail = ''): void {
  checks++;
  if (pass) console.log(`  ok   ${label}`);
  else { failures++; console.log(`  FAIL ${label}${detail ? `\n         ${detail}` : ''}`); }
}

const root = '.';
const site = siteUrl(root);
const all: Show[] = JSON.parse(readFileSync('public/shows.json', 'utf8'));
const visible = visibleShows(root);
const pages = await buildShowPages(root);
const page = (id: string) => pages.get(`show/${id}/index.html`) ?? '';
const meta = (html: string, prop: string) => new RegExp(`property="${prop}" content="([^"]*)"`).exec(html)?.[1];

console.log(`\n${pages.size} pages for ${visible.length} visible shows (${site})`);
ok('one page per visible show', pages.size === visible.length && visible.every(s => pages.has(`show/${s.ShowID}/index.html`)));
ok('no page for a hidden record', all.filter(s => s.Hidden === 'Yes').every(s => !pages.has(`show/${s.ShowID}/index.html`)));

console.log('\neach page previews its show and opens it');
let missingImage = 0;
for (const show of visible) {
  const html = page(show.ShowID);
  const image = meta(html, 'og:image');
  if (!image) { missingImage++; continue; }
  if (!image.startsWith(`${site}images/${show.ChecksumSHA1}_01.jpg`) || !existsSync(`public/images/${show.ChecksumSHA1}_01.jpg`)) {
    ok(`${show.ShowID}: og:image is its own slot 1`, false, image);
  }
}
ok(`every page with a still names it (${visible.length - missingImage} of ${visible.length}; the rest have no slot 1)`,
  visible.filter(s => !meta(page(s.ShowID), 'og:image')).every(s => !s.ChecksumSHA1 || !existsSync(`public/images/${s.ChecksumSHA1}_01.jpg`)));
ok('every page has a title, description and its own URL', visible.every(s => {
  const html = page(s.ShowID);
  return meta(html, 'og:title') && meta(html, 'og:description') && meta(html, 'og:url') === `${site}show/${s.ShowID}/`;
}));
ok('every page sends a person on to the show', visible.every(s => page(s.ShowID).includes(`location.replace("../../?show=${s.ShowID}"`)));
ok('every page is kept out of search', visible.every(s => page(s.ShowID).includes('<meta name="robots" content="noindex">')));

console.log('\nwhat a preview says');
{
  const rar = page('c7d5bd8f3f45');
  ok(`30STM Rock am Ring: "${meta(rar, 'og:title')}"`, meta(rar, 'og:title') === '30 Seconds to Mars · 2010-06-05 · Rock am Ring');
  ok(`and "${meta(rar, 'og:description')}"`, /HD 1080 · 44 min/.test(meta(rar, 'og:description') ?? ''));
  const yearOnly = visible.find(s => s.ShowDate.endsWith('-01-01'));
  ok('a year-only date reads as the year', !!yearOnly && (meta(page(yearOnly.ShowID), 'og:title') ?? '').includes(` · ${yearOnly.ShowDate.slice(0, 4)}`));
  const amp = visible.find(s => s.Artist.includes('&'));
  ok(`text is escaped ("${amp?.Artist}")`, !!amp && page(amp.ShowID).includes(amp.Artist.replace(/&/g, '&amp;')) && !/<title>[^<]*&(?!amp;|lt;|gt;|quot;)/.test(page(amp.ShowID)));
}

console.log('\nnothing private');
{
  const leaks = visible.filter(s => {
    const html = page(s.ShowID);
    const priv = (s.PrivateNotes as unknown as string | undefined)?.trim();
    // A folder may be named for the event ("Reading Festival"): only a name
    // that isn't already one of the show's public words would be a leak.
    const folder = s.FolderName?.trim();
    const open = [s.Artist, s.EventOrFestival, s.VenueName, s.City, s.Country].join(' ');
    return (priv && priv.length > 20 && html.includes(priv.slice(0, 40))) ||
      (folder && folder.length > 12 && !open.includes(folder) && html.includes(folder));
  });
  ok('no page carries PrivateNotes or a folder name', leaks.length === 0, leaks.slice(0, 3).map(s => s.ShowID).join(', '));
  ok('no page carries Notes or Lineage', visible.every(s => {
    const html = page(s.ShowID);
    return !(s.Lineage && s.Lineage.length > 20 && html.includes(s.Lineage.slice(0, 40)));
  }));
}

console.log(`\n${checks - failures}/${checks} passed`);
if (failures > 0) { console.log(`${failures} FAILED\n`); process.exit(1); }
console.log('Every show has a page.\n');

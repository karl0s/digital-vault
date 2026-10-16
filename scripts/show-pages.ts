/**
 * A page per show (docs/ux-research F3): /show/<ShowID>/, so a link pasted
 * into WhatsApp, iMessage, Discord or a forum previews that show — its still,
 * name, date and quality — rather than the site. Link previews come from the
 * page's tags, and crawlers run no JavaScript; a person is sent straight on to
 * the show in the site (?show=<ShowID>) and never sees the page.
 *
 * Built with the site (vite-plugin-show-pages.ts) from public/shows.json:
 * visible records only, published fields only, never committed. Words come
 * from src/lib/specs.ts, so a preview says what the site says ("2000",
 * "HD 1080", "44 min"). `noindex`: the pages are for previews, not search.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import type { Show } from '../App';
import { dateName, lengthName, quality, sourceName } from '../src/lib/specs';

export const SHOW_DIR = 'show';
const SHOW_ID = /^[0-9a-f]{12}$/;

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The live site's address, read from index.html's og:url: one place for it. */
export function siteUrl(root: string): string {
  const m = /property="og:url" content="([^"]+)"/.exec(readFileSync(join(root, 'index.html'), 'utf8'));
  if (!m) throw new Error('index.html has no og:url');
  return m[1].endsWith('/') ? m[1] : `${m[1]}/`;
}

export function visibleShows(root: string): Show[] {
  const shows: Show[] = JSON.parse(readFileSync(join(root, 'public/shows.json'), 'utf8'));
  return shows.filter(s => s.Hidden !== 'Yes' && SHOW_ID.test(s.ShowID));
}

/** "30 Seconds to Mars · 2010-06-05 · Rock am Ring": the tab title's words. */
export function showTitle(show: Show): string {
  return [show.Artist, dateName(show), show.EventOrFestival || show.VenueName].filter(Boolean).join(' · ');
}

/** "Rock am Ring · Nürburgring · Nürburg, Germany. HD 1080 · 44 min · Pro-shot." */
export function showDescription(show: Show): string {
  const venue = show.VenueName && show.VenueName !== show.EventOrFestival && show.VenueName !== show.City ? show.VenueName : '';
  const place = [show.EventOrFestival, venue, [show.City, show.Country].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
  const kind = show.ContentType === 'Documentary' ? 'Documentary' : show.ParentShowID ? 'Excerpt' : '';
  const specs = [quality(show)?.label, lengthName(show.DurationSec), sourceName(show.RecordingType), kind].filter(Boolean).join(' · ');
  return [place && `${place}.`, specs && `${specs}.`].filter(Boolean).join(' ') || 'A concert video in The Vault.';
}

interface Still { url: string; width?: number; height?: number }

/** Slot 1, as the cards show it; the site's own picture when a show has none. */
async function stillOf(root: string, site: string, show: Show, manifest: Record<string, number[]>): Promise<Still | null> {
  const checksum = show.ChecksumSHA1;
  if (!checksum || !manifest[checksum]?.includes(1)) return null;
  const file = join(root, 'public/images', `${checksum}_01.jpg`);
  if (!existsSync(file)) return null;
  const { width, height } = await sharp(file).metadata();
  return { url: `${site}images/${checksum}_01.jpg`, width, height };
}

export function showPage(show: Show, site: string, still: Still | null): string {
  const title = showTitle(show);
  const description = showDescription(show);
  const page = `${site}${SHOW_DIR}/${show.ShowID}/`;
  const app = `../../?show=${show.ShowID}`;
  const image = still
    ? [
        `<meta property="og:image" content="${esc(still.url)}">`,
        still.width ? `<meta property="og:image:width" content="${still.width}">` : '',
        still.height ? `<meta property="og:image:height" content="${still.height}">` : '',
        `<meta property="og:image:alt" content="${esc(`${show.Artist}, ${dateName(show)}`)}">`,
      ].filter(Boolean).join('\n')
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — The Vault</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="noindex">
<link rel="canonical" href="${esc(page)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="The Vault">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(page)}">
${image}
<meta name="twitter:card" content="${still ? 'summary_large_image' : 'summary'}">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#141414;color:#d1d5db;font:16px/1.5 system-ui,sans-serif}a{color:#fff}</style>
<script>location.replace(${JSON.stringify(app)} + location.hash);</script>
</head>
<body><p><a href="${esc(app)}">${esc(title)}</a></p></body>
</html>
`;
}

/** For any missing path: an old show link opens in the site, anything else at home. */
export function notFoundPage(base: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<title>The Vault</title>
<style>body{margin:0;min-height:100vh;background:#141414}</style>
<script>
var m = location.pathname.match(/\\/${SHOW_DIR}\\/([0-9a-f]{12})\\/?$/);
location.replace(${JSON.stringify(base)} + (m ? '?show=' + m[1] : ''));
</script>
</head>
<body></body>
</html>
`;
}

/** One page for one show, or null when it is not a visible record. */
export async function showPageFor(root: string, showId: string): Promise<string | null> {
  const show = visibleShows(root).find(s => s.ShowID === showId);
  if (!show) return null;
  const manifest = JSON.parse(readFileSync(join(root, 'public/image-manifest.json'), 'utf8'));
  return showPage(show, siteUrl(root), await stillOf(root, siteUrl(root), show, manifest));
}

/** Every page, keyed by its path under the site: "show/<ShowID>/index.html". */
export async function buildShowPages(root: string): Promise<Map<string, string>> {
  const site = siteUrl(root);
  const manifest = JSON.parse(readFileSync(join(root, 'public/image-manifest.json'), 'utf8'));
  const pages = new Map<string, string>();
  const shows = visibleShows(root);
  // A few at a time: sharp reads only each image's header.
  for (let i = 0; i < shows.length; i += 32) {
    const batch = shows.slice(i, i + 32);
    const stills = await Promise.all(batch.map(show => stillOf(root, site, show, manifest)));
    batch.forEach((show, j) => pages.set(`${SHOW_DIR}/${show.ShowID}/index.html`, showPage(show, site, stills[j])));
  }
  return pages;
}

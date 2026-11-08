// The five phone scenarios, run against the live site.
import { launch, close, newPhone, BASE, settle, shot, scrollTo, scrollBy, wait, LOG, saveLog, DEVICES } from './lib.mjs';

const only = process.argv[2]; // e.g. "S2" to run one
const S = {};

const search = p => p.locator('input[type=search]');
const tab = (p, name) => p.locator('nav[aria-label="Main"] button', { hasText: name });
const trigger = (p, re) => p.getByRole('button', { name: re }).first();
const dialog = p => p.locator('[role=dialog]');

async function type(page, text) {
  const f = search(page);
  await f.fill('');
  await f.pressSequentially(text, { delay: 35 });
  await settle(page, 700);
}
async function sections(page) {
  return page.evaluate(() => {
    const y = el => el ? Math.round(el.getBoundingClientRect().top + scrollY) : null;
    const featured = [...document.querySelectorAll('h2, h3')].find(h => /featured/i.test(h.textContent));
    const all = document.getElementById('all-artists');
    const letters = {};
    for (const s of document.querySelectorAll('section[aria-label]')) if (/^[A-Z#0-9]$/.test(s.getAttribute('aria-label'))) letters[s.getAttribute('aria-label')] = y(s);
    const pj = [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Pearl Jam'));
    return { featured: y(featured), allArtists: y(all), letters, pearlJam: y(pj), docH: document.documentElement.scrollHeight, vh: innerHeight };
  });
}
async function drawerScroll(page, dy) {
  await page.evaluate(dy => {
    const d = document.querySelector('[role=dialog]');
    const sc = [d, ...d.querySelectorAll('*')].find(el => el.scrollHeight > el.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowY));
    (sc || d).scrollBy(0, dy);
  }, dy);
  await wait(600);
}
async function drawerScrollToText(page, text) {
  await page.evaluate(text => {
    const d = document.querySelector('[role=dialog]');
    const el = [...d.querySelectorAll('h2,h3,h4,p,span,button,div')].find(e => e.childElementCount < 4 && e.textContent.includes(text));
    el?.scrollIntoView({ block: 'start' });
  }, text);
  await wait(700);
}

// ───────────────────────── S1 Henk: first tap from Karl's email ─────────────────────────
S.S1 = async () => {
  for (const dev of ['iphone', 'se', 'android', 'promax', 'zoom125', 'land']) {
    const { ctx, page } = await newPhone(dev);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await settle(page, 1600);
    await shot(page, 'S1', 'first-screen', { title: `First screen — ${DEVICES[dev].label}` });
    if (dev === 'iphone') {
      const sec = await sections(page);
      LOG.push({ scenario: 'S1', kind: 'sections', device: dev, ...sec });
      await scrollBy(page, 664);
      await shot(page, 'S1', 'scroll-1', { title: 'One swipe down: Featured, one card at a time' });
      await scrollTo(page, sec.allArtists - 140);
      await shot(page, 'S1', 'all-artists', { title: `"All artists" — ${Math.round(sec.allArtists / 664 * 10) / 10} screens down` });
      await scrollTo(page, 0);
      // The filter row, scrolled to show More filters
      await page.evaluate(() => { const row = document.querySelector('[data-filter-bar] .overflow-x-auto'); row.scrollLeft = 400; });
      await wait(300);
      await shot(page, 'S1', 'filter-row-scrolled', { title: 'Filter row swiped sideways to reach More filters' });
      await trigger(page, /^More filters/).tap();
      await wait(600);
      await shot(page, 'S1', 'more-filters', { title: 'More filters, as it opens' });
      // Scroll inside the popover to find "New"
      await page.evaluate(() => { const g = document.querySelector('[data-side] .overflow-y-auto') || [...document.querySelectorAll('.overflow-y-auto')].pop(); g.scrollTop = 9999; });
      await wait(400);
      await shot(page, 'S1', 'more-filters-bottom', { title: 'Scrolled inside the popover: "Added → New" is last' });
      await page.getByRole('button', { name: /^New/ }).last().tap();
      await wait(800);
      await shot(page, 'S1', 'new-selected', { title: 'New ticked' });
      await page.keyboard.press('Escape');
      await settle(page, 800);
      await shot(page, 'S1', 'new-results', { title: 'The new shows' });
      await scrollBy(page, 500);
      await shot(page, 'S1', 'new-results-scrolled', { title: 'Scrolling the new shows' });
    }
    if (dev === 'zoom125') {
      await type(page, 'pinkpop');
      await page.evaluate(() => document.activeElement.blur());
      await wait(400);
      await shot(page, 'S1', 'zoom-results', { title: 'Text at 125%: results for "pinkpop"' });
      await page.locator('button[id^="show-"]').first().tap();
      await wait(1100);
      await shot(page, 'S1', 'zoom-drawer', { title: 'Text at 125%: a show' });
    }
    if (dev === 'land') {
      await type(page, 'pinkpop');
      await page.evaluate(() => document.activeElement.blur());
      await wait(400);
      await shot(page, 'S1', 'land-results', { title: 'Landscape: results' });
    }
    await ctx.close();
  }
};

// ───────────────────────── S2 Rafael: "anyone got…?" from a chat ─────────────────────────
S.S2 = async () => {
  const { ctx, page } = await newPhone('android');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await settle(page, 1500);
  await tab(page, 'Search').tap();
  await wait(500);
  await shot(page, 'S2', 'search-tab', { title: 'Taps the Search tab: field focused, keyboard up', keyboard: true });
  await search(page).pressSequentially('brasil', { delay: 40 });
  await settle(page, 800);
  await shot(page, 'S2', 'brasil-keyboard', { title: '"brasil" — what shows above the keyboard', keyboard: true });
  await page.evaluate(() => document.activeElement.blur());
  await wait(400);
  await shot(page, 'S2', 'brasil', { title: '"brasil" — keyboard down' });
  await scrollBy(page, 600);
  await shot(page, 'S2', 'brasil-scrolled', { title: '"brasil" — one swipe down' });
  await scrollTo(page, 0);
  await search(page).tap();
  await type(page, 'foo fighters rock in rio');
  await shot(page, 'S2', 'foo-rir-keyboard', { title: '"foo fighters rock in rio" — above the keyboard', keyboard: true });
  await page.evaluate(() => document.activeElement.blur());
  await wait(400);
  await shot(page, 'S2', 'foo-rir', { title: '"foo fighters rock in rio" — one result' });
  await page.locator('button[id^="show-"]').first().tap();
  await wait(1200);
  await shot(page, 'S2', 'drawer-top', { title: 'The show opens: first screen' });
  await drawerScroll(page, 330);
  await shot(page, 'S2', 'drawer-scroll-1', { title: 'One swipe into the show' });
  await drawerScrollToText(page, 'Technical details');
  await shot(page, 'S2', 'drawer-tech-closed', { title: 'Technical details, folded' });
  await page.getByRole('button', { name: /Technical details/ }).tap();
  await wait(600);
  await shot(page, 'S2', 'drawer-tech-open', { title: 'Technical details, open' });
  await page.goBack();
  await wait(1000);
  await shot(page, 'S2', 'back-gesture', { title: 'Android back: the show closes, results stay' });
  // A trader's abbreviation and a second copy
  await search(page).tap();
  await type(page, 'ratm swu');
  await page.evaluate(() => document.activeElement.blur());
  await wait(400);
  await shot(page, 'S2', 'ratm-swu', { title: '"ratm swu" — two copies' });
  await search(page).tap();
  await type(page, 'multishow');
  await page.evaluate(() => document.activeElement.blur());
  await wait(400);
  await shot(page, 'S2', 'multishow', { title: '"multishow" — by broadcaster' });
  await search(page).tap();
  await type(page, '24.05.96');
  await page.evaluate(() => document.activeElement.blur());
  await wait(400);
  await shot(page, 'S2', 'date', { title: '"24.05.96" — a date as traders type it' });
  // Back after several searches: where does it go?
  const before = page.url();
  const r = await page.goBack().catch(() => null);
  await wait(800);
  LOG.push({ scenario: 'S2', kind: 'back-after-searches', before, after: page.url(), left: !page.url().includes('karl0s') });
  await ctx.close();
};

// ───────────────────────── S3 Mel: a link arrives ─────────────────────────
S.S3 = async () => {
  const { ctx, page } = await newPhone('iphone');
  // The link the friend pasted: the show's own page
  await page.goto(BASE + 'show/7c860a05fcce/', { waitUntil: 'domcontentloaded' });
  await settle(page, 1800);
  await shot(page, 'S3', 'link-lands', { title: 'Taps the link: the show opens' });
  await drawerScroll(page, 300);
  await shot(page, 'S3', 'drawer-scroll-1', { title: 'One swipe: stills and the copies' });
  await drawerScrollToText(page, 'recordings of this show');
  await shot(page, 'S3', 'copies', { title: '"2 recordings of this show" at phone width' });
  // Open the other copy
  const other = page.locator('[role=dialog] button', { hasText: /1h 10m|70 min/ }).first();
  if (await other.count()) { await other.tap(); } else { await page.locator('[role=dialog] section button').first().tap(); }
  await wait(1000);
  await shot(page, 'S3', 'other-copy', { title: 'Taps the other copy: the show swaps' });
  await drawerScrollToText(page, 'recordings of this show');
  await shot(page, 'S3', 'other-copy-copies', { title: 'The copies list, from the other copy' });
  // Stills viewer
  await drawerScroll(page, -5000);
  await drawerScrollToText(page, 'Screenshots');
  await shot(page, 'S3', 'stills-strip', { title: 'The stills strip' });
  await page.locator('[role=dialog] img[alt^="Screenshot"]').first().tap();
  await wait(900);
  await shot(page, 'S3', 'viewer', { title: 'A still opened' });
  await page.getByRole('button', { name: 'Next image' }).tap();
  await wait(700);
  await shot(page, 'S3', 'viewer-next', { title: 'Next still' });
  await page.getByRole('button', { name: 'Back to the show' }).tap();
  await wait(800);
  // Share
  await drawerScroll(page, -5000);
  await wait(300);
  await shot(page, 'S3', 'share-visible', { title: 'Back at the top: the Share pill' });
  await page.getByRole('button', { name: /^(Share|Copy link)/ }).first().tap();
  await wait(600);
  const shared = await page.evaluate(() => window.__shared);
  LOG.push({ scenario: 'S3', kind: 'shared', shared });
  // Close and Back
  await page.getByRole('button', { name: /close/i }).first().tap();
  await wait(1000);
  await shot(page, 'S3', 'closed', { title: 'Closes the show (×): where she lands' });
  const r = await page.goBack().catch(() => null);
  await wait(800);
  LOG.push({ scenario: 'S3', kind: 'back-after-close', after: page.url() });
  // Docked header on a long show
  await page.goto(BASE + '?show=8349e6f453e8', { waitUntil: 'domcontentloaded' });
  await settle(page, 1500);
  await drawerScroll(page, 900);
  await shot(page, 'S3', 'docked', { title: 'Deep in the show: the docked header' });
  await ctx.close();
};

// ───────────────────────── S4 Dale: an artist run, back and forth ─────────────────────────
S.S4 = async () => {
  for (const dev of ['iphone', 'promax', 'se']) {
    const { ctx, page } = await newPhone(dev);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await settle(page, 1500);
    await tab(page, 'Artists').tap();
    await wait(1200);
    await shot(page, 'S4', 'artists-tab', { title: 'Taps Artists' });
    const sec = await sections(page);
    if (dev === 'iphone') LOG.push({ scenario: 'S4', kind: 'sections', device: dev, ...sec });
    await scrollTo(page, sec.pearlJam - 300);
    await shot(page, 'S4', 'scrolled-to-p', { title: `Scrolls to P — Pearl Jam is ${Math.round((sec.pearlJam - sec.allArtists) / sec.vh * 10) / 10} screens into the list` });
    await page.locator('button', { hasText: /^Pearl Jam\s*\d+$/ }).first().tap();
    await wait(1300);
    await shot(page, 'S4', 'pearl-jam', { title: 'Pearl Jam: first screen' });
    const art = await page.evaluate(() => ({ docH: document.documentElement.scrollHeight }));
    LOG.push({ scenario: 'S4', kind: 'artist-page', device: dev, ...art });
    await scrollBy(page, 664);
    await shot(page, 'S4', 'pearl-jam-scroll-1', { title: 'One swipe down' });
    if (dev !== 'iphone') { await ctx.close(); continue; }
    await scrollBy(page, 1400);
    const yBefore = await page.evaluate(() => scrollY);
    await shot(page, 'S4', 'pearl-jam-deeper', { title: 'Three swipes down' });
    // Open a card in view, then Back
    const card = await page.evaluate(() => {
      const c = [...document.querySelectorAll('button[id^="show-"]')].find(b => { const r = b.getBoundingClientRect(); return r.top > 150 && r.bottom < innerHeight - 60; });
      return c?.id;
    });
    await page.locator('#' + card).tap();
    await wait(1200);
    await shot(page, 'S4', 'card-open', { title: 'Opens a show' });
    await page.goBack();
    await wait(1000);
    const yAfter = await page.evaluate(() => scrollY);
    LOG.push({ scenario: 'S4', kind: 'scroll-restore', yBefore, yAfter });
    await shot(page, 'S4', 'back-from-show', { title: `Back: same place in the list (${yBefore} → ${yAfter})` });
    // List layout
    await scrollTo(page, 0);
    await page.getByRole('button', { name: 'List' }).tap();
    await wait(900);
    await shot(page, 'S4', 'list', { title: 'List layout: first screen' });
    await scrollBy(page, 664);
    await shot(page, 'S4', 'list-scroll-1', { title: 'List layout: one swipe down' });
    await page.getByRole('button', { name: 'Grid' }).tap();
    await wait(600);
    await scrollTo(page, 0);
    // Back to all artists — where in the list?
    await page.getByRole('button', { name: 'All artists' }).first().tap();
    await wait(1200);
    const sec2 = await sections(page);
    const y = await page.evaluate(() => scrollY);
    LOG.push({ scenario: 'S4', kind: 'all-artists-return', y, pearlJam: sec2.pearlJam, allArtists: sec2.allArtists });
    await shot(page, 'S4', 'all-artists-return', { title: '"All artists": back to the top of the list, not to P' });
    // History: Back from the artist list after artist → search
    await page.locator('button', { hasText: /^Soundgarden\s*\d+$/ }).first().tap();
    await wait(1100);
    await shot(page, 'S4', 'soundgarden', { title: 'Another artist: Soundgarden' });
    await tab(page, 'Search').tap();
    await wait(400);
    await shot(page, 'S4', 'search-tab-from-artist', { title: 'Search tab from an artist page', keyboard: true });
    await type(page, 'pearl jam pinkpop');
    await page.evaluate(() => document.activeElement.blur());
    await wait(400);
    await shot(page, 'S4', 'search-pj-pinkpop', { title: '"pearl jam pinkpop"' });
    const urlBefore = page.url();
    await page.goBack().catch(() => null);
    await wait(1000);
    LOG.push({ scenario: 'S4', kind: 'back-after-search', before: urlBefore, after: page.url() });
    await ctx.close();
  }
};

// ───────────────────────── S5 Jürgen: dig a series with filters ─────────────────────────
S.S5 = async () => {
  const { ctx, page } = await newPhone('iphone');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await settle(page, 1500);
  await trigger(page, /^Event/).tap();
  await wait(700);
  await shot(page, 'S5', 'event-open', { title: 'Taps Event' });
  await page.locator('input[aria-label="Filter Event options"]').tap();
  await page.locator('input[aria-label="Filter Event options"]').pressSequentially('rock', { delay: 40 });
  await wait(500);
  await shot(page, 'S5', 'event-typed', { title: 'Types "rock" in the Event list', keyboard: true });
  await page.getByRole('button', { name: /^Rock am Ring/ }).first().tap();
  await wait(500);
  await page.locator('input[aria-label="Filter Event options"]').fill('');
  await page.locator('input[aria-label="Filter Event options"]').pressSequentially('rockp', { delay: 40 });
  await wait(400);
  await page.getByRole('button', { name: /^Rockpalast/ }).first().tap();
  await wait(500);
  await shot(page, 'S5', 'event-two-ticked', { title: 'Two events ticked' });
  await page.keyboard.press('Escape');
  await settle(page, 900);
  await shot(page, 'S5', 'event-results', { title: 'Rock am Ring + Rockpalast: results' });
  // Years
  await trigger(page, /^Years/).tap();
  await wait(700);
  await shot(page, 'S5', 'years-open', { title: 'Taps Years' });
  // Brush 1995–2005 by touch-like pointer drag on the histogram
  const box = await page.evaluate(() => {
    const h = document.querySelector('[role=slider], svg[aria-label], [aria-label*="ear"]');
    const svg = [...document.querySelectorAll('svg')].sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
    const r = svg.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  LOG.push({ scenario: 'S5', kind: 'histogram-box', box });
  const from = page.locator('input[placeholder]').filter({ hasNot: page.locator('[type=search]') });
  const inputs = page.locator('[data-side] input, [role=dialog] input').filter({ hasNotText: '' });
  try {
    const yi = page.locator('input[inputmode="numeric"], input[type="number"]');
    if (await yi.count() >= 2) {
      await yi.nth(0).tap(); await yi.nth(0).fill('1995'); await yi.nth(0).press('Enter');
      await yi.nth(1).tap(); await yi.nth(1).fill('2005'); await yi.nth(1).press('Enter');
      await wait(600);
      await shot(page, 'S5', 'years-typed', { title: 'Types 1995 to 2005', keyboard: true });
    }
  } catch (e) { LOG.push({ scenario: 'S5', kind: 'error', step: 'years', e: String(e) }); }
  await page.keyboard.press('Escape');
  await settle(page, 900);
  await shot(page, 'S5', 'years-results', { title: 'With years set: chips and results' });
  // More filters: Pro-shot, SD
  await page.evaluate(() => { const row = document.querySelector('[data-filter-bar] .overflow-x-auto'); row.scrollLeft = 400; });
  await trigger(page, /^More filters/).tap();
  await wait(700);
  await shot(page, 'S5', 'more-open', { title: 'More filters' });
  await page.getByRole('button', { name: /^Pro-shot/ }).first().tap();
  await wait(500);
  await shot(page, 'S5', 'more-proshot', { title: 'Pro-shot ticked' });
  await page.keyboard.press('Escape');
  await settle(page, 900);
  await shot(page, 'S5', 'all-filters', { title: 'Four filters on: how much screen is left' });
  await scrollBy(page, 500);
  await shot(page, 'S5', 'all-filters-scrolled', { title: 'Scrolling down: the bar folds its results row' });
  await scrollBy(page, -200);
  await shot(page, 'S5', 'all-filters-up', { title: 'A little back up: the row returns' });
  // Sort oldest first
  await scrollTo(page, 0);
  await page.locator('select').selectOption('year-asc');
  await settle(page, 700);
  await shot(page, 'S5', 'sorted', { title: 'Sorted oldest first' });
  // New search with filters still on
  await search(page).tap();
  await type(page, 'faith no more');
  await page.evaluate(() => document.activeElement.blur());
  await wait(500);
  await shot(page, 'S5', 'fnm-with-filters', { title: '"faith no more" with the filters still on' });
  await scrollBy(page, 300);
  await shot(page, 'S5', 'fnm-with-filters-2', { title: '…scrolled' });
  // Clear all
  await scrollTo(page, 0);
  await page.getByRole('button', { name: 'Clear all' }).first().tap().catch(() => {});
  await settle(page, 800);
  await shot(page, 'S5', 'cleared', { title: 'Clear all' });
  await ctx.close();
};

await launch();
const prev = (await import('./lib.mjs')).loadLog();
const runs = only ? [only] : Object.keys(S);
for (const k of runs) {
  console.log('==', k);
  try { await S[k](); } catch (e) { console.log('ERROR in', k, e.message.split('\n')[0]); LOG.push({ scenario: k, kind: 'error', e: e.message.split('\n')[0] }); }
}
const keep = prev.filter(e => !runs.includes(e.scenario));
saveLog([...keep, ...LOG]);
await close();

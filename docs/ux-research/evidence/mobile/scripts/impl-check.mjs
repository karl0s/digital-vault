// Checks the mobile-audit branch on a local server: BASE=http://localhost:5198/digital-vault/ node impl-check.mjs [part]
import { launch, close, newPhone, BASE, settle, wait, measure, showKeyboard, SHOTS } from './lib.mjs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const only = process.argv[2];
const R = {};
const log = (k, v) => { R[k] = v; console.log(k.padEnd(34), typeof v === 'object' ? JSON.stringify(v) : v); };
const snap = (page, name) => page.screenshot({ path: join(SHOTS, `impl-${name}-${page.__device}.jpg`), type: 'jpeg', quality: 82 });
const search = p => p.locator('input[type=search]');
const y = p => p.evaluate(() => Math.round(scrollY));

const P = {};

P.landing = async () => {
  for (const dev of ['iphone', 'android', 'se', 'zoom125']) {
    const { page, ctx } = await newPhone(dev);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await settle(page, 1500);
    const m = await measure(page);
    const mast = await page.evaluate(() => Math.round(document.querySelector('[data-filter-bar]').getBoundingClientRect().top));
    const pills = await page.evaluate(() => [...document.querySelectorAll('[data-results-row] button')].map(b => b.textContent.trim()));
    log(`landing.${dev}`, { cards: m.cards, barH: m.barH, mastheadH: mast, pills, overflowX: m.overflowX, small: m.smallTargets.filter(s => s.h < 44).map(s => `${s.name}:${s.h}`) });
    await snap(page, 'landing');
    await ctx.close();
  }
  const { page, ctx } = await newPhone('land');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await settle(page, 1500);
  const m = await measure(page);
  log('landing.landscape', { cards: m.cards, barTop: await page.evaluate(() => Math.round(document.querySelector('[data-filter-bar]').getBoundingClientRect().top)) });
  await snap(page, 'landing');
  await ctx.close();
};

P.az = async () => {
  const { page, ctx } = await newPhone('iphone');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await settle(page, 1500);
  await page.locator('nav[aria-label="Main"] button', { hasText: 'Artists' }).tap(); await wait(2200);
  const idx = await page.evaluate(() => { const n = document.querySelector('nav[aria-label="Jump to a letter"]'); const r = n.getBoundingClientRect(); return { visible: getComputedStyle(n).visibility, top: Math.round(r.top), bottom: Math.round(r.bottom), letters: n.querySelectorAll('button').length }; });
  log('az.index', idx);
  await snap(page, 'az-list');
  // Tap P on the index
  const p = await page.evaluate(() => { const b = document.querySelector('[data-index-letter="P"]').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await page.touchscreen.tap(p.x, p.y); await wait(700);
  const pTop = await page.evaluate(() => { const s = document.querySelector('section[data-letter="P"]').getBoundingClientRect().top; const bar = document.querySelector('[data-filter-bar]').getBoundingClientRect().bottom; return { sectionTop: Math.round(s), barBottom: Math.round(bar) }; });
  log('az.jumpP', pTop);
  await snap(page, 'az-P');
  const atList = await y(page);
  // Pearl Jam
  const pj = page.locator('button', { hasText: /^Pearl Jam\s*\d+$/ }).first();
  await pj.scrollIntoViewIfNeeded(); await wait(400);
  const beforeTap = await y(page);
  await pj.tap(); await wait(1500);
  const afterTap = await measure(page);
  log('az.R1.artistOpensAtTop', { beforeTap, scrollY: afterTap.scrollY, cards: afterTap.cards, docH: afterTap.docH, url: afterTap.url });
  await snap(page, 'artist-PJ');
  // All artists returns to the place
  const back = page.locator('button', { hasText: 'All artists' }).first();
  await back.tap(); await wait(1500);
  log('az.R6.allArtistsReturns', { wanted: beforeTap, got: await y(page) });
  // Pearl Jam again, then the browser's Back
  await pj.tap(); await wait(1500);
  await page.goBack(); await wait(1500);
  log('az.R5.backToList', { wanted: beforeTap, got: await y(page), url: page.url().replace(BASE, '/') });
  await page.goBack(); await wait(1500);
  log('az.R5.backAgain', { y: await y(page), url: page.url().replace(BASE, '/') });
  await ctx.close();
};

P.back = async () => {
  const { page, ctx } = await newPhone('android');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await settle(page, 1400);
  await search(page).tap(); await search(page).pressSequentially('ratm swu', { delay: 40 }); await wait(900);
  const m = await measure(page);
  log('R3.ratmSwu', { cards: m.cards, url: m.url });
  await snap(page, 'ratm-swu');
  await page.keyboard.press('Enter'); await wait(300);
  log('R4.enterBlurs', await page.evaluate(() => document.activeElement?.tagName));
  await search(page).fill('fnm bizarre 97'); await wait(900);
  log('R3.fnm', (await measure(page)).cards);
  await page.goBack(); await wait(1200);
  log('R5.back1', { q: await search(page).inputValue(), url: page.url().replace(BASE, '/') });
  await page.goBack(); await wait(1200);
  log('R5.back2', { q: await search(page).inputValue(), url: page.url().replace(BASE, '/') });
  await page.goBack(); await wait(800);
  log('R5.back3', page.url());
  await ctx.close();
};

P.keyboard = async () => {
  const { page, ctx } = await newPhone('android');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await settle(page, 1400);
  await search(page).tap(); await search(page).pressSequentially('brasil', { delay: 30 }); await settle(page, 900);
  await showKeyboard(page, true);
  const vis = await page.evaluate(() => { const kb = innerHeight - 300; return [...document.querySelectorAll('button[id^="show-"]')].filter(c => { const b = c.getBoundingClientRect(); return b.top >= 0 && b.bottom <= kb; }).length; });
  log('R4.cardsAboveKeyboard', vis);
  await snap(page, 'keyboard');
  await ctx.close();
};

P.bar = async () => {
  for (const dev of ['android', 'se']) {
    const b = await newPhone(dev);
    await b.page.goto(BASE + '?from=1995&to=2005&festival=rock-am-ring,rockpalast&source=proshot&sort=added', { waitUntil: 'domcontentloaded' }); await settle(b.page, 1500);
    log(`R7.row.${dev}`, await b.page.evaluate(() => [...document.querySelector('[data-results-row]').querySelectorAll('button,p,label')].map(e => `${e.textContent.trim()}:${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`)));
    await snap(b.page, 'bar');
    await b.ctx.close();
  }
  const { page, ctx } = await newPhone('iphone');
  await page.goto(BASE + '?from=1995&to=2005&festival=rock-am-ring,rockpalast&source=proshot', { waitUntil: 'domcontentloaded' }); await settle(page, 1600);
  const m = await measure(page);
  log('R7.bar', { barH: m.barH, tab: m.tabH, cards: m.cards, row: await page.evaluate(() => document.querySelector('[data-results-row]').textContent.replace(/\s+/g, ' ').trim()) });
  await snap(page, 'bar');
  await page.locator('[data-results-row] button', { hasText: 'Filters' }).tap(); await wait(800);
  const sheet = await page.evaluate(() => { const d = document.querySelector('[role=dialog]'); const r = d.getBoundingClientRect(); const chips = [...d.querySelectorAll('button')].map(b => Math.round(b.getBoundingClientRect().height)).filter(h => h > 0); return { top: Math.round(r.top), h: Math.round(r.height), minChip: Math.min(...chips), title: d.querySelector('h2')?.textContent, foot: [...d.querySelectorAll('button')].pop().textContent }; });
  log('R8.sheet', sheet);
  await snap(page, 'sheet');
  await page.locator('[role=dialog] button', { hasText: /^Add another/ }).first().tap(); await wait(400);
  await snap(page, 'sheet-events');
  await page.locator('[role=dialog] button', { hasText: /^Show|^No shows/ }).last().tap(); await wait(700);
  log('R8.closed', { dialog: (await measure(page)).dialog, url: page.url().replace(BASE, '/') });
  // R13 on the landing
  await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await settle(page, 1400);
  await page.locator('[data-results-row] button', { hasText: /^New/ }).tap(); await wait(900);
  const n = await measure(page);
  log('R13.new', { url: n.url, cards: n.cards });
  await snap(page, 'new');
  await ctx.close();
};

P.tiles = async () => {
  for (const dev of ['iphone', 'android', 'zoom125', 'promax']) {
    const { page, ctx } = await newPhone(dev);
    await page.goto(BASE + '?q=pearl%20jam', { waitUntil: 'domcontentloaded' }); await settle(page, 1500);
    const m = await measure(page);
    log(`R2.pearljam.${dev}`, { cards: m.cards, cardSize: m.cardSize, docH: m.docH, screens: +(m.docH / m.vh).toFixed(1) });
    await snap(page, 'pearljam');
    await ctx.close();
  }
};

P.drawer = async () => {
  for (const dev of ['iphone']) {
    const { page, ctx } = await newPhone(dev);
    await page.goto(BASE + '?q=pearl%20jam', { waitUntil: 'domcontentloaded' }); await settle(page, 1500);
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' })); await wait(500);
    const before = await y(page);
    const card = await page.evaluate(() => { const c = [...document.querySelectorAll('button[id^="show-"]')].find(b => { const r = b.getBoundingClientRect(); return r.top > 200 && r.bottom < 500; }); const r = c.getBoundingClientRect(); return { x: r.left + 20, y: r.top + 20 }; });
    await page.touchscreen.tap(card.x, card.y); await wait(1200);
    await page.locator('[role=dialog] button[aria-label="Close"]').first().tap(); await wait(1200);
    log('drawer.closeX.keepsPlace', { before, after: await y(page), url: page.url().replace(BASE, '/') });
    await page.touchscreen.tap(card.x, card.y); await wait(1200);
    await page.goBack(); await wait(1200);
    log('drawer.back.keepsPlace', { before, after: await y(page), dialog: (await measure(page)).dialog });
    await page.goBack(); await wait(1200);
    log('drawer.back2.toLanding', { y: await y(page), url: page.url() });
    await ctx.close();
  }
};

P.link = async () => {
  const { page, ctx } = await newPhone('iphone');
  await page.goto(BASE + '?q=pearl%20jam', { waitUntil: 'domcontentloaded' }); await settle(page, 1500);
  log('link.historyLength', await page.evaluate(() => [history.length, location.search, document.querySelector('input[type=search]').value]));
  await ctx.close();
};

P.desktop = async () => {
  const browser = await chromium.launch({ executablePath: (await import('node:os')).homedir() + '/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-x64/chrome-headless-shell' });
  for (const [name, base] of [['live', 'https://karl0s.github.io/digital-vault/'], ['branch', BASE]]) {
    for (const [route, label] of [['', 'landing'], ['?q=pearl%20jam', 'artist'], ['?from=1995&to=2005&festival=rock-am-ring,rockpalast&source=proshot', 'filters']]) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
      const page = await ctx.newPage(); page.__device = `desktop-${name}`;
      await page.goto(base + route, { waitUntil: 'domcontentloaded' }); await settle(page, 1600);
      const m = await page.evaluate(() => {
        const bar = document.querySelector('[data-filter-bar]').getBoundingClientRect();
        const cards = [...document.querySelectorAll('button[id^="show-"]')];
        const c = cards[0]?.getBoundingClientRect();
        const h2 = [...document.querySelectorAll('h2')].find(h => h.textContent.startsWith('“'));
        return { barTop: Math.round(bar.top), barH: Math.round(bar.height), card: c ? [Math.round(c.left), Math.round(c.top), Math.round(c.width)] : null, cols: new Set(cards.slice(0, 12).map(b => Math.round(b.getBoundingClientRect().left))).size, h2: h2 ? Math.round(h2.getBoundingClientRect().top) : null, docH: document.documentElement.scrollHeight, pills: [...document.querySelectorAll('[data-filter-bar] button')].filter(b => b.offsetParent).map(b => b.textContent.trim()).slice(0, 12) };
      });
      log(`desktop.${label}.${name}`, m);
      await page.screenshot({ path: join(SHOTS, `impl-desktop-${label}-${name}.jpg`), type: 'jpeg', quality: 80 });
      await ctx.close();
    }
  }
  await browser.close();
};

await launch();
for (const k of only ? only.split(',') : Object.keys(P)) {
  console.log('==', k);
  try { await P[k](); } catch (e) { console.log('ERROR', k, e.message.split('\n')[0]); }
}
await close();

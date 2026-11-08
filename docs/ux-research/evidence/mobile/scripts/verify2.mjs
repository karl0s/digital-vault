import { launch, close, newPhone, BASE, settle, wait, OUT } from './lib.mjs';
import { writeFileSync } from 'node:fs';
await launch();
const out = {};
// 1. More filters popup vs screen, iPhone and SE, on landing and with a search
for (const dev of ['iphone', 'se', 'android']) {
  const { page, ctx } = await newPhone(dev);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await settle(page, 1300);
  await page.evaluate(() => { document.querySelector('[data-filter-bar] .overflow-x-auto').scrollLeft = 400; });
  await page.getByRole('button', { name: /^More filters/ }).first().tap(); await wait(700);
  out['more_' + dev] = await page.evaluate(() => {
    const pop = [...document.querySelectorAll('[data-side]')].pop() || document.querySelector('.max-h-\\[min\\(36rem\\,70dvh\\)\\]');
    const r = pop.getBoundingClientRect(); const inner = pop.querySelector('.overflow-y-auto') || pop;
    const newBtn = [...pop.querySelectorAll('button')].find(b => /^New/.test(b.textContent.trim()));
    const nb = newBtn?.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, offBottom: Math.round(r.bottom - innerHeight), innerScroll: inner.scrollHeight - inner.clientHeight, newTop: nb && Math.round(nb.top), newBottom: nb && Math.round(nb.bottom) };
  });
  // scroll the popover's list fully, then where is New?
  await page.evaluate(() => { const pop = [...document.querySelectorAll('[data-side]')].pop(); (pop.querySelector('.overflow-y-auto') || pop).scrollTop = 99999; });
  await wait(300);
  out['more_' + dev].afterInnerScroll = await page.evaluate(() => { const pop = [...document.querySelectorAll('[data-side]')].pop(); const nb = [...pop.querySelectorAll('button')].find(b => /^New/.test(b.textContent.trim())).getBoundingClientRect(); return { newTop: Math.round(nb.top), newBottom: Math.round(nb.bottom), vh: innerHeight, tabTop: Math.round(document.querySelector('nav[aria-label=Main]').getBoundingClientRect().top) }; });
  await ctx.close();
}
// 2. Enter on the keyboard: does it dismiss the keyboard?
{
  const { page, ctx } = await newPhone('iphone');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await settle(page, 1300);
  await page.locator('input[type=search]').tap(); await page.locator('input[type=search]').pressSequentially('pinkpop', { delay: 30 }); await wait(600);
  await page.keyboard.press('Enter'); await wait(400);
  out.enterKeepsFocus = await page.evaluate(() => document.activeElement?.type === 'search');
  // 3. Results header cost: distance from bar bottom to first card top
  out.resultsHeader = await page.evaluate(() => { const bar = document.querySelector('[data-filter-bar]').getBoundingClientRect(); const c = document.querySelector('button[id^="show-"]').getBoundingClientRect(); return { barBottom: Math.round(bar.bottom), firstCardTop: Math.round(c.top), gap: Math.round(c.top - bar.bottom) }; });
  // 4. Docked drawer header height
  await page.locator('button[id^="show-"]').first().tap(); await wait(1200);
  await page.evaluate(() => { const d = document.querySelector('[role=dialog]'); const sc = [d, ...d.querySelectorAll('*')].find(el => el.scrollHeight > el.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)); sc.scrollTop = 1500; });
  await wait(700);
  out.dockedHeader = await page.evaluate(() => { const d = document.querySelector('[role=dialog]'); const h = d.querySelector('header') || [...d.querySelectorAll('div')].find(x => getComputedStyle(x).position === 'sticky'); const r = h.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), vh: innerHeight }; });
  await ctx.close();
}
// 5. Slow mobile data + 4x CPU: first load
for (const run of [1, 2]) {
  const { page, ctx } = await newPhone('android');
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const t0 = Date.now();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { const i = document.querySelector('button[id^="show-"] img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 60000 });
  const tCard = Date.now() - t0;
  const paint = await page.evaluate(() => Object.fromEntries(performance.getEntriesByType('paint').map(p => [p.name, Math.round(p.startTime)])));
  await page.waitForFunction(() => document.querySelector('#all-artists'), null, { timeout: 60000 });
  const bytes = await page.evaluate(() => Math.round(performance.getEntriesByType('resource').reduce((n, r) => n + (r.transferSize || 0), 0) / 1024));
  out['slow4g_' + run] = { firstCardImage: tCard, ...paint, kbTransferred: bytes };
  await ctx.close();
}
writeFileSync(OUT + '/verify.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await close();

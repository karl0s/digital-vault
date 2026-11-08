// Long and wrapping names while docking, phones only: the name must never leave the screen.
import { launch, close, newPhone, BASE, settle, wait, SHOTS } from './lib.mjs';
import { join } from 'node:path';

const IDS = ['74b693f4c5d8', 'c33ac65e0d9c', '07346400f7e5', 'c1f44828a6e8', '7c860a05fcce'];
const DEVS = ['iphone', 'android', 'se', 'zoom125'];
const scroller = `(() => { const d = document.querySelector('[role=dialog]'); return [...d.querySelectorAll('*')].find(el => el.scrollHeight > el.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)); })()`;
await launch();
for (const dev of DEVS) {
  const { page, ctx } = await newPhone(dev);
  for (const id of IDS) {
    await page.goto(BASE + '?show=' + id, { waitUntil: 'domcontentloaded' }); await settle(page, 1300);
    const rest = await page.evaluate(() => {
      const d = document.querySelector('[role=dialog]');
      const n = d.querySelector('.drawer-dock-name');
      return { nameLines: Math.round(n.getBoundingClientRect().height / parseFloat(getComputedStyle(n).fontSize)), heroH: Math.round(d.querySelector('.drawer-dock-hero').getBoundingClientRect().height) };
    });
    let minTop = 999, worst = null, lineOnAt = null;
    for (let st = 0; st <= 260; st += 6) {
      await page.evaluate(`(() => { const sc = ${scroller}; if (sc) sc.scrollTop = ${st}; })()`);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const s = await page.evaluate(`(() => { const sc = ${scroller}; if (!sc) return { p: 0, top: 999, line: false };
        const d = document.querySelector('[role=dialog]'); const dt = d.getBoundingClientRect().top;
        const n = d.querySelector('.drawer-dock-name').getBoundingClientRect();
        return { p: +getComputedStyle(d).getPropertyValue('--p'), top: n.top - dt, line: d.hasAttribute('data-dock-line') }; })()`);
      if (s.top < minTop) { minTop = s.top; worst = s; }
      if (s.line && lineOnAt === null) lineOnAt = s.p;
    }
    await page.evaluate(`(() => { const sc = ${scroller}; if (sc) sc.scrollTop = 900; })()`); await wait(300);
    const docked = await page.evaluate(() => {
      const d = document.querySelector('[role=dialog]'); const dt = d.getBoundingClientRect().top;
      const hero = d.querySelector('.drawer-dock-hero').getBoundingClientRect();
      const c = d.querySelector('.drawer-dock-close').getBoundingClientRect();
      const n = d.querySelector('.drawer-dock-name'); const date = d.querySelector('.drawer-dock-date');
      return { bar: Math.round(hero.bottom - dt), closeMid: Math.round(c.top + c.height / 2 - dt), nameW: Math.round(n.getBoundingClientRect().width), truncated: n.scrollWidth > n.clientWidth + 1, dateRight: Math.round(date.getBoundingClientRect().right), closeLeft: Math.round(c.left) };
    });
    console.log(dev, id, JSON.stringify(rest), 'minNameTop', Math.round(minTop), 'at p', worst?.p, 'lineOn p', lineOnAt, JSON.stringify(docked));
    if (dev === 'android' || dev === 'zoom125') await page.screenshot({ path: join(SHOTS, `impl-drawer-docked-${dev}-${id}.jpg`), type: 'jpeg', quality: 78 });
  }
  if (dev === 'android') {
    await page.goto(BASE + '?show=7c860a05fcce', { waitUntil: 'domcontentloaded' }); await settle(page, 1300);
    await page.evaluate(`(() => { const sc = ${scroller}; const d = document.querySelector('[role=dialog]'); const p = [...d.querySelectorAll('p')].find(p => /recordings of this show/.test(p.textContent)); sc.scrollTop += p.getBoundingClientRect().top - 200; })()`);
    await wait(400);
    await page.screenshot({ path: join(SHOTS, `impl-drawer-copies-android-fixed.jpg`), type: 'jpeg', quality: 78 });
    // Open the other copy from its block; Technical toggle opens
    const before = await page.evaluate(() => location.search);
    await page.locator('[role=dialog] ol button', { hasText: 'Open' }).first().tap(); await wait(900);
    const after = await page.evaluate(() => location.search);
    await page.locator('[role=dialog] button', { hasText: 'Technical details' }).tap(); await wait(300);
    const tech = await page.evaluate(() => document.querySelector('[role=dialog] [aria-controls^="drawer-tech-"]').getAttribute('aria-expanded'));
    console.log('open other copy', before, '->', after, 'tech expanded', tech);
  }
  await ctx.close();
}
await close();

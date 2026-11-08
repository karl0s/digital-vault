// Drawer measurements for R9 / R11 / R12: phones and desktop, against BASE.
// node drawer-measure.mjs <label> [devices...]   (label names the screenshots)
import { launch, close, newPhone, BASE, settle, wait, SHOTS } from './lib.mjs';
import { join } from 'node:path';

const label = process.argv[2] || 'run';
const devices = process.argv.slice(3).length ? process.argv.slice(3) : ['iphone', 'android', 'desktop'];
const browser = await launch();

async function open(dev) {
  if (dev === 'desktop') {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark' });
    const page = await ctx.newPage(); page.__device = 'desktop';
    return { ctx, page };
  }
  return newPhone(dev);
}

const scroller = `(() => { const d = document.querySelector('[role=dialog]'); return [...d.querySelectorAll('*')].find(el => el.scrollHeight > el.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)); })()`;
const r = el => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; };

const out = {};
for (const dev of devices) {
  const res = out[dev] = {};
  const { page, ctx } = await open(dev);

  // Copies
  await page.goto(BASE + '?show=7c860a05fcce', { waitUntil: 'domcontentloaded' }); await settle(page, 1600);
  res.copies = await page.evaluate(() => {
    const d = document.querySelector('[role=dialog]');
    const label = [...d.querySelectorAll('p')].find(p => /recordings of this show/.test(p.textContent));
    const ol = label.nextElementSibling;
    return [...ol.children].map(li => {
      const els = [...li.querySelectorAll(':scope > *')];
      const vis = els.filter(e => e.getBoundingClientRect().height > 0);
      return vis.map(e => { const b = e.getBoundingClientRect(); return { tag: e.tagName, w: Math.round(b.width), h: Math.round(b.height), text: e.innerText.replace(/\s+/g, ' ').slice(0, 140) }; });
    });
  });
  await page.evaluate(`(() => { const sc = ${scroller}; const d = document.querySelector('[role=dialog]'); const p = [...d.querySelectorAll('p')].find(p => /recordings of this show/.test(p.textContent)); sc.scrollTop += p.getBoundingClientRect().top - 200; })()`);
  await wait(500);
  await page.screenshot({ path: join(SHOTS, `impl-drawer-${label}-copies-${dev}.jpg`), type: 'jpeg', quality: 80 });

  // Docking: walk the scroll and watch the name
  await page.goto(BASE + '?show=8349e6f453e8', { waitUntil: 'domcontentloaded' }); await settle(page, 1600);
  res.rest = await page.evaluate(() => {
    const d = document.querySelector('[role=dialog]');
    const hero = d.querySelector('.drawer-dock-hero');
    const share = [...d.querySelectorAll('button')].find(b => /Share|Copy link/.test(b.textContent));
    const close = d.querySelector('.drawer-dock-close');
    const tech = [...d.querySelectorAll('button')].find(b => /Technical details/.test(b.textContent));
    const b = el => { if (!el) return null; const x = el.getBoundingClientRect(); return [Math.round(x.width), Math.round(x.height)]; };
    const hit = el => { if (!el) return null; const a = getComputedStyle(el, '::after'); return a.content !== 'none' && a.content !== 'normal' ? [a.width, a.height] : null; };
    return { heroH: Math.round(hero.getBoundingClientRect().height), share: b(share), shareHit: hit(share), close: b(close), tech: b(tech) };
  });
  const steps = [];
  for (let i = 0; i <= 24; i++) {
    const s = await page.evaluate(`(() => {
      const sc = ${scroller}; sc.scrollTop = ${i * 10};
      const d = document.querySelector('[role=dialog]');
      const dt = d.getBoundingClientRect().top;
      const name = d.querySelector('.drawer-dock-name').getBoundingClientRect();
      const hero = d.querySelector('.drawer-dock-hero').getBoundingClientRect();
      return { st: sc.scrollTop, p: +getComputedStyle(d).getPropertyValue('--p'), nameTop: Math.round(name.top - dt), nameBottom: Math.round(name.bottom - dt), barBottom: Math.round(hero.bottom - dt) };
    })()`);
    steps.push(s);
    await wait(30);
  }
  res.minNameTop = Math.min(...steps.map(s => s.nameTop));
  res.steps = steps.filter((_, i) => i % 3 === 0);
  await page.evaluate(`(() => { const sc = ${scroller}; sc.scrollTop = 1250; })()`);
  await wait(600);
  res.docked = await page.evaluate(() => {
    const d = document.querySelector('[role=dialog]');
    const dt = d.getBoundingClientRect().top;
    const hero = d.querySelector('.drawer-dock-hero').getBoundingClientRect();
    const close = d.querySelector('.drawer-dock-close').getBoundingClientRect();
    const name = d.querySelector('.drawer-dock-name');
    return {
      docked: d.hasAttribute('data-docked'),
      barH: Math.round(hero.bottom - dt),
      closeCenter: Math.round(close.top + close.height / 2 - dt),
      closeSize: [Math.round(close.width), Math.round(close.height)],
      nameLine: name.innerText.replace(/\s+/g, ' '),
      nameH: Math.round(name.getBoundingClientRect().height),
    };
  });
  await page.screenshot({ path: join(SHOTS, `impl-drawer-${label}-docked-${dev}.jpg`), type: 'jpeg', quality: 80 });
  // Mid-dock frame
  await page.evaluate(`(() => { const sc = ${scroller}; sc.scrollTop = 110; })()`); await wait(300);
  await page.screenshot({ path: join(SHOTS, `impl-drawer-${label}-middock-${dev}.jpg`), type: 'jpeg', quality: 80 });

  // Technical toggle, at rest scroll
  await page.evaluate(`(() => { const sc = ${scroller}; sc.scrollTop = 0; })()`); await wait(300);

  // Viewer
  await page.locator('[data-thumb="0"]').click(); await wait(900);
  res.viewer = await page.evaluate(() => {
    const d = document.querySelector('[role=dialog]');
    const b = el => { if (!el) return null; const x = el.getBoundingClientRect(); return [Math.round(x.width), Math.round(x.height)]; };
    const hit = el => { if (!el) return null; const a = getComputedStyle(el, '::after'); return a.content !== 'none' && a.content !== 'normal' ? [a.width, a.height] : null; };
    const full = [...d.querySelectorAll('a')].find(a => /Open full size/.test(a.textContent));
    return {
      back: b(d.querySelector('[aria-label="Back to the show"]')),
      prev: b(d.querySelector('[aria-label="Previous image"]')),
      next: b(d.querySelector('[aria-label="Next image"]')),
      dot: b(d.querySelector('[aria-label="Go to image 1"]')),
      full: b(full), fullHit: hit(full),
      close: b(d.querySelector('.drawer-dock-close')),
    };
  });
  await page.screenshot({ path: join(SHOTS, `impl-drawer-${label}-viewer-${dev}.jpg`), type: 'jpeg', quality: 80 });
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await close();

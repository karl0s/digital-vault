import { launch, close, newPhone, BASE, settle, wait } from './lib.mjs';
const id = process.argv[2] || '7c860a05fcce', dev = process.argv[3] || 'iphone';
const scroller = `(() => { const d = document.querySelector('[role=dialog]'); return [...d.querySelectorAll('*')].find(el => el.scrollHeight > el.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)); })()`;
await launch();
const { page, ctx } = await newPhone(dev);
await page.goto(BASE + '?show=' + id, { waitUntil: 'domcontentloaded' }); await settle(page, 1300);
console.log(await page.evaluate(() => { const d = document.querySelector('[role=dialog]'); return { subh: d.style.getPropertyValue('--sub-h'), bh: d.style.getPropertyValue('--badges-h'), heroTop: d.querySelector('.drawer-dock-hero').style.top, heroH: d.querySelector('.drawer-dock-hero').style.height }; }));
for (let st = 0; st <= 200; st += 20) {
  await page.evaluate(`(() => { const sc = ${scroller}; sc.scrollTop = ${st}; })()`);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  console.log(JSON.stringify(await page.evaluate(() => {
    const d = document.querySelector('[role=dialog]'); const dt = d.getBoundingClientRect().top;
    const q = s => d.querySelector(s);
    const h = s => Math.round(q(s).getBoundingClientRect().height);
    return { p: d.style.getPropertyValue('--p'), title: h('.drawer-dock-title'), name: h('.drawer-dock-name'), sub: h('.drawer-dock-sub'), badges: h('.drawer-dock-badges'), heroBottom: Math.round(q('.drawer-dock-hero').getBoundingClientRect().bottom - dt), nameTop: Math.round(q('.drawer-dock-name').getBoundingClientRect().top - dt), line: d.hasAttribute('data-dock-line') };
  })));
}
await ctx.close(); await close();

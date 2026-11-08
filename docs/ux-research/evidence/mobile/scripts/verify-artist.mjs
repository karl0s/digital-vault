import { launch, close, newPhone, BASE, settle, wait } from './lib.mjs';
await launch();
const { page } = await newPhone('iphone');
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await settle(page, 1500);
await page.locator('nav[aria-label="Main"] button', { hasText: 'Artists' }).tap();
await wait(2500);
console.log('after Artists tab y=', await page.evaluate(() => scrollY));
// human-like: swipe down in steps until Pearl Jam row is in view
for (let i = 0; i < 40; i++) {
  const r = await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Pearl Jam')); const t=b.getBoundingClientRect().top; return t; });
  if (r > 200 && r < 500) break;

  await page.mouse.wheel(0, Math.min(600, r - 300));
  await wait(250);
}
await wait(800);
const y0 = await page.evaluate(() => scrollY);
console.log('Pearl Jam in view at y=', y0);
await page.screenshot({ path: '/tmp/v-p.jpg', type: 'jpeg', quality: 70 });
await page.locator('button', { hasText: /^Pearl Jam\s*\d+$/ }).first().tap();
for (const t of [100, 400, 1200, 2500]) { await wait(t === 100 ? 100 : t - 0); console.log('t+', t, 'y=', await page.evaluate(() => scrollY), 'docH=', await page.evaluate(() => document.documentElement.scrollHeight)); }
await page.screenshot({ path: '/tmp/v-pj.jpg', type: 'jpeg', quality: 70 });
await close();

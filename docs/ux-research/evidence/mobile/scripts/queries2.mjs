import { launch, close, newPhone, BASE, settle, wait, OUT } from './lib.mjs';
import { writeFileSync } from 'node:fs';
const Q = ['ratm','pj','rhcp','qotsa','fnm','stp','30stm','sg','swu','bizarre 97','rage 2010','red hot chili peppers rock am ring','queens of the stone age reading','stone temple pilots unplugged'];
await launch();
const { page } = await newPhone('android');
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await settle(page, 1500);
const res = [];
for (const q of Q) {
  const f = page.locator('input[type=search]');
  await f.fill(''); await wait(250);
  await f.fill(q); await wait(900);
  const t = await page.evaluate(() => { const p=document.querySelector('[data-results-row] p'); return p ? p.textContent.trim() : ''; });
  const first = await page.evaluate(() => { const b=document.querySelector('button[id^="show-"]'); return b ? b.getAttribute('title') : ''; });
  res.push({ q, count: t, first: (first||'').slice(0,90) });
  console.log(q.padEnd(34), t.padEnd(10), (first||'').slice(0,80));
}
writeFileSync(OUT + '/queries2.json', JSON.stringify(res, null, 1));
await close();

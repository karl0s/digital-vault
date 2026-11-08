import { launch, close, newPhone, BASE, settle, wait, OUT } from './lib.mjs';
import { writeFileSync } from 'node:fs';
const Q = ['ratm swu','rage swu','rage against the machine swu','ratm 2010','ratm brasil','ratm sao paulo','foo bdo','foo fighters bdo','bdo 2000','big day out 2000','foo fighters big day out 2000','pj pinkpop','pearl jam pinkpop','pearl jam pinkpop 2000','rhcp rock am ring','qotsa reading','fnm bizarre 97','fnm bizarre','faith no more bizarre 1997','16.01.2000','16/01/00','jan 2000','foo fighters 2000','channel v','multishow foo','soundgarden 96','sg 1996','stp unplugged','glasto 2009','rock am ring 2010 30stm','30stm rar'];
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
writeFileSync(OUT + '/queries.json', JSON.stringify(res, null, 1));
await close();

import { launch, close, newPhone, BASE, settle, shot, LOG } from './lib.mjs';
await launch();
const { page } = await newPhone('iphone');
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await settle(page, 1500);
const e = await shot(page, 'smoke', 'landing', { title: 'smoke' });
console.log(JSON.stringify(e, null, 1).slice(0, 2500));
await close();

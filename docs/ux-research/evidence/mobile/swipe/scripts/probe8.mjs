// Touch-swipe test for the drawer's image viewer: raw CDP, headless Chromium,
// iPhone-sized with touch emulation. Usage: node swipe-test.mjs <baseUrl> <outDir> [desktop]
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const [,, BASE, OUT, MODE] = process.argv;
mkdirSync(OUT, { recursive: true });
const SHOW = 'c90f6de6dd8b';

function findChromium() {
  const pw = join(homedir(), 'Library/Caches/ms-playwright');
  const shells = readdirSync(pw).filter(d => d.startsWith('chromium_headless_shell-'))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  for (const d of shells) for (const sub of readdirSync(join(pw, d))) {
    const bin = join(pw, d, sub, 'chrome-headless-shell');
    if (existsSync(bin)) return bin;
  }
}

const profile = mkdtempSync(join(tmpdir(), 'swipe-'));
const proc = spawn(findChromium(), ['--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let port;
for (let i = 0; i < 100 && !port; i++) { try { port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch { await sleep(100); } }
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result?.result?.value;
};
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64'));
};

const desktop = MODE === 'desktop' || MODE === 'geom-desktop';
const geomOnly = MODE?.startsWith('geom');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', desktop
  ? { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }
  : (process.env.LAND ? { width: 844, height: 390, deviceScaleFactor: 2, mobile: true } : { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }));
if (!desktop) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Page.navigate', { url: `${BASE}?show=${SHOW}` });

for (let i = 0; i < 200; i++) {
  const ok = await ev(`(() => { const t = document.querySelector('[data-thumb="0"] img'); return !!t && t.complete && t.naturalWidth > 0 && document.querySelectorAll('[data-thumb] img').length === 4 && [...document.querySelectorAll('[data-thumb] img')].every(i => i.complete); })()`);
  if (ok) break; await sleep(100);
}
await sleep(900);

const rect = sel => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; })()`);
const state = () => ev(`(() => {
  const d = document.querySelector('[role=dialog]');
  const strip = d.querySelector('.group\\\\/strip');
  const shown = d.querySelector('img[alt^="Screenshot "]:not([data-thumb] img)');
  const counter = [...d.querySelectorAll('p')].find(p => /^Screenshot/.test(p.textContent));
  return {
    open: !!strip,
    transform: strip ? strip.style.transform : null,
    moving: strip ? strip.hasAttribute('data-moving') : null,
    shownAlt: shown ? shown.alt : null,
    counter: counter ? counter.textContent.split(' · ')[0] : null,
    touchAction: strip ? strip.parentElement.parentElement.style.touchAction : null,
  };
})()`);

const tap = async (x, y) => {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await sleep(40);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};
// A drag from x0 to x1 in `steps` moves `stepMs` apart; hold before lifting.
const drag = async (x0, x1, y, { steps = 12, stepMs = 16, hold = 0, mid = null, y1 = y, lift = true } = {}) => {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
  for (let i = 1; i <= steps; i++) {
    await sleep(stepMs);
    await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / steps, y: y + (y1 - y) * i / steps }] });
    if (mid && i === Math.round(steps / 2)) await mid();
  }
  if (hold) await sleep(hold);
  if (lift) await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + JSON.stringify(detail) : ''}`); };

// Open the viewer from thumbnail 1.
const t0 = await rect('[data-thumb="0"]');
if (desktop) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: t0.x + t0.w / 2, y: t0.y + t0.h / 2, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: t0.x + t0.w / 2, y: t0.y + t0.h / 2, button: 'left', clickCount: 1 });
} else {
  await tap(t0.x + t0.w / 2, t0.y + t0.h / 2);
}
await sleep(800);
const shownRect = await rect('[role=dialog] .cursor-zoom-out img[alt^="Screenshot "]');
const s0 = geomOnly ? null : await state();
console.log('viewer image rect', JSON.stringify(shownRect), JSON.stringify(s0));
writeFileSync(join(OUT, 'geometry.json'), JSON.stringify({ shownRect, s0 }, null, 2));
await shot('01-open');
if (geomOnly) { proc.kill(); rmSync(profile, { recursive: true, force: true }); process.exit(0); }

if (desktop) {
  // A mouse drag across the picture does nothing new.
  const y = shownRect.y + shownRect.h / 2;
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 1200, y, button: 'left', clickCount: 1 });
  for (let i = 1; i <= 10; i++) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1200 - i * 25, y, button: 'left', buttons: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 950, y, button: 'left', clickCount: 1 });
  await sleep(500);
  const s = await state();
  check('desktop: a mouse drag does not swipe', s.counter === 'Screenshot 1 of 4' && !s.transform && !s.moving, s);
  await ev(`[...document.querySelectorAll('[role=dialog] button')].find(b => b.getAttribute('aria-label') === 'Next image').click()`);
  await sleep(100);
  const s2 = await state();
  check('desktop: Next still works, instant', s2.counter === 'Screenshot 2 of 4' && s2.shownAlt === 'Screenshot 2' && !s2.moving, s2);
  proc.kill(); rmSync(profile, { recursive: true, force: true });
  writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  process.exit(0);
}

// Count image reloads and src swaps from here on.
await ev(`(() => {
  window.__srcChanges = 0;
  new MutationObserver(m => { window.__srcChanges += m.filter(r => r.attributeName === 'src').length; })
    .observe(document.querySelector('[role=dialog]'), { attributes: true, subtree: true, attributeFilter: ['src'] });
  window.__jpgBefore = performance.getEntriesByType('resource').filter(e => /\\.jpg/.test(e.name)).length;
})()`);

const y = Math.round(shownRect.y + shownRect.h / 2);
check('touch-action set on the picture area', s0.touchAction === 'pan-y pinch-zoom', s0);


const region = await rect('[role=dialog] .cursor-zoom-out > .flex-1');
console.log('area', JSON.stringify(region), 'still', JSON.stringify(shownRect));
const cx = region.x + region.w / 2;
if (process.env.LAND) {
  // neighbour must start beyond the area's right edge
  await drag(cx + 100, cx + 60, y, { steps: 4, lift: false });
  const n = await ev(`(() => { const i = document.querySelectorAll('[role=dialog] .cursor-zoom-out > .flex-1 img')[1]; return { vis: getComputedStyle(i).visibility, left: Math.round(i.getBoundingClientRect().left) }; })()`);
  check('landscape: next still waits just past the area edge', n.vis === 'visible' && n.left >= region.x + region.w - 30 - 1, { ...n, areaRight: region.x + region.w });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(600);
  await drag(cx + 120, cx - 120, y, { steps: 10 }); await sleep(700);
  const s1 = await state();
  check('landscape: a swipe left goes to still 2', s1.counter === 'Screenshot 2 of 4' && !s1.transform, s1);
} else {
  // second finger mid-drag: the swipe lets go, the strip settles home
  await drag(300, 150, y, { steps: 8, lift: false });
  await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 150, y }, { x: 250, y: y + 80 }] });
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 150, y }, { x: 250, y: y + 80 }] });
  await sleep(30);
  for (let i = 1; i <= 5; i++) { await sleep(16); await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 150 - i * 10, y }, { x: 250 + i * 10, y: y + 80 }] }); }
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(800);
  const s1 = await state();
  check('second finger mid-swipe: settles on a still, nothing stuck', !s1.transform && !s1.moving && /Screenshot [12] of 4/.test(s1.counter), s1);
  const z = await ev('visualViewport.scale');
  check('the pinch zoomed the page (pinch-zoom kept), and swiping stood aside', z > 1.01 && s1.touchAction === '', { scale: z, touchAction: s1.touchAction });
  await send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 }); await sleep(400);
  const s3 = await state();
  check('zoomed back out: swipe handling is back', s3.touchAction === 'pan-y pinch-zoom', { scale: await ev('visualViewport.scale'), touchAction: s3.touchAction });
  await drag(300, 80, y, { steps: 8 }); await sleep(700);
  const s2 = await state();
  check('and a swipe works again', s2.counter !== s1.counter && !s2.transform, { before: s1.counter, after: s2.counter });
}
proc.kill(); rmSync(profile, { recursive: true, force: true }); process.exit(0);

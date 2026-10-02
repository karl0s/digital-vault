/**
 * Front-end performance benchmark: Browse view and show drawer.
 *
 *   npm run perf                  build, serve, check the drawer, time it   (~4 min)
 *   npm run perf -- --quick       one run per CPU speed                      (~2 min)
 *   npm run perf -- --url <url>   probe a server you already started, e.g. the
 *                                 live site, or `vite preview` of another branch
 *
 * Run it before and after any change to the cards, grids, drawer or image
 * loading. `npm run check:perf` lints for the known regressions; this measures.
 *
 * What it does, in a fresh headless Chromium per run:
 *   1. Drawer correctness — `inert` must land after the slide-in (not at the
 *      click), the page behind must be unreachable while open, and focus must
 *      return to the card on close. Repeated with prefers-reduced-motion.
 *   2. Timings at 1x CPU and 4x throttled (a stand-in for a mid-range phone):
 *      grid first render, a fast scroll through all of Browse (frame times,
 *      and how many on-screen cards are still blank), then the drawer opened
 *      and closed five times (first frame, and the worst frame in the second
 *      after — which is where the deferred `inert` restyle lands).
 *
 * Single runs on a laptop are noisy (one drawer timing swung 140 ms -> 17 ms
 * between identical runs), so it reports medians and budgets are ~3x what was
 * measured on Karl's Mac on 2026-10-02: open 23 ms / close 7 ms at 1x, open
 * 145 ms at 4x, 14 MB heap.
 *
 * Needs a Chromium. It looks for $CHROME, then Playwright's headless shell in
 * ~/Library/Caches/ms-playwright (`npx playwright install chromium`), then
 * Google Chrome. Chrome.app may refuse to start from a sandboxed shell; the
 * headless shell does not.
 */

import { spawn } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const QUICK = args.includes('--quick');
const URL_ARG = args.includes('--url') ? args[args.indexOf('--url') + 1] : null;
const ROUNDS = QUICK ? { 1: 1, 4: 1 } : { 1: 3, 4: 2 };

const BUDGET = {
  open1: 80,     // ms, click -> first frame with the drawer, 1x CPU
  close1: 40,    // ms, Escape -> first frame, 1x
  open4: 400,    // ms, click -> first frame, 4x throttle
  heapMB: 25,    // JS heap after load
  blank4: 15,    // % of on-screen cards still blank during the 4x scroll
};

// ---------------------------------------------------------------------------
// Browser
// ---------------------------------------------------------------------------

function findChromium() {
  if (process.env.CHROME) return process.env.CHROME;
  const pw = join(homedir(), 'Library/Caches/ms-playwright');
  if (existsSync(pw)) {
    const shells = readdirSync(pw)
      .filter(d => d.startsWith('chromium_headless_shell-'))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const d of shells) {
      for (const sub of readdirSync(join(pw, d))) {
        const bin = join(pw, d, sub, 'chrome-headless-shell');
        if (existsSync(bin)) return bin;
      }
    }
  }
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (existsSync(chrome)) return chrome;
  throw new Error('No Chromium found. Set CHROME=/path/to/chrome, or run `npx playwright install chromium`.');
}

async function openBrowser(chromium, { throttle = 1, reducedMotion = false } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'vault-perf-'));
  const headless = chromium.includes('headless-shell') ? [] : ['--headless=new'];
  const proc = spawn(chromium, [
    ...headless, '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--window-size=1440,900', '--no-first-run', 'about:blank',
  ], { stdio: 'ignore' });

  let port;
  for (let i = 0; i < 100 && !port; i++) {
    try { port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; }
    catch { await sleep(100); }
  }
  if (!port) { proc.kill(); throw new Error(`Chromium did not start: ${chromium}`); }

  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map();
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise(r => {
    const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'evaluate failed');
    return r.result?.result?.value;
  };

  await send('Performance.enable');
  await send('Page.enable');
  // The default buffer keeps 250 entries; Browse loads over a thousand images.
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'performance.setResourceTimingBufferSize(10000)' });
  if (throttle !== 1) await send('Emulation.setCPUThrottlingRate', { rate: throttle });
  if (reducedMotion) {
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  }

  const close = () => {
    try { ws.close(); } catch { /* already closed */ }
    proc.kill();
    rmSync(profile, { recursive: true, force: true });
  };
  return { send, evaluate, close };
}

const CARDS = `document.querySelectorAll('button[id^="show-"]')`;

/** Navigate and wait for the grid to stop growing. Returns ms until it had its final card count. */
async function loadBrowse(b, url) {
  const t0 = Date.now();
  await b.send('Page.navigate', { url });
  let last = -1, stableSince = 0, reachedAt = 0;
  for (let i = 0; i < 600; i++) {
    const n = await b.evaluate(`${CARDS}.length`);
    if (n !== last) { last = n; reachedAt = Date.now(); stableSince = i; }
    if (n > 100 && i - stableSince >= 6) return { cards: n, firstRender: reachedAt - t0 };
    await sleep(50);
  }
  throw new Error(`Browse grid never settled (last count ${last}) — did the page error?`);
}

// ---------------------------------------------------------------------------
// 1. Drawer correctness
// ---------------------------------------------------------------------------

async function drawerChecks(chromium, url, reducedMotion) {
  const b = await openBrowser(chromium, { reducedMotion });
  try {
    await loadBrowse(b, url);
    await sleep(500);
    const card = await b.evaluate(`(() => { const c = [...${CARDS}][40]; c.scrollIntoView({ block: 'center' }); return c.id; })()`);
    await sleep(300);
    const inert = `!!document.querySelector('#root [inert]')`;
    const r = {};
    await b.evaluate(`document.getElementById('${card}').focus(); document.getElementById('${card}').click(); 1`);
    r.inertAtClick = await b.evaluate(inert);
    await sleep(700);
    r.inertWhenOpen = await b.evaluate(inert);
    r.focusInDrawer = await b.evaluate(`!!document.activeElement.closest('[role=dialog]')`);
    r.pageUnreachable = await b.evaluate(`(() => { const c = document.getElementById('${card}'); c.focus(); return document.activeElement !== c; })()`);
    for (const type of ['keyDown', 'keyUp']) {
      await b.send('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    }
    await sleep(800);
    r.drawerGone = await b.evaluate(`!document.querySelector('[role=dialog]')`);
    r.inertLifted = !(await b.evaluate(inert));
    r.focusBackOnCard = await b.evaluate(`document.activeElement.id === '${card}'`);
    return r;
  } finally { b.close(); }
}

// ---------------------------------------------------------------------------
// 2. Timings
// ---------------------------------------------------------------------------

/** rAF loop from `t`: first presented frame, and the longest gap within 1 s. */
const FRAME_WATCH = `
  let first = null, last = t, worst = 0;
  (function loop(now) {
    if (first === null) setTimeout(() => { first = performance.now() - t; }, 0);
    worst = Math.max(worst, now - last); last = now;
    if (now - t < 1000) requestAnimationFrame(loop); else res({ first, worst });
  })(t);`;

async function timingRun(chromium, url, throttle) {
  const b = await openBrowser(chromium, { throttle });
  try {
    const { cards, firstRender } = await loadBrowse(b, url);
    const metric = async () => Object.fromEntries((await b.send('Performance.getMetrics')).result.metrics.map(m => [m.name, m.value]));
    const heapMB = (await metric()).JSHeapUsedSize / 1e6;
    const fcp = await b.evaluate(`performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0`);
    // Show data fetched for the first render. Raw bytes: vite preview does not
    // gzip, so this tracks the size of what is parsed, not what crosses the wire.
    const dataKB = await b.evaluate(`performance.getEntriesByType('resource')
      .filter(e => /shows(-lite)?\\.json/.test(e.name)).reduce((s, e) => s + e.decodedBodySize, 0) / 1e3`);

    // Fast scroll through the whole grid: ~700 px every 60 ms.
    await b.evaluate(`document.documentElement.style.scrollBehavior = 'auto';
      window.__f = []; (function loop(t) { window.__f.push(t); window.__raf = requestAnimationFrame(loop); })(performance.now()); 1`);
    const height = await b.evaluate('document.documentElement.scrollHeight');
    let blank = 0, seen = 0;
    for (let y = 0; y < height; y += 700) {
      await b.evaluate(`window.scrollTo(0, ${y}); 1`);
      await sleep(60);
      const [n, t] = await b.evaluate(`(() => { let n = 0, t = 0;
        for (const c of ${CARDS}) { const r = c.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) continue; t++;
          const i = c.querySelector('img'); if (!i || !i.complete || !i.naturalWidth || getComputedStyle(i).opacity < 0.5) n++; }
        return [n, t]; })()`);
      blank += n; seen += t;
    }
    await sleep(1000);
    // Image bytes fetched so far: load plus the scroll through everything.
    const imageMB = await b.evaluate(`performance.getEntriesByType('resource')
      .filter(e => /\\.(jpe?g|webp)(\\?|$)/.test(e.name)).reduce((s, e) => s + e.encodedBodySize, 0) / 1e6`);
    const scroll = await b.evaluate(`(() => { cancelAnimationFrame(window.__raf); const f = window.__f, d = [];
      for (let i = 1; i < f.length; i++) d.push(f[i] - f[i - 1]); d.sort((a, b) => a - b);
      return { p95: d[Math.floor(d.length * 0.95)], long: d.filter(x => x > 50).length }; })()`);

    // Drawer: open and close six times; the first pair is a warm-up.
    await b.evaluate('window.scrollTo(0, 3000); 1');
    await sleep(500);
    const opens = [], closes = [];
    for (let k = 0; k < 6; k++) {
      const open = await b.evaluate(`new Promise(res => { const c = [...${CARDS}][200 + ${k} * 97] || [...${CARDS}][${k}];
        const t = performance.now(); c.click(); ${FRAME_WATCH} })`);
      await sleep(300);
      const close = await b.evaluate(`new Promise(res => { const t = performance.now();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); ${FRAME_WATCH} })`);
      await sleep(300);
      if (k > 0) { opens.push(open); closes.push(close); }
    }
    const avg = (xs, k) => xs.reduce((s, x) => s + x[k], 0) / xs.length;
    return {
      cards, firstRender, fcp, dataKB, heapMB, imageMB,
      scrollP95: scroll.p95, scrollLong: scroll.long, blankPct: (100 * blank) / Math.max(seen, 1),
      open: avg(opens, 'first'), openWorst: avg(opens, 'worst'),
      close: avg(closes, 'first'), closeWorst: avg(closes, 'worst'),
    };
  } finally { b.close(); }
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

async function buildAndServe() {
  const { build, preview } = await import('vite');
  const outDir = join(ROOT, 'node_modules/.cache/perf-dist');
  // Unlink last run's links ourselves so the build's emptyOutDir never walks
  // a symlink into public/.
  if (existsSync(outDir)) {
    for (const e of readdirSync(outDir)) {
      const p = join(outDir, e);
      if (lstatSync(p).isSymbolicLink()) unlinkSync(p);
    }
  }
  mkdirSync(outDir, { recursive: true });
  console.log('Building…');
  await build({ root: ROOT, logLevel: 'warn', build: { outDir, emptyOutDir: true, copyPublicDir: false } });
  // public/ is ~300 MB of images. Link it in rather than copying.
  for (const e of readdirSync(join(ROOT, 'public'))) {
    if (!e.startsWith('.')) symlinkSync(join(ROOT, 'public', e), join(outDir, e));
  }
  const server = await preview({ root: ROOT, logLevel: 'warn', build: { outDir }, preview: { port: 4317 } });
  return { url: server.resolvedUrls.local[0], close: () => server.httpServer.close() };
}

// ---------------------------------------------------------------------------

const median = xs => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

async function main() {
  const chromium = findChromium();
  const server = URL_ARG ? { url: URL_ARG, close: () => {} } : await buildAndServe();
  let failed = 0;
  try {
    console.log(`Probing ${server.url}\nChromium: ${chromium}\n`);

    console.log('Drawer correctness');
    for (const reduced of [false, true]) {
      const r = await drawerChecks(chromium, server.url, reduced);
      const tag = reduced ? ' (reduced motion)' : '';
      const expect = {
        ...(reduced ? {} : { 'inert is not applied at the click': !r.inertAtClick }),
        'page behind is inert while open': r.inertWhenOpen,
        'focus moves into the drawer': r.focusInDrawer,
        'page behind cannot take focus': r.pageUnreachable,
        'drawer closes on Escape': r.drawerGone,
        'inert is lifted after close': r.inertLifted,
        'focus returns to the card': r.focusBackOnCard,
      };
      for (const [label, pass] of Object.entries(expect)) {
        if (!pass) failed++;
        console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${label}${tag}`);
      }
    }

    const runs = { 1: [], 4: [] };
    for (const throttle of [1, 4]) {
      for (let i = 0; i < ROUNDS[throttle]; i++) {
        process.stdout.write(`\rTiming at ${throttle}x CPU, run ${i + 1}/${ROUNDS[throttle]}…   `);
        runs[throttle].push(await timingRun(chromium, server.url, throttle));
      }
    }
    process.stdout.write('\r' + ' '.repeat(50) + '\r');

    const m = (t, k) => median(runs[t].map(r => r[k]));
    const rows = [
      ['first contentful paint', 'fcp', 'ms'],
      ['show data parsed before first render', 'dataKB', 'KB'],
      ['grid first render', 'firstRender', 'ms'],
      ['JS heap after load', 'heapMB', 'MB'],
      ['scroll: image data downloaded', 'imageMB', 'MB'],
      ['scroll: p95 frame', 'scrollP95', 'ms'],
      ['scroll: frames over 50 ms', 'scrollLong', ''],
      // At 1x the scripted flick (~11,000 px/s) outruns any network, so that
      // column reads ~95% whatever the code does. Only the 4x figure is budgeted.
      ['scroll: on-screen cards still blank', 'blankPct', '%'],
      ['drawer open: click -> first frame', 'open', 'ms'],
      ['drawer open: worst frame in next 1 s', 'openWorst', 'ms'],
      ['drawer close: Esc -> first frame', 'close', 'ms'],
      ['drawer close: worst frame in next 1 s', 'closeWorst', 'ms'],
    ];
    console.log(`\nTimings — median of ${ROUNDS[1]} run(s) at 1x, ${ROUNDS[4]} at 4x; ${runs[1][0].cards} cards`);
    console.log('  ' + ''.padEnd(40) + '1x CPU'.padStart(10) + '4x CPU'.padStart(10));
    for (const [label, k, unit] of rows) {
      const f = v => `${v.toFixed(0)}${unit ? ' ' + unit : ''}`;
      console.log('  ' + label.padEnd(40) + f(m(1, k)).padStart(10) + f(m(4, k)).padStart(10));
    }

    console.log('\nBudgets (~3x the 2026-10-02 measurements)');
    const budgets = [
      ['drawer open at 1x', m(1, 'open'), BUDGET.open1, 'ms'],
      ['drawer close at 1x', m(1, 'close'), BUDGET.close1, 'ms'],
      ['drawer open at 4x', m(4, 'open'), BUDGET.open4, 'ms'],
      ['JS heap', m(1, 'heapMB'), BUDGET.heapMB, 'MB'],
      ['blank cards while scrolling at 4x', m(4, 'blankPct'), BUDGET.blank4, '%'],
    ];
    for (const [label, value, max, unit] of budgets) {
      const pass = value <= max;
      if (!pass) failed++;
      console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${label}: ${value.toFixed(0)} ${unit} (budget ${max})`);
    }
  } finally {
    server.close();
  }
  console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });

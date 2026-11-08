// Shared helpers for the mobile audit: devices, screenshots, measurements.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const BASE = process.env.BASE || 'https://karl0s.github.io/digital-vault/';
export const OUT = join(homedir(), 'VaultShots/reports/mobile-audit');
export const SHOTS = join(OUT, 'shots');
mkdirSync(SHOTS, { recursive: true });

const EXE = join(homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-x64/chrome-headless-shell');

const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

// Viewport = the area a person actually sees: screen minus status bar and browser bars.
export const DEVICES = {
  iphone:  { label: 'iPhone 15 · Safari', screen: '393×852', width: 390, height: 664, dpr: 2, ua: IOS_UA, kbd: 253 },
  android: { label: 'Galaxy S23 · Chrome', screen: '360×780', width: 360, height: 660, dpr: 2, ua: ANDROID_UA, kbd: 300 },
  se:      { label: 'iPhone SE · Safari', screen: '375×667', width: 375, height: 553, dpr: 2, ua: IOS_UA, kbd: 260 },
  promax:  { label: 'iPhone 15 Pro Max · Safari', screen: '430×932', width: 430, height: 752, dpr: 2, ua: IOS_UA, kbd: 262 },
  zoom125: { label: 'iPhone 15 · Safari text 125%', screen: '393×852 at 125%', width: 312, height: 531, dpr: 2.5, ua: IOS_UA, kbd: 202 },
  land:    { label: 'iPhone 15 · landscape', screen: '852×393', width: 750, height: 340, dpr: 2, ua: IOS_UA, kbd: 170 },
};

let browser;
export async function launch() {
  browser = await chromium.launch({ executablePath: EXE, headless: true });
  return browser;
}
export async function close() { await browser?.close(); }

export async function newPhone(deviceKey) {
  const d = DEVICES[deviceKey];
  const ctx = await browser.newContext({
    viewport: { width: d.width, height: d.height },
    deviceScaleFactor: d.dpr,
    isMobile: true,
    hasTouch: true,
    userAgent: d.ua,
    colorScheme: 'dark',
  });
  // Capture what Share would hand over, instead of a share sheet the headless browser lacks.
  await ctx.addInitScript(() => {
    window.__shared = null;
    navigator.share = async (data) => { window.__shared = data; };
    navigator.canShare = () => true;
  });
  const page = await ctx.newPage();
  page.__device = deviceKey;
  return { ctx, page };
}

export const LOG = [];
export function logPath() { return join(OUT, 'log.json'); }
export function loadLog() { return existsSync(logPath()) ? JSON.parse(readFileSync(logPath(), 'utf8')) : []; }
export function saveLog(entries) { writeFileSync(logPath(), JSON.stringify(entries, null, 1)); }

export const wait = ms => new Promise(r => setTimeout(r, ms));

export async function settle(page, ms = 700) {
  try { await page.waitForLoadState('networkidle', { timeout: 6000 }); } catch {}
  await wait(ms);
}

/** Measurements of what is on screen right now. */
export async function measure(page) {
  return page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight;
    const vis = r => Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    const dialog = document.querySelector('[role=dialog]');
    const scope = dialog || document;
    const bar = document.querySelector('[data-filter-bar]');
    const tab = document.querySelector('nav[aria-label="Main"]');
    const barR = bar?.getBoundingClientRect();
    const tabR = tab && getComputedStyle(tab).display !== 'none' ? tab.getBoundingClientRect() : null;
    const barStuck = barR && barR.top <= 0.5;
    const out = {
      vw, vh, scrollY: Math.round(scrollY), docH: document.documentElement.scrollHeight,
      overflowX: document.documentElement.scrollWidth > vw + 1 ? document.documentElement.scrollWidth : 0,
      barH: barR ? Math.round(barR.height) : 0, barVisible: barR ? Math.round(vis(barR)) : 0, barStuck: !!barStuck,
      tabH: tabR ? Math.round(vis(tabR)) : 0,
      dialog: !!dialog,
      url: location.href.replace(location.origin, ''),
    };
    // Cards
    if (!dialog) {
      const cards = [...document.querySelectorAll('button[id^="show-"]')];
      let full = 0, half = 0;
      const top = barStuck ? barR.bottom : 0, bottom = vh - (tabR ? tabR.height : 0);
      for (const c of cards) {
        const b = c.getBoundingClientRect();
        const v = Math.max(0, Math.min(b.bottom, bottom) - Math.max(b.top, top));
        if (v >= b.height - 1) full++; else if (v >= b.height / 2) half++;
      }
      out.cards = { total: cards.length, full, half };
      if (cards[0]) { const b = cards[0].getBoundingClientRect(); out.cardSize = [Math.round(b.width), Math.round(b.height)]; }
      const rows = [...document.querySelectorAll('table tbody tr')];
      if (rows.length) {
        let n = 0;
        for (const r of rows) { const b = r.getBoundingClientRect(); if (b.top >= top - 1 && b.bottom <= bottom + 1) n++; }
        out.rows = { total: rows.length, full: n, h: Math.round(rows[0].getBoundingClientRect().height) };
      }
      out.contentArea = Math.round(bottom - top);
    }
    // Tap targets in view under 44px on either side
    const small = [];
    for (const el of scope.querySelectorAll('button, a[href], input, select, [role=button], [role=option]')) {
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0 || vis(b) < 4 || b.right < 0 || b.left > vw) continue;
      if (el.closest('[inert]')) continue;
      if (b.width < 44 || b.height < 44) {
        const name = (el.getAttribute('aria-label') || el.textContent || el.placeholder || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
        small.push({ name, w: Math.round(b.width), h: Math.round(b.height) });
      }
    }
    out.smallTargets = small.slice(0, 40);
    out.smallTargetCount = small.length;
    // Text sizes in view
    const sizes = {};
    const walker = document.createTreeWalker(scope === document ? document.body : scope, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement; if (!el || el.closest('[inert]')) continue;
      const b = el.getBoundingClientRect(); if (vis(b) < 2 || b.width === 0) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      const fs = parseFloat(cs.fontSize);
      sizes[fs] = (sizes[fs] || 0) + n.textContent.trim().length;
    }
    out.textSizes = sizes;
    return out;
  });
}

/** A simple phone keyboard drawn over the bottom of the screen. */
export async function showKeyboard(page, on = true) {
  const d = DEVICES[page.__device];
  await page.evaluate(([on, h]) => {
    document.getElementById('__kbd')?.remove();
    if (!on) return;
    const k = document.createElement('div');
    k.id = '__kbd';
    k.style.cssText = `position:fixed;left:0;right:0;bottom:0;height:${h}px;z-index:2147483647;background:#2b2b2d;border-top:1px solid #3a3a3c;display:flex;flex-direction:column;gap:9px;padding:10px 4px 8px;box-sizing:border-box;font:500 15px -apple-system,system-ui;color:#fff`;
    const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
    const sug = document.createElement('div');
    sug.style.cssText = 'height:30px;display:flex;justify-content:space-around;align-items:center;color:#ddd;font-size:14px;border-bottom:1px solid #3a3a3c;margin:-4px 0 2px';
    sug.innerHTML = '<span>"…"</span><span>the</span><span>I</span>';
    k.appendChild(sug);
    for (const r of rows) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:5px;justify-content:center;flex:1';
      for (const ch of r) { const key = document.createElement('div'); key.textContent = ch; key.style.cssText = 'flex:0 0 8.4%;background:#5a5a5e;border-radius:5px;display:flex;align-items:center;justify-content:center'; row.appendChild(key); }
      k.appendChild(row);
    }
    const last = document.createElement('div');
    last.style.cssText = 'display:flex;gap:5px;flex:1;padding:0 3px';
    last.innerHTML = '<div style="flex:0 0 24%;background:#3d3d40;border-radius:5px"></div><div style="flex:1;background:#5a5a5e;border-radius:5px;display:flex;align-items:center;justify-content:center">space</div><div style="flex:0 0 24%;background:#0a84ff;border-radius:5px;display:flex;align-items:center;justify-content:center">search</div>';
    k.appendChild(last);
    document.body.appendChild(k);
  }, [on, d.kbd]);
}

let counter = {};
/** Screenshot + measurements, logged under the scenario. */
export async function shot(page, scenario, slug, { title, note = '', fullPage = false, clip, keyboard = false } = {}) {
  counter[scenario] = (counter[scenario] || 0) + 1;
  const nn = String(counter[scenario]).padStart(2, '0');
  const file = `${scenario}-${nn}-${slug}-${page.__device}.jpg`;
  if (keyboard) await showKeyboard(page, true);
  const m = await measure(page);
  await page.screenshot({ path: join(SHOTS, file), type: 'jpeg', quality: 82, fullPage, clip });
  if (keyboard) await showKeyboard(page, false);
  const entry = { scenario, n: nn, slug, device: page.__device, file, title, note, keyboard, ...m };
  LOG.push(entry);
  console.log(`${file}  cards=${m.cards ? m.cards.full + '+' + m.cards.half : '-'} bar=${m.barVisible} tab=${m.tabH} small=${m.smallTargetCount} ${m.overflowX ? 'OVERFLOW ' + m.overflowX : ''}`);
  return entry;
}

export async function scrollTo(page, y) {
  await page.evaluate(y => window.scrollTo(0, y), y);
  await wait(500);
}
export async function scrollBy(page, dy, steps = 4) {
  for (let i = 0; i < steps; i++) { await page.evaluate(d => window.scrollBy(0, d), dy / steps); await wait(60); }
  await wait(450);
}

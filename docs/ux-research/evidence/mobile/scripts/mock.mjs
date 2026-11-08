// Before / after pairs: the live page, then the same page restyled in the test browser only.
import { launch, close, newPhone, BASE, settle, wait, measure, showKeyboard, SHOTS, OUT, DEVICES } from './lib.mjs';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const only = process.argv[2];
const RESULTS = existsSync(join(OUT, 'mock.json')) ? JSON.parse(readFileSync(join(OUT, 'mock.json'), 'utf8')) : {};

async function snap(page, id, side, { keyboard = false } = {}) {
  if (keyboard) await showKeyboard(page, true);
  await wait(250);
  const m = await measure(page);
  const file = `M-${id}-${side}-${page.__device}.jpg`;
  await page.screenshot({ path: join(SHOTS, file), type: 'jpeg', quality: 82 });
  if (keyboard) await showKeyboard(page, false);
  RESULTS[`${id}-${side}-${page.__device}`] = { file, cards: m.cards, rows: m.rows, barVisible: m.barVisible, contentArea: m.contentArea, cardSize: m.cardSize, docH: m.docH, smallTargetCount: m.smallTargetCount };
  console.log(file, JSON.stringify(m.cards || ''), 'bar', m.barVisible, 'docH', m.docH);
}
const search = p => p.locator('input[type=search]');
async function type(page, text) { const f = search(page); await f.fill(''); await f.fill(text); await wait(1000); }
async function blur(page) { await page.evaluate(() => document.activeElement?.blur()); await wait(300); }

// ── The proposed changes, as page edits ──────────────────────────────────────
const AFTER = {
  // R2: two columns on every phone
  twoCols: page => page.evaluate(() => {
    const grids = new Set([...document.querySelectorAll('button[id^="show-"]')].map(b => b.parentElement));
    for (const g of grids) { g.style.gridTemplateColumns = 'repeat(2,minmax(0,1fr))'; g.style.columnGap = '8px'; g.style.rowGap = '10px'; }
  }),
  threeCols: page => page.evaluate(() => {
    const grids = new Set([...document.querySelectorAll('button[id^="show-"]')].map(b => b.parentElement));
    for (const g of grids) { g.style.gridTemplateColumns = 'repeat(3,minmax(0,1fr))'; g.style.columnGap = '6px'; g.style.rowGap = '8px'; }
  }),
  // Alternative: compact rows, still beside text
  rows: page => page.evaluate(() => {
    const grids = new Set([...document.querySelectorAll('button[id^="show-"]')].map(b => b.parentElement));
    for (const g of grids) { g.style.gridTemplateColumns = '1fr'; g.style.rowGap = '10px'; }
    for (const b of document.querySelectorAll('button[id^="show-"]')) {
      const img = b.firstElementChild; const text = img.querySelector('.absolute.inset-x-3');
      b.style.cssText = 'display:flex;gap:12px;align-items:center';
      img.style.cssText = 'width:128px;flex:none';
      const grad = img.querySelector('.bg-linear-to-t'); if (grad) grad.style.display = 'none';
      text.style.cssText = 'position:static;flex:1;min-width:0;text-shadow:none';
      text.querySelectorAll('p').forEach(p => { p.style.textShadow = 'none'; });
      text.firstElementChild.style.fontSize = '15px';
      b.appendChild(text);
    }
  }),
  // R4: no big query title on a phone; the count lives in the bar, the field's × clears
  compactHeader: page => page.evaluate(() => {
    const h2 = [...document.querySelectorAll('h2')].find(h => h.textContent.trim().startsWith('“'));
    if (!h2) return;
    const head = h2.parentElement; const wrap = head.parentElement;
    const back = [...head.querySelectorAll('button')].find(b => /All artists/.test(b.textContent));
    wrap.style.paddingTop = '12px';
    if (back) {
      // Keep the way back to the list, as a slim row
      [...head.children].forEach(c => { if (!c.contains(back)) c.style.display = 'none'; });
      const row = back.parentElement; [...row.children].forEach(c => { if (c !== back) c.style.display = 'none'; });
      head.style.marginBottom = '12px';
    } else head.style.display = 'none';
    // A lone "Shows N" label repeats the count
    const labels = [...wrap.querySelectorAll('h3')];
    if (labels.length === 1) labels[0].style.display = 'none';
  }),
  // R10: a shorter masthead on phones
  compactMasthead: page => page.evaluate(() => {
    const inner = document.querySelector('div.relative.flex.flex-col.items-center.overflow-hidden');
    if (!inner) return;
    inner.style.paddingTop = '18px'; inner.style.paddingBottom = '12px';
    const logo = inner.querySelector('[style*="70%"]'); if (logo) logo.style.width = '48%';
    const tag = inner.querySelector('p'); if (tag) { tag.style.fontSize = '11px'; tag.style.marginTop = '-2px'; }
  }),
  hideMasthead: page => page.evaluate(() => {
    const inner = document.querySelector('div.relative.flex.flex-col.items-center.overflow-hidden');
    if (inner) inner.parentElement.style.display = 'none';
  }),
  // R7: one row of controls under the field — Filters (with its count), the count, sort, layout
  slimBar: (page, { landing = false, newPill = false } = {}) => page.evaluate(([landing, newPill]) => {
    const bar = document.querySelector('[data-filter-bar]');
    const pills = bar.querySelector('.overflow-x-auto');
    const chips = [...bar.querySelectorAll('button[aria-label^="Remove filter"]')];
    const n = chips.length;
    if (chips[0]) chips[0].parentElement.style.display = 'none';
    const pill = (label, count, active) => {
      const b = document.createElement('button');
      b.style.cssText = `display:flex;align-items:center;gap:6px;height:44px;padding:0 15px;border-radius:999px;font-size:14px;white-space:nowrap;flex:none;border:1px solid ${active ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.1)'};background:${active ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.05)'};color:${active ? '#fff' : '#d1d5db'}`;
      b.innerHTML = label + (count ? `<span style="min-width:20px;height:20px;border-radius:10px;background:#fff;color:#111;font-size:12px;font-weight:600;display:inline-flex;align-items:center;justify-content:center">${count}</span>` : '');
      return b;
    };
    const icon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>';
    if (landing) {
      pills.innerHTML = '';
      pills.appendChild(pill(icon + 'Filters', 0, false));
      if (newPill) pills.appendChild(pill('<span style="width:7px;height:7px;border-radius:4px;background:#6ee7b7"></span>New · 64', 0, false));
      return;
    }
    pills.style.display = 'none';
    const row = bar.querySelector('[data-results-row] > div');
    if (!row) return;
    row.style.gap = '6px';
    const f = pill(icon + 'Filters', n || '', n > 0);
    row.insertBefore(f, row.firstChild);
    const sel = row.querySelector('select');
    if (sel) { sel.style.maxWidth = '7rem'; sel.style.paddingLeft = '10px'; sel.style.paddingRight = '22px'; sel.style.height = '44px'; for (const o of sel.options) o.textContent = o.textContent.replace('Year — newest first', 'Newest').replace('Year — oldest first', 'Oldest').replace('Length — longest first', 'Longest'); }
    const grp = row.querySelector('[role=group]'); if (grp) { grp.style.height = '44px'; grp.style.alignItems = 'center'; grp.querySelectorAll('button').forEach(b => { b.style.height = '38px'; b.style.width = '40px'; b.style.justifyContent = 'center'; if (b.getAttribute('aria-pressed') === 'true') b.style.display = 'none'; }); }
  }, [landing, newPill]),
  // R8: filters as a bottom sheet with 44px choices and a live "Show N" button
  sheet: (page, { count = 34 } = {}) => page.evaluate(count => {
    const css = `
      #__sheet{position:fixed;inset:0;z-index:100;font-family:inherit}
      #__sheet .bd{position:absolute;inset:0;background:rgba(0,0,0,.62)}
      #__sheet .sh{position:absolute;left:0;right:0;bottom:0;height:86%;background:#1c1c1c;border-radius:16px 16px 0 0;display:flex;flex-direction:column;box-shadow:0 -10px 40px rgba(0,0,0,.6)}
      #__sheet .gr{width:36px;height:5px;border-radius:3px;background:rgba(255,255,255,.25);margin:8px auto 2px}
      #__sheet .hd{display:flex;align-items:center;justify-content:space-between;padding:6px 16px 10px;border-bottom:1px solid rgba(255,255,255,.07)}
      #__sheet .hd b{font-size:17px;color:#fff;font-weight:600}
      #__sheet .hd a{font-size:15px;color:#d1d5db;text-decoration:underline;text-underline-offset:3px}
      #__sheet .bo{flex:1;overflow:auto;padding:4px 16px 16px}
      #__sheet h4{margin:16px 0 8px;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#9ca3af;font-weight:600}
      #__sheet .cs{display:flex;flex-wrap:wrap;gap:8px}
      #__sheet .c{height:44px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#e5e7eb;font-size:15px;display:inline-flex;align-items:center;gap:8px}
      #__sheet .c i{font-style:normal;color:#9ca3af;font-size:13px}
      #__sheet .c.on{background:#fff;color:#111;border-color:#fff}
      #__sheet .c.on i{color:#444}
      #__sheet .c.off{opacity:.38}
      #__sheet .yr{display:flex;gap:10px;margin-top:10px}
      #__sheet .yr div{flex:1;height:44px;border-radius:10px;border:1px solid rgba(255,255,255,.14);display:flex;align-items:center;padding:0 12px;color:#fff;font-size:16px}
      #__sheet .yr span{color:#9ca3af;font-size:13px;margin-right:8px}
      #__sheet .ft{padding:10px 16px calc(10px + env(safe-area-inset-bottom));border-top:1px solid rgba(255,255,255,.07);background:#1c1c1c}
      #__sheet .go{height:50px;border-radius:12px;background:#fff;color:#111;font-weight:600;font-size:16px;display:flex;align-items:center;justify-content:center}
      #__sheet .add{height:44px;border-radius:10px;border:1px dashed rgba(255,255,255,.2);color:#9ca3af;display:flex;align-items:center;padding:0 12px;font-size:15px;margin-top:8px}`;
    const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    const d = document.createElement('div'); d.id = '__sheet';
    d.innerHTML = `<div class="bd"></div><div class="sh"><div class="gr"></div>
      <div class="hd"><b>Filters</b><a>Clear all</a></div>
      <div class="bo">
        <h4>Years</h4><div class="cs"><span class="c">1990s</span><span class="c">2000s</span><span class="c">2010s</span></div>
        <div class="yr"><div><span>From</span>1995</div><div><span>To</span>2005</div></div>
        <h4>Event</h4><div class="cs"><span class="c on">Rock am Ring ✕</span><span class="c on">Rockpalast ✕</span></div>
        <div class="add">＋ Add an event…</div>
        <h4>Country</h4><div class="add">＋ Add a country…</div>
        <h4>Source</h4><div class="cs"><span class="c on">Pro-shot <i>34</i></span><span class="c off">Audience <i>0</i></span></div>
        <h4>Quality</h4><div class="cs"><span class="c off">HD 1080 <i>0</i></span><span class="c">HD 720 <i>2</i></span><span class="c">SD <i>30</i></span><span class="c">Low-res <i>2</i></span></div>
        <h4>Standard</h4><div class="cs"><span class="c">PAL <i>23</i></span><span class="c">NTSC <i>9</i></span></div>
        <h4>Length</h4><div class="cs"><span class="c off">Under 10 min <i>0</i></span><span class="c">10–30 min <i>7</i></span><span class="c">30–60 min <i>15</i></span><span class="c">1–1½ h <i>9</i></span><span class="c">Over 1½ h <i>3</i></span></div>
        <h4>Added</h4><div class="cs"><span class="c">New <i>in the last 90 days</i></span></div>
      </div>
      <div class="ft"><div class="go">Show ${count} shows</div></div></div>`;
    document.body.appendChild(d);
  }, count),
  // R6b: a letter index at the right edge while the A–Z list is on screen
  letterIndex: (page, active = 'P') => page.evaluate(active => {
    const bar = document.querySelector('[data-filter-bar]').getBoundingClientRect();
    const tab = document.querySelector('nav[aria-label=Main]').getBoundingClientRect();
    const letters = '#ABCDEFGHIJKLMNOPQRSTUVWYZ'.split('');
    document.getElementById('all-artists').closest('section').style.paddingRight = '30px';
    const top = bar.bottom + 8, h = tab.top - 8 - top;
    const ix = document.createElement('div');
    ix.style.cssText = `position:fixed;right:2px;top:${top}px;height:${h}px;width:28px;z-index:60;display:flex;flex-direction:column;justify-content:space-between;align-items:center;font:600 11px/1 'DM Sans',system-ui;color:#d1d5db`;
    ix.innerHTML = letters.map(l => `<span style="${l === active ? 'color:#fff;background:rgba(255,255,255,.18);border-radius:9px;padding:2px 5px' : ''}">${l}</span>`).join('');
    document.body.appendChild(ix);
    const bub = document.createElement('div');
    bub.style.cssText = `position:fixed;right:44px;top:${top + h * (letters.indexOf(active) / letters.length) - 22}px;width:56px;height:56px;border-radius:28px;background:rgba(40,40,40,.95);border:1px solid rgba(255,255,255,.15);z-index:61;display:flex;align-items:center;justify-content:center;font:400 34px/1 'Bebas Neue',Impact,sans-serif;color:#fff`;
    bub.textContent = active;
    document.body.appendChild(bub);
  }, active),
  // R9: copies stacked, what differs lit
  copiesDiff: page => page.evaluate(() => {
    const label = [...document.querySelectorAll('[role=dialog] p')].find(p => /recordings of this show/.test(p.textContent));
    const ol = label.nextElementSibling;
    const rows = [...ol.children].map(li => li.firstElementChild);
    const data = rows.map(r => { const s = r.querySelectorAll(':scope > span'); return { q: s[0].textContent, len: s[1].textContent, specs: s[2].textContent.split('·').map(t => t.trim()).filter(Boolean), current: r.tagName !== 'BUTTON' }; });
    const all = data.map(d => new Set(d.specs));
    const common = [...all[0]].filter(t => all.every(s => s.has(t)));
    rows.forEach((r, i) => {
      const d = data[i];
      r.style.cssText = 'display:block;width:100%;text-align:left;padding:12px 12px;margin:0 -8px;border-radius:10px;' + (d.current ? 'background:rgba(255,255,255,.07)' : '');
      const diff = d.specs.filter(t => !common.includes(t));
      const same = d.specs.filter(t => common.includes(t));
      r.innerHTML = `<div style="display:flex;align-items:baseline;gap:10px;font-size:15px;color:#fff;font-weight:500">${d.q}<span style="color:#e5e7eb;font-weight:400">${d.len}</span>
        <span style="margin-left:auto;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${d.current ? '#d1d5db' : '#9ca3af'};font-weight:600">${d.current ? 'This copy' : 'Open ›'}</span></div>
        <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">${diff.map(t => `<span style="font-size:13px;color:#fff;background:rgba(250,204,21,.16);border:1px solid rgba(250,204,21,.35);border-radius:6px;padding:2px 7px">${t}</span>`).join('')}</div>
        <div style="margin-top:6px;font-size:12px;color:#9ca3af">Same: ${same.join(' · ')}</div>`;
    });
    label.insertAdjacentHTML('beforeend', '<span style="margin-left:auto;font-weight:400;letter-spacing:0;text-transform:none;color:#9ca3af">differences lit</span>');
    label.style.display = 'flex';
  }),
  // R11: one-line docked header on a phone
  slimDock: page => page.evaluate(() => {
    const d = document.querySelector('[role=dialog]');
    const head = [...d.querySelectorAll('div,header')].find(x => getComputedStyle(x).position === 'sticky');
    const name = d.querySelector('h2')?.textContent || '';
    const sub = (head.querySelector('p')?.textContent || '').split('·')[0].trim();
    head.style.visibility = 'hidden';
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:0;right:0;top:0;height:56px;z-index:200;background:linear-gradient(#262626,#1d1d1d);border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:10px;padding:0 64px 0 18px;box-shadow:0 8px 16px rgba(20,20,20,.9)';
    bar.innerHTML = `<span style="font:400 24px/1 'Bebas Neue',Impact,sans-serif;color:#fff;letter-spacing:.02em;white-space:nowrap">${name}</span><span style="font-size:14px;color:#d1d5db;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sub}</span><span style="position:absolute;right:14px;top:8px;width:40px;height:40px;border-radius:20px;background:rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px">✕</span>`;
    document.body.appendChild(bar);
    const sc = [d, ...d.querySelectorAll('*')].find(el => el.scrollHeight > el.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowY));
    const h = head.getBoundingClientRect();
    sc.scrollTop = sc.scrollTop + (h.bottom - 56);
  }),
  // Outline every control under 44px, with its size
  outlineSmall: page => page.evaluate(() => {
    const vh = innerHeight;
    for (const el of document.querySelectorAll('button, a[href], input, select')) {
      const b = el.getBoundingClientRect();
      if (!b.width || b.bottom < 0 || b.top > vh || b.right < 0 || b.left > innerWidth) continue;
      if (b.width >= 44 && b.height >= 44) continue;
      const o = document.createElement('div');
      o.style.cssText = `position:fixed;left:${b.left}px;top:${b.top}px;width:${b.width}px;height:${b.height}px;outline:2px solid #ff4d4f;outline-offset:0;z-index:9999;pointer-events:none`;
      const t = document.createElement('span'); t.textContent = `${Math.round(b.height)}px`;
      t.style.cssText = 'position:absolute;right:0;bottom:100%;background:#ff4d4f;color:#fff;font:600 10px/1 system-ui;padding:2px 3px;border-radius:2px';
      o.appendChild(t); document.body.appendChild(o);
    }
  }),
};

const P = {};

// 1. Tile size: Pearl Jam's run, iPhone and Galaxy — today, two columns, three columns, rows
P.tiles = async () => {
  for (const dev of ['iphone', 'android']) {
    const { page, ctx } = await newPhone(dev);
    await page.goto(BASE + '?q=pearl%20jam', { waitUntil: 'domcontentloaded' }); await settle(page, 1500);
    await page.evaluate(() => window.scrollTo(0, 0)); await wait(400);
    await snap(page, 'tiles', 'before');
    await AFTER.twoCols(page); await settle(page, 900);
    await snap(page, 'tiles', 'after');
    await AFTER.compactHeader(page); await settle(page, 600);
    await snap(page, 'tiles', 'after2');
    await page.reload({ waitUntil: 'domcontentloaded' }); await settle(page, 1400);
    await AFTER.threeCols(page); await AFTER.compactHeader(page); await settle(page, 900);
    await snap(page, 'tiles', 'three');
    await page.reload({ waitUntil: 'domcontentloaded' }); await settle(page, 1400);
    await AFTER.rows(page); await AFTER.compactHeader(page); await settle(page, 900);
    await snap(page, 'tiles', 'rows');
    await ctx.close();
  }
};

// 2. Landing: first screen today vs compact masthead + slim bar + two columns (+ New pill)
P.landing = async () => {
  for (const dev of ['iphone', 'se']) {
    const { page, ctx } = await newPhone(dev);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await settle(page, 1500);
    await snap(page, 'landing', 'before');
    await AFTER.compactMasthead(page); await AFTER.slimBar(page, { landing: true, newPill: true }); await AFTER.twoCols(page); await settle(page, 900);
    await snap(page, 'landing', 'after');
    const sec = await page.evaluate(() => ({ all: Math.round(document.getElementById('all-artists').getBoundingClientRect().top + scrollY), vh: innerHeight }));
    RESULTS[`landing-allArtists-after-${dev}`] = sec;
    await ctx.close();
  }
  // landscape
  const { page, ctx } = await newPhone('land');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await settle(page, 1500);
  await snap(page, 'landscape', 'before');
  await AFTER.hideMasthead(page); await AFTER.slimBar(page, { landing: true, newPill: true }); await settle(page, 700);
  await snap(page, 'landscape', 'after');
  await ctx.close();
};

// 3. Search with the keyboard up: "brasil" on the Galaxy
P.keyboard = async () => {
  const { page, ctx } = await newPhone('android');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await settle(page, 1500);
  await search(page).tap(); await search(page).pressSequentially('brasil', { delay: 30 }); await settle(page, 900);
  await snap(page, 'keyboard', 'before', { keyboard: true });
  await AFTER.compactHeader(page); await AFTER.twoCols(page); await settle(page, 900);
  await snap(page, 'keyboard', 'after', { keyboard: true });
  await blur(page);
  await snap(page, 'keyboard', 'after-dismissed');
  await ctx.close();
};

// 4. Four filters on: today's bar vs one row of controls
P.bar = async () => {
  const { page, ctx } = await newPhone('iphone');
  await page.goto(BASE + '?from=1995&to=2005&festival=rock-am-ring,rockpalast&source=proshot', { waitUntil: 'domcontentloaded' }); await settle(page, 1600);
  await snap(page, 'bar', 'before');
  await AFTER.slimBar(page); await AFTER.twoCols(page); await settle(page, 900);
  await snap(page, 'bar', 'after');
  await AFTER.sheet(page, { count: 34 }); await wait(400);
  await snap(page, 'sheet', 'after');
  await ctx.close();
  // More filters on the landing page, today
  const b = await newPhone('iphone');
  await b.page.goto(BASE, { waitUntil: 'domcontentloaded' }); await settle(b.page, 1400);
  await b.page.evaluate(() => { document.querySelector('[data-filter-bar] .overflow-x-auto').scrollLeft = 400; });
  await b.page.getByRole('button', { name: /^More filters/ }).first().tap(); await wait(700);
  await b.page.evaluate(() => { const pop = [...document.querySelectorAll('[data-side]')].pop(); (pop.querySelector('.overflow-y-auto') || pop).scrollTop = 99999; });
  await wait(400);
  await snap(b.page, 'sheet', 'before');
  await b.ctx.close();
};

// 5. A–Z: the list at P today vs a letter index
P.az = async () => {
  const { page, ctx } = await newPhone('iphone');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await settle(page, 1500);
  await page.locator('nav[aria-label="Main"] button', { hasText: 'Artists' }).tap(); await wait(2200);
  await snap(page, 'az', 'before');
  await AFTER.letterIndex(page, 'P'); await page.evaluate(() => { const s = document.querySelector('section[aria-label="P"]'); window.scrollTo({ top: s.getBoundingClientRect().top + scrollY - 125, behavior: 'instant' }); }); await wait(900);
  await snap(page, 'az', 'after');
  // The bug: tapping Pearl Jam lands at the bottom; the fix lands at the top
  await page.reload({ waitUntil: 'domcontentloaded' }); await settle(page, 1300);
  await page.locator('nav[aria-label="Main"] button', { hasText: 'Artists' }).tap(); await wait(2200);
  for (let i = 0; i < 40; i++) {
    const t = await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Pearl Jam')).getBoundingClientRect().top);
    if (t > 200 && t < 500) break;
    await page.mouse.wheel(0, Math.min(600, t - 300)); await wait(200);
  }
  await wait(600);
  await snap(page, 'azjump', 'tap');
  await page.locator('button', { hasText: /^Pearl Jam\s*\d+$/ }).first().tap(); await wait(1800);
  await snap(page, 'azjump', 'before');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await wait(700);
  await snap(page, 'azjump', 'after');
  await ctx.close();
};

// 6. Initials with another word: "ratm swu"
P.initials = async () => {
  const { page, ctx } = await newPhone('android');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await settle(page, 1400);
  await search(page).tap(); await type(page, 'ratm swu'); await blur(page);
  await snap(page, 'initials', 'before');
  await type(page, 'rage swu'); await blur(page);
  await page.evaluate(() => { const i = document.querySelector('input[type=search]'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(i, 'ratm swu'); const h = [...document.querySelectorAll('h2')].find(h => h.textContent.startsWith('“')); if (h) h.textContent = '“ratm swu”'; });
  await AFTER.compactHeader(page); await AFTER.twoCols(page); await settle(page, 700);
  await snap(page, 'initials', 'after');
  await ctx.close();
};

// 7. Copies on a phone, and the docked header
P.drawer = async () => {
  const { page, ctx } = await newPhone('iphone');
  await page.goto(BASE + '?show=7c860a05fcce', { waitUntil: 'domcontentloaded' }); await settle(page, 1700);
  const toCopies = () => page.evaluate(() => { const d = document.querySelector('[role=dialog]'); const p = [...d.querySelectorAll('p')].find(p => /recordings of this show/.test(p.textContent)); const sc = [d, ...d.querySelectorAll('*')].find(el => el.scrollHeight > el.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)); sc.scrollTop += p.getBoundingClientRect().top - 170; });
  await toCopies(); await wait(700);
  await snap(page, 'copies', 'before');
  await AFTER.copiesDiff(page); await wait(400);
  await toCopies(); await wait(500);
  await snap(page, 'copies', 'after');
  await page.goto(BASE + '?show=8349e6f453e8', { waitUntil: 'domcontentloaded' }); await settle(page, 1600);
  await page.evaluate(() => { const d = document.querySelector('[role=dialog]'); const sc = [d, ...d.querySelectorAll('*')].find(el => el.scrollHeight > el.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)); sc.scrollTop = 1250; });
  await wait(800);
  await snap(page, 'dock', 'before');
  await AFTER.slimDock(page); await wait(500);
  await snap(page, 'dock', 'after');
  await ctx.close();
};

// 8. Touch targets under 44px, outlined
P.targets = async () => {
  const { page, ctx } = await newPhone('iphone');
  await page.goto(BASE + '?q=pinkpop&festival=pinkpop', { waitUntil: 'domcontentloaded' }); await settle(page, 1500);
  await AFTER.outlineSmall(page); await wait(300);
  await snap(page, 'targets', 'before');
  await page.reload({ waitUntil: 'domcontentloaded' }); await settle(page, 1400);
  await AFTER.slimBar(page); await AFTER.compactHeader(page); await AFTER.twoCols(page); await settle(page, 800);
  await AFTER.outlineSmall(page); await wait(300);
  await snap(page, 'targets', 'after');
  await ctx.close();
};

await launch();
for (const k of only ? [only] : Object.keys(P)) {
  console.log('==', k);
  try { await P[k](); } catch (e) { console.log('ERROR', k, e.message.split('\n')[0]); }
}
writeFileSync(join(OUT, 'mock.json'), JSON.stringify(RESULTS, null, 1));
await close();

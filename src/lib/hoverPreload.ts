/**
 * Preload each card's hover still before it is hovered (owner, 2026-10-16).
 *
 * Loading it on hover took ~0.3–0.5 s on the live site: a round trip to
 * GitHub Pages for a ~36 KB WebP, which no amount of priority hides. So the
 * stills of the cards a person has stopped on are fetched ahead of the hover.
 *
 * Only where hovering exists — a fine pointer that can hover — and not when
 * the browser asks to save data. Only cards on screen (and a quarter screen
 * either side), and only once scrolling has rested for 250 ms, so a fast
 * scroll past a few hundred cards fetches nothing. New cards appearing (the
 * first load, a search, a filter) re-check once the page settles, and so does
 * a mouse move; the cards nearest the pointer go first. Checks run when the
 * browser is idle. Two at a time, at low priority, so the card images
 * themselves always win. A still is fetched once per page load.
 *
 * No IntersectionObserver per card (CLAUDE.md, Front-end performance): one
 * listener for the page reads card positions at rest, never during a scroll.
 * ShowCard marks each card with `data-hover-src`.
 */

const REST_MS = 250;          // scrolling must rest this long
const MOVE_GAP_MS = 400;      // re-check on mouse movement at most this often
const CONCURRENCY = 2;
const MARGIN = 0.25;          // of a screen, above and below

export function startHoverPreload(): () => void {
  if (typeof window === 'undefined') return () => {};
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return () => {};

  const asked = new Set<string>();
  let queue: string[] = [];
  let active = 0;
  let restTimer = 0;
  let lastMove = 0;
  let pointer: { x: number; y: number } | null = null;

  const pump = () => {
    while (active < CONCURRENCY && queue.length) {
      const src = queue.shift()!;
      if (asked.has(src)) continue;
      asked.add(src);
      active++;
      const img = new Image();
      img.fetchPriority = 'low';
      img.decoding = 'async';
      img.onload = img.onerror = () => { active--; pump(); };
      img.src = src;
    }
  };

  /** Queue the hover stills of the cards on screen, nearest the pointer first. */
  const scan = () => {
    // Nothing to hover while a show's drawer covers the page.
    if (document.querySelector('[role="dialog"]')) return;
    const h = window.innerHeight;
    const found: { src: string; d: number }[] = [];
    document.querySelectorAll<HTMLElement>('[data-hover-src]').forEach(card => {
      const src = card.dataset.hoverSrc;
      if (!src || asked.has(src)) return;
      const r = card.getBoundingClientRect();
      if (r.bottom < -h * MARGIN || r.top > h * (1 + MARGIN) || r.width === 0) return;
      const d = pointer ? Math.hypot(r.left + r.width / 2 - pointer.x, r.top + r.height / 2 - pointer.y) : r.top;
      found.push({ src, d });
    });
    queue = found.sort((a, b) => a.d - b.d).map(f => f.src);
    pump();
  };

  const whenIdle = (fn: () => void) => (window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout: 1000 }) : window.setTimeout(fn, 0));
  const scanSoon = (delay: number) => {
    window.clearTimeout(restTimer);
    restTimer = window.setTimeout(() => whenIdle(scan), delay);
  };

  const onScroll = () => {
    queue = [];                       // what was on screen has scrolled away
    scanSoon(REST_MS);
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    pointer = { x: e.clientX, y: e.clientY };
    const now = performance.now();
    if (now - lastMove < MOVE_GAP_MS) return;
    lastMove = now;
    scanSoon(50);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pointermove', onMove, { passive: true });
  // Cards arrive after the show data loads, and change with every search or
  // filter: re-check once the page has stopped changing for a moment.
  const watcher = new MutationObserver(() => scanSoon(300));
  watcher.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true });
  scanSoon(300);

  return () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('pointermove', onMove);
    watcher.disconnect();
    window.clearTimeout(restTimer);
    queue = [];
  };
}

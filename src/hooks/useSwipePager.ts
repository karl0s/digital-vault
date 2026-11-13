import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * Swipe between the stills in the drawer's image viewer, on a touch screen.
 * A mouse never drives it: the arrows, dots and arrow keys work as before.
 * docs/frontend.md, In-drawer screenshots and image viewer.
 *
 * It follows Apple's rules for fluid gestures (WWDC 2018, Designing Fluid
 * Interfaces): the strip moves 1:1 with the finger from wherever it was
 * grabbed; at release the gesture's momentum is projected forward to choose
 * the still, so a short flick is enough; a critically damped spring then
 * carries on at the finger's own speed, with no seam and no bounce; past the
 * first or last still the strip resists (a rubber band) rather than stopping
 * dead; and a touch on a strip still settling catches it where it is.
 * Up-and-down movement and pinch-zoom stay the browser's.
 *
 * Every frame is a transform written to the strip's style, never React state,
 * so a swipe renders nothing. React renders once, at release, when the still
 * changes (the counter and dots change with it), and the strip is re-based in
 * that same commit (the layout effect below), so nothing jumps. The stills are
 * the strip's own keyed <img>s, so no image is reloaded or swapped.
 */

/** Dark between two stills mid-swipe, px. */
const GAP = 24;
/** How far a finger moves before it is a swipe, px (Apple: about 10). */
const SLOP = 10;
/** Momentum projection: how a scroll view slows, per ms (Apple's 0.998). */
const DECELERATION = 0.998;
/** The release speed is read over the last stretch of the movement, ms. */
const VELOCITY_WINDOW = 100;
/** The settling spring: critically damped (no bounce), response 0.32 s. Per ms. */
const OMEGA = (2 * Math.PI) / 320;
/** How hard the ends resist (Apple's rubber-band constant). */
const RUBBER = 0.55;

interface Strip {
  /** The strip's offset now, px. */
  x: number;
  /** Stops the spring, while one runs. */
  stop: (() => void) | null;
  /** Where the strip goes once the new still is rendered: set at release. */
  rebase: { x: number; v: number } | null;
  index: number;
  onChange: (index: number) => void;
  el: HTMLElement | null;
}

function place(s: Strip, x: number) {
  s.x = x;
  if (s.el) s.el.style.transform = x ? `translate3d(${x}px, 0, 0)` : '';
}

/** Back in place at once, the neighbours hidden again. */
function rest(s: Strip) {
  s.stop?.();
  s.stop = null;
  place(s, 0);
  s.el?.removeAttribute('data-moving');
}

/**
 * Spring the strip home (x = 0) from where it is, starting at velocity `v`
 * (px/ms). The critically damped solution, x(t) = (x0 + (v + ωx0)t)e^(−ωt):
 * exact, so the velocity hand-off has no seam.
 */
function settle(s: Strip, v: number) {
  s.stop?.();
  s.el?.setAttribute('data-moving', '');
  const x0 = s.x;
  const t0 = performance.now();
  let frame = requestAnimationFrame(function tick(now) {
    const t = Math.max(0, now - t0);
    const decay = Math.exp(-OMEGA * t);
    const x = (x0 + (v + OMEGA * x0) * t) * decay;
    const speed = (v - OMEGA * (v + OMEGA * x0) * t) * decay;
    if (Math.abs(x) < 0.5 && Math.abs(speed) < 0.02) {
      s.stop = null;
      rest(s);
      return;
    }
    place(s, x);
    frame = requestAnimationFrame(tick);
  });
  s.stop = () => cancelAnimationFrame(frame);
}

interface SwipePagerOptions {
  /** Where a swipe can start: the viewer's picture area. */
  regionRef: RefObject<HTMLElement>;
  /**
   * What moves: the strip of stills. It must sit inside the frame that
   * carries the viewer's layoutId, never be it, so the frame itself never
   * moves. Each still is offset by var(--swipe-page) times its distance from
   * the one shown, and is visible only while the strip has data-moving.
   */
  stripRef: RefObject<HTMLElement>;
  /** The still shown. */
  index: number;
  count: number;
  /** Show another still (the viewer's setViewingIndex). */
  onChange: (index: number) => void;
  /** The viewer is open. */
  enabled: boolean;
}

export function useSwipePager({ regionRef, stripRef, index, count, onChange, enabled }: SwipePagerOptions): void {
  const strip = useRef<Strip>({ x: 0, stop: null, rebase: null, index, onChange, el: null });

  useLayoutEffect(() => { strip.current.onChange = onChange; });

  // A new still. Changed by a swipe, the strip carries on from where the
  // finger left it, re-based on the new still in the same commit, so it is
  // on screen in the same place. Changed by the arrows, dots or keys, it is
  // simply shown, as before.
  useLayoutEffect(() => {
    const s = strip.current;
    s.index = index;
    s.el = stripRef.current;
    const rebase = s.rebase;
    s.rebase = null;
    if (rebase) {
      place(s, rebase.x);
      settle(s, rebase.v);
    } else if (s.x || s.stop) {
      rest(s);
    }
  }, [index, stripRef]);

  useEffect(() => {
    const region = regionRef.current;
    const el = stripRef.current;
    if (!enabled || count < 2 || !region || !el) return;
    const s = strip.current;
    s.el = el;

    // Zoomed in (pinch), the finger pans the page, as it did before.
    const viewport = window.visualViewport;
    const zoomed = () => !!viewport && viewport.scale > 1.01;
    // Sideways movement is ours; up-and-down and pinch-zoom stay the browser's.
    const pan = CSS.supports('touch-action', 'pan-y pinch-zoom') ? 'pan-y pinch-zoom' : 'pan-y';
    const touchAction = () => { region.style.touchAction = zoomed() ? '' : pan; };
    touchAction();
    viewport?.addEventListener('resize', touchAction);

    let id: number | null = null; // the finger being followed
    let dragging = false;
    let startX = 0, startY = 0, from = 0;
    let page = 0, width = 0;
    let samples: { t: number; x: number }[] = [];
    let swallowClick = false;

    // The strip may travel from the first still to the last; past them it resists.
    const resist = (x: number) => {
      const hi = s.index * page;
      const lo = -(count - 1 - s.index) * page;
      const band = (over: number) => (over * width * RUBBER) / (width + RUBBER * over);
      return x > hi ? hi + band(x - hi) : x < lo ? lo - band(lo - x) : x;
    };

    const sample = (t: number) => {
      samples.push({ t, x: s.x });
      samples = samples.filter(p => t - p.t <= VELOCITY_WINDOW);
    };
    const velocity = () => {
      if (samples.length < 2) return 0;
      const a = samples[0], b = samples[samples.length - 1];
      return b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0;
    };

    const follow = (pointerId: number) => {
      dragging = true;
      el.setAttribute('data-moving', '');
      try { region.setPointerCapture(pointerId); } catch { /* the pointer is gone */ }
    };

    // Where the momentum would carry the strip, as a scroll view slows; the
    // still nearest that, one step at most and never past the ends.
    const release = (v: number) => {
      const projected = s.x + (v * DECELERATION) / (1 - DECELERATION);
      const step = Math.max(-s.index, Math.min(count - 1 - s.index,
        Math.max(-1, Math.min(1, Math.round(-projected / page)))));
      if (step === 0) {
        settle(s, v);
      } else {
        s.rebase = { x: s.x + step * page, v };
        s.onChange(s.index + step);
      }
    };

    const down = (e: PointerEvent) => {
      swallowClick = false;
      if (e.pointerType === 'mouse') return;
      if (!e.isPrimary) {
        // A second finger: a pinch, which is the browser's.
        if (id !== null) {
          id = null;
          if (dragging) { dragging = false; release(0); }
        }
        return;
      }
      // A primary pointer is always a new first finger, even if the last
      // one's pointerup never came.
      if (zoomed()) return;
      id = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      // Measured per gesture (the drawer may have turned with the phone): a
      // page is one still and the gap, or more if the still is narrower than
      // the area, so a neighbour always comes in from the edge.
      width = region.clientWidth;
      const still = el.offsetWidth;
      page = Math.max(still + GAP, (width + still) / 2);
      el.style.setProperty('--swipe-page', `${page}px`);
      samples = [];
      from = s.x;
      dragging = false;
      if (s.stop || s.x) {
        // Caught while settling (or left out of place): it stops under the finger.
        s.stop?.();
        s.stop = null;
        follow(e.pointerId);
        sample(e.timeStamp);
      }
    };

    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      if (!dragging) {
        const dx = e.clientX - startX, dy = e.clientY - startY;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < SLOP) return;
        if (Math.abs(dy) > Math.abs(dx)) { id = null; return; } // up or down: not a swipe
        startX += Math.sign(dx) * SLOP; // from here on, without a jump
        follow(e.pointerId);
      }
      place(s, resist(from + e.clientX - startX));
      sample(e.timeStamp);
    };

    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = null;
      if (!dragging) return; // a tap: the viewer's, as before
      dragging = false;
      swallowClick = true;
      sample(e.timeStamp);
      release(e.type === 'pointercancel' ? 0 : velocity());
    };

    // A click after a swipe is not a tap on the dark around the picture,
    // which would close the viewer.
    const click = (e: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.stopPropagation();
      e.preventDefault();
    };

    region.addEventListener('pointerdown', down);
    region.addEventListener('pointermove', move);
    region.addEventListener('pointerup', up);
    region.addEventListener('pointercancel', up);
    region.addEventListener('click', click, true);
    return () => {
      region.removeEventListener('pointerdown', down);
      region.removeEventListener('pointermove', move);
      region.removeEventListener('pointerup', up);
      region.removeEventListener('pointercancel', up);
      region.removeEventListener('click', click, true);
      viewport?.removeEventListener('resize', touchAction);
      region.style.touchAction = '';
      // Closed mid-swipe: the still goes back to its thumbnail from its place.
      s.rebase = null;
      rest(s);
    };
  }, [enabled, count, regionRef, stripRef]);
}

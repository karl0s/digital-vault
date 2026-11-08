/**
 * Reduced-motion helpers.
 *
 * CSS handles the declarative side (see styles/globals.css) and MotionConfig in
 * App.tsx handles motion/react. Neither covers programmatic scrolling: a
 * `window.scrollTo({ behavior: 'smooth' })` call ignores the user's preference
 * entirely, because the preference lives in CSS and this is JS. These wrap the
 * scroll calls the app makes so every path honours it.
 */

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function behavior(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}

export function scrollToTop(): void {
  window.scrollTo({ top: 0, behavior: behavior() });
}

/** The page to a y position: the jump to the artist list uses it. */
export function scrollToY(top: number): void {
  window.scrollTo({ top, behavior: behavior() });
}

/**
 * The page to a y position at once. For a view that has just replaced the one
 * before (an artist picked from the A–Z list, Back, a cleared search): there
 * is nothing to scroll through, and a smooth scroll is cut short when the page
 * shortens under it — an artist used to open at the bottom of its shows
 * (docs/ux-research/06-mobile-audit.md, R1). 'instant', not 'auto': the page
 * sets `scroll-behavior: smooth`, which 'auto' would follow.
 */
export function jumpToY(top: number): void {
  window.scrollTo({ top, behavior: 'instant' });
}

/** A scrolling element back to its top: the docked drawer header uses it. */
export function scrollContainerToTop(el: Element | null | undefined): void {
  el?.scrollTo({ top: 0, behavior: behavior() });
}

export function scrollIntoView(
  el: Element | null | undefined,
  block: ScrollLogicalPosition = 'start',
): void {
  el?.scrollIntoView({ behavior: behavior(), block });
}

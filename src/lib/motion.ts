/**
 * Reduced-motion helpers.
 *
 * CSS handles the declarative side (see styles/globals.css) and MotionConfig in
 * App.tsx handles motion/react. Neither covers programmatic scrolling: a
 * `window.scrollTo({ behavior: 'smooth' })` call ignores the user's preference
 * entirely, because the preference lives in CSS and this is JS. These wrap the
 * two scroll calls the app makes so every path honours it.
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

export function scrollIntoView(
  el: Element | null | undefined,
  block: ScrollLogicalPosition = 'start',
): void {
  el?.scrollIntoView({ behavior: behavior(), block });
}

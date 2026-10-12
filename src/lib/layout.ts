/**
 * The page's one content width (owner, 2026-10-13).
 *
 * The sidebar went, and the content kept the width it had beside it, centred:
 * from lg the window less 16rem (the old sidebar), capped at the site's
 * 1924px; below lg, the full width. The filter bar, Featured shows, the artist
 * list and every results grid use it, so they share one left edge at every
 * size — the misaligned top search bar was the reason for the change.
 */
export const CONTENT_WIDTH =
  'mx-auto w-full max-w-[1924px] px-4 md:px-8 lg:max-w-[min(1924px,calc(100vw-16rem))]';

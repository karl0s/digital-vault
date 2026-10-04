# Proximity Playground — Reference & Progress Notes

## Goal
Explore proximity-based hover interactions for the show card row. Instead of a binary on/off
hover state, cards scale and lift in response to cursor *distance* — creating an analog, continuous
effect like the macOS Dock. The goal is to find settings that feel alive without being distracting,
and establish whether this is worth integrating into `FeaturedRows`.

Inspired by: `t = Math.max(0, 1 - distance / radius)` → `scale = 1 + t * (peakScale - 1)`

---

## Versions

| File | Description |
|---|---|
| `v1-magnetic-cards.tsx` | 7 mock show cards with proximity scaling. Sliders for radius, peak scale, vertical lift, and falloff curve (linear ↔ gaussian). Debug influence ring overlay. |
| `v2-proximity-row.tsx` | Real Featured row (11 actual shows, real images, exact FeaturedRow markup). Existing ShowCard hover effects unchanged — only the trigger changes from binary onMouseEnter/Leave to a continuous MotionValue driven by cursor proximity. Single Radius slider. |
| `v3-multi-layout.tsx` | Scalability test: two horizontal scroll rows + a full CSS search results grid, all 37 cards tracked by a single pointer handler. Verifies that the geometry math (`r.width * 0.75`, `r.width * 0.375`) works at any card size and in any layout (flex scroll vs 1fr grid). |

---

## Key Decisions / Techniques

### Width conservation — no horizontal shift, no overlap

CSS `transform: scale()` doesn't affect layout — cards visually overlap but the row doesn't reflow.
To guarantee no overlap and no row shift, v1 uses **`flex-basis`** manipulation on the card wrappers instead.

**The invariant**: `sum(all card widths) = W_total` at every frame.

Math:
1. Measure container inner width: `W_total = containerWidth - (N-1) × GAP_PX`
2. Compute raw desired width per card: `raw_i = W_base × (1 + t_i × (peakScale - 1))`
3. Normalize: `k = W_total / sum(raw)`, then `final_i = raw_i × k`

When one card gains `+Δ` width, the others collectively lose `-Δ`. Gaps stay constant at `GAP_PX`.

### Height — automatic via aspect-ratio

The thumbnail `div` uses `aspect-ratio: 4/3`. When `flex-basis` (width) increases, height grows proportionally with no extra code. No CSS transform on the thumbnail at all.

### Bottom edge anchoring

The flex container is `position: absolute; bottom: 0` within a fixed-height tracking zone.
`items-end` aligns all card-wrapper bottoms to the container bottom.
Result: `thumbnail_bottom = container_bottom - text_height` = fixed Y for every card, always.
As a card grows wider (and taller), it expands upward. Text labels stay at a fixed Y.

### Proximity math
Two falloff curves blended via the Falloff slider (0 = pure linear, 1 = pure gaussian):

- **Linear**: `t = max(0, 1 - dist / radius)` — uniform cone falloff, hard cutoff at radius
- **Gaussian**: `t = exp(-dist² / 2σ²)` where `σ = radius / 3` — smooth bell curve, ~zero at radius edge

Blend: `t = tLinear × (1 - gaussian) + tGaussian × gaussian`

### Direct DOM writes — zero React renders per frame
`pointermove` sets `card.style.flexBasis` directly on each card wrapper. Settings read from
`settingsRef` (mirrors state) so the handler never has stale closures without needing to be re-created.

### Transition strategy
- **During tracking**: `transition: none` — immediate layout response per frame
- **On `pointerleave`**: `transition: flex-basis 600ms ease` → animate back to equal widths, then restore natural `flex: 1 1 0` after 650ms

### Debug ring
Repositioned via `Object.assign(ring.style, ...)` on every `pointermove` — zero React renders.

---

### v2 — MotionValue-driven hover (no binary trigger)

The key insight: the existing hover effects (scale, gradient overlay, badge, duration text) are all
percentage-based interpolations. By replacing `isHovered: boolean` with `strength: MotionValue<number>`,
every effect transitions proportionally to cursor distance rather than snapping on/off.

**MotionValue as the bus**: one `motionValue(0)` per card, created once in a `useRef` (not a hook,
so safe inside the initializer). `useTransform(strength, [0, 1], [from, to])` derives each animated
property — scale, opacity, translateY — without React re-renders.

**Tracking (onPointermove)**: `strength.set(t)` — immediate, synchronous, no animation overhead.
At 60fps pointermove events the motion is already smooth.

**Leave (onPointerleave)**: `animate(mv, 0, { duration: 0.45, ease: [...] })` — Framer Motion
animates the MotionValue itself back to 0. Running animations are stored in a ref and cancelled
on re-entry so there's no conflict between the live tracking and the fade-out.

**Zero layout shift**: all effects (scale, opacity) are CSS `transform` / `opacity` — GPU composited,
no reflow. The cards' layout boxes never change.

---

### v3 — one pointer handler across mixed layouts

Two horizontal scroll rows and a 21-card `1fr` grid (37 cards) share **one** `pointermove`
listener on the container. Each event walks every card ref, reads `getBoundingClientRect()`, and
sets that card's `strength` MotionValue from the distance to its thumbnail centre.

- **Geometry is relative to the card's own width.** Thumbnail height is `r.width * 0.75` (4:3)
  and its centre `r.width * 0.375` below the top, so the same maths holds at any card size and in
  either layout. Cards scrolled out of a row return off-screen rects, fall outside the radius and
  read `t ≈ 0` with no special case.
- **Two signals per card, not one.** `strength` (analog, 0–1) drives only the thumbnail scale;
  `hover` (0 or 1, animated over 0.15 s in / 0.2 s out) drives the overlay, badge and duration, and
  flips only when the cursor is inside the thumbnail rectangle.
- **The clip container is never transformed.** The scaling `motion.div` sits inside the
  `overflow-hidden` rounded box, so the corner radius stays crisp at any scale.

## Live Site Integration
Not extracted, and it does not fit the live card as built. The v2/v3 cards drive their effects
through per-card `motion` components and MotionValues; since 2026-10-02 the live `ShowCard` has
**no motion components at all** — its hover layers are CSS (`group-hover`), because ~4 motion
components per card across ~1,200 cards was the drawer's main cost (`CLAUDE.md` → Front-end
performance, enforced by `npm run check:perf`). The landing is also no longer a horizontal row:
Featured is a grid (`GRID_COLS` in `FeaturedRows.tsx`).

An integration would have to drive CSS custom properties from the one pointer handler (no React
state, no motion components per card), limit itself to the cards on screen, and fall back to
ordinary hover on `pointer: coarse`, where proximity needs a cursor the device does not have.
Measure with `npm run perf` before and after.

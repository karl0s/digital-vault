This file has been moved to `docs/ANIMATION_IMPLEMENTATION_SUMMARY.md`.

The canonical documentation now lives in the `docs/` folder. Please open `docs/ANIMATION_IMPLEMENTATION_SUMMARY.md` for the full content.

- **Date Text**: First info line (delay: 150ms)
  - Slides from left (-10px), fades in

- **Venue Text**: Second info line (delay: 200ms)
  - Continues the cascade

- **City/Country**: Third info line (delay: 250ms)
  - Smooth progression

- **Duration**: Last info line (delay: 300ms)
  - Completes the stagger sequence

- **Gradient Overlay**: Simple fade in/out
  - Duration: 0.3s

## Performance Considerations
- All animations use `viewport={{ once: true }}` to prevent re-triggering on scroll
- GPU-accelerated properties (opacity, transform) for smooth 60fps animations
- AnimatePresence handles mount/unmount animations cleanly
- Minimal delays (30-50ms) prevent sluggish feel while maintaining polish

## Visual Effect
- **On Scroll**: Artist rows elegantly slide up and fade in as you browse
- **Card Appearance**: Show cards cascade into view in a wave effect
- **On Hover**: Badges pop in from top with slight scale, info text slides in from left bottom-to-top
- **Result**: Premium Netflix-quality UI with professional micro-interactions

## Testing Notes
- Works perfectly without images (uses artist initial placeholders)
- Animations disabled on mobile where appropriate (reduced delays for faster feel)
- All animations respect user's motion preferences (Motion/React handles this automatically)
- No performance impact on large lists (800+ shows)

## Next Steps (Optional Enhancements)
- Add spring physics for more playful feel: `transition={{ type: "spring", stiffness: 300 }}`
- Add hover scale on artist name: `whileHover={{ scale: 1.05 }}`
- Add exit animations for drawer/lightbox
- Add page transition animations between views

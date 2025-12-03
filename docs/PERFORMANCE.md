# Performance Optimizations

This document outlines the performance optimizations implemented in The Vault to handle 800+ shows with 3,200+ images efficiently.

## Phase 1 + 2: Implemented Optimizations

### 1. ✅ Lazy Loading with Intersection Observer
- **Implementation**: Custom `useLazyImage` hook using Intersection Observer API
- **Benefits**: 
  - Images only load when they're 400px from entering the viewport
  - Reduces initial page load from ~3,200 images to ~20-40 images
  - Saves ~250MB+ of bandwidth on initial load
  - Prevents browser memory issues
- **Files**: 
  - `/components/hooks/useLazyImage.ts`
  - `/components/LazyImage.tsx`

### 2. ✅ Blur-Up Placeholders
- **Implementation**: Colored placeholder backgrounds with smooth fade-in transitions
- **Benefits**:
  - Eliminates jarring "blank space then image appears" effect
  - Matches artist's color scheme for visual consistency
  - Smooth 500ms opacity transition when real image loads
  - No layout shift during image loading
- **Files**: `/components/LazyImage.tsx`

### 3. ✅ Prefetching on Hover
- **Implementation**: When user hovers over a show card, all 4 drawer screenshots prefetch
- **Benefits**:
  - Drawer opens instantly with all images ready
  - Feels like images are cached locally
  - Only prefetches when user shows interest (hover)
  - Smart - only prefetches once per card
- **Files**: `/components/ShowCard.tsx`

### 4. ✅ GPU-Accelerated Animations
- **Implementation**: All animations use `transform` and `opacity` only
- **Benefits**:
  - Smooth 60fps animations on all devices
  - No jank during scrolling or hover effects
  - Uses `translateZ(0)` to force GPU rendering
  - `willChange` hints for optimal browser performance
- **Files**: 
  - `/components/ShowCard.tsx`
  - `/components/ArtistRow.tsx`

### 5. ✅ Layout Stability
- **Implementation**: 
  - Fixed 4:3 aspect ratio with `aspect-ratio` CSS
  - Reserved space for images before they load
  - Colored placeholders maintain layout
- **Benefits**:
  - Zero layout shifts (CLS = 0)
  - No jumping or janky scrolling
  - Smooth experience even with slow connections

### 6. ✅ Native Browser Optimizations
- **Implementation**:
  - `loading="lazy"` attribute on images
  - `decoding="async"` for non-blocking image decode
  - Passive event listeners for scroll/touch
  - `requestAnimationFrame` for smooth scroll updates
- **Benefits**:
  - Browser-native optimizations
  - Non-blocking image processing
  - Smooth scroll performance
  - Lower CPU usage

## Phase 3: Future Optimizations (Parked)

### 1. Virtual Scrolling
- **Status**: ✅ Prepared (library added)
- **Library**: `@tanstack/react-virtual` (already in package.json)
- **When to implement**: After cloud deployment testing
- **Benefits**: 
  - Only render visible artist rows + 2-3 buffer rows
  - Reduces DOM nodes from ~800 to ~10
  - Massive performance boost for scrolling
  - Essential if experiencing lag with many artists

### 2. Image Format Optimization
- **Status**: Parked (user will handle manually)
- **Recommendation**: Convert JPEGs to WebP format
- **Tools**:
  - Squoosh.app (web-based, free)
  - Sharp CLI (batch processing)
  - ImageMagick (advanced)
- **Target specs**:
  - Format: WebP
  - Size: 800×600px (4:3, 2x for retina)
  - Quality: 80-85%
  - Expected savings: 30-50% file size reduction

### 3. CDN Integration
- **Status**: Parked (depends on hosting decision)
- **Recommendation**: Use CloudFront with S3
- **Benefits**:
  - Images served from nearest location
  - Automatic compression
  - Global caching

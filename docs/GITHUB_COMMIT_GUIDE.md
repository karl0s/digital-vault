# GitHub Commit Guide - Animation Implementation

## Files to Commit

### Modified Files (2)
1. `/components/ArtistRow.tsx` - Added scroll-triggered and stagger animations
2. `/components/ShowCard.tsx` - Added hover stagger animations for badges and info

### Documentation Files (2) - Optional
3. `/ANIMATION_IMPLEMENTATION_SUMMARY.md` - Technical documentation
4. `/GITHUB_COMMIT_GUIDE.md` - This file (you can delete after committing)

## Git Commands

```bash
# Navigate to your repository
cd /path/to/your/concert-archive-repo

# Check current status
git status

# Add the modified files
git add components/ArtistRow.tsx
git add components/ShowCard.tsx

# Optional: Add documentation
git add ANIMATION_IMPLEMENTATION_SUMMARY.md

# Commit with descriptive message
git commit -m "Add Motion/React animations for scroll-triggered and hover effects

- Artist rows fade in from below when scrolling into view
- Show cards stagger into view with cascade effect (50ms desktop, 30ms mobile)
- Hover badges pop in with stagger (0ms, 50ms, 100ms delays)
- Info overlay text slides in from left with stagger (150-300ms delays)
- All animations use GPU-accelerated properties for 60fps performance
- AnimatePresence handles smooth mount/unmount transitions"

# Push to GitHub
git push origin main
# (or 'git push origin master' depending on your default branch)
```

## Verification Steps

After committing and pushing:

1. **Check GitHub Pages deployment**
   - Navigate to your GitHub Pages URL
   - Wait for GitHub Actions to complete (usually 1-2 minutes)
   - Refresh the page

2. **Test animations**
   - Scroll down to see artist rows fade in
   - Watch show cards cascade into view
   - Hover over cards to see badge/info stagger effects

3. **Test on mobile** (responsive)
   - Reduced stagger delays for snappier feel
   - Touch interactions work smoothly

## Troubleshooting

**If animations don't work after deployment:**

1. Check browser console for errors
2. Verify Motion/React is loading (should see no import errors)
3. Clear browser cache (Cmd+Shift+R or Ctrl+Shift+F5)
4. Check GitHub Actions logs for build errors

**If you need to revert:**
```bash
git revert HEAD
git push origin main
```

## Summary

✅ **What was added:**
- Motion/React (Framer Motion) library already available in your stack
- Scroll-triggered animations for artist rows
- Staggered card appearances
- Smooth hover micro-interactions

✅ **What works:**
- No dependencies needed (Motion/React already imported)
- Works with or without images
- Performance optimized for 800+ shows
- Mobile responsive with appropriate timing adjustments

✅ **What's preserved:**
- All existing functionality
- Keyboard navigation
- Search
- Drawer
- Lightbox
- Mobile hamburger menu

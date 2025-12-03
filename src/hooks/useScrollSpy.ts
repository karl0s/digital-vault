import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to track which artist is in the viewport center.
 * Updates currentArtistIndex based on scroll position.
 * Respects keyboard focus (doesn't update if keyboard navigation is active).
 */
export function useScrollSpy(
  sortedArtists: string[],
  focusedIndex: { artistIndex: number; showIndex: number } | null
) {
  const [currentArtistIndex, setCurrentArtistIndex] = useState<number>(0);
  const mainRef = useRef<HTMLDivElement>(null);

  // Keep refs for last-set index and pending debounce timer to avoid state churn
  const lastSetIndexRef = useRef<number>(0);
  const pendingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let rafId: number;
    
    const handleScroll = () => {
      // Cancel any pending animation frame
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      
      // Use requestAnimationFrame for instant, smooth updates
      rafId = requestAnimationFrame(() => {
        if (!mainRef.current || sortedArtists.length === 0) return;

        const viewportHeight = window.innerHeight;
        const viewportCenter = viewportHeight / 2;
        const scrollY = window.scrollY;
        const documentHeight = document.documentElement.scrollHeight;

        // Find the closest artist based on viewport center
        let closestArtistIndex = 0;
        let minDistance = Infinity;

        sortedArtists.forEach((artist, index) => {
          const element = document.getElementById(`artist-${artist.replace(/\s+/g, '-')}`);
          if (element) {
            const rect = element.getBoundingClientRect();
            const elementCenter = rect.top + rect.height / 2;
            const distance = Math.abs(elementCenter - viewportCenter);
            
            if (distance < minDistance) {
              minDistance = distance;
              closestArtistIndex = index;
            }
          }
        });

        // Special case: at the very top - only force first artist if we're REALLY at the top
        if (scrollY < 50 && closestArtistIndex !== 0) {
          closestArtistIndex = 0;
        }

        // Special case: at the very bottom - force last artist
        if (scrollY + viewportHeight >= documentHeight - 100 && closestArtistIndex !== sortedArtists.length - 1) {
          closestArtistIndex = sortedArtists.length - 1;
        }

        // Only update if no keyboard focus is active
        if (focusedIndex === null) {
          // Avoid unnecessary state updates — only change when index actually changes
          if (closestArtistIndex !== lastSetIndexRef.current) {
            // Debounce rapid toggles caused by small layout shifts or scroll jitter
            if (pendingTimeoutRef.current) {
              clearTimeout(pendingTimeoutRef.current as unknown as number);
            }
            pendingTimeoutRef.current = window.setTimeout(() => {
              setCurrentArtistIndex(closestArtistIndex);
              lastSetIndexRef.current = closestArtistIndex;
              pendingTimeoutRef.current = null;
            }, 90);
          }
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial call
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current as unknown as number);
        pendingTimeoutRef.current = null;
      }
    };
  }, [sortedArtists, focusedIndex]);

  // Update current artist when focused index changes (keyboard navigation)
  useEffect(() => {
    if (focusedIndex !== null) {
      // Immediate update for keyboard navigation; cancel any pending debounce
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current as unknown as number);
        pendingTimeoutRef.current = null;
      }
      setCurrentArtistIndex(focusedIndex.artistIndex);
      lastSetIndexRef.current = focusedIndex.artistIndex;
    }
  }, [focusedIndex]);

  return {
    currentArtistIndex,
    mainRef,
  };
}

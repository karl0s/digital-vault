import { useState, useEffect } from 'react';
import { Show } from '../App';

interface FocusedIndex {
  artistIndex: number;
  showIndex: number;
}

/**
 * Custom hook to manage keyboard navigation (arrow keys, enter).
 * Returns focused index state and helper functions for navigation.
 * Automatically exits keyboard mode on manual scroll (wheel/touch).
 */
export function useKeyboardNavigation(
  sortedArtists: string[],
  groupedShows: Record<string, Show[]>,
  selectedShow: Show | null,
  onShowClick: (show: Show) => void,
  onArtistJump: (artist: string) => void
) {
  const [focusedIndex, setFocusedIndex] = useState<FocusedIndex | null>(null);
  const [isKeyboardMode, setIsKeyboardMode] = useState(false);

  // Detect manual scroll (mouse wheel) to exit keyboard mode
  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout;

    const handleWheel = () => {
      // User is manually scrolling with mouse/wheel - exit keyboard mode
      if (isKeyboardMode && focusedIndex !== null) {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          setFocusedIndex(null);
          setIsKeyboardMode(false);
        }, 100);
      }
    };

    const handleTouchStart = () => {
      // User is manually scrolling with touch - exit keyboard mode
      if (isKeyboardMode && focusedIndex !== null) {
        setFocusedIndex(null);
        setIsKeyboardMode(false);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      clearTimeout(scrollTimeout);
    };
  }, [isKeyboardMode, focusedIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in search or drawer is open
      if (selectedShow || (e.target as HTMLElement).tagName === 'INPUT') {
        return;
      }

      // Initialize focus if not set
      if (focusedIndex === null && sortedArtists.length > 0) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
          e.preventDefault();
          setFocusedIndex({ artistIndex: 0, showIndex: 0 });
          setIsKeyboardMode(true);
          return;
        }
      }

      if (focusedIndex === null) return;

      const { artistIndex, showIndex } = focusedIndex;
      const currentArtist = sortedArtists[artistIndex];
      const currentArtistShows = groupedShows[currentArtist];

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          // Move right within current row - allow navigation through ALL shows
          if (showIndex < currentArtistShows.length - 1) {
            setFocusedIndex({ artistIndex, showIndex: showIndex + 1 });
          }
          break;

        case 'ArrowLeft':
          e.preventDefault();
          // Move left within current row
          if (showIndex > 0) {
            setFocusedIndex({ artistIndex, showIndex: showIndex - 1 });
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          // Move to next artist row
          if (artistIndex < sortedArtists.length - 1) {
            const nextArtist = sortedArtists[artistIndex + 1];
            const nextArtistShows = groupedShows[nextArtist];
            // Keep same horizontal position or go to last if out of bounds
            const newShowIndex = Math.min(showIndex, nextArtistShows.length - 1);
            const newArtistIndex = artistIndex + 1;
            setFocusedIndex({ artistIndex: newArtistIndex, showIndex: newShowIndex });
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          // Move to previous artist row
          if (artistIndex > 0) {
            const prevArtist = sortedArtists[artistIndex - 1];
            const prevArtistShows = groupedShows[prevArtist];
            // Keep same horizontal position or go to last if out of bounds
            const newShowIndex = Math.min(showIndex, prevArtistShows.length - 1);
            const newArtistIndex = artistIndex - 1;
            setFocusedIndex({ artistIndex: newArtistIndex, showIndex: newShowIndex });
          }
          break;

        case 'Enter':
          e.preventDefault();
          // Open selected show
          const focusedShow = currentArtistShows[showIndex];
          if (focusedShow) {
            onShowClick(focusedShow);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, sortedArtists, groupedShows, selectedShow, onShowClick, onArtistJump]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex) {
      const { artistIndex, showIndex } = focusedIndex;
      const artist = sortedArtists[artistIndex];
      const show = groupedShows[artist]?.[showIndex];
      if (show) {
        const element = document.getElementById(`show-${show.ShowID}`);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
    }
  }, [focusedIndex, sortedArtists, groupedShows]);

  return {
    focusedIndex,
    setFocusedIndex,
    isKeyboardMode,
    setIsKeyboardMode,
  };
}

import { useState, useEffect } from 'react';
import { Show } from '../App';
import { SAMPLE_SHOWS } from '../data/sampleShows';

interface ShowsData {
  generated_at: string;
  items: Show[];
}

/**
 * Custom hook to handle show loading, image mapping, and URL generation.
 * Encapsulates all data-loading logic and external URL resolution.
 */
export function useShows() {
  const [shows, setShows] = useState<Show[]>([]);
  const [imageMapping, setImageMapping] = useState<Record<string, string>>({});

  // Load shows and test image mappings on mount
  useEffect(() => {
    const base = import.meta.env.BASE_URL;

    // Load test images mapping (optional, for demo purposes)
    fetch(`${base}test-images.json`)
      .then(res => res.json())
      .then((data: Record<string, string>) => {
        setImageMapping(data);
      })
      .catch(() => {
        console.log('No test images found, using local paths');
      });

    const loadShows = async () => {
      const url = `${base}shows.json`;

      try {
        console.log('Loading shows from:', url);
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Failed with status: ${response.status}`);
        }

        const data = await response.json();

        // Support both formats: plain array OR { items: [...] }
        let items: Show[];

        if (Array.isArray(data)) {
          items = data as Show[];
        } else if (data && Array.isArray((data as any).items)) {
          items = (data as any).items as Show[];
        } else {
          throw new Error('Unexpected shows.json structure');
        }

        console.log(`✅ Successfully loaded ${items.length} shows from ${url}`);
        setShows(items);
      } catch (err) {
        console.error('⚠️ Failed to load shows.json, using sample data fallback.', err);
        setShows(SAMPLE_SHOWS);
      }
    };

    loadShows();
  }, []);

  /**
   * Get image URL for a show, supporting both test URLs and local fallbacks.
   * Checks imageMapping first (for external test URLs), then falls back to local paths.
   */
  const getImageUrl = (checksum: string, index: number): string | null => {
    const key = `${checksum}_0${index}`;
    const base = import.meta.env.BASE_URL;

    // Check if we have a test image URL
    if (imageMapping[key]) {
      return imageMapping[key];
    }
    // Fallback to local path under correct base
    return `${base}images/${checksum}_0${index}.jpg`;
  };

  return {
    shows,
    getImageUrl,
  };
}

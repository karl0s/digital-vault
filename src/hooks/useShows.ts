import { useState, useEffect, useMemo, useCallback } from 'react';
import { Show } from '../../App';

export type ImageSize = 'full' | 'thumb';
export type ImageUrlGetter = (checksum: string, index: number, size?: ImageSize) => string | null;

export function useShows() {
  const [shows, setShows] = useState<Show[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [imageManifest, setImageManifest] = useState<Record<string, number[]>>({});

  useEffect(() => {
    const base = import.meta.env.BASE_URL;

    // Load image manifest — maps checksum → available slot indices
    fetch(`${base}image-manifest.json`)
      .then(res => res.json())
      .then((data: Record<string, number[]>) => setImageManifest(data))
      .catch(() => {});

    const loadShows = async () => {
      const url = `${base}shows.json`;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed with status: ${response.status}`);
        const data = await response.json();

        let items: Show[];
        if (Array.isArray(data)) {
          items = data as Show[];
        } else if (data && Array.isArray((data as any).items)) {
          items = (data as any).items as Show[];
        } else {
          throw new Error('Unexpected shows.json structure');
        }

        // A record marked Hidden stays in shows.json as the back-end record of a
        // recording (metadata, images, provenance) but is never shown on the site.
        // Used where two records are the same recording and only one should appear.
        // Filtered here, at the single load point, so search, rows and counts all agree.
        setShows(items.filter(s => s.Hidden !== 'Yes'));
      } catch (err) {
        // Report the failure rather than substituting sample data. The old
        // fallback rendered five hardcoded shows, which looked like a working
        // archive that had lost 824 recordings — indistinguishable from real
        // data loss, and it hid the actual fault.
        console.error('Failed to load shows.json', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    loadShows();
  }, []);

  // Once per manifest, not once per call: every card calls getImageUrl, and
  // Object.keys copies all ~1,150 keys each time.
  const hasManifest = useMemo(() => Object.keys(imageManifest).length > 0, [imageManifest]);

  /**
   * Returns a URL for the given checksum+index, or null if that slot is not
   * present in the image manifest (i.e. the file doesn't exist on disk).
   *
   * `size: 'thumb'` gives the 640px WebP the build makes of slot 1 for cards
   * (scripts/thumbs.mjs). Only slot 1 has one; any other slot gets the
   * original. Anything shown large — the drawer header, the viewer — uses
   * the original.
   *
   * Stable between renders, and it has to be: it is a prop of every memoised
   * ShowCard, so a fresh function here would re-render all of them.
   */
  const getImageUrl = useCallback((checksum: string, index: number, size: ImageSize = 'full'): string | null => {
    const base = import.meta.env.BASE_URL;

    // If manifest is loaded, only return a URL for slots we know exist
    if (hasManifest) {
      const available = imageManifest[checksum];
      if (!available || !available.includes(index)) return null;
    }

    if (size === 'thumb' && index === 1) return `${base}thumbs/${checksum}_01.webp`;
    return `${base}images/${checksum}_0${index}.jpg`;
  }, [imageManifest, hasManifest]);

  return { shows, getImageUrl, error };
}

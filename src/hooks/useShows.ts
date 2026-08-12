import { useState, useEffect } from 'react';
import { Show } from '../../App';

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

        setShows(items);
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

  /**
   * Returns a URL for the given checksum+index, or null if that slot is not
   * present in the image manifest (i.e. the file doesn't exist on disk).
   */
  const getImageUrl = (checksum: string, index: number): string | null => {
    const base = import.meta.env.BASE_URL;

    // If manifest is loaded, only return a URL for slots we know exist
    if (Object.keys(imageManifest).length > 0) {
      const available = imageManifest[checksum];
      if (!available || !available.includes(index)) return null;
    }

    return `${base}images/${checksum}_0${index}.jpg`;
  };

  return { shows, getImageUrl, error };
}

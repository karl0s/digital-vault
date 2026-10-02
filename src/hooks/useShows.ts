import { useState, useEffect, useMemo, useCallback } from 'react';
import { Show } from '../../App';

export type ImageSize = 'full' | 'thumb';
export type ImageUrlGetter = (checksum: string, index: number, size?: ImageSize) => string | null;

export type NotesGetter = (show: Show) => string;

/**
 * Fetch JSON, or null on a 404 / network failure / bad body — the caller
 * decides what a missing file means.
 */
async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export function useShows() {
  const [shows, setShows] = useState<Show[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [imageManifest, setImageManifest] = useState<Record<string, number[]>>({});
  /**
   * Notes arrive after the shows, in a lookup of their own. Merging them into
   * the show objects would replace every object and re-render every memoised
   * card for text that only the drawer and the `note:` search read.
   */
  const [notes, setNotes] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;

    // Load image manifest — maps checksum → available slot indices
    fetch(`${base}image-manifest.json`)
      .then(res => res.json())
      .then((data: Record<string, number[]>) => setImageManifest(data))
      .catch(() => {});

    const loadShows = async () => {
      try {
        // The trimmed list the build derives from shows.json (scripts/site-data.mjs):
        // a quarter of the download, no Notes. The full file is the fallback,
        // so a build without the derived files still works — just heavier.
        let data = await fetchJson(`${base}shows-lite.json`);
        const lite = data !== null;
        if (!lite) {
          const response = await fetch(`${base}shows.json`);
          if (!response.ok) throw new Error(`Failed with status: ${response.status}`);
          data = await response.json();
        }

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

        // After the grid has what it needs. A failure only costs the Notes
        // column and `note:` search, so it is logged, not shown as an error.
        if (lite) {
          const notesData = await fetchJson(`${base}show-notes.json`);
          if (notesData && typeof notesData === 'object') setNotes(notesData as Record<string, string>);
          else console.warn('show-notes.json did not load; Notes are unavailable');
        }
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

  /**
   * A show's Notes: from show-notes.json once it has arrived, or from the
   * record itself when the full shows.json was loaded instead. '' until then.
   * The one place the site reads Notes — the drawer and search go through it.
   */
  const getNotes = useCallback<NotesGetter>(
    show => notes?.[show.ShowID] ?? show.Notes ?? '',
    [notes],
  );

  return { shows, getImageUrl, getNotes, error };
}

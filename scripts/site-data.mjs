/**
 * The show data the site actually loads, derived from public/shows.json.
 *
 *   shows-lite.json   every record, minus the fields below and minus Notes.
 *                     Loaded first: the grid, search and filters need nothing else.
 *   show-notes.json   { ShowID: Notes } — loaded right after the first paint.
 *   shows.json        the full records minus PRIVATE fields, replacing the copy
 *                     of public/shows.json that Vite publishes. The site's
 *                     fallback when the files above are missing.
 *
 * public/shows.json stays the source of truth. Measured 2026-10-02: the first
 * download went from 534 KB to 131 KB gzipped (2.8 MB -> 0.75 MB to parse);
 * Notes alone was 55% of the file and is only read by the drawer and the
 * `note:` search.
 *
 * DROPPED lists fields the site never reads — pipeline and provenance data.
 * A denylist rather than an allowlist on purpose: a new field added to
 * shows.json ships by default, so the worst case is a slightly bigger file,
 * never a blank in the drawer. `npm run check:perf` fails if the code starts
 * reading any field listed here; take it out of the list when that happens.
 *
 * PRIVATE lists fields that never leave the repo: no published file carries
 * them, the deployed shows.json included. PrivateNotes holds Claude's and Karl's
 * working notes (provenance, corrections, evidence); Notes holds only text from
 * the show's own sidecar files and is public. `npm run check:perf` fails if any
 * published file carries a PRIVATE field, or the site code reads one.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const DROPPED = [
  'FolderPath', 'FolderName', 'RepVideoFiles', 'RepVideoCount',
  'DuplicateKey', 'DuplicateOf', 'MasterDriveID', 'SourceCatalog', 'PrimaryCatalog', 'IsPrimary',
  'LastScannedAt', 'ExtractionWarnings', 'Lineage', 'SourceEquipment', 'Generation',
  'TotalSizeBytes', 'Width', 'Height',
];

export const PRIVATE = ['PrivateNotes'];

export const LITE_FILE = 'shows-lite.json';
export const NOTES_FILE = 'show-notes.json';
export const SHOWS_FILE = 'shows.json';

const without = (shows, fields) => {
  const drop = new Set(fields);
  return shows.map(s => Object.fromEntries(Object.entries(s).filter(([k]) => !drop.has(k))));
};

/** Returns every published data file's contents, as strings, from public/shows.json under `root`. */
export function buildSiteData(root) {
  const shows = JSON.parse(readFileSync(join(root, 'public/shows.json'), 'utf8'));
  const lite = without(shows, [...DROPPED, ...PRIVATE, 'Notes']);
  const notes = Object.fromEntries(shows.filter(s => s.Notes).map(s => [s.ShowID, s.Notes]));
  return {
    [LITE_FILE]: JSON.stringify(lite),
    [NOTES_FILE]: JSON.stringify(notes),
    [SHOWS_FILE]: JSON.stringify(without(shows, PRIVATE), null, 2) + '\n',
  };
}

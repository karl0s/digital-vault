/**
 * The results as a spreadsheet (docs/ux-research F10): every trader keeps one,
 * and reconciling 21 Pearl Jam recordings used to mean opening 21 drawers.
 *
 * Made in the browser from exactly what is on screen, in that order. UTF-8
 * with a BOM and CRLF line ends, so Excel opens the accents (Eurockéennes)
 * and the rows right; a cell that starts with = + - or @ gets a leading ' so
 * no spreadsheet runs it as a formula. Only published fields: nothing here is
 * in site-data.mjs's DROPPED or PRIVATE lists.
 */

import type { Show } from '../../App';
import { audioName, channelsName, containerName, isoDate, quality, songCount, sourceName, videoName } from './specs';
import { showLink, slugify } from './url';

const COLUMNS: [string, (s: Show) => string | number][] = [
  ['Artist', s => s.Artist],
  // Partial dates as "2001" or "2001-05", so the column still sorts (F7).
  ['Date', s => isoDate(s)],
  ['Event', s => s.EventOrFestival || ''],
  ['Venue', s => s.VenueName || ''],
  ['City', s => s.City || ''],
  ['Country', s => s.Country || ''],
  ['Type', s => (s.ContentType === 'Documentary' ? 'Documentary' : s.ParentShowID ? 'Excerpt' : 'Live')],
  ['Source', s => sourceName(s.RecordingType)],
  ['Quality', s => quality(s)?.label ?? ''],
  ['Resolution', s => quality(s)?.resolution.replace(' × ', 'x') ?? ''],
  // As the drawer: on HD records the field is unreliable.
  ['Standard', s => (quality(s)?.tier === 'hd' ? '' : s.TVStandard || '')],
  ['Video', s => videoName(s.VideoCodec)],
  ['Audio', s => [audioName(s.AudioCodec), channelsName(s.AudioChannels)].filter(Boolean).join(' ')],
  ['Container', s => containerName(s.Container)],
  // From the drive scan (2026-10-18); numbers as numbers, so the spreadsheet sorts them.
  ['Frame rate', s => s.FrameRate || ''],
  ['Scan', s => s.ScanType || ''],
  ['Video kbps', s => (s.VideoKbps ? parseInt(s.VideoKbps, 10) : '')],
  ['Audio kbps', s => (s.AudioKbps ? parseInt(s.AudioKbps, 10) : '')],
  ['Disc', s => s.DiscType || ''],
  ['Menu', s => s.Menu || ''],
  ['Chapters', s => (s.Chapters ? parseInt(s.Chapters, 10) : '')],
  ['Show size', s => s.ShowSizeHuman || ''],
  // A number, so the spreadsheet can sort and sum it.
  ['Length (min)', s => Math.round((parseInt(s.DurationSec, 10) || 0) / 60) || ''],
  ['Folder size', s => s.TotalSizeHuman || ''],
  ['Generation', s => s.Generation || ''],
  ['Lineage', s => s.Lineage || ''],
  ['Songs', s => songCount(s.Setlist) || ''],
  ['Setlist', s => s.Setlist || ''],
  ['Added', s => s.AddedOn || ''],
  ['Link', s => showLink(s.ShowID)],
];

function cell(value: string | number): string {
  let v = String(value);
  if (/^[=+\-@]/.test(v)) v = `'${v}`;
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function showsCsv(shows: Show[]): string {
  const rows = [COLUMNS.map(([name]) => name), ...shows.map(show => COLUMNS.map(([, get]) => get(show)))];
  return '﻿' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

/** "the-vault-pearl-jam-2026-10-16.csv": what the list is, and when it was taken. */
export function csvFilename(description: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const what = slugify(description).slice(0, 60).replace(/-+$/, '') || 'selection';
  return `the-vault-${what}-${today}.csv`;
}

export function downloadCsv(shows: Show[], description: string): void {
  const url = URL.createObjectURL(new Blob([showsCsv(shows)], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = csvFilename(description);
  document.body.append(a);
  a.click();
  a.remove();
  // After the click has handed the file to the browser.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

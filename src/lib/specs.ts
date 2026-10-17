/**
 * Technical specs in traders' words (docs/ux-research, finding F1).
 *
 * shows.json carries ffprobe's names (`mpeg2video`, `pcm_dvd`, `.vob`); a trader
 * reads MediaInfo's ("MPEG-2", "LPCM", "DVD-Video"). These turn one into the
 * other, and turn the stored picture size into the label traders compare first:
 * HD 1080, HD 720, SD 576, SD 480, or Low-res. One place, so the drawer, the
 * cards and any list view say the same thing.
 */

import type { Show } from '../../App';

export type QualityTier = 'hd' | 'sd' | 'low';

export interface Quality {
  /** "HD 1080", "SD 576", "Low-res". */
  label: string;
  tier: QualityTier;
  /** "1920 × 1080": the stored size (DVD pixels are not square; see CLAUDE.md, Image geometry). */
  resolution: string;
}

/**
 * The stored frame size as a quality label. 352-pixel-wide (VCD, half-D1) and
 * 288-line copies are low resolution whatever their standard; everything else
 * under 700 lines is SD, named by its line count.
 */
export function quality(show: Pick<Show, 'Width' | 'Height'>): Quality | null {
  const w = parseInt(show.Width, 10);
  const h = parseInt(show.Height, 10);
  if (!w || !h) return null;
  const resolution = `${w} × ${h}`;
  if (h >= 1000) return { label: 'HD 1080', tier: 'hd', resolution };
  if (h >= 700) return { label: 'HD 720', tier: 'hd', resolution };
  if (w <= 360 || h <= 300) return { label: 'Low-res', tier: 'low', resolution };
  return { label: `SD ${h}`, tier: 'sd', resolution };
}

const VIDEO: Record<string, string> = {
  mpeg2video: 'MPEG-2',
  mpeg1video: 'MPEG-1',
  mpeg4: 'MPEG-4 Part 2',
  h264: 'H.264',
  hevc: 'HEVC (H.265)',
  wmv3: 'WMV 9',
  mjpeg: 'Motion JPEG',
};

const AUDIO: Record<string, string> = {
  ac3: 'Dolby Digital (AC-3)',
  eac3: 'Dolby Digital Plus',
  dts: 'DTS',
  pcm_dvd: 'LPCM',
  pcm_s16be: 'PCM',
  pcm_s16le: 'PCM',
  pcm_s24le: 'PCM',
  mp2: 'MPEG audio (MP2)',
  mp3: 'MP3',
  aac: 'AAC',
  aac_latm: 'AAC',
  wmav2: 'WMA',
  adpcm_ima_qt: 'ADPCM',
  flac: 'FLAC',
};

const CONTAINER: Record<string, string> = {
  '.vob': 'DVD-Video (VOB)',
  '.ts': 'MPEG-TS',
  '.m2ts': 'M2TS (Blu-ray / AVCHD)',
  '.mkv': 'Matroska (MKV)',
  '.mp4': 'MP4',
  '.mpg': 'MPEG program stream',
  '.mpeg': 'MPEG program stream',
  '.m2v': 'MPEG-2 video stream',
  '.mov': 'QuickTime (MOV)',
  '.wmv': 'Windows Media (WMV)',
  '.flv': 'Flash Video (FLV)',
};

const CHANNELS: Record<string, string> = { '1': 'Mono', '2': 'Stereo', '4': '4.0', '5': '5.0', '6': '5.1', '8': '7.1' };

/** An unknown name falls through as it is, so nothing is ever blank. */
export const videoName = (codec?: string) => (codec ? VIDEO[codec] ?? codec : '');
export const audioName = (codec?: string) => (codec ? AUDIO[codec] ?? codec : '');
export const containerName = (ext?: string) => (ext ? CONTAINER[ext.toLowerCase()] ?? ext : '');
/** No channel count (0 or blank) says nothing, so it shows nothing. */
export const channelsName = (n?: string) => (!n || n === '0' ? '' : CHANNELS[n] ?? `${n} channels`);
/** "(native)" is our own bookkeeping; "(letterboxed 16:9)" is real information and stays. */
export const aspectName = (aspect?: string) => (aspect ? aspect.replace(/\s*\(native\)$/, '') : '');
/** "48 kHz", "44.1 kHz". */
export const sampleRateName = (hz?: string) => {
  const n = parseInt(hz || '', 10);
  return n ? `${+(n / 1000).toFixed(1)} kHz` : '';
};

/** "1h 42m" or "24 min"; empty when unknown. The one length format: cards, drawer, share line, copies (F17). */
export function lengthName(durationSec?: string): string {
  const total = Math.round(parseInt(durationSec || '0', 10) / 60);
  if (!total) return '';
  const hours = Math.floor(total / 60);
  return hours ? `${hours}h ${String(total % 60).padStart(2, '0')}m` : `${total} min`;
}

// ─── From the drive scan (tools/drive-scan, 2026-10-18; docs/ux-research F1) ───

type Scanned = Pick<Show, 'FrameRate' | 'ScanType' | 'DiscType' | 'Menu' | 'Chapters'>;

/** "25 fps, interlaced", "59.94 fps, progressive"; empty when unknown. */
export function frameName(show: Scanned): string {
  if (!show.FrameRate) return '';
  return [`${show.FrameRate} fps`, show.ScanType].filter(Boolean).join(', ');
}

/** The trader's shorthand for the copies list: "25i", "29.97i", "50p". */
export function frameShort(show: Scanned): string {
  if (!show.FrameRate) return '';
  return `${show.FrameRate}${show.ScanType === 'interlaced' ? 'i' : show.ScanType === 'progressive' ? 'p' : ' fps'}`;
}

/** "8.9 Mb/s", "384 kb/s"; empty when unknown. */
export function kbpsName(kbps?: string): string {
  const n = parseInt(kbps || '', 10);
  if (!n) return '';
  return n >= 1000 ? `${(n / 1000).toFixed(1)} Mb/s` : `${n} kb/s`;
}

/** "DVD-5 · menu · 8 chapters", "Blu-ray"; empty for a plain file, whose container says it. */
export function discName(show: Scanned): string {
  if (!show.DiscType || show.DiscType === 'File') return '';
  const chapters = parseInt(show.Chapters || '', 10);
  return [show.DiscType, show.Menu === 'Yes' ? 'menu' : show.Menu === 'No' ? 'no menu' : '',
    chapters ? `${chapters} ${chapters === 1 ? 'chapter' : 'chapters'}` : ''].filter(Boolean).join(' · ');
}

/** Songs in a setlist, "Encore break" not counted. */
export const songCount = (setlist?: string): number =>
  setlist ? setlist.split(';').map(s => s.trim()).filter(s => s && s !== 'Encore break').length : 0;

/** How the record was filmed, as traders write it: "Pro-shot", "Audience". */
export const sourceName = (type?: string) => (type === 'Proshot' ? 'Pro-shot' : type || '');

export type DatePrecision = 'year' | 'month' | 'day';

/**
 * How much of a show's date is known (F7; CLAUDE.md, ShowDate). Stored only
 * where the convention can't tell: a `DatePrecision` of "month" for a
 * YYYY-MM-01 that means the month alone, "day" for a date on the 1st that is
 * real (a New Year's Day show). Otherwise YYYY-01-01 is the year alone, the
 * convention since the start, and any other date is the day. Null if undated.
 */
export function datePrecision(show: Pick<Show, 'ShowDate' | 'DatePrecision'>): DatePrecision | null {
  if (!show.ShowDate) return null;
  if (show.DatePrecision === 'year' || show.DatePrecision === 'month' || show.DatePrecision === 'day') return show.DatePrecision;
  return show.ShowDate.endsWith('-01-01') ? 'year' : 'day';
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * A show's date as the site shows it — card, list, drawer, share line, tab
 * title, link preview: "2010-06-05", "May 2001", "2001", or "Undated". In
 * full, so two shows in one year differ (F2), and never a day nobody knows (F7).
 */
export function dateName(show: Pick<Show, 'ShowDate' | 'DatePrecision'>): string {
  const p = datePrecision(show);
  if (!p) return 'Undated';
  if (p === 'year') return show.ShowDate.slice(0, 4);
  if (p === 'month') return `${MONTHS[parseInt(show.ShowDate.slice(5, 7), 10) - 1]} ${show.ShowDate.slice(0, 4)}`;
  return show.ShowDate;
}

/** The drawer's word on a partial date: "date unknown", "day unknown", or nothing. */
export function dateCaveat(show: Pick<Show, 'ShowDate' | 'DatePrecision'>): string {
  const p = datePrecision(show);
  return p === 'year' ? 'date unknown' : p === 'month' ? 'day unknown' : '';
}

/** For a spreadsheet: "2001", "2001-05" or "2001-05-24", so partial dates still sort. */
export function isoDate(show: Pick<Show, 'ShowDate' | 'DatePrecision'>): string {
  const p = datePrecision(show);
  return !p ? '' : p === 'year' ? show.ShowDate.slice(0, 4) : p === 'month' ? show.ShowDate.slice(0, 7) : show.ShowDate;
}

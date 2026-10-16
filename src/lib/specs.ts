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

/** How the record was filmed, as traders write it: "Pro-shot", "Audience". */
export const sourceName = (type?: string) => (type === 'Proshot' ? 'Pro-shot' : type || '');

/**
 * A card's date, in full so two shows in one year differ (F2) — except the
 * year-only placeholder, YYYY-01-01 (CLAUDE.md, ShowDate), which shows as the
 * year: a card must not claim a day nobody knows. Until date precision is
 * recorded (F7), a real New Year's Day show reads as its year too.
 */
export function cardDate(showDate?: string): string {
  if (!showDate) return 'Undated';
  return showDate.endsWith('-01-01') ? showDate.slice(0, 4) : showDate;
}

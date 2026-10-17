/**
 * Other words a show answers to (docs/ux-research, finding F6): the names
 * traders type that the record doesn't spell.
 *
 * Indexed as extra words beside the show's own (searchIndex `aka` and `tech`),
 * not by rewriting the query, so a word that is also a song title still finds
 * the song: "holland" finds Dutch shows and any song called Holland.
 *
 * Kept to words that are rarely anything else. Left out on purpose: "us",
 * "america" and "england" (common words in song titles), and "rip" for Rock
 * im Park.
 */

import type { Show } from '../../App';
import { quality } from '../lib/specs';

/** Countries as the record has them → what else people type. */
const COUNTRY: Record<string, string> = {
  'United Kingdom': 'uk gb britain',
  'United States': 'usa',
  Germany: 'deutschland',
  Netherlands: 'holland nederland',
  Brazil: 'brasil',
  Spain: 'espana',
  Italy: 'italia',
  Japan: 'nippon nihon',
  'New Zealand': 'nz',
  Switzerland: 'schweiz suisse svizzera',
  Denmark: 'danmark',
  Sweden: 'sverige',
  Belgium: 'belgique belgie',
  Poland: 'polska',
  Austria: 'osterreich oesterreich',
  Greece: 'hellas ellada',
  Hungary: 'magyarorszag',
  'South Korea': 'korea',
  Ireland: 'eire',
};

/** Cities and venues in the language or spelling a trader may use instead. */
const PLACE: Record<string, string> = {
  Cologne: 'koln koeln',
  Munich: 'munchen muenchen',
  Nuremberg: 'nurnberg nuernberg',
  'Düsseldorf': 'duesseldorf',
  'Nürburg': 'nuerburg',
  'Nürburgring': 'nuerburgring',
  Vienna: 'wien',
  Lisbon: 'lisboa',
  Lisboa: 'lisbon',
  Rome: 'roma',
  Milan: 'milano',
  Brussels: 'bruxelles brussel',
  Copenhagen: 'kobenhavn koebenhavn',
  Moscow: 'moskva',
  Warsaw: 'warszawa',
  Athens: 'athina',
  'Mexico City': 'cdmx',
};

/** Events by the short names traders use. */
const EVENT: Record<string, string> = {
  'Rock am Ring': 'rar',
  'T in the Park': 'titp',
  'Big Day Out': 'bdo',
  'Austin City Limits': 'acl',
  'Saturday Night Live': 'snl',
  'Glastonbury Festival': 'glasto',
  'Eurockéennes Festival': 'eurocks',
  'Lollapalooza': 'lolla',
  'Lollapalooza Brasil': 'lolla',
  'Much Music Intimate & Interactive': 'muchmusic',
  MuchMusic: 'much music',
};

const CONTAINER: Record<string, string> = { '.vob': 'vob dvd', '.ts': 'ts', '.m2ts': 'm2ts', '.mkv': 'mkv', '.mp4': 'mp4' };
const VIDEO: Record<string, string> = { mpeg2video: 'mpeg2', h264: 'h264', hevc: 'hevc h265' };
const AUDIO: Record<string, string> = { pcm_dvd: 'lpcm pcm', ac3: 'ac3', mp2: 'mp2', aac: 'aac' };

/** Place and event words: country, city and venue names in other languages, event short names. */
export function placeAliases(show: Show): string {
  return [
    COUNTRY[show.Country],
    PLACE[show.City],
    PLACE[show.VenueName],
    show.EventOrFestival && EVENT[show.EventOrFestival],
  ].filter(Boolean).join(' ');
}

/**
 * How it was made, in the words traders search with: "hd", "1080", "sd",
 * "576", "lowres", "pal", "ntsc", "pro shot", "aud", "dvd", "lpcm"… PAL and
 * NTSC only for SD and low-res copies, as the drawer shows them: on HD records
 * the field is unreliable.
 */
export function techAliases(show: Show): string {
  const q = quality(show);
  const lines = q ? q.resolution.split(' × ')[1] : '';
  const words: (string | undefined | false)[] = [
    q?.tier === 'hd' && `hd ${lines} ${lines}i ${lines}p`,
    q?.tier === 'sd' && `sd ${lines} ${lines}i`,
    q?.tier === 'low' && 'lowres',
    q?.tier !== 'hd' && show.TVStandard?.toLowerCase(),
    show.RecordingType === 'Proshot' && 'pro shot proshot',
    show.RecordingType === 'Audience' && 'aud',
    show.ContentType === 'Documentary' && 'doc',
    // From the drive scan: "interlaced", "progressive", "dvd9", "bluray".
    show.ScanType === 'interlaced' && 'interlaced',
    show.ScanType === 'progressive' && 'progressive',
    show.DiscType?.startsWith('DVD') && show.DiscType.replace('-', '').toLowerCase(),
    show.DiscType === 'Blu-ray' && 'bluray',
    CONTAINER[show.Container?.toLowerCase()],
    VIDEO[show.VideoCodec],
    show.AudioCodec && AUDIO[show.AudioCodec],
  ];
  return words.filter(Boolean).join(' ');
}

/** Single words the site knows as a place or a spec: never "corrected" into an artist. */
export const KNOWN_TERMS = new Set(
  [...Object.values(COUNTRY), ...Object.values(PLACE), ...Object.values(EVENT),
    'hd sd lowres pal ntsc pro shot proshot aud sbd soundboard doc dvd vob ts m2ts mkv mp4 mpeg2 h264 hevc h265 lpcm pcm ac3 mp2 aac',
    'interlaced progressive dvd5 dvd9 bluray',
    '1080 1080i 1080p 720 720p 576 576i 480 480i']
    .join(' ').split(/\s+/),
);

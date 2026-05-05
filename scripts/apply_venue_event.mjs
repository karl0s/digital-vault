/**
 * Applies venue/event corrections across all data files.
 * Must run after fix_venue_event.mjs has generated proposals in public/shows.json.
 *
 * Usage: node scripts/apply_venue_event.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── Re-run proposal logic inline (same as fix_venue_event.mjs) ──────────────
const SHOWS_PATH = resolve(ROOT, 'public/shows.json');
const shows = JSON.parse(readFileSync(SHOWS_PATH, 'utf8'));

const FESTIVAL_PATTERNS = [
  [/glastonbury/i, 'Glastonbury Festival'],
  [/pinkpop/i, 'PinkPop'],
  [/pink\s*pop/i, 'PinkPop'],
  [/rock\s*am\s*ring/i, 'Rock am Ring'],
  [/rock\s*im\s*park/i, 'Rock im Park'],
  [/rock\s*in\s*rio/i, 'Rock in Rio'],
  [/lollapalooza/i, 'Lollapalooza'],
  [/coachella/i, 'Coachella'],
  [/bonnaroo/i, 'Bonnaroo'],
  [/reading\s+festival/i, 'Reading Festival'],
  [/leeds\s+festival/i, 'Leeds Festival'],
  [/reading\s*(?:&|and)\s*leeds/i, 'Reading & Leeds Festival'],
  [/download\s+festival/i, 'Download Festival'],
  [/ozz?fest/i, 'Ozzfest'],
  [/big\s+day\s+out/i, 'Big Day Out'],
  [/woodstock/i, 'Woodstock'],
  [/t\s+in\s+the\s+park/i, 'T in the Park'],
  [/v\s+festival/i, 'V Festival'],
  [/fuji\s*rock/i, 'Fuji Rock Festival'],
  [/summer\s+sonic/i, 'Summer Sonic'],
  [/summersonic/i, 'Summer Sonic'],
  [/all\s+points\s+east/i, 'All Points East'],
  [/isle\s+of\s+wight/i, 'Isle of Wight Festival'],
  [/bestival/i, 'Bestival'],
  [/latitude\s+festival/i, 'Latitude Festival'],
  [/roskilde/i, 'Roskilde Festival'],
  [/montreux/i, 'Montreux Jazz Festival'],
  [/north\s+sea\s+jazz/i, 'North Sea Jazz Festival'],
  [/south\s+by\s+south/i, 'SXSW'],
  [/sxsw/i, 'SXSW'],
  [/farm\s+aid/i, 'Farm Aid'],
  [/austin\s+city\s+limits/i, 'Austin City Limits'],
  [/acl\s+fest/i, 'Austin City Limits'],
  [/outside\s+lands/i, 'Outside Lands'],
  [/electric\s+daisy/i, 'Electric Daisy Carnival'],
  [/ultra\s+music/i, 'Ultra Music Festival'],
  [/werchter/i, 'Rock Werchter'],
  [/pukkelpop/i, 'Pukkelpop'],
  [/hurricane\s+festival/i, 'Hurricane Festival'],
  [/southside\s+festival/i, 'Southside Festival'],
  [/wacken/i, 'Wacken Open Air'],
  [/graspop/i, 'Graspop Metal Meeting'],
  [/hellfest/i, 'Hellfest'],
  [/nova\s*rock/i, 'Nova Rock Festival'],
  [/laneway/i, 'Laneway Festival'],
  [/melt\s*!/i, 'Melt! Festival'],
  [/flow\s+festival/i, 'Flow Festival'],
  [/primavera\s+sound/i, 'Primavera Sound'],
  [/splendour\s+in\s+the\s+grass/i, 'Splendour in the Grass'],
  [/way\s*out\s*west/i, 'Way Out West'],
  [/low\s*lands/i, 'Lowlands Festival'],
  [/lowlands/i, 'Lowlands Festival'],
  [/mtv\s+europe/i, 'MTV Europe Music Awards'],
  [/\bemas?\b/i, 'MTV Europe Music Awards'],
  [/mtv\s+vma/i, 'MTV Video Music Awards'],
  [/grammy/i, 'Grammy Awards'],
  [/brit\s+awards/i, 'BRIT Awards'],
  [/conan/i, 'Conan'],
  [/letterman/i, 'Late Show with David Letterman'],
  [/\bjay\s+leno\b/i, 'The Tonight Show with Jay Leno'],
  [/tonight\s+show/i, 'The Tonight Show'],
  [/jimmy\s+fallon/i, 'The Tonight Show with Jimmy Fallon'],
  [/kimmel/i, 'Jimmy Kimmel Live!'],
  [/stephen\s+colbert/i, 'The Late Show with Stephen Colbert'],
  [/jools\s+holland/i, "Later... with Jools Holland"],
  [/top\s+of\s+the\s+pops/i, 'Top of the Pops'],
  [/carson\s+daly/i, 'Last Call with Carson Daly'],
  [/last\s+call/i, 'Last Call with Carson Daly'],
  [/much\s*music/i, 'MuchMusic'],
  [/muchmusic/i, 'MuchMusic'],
  [/oxygen\s+festival/i, 'Oxygen Festival'],
  [/\boxygen\b/i, 'Oxygen Festival'],
  [/with\s+full\s+force/i, 'With Full Force Festival'],
  [/nxne/i, 'NXNE'],
  [/euro\s*ck?k?[eé]ennes/i, 'Eurockéennes Festival'],
  [/bizarre/i, 'Bizarre Festival'],
  [/2\s+meter\s+sessions/i, '2 Meter Sessions'],
  [/oster[\s-]*rocknacht/i, 'Oster-Rocknacht'],
  [/live\s*8(?!\s*\)|\s*kbps|\s*min|\s*fps|\s*hz|\s*ch)/i, 'Live 8'],
  [/live\s*aid/i, 'Live Aid'],
  [/hbo\s+reverb/i, 'HBO Reverb'],
  [/viva\s+overdrive/i, 'Viva Overdrive'],
  [/rockpalast/i, 'Rockpalast'],
  [/\breading\b(?!\s*,|\s+pa\b|\s+uk\b)/i, 'Reading Festival'],
  [/sessions\s+at\s+west\s+54/i, 'Sessions at West 54th'],
  [/guitar\s+center\s+sessions/i, 'Guitar Center Sessions'],
  [/phoenix\s+festival/i, 'Phoenix Festival'],
  [/phoenix\s+fest/i, 'Phoenix Festival'],
  [/maquinaria/i, 'Maquinaria Festival'],
  [/pepsi\s+music/i, 'Pepsi Music Festival'],
  [/musique\s+plus/i, 'Musique Plus'],
  [/musique\b/i, 'Musique Plus'],
  [/dysfunctional\s+family\s+picnic/i, 'Dysfunctional Family Picnic'],
  [/vh1\s+storytellers/i, 'VH1 Storytellers'],
  [/unplugged/i, 'MTV Unplugged'],
  [/snl\b/i, 'Saturday Night Live'],
  [/saturday\s+night\s+live/i, 'Saturday Night Live'],
  [/jools/i, "Later... with Jools Holland"],
  [/phoenix\s+199/i, 'Phoenix Festival'],
  [/kroq\b/i, 'KROQ'],
];

const JUNK_PATTERNS = [
  /\b(mpeg|dvd|vhs|xvid|divx|h\.?264|h\.?265|x\.?264|avc|hevc|avi|mp4|mkv|vob)\b/i,
  /\b(kbps|fps|khz|ntsc|pal|secam|interlaced|progressive)\b/i,
  /\b(lineage|sourced\s+from|generation|encode)\b/i,
  /\b(tape\s+\d|gen\s*\d|1st\s+gen|2nd\s+gen)\b/i,
  /\n/,
  /checksum|sha1|md5/i,
  /^(?:i'm|this is|i've|i'd|i was|we |you )/i,
  /:[)\-D3]/,
  /\b(bandwidth|providing)\b/i,
  /\.{4,}/,
];

function isJunk(value, artist) {
  if (!value) return false;
  const v = value.trim();
  if (!v) return false;
  if (JUNK_PATTERNS.some(p => p.test(v))) return true;
  if (v.length > 120) return true;
  const artistLower = artist.toLowerCase();
  const vLower = v.toLowerCase();
  if (vLower === artistLower) return true;
  if (vLower.startsWith(artistLower + ' ') || vLower.startsWith(artistLower + '-') || vLower.startsWith(artistLower + ',')) return true;
  const stripped = vLower.replace(/^[-=_*\s!#]+/, '').trim();
  if (stripped === artistLower || stripped.startsWith(artistLower + ' ') || stripped.startsWith(artistLower + '-')) return true;
  if (/^\d+$/.test(v) && v.length < 4) return true;
  return false;
}

function extractFestivalFromText(text) {
  if (!text) return null;
  for (const [pattern, name] of FESTIVAL_PATTERNS) {
    if (name && pattern.test(text)) return name;
  }
  return null;
}

function extractVenueFromNotes(notes) {
  if (!notes) return null;
  const m = notes.match(/^venue[\s.]*(?:name[\s.]*)?\s*:\s*([^\n;]{3,80})/im);
  return m ? m[1].trim() : null;
}

function computeCorrection(show) {
  const artist = show.Artist || '';
  const venue = (show.VenueName || '').trim();
  const event = (show.EventOrFestival || '').trim();
  const folderName = (show.FolderName || '').trim();
  const folderPath = (show.FolderPath || '').trim();
  const notes = (show.Notes || '').trim();

  const venueJunk = isJunk(venue, artist);
  const eventJunk = isJunk(event, artist);
  if (!venueJunk && !eventJunk) return null;

  const festivalFromFolder = extractFestivalFromText(folderName);
  const parentFolder = folderPath.split('/').slice(-2, -1)[0] || '';
  const festivalFromParent = extractFestivalFromText(parentFolder);
  const festival = festivalFromFolder || festivalFromParent;
  const venueFromNotes = extractVenueFromNotes(notes);

  let proposedVenue, proposedEvent;
  if (festival) {
    proposedEvent = festival;
    proposedVenue = venueFromNotes || (venueJunk ? '' : venue);
  } else {
    proposedEvent = eventJunk ? '' : event;
    proposedVenue = venueJunk ? (venueFromNotes || '') : (venueFromNotes || venue);
  }

  const changed = (proposedEvent !== event) || (proposedVenue !== venue);
  if (!changed) return null;
  return { venue: proposedVenue, event: proposedEvent };
}

// Build correction map: ShowID → { venue, event }
const corrections = new Map();
for (const show of shows) {
  const c = computeCorrection(show);
  if (c) corrections.set(show.ShowID, c);
}
console.log(`Corrections computed: ${corrections.size}`);

// ─── Simple CSV parser/writer ─────────────────────────────────────────────────
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current); current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function csvQuote(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function updateCSV(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  if (lines.length < 2) return 0;

  const headers = parseCSVLine(lines[0]);
  const showIdIdx = headers.indexOf('ShowID');
  const venueIdx = headers.indexOf('VenueName');
  const eventIdx = headers.indexOf('EventOrFestival');

  if (showIdIdx === -1 || venueIdx === -1 || eventIdx === -1) return 0;

  let updated = 0;
  const newLines = [lines[0]]; // keep header as-is

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { newLines.push(line); continue; }

    const fields = parseCSVLine(line);
    const showId = fields[showIdIdx];
    const correction = corrections.get(showId);

    if (correction) {
      fields[venueIdx] = correction.venue;
      fields[eventIdx] = correction.event;
      newLines.push(fields.map(csvQuote).join(','));
      updated++;
    } else {
      newLines.push(line);
    }
  }

  writeFileSync(filePath, newLines.join('\n'), 'utf8');
  return updated;
}

function updateJSON(filePath) {
  const data = JSON.parse(readFileSync(filePath, 'utf8'));
  const arr = Array.isArray(data) ? data : data.items || [];
  let updated = 0;
  for (const show of arr) {
    const c = corrections.get(show.ShowID);
    if (c) {
      show.VenueName = c.venue;
      show.EventOrFestival = c.event;
      updated++;
    }
  }
  writeFileSync(filePath, JSON.stringify(Array.isArray(data) ? arr : data, null, 2) + '\n');
  return updated;
}

function updateJSONL(filePath) {
  const lines = readFileSync(filePath, 'utf8').split('\n');
  let updated = 0;
  const newLines = lines.map(line => {
    if (!line.trim()) return line;
    try {
      const obj = JSON.parse(line);
      const c = corrections.get(obj.ShowID);
      if (c) { obj.VenueName = c.venue; obj.EventOrFestival = c.event; updated++; }
      return JSON.stringify(obj);
    } catch { return line; }
  });
  writeFileSync(filePath, newLines.join('\n'), 'utf8');
  return updated;
}

// ─── Apply to all files ───────────────────────────────────────────────────────
const JSON_FILES = [
  'public/shows.json',
  'data-pipeline/08_final_create_master_CSV/NEW_MASTER_merged_shows_2025-11-06_2113.json',
];
const JSONL_FILES = [
  'data-pipeline/08_final_create_master_CSV/NEW_MASTER_merged_shows_2025-11-06_2113.jsonl',
];
const CSV_FILES = [
  'data-pipeline/01_scan_hd_shows/seagate_musicvideo_catalog.csv',
  'data-pipeline/01_scan_hd_shows/seagate_musicvideo_techscan.csv',
  'data-pipeline/01_scan_hd_shows/shows_catalog_BIG_DADDY_2025-10-31_1409-cleaned-01.csv',
  'data-pipeline/01_scan_hd_shows/shows_catalog_BIG_DADDY_2025-10-31_1409.csv',
  'data-pipeline/04_merge_hd_csvs_identify_duplicates/merged_catalogs_2025-11-05_1257.csv',
  'data-pipeline/05_merge_csvs/BIG_DADDY_enriched_with_checksums_2025-11-06_0800.csv',
  'data-pipeline/05_merge_csvs/SEAGATE_enriched_with_tech_2025-11-06_0930.csv',
  'data-pipeline/05_merge_csvs/shows_catalog_BIG_DADDY_rescan_checksums.csv',
  'data-pipeline/07_merge_csvs_create_single_master/MASTER_duplicates_report_2025-11-06_0947.csv',
  'data-pipeline/07_merge_csvs_create_single_master/MASTER_merged_shows_2025-11-06_0947.csv',
  'data-pipeline/08_final_create_master_CSV/NEW_MASTER_duplicates_report_2025-11-06_2113.csv',
  'data-pipeline/08_final_create_master_CSV/NEW_MASTER_merged_shows_2025-11-06_2113.csv',
  'data-pipeline/08_final_create_master_CSV/shows_catalog_UNTITLED_DVDs.csv',
];

console.log('\n=== Applying corrections ===');
for (const rel of JSON_FILES) {
  const n = updateJSON(resolve(ROOT, rel));
  console.log(`JSON  ${rel}: ${n} updated`);
}
for (const rel of JSONL_FILES) {
  const n = updateJSONL(resolve(ROOT, rel));
  console.log(`JSONL ${rel}: ${n} updated`);
}
for (const rel of CSV_FILES) {
  const n = updateCSV(resolve(ROOT, rel));
  console.log(`CSV   ${rel}: ${n} updated`);
}
console.log('\nDone.');

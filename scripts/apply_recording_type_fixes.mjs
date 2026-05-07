import { readFileSync, writeFileSync } from 'fs';

// ShowID → { RecordingType?, Artist? }
const FIXES = {
  // Audience corrections
  '3cbf2c1669ea': { RecordingType: 'Audience' },   // SP 1993-09-23 Source:AUD
  '08be4133b02b': { RecordingType: 'Audience' },   // FNM Download 2009 (AUD)
  // Documentary corrections
  '56a0d564ba6c': { RecordingType: 'Documentary' }, // FNM TV Appearances 1
  'fe1e14ec3cfc': { RecordingType: 'Documentary' }, // FNM TV Appearances 2
  'a057aa12a049': { RecordingType: 'Documentary' }, // FNM 1997-11-11 Hormoaning
  '4b6855e08c30': { RecordingType: 'Documentary' }, // Supergrass Vol 3 TV Appearances
  '1ae527d330e6': { RecordingType: 'Documentary' }, // RHCP Rolling Stone MTV Special 1992
  'c88475b54bf1': { RecordingType: 'Documentary' }, // Weezer Across the Sea 2005
  // Missing → Proshot
  '9fd79828213e': { RecordingType: 'Proshot' },     // Aerosmith 1999-12-31
  '02aa3e217e9a': { RecordingType: 'Proshot' },     // Ben Harper 1998-04-12
  '6ba8d09333cf': { RecordingType: 'Proshot' },     // Soundgarden Lollapalooza 2010 Partial
  '5267dc887fd7': { RecordingType: 'Proshot' },     // STP 2010-05-18
  '126d171d49fe': { RecordingType: 'Proshot' },     // RATM Revolution on TV
  '8818dc0501ba': { RecordingType: 'Proshot' },     // FNM Download 2009 Webstream
  '7197c6d0fee8': { RecordingType: 'Proshot' },     // ZZ Top Storytellers 2009
  '08889466af37': { RecordingType: 'Proshot' },     // Silverchair 1999
  '77c4bdcab4a1': { RecordingType: 'Proshot' },     // Soundgarden Letterman 2012
  'a0553c4c6dc9': { RecordingType: 'Proshot' },     // Who BBC 2006
  // Artist rename
  '6fca4bf593e1': { Artist: 'De La Soul' },         // Live → De La Soul 2010-07-16
};

const fixIds = new Set(Object.keys(FIXES));

// --- JSON ---
function updateJSON(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const data = Array.isArray(raw) ? raw : (raw.items ?? raw.shows ?? Object.values(raw)[0]);
  let count = 0;
  data.forEach(row => {
    if (!fixIds.has(row.ShowID)) return;
    Object.assign(row, FIXES[row.ShowID]);
    count++;
  });
  writeFileSync(path, JSON.stringify(Array.isArray(raw) ? data : raw, null, 2));
  console.log(`JSON  ${count} updates → ${path.split('/').slice(-2).join('/')}`);
}

// --- JSONL ---
function updateJSONL(path) {
  const lines = readFileSync(path, 'utf8').split('\n');
  let count = 0;
  const out = lines.map(line => {
    if (!line.trim()) return line;
    try {
      const row = JSON.parse(line);
      if (!fixIds.has(row.ShowID)) return line;
      Object.assign(row, FIXES[row.ShowID]);
      count++;
      return JSON.stringify(row);
    } catch { return line; }
  });
  writeFileSync(path, out.join('\n'));
  console.log(`JSONL ${count} updates → ${path.split('/').slice(-2).join('/')}`);
}

// --- CSV ---
function parseCSVRow(line) {
  const fields = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { fields.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function quoteCSV(val) {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function updateCSV(path) {
  const raw = readFileSync(path, 'utf8');
  const lines = raw.split('\n');
  if (lines.length < 2) return;
  const headers = parseCSVRow(lines[0]);
  const showIdIdx = headers.indexOf('ShowID');
  if (showIdIdx === -1) { console.log(`CSV   SKIP (no ShowID) → ${path.split('/').slice(-2).join('/')}`); return; }

  let count = 0;
  const out = [lines[0]];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { out.push(line); continue; }
    const fields = parseCSVRow(line);
    const id = fields[showIdIdx];
    if (!fixIds.has(id)) { out.push(line); continue; }
    const fix = FIXES[id];
    Object.entries(fix).forEach(([key, val]) => {
      const idx = headers.indexOf(key);
      if (idx !== -1) fields[idx] = val;
    });
    out.push(fields.map(quoteCSV).join(','));
    count++;
  }
  writeFileSync(path, out.join('\n'));
  console.log(`CSV   ${count} updates → ${path.split('/').slice(-2).join('/')}`);
}

// Apply to all files
updateJSON('/Users/ko/Desktop/Projects/the-vault/public/shows.json');
updateJSON('/Users/ko/Desktop/Projects/the-vault/data-pipeline/08_final_create_master_CSV/NEW_MASTER_merged_shows_2025-11-06_2113.json');
updateJSONL('/Users/ko/Desktop/Projects/the-vault/data-pipeline/08_final_create_master_CSV/NEW_MASTER_merged_shows_2025-11-06_2113.jsonl');

const csvFiles = [
  '/Users/ko/Desktop/Projects/the-vault/data-pipeline/01_scan_hd_shows/seagate_musicvideo_catalog.csv',
  '/Users/ko/Desktop/Projects/the-vault/data-pipeline/01_scan_hd_shows/seagate_musicvideo_techscan.csv',
  '/Users/ko/Desktop/Projects/the-vault/data-pipeline/01_scan_hd_shows/shows_catalog_BIG_DADDY_2025-10-31_1409-cleaned-01.csv',
  '/Users/ko/Desktop/Projects/the-vault/data-pipeline/01_scan_hd_shows/shows_catalog_BIG_DADDY_2025-10-31_1409.csv',
  '/Users/ko/Desktop/Projects/the-vault/data-pipeline/04_merge_hd_csvs_identify_duplicates/merged_catalogs_2025-11-05_1257.csv',
  '/Users/ko/Desktop/Projects/the-vault/data-pipeline/05_merge_csvs/BIG_DADDY_enriched_with_checksums_2025-11-06_0800.csv',
  '/Users/ko/Desktop/Projects/the-vault/data-pipeline/05_merge_csvs/SEAGATE_enriched_with_tech_2025-11-06_0930.csv',
  '/Users/ko/Desktop/Projects/the-vault/data-pipeline/05_merge_csvs/shows_catalog_BIG_DADDY_rescan_checksums.csv',
  '/Users/ko/Desktop/Projects/the-vault/data-pipeline/07_merge_csvs_create_single_master/MASTER_duplicates_report_2025-11-06_0947.csv',
  '/Users/ko/Desktop/Projects/the-vault/data-pipeline/07_merge_csvs_create_single_master/MASTER_merged_shows_2025-11-06_0947.csv',
  '/Users/ko/Desktop/Projects/the-vault/data-pipeline/08_final_create_master_CSV/NEW_MASTER_duplicates_report_2025-11-06_2113.csv',
  '/Users/ko/Desktop/Projects/the-vault/data-pipeline/08_final_create_master_CSV/NEW_MASTER_merged_shows_2025-11-06_2113.csv',
  '/Users/ko/Desktop/Projects/the-vault/data-pipeline/08_final_create_master_CSV/shows_catalog_UNTITLED_DVDs.csv',
];
csvFiles.forEach(updateCSV);

console.log('\nDone.');

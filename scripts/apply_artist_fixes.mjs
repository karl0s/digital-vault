import { readFileSync, writeFileSync } from 'fs';

const FIXES = {
  '0318b1e40ed7': { Artist: 'Soundgarden' },       // Live (band) → Soundgarden; SG_LIVE_ON_I_5 folder
  '9a0245132200': { Artist: 'Black Keys' },         // Live (band) → Black Keys; Global Citizen Festival 2012
  'c5f046a69778': { Artist: 'Kooks' },              // 30STM folder but content is Kooks PinkPop 2007
  'a3143b0e6375': { Artist: 'Neil Finn' },          // Crowded House → Neil Finn solo interview/show
  '6aa691481fa9': { Artist: 'Incubus / Deftones' }, // Musique Plus 2000 - both artists performed
  '34f2923f1e57': { Artist: 'Incubus / Deftones' }, // MusiquePlus 2000 - both artists performed
};

const fixIds = new Set(Object.keys(FIXES));

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
  console.log(`JSON  ${count} → ${path.split('/').slice(-2).join('/')}`);
}

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
  console.log(`JSONL ${count} → ${path.split('/').slice(-2).join('/')}`);
}

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
  const lines = readFileSync(path, 'utf8').split('\n');
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
    Object.entries(FIXES[id]).forEach(([key, val]) => {
      const idx = headers.indexOf(key);
      if (idx !== -1) fields[idx] = val;
    });
    out.push(fields.map(quoteCSV).join(','));
    count++;
  }
  writeFileSync(path, out.join('\n'));
  console.log(`CSV   ${count} → ${path.split('/').slice(-2).join('/')}`);
}

updateJSON('/Users/ko/Desktop/Projects/the-vault/public/shows.json');
updateJSON('/Users/ko/Desktop/Projects/the-vault/data-pipeline/08_final_create_master_CSV/NEW_MASTER_merged_shows_2025-11-06_2113.json');
updateJSONL('/Users/ko/Desktop/Projects/the-vault/data-pipeline/08_final_create_master_CSV/NEW_MASTER_merged_shows_2025-11-06_2113.jsonl');

const csvFiles = [
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
].map(p => '/Users/ko/Desktop/Projects/the-vault/' + p);

csvFiles.forEach(updateCSV);
console.log('\nDone.');

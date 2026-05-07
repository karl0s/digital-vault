import { readFileSync, writeFileSync } from 'fs';

// ShowID → field overrides
const FIXES = {
  // Garbage - Beauregard Festival 2012
  'ea1445ea015b': {
    Artist: 'Garbage',
    ShowDate: '2012-08-07',
    EventOrFestival: 'Beauregard Festival',
    VenueName: 'Château de Beauregard',
    City: 'Hérouville-Saint-Clair',
    Country: 'France',
  },

  // Fun Loving Criminals - Venice 1996
  '4900c80dfef8': {
    Artist: 'Fun Loving Criminals',
    EventOrFestival: 'Mostra del Cinema',
    VenueName: 'Venice Film Festival',
  },

  // Fun Loving Criminals - Rockpalast Düsseldorf 1999
  '12b966f9af83': {
    Artist: 'Fun Loving Criminals',
    ShowDate: '1999-12-18',
    EventOrFestival: 'Rockpalast',
    VenueName: '',
    City: 'Düsseldorf',
    Country: 'Germany',
  },

  // Fun Loving Criminals - Azkena Rock 2009
  '6c78eb88e2be': {
    Artist: 'Fun Loving Criminals',
    ShowDate: '2009-00-00',
    EventOrFestival: 'Azkena Rock Festival',
    City: 'Vitoria-Gasteiz',
    Country: 'Spain',
  },

  // Spiritualized → Verve (multi-artist Glastonbury 2008 disc)
  '3f8c9014944a': {
    Artist: 'Verve',
    EventOrFestival: 'Glastonbury Festival',
    VenueName: 'Glastonbury Festival',
    City: 'Glastonbury',
    Country: 'UK',
    ShowDate: '2008-06-29',
  },

  // Spiritualized → Verve (Glastonbury 2008-06-29)
  '87a53ac7bb66': {
    Artist: 'Verve',
    EventOrFestival: 'Glastonbury Festival',
    VenueName: 'Glastonbury Festival',
    City: 'Glastonbury',
    Country: 'UK',
  },

  // Cat Stevens BBC 1971 — performance date, not rebroadcast date
  '7691fb8e6362': {
    ShowDate: '1971-00-00',
    VenueName: 'BBC Television Centre',
    Country: 'England',
  },

  // Cat Stevens / Yusuf — Tonight Show 2014
  'be8e3601ec72': {
    EventOrFestival: 'The Tonight Show Starring Jimmy Fallon',
    VenueName: 'Studio 6B, Rockefeller Center',
    City: 'New York',
    Country: 'USA',
  },

  // Coldplay Glastonbury 2011 disc → actually Paolo Nutini
  'fccae4b5ccc7': {
    Artist: 'Paolo Nutini',
    EventOrFestival: 'Glastonbury Festival',
    VenueName: 'Glastonbury Festival',
    City: 'Glastonbury',
    Country: 'UK',
  },

  // Jimi Hendrix - Stockholm Konserthuset 1969
  '8e3e2d8165f4': {
    ShowDate: '1969-01-09',
    VenueName: 'Konserthuset',
    City: 'Stockholm',
    Country: 'Sweden',
  },

  // Presidents of the USA - Amsterdam 2005
  'cb3320a1da24': {
    Artist: 'Presidents of the USA',
    VenueName: '',
    Country: 'Netherlands',
  },

  // Presidents of the USA - Lowlands 2008
  '883213274e7e': {
    Artist: 'Presidents of the USA',
    EventOrFestival: 'Lowlands Festival',
    VenueName: '',
    City: 'Biddinghuizen',
    Country: 'Netherlands',
  },

  // Presidents of the USA - TV Appearances 1995-96
  'cb90878735fa': {
    Artist: 'Presidents of the USA',
    EventOrFestival: 'US TV Appearances 1995–1996',
    VenueName: '',
    City: '',
    ShowDate: '',
  },
};

const fixIds = new Set(Object.keys(FIXES));

function applyFix(row) {
  if (!fixIds.has(row.ShowID)) return false;
  Object.assign(row, FIXES[row.ShowID]);
  return true;
}

// --- JSON ---
function updateJSON(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const data = Array.isArray(raw) ? raw : (raw.items ?? raw.shows ?? Object.values(raw)[0]);
  let count = 0;
  data.forEach(row => { if (applyFix(row)) count++; });
  writeFileSync(path, JSON.stringify(Array.isArray(raw) ? data : raw, null, 2));
  console.log(`JSON  ${count} → ${path.split('/').slice(-2).join('/')}`);
}

// --- JSONL ---
function updateJSONL(path) {
  const lines = readFileSync(path, 'utf8').split('\n');
  let count = 0;
  const out = lines.map(line => {
    if (!line.trim()) return line;
    try {
      const row = JSON.parse(line);
      if (!applyFix(row)) return line;
      count++;
      return JSON.stringify(row);
    } catch { return line; }
  });
  writeFileSync(path, out.join('\n'));
  console.log(`JSONL ${count} → ${path.split('/').slice(-2).join('/')}`);
}

// --- CSV ---
function parseCSVRow(line) {
  const fields = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { fields.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  fields.push(cur); return fields;
}
function quoteCSV(val) {
  if (val == null) return '';
  const s = String(val);
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function updateCSV(path) {
  const lines = readFileSync(path, 'utf8').split('\n');
  if (lines.length < 2) return;
  const headers = parseCSVRow(lines[0]);
  const sidIdx = headers.indexOf('ShowID');
  if (sidIdx === -1) { console.log(`CSV   SKIP → ${path.split('/').slice(-2).join('/')}`); return; }
  let count = 0;
  const out = [lines[0]];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { out.push(line); continue; }
    const fields = parseCSVRow(line);
    const id = fields[sidIdx];
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

const BASE = '/Users/ko/Desktop/Projects/the-vault/';
updateJSON(BASE + 'public/shows.json');
updateJSON(BASE + 'data-pipeline/08_final_create_master_CSV/NEW_MASTER_merged_shows_2025-11-06_2113.json');
updateJSONL(BASE + 'data-pipeline/08_final_create_master_CSV/NEW_MASTER_merged_shows_2025-11-06_2113.jsonl');
[
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
].forEach(p => updateCSV(BASE + p));

console.log('\nDone.');

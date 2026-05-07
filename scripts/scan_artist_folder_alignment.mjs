import { readFileSync } from 'fs';

const shows = JSON.parse(readFileSync('/Users/ko/Desktop/Projects/the-vault/public/shows.json', 'utf8'));
const artists = [...new Set(shows.map(s => s.Artist))].filter(Boolean);

const ALIASES = {
  'RHCP': 'Red Hot Chili Peppers',
  'STP': 'Stone Temple Pilots',
  'tsp': 'Smashing Pumpkins',
  'sp': 'Smashing Pumpkins',
  'GD': 'Green Day',
  'MSP': 'Manic Street Preachers',
  'QOTSA': 'Queens of the Stone Age',
  'TCV': 'Them Crooked Vultures',
  'APC': 'A Perfect Circle',
  'FNM': 'Faith No More',
  'RATM': 'Rage Against the Machine',
  '30STM': '30 Seconds to Mars',
  'KOL': 'Kings Of Leon',
};

// Artists too short/generic to reliably detect from text
const SKIP_DETECTION = new Set(['Live', 'Cars', 'Who', 'Beck', 'Feeder', 'Blur', 'Bush', 'Hole', 'Ween']);

function normName(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const allArtistNorms = artists
  .filter(a => a.length >= 5 && !SKIP_DETECTION.has(a))
  .map(a => ({ artist: a, norm: normName(a) }))
  .sort((a, b) => b.norm.length - a.norm.length); // longest first avoids partial matches

function getParentSegment(fp, fn) {
  if (!fp || !fn) return '';
  const cleanFp = fp.replace(/\\/g, '/');
  const idx = cleanFp.lastIndexOf('/' + fn);
  if (idx >= 0) {
    const parent = cleanFp.slice(0, idx).split('/').pop() || '';
    return parent;
  }
  const parts = cleanFp.split('/');
  return parts.length >= 2 ? parts[parts.length - 2] : '';
}

function findArtistInText(text, currentArtist) {
  if (!text) return null;
  const tl = text.toLowerCase();
  const tn = normName(text);

  // Check aliases
  for (const [abbr, full] of Object.entries(ALIASES)) {
    if (normName(full) === normName(currentArtist)) continue;
    const re = new RegExp('(?:^|[\\s\\-_])' + abbr.toLowerCase() + '(?:[\\s\\-_0-9]|$)', 'i');
    if (re.test(tl)) return full;
  }

  // Check full artist names
  for (const { artist, norm } of allArtistNorms) {
    if (normName(artist) === normName(currentArtist)) continue;
    if (tn.includes(norm)) return artist;
  }
  return null;
}

const findings = [];

shows.forEach(s => {
  const parentSegment = getParentSegment(s.FolderPath, s.FolderName);
  const folder = s.FolderName || '';

  // Check parent folder (strongest signal — usually the artist folder on disk)
  const detectedInParent = findArtistInText(parentSegment, s.Artist);
  // Check folder name itself
  const detectedInFolder = findArtistInText(folder, s.Artist);

  // Also check if artist field is in folder path at all
  const artistNorm = normName(s.Artist);
  const pathNorm = normName(s.FolderPath || '');
  const folderNorm = normName(folder);
  const parentNorm = normName(parentSegment);

  const artistPresentInPath = SKIP_DETECTION.has(s.Artist) ||
    pathNorm.includes(artistNorm) ||
    Object.entries(ALIASES).some(([abbr, full]) =>
      normName(full) === artistNorm && (folderNorm.includes(normName(abbr)) || parentNorm.includes(normName(abbr)))
    );

  if (detectedInParent && normName(detectedInParent) !== normName(s.Artist)) {
    findings.push({
      ShowID: s.ShowID,
      Artist: s.Artist,
      DetectedArtist: detectedInParent,
      Source: 'parent folder',
      FolderName: folder,
      ParentFolder: parentSegment,
    });
  } else if (detectedInFolder && normName(detectedInFolder) !== normName(s.Artist)) {
    findings.push({
      ShowID: s.ShowID,
      Artist: s.Artist,
      DetectedArtist: detectedInFolder,
      Source: 'folder name',
      FolderName: folder,
      ParentFolder: parentSegment,
    });
  } else if (!artistPresentInPath && s.Artist.length >= 5 && !SKIP_DETECTION.has(s.Artist)) {
    // Artist name doesn't appear anywhere in path — possibly wrong folder
    findings.push({
      ShowID: s.ShowID,
      Artist: s.Artist,
      DetectedArtist: '(artist absent from path)',
      Source: 'missing',
      FolderName: folder,
      ParentFolder: parentSegment,
    });
  }
});

// Separate into conflict (another artist detected) vs missing (artist absent)
const conflicts = findings.filter(f => f.DetectedArtist !== '(artist absent from path)');
const missing = findings.filter(f => f.DetectedArtist === '(artist absent from path)');

console.log('=== ARTIST CONFLICTS — folder suggests a different artist (' + conflicts.length + ') ===');
conflicts.forEach(f => {
  console.log('\nShowID:  ' + f.ShowID);
  console.log('Artist:  ' + f.Artist + '  →  detected: ' + f.DetectedArtist + ' [via ' + f.Source + ']');
  console.log('Folder:  ' + f.FolderName);
  console.log('Parent:  ' + f.ParentFolder);
});

console.log('\n\n=== ARTIST ABSENT FROM PATH — folder name has no trace of the artist (' + missing.length + ') ===');
missing.forEach(f => {
  console.log('\nShowID:  ' + f.ShowID);
  console.log('Artist:  ' + f.Artist);
  console.log('Folder:  ' + f.FolderName);
  console.log('Parent:  ' + f.ParentFolder);
});

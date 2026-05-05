/**
 * Venue/Event metadata audit and correction script.
 * Detects junk VenueName/EventOrFestival, extracts correct values from FolderName/Notes.
 * Run: node scripts/fix_venue_event.mjs
 * Apply: node scripts/fix_venue_event.mjs --apply
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SHOWS_PATH = resolve(ROOT, 'public/shows.json');
const shows = JSON.parse(readFileSync(SHOWS_PATH, 'utf8'));

// ─── Festival / event name patterns ──────────────────────────────────────────
// Matched against FolderName and parent-folder segment only (NOT Notes — too noisy).
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

// Junk patterns — field contains this → needs fixing
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
  /\.{4,}/,  // "Venue....: X" — Notes format bleed into field
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

  // Strip leading decorators like "---- Artist" or "== ARTIST =="
  const stripped = vLower.replace(/^[-=_*\s!#]+/, '').trim();
  if (stripped === artistLower || stripped.startsWith(artistLower + ' ') || stripped.startsWith(artistLower + '-')) return true;

  // Short pure-number fragment
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
  // Matches "Venue: X" or "Venue....: X" (dots-padded Notes format)
  const m = notes.match(/^venue[\s.]*(?:name[\s.]*)?\s*:\s*([^\n;]{3,80})/im);
  return m ? m[1].trim() : null;
}

function proposeCorrection(show) {
  const artist = show.Artist || '';
  const venue = (show.VenueName || '').trim();
  const event = (show.EventOrFestival || '').trim();
  const folderName = (show.FolderName || '').trim();
  const folderPath = (show.FolderPath || '').trim();
  const notes = (show.Notes || '').trim();

  const venueJunk = isJunk(venue, artist);
  const eventJunk = isJunk(event, artist);
  if (!venueJunk && !eventJunk) return null;

  // Festival detection: FolderName + parent path segment only
  const festivalFromFolder = extractFestivalFromText(folderName);
  const parentFolder = folderPath.split('/').slice(-2, -1)[0] || '';
  const festivalFromParent = extractFestivalFromText(parentFolder);
  const festival = festivalFromFolder || festivalFromParent;

  // Venue: explicit "Venue: X" label in Notes
  const venueFromNotes = extractVenueFromNotes(notes);

  let proposedVenue, proposedEvent;
  if (festival) {
    proposedEvent = festival;
    proposedVenue = venueFromNotes || (venueJunk ? '' : venue);
  } else {
    proposedEvent = eventJunk ? '' : event;
    proposedVenue = venueJunk ? (venueFromNotes || '') : (venueFromNotes || venue);
  }

  let confidence = 'low';
  if (festivalFromFolder || venueFromNotes) confidence = 'high';
  else if (festivalFromParent) confidence = 'medium';

  const changed = (proposedEvent !== event) || (proposedVenue !== venue);
  if (!changed) return null;

  return {
    ShowID: show.ShowID,
    Artist: artist,
    ShowDate: show.ShowDate,
    FolderName: folderName,
    original: { venue, event },
    proposed: { venue: proposedVenue, event: proposedEvent },
    confidence,
    venueJunk,
    eventJunk,
    sources: { festivalFromFolder, festivalFromParent, venueFromNotes },
  };
}

// ─── Run audit ────────────────────────────────────────────────────────────────
const proposals = [];
for (const show of shows) {
  const result = proposeCorrection(show);
  if (result) proposals.push(result);
}

const byConf = { high: 0, medium: 0, low: 0 };
for (const p of proposals) byConf[p.confidence]++;

// ─── Apply mode ───────────────────────────────────────────────────────────────
const applyMode = process.argv.includes('--apply');

if (applyMode) {
  const proposalMap = new Map(proposals.map(p => [p.ShowID, p]));
  let applied = 0;
  const updated = shows.map(show => {
    const p = proposalMap.get(show.ShowID);
    if (!p) return show;
    applied++;
    return {
      ...show,
      VenueName: p.proposed.venue,
      EventOrFestival: p.proposed.event,
    };
  });
  writeFileSync(SHOWS_PATH, JSON.stringify(updated, null, 2) + '\n');
  console.log(`Applied ${applied} corrections to ${SHOWS_PATH}`);
} else {
  // Audit report
  console.log(`\n=== VENUE/EVENT AUDIT ===`);
  console.log(`Total shows: ${shows.length}`);
  console.log(`Proposals: ${proposals.length} (high=${byConf.high}, medium=${byConf.medium}, low=${byConf.low})`);

  console.log('\n--- HIGH CONFIDENCE (festival from folder) ---');
  proposals.filter(p => p.confidence === 'high' && p.sources.festivalFromFolder).slice(0, 30).forEach(p => {
    console.log(`[${p.Artist}] ${p.FolderName}`);
    console.log(`  Venue: "${p.original.venue}" → "${p.proposed.venue}"`);
    console.log(`  Event: "${p.original.event}" → "${p.proposed.event}"`);
  });

  console.log('\n--- HIGH CONFIDENCE (venue from notes label) ---');
  proposals.filter(p => p.confidence === 'high' && p.sources.venueFromNotes && !p.sources.festivalFromFolder).forEach(p => {
    console.log(`[${p.Artist}] ${p.FolderName}`);
    console.log(`  Venue: "${p.original.venue}" → "${p.proposed.venue}"`);
    console.log(`  Event: "${p.original.event}" → "${p.proposed.event}"`);
  });

  console.log('\n--- MEDIUM CONFIDENCE (festival from parent path) ---');
  proposals.filter(p => p.confidence === 'medium').forEach(p => {
    console.log(`[${p.Artist}] ${p.FolderName} (parent: ${p.sources.festivalFromParent})`);
    console.log(`  Venue: "${p.original.venue}" → "${p.proposed.venue}"`);
    console.log(`  Event: "${p.original.event}" → "${p.proposed.event}"`);
  });

  console.log('\n--- LOW CONFIDENCE SAMPLE (first 20) ---');
  proposals.filter(p => p.confidence === 'low').slice(0, 20).forEach(p => {
    console.log(`[${p.Artist}] ${p.FolderName}`);
    console.log(`  Venue: "${p.original.venue}" → "${p.proposed.venue}"`);
    console.log(`  Event: "${p.original.event.substring(0, 60)}" → "${p.proposed.event}"`);
  });
}

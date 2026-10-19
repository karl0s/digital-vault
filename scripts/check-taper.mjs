/**
 * Taper guard: public/shows.json must not name a taper or uploader, nor carry
 * their contact details, links or tracker names (owner's rule, 2026-10-16; the
 * repository is public). Run by scripts/health-check.py, which blocks the push
 * and the deploy when this exits 1.
 *
 *     node scripts/check-taper.mjs
 *
 * Two tests:
 *   1. The redaction rules (tools/taper-redaction/redact.mjs) would change
 *      nothing in Lineage, Notes or SourceEquipment, and no Setlist entry is a
 *      credit. New sidecar text fails this until the apply tool has run.
 *   2. No known handle appears anywhere in those fields or PrivateNotes. The
 *      names live only in the owner's private list; scripts/taper-names.sha1.json
 *      holds their hashes, so this file can recognise a name without stating it.
 *
 * Folder and file names (FolderName, FolderPath, RepVideoFiles) are exempt: the
 * tools find folders on the drive by them.
 *
 * Fix a failure with: node tools/taper-redaction/apply.mjs --apply
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { redactShow, redactLineage, redactNotes, nameKey, PATTERNS } from '../tools/taper-redaction/redact.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// An optional path checks another copy of the data (used to test this guard).
const shows = JSON.parse(readFileSync(process.argv[2] || join(ROOT, 'public/shows.json'), 'utf8'));
const hashes = new Set(JSON.parse(readFileSync(join(ROOT, 'scripts/taper-names.sha1.json'), 'utf8')));
const sha1 = t => createHash('sha1').update(t).digest('hex');
const { EMAIL, OBFUSCATED, SITES, URL } = PATTERNS;
const has = (rx, t) => { rx.lastIndex = 0; const h = rx.test(t); rx.lastIndex = 0; return h; };

/** Every run of one to five words, as the hashes were made (nameKey). */
function knownName(text) {
  const words = nameKey(text).split(' ').filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    for (let n = 1; n <= 5 && i + n <= words.length; n++) {
      if (hashes.has(sha1(words.slice(i, i + n).join(' ')))) return true;
    }
  }
  return false;
}

const problems = [];
const report = (s, field, what, text) => problems.push(`${s.ShowID} ${s.Artist} — ${field}: ${what}: ${String(text).replace(/\s+/g, ' ').slice(0, 90)}`);

for (const s of shows) {
  const r = redactShow(s);
  for (const c of r.lineage.changes) report(s, 'Lineage', c.why, c.removed);
  for (const c of r.notes.changes) report(s, 'Notes', c.why, c.before);
  if (s.SourceEquipment) for (const c of redactLineage(s.SourceEquipment).changes) if (c.why !== 'filler') report(s, 'SourceEquipment', c.why, c.removed);
  for (const e of (s.Setlist || '').split(';').map(x => x.trim()).filter(Boolean)) {
    if (has(EMAIL, e) || has(URL, e)) report(s, 'Setlist', 'contact or link', e);
  }
  if (s.PrivateNotes) {
    for (const line of s.PrivateNotes.split('\n')) {
      if (has(EMAIL, line) || has(OBFUSCATED, line)) report(s, 'PrivateNotes', 'email address', line);
      else if (has(SITES, line)) report(s, 'PrivateNotes', 'tracker or site', line);
    }
  }
  for (const f of ['Lineage', 'Notes', 'SourceEquipment', 'Setlist', 'PrivateNotes']) {
    // A setlist's "(Stevie Wonder cover)" names the song's original artist, never a taper.
    const text = f === 'Setlist' ? (s[f] || '').replace(/\([^()]*\bcover\)/gi, '') : (s[f] || '');
    for (const line of text.split('\n')) if (line && knownName(line)) { report(s, f, 'a known taper or uploader', line); break; }
  }
}

if (problems.length) {
  for (const p of problems) console.log(p);
  process.exit(1);
}
console.log(`No taper names, contacts, links or tracker names in ${shows.length} records — OK`);

/**
 * Taper redaction review: renders ~/VaultShots/reports/taper-redaction.html.
 *
 * Runs the rules in redact.mjs over every record's Lineage and Notes and shows
 * each change before and after, so the owner can check them before anything is
 * published. Read-only: it writes the page and nothing else. Picks are saved in
 * the page; "Copy for Claude Code" exports the exceptions to paste back.
 *
 *     node tools/taper-redaction/build.mjs && open ~/VaultShots/reports/taper-redaction.html
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { redactShow, namesOf } from './redact.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const REPORTS = join(homedir(), 'VaultShots/reports');
const OUT = join(REPORTS, 'taper-redaction.html');

const shows = JSON.parse(readFileSync(join(REPO, 'public/shows.json'), 'utf8'));

const rows = [];
const names = new Map();
const addName = (n, id) => {
  const k = n.trim();
  if (!k || k.length > 60) return;
  if (!names.has(k)) names.set(k, new Set());
  names.get(k).add(id);
};

const results = new Map(shows.map(s => [s.ShowID, redactShow(s)]));
for (const s of shows) {
  const { lineage: lin, notes } = results.get(s.ShowID);
  if (!lin.changes.length && !notes.changes.length) continue;
  for (const n of namesOf({ lineage: lin, notes })) addName(n, s.ShowID);
  rows.push({
    id: s.ShowID,
    artist: s.Artist,
    date: s.ShowDate || 'Undated',
    event: s.EventOrFestival || s.VenueName || '',
    hidden: s.Hidden === 'Yes',
    lineage: lin.changes.length ? { before: s.Lineage, after: lin.text, why: [...new Set(lin.changes.map(c => c.why))] } : null,
    notes: notes.changes.map(c => ({ section: c.section, before: c.before, after: c.after, why: c.why })),
  });
}
rows.sort((a, b) => a.artist.localeCompare(b.artist) || a.date.localeCompare(b.date));

// The same name in a show whose own credits didn't name it: a handle that turns
// up again elsewhere ("by fooguy99"), or just an ordinary word (a band
// member's first name, a song title). Distinctive names default to removal,
// ordinary words to keeping; the owner decides each one.
const DICT = existsSync('/usr/share/dict/words')
  ? new Set(readFileSync('/usr/share/dict/words', 'utf8').split('\n').map(w => w.toLowerCase()))
  : new Set();
const distinctive = n => /\d/.test(n) || /[a-z][A-Z]/.test(n) || /[A-Z]{2,}[a-z]/.test(n)
  || (/^[A-Z][a-z]{5,}$/.test(n) && !DICT.has(n.toLowerCase()))
  || (/\s/.test(n) && n.split(/\s+/).filter(w => /^[A-Z]/.test(w)).length >= 2)
  || (/^[a-z_]+$/.test(n) && n.length >= 5 && !DICT.has(n));
const foundIn = new Map();
for (const s of shows) for (const n of namesOf(results.get(s.ShowID))) {
  if (!foundIn.has(n)) foundIn.set(n, new Set());
  foundIn.get(n).add(s.ShowID);
}
const elsewhere = [];
for (const [name, ids] of foundIn) {
  const rx = new RegExp(`(?<![\\p{L}\\p{N}_@])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_@])`, 'u');
  for (const s of shows) {
    if (ids.has(s.ShowID)) continue;
    const r = results.get(s.ShowID);
    const line = [r.lineage.text, ...r.notes.text.split('\n')].find(l => rx.test(l));
    if (line) elsewhere.push({ name, id: s.ShowID, artist: s.Artist, date: s.ShowDate || 'Undated', line: line.trim().slice(0, 300), remove: distinctive(name) });
  }
}
elsewhere.sort((a, b) => Number(b.remove) - Number(a.remove) || a.name.localeCompare(b.name));

const withLineage = shows.filter(s => s.Lineage).length;
const withNotes = shows.filter(s => s.Notes).length;
const data = {
  rows,
  elsewhere,
  names: [...names].map(([name, ids]) => ({ name, count: ids.size })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  stats: {
    lineageChanged: rows.filter(r => r.lineage).length,
    withLineage,
    notesChanged: rows.filter(r => r.notes.length).length,
    withNotes,
    edits: rows.reduce((n, r) => n + r.notes.length + (r.lineage ? 1 : 0), 0),
    generation: shows.filter(s => s.Generation).length,
  },
};

mkdirSync(REPORTS, { recursive: true });
const page = readFileSync(join(HERE, 'template.html'), 'utf8')
  .replaceAll('__REPO__', REPO)
  .replace('__DATA__', JSON.stringify(data).replace(/</g, '\\u003c'));
writeFileSync(OUT, page);
console.log(`${OUT}\n${elsewhere.length} cross-show mentions (${elsewhere.filter(e => e.remove).length} distinctive); ${data.stats.lineageChanged}/${withLineage} lineage strings and ${data.stats.notesChanged}/${withNotes} notes change; ${data.stats.edits} edits; ${data.names.length} names found`);

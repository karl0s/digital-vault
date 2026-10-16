/**
 * Taper redaction, applied (owner's choice, 2026-10-16: "Option B"): every
 * taper's name, contact and link is first captured into the owner's private
 * record, then removed from public/shows.json itself, so the public repository
 * holds only redacted text.
 *
 *     node tools/taper-redaction/apply.mjs            # dry run: prints what would change
 *     node tools/taper-redaction/apply.mjs --apply    # capture, then write shows.json
 *
 * Re-run it after anything pastes new sidecar text (a re-scan, a new record):
 * the health check blocks a push until it has.
 *
 * Writes, in private/ (git-ignored; never committed):
 *   taper-originals.json  every changed field's original text, by ShowID. Merged
 *                         across runs and never overwritten, so nothing is lost.
 *   taper-names.json      distinctive names and handles, removed in every show.
 *   taper-contacts.md     the owner's master record: people, emails, links,
 *                         sites, and show by show what was removed.
 * And, tracked: scripts/taper-names.sha1.json, only the hashes of those names,
 * so the health check can recognise one without the repository naming it.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { redactShow, redactLineage, redactNotes, namesOf, classify, clean, nameKey, PATTERNS } from './redact.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const SHOWS = join(REPO, 'public/shows.json');
const PRIV = join(REPO, 'private');
const ORIGINALS = join(PRIV, 'taper-originals.json');
const NAMES = join(PRIV, 'taper-names.json');
const RECORD = join(PRIV, 'taper-contacts.md');
const HASHES = join(REPO, 'scripts/taper-names.sha1.json');
const APPROVALS = join(REPO, 'scripts/setlist-removals-approved.json');
const APPLY = process.argv.includes('--apply');

const { EMAIL, URL, DOMAIN, SITES, IM, OBFUSCATED } = PATTERNS;
const all = (rx, t) => [...(t || '').matchAll(new RegExp(rx.source, rx.flags.includes('g') ? rx.flags : rx.flags + 'g'))].map(m => m[0]);
const has = (rx, t) => { rx.lastIndex = 0; const h = rx.test(t || ''); rx.lastIndex = 0; return h; };
const sha1 = t => createHash('sha1').update(t).digest('hex');
const esc = rx => rx.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Handles in the every-show list match in any case; other names exactly.
let anyCase = new Set();
const caseless = n => [...n].map(ch => ch.toLowerCase() !== ch.toUpperCase() ? `[${esc(ch.toLowerCase())}${esc(ch.toUpperCase())}]` : esc(ch)).join('');
const wordRx = names => new RegExp(`(?<![\\p{L}\\p{N}_@])(?:${names.map(n => anyCase.has(n.toLowerCase()) ? caseless(n) : esc(n)).join('|')})(?![\\p{L}\\p{N}_@])`, 'gu');

const raw = readFileSync(SHOWS, 'utf8');
const shows = JSON.parse(raw);
mkdirSync(PRIV, { recursive: true });

// ── Which names go everywhere ───────────────────────────────────────────────
// A distinctive handle ("fooguy99", "SomeHandle", "Jo Bloggs") is removed in
// every show; an ordinary word (a first name, a song title) only in the show whose own
// credits name it, so a band member or a song title elsewhere survives.
const DICT = existsSync('/usr/share/dict/words')
  ? new Set(readFileSync('/usr/share/dict/words', 'utf8').split('\n').map(w => w.toLowerCase()))
  : new Set();
const distinctive = n => /\d/.test(n) || /[a-z][A-Z]/.test(n) || /[A-Z]{2,}[a-z]/.test(n)
  || (/^[A-Z][a-z]{5,}$/.test(n) && !DICT.has(n.toLowerCase()))
  || (/\s/.test(n) && n.split(/\s+/).filter(w => /^[A-Z]/.test(w)).length >= 2)
  || (/^[a-z_]+$/.test(n) && n.length >= 5 && !DICT.has(n));
const known = existsSync(NAMES) ? JSON.parse(readFileSync(NAMES, 'utf8')) : [];
const firstPass = new Map(shows.map(s => [s.ShowID, redactShow(s)]));
const everywhere = [...new Set([...known, ...[...firstPass.values()].flatMap(r => namesOf(r)).filter(distinctive)])].sort();
anyCase = new Set(everywhere.map(n => n.toLowerCase()));

// ── Redact every show ───────────────────────────────────────────────────────
const TRACKER_URL = u => has(SITES, u) || /dimeadozen|thetradersden|etree|zomb|mindwarp|demonoid|bootlegzone/i.test(u);

/** PrivateNotes are our own notes: only names, emails and tracker links/names go, marked. */
const NEVER_TAPERS = new Set(['Karl', 'Claude', 'owner', 'Owner']);
function redactPrivate(text, names) {
  if (!text) return { text, changes: [] };
  const changes = [];
  const out = text.split('\n').map(line => {
    let l = line;
    // A sidecar credit line moved into our notes ("Captured & authored by X  CONTENT
    // TYPE…"): a segment that opens with a credit verb names its taper after "by".
    const moved = line.split(/\s{2,}/)
      .filter(seg => /^\W*(?:recorded|captured|authored|edited|uploaded|upped|seeded|transferred|transfered|taped|videotaped|encoded|ripped|torrented|provided|synced)\b/i.test(seg))
      .flatMap(seg => [...seg.matchAll(/\bby:?\s+([\p{L}\p{N}][\p{L}\p{N}_.-]*(?:\s+[\p{Lu}][\p{L}_.-]*)?)/gu)].map(m => clean(m[1])))
      .filter(n => n.length >= 3 && !NEVER_TAPERS.has(n) && classify(n) === 'name');
    const lineNames = [...new Set([...names, ...moved])].filter(n => !NEVER_TAPERS.has(n)).sort((a, b) => b.length - a.length);
    const rx = lineNames.length ? wordRx(lineNames) : null;
    l = l.replace(new RegExp(EMAIL.source, 'g'), '[email removed]').replace(new RegExp(OBFUSCATED.source, 'gi'), '[email removed]');
    l = l.replace(new RegExp(URL.source, 'gi'), u => TRACKER_URL(u) ? '[tracker link removed]' : u);
    l = l.replace(new RegExp(DOMAIN.source, 'gi'), d => has(SITES, d) || TRACKER_URL(d) ? '[tracker]' : d);
    l = l.replace(new RegExp(SITES.source, 'gi'), '[tracker]');
    if (rx) l = l.replace(rx, '[taper]');
    if (l !== line) changes.push({ before: line, after: l, why: 'taper name, contact or tracker' });
    return l;
  });
  return { text: out.join('\n'), changes };
}

/**
 * A Setlist entry that is a credit ("Thanks to …"), not a song: the rules call
 * it a credit AND it names someone already found in this show's credits, or
 * holds an email or link. Song titles ("Thanks for the Memories") never qualify.
 */
const creditEntry = (e, names = []) => {
  if (has(EMAIL, e) || has(URL, e) || has(DOMAIN, e)) return true;
  const r = redactNotes(e);
  const ruled = r.changes.some(c => /credit|contact|signature|tracker|link|website/.test(c.why));
  return ruled && names.length > 0 && wordRx(names).test(e);
};

const results = [];
for (const s of shows) {
  const r = redactShow(s, { everywhere });
  const own = namesOf(r);
  const names = [...new Set([...own, ...everywhere])].filter(n => n.length >= 3).sort((a, b) => b.length - a.length);
  const next = {};
  const fieldChanges = {};
  if (r.lineage.changes.length) { next.Lineage = r.lineage.text; fieldChanges.Lineage = r.lineage.changes; }
  if (r.notes.changes.length) { next.Notes = r.notes.text; fieldChanges.Notes = r.notes.changes; }
  if (s.SourceEquipment) {
    const se = redactLineage(s.SourceEquipment);
    const named = names.length && wordRx(names).test(s.SourceEquipment);
    let t = se.text;
    if (named) t = t.replace(wordRx(names), '').replace(/\s*(?:>|->)\s*(?=\)|$)/g, '').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();
    if (se.changes.some(c => c.why !== 'filler') || named) { next.SourceEquipment = t; fieldChanges.SourceEquipment = [{ before: s.SourceEquipment, after: t, why: 'tracker or person in the chain' }]; }
  }
  if (s.PrivateNotes) {
    const p = redactPrivate(s.PrivateNotes, names);
    if (p.changes.length) { next.PrivateNotes = p.text; fieldChanges.PrivateNotes = p.changes; }
  }
  if (s.Setlist) {
    const entries = s.Setlist.split(';').map(x => x.trim()).filter(Boolean);
    const dropped = entries.filter(e => creditEntry(e, names));
    if (dropped.length) {
      next.Setlist = entries.filter(e => !dropped.includes(e)).join('; ');
      fieldChanges.Setlist = dropped.map(d => ({ before: d, after: null, why: 'credit line, not a song' }));
    }
  }
  if (Object.keys(next).length) results.push({ show: s, next, fieldChanges, names: own });
}

// ── The approvals file must not name anyone either ──────────────────────────
// Setlist removals it acknowledges may be stored as "sha1:<hash>" of the
// normalised string (scripts/health-check.py, _norm_song) instead of the text.
const normSong = t => t.trim().replace(/\s*\([^()]*\)\s*$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const approvals = JSON.parse(readFileSync(APPROVALS, 'utf8'));
const approvalChanges = [];
const sensitive = t => creditEntry(t, everywhere) || has(EMAIL, t) || has(SITES, t) || (everywhere.length > 0 && wordRx(everywhere).test(t));
for (const [sid, entry] of Object.entries(approvals)) {
  if (sid.startsWith('_')) continue;
  entry.entries = entry.entries.map(e => {
    if (e.startsWith('sha1:') || !sensitive(e)) return e;
    approvalChanges.push({ sid, before: e });
    return `sha1:${sha1(normSong(e))}`;
  });
  if (entry.why && everywhere.length) entry.why = entry.why.replace(wordRx(everywhere), '[taper]');
}
for (const { show, fieldChanges } of results) {
  if (!fieldChanges.Setlist) continue;
  const e = approvals[show.ShowID] || (approvals[show.ShowID] = { artist: show.Artist, show: `${show.ShowDate} ${show.EventOrFestival || show.VenueName || ''}`.trim(), entries: [], why: '' });
  for (const c of fieldChanges.Setlist) e.entries.push(`sha1:${sha1(normSong(c.before))}`);
  e.why = [e.why, 'A credit line imported into Setlist as if it were a song; taper names are not published (owner, 2026-10-16). The text is in the owner\'s private record.'].filter(Boolean).join(' ');
}
// Said once: an earlier version added this sentence again on every run.
const SHA1_NOTE = ' An entry may be "sha1:<hash>" of the normalised string where the string itself must not be published (a taper\'s name).';
approvals._README = approvals._README.split(SHA1_NOTE).join('').replace(/ Anything removed WITHOUT/, `${SHA1_NOTE} Anything removed WITHOUT`);

// ── Report ──────────────────────────────────────────────────────────────────
const count = f => results.filter(r => r.fieldChanges[f]).length;
console.log(`${results.length} shows change: Lineage ${count('Lineage')}, Notes ${count('Notes')}, SourceEquipment ${count('SourceEquipment')}, PrivateNotes ${count('PrivateNotes')}, Setlist ${count('Setlist')}`);
console.log(`${everywhere.length} distinctive names removed in every show; ${approvalChanges.length} approval entries hashed`);
if (!APPLY) {
  for (const { show, fieldChanges } of results) for (const f of ['SourceEquipment', 'PrivateNotes', 'Setlist'])
    for (const c of fieldChanges[f] || []) {
      const cut = t => process.argv.includes('--verbose') ? t : t.slice(0, 110);
      console.log(`  ${show.ShowID} ${f}: ${cut(String(c.before))}\n      → ${c.after === null ? '(removed)' : cut(String(c.after))}`);
    }
  for (const a of approvalChanges) console.log(`  approvals ${a.sid}: ${a.before} → sha1`);
  console.log('\nDry run. Nothing written. Add --apply to capture and write.');
  process.exit(0);
}

// ── Capture first, then write ───────────────────────────────────────────────
const originals = existsSync(ORIGINALS) ? JSON.parse(readFileSync(ORIGINALS, 'utf8')) : {};
for (const { show, next } of results) {
  const o = originals[show.ShowID] || (originals[show.ShowID] = { Artist: show.Artist, ShowDate: show.ShowDate, Event: show.EventOrFestival || show.VenueName || '' });
  for (const f of Object.keys(next)) if (!(f in o)) o[f] = show[f];
}
originals._approvals = originals._approvals || [];
for (const a of approvalChanges) originals._approvals.push(a);
writeFileSync(ORIGINALS, JSON.stringify(originals, null, 2) + '\n');
writeFileSync(NAMES, JSON.stringify(everywhere, null, 2) + '\n');
writeFileSync(RECORD, record(originals, everywhere));
// The capture must exist before the source text goes.
for (const f of [ORIGINALS, NAMES, RECORD]) if (!existsSync(f)) throw new Error(`capture missing: ${f}`);
const ignored = execSync(`git check-ignore -q "${RECORD}" && echo yes || echo no`, { cwd: REPO }).toString().trim();
if (ignored !== 'yes') throw new Error('private/ is not git-ignored: refusing to write the record where git could pick it up');

for (const { show, next } of results) Object.assign(show, next);
writeFileSync(SHOWS, JSON.stringify(shows, null, 2) + '\n');
writeFileSync(APPROVALS, JSON.stringify(approvals, null, 2) + '\n');
const hashes = [...new Set(everywhere.map(nameKey).filter(Boolean).map(sha1))].sort();
writeFileSync(HASHES, JSON.stringify(hashes, null, 2) + '\n');
console.log(`Captured to ${RECORD.replace(REPO + '/', '')}; wrote public/shows.json, ${APPROVALS.replace(REPO + '/', '')}, ${HASHES.replace(REPO + '/', '')}`);

// ── The owner's record ──────────────────────────────────────────────────────
function record(originals, everywhere) {
  const ids = Object.keys(originals).filter(k => !k.startsWith('_'));
  const byId = Object.fromEntries(shows.map(s => [s.ShowID, s]));
  const people = new Map();     // name → { roles:Set, contacts:Set, shows:Set }
  const emails = new Map();     // email → { names:Set, shows:Set, line }
  const links = new Map();      // url → Set(show)
  const sites = new Map();      // site → Set(show)
  const perShow = [];
  const label = id => { const o = originals[id]; return `${o.Artist} — ${o.ShowDate || 'undated'}${o.Event ? ' — ' + o.Event : ''} (\`${id}\`)`; };
  const ROLE = /\b(taper|taped|videotaped|recorded|filmed|transferred|transfer|captured|capped|authored|author|re-?author|encoded|edited|synced|sync|uploaded|upped|seeded|posted|torrented|ripped|provided|compiled|camera|thanks|thanx|credit|requested|request)\b/gi;
  const roleWord = w => ({ taped: 'taper', videotaped: 'taper', recorded: 'recorded', filmed: 'taper', transfer: 'transfer', transferred: 'transfer', captured: 'capture', capped: 'capture', authored: 'authoring', author: 'authoring', reauthor: 're-author', 're-author': 're-author', encoded: 'encoding', edited: 'editing', synced: 'sync', sync: 'sync', uploaded: 'upload', upped: 'upload', seeded: 'upload', posted: 'upload', torrented: 'upload', ripped: 'rip', provided: 'provided source', compiled: 'compiled', camera: 'camera', thanks: 'thanked', thanx: 'thanked', credit: 'credited', requested: 'requested', request: 'requested' }[w.toLowerCase()] || w.toLowerCase());

  for (const id of ids) {
    const o = originals[id];
    const pseudo = { ShowID: id, Lineage: o.Lineage ?? byId[id]?.Lineage ?? '', Notes: o.Notes ?? byId[id]?.Notes ?? '' };
    const r = redactShow(pseudo, { everywhere });
    const own = namesOf(r);
    const nameList = [...new Set([...own, ...everywhere])].filter(n => n.length >= 3).sort((a, b) => b.length - a.length);
    const nrx = nameList.length ? wordRx(nameList) : null;
    // Contacts are paired with names only from the sidecar text itself; our own
    // notes (PrivateNotes) mention sources like setlist.fm beside a taper's name.
    const sidecar = ['Lineage', 'Notes', 'SourceEquipment', 'Setlist'].map(f => o[f] || '').join('\n');
    const lines = [...sidecar.split(/\n|\s\|\s/).map(l => [l, true]), ...(o.PrivateNotes || '').split('\n').map(l => [l, false])];
    for (const [line, fromSidecar] of lines) {
      const found = nrx ? [...new Set(line.match(nrx) || [])] : [];
      const mails = [...new Set([...all(EMAIL, line).map(e => e.replace(/^<|>$/g, '')), ...all(OBFUSCATED, line)])];
      const urls = [...new Set([...all(URL, line), ...all(DOMAIN, line).filter(d => !all(URL, line).some(u => u.includes(d)))])];
      const roles = [...new Set((line.match(ROLE) || []).map(roleWord))];
      for (const n of found) {
        const p = people.get(n) || people.set(n, { roles: new Set(), contacts: new Set(), shows: new Set() }).get(n);
        p.shows.add(id);
        if (!fromSidecar) continue;
        roles.forEach(x => p.roles.add(x)); mails.forEach(m => p.contacts.add(m)); urls.forEach(u => p.contacts.add(u));
        if (IM.test(line)) p.contacts.add(line.trim());
      }
      for (const m of mails) { const e = emails.get(m) || emails.set(m, { names: new Set(), shows: new Set(), line: line.trim() }).get(m); if (fromSidecar) found.forEach(n => e.names.add(n)); e.shows.add(id); }
      for (const u of urls) (links.get(u) || links.set(u, new Set()).get(u)).add(id);
      for (const st of all(SITES, line)) { const k = st.toLowerCase().replace(/\s+/g, ' '); (sites.get(k) || sites.set(k, new Set()).get(k)).add(id); }
    }
    // What came out, field by field.
    const blocks = [];
    if (o.Lineage !== undefined) blocks.push(`**Lineage** — original:\n\n> ${o.Lineage.replace(/\n/g, '\n> ')}\n\nPublished: ${byId[id]?.Lineage ? '`' + byId[id].Lineage.replace(/`/g, "'") + '`' : '_nothing_'}`);
    if (o.SourceEquipment !== undefined) blocks.push(`**SourceEquipment** — original: \`${o.SourceEquipment.replace(/`/g, "'")}\``);
    if (o.Setlist !== undefined) {
      const now = new Set((byId[id]?.Setlist || '').split(';').map(x => x.trim()));
      blocks.push(`**Setlist** — entries removed: ${o.Setlist.split(';').map(x => x.trim()).filter(x => x && !now.has(x)).map(x => '`' + x + '`').join(', ')}`);
    }
    if (o.Notes !== undefined) {
      const now = new Set((byId[id]?.Notes || '').split('\n'));
      const gone = o.Notes.split('\n').filter(l => l.trim() && !now.has(l));
      if (gone.length) blocks.push(`**Notes** — lines removed or changed (full original in \`taper-originals.json\`):\n\n${gone.map(l => '    ' + l).join('\n')}`);
    }
    if (o.PrivateNotes !== undefined) {
      const now = new Set((byId[id]?.PrivateNotes || '').split('\n'));
      const gone = o.PrivateNotes.split('\n').filter(l => l.trim() && !now.has(l));
      if (gone.length) blocks.push(`**PrivateNotes** — original lines:\n\n${gone.map(l => '    ' + l).join('\n')}`);
    }
    perShow.push(`### ${label(id)}\n\n${blocks.join('\n\n')}`);
  }

  const showList = set => [...set].map(id => originals[id] ? `${originals[id].Artist} ${originals[id].ShowDate || ''} (\`${id}\`)` : `\`${id}\``).join('; ');
  const cell = t => String(t).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const sortedPeople = [...people].sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }));
  const byHost = new Map();
  for (const [u, set] of links) {
    const host = (u.match(/^(?:https?:\/\/|ftp:\/\/)?(?:www\.)?([^/\s:?#]+)/i) || [, u])[1].toLowerCase();
    (byHost.get(host) || byHost.set(host, []).get(host)).push([u, set]);
  }
  const today = new Date().toISOString().slice(0, 10);
  return `# Taper contacts and links — private master record

> **Private.** \`private/\` is git-ignored: this file never goes to GitHub. Written by
> \`node tools/taper-redaction/apply.mjs\` (last run ${today}) from the original text of
> ${ids.length} shows, captured before it was removed from \`public/shows.json\`. The full original
> text of every changed field is in \`private/taper-originals.json\`.

| | |
|---|---|
| People and handles | ${people.size} |
| Email addresses | ${emails.size} |
| Links | ${links.size} on ${byHost.size} sites |
| Trackers and trading sites named | ${sites.size} |
| Shows with something removed | ${ids.length} |

## People and handles

Every name the redaction removed, with what each was credited for, any contact details found on
the same line, and the shows.

| Name | Credited as | Contact found with it | Shows |
|---|---|---|---|
${sortedPeople.map(([n, p]) => `| **${cell(n)}** | ${cell([...p.roles].join(', ') || '—')} | ${cell([...p.contacts].join('<br>') || '—')} | ${cell(showList(p.shows))} |`).join('\n')}

## Email addresses

| Email | Name on the same line | Shows | Line |
|---|---|---|---|
${[...emails].sort().map(([m, e]) => `| ${cell(m)} | ${cell([...e.names].join(', ') || '—')} | ${cell(showList(e.shows))} | ${cell(e.line.slice(0, 160))} |`).join('\n')}

## Links, by site

${[...byHost].sort((a, b) => a[0].localeCompare(b[0])).map(([host, list]) => `### ${host}\n\n${list.map(([u, set]) => `- <${u.replace(/[<>]/g, '')}> — ${showList(set)}`).join('\n')}`).join('\n\n')}

## Trackers and trading sites named

| Site | Shows |
|---|---|
${[...sites].sort().map(([k, set]) => `| ${cell(k)} | ${cell(showList(set))} |`).join('\n')}

## Show by show

${perShow.join('\n\n')}
`;
}

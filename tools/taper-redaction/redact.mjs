/**
 * Taper redaction: removes people, contact details and links from the sidecar
 * text the site publishes, and keeps the technical chain.
 *
 * Owner's rule (2026-10-16): publish lineage and generation, but never a
 * taper's or uploader's name, email address, handle or website, so nobody can
 * bypass the owner and go to them directly, and nobody's contact details go
 * out without their permission. Trackers and fan sites count as websites.
 *
 * Two entry points, both pure (text in, text out, plus a list of what changed):
 *   redactLineage(text)  the `Lineage` field: " | "-joined segments, ">" chains
 *   redactNotes(text)    the `Notes` field: sidecar files under "---- name ----"
 *
 * `overrides` (from the review page) holds names confirmed as people and words
 * confirmed as harmless, so the rules only ever err on one side once.
 */

// ---------------------------------------------------------------- patterns

const EMAIL = /<?[\w.+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b>?/g;
const URL = /\b(?:https?:\/\/|ftp:\/\/|www\.)[^\s<>"'()[\]]+/gi;
const TLD = 'com|net|org|info|biz|uk|de|nl|fr|it|es|be|ch|at|dk|se|fi|pl|ru|jp|au|ca|us|tv|fm|br|ar|cl|nz|ie|pt|eu';
// A bare domain ("SOMEFANSITE.COM", "someone.free.fr"), but not a file name
// that merely contains one ("dvdf.info.txt", "SomeTracker.org.txt").
const DOMAIN = new RegExp(`\\b(?:[a-z0-9][a-z0-9-]*\\.)+(?:${TLD})\\b(?![.\\w-])(?:/[^\\s<>"'()[\\]]*)?`, 'gi');
// Trackers and trading sites named without a domain.
const SITES = /\b(?:dime\s?a\s?dozen|dimeadozen|dime|the\s?traders'?\s?den|thetradersden|traders'?\s?den|ttd|mind[\s-]?warp[\s-]?pa+v+i+l+i*on|btarg|(?:db\.)?etree|zombtorrents|zomb|shnflac|lossless\s?legs|bootlegzone|tapecity|netphoria|chilecomparte|cross\s?town\s?torrents|hunger\s?city|demonoid|zombtracker|the-zomb|alt\.binaries(?:\.[\w-]+)*)\b(?:-\w+)?/gi;
const HANDLE = /(?<![\w.@])@[a-z0-9_][\w.]{2,}/g;
// "someone(at)gmail(dot)com"
const OBFUSCATED = /\b[\w.+-]+\s*[([{]?\s*at\s*[)\]}]?\s*[\w-]+\s*[([{]?\s*dot\s*[)\]}]?\s*(?:com|net|org|de|nl|fr|it|co\.uk|uk)\b/i;
const IM = /\b(?:msn|icq|skype|yahoo messenger|e-?mail me|mail me|contact me|pm me|add me|write (?:to )?me)\b/i;

// Phrases that introduce a person: "transferred by", "upped at Dime by",
// "Taper:", "thanks to". The person is whatever follows.
const VERBS = 'videotaped|taped|tape|recorded|record|filmed|shot|captured|capture|capped|transferred|transfer|encoded|re-?encoded|authored|authoring|edited|mastered|remastered|seeded|uploaded|upped|posted|torrented|ripped|provided|shared|converted|synced|sync|compiled|courtesy|made|done|brought|supplied|donated';
const BY = new RegExp(`\\b(?:${VERBS})(?:\\s*(?:&|and|/|,)\\s*(?:${VERBS}))*(?:\\s+(?:at|to|on|for)(?:\\s+(?!by\\b)\\S+)?)?\\s+(?:by|of)\\b\\s*:?\\s*`, 'i');
// "Camera 3: Sony DCR-PC101 by Sam": on a technical label line any "by" is
// a credit. Not elsewhere: song titles hold "by" ("Caught by the Fuzz").
const TECH_LINE = /^\W*(?:camera|cam|audio|video|source|mic|mics|lineage|transfer|authoring|author|menus?|editing|sync|dvd|encoding|capture|re-?author)\b[^:]{0,24}:/i;
const BY_ANY = /\bby\s*:?\s*/i;
// A header introducing a list of people: "Thanks to:", "…tracker fan mafia:".
const CREDIT_HEADER = /^(?=.{0,90}:\s*$)(?=.*\b(?:by|thanks?|thanx|credits?|supplied|provided|tracker|crew|team|mafia|helpers?|tapers?|seeders?|uploaders?|greetings?|greetz|shout(?:s|outs?)?)\b)/i;
const HANDLE_AKA = /^\s*[\w.-]+\s*\(\s*a\.?k\.?a\.?\s+[^)]+\)\s*$/i;
// "Torrented on the request of Jo Bloggs"
const REQUEST = /\b(?:(?:at|on) the request of|requested by|on behalf of|courtesy of|credited to|credits? (?:go(?:es)? )?to)\s*:?\s*/i;
const THANKS = /\b(?:(?:special|many|big|huge|extra|warm|a big)\s+)?(?:thanks|thanx|thnx|thx|cheers|kudos|props|greetz|shout\s?-?outs?|thank\s+you)\b(?:\s+(?:go(?:es)?|a lot|again|very much|so much))?\s*(?:to|for)?\s*:?\s*/i;
const LABEL = /^\W*(?:videotaped(?:\s+by)?|re-?author(?:ed)?(?:\s+by)?|taper|tapers|taped|transfer(?:red)?(?:\s+by)?|transferer|capture(?:d)?(?:\s+by)?|encode[dr]?(?:\s+by)?|authoring(?:\s+by)?|author|uploader|uploaded by|seeder|seeded by|recorded (?:&|and) torrented by|recorded by|filmed by|camera|cameraman|recordist|credits?|video by|audio by|(?:video|audio|source) provided by|audio sync(?:\s*(?:&|and)\s*authoring)?(?:\s+by)?)\s*[:_.]+[\s_.:]*/i;
const SIGNOFF = /^\W*(?:enjoy(?:\s*(?:&|and)\s*share)?|share\s*(?:&|and)\s*enjoy|cheers|peace|regards|best regards|kind regards|best wishes|have fun|greetz|greetings|later|ciao|bye|take care|happy trading|thanks|thank you|thanx)\W*$/i;

// Words that make a phrase technical (a device, format, broadcaster, step).
const TECH = new Set(`
dvd dvds dvdr dvd-r dvd+r dvd-rw dvd+rw dvd-ram dvd5 dvd9 vob vobs video_ts ifo tv hdtv sdtv dtv tvrip vhs svhs s-vhs vhs+ hi8 minidv dv dv25 mini
vcr pvr dvr hdd harddisk hard disk drive pc mac usb ethernet firewire ieee1394 scart s-video composite component capture card tuner receiver
recorder standalone sa stand-alone deck camera cam camcorder handycam mic dat md minidisc cd master gen generation 1st 2nd 3rd low lgen
dvb dvb-t dvb-s dvb-s2 dvb-c atsc ota qam clearqam isdb sat satellite cable catv catv[m] broadcast rebroadcast re-broadcast stream webstream webcast
feed live pro pro-shot proshot pro-shot. aud sbd matrix fm am radio mpeg mpeg2 mpeg-2 mpeg4 mpg m2v m2p m2t ts .ts mkv mp4 avi wmv flv mov
h264 h.264 avc hevc ac3 pcm lpcm mp2 mp3 aac wav dts ntsc pal secam 1080i 1080p 720p 576i 480i hd sd 16:9 4:3 bitrate kbps mbps vbr cbr
xp sp lp hq ep fine mode
projectx pvastrumento videoredo dvdshrink dvd shrink shrink tmpgenc tmpeg tmpgenc+ tmpegenc dvdlab dvd-lab dvdauthor dvd-author author authoring
avisynth huffyuv cce cuttermaran wingrabz altdvb avidemux ifoedit vobedit virtualdub ffmpeg mpegstreamclip streamclip eyetv freebox kmttg tivo
ts-doctor tsdoctor tsreader dvbviewer progdvb progdvbpro womble nero vegas encore avid premiere idvd ulead moviewriter decrypter dvddecrypter
imgburn pgcedit muxman handbrake mkvtoolnix menu menus chapter chapters chaptered reauthor re-author re-authored rip ripped edit edited cut cutting
encode encoded re-encode transfer transferred capture captured unknown unknwon ? n/a various see below above
panasonic sony philips phillips jvc akai topfield technisat skystar tevii hauppauge pinnacle canopus blackmagic datavideo dazzle conceptronic
zinwell motorola terk myhd vbox avermedia gigaset envision fortec dreambox vu+ humax pace nokia samsung lg toshiba pioneer magnavox funai
thomson liteon lite-on sky sky+ sky+box directv dishnetwork dish tt grundig loewe sharp hitachi aiwa matsui bush daewoo
bbc bbc1 bbc2 bbc3 bbc4 bbchd itv channel4 c4 mtv mtv2 vh1 vh2 viva channel v wdr ndr swr br zdf ard arte 3sat eins einsfestival einsplus
rockpalast orf sf rai tve etb yle nrk svt dr vpro nos nps brt vrt rtl canal+ canal multishow globo kqed nbc abc cbs fox pbs palladia fuse
axs much muchmusic musiqueplus wowow nhk cultura teema kultura tvp sic radical europe2tv mcm uverse
seller bootleg trade trader trading torrent net internet online download downloaded official release
image project nerorecode recode dvdrecorder mjpeg tools editor wizard suite xpress express
video audio professional digital analog analogue betacam tape tapes videotape videoplayer vidicraft detailer tbc procamp basf maxell tdk
file files folder transport program programme scene selection selected stereo mono hi-fi hifi nicam surround
capdvhs compressor dvdlabpro dvdmaestro dvdrw dvr-ms h264_cutter ieee mpeg-ts eac3to demux govideo imovie mpeg2cut mpeg2repair utorrent
trader's vhs-m webstreaming antenna letterbox abchd nbchd cbshd
`.trim().split(/\s+/));

// Countries (and the words in their names) are places, not people.
const PLACES = new Set(`
friesland bavaria eifel holland flanders wallonia catalonia andalusia cornwall yorkshire brittany normandy tyrol
america argentina australia austria belgique belgium brasil brazil canada chile cuba danmark denmark deutschland england espana españa europe france germany greece holland hungary ireland italia italy japan kingdom korea malaysia mexico nederland netherlands new norge northern poland portugal russia schweiz scotland serbia south spain states suomi sverige sweden switzerland uk united us usa wales zealand österreich россия
`.trim().split(/\s+/));

// Lower-case words that never name anyone: pronouns, roles, filler.
const GENERIC = new Set(`
me myself i us we you yourself yours him himself her herself them themselves it everyone everybody anyone all
the a an of to and or for in on at by from with this that these those who which here there my our your his its their
taper tapers original uploader seeder trader traders friend friends fellow guys folks people crew team community
members member board forum site original person persons whoever someone somebody anonymous unknown other others
setlist set list tracklist tracks track songs song notes note info information source lineage length runtime size quality
encore intro outro interview interviews bonus extras extra disc disk part show concert festival full complete incomplete
acoustic cover covers artwork menu thanks thank enjoy share please do not sell don't dont lossy encode
n na minutes minute min mins hours hour seconds sec reading watching listening sharing downloading viewing help patience support
lot lots bunch much very really again always everything anything nothing
creator creators s uploaders authors tapers originally shared posted
choice
`.trim().split(/\s+/));

export const clean = s => s.replace(/^[\s"'“”‘’`(\[{<*•·#~\\-]+|[\s"'“”‘’`)\]}>*•·.,;:!?~\\-]+$/g, '');
const tokens = s => clean(s).split(/\s+/).map(t => clean(t)).filter(Boolean);

/**
 * What a short phrase is: 'name' (a person or handle), 'tech', 'generic', or
 * 'sentence' (too long to be a name). Unknown words with nothing technical
 * beside them read as a name: a privacy rule should err on the side of removal.
 */
export function classify(phrase, overrides = {}) {
  const p = clean(phrase);
  if (!p) return 'generic';
  if (overrides.keep?.includes(p)) return 'generic';
  if (overrides.names?.includes(p)) return 'name';
  const ts = tokens(p);
  if (ts.length === 0) return 'generic';
  if (ts.length > 4) return 'sentence';
  const contact = [EMAIL, URL, SITES].some(rx => { rx.lastIndex = 0; const hit = rx.test(p); rx.lastIndex = 0; return hit; });
  if (contact) return 'name';
  // Dates and plain numbers say nothing either way; a token with digits and
  // capitals or slashes is a model or format code ("TF5800", "AC3/2.0").
  const sig = ts.filter(t => !/^[\d.\/:,-]+$/.test(t));
  if (!sig.length) return 'generic';
  // "Skystar2" is the Skystar card: a brand with a model number stuck on.
  const pieces = t => t.toLowerCase().split(/[()[\]{}\/+]/).map(x => x.replace(/^\.+/, '')).filter(Boolean).flatMap(x => [x, x.replace(/\d+$/, '')]);
  const model = t => /\d/.test(t) && ((t.match(/[A-Z]/g) || []).length >= 2 || /[\/.:-]/.test(t));
  if (sig.some(t => pieces(t).some(x => TECH.has(x)) || /^\d/.test(t) || model(t))) return 'tech';
  if (sig.every(t => pieces(t).filter((x, i) => i % 2 === 0).every(x => GENERIC.has(x) || PLACES.has(x)))) return 'generic';
  // "should go to him", "my brother", "the fans": lower-case prose, not a name.
  // A single lower-case word stays a candidate: handles are written that way.
  if (sig.length > 1 && sig.every(t => t === t.toLowerCase() && !/\d/.test(t))) return 'generic';
  return 'name';
}

/** Split "X, Y and Z" after "by"/"thanks to" into the people, up to the clause's end. */
function peopleIn(tail) {
  tail = tail.replace(/\s*\(?\s*\ba\.?k\.?a\.?\s+/gi, ', ').replace(/\)/g, ' ');
  const clause = tail.split(/\s+(?:for|from|who|at|on|in|with|via|because|since|-|–|—|@)(?:\s+|$)|[.!?;()@]|\s{2,}/i)[0];
  return clause.split(/\s*(?:,|&|\+|\/|\band\b)\s*/i)
    .map(p => clean(p).replace(/(?:\s+[\d.\/-]+)+$/, '')).filter(Boolean);
}

// ---------------------------------------------------------------- lineage

const ARROW = /(\s*(?:-+>+|=+>+|>+|→)\s*)/;
const JUNK = /^[\s\\\-=_*~.|]*$|^(?:see (?:below|above)|n\/a)$/i;

/** Redacts one lineage string. Returns { text, changes: [{ removed, why }] }. */
export function redactLineage(text, overrides = {}) {
  if (!text) return { text, changes: [] };
  const changes = [];
  const segments = [];
  for (const raw of text.split(/\s+\|\s+/)) {
    let seg = raw.trim();
    if (JUNK.test(seg)) { if (seg) changes.push({ removed: seg, why: 'filler' }); continue; }
    seg = stripContacts(seg, changes);
    seg = stripCredits(seg, changes, overrides);
    // Hop by hop: drop a tracker or a person standing alone in the chain.
    const parts = seg.split(ARROW);
    const kept = [];
    for (let i = 0; i < parts.length; i += 2) {
      const hop = parts[i];
      const sep = i > 0 ? parts[i - 1] : '';
      const kind = hop.trim() ? classify(hop, overrides) : 'generic';
      if (kind === 'name') { changes.push({ removed: hop.trim(), why: 'person or site in the chain' }); continue; }
      kept.push(kept.length ? sep : '', hop);
    }
    seg = kept.join('').replace(/^\s*(?:-+>+|=+>+|>+|→)\s*|\s*(?:-+>+|=+>+|>+|→)\s*$/g, '').trim();
    if (!seg || JUNK.test(seg)) continue;
    segments.push(seg);
  }
  return { text: segments.join(' | '), changes };
}

/** Emails, links, @handles and tracker names out; empty brackets tidied away. */
function stripContacts(s, changes) {
  const before = changes.length;
  const take = (rx, why) => {
    s = s.replace(rx, m => { changes.push({ removed: m, why }); return ' '; });
  };
  take(EMAIL, 'email address');
  take(URL, 'link');
  take(DOMAIN, 'website');
  take(HANDLE, 'handle');
  s = s.replace(new RegExp(`(?:\\b(?:over at|at|on|onto|to|from|via|in)\\s+)?(?:the\\s+)?(?:${SITES.source})`, 'gi'), m => { changes.push({ removed: m.trim(), why: 'tracker or site' }); return ' '; });
  if (changes.length === before) return s;
  return s.replace(/\(\s*\)|\[\s*\]|<\s*>/g, ' ')
    .replace(/\s*(-+>+|=+>+|>+|→)(?:\s+(?:-+>+|=+>+|>+|→))+\s*/g, (m, sep) => ` ${sep} `)
    .replace(/\(\s*(?:-+>+|=+>+|>+|→)\s*/g, '(')
    .replace(/(\s+[-–]\s+){2,}/g, ' - ')
    .replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.;:!?])(?=\s|$)/g, '$1').replace(/^[,\s]+|[,\s]+$/g, '').trim();
}

/**
 * "provided by Jo Bloggs", "thanks to fooguy and barfan" → the people
 * removed. Where the credit ends its clause ("…SVHS(1) provided by Jo
 * Bloggs") only the credit goes; where prose carries on after it ("Thanks goes
 * to fooguy for capping this…") the whole sentence goes, so nothing is left
 * half-said.
 */
function stripCredits(s, changes, overrides) {
  for (const base of TECH_LINE.test(s) ? [BY, THANKS, REQUEST, BY_ANY] : [BY, THANKS, REQUEST]) {
    const rx = new RegExp(base.source, 'gi');
    let m;
    while ((m = rx.exec(s))) {
      let start = m.index;
      const tailStart = start + m[0].length;
      const tail = s.slice(tailStart);
      const people = peopleIn(tail).filter(p => classify(p, overrides) === 'name');
      if (!people.length) continue;
      const last = people[people.length - 1];
      let end = tailStart + tail.indexOf(last) + last.length;
      const next = s.slice(end).trimStart()[0];
      const dangling = /(?:\b(?:and|or|as|was|were|been|be|is|are|it|has|have|had|got|get|then|also|originally|here|there|on|at|to|from)|[,&+/])\s*$/i.test(s.slice(0, start));
      const sentence = (next !== undefined && !'.!?,;)'.includes(next)) || dangling;
      if (sentence) {
        // Prose continues: take the sentence. A sentence ends at . ! ? before a capital or the end.
        const b = [...s.matchAll(/[.!?]["')]?\s+(?=["'(]?[A-Z])/g)].filter(x => x.index + x[0].length <= start).pop();
        start = b ? b.index + b[0].length : 0;
        const e = /[.!?]["')]?(?=\s+["'(]?[A-Z]|\s*$)/.exec(s.slice(end));
        end = e ? end + e.index + e[0].length : s.length;
      }
      changes.push({ removed: s.slice(start, end).trim(), why: 'credit to a person', names: people, atStart: !sentence && !s.slice(0, start).replace(/[\W_]/g, '') });
      s = (s.slice(0, start) + s.slice(end)).replace(/\(\s*\)|\[\s*\]/g, '').replace(/[ \t]{2,}/g, ' ');
      rx.lastIndex = start;
    }
  }
  return s.trim();
}

// ---------------------------------------------------------------- notes

const HEADER = /^---- (.+) ----$/;
const SKIP = '\u0000';

/**
 * Redacts a Notes field. Works line by line inside each sidecar section:
 * contact lines and credit lines go entirely; a credit inside a technical line
 * loses only the person; a section left empty (e.g. a tracker's "downloaded
 * from" file) goes with its header. Returns { text, changes: [{ section,
 * before, after, why }] }, `after` null when the line was removed.
 */
export function redactNotes(text, overrides = {}) {
  if (!text) return { text, changes: [] };
  const changes = [];
  const out = [];
  let section = '';
  let sectionStart = 0;
  let sectionHasContent = false;
  const lines = text.split('\n');

  const closeSection = () => {
    if (section && !sectionHasContent) {
      // Nothing left but the header: drop it, and the blank lines after it.
      const header = out[sectionStart];
      out.length = sectionStart;
      for (let k = changes.length - 1; k >= 0; k--) if (changes[k].section === section && changes[k].why === 'site in file name') changes.splice(k, 1);
      changes.push({ section, before: header, after: null, why: 'file held only links or credits' });
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === SKIP) continue;
    const h = HEADER.exec(line);
    if (h) {
      closeSection();
      section = h[1];
      sectionStart = out.length;
      sectionHasContent = false;
      // A file name can carry a site name too ("…SomeTracker.org.txt").
      const name = h[1].replace(new RegExp(`\\b[\\w-]+\\.(?:${TLD})(?=\\.\\w+$)`, 'gi'), '[site]').replace(SITES, '[site]');
      if (name !== h[1]) changes.push({ section, before: line, after: `---- ${name} ----`, why: 'site in file name' });
      out.push(`---- ${name} ----`);
      continue;
    }
    // A credit header and the list of names under it go together.
    if (CREDIT_HEADER.test(line.trim()) && line.trim().split(/\s+/).length <= 9) {
      const block = [];
      let j = i + 1;
      while (j < lines.length && lines[j].trim() && !HEADER.test(lines[j])) {
        const l = lines[j].trim();
        const ok = l.split(/\s+/).length <= 10 && (/\ba\.?k\.?a\b/i.test(l) || classify(l.replace(/^(?:and|&)\s+/i, '').replace(/^.*\bfrom\b.*?\s(\S+\(.*)$/i, '$1'), overrides) === 'name');
        if (!ok) break;
        block.push(j++);
      }
      if (block.length || / by:\s*$/i.test(line)) {
        changes.push({ section, before: line, after: null, why: 'credit list' });
        for (const k of block) { changes.push({ section, before: lines[k], after: null, why: 'credit list', names: [clean(lines[k])] }); lines[k] = SKIP; }
        continue;
      }
    }
    // "foo a.k.a. foobar(a.k.a. Jo)": a short line of aliases is a person.
    const aka = /\ba\.?k\.?a\.?\b/i.test(line) && line.trim().split(/\s+/).length <= 6 && !/^\s*\d/.test(line)
      && classify(line.trim().split(/[\s(]/)[0], overrides) === 'name';
    if (HANDLE_AKA.test(line) || aka) { changes.push({ section, before: line, after: null, why: 'credit list', names: [clean(line)] }); continue; }
    const r = redactLine(line, lines, i, overrides);
    if (r.skip != null) {
      changes.push({ section, before: lines[r.skip], after: null, why: r.why, names: r.names });
      lines[r.skip] = SKIP;
    }
    if (r.after === line) {
      out.push(line);
      if (line.trim()) sectionHasContent = true;
      continue;
    }
    changes.push({ section, before: line, after: r.after, why: r.why, names: r.names });
    if (r.after !== null) { out.push(r.after); if (r.after.trim()) sectionHasContent = true; }
  }
  closeSection();
  const result = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { text: result, changes };
}

/** One line of a sidecar. Returns { after, why, names, skipNext }. */
function redactLine(line, lines, i, overrides) {
  if (!line.trim()) return { after: line };
  const next = () => { for (let j = i + 1; j < Math.min(lines.length, i + 3); j++) if (lines[j].trim()) return j; return -1; };

  // Contact lines (email, messenger, "add me") go whole.
  EMAIL.lastIndex = 0;
  if (EMAIL.test(line) || IM.test(line) || OBFUSCATED.test(line)) { EMAIL.lastIndex = 0; return { after: null, why: 'contact details' }; }
  EMAIL.lastIndex = 0;

  // "Taper: Jo …", "TRANSFERRED BY:" with the name on the next line.
  const label = LABEL.exec(line);
  const chain = t => /(?:-+>+|=+>+|>+|→)/.test(t);
  if (label && !chain(line)) {
    const rest = line.slice(label[0].length);
    if (rest.trim()) {
      const ppl = peopleIn(rest);
      if (ppl.some(p => classify(p, overrides) === 'name')) return { after: null, why: 'credit to a person', names: ppl };
    } else {
      const j = next();
      if (j !== -1 && !chain(lines[j]) && classify(lines[j], overrides) === 'name') return { after: null, why: 'credit to a person', names: [clean(lines[j])], skip: j };
    }
  }

  // A sign-off ("Enjoy & share") followed by a lone name: the name goes.
  if (SIGNOFF.test(line)) {
    const j = next();
    // Only near the end of a file, where signatures live; a song after
    // "Enjoy!" mid-file must not read as a name.
    let after = 0;
    for (let k = j + 1; k < lines.length && !HEADER.test(lines[k]); k++) if (lines[k].trim()) after++;
    if (j === i + 1 && after <= 2 && lines[j].length <= 40 && classify(lines[j], overrides) === 'name') {
      return { after: line, why: 'signature', names: [clean(lines[j])], skip: j };
    }
  }

  // "Lineage: …" inside an NFO gets the lineage rules.
  const lin = /^(\s*lineage\s*:\s*)(.*)$/i.exec(line);
  if (lin) {
    const r = redactLineage(lin[2], overrides);
    if (r.changes.length) return { after: r.text ? lin[1] + r.text : null, why: 'lineage: ' + [...new Set(r.changes.map(c => c.why))].join(', ') };
    return { after: line };
  }

  // Everything else: links and credits out; drop the line if nothing of
  // substance is left ("Torrent downloaded from", "Visit … for trading").
  const changes = [];
  let s = line;
  // In prose, a sentence about a tracker or a link is about the upload, not
  // the recording: it goes whole rather than leaving "posted here on."
  const isChain = /(?:-+>+|=+>+|>+|→)/.test(s) || (s.match(/\s\/\s/g) || []).length >= 2;
  if (!isChain && s.trim().split(/\s+/).length >= 12) {
    const parts = s.split(/(?<=[.!?]["')]?)\s+(?=["'(]?[A-Z])/);
    const has = (rx, p) => { rx.lastIndex = 0; const h = rx.test(p); rx.lastIndex = 0; return h; };
    const CTA = /\b(?:visit|check out|trading (?:page|list)|can be found|my (?:site|page|blog|list|website)|forums?|join|register|sign up|contact|download(?:ed)? (?:it )?(?:from|at)|available (?:at|from)|more info)\b/i;
    const kept = parts.filter(p => {
      const hit = has(SITES, p) || has(EMAIL, p) || ((has(URL, p) || has(DOMAIN, p)) && CTA.test(p));
      if (hit) changes.push({ removed: p, why: 'sentence about a tracker or site' });
      return !hit;
    });
    if (kept.length < parts.length) s = kept.join(' ');
  }
  s = stripContacts(s, changes);
  s = stripCredits(s, changes, overrides);
  if (!changes.length) return { after: line };
  const why = [...new Set(changes.map(c => c.why))].join(', ');
  const names = changes.flatMap(c => c.names || []);
  const left = tokens(s.replace(/[-=]+>+|<+[-=]+/g, ' ')).filter(t => !/^(visit|check|out|see|go|to|at|from|on|for|the|torrent|downloaded|download|available|here|more|info|trading|trade|my|site|website|page|homepage|blog|forum|link|links|pc|mac|url|web|posted|uploaded|upped|seeded|by|and|also|please|or|via|supported|etc|tracker|production|productions|presents|a|an|notes|transfer|info)$/i.test(t));
  const linkOnly = /:\s*$/.test(s) && left.length <= 5 && changes.some(c => c.why === 'link' || c.why === 'website');
  if (left.length < 2 || linkOnly || changes.some(c => c.atStart)) return { after: null, why, names };
  const indent = line.match(/^\s*/)[0];
  const tidy = s.replace(/\s*(?:-+>+|=+>+|>+|→|\/)\s*$/, '').replace(/\s+([,.;:!?])/g, '$1').replace(/(^|\s)[.!?,;:]+(?=\s|$)/g, '$1').replace(/[ \t]{2,}/g, ' ').trimEnd();
  return { after: indent + tidy.trimStart(), why, names };
}

// ---------------------------------------------------------------- per show

const escapeRx = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Both fields of one show, then a second pass: a name the rules found in this
 * show's credits ("Transferred by: Jo Bloggs") is removed wherever else it
 * appears in this show ("Notes by Jo Bloggs:", a file name "(fooguy).txt").
 * Only within the show, so a handle that is also an ordinary word or a song
 * title elsewhere is never touched there. `overrides.everywhere` (distinctive
 * handles, from the owner's private list) go in every show.
 */
export function redactShow(show, overrides = {}) {
  const lineage = redactLineage(show.Lineage || '', overrides);
  const notes = redactNotes(show.Notes || '', overrides);
  const found = new Set([...(overrides.everywhere || []), ...((overrides.perShow || {})[show.ShowID] || []), ...namesOf({ lineage, notes })]);
  const names = [...found]
    .filter(n => n.length >= 3 && !overrides.keep?.includes(n) && (classify(n, overrides) === 'name' || (overrides.perShow?.[show.ShowID] || []).includes(n)) && !/^(?:by|to|from)\b/i.test(n))
    .sort((a, b) => b.length - a.length);
  // Distinctive handles match in any case ("Fooguy" for a credited
  // "fooguy"); an ordinary word only exactly, so the same word in prose survives.
  const anyCase = new Set((overrides.everywhere || []).map(n => n.toLowerCase()));
  if (names.length) {
    lineage.text = scrubNames(lineage.text, names, lineage.changes, ' | ', anyCase);
    notes.text = scrubNames(notes.text, names, notes.changes, '\n', anyCase);
  }
  return { lineage, notes };
}

function scrubNames(text, names, changes, joiner, anyCase = new Set()) {
  if (!text) return text;
  // One pattern: exact for ordinary names, (?i) emulated per name for handles.
  const alt = names.map(n => anyCase.has(n.toLowerCase())
    ? [...n].map(ch => /\p{L}/u.test(ch) && ch.toLowerCase() !== ch.toUpperCase() ? `[${escapeRx(ch.toLowerCase())}${escapeRx(ch.toUpperCase())}]` : escapeRx(ch)).join('')
    : escapeRx(n));
  const rx = new RegExp(`(?<![\\p{L}\\p{N}_@])(?:${alt.join('|')})(?:'s)?(?![\\p{L}\\p{N}_@])`, 'gu');
  let section = '';
  const out = [];
  for (const line of text.split(joiner)) {
    const h = HEADER.exec(line);
    if (h) section = h[1];
    rx.lastIndex = 0;
    if (!rx.test(line)) { out.push(line); continue; }
    rx.lastIndex = 0;
    let after;
    if (h) {
      after = `---- ${h[1].replace(rx, '').replace(/\(\s*\)|\[\s*\]/g, '').replace(/\s+(\.\w+)$/, '$1').replace(/\s{2,}/g, ' ').trim()} ----`;
    } else if (line.trim().split(/\s+/).length >= 12) {
      // Prose: the sentences that mention the person go.
      // ("Mr. Foo" is one name, not the end of a sentence.)
      after = line.split(/(?<=[.!?]["')]?)(?<!\b(?:Mr|Mrs|Ms|Dr|St)\.)\s+(?=["'(]?[A-Z])/).filter(p => { rx.lastIndex = 0; return !rx.test(p); }).join(' ');
    } else {
      after = line.replace(rx, ' ')
        .replace(/\(\s*\)|\[\s*\]/g, '')
        .replace(/\s*(?:~|-|&|\bby|\band)\s*$/i, '')
        .replace(/^\s*(?:~|-|&|by\b)\s*/i, '')
        .replace(/[ \t]{2,}/g, ' ').trimEnd();
      const left = tokens(after).filter(t => !/^(?:a|an|the|notes|transfer|production|productions|presents|by|and|&|~|-|'s)$/i.test(t));
      if (left.length < 1 || (/:\s*$/.test(after) && left.length <= 3) || /\bby\s*:?\s*$/i.test(after)) after = '';
    }
    changes.push({ section, before: line, after: after || null, why: 'name repeated elsewhere in this show' });
    if (after) out.push(after);
  }
  return out.join(joiner).replace(/\n{3,}/g, '\n\n').trim();
}

/** Names a show's own credits yield (after the per-show pass's clean-up). */
export function namesOf(result) {
  const out = new Set();
  for (const c of [...result.lineage.changes, ...result.notes.changes]) {
    if (c.why === 'person or site in the chain' && c.removed) out.add(clean(c.removed));
    for (const n of c.names || []) out.add(clean(n));
  }
  return [...new Set([...out].flatMap(n => n.split(/\s*,\s*|\s*\(?\s*\b(?:aka|a\.k\.a\.?)\s+|[()]/i)))]
    .map(n => clean(n.replace(/^.*\bby:?\s+/i, '').replace(/\s+(?:himself|herself)$/i, '').replace(/\s+a$/, '').replace(/^a\.?k\.?a\.?\s+/i, '')))
    .filter(n => n.length >= 3 && !/https?:|www\.|\//i.test(n) && !/^(?:provided|by|thanks)\b/i.test(n) && classify(n) === 'name');
}

/** The patterns, for the apply tool and the health check's guard. */
export const PATTERNS = { EMAIL, URL, DOMAIN, SITES, HANDLE, IM, OBFUSCATED };

/** A name as the guard hashes it: lower case, words joined by single spaces. */
export const nameKey = n => (n.toLowerCase().match(/[\p{L}\p{N}_]+/gu) || []).join(' ');

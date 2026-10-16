# Persona — The Archive Trader

> **Status: proto-persona, 2026-10-16.** Built from knowledge of the live-video trading scene, the
> site's own data (1,213 visible recordings, 303 artists) and a scripted walkthrough of the live
> site. No real traders have been interviewed yet. Treat every claim here as a hypothesis;
> [04-test-plan.md](04-test-plan.md) is how to confirm or kill each one.

---

## At a glance

| | |
|---|---|
| **Representative** | "Rob", 52. Has traded live video since the VHS days and now holds 1,000–10,000 titles on hard drives and DVD-R spindles |
| **Age** | 40–60 (median about 50) |
| **Gender** | Mostly men; women are a small but active minority |
| **Where** | Western Europe (Germany, Netherlands, UK, France, Spain, Italy, Scandinavia), USA and Canada, Brazil, Argentina and Chile, Japan, Australia and NZ |
| **Language** | Works in English, which is often a second language. Uses the local names of places and channels (Köln, Brasil, Rockpalast, Multishow) |
| **Work** | IT, engineering, teaching, trades, broadcast and media, small business. Many are technical by profession or by hobby |
| **Era focus** | Mostly 1990–2010, the age of satellite, DVB and VHS-to-DVD. Some reach back to the 1960s–80s |
| **Collection** | Kept in a spreadsheet or plain-text trading list. Often 2–3 copies of the same show, kept until an "upgrade" replaces them |
| **Time on task** | Evenings and weekends, in bursts. Serious sessions happen at a desk with a big monitor, a spreadsheet and many tabs open; the phone is for quick checks and messaging |
| **Trading channels** | Private trackers (Dime A Dozen, Traders Den), band forums, Facebook groups, WhatsApp, Telegram and Discord groups, email, setlist.fm, Discogs |

---

## Who they are

Rob started taping MTV Europe and late-night TV onto VHS in the early 1990s. He swapped tapes by
post using "blank and postage" (B&P), moved to DVD-R around 2002, and now trades files over private
trackers and cloud links. He knows his collection better than any database does: which Pinkpop 2000
copy has the WDR logo, which is the NTSC conversion, which one cuts the encore.

He is not browsing for entertainment. He arrives with a **specific question about a specific
show**: "Do you have it? Is yours better than mine? How do I get it?" He leaves quickly if the
page can't answer it. Nice design earns a moment of goodwill, but it can't stand in for missing
specs.

He is sceptical by default. Too many trading lists have promised "PRO-SHOT, EXCELLENT QUALITY"
and delivered a third-generation VHS dub with a burned-in timer. He trusts evidence: the info file
(NFO), MediaInfo output, checksums and screenshots.

---

## How a trader thinks about shows

**A show is not a recording.** A *show* is identified by artist, date and venue or event. A
*recording* is one copy of that show, defined by:

- **source**: pro-shot broadcast, audience camera (AUD), soundboard (SBD), webcast or official release
- **broadcaster**: WDR Rockpalast, BBC Three, MTV Europe, Channel V, Multishow, WOWOW…
- **original or rebroadcast**, and its date
- **lineage**: the chain from source to file (`DVB-S > TS > ProjectX > DVD`)
- **generation**: master, 1st gen, 3rd gen VHS…
- **format**: DVD5, DVD9, Blu-ray, TS, MKV; resolution; PAL or NTSC; bitrate
- **runtime and completeness**: whole set? Cuts? Encore? Interviews spliced in?

One show can exist as many recordings. **The hunt is for the best one: the "upgrade".**

### What makes one recording "better" (typical order)

1. **Source.** Original broadcast beats rebroadcast; pro-shot beats audience; native HD beats an upscale.
2. **Completeness.** Full set, no cuts, encore included.
3. **Generation.** Master or 1st gen beats a multi-generation VHS dub.
4. **Resolution and standard.** 1080 > 720 > 576 > 480 > 288. A European broadcast should be native
   PAL; a PAL↔NTSC conversion is a red flag.
5. **Compression.** An untouched DVB stream beats a re-encode; "DVD Shrink" in the lineage lowers the value.
6. **Audio.** Full-bitrate PCM or AC-3 2.0; 5.1 only if the broadcast had it. MP2 or downsampled audio counts against it.
7. **Flaws.** Channel logos ("bugs"), tickers, commercials, dropouts, tracking lines, timers.
8. **Authoring.** Menus and chapters are a bonus.

Every rung of that ladder is a field. **Without the fields a trader can't rank recordings, and
ranking recordings is the whole job.**

---

## Jobs to be done

| # | When… | I want to… | So I can… |
|---|---|---|---|
| J1 | someone posts a list or I hear of a show | check fast whether this collection has a specific show | decide whether it's worth a conversation |
| J2 | the collection has a show I already own | compare its recording(s) with mine on source, length, resolution, generation and completeness | know whether it's an upgrade |
| J3 | I'm completing an artist | see every recording of that artist in a dense, dated list and reconcile it against my spreadsheet | spot what I'm missing |
| J4 | I'm chasing a rare song or performance | find every recording where that song was played | get the version I want |
| J5 | I collect a festival, TV programme or era | browse by event, year and country | fill gaps in a series (Rockpalast, Pinkpop, Big Day Out…) |
| J6 | I've found something I want | send the owner a request or trade offer, or send a link to a trading friend | actually get the recording |
| J7 | I come back weeks later | see what's new or upgraded since my last visit | not re-read the whole collection |
| J8 | I'm about to trade | judge picture quality and authenticity from stills, the NFO and the lineage | avoid wasting a slot or a download on an inferior copy |

---

## Technical needs: the metadata they decide on

Priority: **Must** = a trader can't decide without it · **Should** = expected by serious traders ·
**Could** = nice to have. "Today" is what the live site shows as of 2026-10-16.

| Field | Why it matters to a trader | Priority | Today |
|---|---|---|---|
| Artist, with common abbreviations | Search starts here (RATM, FNM, STP, QOTSA) | Must | Shown; abbreviations work for some artists only |
| **Exact date**, with its precision marked | The primary key of a show | Must | Shown, but 257 placeholder dates (`2001-01-01`) look exact; **a date can't be searched** |
| Venue, city, country | Separates two shows in one year; confirms identity | Must | **Venue hidden in 699 drawers, city in 843** (whenever an event name is set) |
| Event or TV programme | Series collecting (Rockpalast, Letterman) | Must | Shown |
| **Broadcaster or channel** | "Which broadcast is it?" is the first question asked | Must | No field; sometimes buried in Notes or visible as a logo in stills |
| **Source type** (Pro-shot / AUD / SBD / webcast / official) | The first rung of "better" | Must | Blank on 27% of records; removed from cards |
| Original vs rebroadcast | Rebroadcasts are often cut or re-edited | Should | No field |
| Runtime of the show itself | Completeness signal | Must | Shown |
| Completeness (complete / incomplete / cuts) | Second rung of "better" | Must | Only an "(incomplete)" suffix inside the setlist |
| Setlist, encore marked (ideally timings) | Confirms identity and completeness | Must | 62% of records |
| **Resolution and HD/SD** | Fourth rung of "better" | Must | **Not shown**, though the data covers 100% of records |
| PAL/NTSC, frame rate, interlaced or progressive | Spots conversions | Must | PAL/NTSC only; on HD records the label is misleading |
| Display aspect, letterboxing | Squashed or cropped copies | Should | Shown, with the internal word "(native)" |
| Video codec and **bitrate** | Spots re-encodes | Should | Codec only, as an ffprobe name (`mpeg2video`); no bitrate |
| Audio codec, channels, **bitrate** | Audio quality | Should | Codec, channels and sample rate; no bitrate |
| Container and authoring (DVD-Video with menus and chapters, TS, MKV) | What will arrive | Should | Container only (`.vob`) |
| Media size: DVD5 / DVD9 / BD25, total GB | Slot and bandwidth planning | Should | Total GB, measured on the folder (can include other content) |
| **Generation** | Third rung of "better" | Should | Data on 7% of records; hidden |
| **Lineage** | Serious traders read it first | Must (serious) | Data on 20% of records; hidden |
| Taper, transferer, credits | Etiquette; trust | Could | Sometimes inside Notes |
| Checksums (md5, ffp, SHA1) | Match against tracker torrents; verify transfers | Should | SHA1 on every record; hidden |
| Logos, tickers, commercials, glitches | Seventh rung of "better" | Should | Only visible in the stills |
| Info file (NFO) verbatim | The most trusted document | Must | Shown (31% of records) |
| **Other recordings of the same show** | J2 depends on it | Must | 118 shows have 2+ recordings; **none are linked to each other** |
| Date added or upgraded | J7 | Should | No field |
| Availability: tradeable? on request? | J6 | Must, if trading is the goal | No field, no contact route |

---

## Visual needs

- **Stills are evidence, not decoration.** Several moments from the show; the uncropped frame
  (logos and letterbox bars visible); the correct aspect; viewable at native size, 1:1, to judge
  sharpness and compression. The site's stills are good evidence. The viewer just doesn't let
  people look closely enough.
- **Density on demand.** Traders work from spreadsheets. They want a table view they can scan
  against their own list: one line per recording, sortable, with date, venue, source, length,
  resolution and standard.
- **Scannable cues on every list item:** full date, HD/SD, PAL/NTSC, Pro/AUD, "3 versions".
  Without these, every card has to be opened.
- **Legible for eyes aged 40–60.** Presbyopia is near-universal by 50. Body text 16px or more;
  labels 12px or more; text contrast at least 4.5:1; layouts that hold at 125–150% browser zoom.
  A dark theme is fine (media people like it), but small grey text on near-black is the
  combination that fails them.
- **Their vocabulary and units:** MPEG-2, AC-3 / Dolby Digital, LPCM, H.264, 1080i, 576i, 25 fps,
  Pro-shot, AUD, SBD, DVD9. Not ffprobe internals (`mpeg2video`, `pcm_dvd`).
- **Calm.** Fast, no autoplay, no motion that gets in the way of reading specs.

---

## Behaviours and tools

- **Lives in:** MediaInfo, VLC or MPC-HC, ImgBurn, DVD Decrypter, PgcEdit, ProjectX, VideoReDo,
  Excel or Google Sheets, private trackers, setlist.fm, Discogs, band forums, chat groups.
- **Searches date-first** (`1996-05-24`, `24.05.96`, `RATM RaR 96`) and with abbreviations.
- **Ctrl+F** on long pages, and copy-pastes lists in and out.
- **Opens many tabs** and compares side by side.
- **Shares links** in forum threads and chats, and expects a link to open exactly what they saw.
- **Uses the browser Back button** (or the Android back gesture) to close things.
- **Screenshots** pages as proof in trade negotiations.

---

## Trader vocabulary

| Term | Meaning |
|---|---|
| Pro-shot / PRO | Professionally filmed: TV broadcast, webcast or official release |
| AUD | Audience recording, filmed from the crowd |
| SBD | Soundboard: audio taken from the mixing desk (sometimes married to video) |
| Matrix | Audience and soundboard audio mixed together |
| Lineage | The chain of devices and software from source to file |
| Gen / generation | Copies between the source and this file (master = 0) |
| Upgrade | A better recording of a show you already have |
| B&P / 1:1 | Blank and postage (sending blank discs for a copy) / a one-for-one trade |
| NFO / info file | Text file describing source, lineage, setlist and specs |
| md5 / ffp | Checksums that verify files are unaltered |
| Bug / logo | A channel watermark burned into the picture |
| DVD5 / DVD9 | Single-layer 4.7 GB / dual-layer 8.5 GB DVD |
| Rebroadcast | A later re-airing, often edited or re-encoded |
| PAL / NTSC | SD TV standards. PAL: 576 lines at 25 fps (Europe, Australia). NTSC: 480 lines at 29.97 fps (North America, Japan). Brazil's PAL-M has NTSC's line count, so Brazilian captures often arrive as NTSC |

---

## Frustrations they bring with them

- Trading lists that say "Pearl Jam – Pinkpop 2000 – 60 min" and nothing else, which means
  endless emails to learn the source.
- Paying postage or downloading 8 GB only to find a third-generation NTSC conversion.
- Lists that are PDFs or images, can't be searched, or have dead links.
- Sites that look beautiful but hide the specs.
- Collectors who never answer, and collections with no visible way to ask.

## Illustrative quotes

> "Don't show me a pretty picture, show me the lineage." · "Which Pinkpop 2000 is it — the
> Nederland 3 broadcast or the WDR one?" · "If I can't link to it, it doesn't exist."
> · "I don't need it to be pretty, I need to know if it's 576 or 1080."

*(Synthetic. Replace with verbatim quotes after the sessions.)*

---

## What success looks like

**"Within 30 seconds I know whether he has it, whether it's better than mine, and how to ask
for it."**

## Design principles that follow from this persona

1. **Specs are content, not footnotes.** The fields that rank recordings belong where the
   decision is made: on the card and at the top of the show.
2. **Every recording has a permanent address.** A link reopens exactly that recording; Back
   closes it.
3. **Group versions under the show.** One show, many recordings, compared side by side.
4. **Speak trader:** Pro-shot, AUD, 1080i, PAL, DVD9, LPCM.
5. **Dense when asked:** a table view and an export next to the gallery.
6. **Readable at 55:** contrast and size that survive reading glasses.
7. **Show the next step:** how to ask for a recording, and on what terms.

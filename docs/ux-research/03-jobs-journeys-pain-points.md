# Core journeys, pain points and needs

> 2026-10-16. Derived from [the persona](01-persona-archive-trader.md) and checked against the
> live site in a scripted walkthrough ([04-test-plan.md §9](04-test-plan.md#9-pilot-run--scripted-walkthrough-2026-10-16)).
> **Observed** = it happened in the walkthrough. **Anticipated** = expected from the persona,
> still to be confirmed with real people.

## The seven core journeys

Every visit is some mix of these. J1 and J2 are the reason traders come at all; the rest support
them.

| # | Journey | Trigger | Done when… | Participants |
|---|---|---|---|---|
| J1 | **Do you have it?** Known-item check | A show is mentioned in a forum or chat, or is on the trader's want list | They know yes/no and which recording(s) | All; P1, P3 lead |
| J2 | **Is yours better than mine?** Version compare | J1 found a show they already own | They can rank this recording against theirs | P1, P4, P5 lead |
| J3 | **What do you have that I don't?** Artist audit | Completing an artist | Every recording reconciled against their spreadsheet | P2, P5 lead |
| J4 | **Where was this song played?** Song hunt | Chasing a song or a rare performance | A list of every recording with that song | P8 leads |
| J5 | **Show me the series.** Event, broadcast or year dig | Collecting a festival or TV programme | Every recording of the series, in order | P3, P7 lead |
| J6 | **Can I get it?** Share and request | Found something wanted | A link sent to a friend, or a request sent to the owner | P6 leads; all need it |
| J7 | **What's new?** Return visit | Weeks later, or the owner mentions an upgrade | New and upgraded recordings seen without re-reading everything | P5, P2 |

J8, the **evidence check** (stills, NFO, lineage), isn't a separate journey: it's the last step
of J1 and J2, before a trader commits a trade slot or a download.

---

## J1 — "Do you have it?"

**Ideal path:** type what they know (`RATM Rock am Ring 96`, `1996-05-24`) → one result, or a
short list → open it → identity confirmed (date, venue, broadcaster, length).

| Stage | Trader does / thinks | Site today | Pain point | Need |
|---|---|---|---|---|
| Search | Types an abbreviation or a date | RHCP, STP, QOTSA work; **RATM, FNM, 30STM, KOL fail**; RATM suggests *Rammstein* (observed) | Concludes "he hasn't got it" | Abbreviation aliases; never suggest a wrong artist over an alias |
| Search | Types a date | **0 results in every format**, even the ISO form the drawer displays (observed) | The trader's primary key doesn't work | Index dates in ISO, `DD.MM.YYYY`, `DD/MM/YY`, "June 1997", `'97` |
| Search | Types a place in their own language | `nurburgring` works (accents ignored); **`Brasil`, `UK`, `USA`, `Deutschland`, `Köln` fail** (observed) | False negatives | Country and city synonyms |
| Scan results | Looks for the right card | Card shows title, event or venue, and **year only** | Can't tell 2 shows in one year apart | Full date on the card |
| Confirm | Opens the show, checks identity | Date, event, country; **venue and city hidden whenever an event is set** (699 and 843 records) | "Which stage, which city?" | Venue and city always shown |
| Confirm | Checks the date | `2001-01-01` shown for a year-only record (observed) | Distrust: "that date is wrong" | Mark precision: "2001 (exact date unknown)" |

**Anticipated feeling:** quick and pleasant when the full artist name is typed; distrust the
moment a date or an abbreviation fails.

---

## J2 — "Is yours better than mine?"

**Ideal path:** from the show, see every recording of it together → compare source, broadcaster,
length, resolution, standard, generation and lineage side by side → pick one.

| Stage | Trader does / thinks | Site today | Pain point | Need |
|---|---|---|---|---|
| Find the versions | "Are there other copies?" | Versions are separate cards with **identical captions**: 375 cards in 155 look-alike groups (observed: four "Rock am Ring · Nürburgring · 2010" cards) | Has to open each one | Group recordings under the show; "3 recordings" cue |
| Compare | Opens copy 1, notes specs, closes, opens copy 2… | Works with ×; **Escape wipes the search and the cards vanish** (observed bug) | Loses place; starts again | Fix Escape; compare view |
| Compare specs | "Which one is HD?" | **Resolution never shown.** HD copies are labelled only PAL or NTSC (124 HD records, 85 labelled "NTSC") (observed) | **The decisive question can't be answered** | Resolution and HD/SD on card and drawer |
| Compare source | "Pro-shot? Original broadcast? Which channel?" | Source blank on 27%; only 1 of the 4 Rock am Ring copies says "Proshot"; no broadcaster field | Can't rank on the first rung | Source on every record; broadcaster field |
| Compare lineage | "What's the chain? What gen?" | Lineage (20% of records) and generation (7%) exist but are never shown | Serious traders stop here | Show lineage and generation |
| Compare size | "8 GB for 24 minutes?" | Size and file count cover the **whole folder** (Aerosmith 2002: 4 min, 2.70 GB, 16 files) | Misleading bitrate guess | Label it "Disc/folder size" or show the show's own size |
| Evidence | Opens stills to look for logos and sharpness | Real frames with logos (good); **viewer capped at the drawer's width**, no 1:1 | Can't judge the encode | Native-size view |

**Anticipated feeling:** frustration. This is the trader's core job and the site gets them only
halfway.

---

## J3 — "What do you have that I don't?"

**Ideal path:** pick the artist → a dense, dated list → compare against the spreadsheet → export.

| Stage | Trader does / thinks | Site today | Pain point | Need |
|---|---|---|---|---|
| Open the artist | A–Z list or search | Works; the A–Z list is clear | Show counts nearly invisible (1.7:1 contrast) | Readable counts |
| Scan the run | Reads 21 Pearl Jam cards | Big image cards, 4–6 per row; year only | Slow; must open many cards | Table view: Date · Event · Venue · City · Source · Length · Res · Std |
| Sort | Wants date order, or by length | Newest, oldest, artist A–Z | No sort by length, size or quality | More sorts |
| Reconcile | Has the spreadsheet open | Nothing to copy or download | Re-types by hand | CSV / TXT export of the current list |
| Print | Cmd+P for later | Prints the gallery | Unusable on paper | Print stylesheet of the table view |

---

## J4 — "Where was this song played?"

**Ideal path:** type the song → every recording with it → open one → the song highlighted at its
place in the set.

| Stage | Site today | Pain point | Need |
|---|---|---|---|
| Search | **Works well**: "creep" finds 37 recordings across STP, Radiohead and a Korn cover, grouped as Songs, with the song named on each card (observed) | — | Keep it |
| Narrow | `song:creep` works; `songs:creep`, two prefixes together and quoted phrases return 0 | Syntax undocumented and fragile | A search-tips line; support combined prefixes and quotes |
| Open | The song isn't marked in the setlist | Has to read the list to find it | Highlight the matched song |
| Detail | No song timings | Can't jump to it or judge completeness | Timings where known (later) |

---

## J5 — "Show me the series"

| Stage | Site today | Pain point | Need |
|---|---|---|---|
| Pick the event | Event filter with counts and a type-to-filter box (works on phone and desktop) | Lists only events with 6+ recordings; smaller series (Fuji Rock, Hurricane) are search-only | Show all events, small ones in a "more" group |
| Narrow by year | Year range with histogram, decade chips, typed From/To | Good | — |
| Change the question | Types a new search with the filter still on | **"No shows found… Check the spelling"** although the filter is the cause (observed: Neil Young + Pinkpop) | Name the active filters; offer "Search all shows" |
| Filter by trader dimensions | Not possible | No source (Pro/AUD), HD/SD, PAL/NTSC, length or "has setlist" filters | Add the filters traders decide by |

---

## J6 — "Can I get it?"

| Stage | Site today | Pain point | Need |
|---|---|---|---|
| Copy a link | The URL holds the search, never the show (observed) | The friend gets a list, not the recording | `?show=<ShowID>` deep link |
| Share in chat | No page description or preview image | Blank link previews in WhatsApp and forums | Open Graph tags; per-show previews |
| Go back | Browser Back or the Android gesture **leaves the site** while a show is open (observed) | Lost session | Back closes the show |
| Ask the owner | Handled off-site: traders arrive from Karl's direct email and reply to it (owner, 2026-10-16) | Must still name the exact recording in the reply | A Share / Copy link button with a one-line reference |

---

## J7 — "What's new?"

| Stage | Site today | Pain point | Need |
|---|---|---|---|
| Arrive | Featured rows (12 shuffled picks) and the A–Z list | Nothing says what changed | "Recently added / upgraded" row |
| Check upgrades | No "added" or "updated" dates | Must remember the whole collection | `AddedOn` / `UpdatedOn` fields; a sort by them; optionally RSS |

---

## Pain points across all journeys, ranked

| Rank | Pain point | Journeys | Observed? |
|---|---|---|---|
| 1 | Can't tell which recording is better: resolution, source, lineage and generation missing; versions not grouped | J2, J3, J8 | Yes |
| 2 | Nothing can be linked; Back leaves the site | J6, all | Yes |
| 3 | No way to point at one exact recording when replying (contact itself is by email) | J6 | Yes |
| 4 | Search misses dates, abbreviations, local names and tech terms | J1, J5 | Yes |
| 5 | Escape erases the results during a comparison | J2, J3 | Yes (bug) |
| 6 | Placeholder dates look like real dates | J1 | Yes |
| 7 | Empty results blame spelling when a filter is the cause | J5 | Yes |
| 8 | No dense list or export to reconcile against a spreadsheet | J3 | Yes |
| 9 | Small, low-contrast text for eyes aged 40–60 | All | Yes (measured) |
| 10 | No "what's new" | J7 | Yes |
| 11 | Stills can't be inspected at native size | J8 | Yes |
| 12 | Setlists mix in non-songs; no song highlight or timings | J4 | Yes |

## Needs, by kind

**Informational:** exact date with its precision; venue, city and broadcaster; source;
resolution and HD/SD; standard and frame rate; bitrate; generation; lineage; completeness;
checksums; size of the show itself; date added; availability.

**Functional:** permanent link per recording; Back closes overlays; grouped versions and a compare
view; table view, CSV export and print; trader-aware search (dates, aliases, synonyms, tech
terms); filters for source, quality and standard; a Share / Copy link action per show; a what's-new feed.

**Emotional:** confidence that the information is complete and honest (no fake precision); being
treated as an expert (their vocabulary, full specs); respect for their time (an answer in
seconds, no opening 21 drawers).

**Accessibility:** 4.5:1 text contrast; 12px minimum for labels and 16px for body; works at
150% zoom; nothing that depends on hover; keyboard-complete (it largely is today).

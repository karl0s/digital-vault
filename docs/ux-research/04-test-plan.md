# Usability test plan — The Vault with archive traders

> 2026-10-16. Site under test: https://karl0s.github.io/digital-vault/ (live build of `5ab10603`).
> Personas and journeys: [01](01-persona-archive-trader.md), [02](02-participants.md),
> [03](03-jobs-journeys-pain-points.md). Findings: [05-findings-report.md](05-findings-report.md).

## 1. Purpose

Find out whether experienced video traders can do their core jobs on the site (find a show,
judge whether a recording beats their own, and get it) and what stops them.

### Research questions

| # | Question | Journeys |
|---|---|---|
| RQ1 | Can a trader confirm, in under a minute, whether a specific show is in the collection? | J1 |
| RQ2 | Can they rank two or more recordings of one show, and which fields do they reach for? | J2, J8 |
| RQ3 | Can they reconcile an artist's recordings against their own list? What format do they want it in? | J3 |
| RQ4 | Does search match how they type: dates, abbreviations, local place names, tech terms? | J1, J4, J5 |
| RQ5 | Can they share one exact recording and ask the owner for it? | J6 |
| RQ6 | Do the stills and the NFO give enough evidence to judge quality? | J8 |
| RQ7 | Is the text legible for 40–60-year-old eyes on their own setup? | All |
| RQ8 | Which persona assumptions hold: the "better" ladder, the must-have fields, trading as the goal? | All |

## 2. Method

- **Moderated remote sessions**, 60 minutes, one participant at a time, think-aloud, on the
  participant's **own device and browser** (that's where the zoom levels, glasses and habits
  are).
- **Bring your own shows.** Before the session each participant sends 5 shows they own that
  overlap with the collection (the moderator checks the overlap). Real stakes produce real
  behaviour; invented scenarios don't.
- **Fixed tasks** as well, so results compare across participants (§6).
- **Pilot first:** the scripted walkthrough in §9 (done 2026-10-16), then one real pilot
  participant to tune timings and wording.

## 3. Participants and recruitment

**Eight participants**, matching the profiles in [02-participants.md](02-participants.md). Five
moderated sessions typically surface most of the usability issues on a given surface; eight lets
the panel cover regions, devices and eyesight as well.

### Screener (all must be true)

- Has traded live concert **video** for 5+ years and holds 500+ titles.
- Judges recordings by source, generation, resolution or similar (ask them to name 3 things that
  make one copy better than another; reject vague answers).
- Aged 40–60 (allow one or two outside the range if the profile is strong).
- Willing to share their screen and talk aloud for 60 minutes.

### Quotas

| Quota | Target |
|---|---|
| Regions | ≥2 Europe, ≥2 North America, ≥1 South America, ≥1 Asia, ≥1 Australia/NZ |
| Device | ≥2 phone-first, ≥1 tablet, the rest desktop or laptop |
| Eyesight | ≥2 who wear reading glasses or use browser zoom |
| Tech confidence | ≥2 moderate (follows a routine, rarely explores) |
| Language | ≥3 with English as a second language |
| Gender | Recruit at least one woman |

**Where to recruit:** band trading forums, the Dime A Dozen and Traders Den forums (ask the
moderators first), Facebook trading groups, the setlist.fm community, Discogs forums. Offer a
voucher of about €40 or equivalent. The incentive must not depend on what they say.

**Ethics:** written consent to record screen and voice; recordings kept privately and deleted
after analysis; no participant's collection or contact details go into any repo (this one is
public).

## 4. Logistics

| Item | Plan |
|---|---|
| Tool | Zoom or Google Meet with screen share; phone sessions mirrored (iOS screen broadcast or Android cast) |
| Roles | Moderator plus a note-taker on the observation template (§7) |
| Time zones | UTC−5 (Ohio, Montreal) to UTC+10 (Melbourne): schedule early-morning and evening CET slots |
| Starting state | Fresh browser tab on the live URL, logged out of nothing (there's no login) |
| Build | Freeze the deploy during the study, or note the commit each session ran against |

## 5. Session script (60 minutes)

| Min | Part | What happens |
|---|---|---|
| 0–5 | Welcome | Consent, think-aloud explained: "We're testing the site, not you." |
| 5–15 | Context interview | Their collection; how they track it (show the spreadsheet if they're willing); the last time they traded; "What makes one copy better than another?" Rank the ladder cards (source, completeness, generation, resolution, compression, audio, logos, authoring) |
| 15–18 | First impression (T0) | 10 seconds on the landing page, then hidden. "What is this site? Whose is it? Could you get anything from it?" |
| 18–50 | Tasks T1–T8 | Order rotated after T1; skip any task that runs over |
| 50–57 | Wrap-up | SUS questionnaire; "How likely would you be to trade with this person, based only on the site?" (1–7); "Top 3 fields missing"; card sort of field priorities |
| 57–60 | Thanks | Incentive; permission to follow up |

## 6. Tasks

Scenarios are worded around the goal and never name the UI ("filter", "drawer", "card").
**Bold** shows are fixed so results compare; the participant's own shows are substituted where
marked BYO.

| # | Scenario as read to the participant | Journey | Success = | Watch for |
|---|---|---|---|---|
| T0 | (10-second exposure) "What is this site and what could you do here?" | — | Says "one person's archive of concert video" and something about getting copies | Do they expect trading? Do they notice there's no contact? |
| T1 | "A friend asks if this collector has **Rage Against the Machine at Rock am Ring, May 1996**. Find out." Then a BYO show | J1 | Opens the right recording; states date and length | Abbreviations, date entry, which result they trust |
| T2 | "You own **30 Seconds to Mars at Rock am Ring 2010** as a 42-minute PAL DVD. Does this collection have anything better? Which one would you ask for, and why?" | J2 | Identifies an HD copy and justifies it with specs | Order of fields read; how they keep track across copies; whether they find resolution; Escape use |
| T3 | "Check this collection against your own list for **Pearl Jam** (or BYO artist). Note anything you don't have." | J3 | Lists 3+ recordings with dates they don't have | Opening cards one by one? Looking for export, list view or print? |
| T4 | "You collect live versions of **'Creep'**. Find every recording here where it was played, and how far into the set." | J4 | Finds the Songs group; locates the song in one setlist | Field syntax attempts; reaction to the missing highlight |
| T5 | "Show me everything from **Pinkpop**, oldest first. Then check whether there's any **Neil Young**." | J5 | Pinkpop sorted oldest first; finds the Neil Young record | **Do they clear the Pinkpop filter before searching?** What do they conclude from "No shows found"? |
| T6 | "Send a friend a link to **Foo Fighters at Big Day Out 2000** so they see exactly that recording. Then write the collector a one-line email reply asking for it." | J6 | Link reopens that recording; the reply names the exact copy | Address-bar copy vs share button; Back gesture; how they identify which copy they mean |
| T7 | "You last visited a month ago. What's new since then?" | J7 | Can say what's new (expected: can't) | Where they look; what they expect (a row, a date, RSS) |
| T8 | "From what you can see, how good is the picture on **Supergrass, VH2 Live Special 2005**? Any logos?" | J8 | Judges quality and names the VH2 logo | Zoom attempts; whether they want 1:1 or the original file |
| T9 | (phone participants) Repeat T1 and T6 on the phone | J1, J6 | As above | Back gesture, link sharing, tap targets |

### Who does what

| | T0 | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 |
|---|---|---|---|---|---|---|---|---|---|---|
| P1 Jürgen (desktop) | ● | ● BYO Rockpalast | ● | | | | ● | ● | ● | |
| P2 Dale (iPad) | ● | ● | | ● Pearl Jam | | ● | ● | ● | | |
| P3 Rafael (phone) | ● | ● BYO Brazil | | | | ● Country: Brazil | ● | | | ● |
| P4 Kenji (Mac) | ● | ● | ● | | | | | | ● | |
| P5 Gareth (desktop) | ● | ● | ● | ● Glastonbury | | | | ● | | |
| P6 Mel (iPhone) | ● | ● | | | | | ● | ● | | ● |
| P7 Henk (125% zoom) | ● | ● | | | | ● | ● | | ● | |
| P8 Marc-André (Linux) | ● | ● | | ● Smashing Pumpkins | ● | | ● | | | |

## 7. What to capture

### Metrics, per task

| Metric | Definition |
|---|---|
| Success | **Pass** = done unaided · **Partial** = done with a hint, or answered with a wrong reason · **Fail** = gave up, or wrong answer given confidently |
| Time on task | From the end of the scenario to the participant's answer |
| Path | Each control used, in order; wrong turns; dead ends |
| Searches typed | Verbatim: the most valuable data for search tuning |
| Fields reached for | Every spec they looked for, found or not (feeds the field-priority list) |
| SEQ | Single Ease Question after each task, 1–7 |
| Confidence | "How sure are you of that answer?" 1–7 (a confident wrong answer is the worst outcome) |

### Per session

SUS score · trade-likelihood rating (1–7) · top 3 missing fields · field card sort · verbatim
quotes.

### Observation template (one row per event)

| Time | Task | Did (action) | Said (verbatim) | Saw (on screen) | Issue / severity 0–4 | Field asked for |
|---|---|---|---|---|---|---|
| 12:41 | T2 | Opened copy 3, scrolled to Technical | "So which one's the 1080?" | 43m · NTSC · mpeg2video · 5.65 GB | Resolution missing / 4 | Resolution |

## 8. Analysis

1. Transcribe observations to sticky notes (one note per issue per participant); affinity-map them
   by journey.
2. Rate each issue on Nielsen's 0–4 severity scale; weight by frequency (how many of the 8 hit
   it) and by whether it blocked the task.
3. Tally "fields reached for" across participants to re-rank the must-have field list in the
   persona.
4. Persona check: mark each assumption in [01](01-persona-archive-trader.md) confirmed, adjusted
   or refuted.
5. Report: top issues with clips, a task-success matrix, SUS, and recommendations re-ranked
   against [05](05-findings-report.md).

---

## 9. Pilot run — scripted walkthrough (2026-10-16)

**What was done.** Each participant's tasks were scripted and run against the **live site** in
headless Chromium at that participant's screen size (desktop 1440×900; 1536×864 at 125% zoom;
MacBook 16" 1728×1117 Retina; iPad 820×1180; phone 390×844). Each step saved a screenshot and the
text on screen. Two batteries of trader-style searches (89 queries) ran separately. This shows **what the site
does** for each path; it can't show what a person would think or feel. That is what the real
sessions are for.

**Predicted outcome per task**, from what the site did:

| Task | Predicted | Why |
|---|---|---|
| T1 Known item | **Partial** | Full artist name + event + year works; abbreviations (RATM) and any date format fail |
| T2 Version compare | **Fail** | Resolution never shown; HD copies labelled NTSC/PAL; four identical cards; Escape wipes the results |
| T3 Artist audit | **Partial** | The list is there but year-only, image-heavy, with no export |
| T4 Song hunt | **Pass** | Songs group works well; no highlight in the setlist |
| T5 Event dig | **Partial** | Pinkpop works; Neil Young is "not found" while the filter is on |
| T6 Share & request | **Fail** | Link doesn't reopen the show; Back leaves the site; no contact |
| T7 What's new | **Fail** | Nothing on the site says what's new |
| T8 Evidence | **Partial** | Stills show logos clearly; the viewer can't show them at native size |

### P1 Jürgen — desktop 1440×900

| # | Action | What happened |
|---|---|---|
| 1 | Lands | Masthead, search, Years / Country / Event, 12 Featured shows, "All artists 303" |
| 2 | Types `RATM` | "No shows match". **Did you mean: Rammstein, 1 show** ([e02](evidence/e02-ratm-suggests-rammstein.jpg)) |
| 3 | Types `rage rock am ring 1996` | 1 show: RATM · Rock am Ring · 1996, 24 min ✓ |
| 4 | Types `Rage Against the Machine` | Artist view, 19 shows; cards read "Rock am Ring / Nürburgring · 1996" (event, venue, year) |
| 5 | Opens Rock am Ring 1996 | `1996-05-24 · Rock am Ring · Germany`, **24m, NTSC**; 6-song setlist ending "Zapata's Blood (incomplete)" |
| 6 | Reads Technical | Video `mpeg2video` · Aspect 4:3 (native) · NTSC · `.vob` · `ac3` 2ch 48 kHz · **3.98 GB · 21 files** for 24 minutes. No lineage, no broadcaster, no resolution |
| 7 | Types `rockpalast` | 25 shows ✓ |
| 8 | Types `nurburgring` (no umlaut) | 54 shows ✓ (accent-insensitive) |

### P5 Gareth — desktop 1440×900

| # | Action | What happened |
|---|---|---|
| 1 | Types `30 Seconds to Mars` | 25 shows |
| 2 | Finds Rock am Ring 2010 | **Four cards, all "Rock am Ring · Nürburgring · 2010"**, 42 / 44 / 42 / 42 min ([e03](evidence/e03-four-identical-rock-am-ring-cards.jpg)) |
| 3 | Opens copy 1, closes with **Escape** | **Search cleared, results replaced by the home page, show still open**; a second Escape closes it ([e05](evidence/e05-escape-wipes-search.jpg)). Re-ran with × |
| 4 | Copy 1 | 41m · PAL · mpeg2video · 16:9 · `.vob` · ac3 2ch · 2.71 GB · 8 files |
| 5 | Copy 2 | 41m · PAL · mpeg2video · **4:3** · `.vob` · 2.72 GB · 8 files |
| 6 | Copy 3 (actually 1920×1080) | 43m · **NTSC** · mpeg2video · 16:9 · `.ts` · 5.65 GB · 1 file ([e04](evidence/e04-hd-copy-labelled-ntsc-no-resolution.jpg)) |
| 7 | Copy 4 (actually 1920×1080) | **Proshot** · 41m · PAL · h264 · `.mkv` · ac3 **6ch** · 2.59 GB |
| — | Verdict | Nothing on screen says HD. A careful reader might guess from `.ts` / h264 and the file size. "Proshot" appears on one copy of four |
| 8 | Types `glastonbury 2009` | 3 shows ✓ |
| 9 | Looks for export or compare | None |

### P2 Dale — iPad 820×1180

| # | Action | What happened |
|---|---|---|
| 1–2 | Scrolls to All artists | Two-column A–Z; **show counts barely visible** ([e10](evidence/e10-ipad-a-z-faint-counts.jpg)) |
| 3 | Taps Pearl Jam | 21 shows, "All artists" back link |
| 4 | Reads cards | Captions: "Pinkpop / Megaland · 2000" **three times** (44, 47, 1h 15m); "VH1 Storytellers / The Avalon · 2006" **twice** (both 44 min) |
| 5 | Types `letterman pearl jam` | "No shows found… Check the spelling" (correct: there's none, but the message implies a typo) |
| 6 | Types `artist:"pearl jam" year:1995` | 0 (quoted values unsupported; no 1995 show anyway). Undocumented syntax |

### P8 Marc-André — desktop 1440×900

| # | Action | What happened |
|---|---|---|
| 1 | `creep` | **Songs group, 37 recordings**: STP, Radiohead, Korn's Radiohead cover, and Metallica's "Creeping Death" (prefix match); song named on each card ✓ ([e12](evidence/e12-song-search-creep.jpg)) |
| 2 | `plush` | 53 ✓ |
| 3 | `interstate love` | 47 ✓ (partial title works) |
| 4 | `mellon collie` | 0 (album or tour names aren't indexed) |
| 5 | `much music intimate` | 5 ✓ |
| 6 | Opens STP Irving Plaza 2015 | 23-item setlist; **"Creep" (no. 14) not highlighted** |
| — | Syntax battery | `song:creep` 37 ✓ · `songs:creep` 0 · `artist:pearl` 21 ✓ · `year:2000` 82 ✓ · `artist:pearl year:2000` **0** · `venue:"brixton academy"` **0** · `venue:brixton` 12 ✓ |

### P7 Henk — 1536×864 at 125%

| # | Action | What happened |
|---|---|---|
| 1 | Lands at 125% | Layout holds ✓ |
| 2–3 | Event → types "pink" → Pinkpop | 33 shows, chip "Pinkpop ×", Clear all ✓ |
| 4 | Sort | Native select: newest / oldest / artist ✓ |
| 5 | Years | Histogram, decade chips, From/To ✓ |
| 6 | Types `neil young` with Pinkpop still on | **"No shows found for 'neil young'. Check the spelling…"**; the one Neil Young record is hidden by the filter ([e06](evidence/e06-empty-state-ignores-filter.jpg)) |

### P6 Mel — phone 390×844

| # | Action | What happened |
|---|---|---|
| 1–2 | Lands, scrolls | Masthead, two-column Featured, tab bar (Browse / Artists / Search) ✓ |
| 3 | `big day out` | 35 shows; sticky search + filters + count/sort take about a fifth of the screen |
| 4 | Opens Foo Fighters BDO 2000 | Full-screen sheet; Channel V logo visible in stills ✓; setlist no. 1 is **"Interview (cuts in)"**, nos. 12 and 14 are **"Jam"** ([e07](evidence/e07-phone-drawer-setlist-junk.jpg)) |
| 5 | Scrolls for share or contact | Nothing: no share, no request, no contact. No contact, about or trade wording anywhere on the page |
| 6 | Copies the URL, opens it in a new tab | `/?q=big%20day%20out` → **lands on the search results, not the show** ([e08](evidence/e08-shared-link-lands-on-search.jpg)) |
| 7 | Browser Back with the show open | **Leaves the site** (tested on desktop; the drawer adds no history entry, so the phone back gesture does the same) |

### P3 Rafael — phone 390×844

| # | Action | What happened |
|---|---|---|
| 1 | `sao paulo` | 6 ✓ |
| 2 | `rock in rio` | 14 ✓ (includes Rock in Rio Madrid) |
| 3 | `brasil` | **2** (only "Lollapalooza Brasil"); Country = Brazil has 16 |
| 4 | Country filter | Readable list with counts and a filter box ✓ ([e13](evidence/e13-phone-country-filter.jpg)) |
| 5 | `foo fighters rock in rio` | 1 ✓ |
| 6 | Opens it | **`2001-01-01`** · Rock in Rio · Brazil · 1h 3m · NTSC; "No setlist yet"; Multishow logo in the stills ([e09](evidence/e09-placeholder-date-2001-01-01.jpg)) |
| 7 | Technical details (folded on phone) | Opens ✓; same raw codec labels |

### P4 Kenji — MacBook 16" 1728×1117 Retina

| # | Action | What happened |
|---|---|---|
| 1 | `summer sonic` | 9, mostly Excerpts ✓ |
| 2 | `japan` | 30 ✓ |
| 3 | `Supergrass` | 24 shows ✓ |
| 4 | Opens VH2 Live Special 2005 | Proshot · 43m · PAL; Notes show the sidecar verbatim (`---- Setl;ist.txt ----`) ✓ |
| 5 | Opens a still | Viewer inside the drawer: **768×576 still shown at 671×503**, capped by the drawer's width; no 1:1, no original, no timecode. The VH2 logo is clear ✓ ([e11](evidence/e11-viewer-capped-at-drawer-width.jpg)) |

### Search batteries (desktop, 89 queries) — the ones that matter

| Query | Result | Query | Result |
|---|---|---|---|
| `RHCP` / `STP` / `QOTSA` | 31 / 101 / 11 ✓ | `RATM` / `FNM` / `30STM` / `KOL` | 0 (RATM → "Rammstein") |
| `SP` | 5 (not Smashing Pumpkins) | `Pumpkins`, `Red Hot` | ✓ |
| `1996-05-24`, `24.05.1996`, `24/05/1996`, `May 24 1996`, `1996-05` | **all 0** | `1996`, `rage 1996` | 69, 4 ✓ |
| `Rock am Ring 97`, `97` | 0, 1 song | `pearl jam pinkpop 2000` | 3 ✓ |
| `uk`, `deutschland`, `brasil` | 0, 0, 2 | `usa` | 4 (artist/song words, not US shows) |
| `koln` | 0 → "Korn" | `cologne` | 24 ✓ |
| `pal`, `ntsc`, `1080i`, `hd`, `dvd9`, `sbd` | all 0 or song hits | `soundboard` | 0 → "Soundgarden" |
| `proshot` / `pro-shot` | 868 / 2 songs | `audience`, `type:audience` | 17, 16 ✓ |
| `glasto`, `reading leeds`, `T in the park` | 71, 13, 20 ✓ | `TITP`, `R&L` | 0 |
| `note:VHS`, `note:lineage` | 92, 141 ✓ | `WDR`, `BBC` | 4, 18 |

## 10. Risks and limits

- **The pilot is simulated.** It records what the site does, not how people react. Every
  "anticipated" item needs a real session before it counts as a finding.
- **The owner built the site**: get someone else to moderate if possible, or follow the script
  word for word to avoid defending design choices mid-session.
- **Recruiting from trackers** skews towards expert uploaders; balance with Facebook-group traders
  (P2-type).
- **Live data changes**: note the commit each session ran against.

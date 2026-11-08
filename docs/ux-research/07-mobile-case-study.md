# The Vault on a phone — case study notes

> **2026-11-08.** The record of how the site's phone experience was researched, decided and
> rebuilt in one day: the brief, the plan, the owner's decisions, the method, what was found,
> what was built and how it was checked, the problems met on the way, and where every asset is
> kept. Raw material for a case study. The findings themselves are in
> [06-mobile-audit.md](06-mobile-audit.md); the personas in [01](01-persona-archive-trader.md)
> and [02](02-participants.md).

## In short

The Vault is used at a desk, but traders arrive from an email or a chat link on their phones. An
audit of five trader scenarios on emulated phones found the site showed **one show per screen**,
opened an artist from the A–Z list **at the wrong end** of its shows, and **left the site** when
Back was pressed after a search. Fourteen fixes were scored, shown as before/after pictures, picked
by the owner, built on a branch, checked against the live site on phones and desktop, and
pushed live the same evening. A phone now shows four shows on the first screen, an artist's run
in 2.9 screens instead of 10.8, and Back steps through the site. Desktop looks exactly as it did.

## Timeline (New Zealand time)

| Time | Step |
|---|---|
| 16:33 | The brief (below): a phone-only audit from the saved personas, plan first |
| 16:35 | The plan: five scenarios, six screen sizes, the method, the report's shape, three questions |
| 16:42 | The owner's answers: the five scenarios, plus "the cards are too big"; Chromium emulation; before/after pictures; no code changes |
| 16:46–17:05 | Five scenarios run on six screen sizes, a search battery, mockups of each fix on the live page |
| 17:09 | The report: 5 walkthroughs, 13 findings, 14 scored recommendations with before/after pictures and A/B picks |
| 20:22 | The owner's picks: B on all fourteen; "be very mindful of what stays on desktop"; a branch to preview |
| 20:23–20:56 | Built on the branch `mobile-audit`, measured on phones and desktop, preview served to his phone |
| 21:43 | "ok looks good … implement and commit and push"; keep every asset for a case study |
| evening | Merged into `main`, pushed, deployed |

## The brief, in the owner's words

> plan with me. i want yo uto do a mobile audit of the user experience from the saved personas you
> used earlier audits. i want yo uto identify top 5 scenarios a trader will go thorugh on their
> phone. and step through it as them and screenshot the results and play back to me in full audit
> and report. the UI . example the search, the filters, the size of the search results show tiles,
> the content above the fold, the search bar, navigating back and forth from artists to search
> etc. Mobile audit only not desktop or above. plan only. and play back to me the full report
> similar to how you did last time with full recommendations, confidence levels and justify each
> reason why for all rec changes. act as senior product designer/ux ui designer. do you
> understand?

## The plan (as proposed, 16:35)

<details>
<summary>The full plan</summary>

Yes, I understand. You want a mobile-only audit of the live site, run as five of the saved trader personas on their phones. I'd step through each one's most likely phone task, take screenshots, and give you a full report with ranked recommendations, confidence levels and the reasoning for each. This turn is the plan only. Nothing gets built or changed. The live site matches `main`, so I'd audit what traders see today.

#### Who, and why these five

The research says traders do serious work at a desk and use the phone **for quick checks and replying in chats**. Karl's email is also how they arrive. So each scenario is a short task that starts from a message.

| # | Scenario | Persona (on their phone) | Trigger |
|---|---|---|---|
| **S1** | **First tap from Karl's email: "what's here, and what's new?"** | Henk, 60, varifocals, reads everything | Taps the site link in Karl's email |
| **S2** | **"Anyone got…?" Quick check from a chat** | Rafael, Android, impatient, on mobile data | A WhatsApp group asks for a Brazilian broadcast |
| **S3** | **A show link arrives: check it, compare the copies, send one on** | Mel, iPhone, "expects apps to behave like apps" | A friend pastes a show link in Discord |
| **S4** | **Artist run, going back and forth** | Dale, Pearl Jam completist, doesn't explore menus | "What Pearl Jam do you have?" |
| **S5** | **Dig a series with filters** | Jürgen, expert, German festival TV | Hunting the Rockpalast and Rock am Ring shows he's missing |

#### What each scenario walks through

- **S1:** the first screen before any scrolling, the masthead, whether the page says what the site is, Featured, finding the search bar, finding what's new (New badges, More filters → New, the "recently added" sort), and text size and contrast for eyes aged 60.
- **S2:** the search bar with the keyboard open, typing the way a trader types (`brasil`, `RATM`, `24.05.96`), how many results show above the keyboard, Did you mean, tile size, opening a show, confirming its identity in the top of the drawer, then the back gesture.
- **S3:** the link preview, landing straight on a show, the copies comparison at phone width, the stills viewer (swipe, zoom, Open full size), Share, closing, and Back after arriving by link (where does she end up?).
- **S4:** the Artists tab, the A–Z list on a phone, the artist's results, how many tiles fit per screen in Grid vs List, open a show → Back → is the scroll position kept? Then All artists → another artist → the Search tab → back again. This is your "artists ↔ search" navigation.
- **S5:** every filter on a phone (Years with a touch brush, Country, Event, More filters), the controls row that scrolls sideways, chips, Clear all, sort, typing a new search with a filter still on, and the results row folding while scrolling.

#### Devices

| Screen | Why |
|---|---|
| **390×844 iPhone** (main run) | The standard iPhone width, and the site's own phone test size |
| 360×780 Android | Rafael's Samsung; a narrow phone |
| 375×667 iPhone SE | The shortest screen; the hardest test for the first screen |
| 430×932 iPhone Pro Max | Over 400px, where the grid switches to two columns |
| 844×390 landscape | One pass, for the drawer and filters |

**The first screen will be measured as the area a person can actually see**, not the full 844px. Safari's address bar takes up to ~180px, and an open keyboard takes about 40% of the screen. I'll draw these lines on the screenshots.

One thing to test specifically: any phone under 400px wide, which includes every standard iPhone, gets **one tile per row**. Wider Androids and the Pro Max get **two**. So two traders could see very different densities. I'll count shows per screen at each size.

#### Checks on every screen

- How much of the screen goes to fixed parts: the bar, the tab bar, the results row.
- Tap targets: 44pt per Apple, 48dp per Android.
- Text: 16px for body, 12px for labels, 4.5:1 contrast.
- Thumb reach for the main actions.
- What Back does, and whether search and scroll position survive.
- Empty and error states.
- Text cut off with "…".
- Sideways page scroll.
- First load on a slow 4G connection.

#### How I'd run it

- Scripted Chromium with iPhone/Android emulation (touch, 3× pixel density, mobile browser), the same method as the October run.
- A screenshot plus measurements at every step.
- I'd write each step in the persona's voice: does / sees / thinks.
- No changes to the site, and nothing committed until you say.

#### The report

- A standalone page in `~/VaultShots/reports/`, opened in Chrome.
- A Markdown copy as `docs/ux-research/06-mobile-audit.md`, with screenshots in `evidence/mobile/`.

Same structure as last time:

1. Bottom line.
2. A pass / partial / fail per scenario, with taps and screens scrolled.
3. Each walkthrough step by step, with notes on the screenshots.
4. Findings by severity.
5. **Ranked recommendations**, scored the same way as before (Impact × Reach × Confidence ÷ Effort), so they slot into the existing tracker.
   - **Confidence:** 1.0 = seen or measured, 0.8 = predicted from the persona, 0.5 = judgement call.
   - **Each recommendation's reasoning names:** the persona and step where it happened, the measured evidence, and the guideline behind it (Apple/Android, WCAG, established mobile patterns).
6. What works — keep it.

#### Limits

Emulated Chromium is not real Safari. It can't show the real keyboard, Safari's toolbars, the real share sheet, pinch zoom or a real WhatsApp preview. I'd simulate what I can, and mark anything unconfirmed at 0.8 confidence.

#### Three decisions for you

1. **Are these the right five scenarios?** Anything to swap in, such as a song hunt on the phone?
2. **Real iPhone rendering:** should I download Playwright's WebKit engine (~100 MB) so the screenshots render like Safari? Or is Chromium emulation enough? I'd recommend WebKit for iPhone accuracy.
3. **Mockups:** should the top recommendations include a simple before/after phone mockup, or just the written recommendation?

Reply with your answers, or "go", and I'll run it on these defaults: these five, WebKit plus Chromium, and mockups for the top 3.

</details>

## The owner's decisions

1. **On the plan** (16:42):
   > 1 - yes scenarios look good. also im concerned the columns of search results cards are too
   > big and we could fit more smaller fit more on each screen? 2 - chromium emulatio is enough
   > thanks. 3 - yes before after - i need to see your visual recommendations with changes spelled
   > out. go. dont make code changes just show me results and your planned changes

   So: Chromium only (no WebKit download), mockups for every fix rather than the top three, and
   card density added as a question of its own (answered with two and three columns, and rows,
   each measured; three columns could not be read).
2. **On the report** (20:22): B — make the change — on all fourteen, pasted from the report's
   "Copy for Claude Code" export, with:
   > be very mindful of what stays on desktop versus what changes for mobile optimisation. i dont
   > want any suprises but anything that makes sense to be implemented in both go ahead. To be
   > safe i'd like you to create a branch (call it what you recommend) for these changes only, so
   > i can preview and if i like can merge back into main.
3. **On the build** (21:43): approved, merged and pushed; every finding, picture, plan and file
   kept for a case study.

## Method

- **Who:** five of the eight research participants ([02](02-participants.md)), each with the phone
  task they would most likely do: Henk (60, varifocals) arriving from the owner's email, Rafael
  (Android, mobile data) checking a chat request, Mel following a shared show link, Dale working
  through Pearl Jam, Jürgen digging a festival series with filters.
- **How:** scripted Chromium (Playwright) with phone emulation — touch, mobile user agent, 2×
  pixels — at the area a person actually sees after the browser's bars (iPhone 15 390×664, Galaxy
  S23 360×660, iPhone SE 375×553, Pro Max 430×752, 125% text 312×531, landscape 750×340), a
  drawn keyboard at real heights, and slow 4G with a 4× slower CPU for loading. A screenshot and
  measurements (shows on screen, bar heights, targets under 44px, text sizes) at every step.
- **Proposals as pictures:** each fix was drawn on the live page in the test browser, so every
  "after" was the real site with real shows, not a sketch, and measured like the "before".
- **Scoring**, as in the October research: Impact (3 job fails, 2 detour, 1 friction) × Reach (3
  every visit, 2 common, 1 edge) × Confidence (1.0 measured, 0.8 predicted, 0.5 judgement) ÷
  Effort (1 under half a day, 2 one to three days, 4 a week+).

## What the audit found

Scenario verdicts: S1 first visit partial, S2 quick check partial, S3 shared link pass, S4 artist
run **fail**, S5 filters partial. The headline numbers (iPhone 15):

- 1 show on the first screen (½ on an SE, none sideways); Pearl Jam's 24 shows took 10.8 screens.
- An artist picked from the A–Z list opened at the **bottom** of its shows (a smooth scroll cut
  short as the list gave way to the results).
- Back **left the site** after any search or artist; only an open show added a Back step.
- Initials beside another word ("ratm swu", "fnm bizarre 97") found nothing.
- With the keyboard up, a search's results were hidden under a 164px header; with four filters,
  the bars took 44% of the screen; More filters ran off the bottom of the screen.
- Touch targets down to 14px (the search field's ×).

Fourteen recommendations, R1–R14, ranked by score; details and reasoning in
[06-mobile-audit.md](06-mobile-audit.md).

## How it was built

- **A branch in its own folder** (a git worktree), so the owner's other sessions working on `main`
  were never disturbed, and the preview could be served to his phone on the home Wi-Fi.
- **The rule for desktop:** anything that changes the look is scoped to phones (below 768px);
  fixes to behaviour that was broken everywhere go on both — opening an artist at the top, Back
  stepping through the site, the return to the place in the A–Z list, initials beside words, the
  first stills loading first. Desktop was then **checked pixel for pixel** against the live site.
- **In parallel:** the search change and the show drawer, which share no files with the rest, were
  built by two helpers while the navigation, grid and filter work went ahead.
- **Measured with the audit's own scripts**, pointed at the branch: the same phones, the same
  steps, before and after side by side. Then the project's checks (types, performance rules,
  URLs, filters, search precision, show pages) and the performance benchmark.

## Results

| | Before | After |
|---|---|---|
| Shows on the first screen (iPhone 15 / SE) | 1 / ½ | 4 / 2 and two halves |
| Pearl Jam's 24 shows (iPhone / Galaxy) | 10.8 / ~10 screens | 2.9 / 2.7 screens |
| An artist from the A–Z list opens at | the bottom | the top |
| Back after a search or an artist | leaves the site | steps back, to the same pixel |
| Initials beside another word (10 trader queries) | 0 found | 10 found |
| Results above the keyboard ("brasil") | 0 | 4 |
| Bars with four filters on | 235px, 1 show visible | 121px, 6 visible |
| Show header while reading a setlist | 150px | 56px |
| Smallest touch target in the bar and drawer | 14px | 44px |
| Desktop | — | pixel-identical on an artist page and filtered results |
| Drawer opening (benchmark) | ~30 ms | 30 ms; every budget passed |

## Problems met while building, and how they were found

1. **The letter index never appeared.** The test's tap on the index opened an artist underneath
   it. Cause: the new phone row folded while scrolling on the landing too, so the bar was shorter
   than the jump to the A–Z list had allowed for, and the list never counted as "on screen". Fix:
   fold only on results, as before.
2. **Back to the A–Z list landed 92px low.** The first guess (the order of two listeners) was
   wrong; a frame-by-frame trace showed the page jumped one frame before the masthead opened, and
   the browser then kept the content in view by moving it down by the masthead's height (scroll
   anchoring). Fix: jump two frames later.
3. **Closing a show with × would have sent the page to the top** — found reading the code before
   any test: the site's own step back over the show looked like Back to another page. Fixed and
   then tested.
4. **A shared search link added two Back steps.** An old quirk — the search field cleared and
   re-set itself on load — had been invisible until view changes started adding history entries.
   Fixed at the root: the field starts from the link's search.
5. **"34 sh…"**: on a narrow phone the count was cut short, because a drop-down is as wide as its
   longest option. Fix: the phone's own picker lies invisible over a short label of the choice.
6. **Two results above the keyboard, not the four predicted.** The new row of controls took the
   room; it now steps aside while the search is being typed, which gave four.

## Where the build departs from the proposal, and why

- The line under the wordmark is 12px, not 11px: the site's own floor for text (F13).
- "New" applies the New filter but leaves the sort alone: the sort is a lasting preference, and
  "Recently added" would have carried over to the next artist.
- The phone's row folds while scrolling only on results (problem 1).
- The row stepping aside while typing is an addition (problem 6).

## Still to confirm on a real phone

The five limits in [06](06-mobile-audit.md#limits--check-on-a-real-phone): Safari's own scrolling
on the A–Z jump, the iPhone's edge-swipe Back, results above the real keyboard, the filter sheet,
and pinch-zoom in the viewer.

## Where everything is kept

| What | In the repository | On the Mac |
|---|---|---|
| This record | `docs/ux-research/07-mobile-case-study.md` | — |
| The audit: findings, scores, what was built | `docs/ux-research/06-mobile-audit.md` | — |
| The audit report (HTML, 66 pictures, A/B picks) | `evidence/mobile/report/mobile-audit.html` | `~/VaultShots/reports/mobile-audit.html` |
| The before/after page of the build (HTML) | `evidence/mobile/report/mobile-audit-built.html` | `~/VaultShots/reports/mobile-audit-built.html` |
| Screenshots used by the two pages (85, full size) | `evidence/mobile/report/shots/` | — |
| Every screenshot taken (184) | — | `~/VaultShots/reports/mobile-audit/shots/` |
| Before / proposed / built pictures, resized | `evidence/mobile/m01…m14-*.jpg` | — |
| The test scripts (Playwright) and page builders | `evidence/mobile/scripts/` | `~/VaultShots/reports/mobile-audit/scripts/` |
| The measurements (walkthrough log, mockups, search battery) | `evidence/mobile/data/` | `~/VaultShots/reports/mobile-audit/*.json` |
| The personas and participants | `docs/ux-research/01`, `02` | — |
| The code | commits `c89e24ea` (audit), `7bb529da` (search), `48081459` (drawer), `d0073287` (the rest), `80a2ec0e` (docs), then this archive; branch `mobile-audit` kept | — |

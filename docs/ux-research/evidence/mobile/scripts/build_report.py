#!/usr/bin/env python3
"""Builds ~/VaultShots/reports/mobile-audit.html from the audit's screenshots and logs."""
import html, json
from pathlib import Path

ROOT = Path(__file__).parent
OUT = ROOT.parent / 'mobile-audit.html'
LOG = json.loads((ROOT / 'log.json').read_text())
MOCK = json.loads((ROOT / 'mock.json').read_text())
Q = json.loads((ROOT / 'queries.json').read_text())
S = 'mobile-audit/shots/'

def e(s): return html.escape(str(s))

def phone(file, label='', cap='', tone='', w=230):
    lab = f'<div class="plabel {tone}">{e(label)}</div>' if label else ''
    capx = f'<figcaption>{cap}</figcaption>' if cap else ''
    return f'<figure class="ph" style="--w:{w}px">{lab}<a href="{S}{file}" target="_blank"><img loading="lazy" src="{S}{file}" alt="{e(label or cap)}"></a>{capx}</figure>'

# ─────────────────────────── Scenarios ───────────────────────────
SCEN = [
  dict(id='S1', who='Henk de Vries', age=60, where='Rotterdam', dev='iPhone 15 · Safari (also at 125% text size)',
       job='J7 What’s new · first impression', verdict='partial',
       trig='Karl’s email says new shows are up. Henk taps the link on his phone after dinner.',
       quote='“It says Featured. Is that everything? Where are the new ones he mentioned?”',
       steps=[
         ('S1-01-first-screen-iphone.jpg', 'Taps the link', 'Wordmark, tagline, search, three filter pills and a fourth cut off at the edge. <b>One</b> show on the first screen.'),
         ('S1-02-scroll-1-iphone.jpg', 'Swipes down', 'One card per swipe. The 12 Featured shows fill <b>5.2 screens</b> before the artist list starts.'),
         ('S1-04-filter-row-scrolled-iphone.jpg', 'Looks for “new”', 'Nothing on the page says new. He swipes the filter row sideways to reach <b>More filters</b>.'),
         ('S1-06-more-filters-bottom-iphone.jpg', 'Opens More filters, scrolls it', 'Source … Setlist. <b>“Added → New” is below the screen edge</b>: measured at 683–715px on a 664px-tall screen, even with the list scrolled to its end.'),
         ('S1-08-new-results-iphone.jpg', 'Finds New (64 shows)', 'Sorted by year, not by date added. The bar, chip row and count row take 199px; one card fits.'),
         ('S1-13-first-screen-zoom125.jpg', 'At 125% text size', 'Everything wraps cleanly, with no sideways scrolling. Half a card visible.'),
         ('S1-15-zoom-drawer-zoom125.jpg', 'Opens a show at 125%', 'Readable: name, date, place, source, quality, Share, stills, setlist.'),
       ],
       outcome='Reaches the new shows, but only by luck: the one control that leads there is cut off, and its last option is below the screen. Text holds up well at 125%.'),
  dict(id='S2', who='Rafael Nogueira', age=47, where='São Paulo', dev='Galaxy S23 · Chrome (360×780)',
       job='J1 Do you have it?', verdict='partial',
       trig='A WhatsApp group asks: “anyone have the Multishow broadcast of Foo Fighters at Rock in Rio, or RATM at SWU?”',
       quote='“RATM SWU — nothing? He has it, I can see it when I type Rage. Why not RATM?”',
       steps=[
         ('S2-01-search-tab-android.jpg', 'Taps Search in the tab bar', 'The field focuses and the keyboard rises in one tap. Good.'),
         ('S2-02-brasil-keyboard-android.jpg', 'Types “brasil”', '16 found, and <b>none visible above the keyboard</b>: the big title, “Found 16 shows”, the “SHOWS 16” label, then the top edge of a card.'),
         ('S2-05-foo-rir-keyboard-android.jpg', 'Types “foo fighters rock in rio”', 'The title wraps to two lines at 36px. The one result is below the keyboard.'),
         ('S2-07-drawer-top-android.jpg', 'Opens it', 'Multishow logo in the still, “Pro-shot · Multishow”, “2001 (date unknown)”: honest and quick to confirm.'),
         ('S2-11-back-gesture-android.jpg', 'Android back', 'The show closes and the results stay. Good.'),
         ('S2-12-ratm-swu-android.jpg', 'Types “ratm swu”', '<b>0 shows</b>, “No shows found”. Both SWU copies exist; “rage swu” finds them.'),
         ('S2-14-date-android.jpg', 'Types “24.05.96”', 'Rock am Ring 1996 found: the date in his own format works.'),
       ],
       outcome='Gets the Foo Fighters answer in about 6 taps. Gets a <b>false “no”</b> for RATM. After four searches he presses Back and <b>leaves the site</b> (measured: Back went to the previous app).'),
  dict(id='S3', who='Mel Tran', age=44, where='Melbourne', dev='iPhone 15 · Safari',
       job='J6 Share · J2 Is it better?', verdict='pass',
       trig='A friend in Discord pastes a link: “Foos BDO 2000, which copy is the full one?”',
       quote='“Two copies, I can see that. Which one is the original broadcast? The specs are all squashed into a column.”',
       steps=[
         ('S3-01-link-lands-iphone.jpg', 'Taps the link', 'The exact show opens: Channel V logo in the still, date, venue, “Pro-shot · Channel V”, 1h 05m, Share.'),
         ('S3-03-copies-iphone.jpg', 'Scrolls to the copies', '“2 recordings of this show”. Each copy’s specs wrap into a 150px column of 6–7 lines. The differences are mid-sentence.'),
         ('S3-04-other-copy-iphone.jpg', 'Taps the other copy', 'The show swaps in place. Good.'),
         ('S3-07-viewer-iphone.jpg', 'Opens a still', 'Full width, with “Open full size”. The dots are 22px targets.'),
         ('S3-09-share-visible-iphone.jpg', 'Taps Share', 'The share sheet gets “Foo Fighters · 2000-01-16 · Big Day Out · SD 576 · 1h 10m” and the show’s own link. The pill is 22px tall.'),
         ('S3-11-docked-iphone.jpg', 'Reads the info file', 'The docked header stays at <b>150px, 23% of the screen</b>, while she reads.'),
         ('S3-10-closed-iphone.jpg', 'Closes the show', 'Lands on the home page. Back then returns to Discord: right for a link.'),
       ],
       outcome='Done: she confirms the show, opens the other copy and shares a one-line reference. Comparing the two copies at phone width is the slow part.'),
  dict(id='S4', who='Dale Kowalski', age=59, where='Columbus, Ohio', dev='iPhone 15 · Safari (also Pro Max, SE)',
       job='J3 Artist audit', verdict='fail',
       trig='Away from his iPad, Dale wants to tick Pearl Jam off his list, then check Soundgarden.',
       quote='“It starts at an undated Reading tape? Where’s the rest? And why am I back at the top of the A to Z?”',
       steps=[
         ('S4-01-artists-tab-iphone.jpg', 'Taps Artists', 'Jumps to the A–Z list: 305 artists, <b>19.7 screens long</b>, with no letter index.'),
         ('M-azjump-tap-iphone.jpg', 'Scrolls to P', 'Pearl Jam is 13.5 screens into the list.'),
         ('S4-03-pearl-jam-iphone.jpg', 'Taps Pearl Jam', '<b>Lands at the bottom of Pearl Jam’s results</b>, on two undated tapes, with the title out of view. Measured: y 12,441 → 6,477, the end of a 7,141px page.'),
         ('S4-07-back-from-show-iphone.jpg', 'Opens a show, then Back', 'Back closes the show at exactly the same place (6,477 → 6,477). Good.'),
         ('S4-09-list-scroll-1-iphone.jpg', 'Switches to List', 'Dense and readable: date, event and place, quality and length. 8 rows per screen.'),
         ('S4-10-all-artists-return-iphone.jpg', 'Taps “All artists”', 'Back to “#” at the top of the list, <b>13.5 screens from P</b>.'),
         ('S4-16-pearl-jam-promax.jpg', 'Same page on a Pro Max', 'Two columns, 6 cards, because the screen is 430px, over the 400px line. Pearl Jam takes 3 screens here, 10.8 on a standard iPhone.'),
       ],
       outcome='The artist opens at the wrong end, the run of single cards takes 10.8 screens, “All artists” loses his place, and Back from a search leaves the site.'),
  dict(id='S5', who='Jürgen Becker', age=56, where='Cologne', dev='iPhone 15 · Safari',
       job='J5 Show me the series', verdict='partial',
       trig='On the train, Jürgen checks which Rock am Ring and Rockpalast broadcasts from 1995–2005 are pro-shot.',
       quote='“Four filters and I see one show at a time. The filters work, the screen is full of buttons.”',
       steps=[
         ('S5-01-event-open-iphone.jpg', 'Taps Event', 'A dropdown with counts and a filter box. Rows 32px.'),
         ('S5-02-event-typed-iphone.jpg', 'Types “rock”', 'Above the keyboard, three options.'),
         ('S5-05-years-open-iphone.jpg', 'Taps Years', 'Histogram, decades, From/To and a live “79 shows”. Good.'),
         ('S5-08-more-open-iphone.jpg', 'More filters → Pro-shot', 'Zero-count options greyed, not hidden. Good. Rows 32px.'),
         ('S5-10-all-filters-iphone.jpg', 'Four filters on', 'The bar is <b>235px</b>; with the tab bar, <b>44% of the screen</b> is controls. One card.'),
         ('S5-11-all-filters-scrolled-iphone.jpg', 'Scrolls down', 'The count row folds away (46px). The two chip rows stay.'),
         ('S5-14-fnm-with-filters-iphone.jpg', 'Types “faith no more” with filters on', 'The empty state names the four filters and offers “Show 22 without the filters”. Exactly right.'),
       ],
       outcome='Every filter works and the empty state is excellent. The phone layout spends nearly half the screen on controls.'),
]

VERDICT = {'pass': ('Pass', 'ok'), 'partial': ('Partial', 'warn'), 'fail': ('Fail', 'bad')}

# ─────────────────────────── Recommendations ───────────────────────────
REC = [
  dict(id='R1', title='An artist opened from the A–Z list starts at the top of its shows', sev='Critical', batch='M1 Navigation',
       I=3, R=3, C=1.0, E=1, call=False,
       pairs=[('M-azjump-before-iphone.jpg', 'M-azjump-after-iphone.jpg', 'Tapping Pearl Jam from the list today lands on the last two cards. After: the top, title and count in view.')],
       change=['On artist select, jump to the top instantly (<code>behavior: \'auto\'</code>) instead of the smooth scroll that the page swap cancels; or scroll before the list is replaced by results.',
               'Files: <code>App.tsx</code> (<code>handleArtistSelect</code>), <code>src/lib/motion.ts</code> (an instant option). Desktop likely has the same bug with a shorter list; check it in the same change.'],
       why=['Dale’s artist run (S4) starts on two undated tapes with no title. He would read it as the end of the list, or as all there is.',
            'Every A–Z tap on a phone starts at least 5.6 screens down the page, so <b>every</b> artist opened from the list lands somewhere other than the top. Measured: y 12,441 → 6,477, the bottom of a 7,141px page.',
            'Confidence 1.0 in Chrome’s engine (Android). On iPhone Safari the same is expected: a smooth scroll cut short by the page shrinking. Worth one tap on a real iPhone.']),
  dict(id='R2', title='Two columns of cards on every phone', sev='High', batch='M2 Density',
       I=2, R=3, C=1.0, E=1, call=False,
       pairs=[('M-tiles-before-iphone.jpg', 'M-tiles-after-iphone.jpg', 'Pearl Jam on an iPhone 15. Today: 1 card per screen. Two columns: 4 (6 with R4).'),
              ('M-tiles-before-android.jpg', 'M-tiles-after2-android.jpg', 'The narrowest phone tested (Galaxy, 360px). Two columns stay readable.')],
       extra=[('M-tiles-three-iphone.jpg', 'Three columns: too far', 'Text and badges collide. Two is the limit.', 'bad'),
              ('M-tiles-rows-iphone.jpg', 'Alternative: rows', 'Readable but only 4 per screen, and a new card design.', ''),],
       change=['<code>GRID_TRACKS</code> in <code>components/FeaturedRows.tsx</code>: <code>grid-cols-1 min-[25rem]:grid-cols-2</code> → <code>grid-cols-2</code>. Featured, results and artist pages all follow.',
               'Column gap 12 → 8px on phones. The card itself is unchanged: it is exactly what Pro Max and many Android owners see today.',
               'Artist tiles above the results stay full width (<code>col-span-2</code> below md).',
               '<code>npm run perf</code> before and after (cards are the performance-sensitive part).'],
       why=['Every phone under 400px wide gets <b>one card per screen</b>: every standard iPhone (390–393px), the Galaxy S line (360px), the SE (375px). That is most traders’ phones.',
            'Pearl Jam’s 24 shows take <b>10.8 screens</b> on an iPhone 15, <b>3.0</b> on a Pro Max, and <b>2.9</b> with two columns and R4. The same trader gets 3–4× the scrolling depending on which phone he bought.',
            'Traders scan many shows to find one (J1, J3): density matters more than picture size on a phone, and the stills are inspected in the show itself.',
            'This reverses your 2026-10-19 pick (“one column under 400px”) for phones. I’m recommending it because measuring at real phone heights, with Safari’s bars, shows one card per screen.',
            'Tested and rejected: three columns (text over the picture collides with the badges) and list rows (readable, but only 4 per screen and a new card design).'],
       table=[('iPhone 15 (390)', '1', '4', '6', '10.8 → 2.9'), ('Galaxy S23 (360)', '1', '4', '6', '10.0 → 2.7'), ('iPhone SE (375)', '1', '—', '—', '12.4 → ~3.5'), ('Pro Max (430) today', '6', '—', '—', '3.0')]),
  dict(id='R3', title='Artist initials work next to other words (“ratm swu”, “fnm bizarre 97”)', sev='High', batch='M3 Search',
       I=3, R=2, C=1.0, E=1, call=False,
       pairs=[('M-initials-before-android.jpg', 'M-initials-after-android.jpg', '“ratm swu” today: 0. After: both SWU copies.')],
       change=['When a word in a free-text search is an artist’s initials or alias (RATM, FNM, QOTSA, STP, 30STM, RHCP…), read it as that artist and search the other words within their shows. Today <code>resolveArtist</code> only matches the whole query.',
               'Files: <code>src/search/searchIndex.ts</code>; new cases in <code>scripts/search-precision.ts</code> (every pair in the table below).'],
       why=['J1’s failure mode: a false “no” ends the conversation. Rafael would tell his group “he hasn’t got it”.',
            'On a phone, traders type the shortest form. <b>8 of 8</b> initials-plus-word searches returned 0 although the shows exist; the same searches with the full name work (table).',
            'Not phone-only: desktop has it too. Phone typing makes it the common case.'],
       qtable=True),
  dict(id='R4', title='Results start right under the bar; the keyboard’s Search key closes the keyboard', sev='High', batch='M2 Density',
       I=2, R=3, C=1.0, E=1, call=False,
       pairs=[('M-keyboard-before-android.jpg', 'M-keyboard-after-android.jpg', '“brasil” with the keyboard up. Today: 0 shows visible. After: 4.')],
       change=['Phones only: drop the 36px “query” title and the “Found N shows · Clear search” line. The count is already in the bar’s row, and the field’s × clears.',
               'Hide a lone “SHOWS N” label (keep the labels when there are several groups: Artists, Shows, Songs). Top padding 32 → 12px.',
               'On an artist’s page keep a slim “‹ All artists” row.',
               'Pressing Search/Enter on the keyboard blurs the field, so the keyboard drops and the results show. Files: <code>SearchResultsGrid.tsx</code>, <code>FilterBar.tsx</code>.'],
       why=['164px of header sits between the bar and the first card. The count appears three times (“16 shows”, “Found 16 shows”, “SHOWS 16”).',
            'With the keyboard up, which is when a phone user is searching, Rafael sees <b>no results</b> for “brasil” (16 found), and a long query wraps the title to two lines.',
            'The Search key did nothing: focus stayed in the field and the keyboard stayed up (measured). Dismissing on Search is what every phone search does.']),
  dict(id='R5', title='Back steps back through the site, not out of it', sev='High', batch='M1 Navigation',
       I=3, R=3, C=1.0, E=2, call=False, flow=True,
       change=['Add a history entry when the view changes: opening an artist, the A–Z jump, a search once typing pauses (~1 s) or on Search/Enter.',
               'Keep replacing while typing and for filter changes. Back restores the previous view and its scroll position.',
               'Files: <code>App.tsx</code>, <code>src/lib/url.ts</code>, <code>src/store/filters.ts</code> (<code>commitFilterState</code>).'],
       why=['On a phone, Back is the main navigation: the Android back button and the iPhone edge swipe. The persona: “uses the browser Back button (or the Android back gesture) to close things”.',
            'Today only an open show adds history. <b>Measured twice</b>: Rafael ran four searches, pressed Back and left the site; Dale went A–Z → Pearl Jam → Soundgarden → search → Back and left the site.',
            'The drawer already does this well (Back closes it, at the same scroll position). This extends the same model to the page.']),
  dict(id='R6', title='“All artists” returns to where you were; a letter index on the A–Z list', sev='Medium', batch='M1 Navigation',
       I=2, R=2, C=1.0, E=1, call=True,
       pairs=[('S4-10-all-artists-return-iphone.jpg', 'M-az-after-iphone.jpg', 'Today “All artists” returns to “#”. After: back at P, with a letter index to jump anywhere.')],
       change=['Remember the list’s scroll position (or the artist tapped) when an artist opens. “All artists” and Back return there, the artist briefly lit. The Artists tab still opens the list at the top.',
               '<b>Your call:</b> a letter index at the right edge on phones only, 26 letters, tap or drag, with a big letter bubble while dragging (as in iOS Contacts). You removed the letter rail on 2026-10-13 with the Artists page; on a phone the list is 19.7 screens long.',
               'Files: <code>App.tsx</code> (<code>goToDirectory</code>), <code>components/ArtistDirectory.tsx</code>.'],
       why=['Pearl Jam is 13.5 screens into the list. Dale working through his spreadsheet (J3) scrolls those 13.5 screens again after every artist.',
            'Recognition, not recall, is the list’s purpose (its own comment). A list that long on a phone needs a way to jump.']),
  dict(id='R7', title='A slim filter bar on phones: one row of controls', sev='Medium', batch='M4 Phone filters',
       I=2, R=2, C=1.0, E=2, call=False,
       pairs=[('M-bar-before-iphone.jpg', 'M-bar-after-iphone.jpg', 'Four filters on. Today the bar is 235px and shows 1 card. After: 123px and 6 cards.')],
       change=['Phones: the search field, then one 44px row: <b>[Filters 4]</b> · 34 shows · grid/list (one button) · <b>[Newest ▾]</b>.',
               'The four pills and the chip rows move into the Filters sheet (R8). Sort labels shorten on phones (“Newest”, “Oldest”, “Longest”, “Recently added”).',
               'The bar stays a constant 123px, so there is no fold to manage. Desktop is unchanged.'],
       why=['With four filters the bar is 235px; with the tab bar, <b>44% of the screen</b> is controls and one card fits. The fold saves only 46px.',
            'The chips repeat what the pills already count (“Event 2”, “More filters 1”).',
            '“More filters” is cut off at the screen edge on every phone tested and needs a sideways swipe. It holds Source and Quality, the filters traders decide by.']),
  dict(id='R8', title='Filters open as a bottom sheet on phones', sev='Medium', batch='M4 Phone filters',
       I=2, R=2, C=1.0, E=2, call=False,
       pairs=[('M-sheet-before-iphone.jpg', 'M-sheet-after-iphone.jpg', 'Today More filters runs off the bottom of the screen. After: one sheet, every filter, 44px choices, a live “Show 34 shows”.')],
       change=['One sheet (86% of the screen) with every filter in trader order:',
               '— Years: decades, From/To.',
               '— Event and Country: chosen ones as chips, plus “Add…” with type-to-filter.',
               '— Source, Quality, Standard, Length, Setlist, Added → New.',
               'Choices are 44px chips with live counts; zero-count ones dimmed, not hidden (as today). A sticky “Show N shows” button and Clear all. The drag handle, a tap outside or Back closes it.',
               'Files: a new <code>components/filters/FilterSheet.tsx</code> on the same facet data; <code>FilterBar.tsx</code> picks sheet or popovers by breakpoint.'],
       why=['Popovers are a desktop control. On the landing page More filters runs <b>64px</b> off the bottom of an iPhone 15 (79px Galaxy, 114px SE), and “New” stays below the screen edge even with the list scrolled to its end.',
            'Options are 32px rows. With the keyboard up, three Event options show.',
            'A bottom sheet is the platform pattern (iOS sheets, Material bottom sheets) and puts every choice within thumb reach. The live count keeps what already works well in the Years popover.']),
  dict(id='R9', title='Copies compared on a phone: stacked, the differences lit', sev='Medium', batch='M5 Show on phone',
       I=2, R=2, C=0.8, E=1, call=False,
       pairs=[('M-copies-before-iphone.jpg', 'M-copies-after-iphone.jpg', 'Foo Fighters, Big Day Out 2000, two copies. After: what differs at a glance (25i/25p, bitrate, LPCM/MP2, size).')],
       change=['On phones each copy is a block:',
               '— Line 1: quality · length · “This copy” / “Open ›”.',
               '— Line 2: only the specs that differ, as chips.',
               '— Line 3: “Same: …” in grey.',
               'Your call whether desktop gets the highlight too. Files: <code>ShowDrawer.tsx</code> (copies), <code>src/lib/copies.ts</code> (the difference).'],
       why=['J2, “is yours better?”, is the reason traders come. On a phone each copy’s specs wrap into a 150px column of 6–7 lines, and the differences are mid-sentence.',
            '311 records in 131 shows have copies.',
            'Confidence 0.8: the readability gain is predicted, not yet seen with a person.']),
  dict(id='R10', title='A shorter masthead on phones; none in landscape', sev='Medium', batch='M2 Density',
       I=1, R=3, C=1.0, E=1, call=False,
       pairs=[('M-landing-before-iphone.jpg', 'M-landing-after-iphone.jpg', 'First screen, iPhone 15. Today: 1 show. After (with R2, R7, R13): 4.'),
              ('M-landing-before-se.jpg', 'M-landing-after-se.jpg', 'iPhone SE: half a card → two and two halves.'),
              ('M-landscape-before-land.jpg', 'M-landscape-after-land.jpg', 'Landscape: the masthead fills the screen today.')],
       change=['Phones: masthead padding 40/32 → 18/12px, wordmark 70% → 48% of the width, tagline 14 → 11px.',
               'Phones in landscape (height under 500px): no masthead. Files: <code>HeroSearch.tsx</code>.'],
       why=['The first screen is the pitch to a trader arriving from Karl’s email. Today it shows one show on an iPhone, half on an SE, none in landscape.',
            'With R2 and R7, “All artists” moves from 5.6 screens down to 1.7.']),
  dict(id='R11', title='The docked show header is one line on phones', sev='Low', batch='M5 Show on phone',
       I=1, R=3, C=0.8, E=1, call=False,
       pairs=[('M-dock-before-iphone.jpg', 'M-dock-after-iphone.jpg', 'Reading the info file. Today the docked header takes 150px. After: 56px.')],
       change=['Docked, on a phone: the name and date on one 56px line, × at the right. The pills and place return when you scroll back up (a tap on the bar still scrolls to the top).',
               'Files: <code>styles/globals.css</code> (<code>drawer-dock-*</code>), <code>ShowDrawer.tsx</code>.'],
       why=['Docked, the header keeps two lines of place and two rows of pills: <b>150px, 23% of the screen</b>, all the way down a long setlist or info file.',
            'Traders read the NFO, in monospace, line by line. The name and date are enough to say which show this is.']),
  dict(id='R12', title='44px touch targets on phone controls', sev='Low', batch='M4 / M5',
       I=1, R=3, C=0.8, E=1, call=False,
       pairs=[('M-targets-before-iphone.jpg', 'M-targets-after-iphone.jpg', 'Red: under 44px, with the height. After R7 only the field’s × and the layout button are left.')],
       change=['Phones: a 44px touch area for every control (the drawing can stay smaller, with padding).',
               'R7 and R8 cover the bar, chips and filter options. That leaves: Share (22px), Technical details (16px), the field’s × (14px), Open full size (16px), the viewer’s dots (22px), Close, Back and the arrows (36px), the A–Z rows (36px).'],
       why=['Apple asks for 44pt and Material for 48dp. The persona is 40–60 with reading glasses.',
            'Share (22px) and the field’s × (14px) fail even WCAG 2.5.8’s 24px minimum.',
            'Confidence 0.8: measured sizes, predicted mis-taps.']),
  dict(id='R13', title='One tap to “New” on the landing page', sev='Medium', batch='M4 Phone filters',
       I=2, R=2, C=0.8, E=1, call=True,
       pairs=[('S1-06-more-filters-bottom-iphone.jpg', 'M-landing-after-iphone.jpg', 'Today “New” is the last option of More filters, below the screen. After: a “● New · 64” pill beside Filters.')],
       change=['A “● New · 64” pill beside Filters: one tap applies the New filter, sorted Recently added.',
               '<b>Your call:</b> it is a pill, not a row. Featured stays the landing’s only section, as you decided on 2026-10-29.'],
       why=['Traders arrive from your email, often about additions (J7). Today the way to them is a cut-off pill, a popover and a hidden last option, and the results still sort by year.',
            'Confidence 0.8: predicted from the persona and J7.']),
  dict(id='R14', title='The first cards’ stills load first on slow data', sev='Low', batch='M2 Density',
       I=1, R=2, C=0.5, E=1, call=False,
       change=['<code>loading="eager"</code> and <code>fetchpriority="high"</code> on the first four cards’ thumbnails; the rest stay lazy.',
               'Measure with <code>npm run perf</code> and a slow-4G run.'],
       why=['On emulated slow 4G with a 4× slower CPU: first paint 1.9s, first card still at 5.2s, 700 KB to the first screen. Rafael is often on mobile data between gigs.',
            'Confidence 0.5: emulated network; real networks vary.']),
]
for r in REC:
    r['score'] = round(r['I'] * r['R'] * r['C'] / r['E'], 1)
REC.sort(key=lambda r: (-r['score'], r['id']))

SEVORDER = {'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3}

# ─────────────────────────── Page ───────────────────────────
css = r"""
:root{--bg:#121212;--panel:#1b1b1b;--panel2:#222;--line:rgba(255,255,255,.09);--text:#e8e8e8;--muted:#a3a3a3;--dim:#8a8a8a;--ok:#4ade80;--warn:#fbbf24;--bad:#f87171;--acc:#93c5fd}
*{box-sizing:border-box}html{scroll-behavior:smooth}
a{color:var(--acc)}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.55 -apple-system,BlinkMacSystemFont,"DM Sans","Segoe UI",system-ui,sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:28px 20px 80px}
h1{font-size:30px;line-height:1.15;margin:0 0 6px;letter-spacing:-.01em}
h2{font-size:22px;margin:56px 0 14px;padding-top:12px;border-top:1px solid var(--line)}
h3{font-size:18px;margin:28px 0 8px}
.sub{color:var(--muted);margin:0 0 18px}
nav.toc{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:14px;margin:14px 0 6px}
nav.toc a{color:var(--acc);text-decoration:none}
.tldr{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin:18px 0}
.tldr p{margin:.4em 0}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:16px 0}
.kpi{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px}
.kpi b{display:block;font-size:26px;line-height:1.1;font-variant-numeric:tabular-nums}
.kpi span{color:var(--muted);font-size:13px}
.pill{display:inline-block;font-size:12px;font-weight:600;padding:2px 8px;border-radius:999px;border:1px solid currentColor;white-space:nowrap}
.ok{color:var(--ok)}.warn{color:var(--warn)}.bad{color:var(--bad)}
table{width:100%;border-collapse:collapse;font-size:14px;margin:10px 0}
th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--muted);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.06em}
td.n{font-variant-numeric:tabular-nums;white-space:nowrap}
.strip{display:flex;gap:14px;overflow-x:auto;padding:6px 2px 14px;scroll-snap-type:x proximity}
.ph{margin:0;flex:none;width:var(--w);scroll-snap-align:start}
.ph img{width:100%;display:block;border-radius:18px;border:3px solid #2c2c2c;background:#000}
.ph figcaption{font-size:13px;color:var(--muted);margin-top:8px;line-height:1.45}
.ph figcaption b{color:var(--text)}
.plabel{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin:0 0 6px;color:var(--muted)}
.plabel.ok{color:var(--ok)}.plabel.bad{color:var(--bad)}
.persona{display:grid;grid-template-columns:1fr;gap:4px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:10px 0 12px}
.persona .q{color:var(--muted);font-style:italic}
.step b.t{display:block;color:var(--text);margin-bottom:2px}
.ba{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start;margin:10px 0}
.ba .arrow{align-self:center;color:var(--dim);font-size:26px}
.rec{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:18px 20px;margin:18px 0}
.rec h3{margin:0 0 6px;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.rec .meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:13px;color:var(--muted);margin-bottom:8px}
.score{font-variant-numeric:tabular-nums;background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:2px 8px;color:var(--text)}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:18px}
@media (max-width:820px){.cols{grid-template-columns:1fr}}
.cols h4{margin:12px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.cols ul{margin:0;padding-left:18px}.cols li{margin:4px 0}
code{font:12.5px ui-monospace,SFMono-Regular,Menlo,monospace;background:#262626;padding:1px 5px;border-radius:4px;color:#e5e7eb}
.pick{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.pick button{font:inherit;font-size:14px;cursor:pointer;padding:8px 14px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text)}
.pick button.on{background:#fff;color:#111;border-color:#fff}
.call{color:var(--warn);font-weight:600}
.flow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:8px 0}
.flow .node{width:120px;text-align:center;font-size:12px;color:var(--muted)}
.flow .node img{width:120px;border-radius:12px;border:2px solid #2c2c2c;display:block;margin-bottom:4px}
.flow .ar{font-size:13px;color:var(--muted);text-align:center;width:70px}
.flow .ar.b{color:var(--bad)}.flow .ar.g{color:var(--ok)}
.export{position:sticky;bottom:12px;display:flex;justify-content:flex-end;gap:10px;margin-top:30px}
.export button{font:inherit;font-weight:600;cursor:pointer;padding:12px 18px;border-radius:12px;border:0;background:#fff;color:#111;box-shadow:0 8px 24px rgba(0,0,0,.5)}
.export span{align-self:center;color:var(--muted);font-size:13px;background:var(--bg);padding:4px 8px;border-radius:8px}
.note{font-size:13px;color:var(--muted)}
.batch td:first-child{white-space:nowrap;font-weight:600}
"""

def kpi(n, t): return f'<div class="kpi"><b>{n}</b><span>{t}</span></div>'

parts = []
parts.append(f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mobile Audit — The Vault</title><style>{css}</style></head><body><div class="wrap">
<h1>The Vault on a trader’s phone</h1>
<p class="sub">Mobile UX audit · 2026-11-08 · the live site (<code>1bc1aa5b</code>) · five trader personas, five phone tasks · 115 screenshots, 31 searches, 14 recommendations</p>
<nav class="toc"><a href="#tldr">Bottom line</a><a href="#together">All changes together</a><a href="#scen">The five walkthroughs</a><a href="#findings">Findings</a><a href="#recs">Recommendations</a><a href="#order">Order of work</a><a href="#keep">What works</a><a href="#limits">Limits</a><a href="#method">Method</a></nav>
''')

# Bottom line
v = {s['id']: VERDICT[s['verdict']] for s in SCEN}
parts.append('<div class="tldr" id="tldr"><h3 style="margin-top:0">Bottom line</h3>'
  '<p><b>On a phone the site works, but it shows a trader one show at a time and loses his place.</b> Every phone narrower than 400px, which includes every standard iPhone and the Galaxy S line, gets one card per screen. An artist opened from the A–Z list starts at the wrong end of its shows. Back leaves the site after any search. With filters on, nearly half the screen is controls.</p>'
  '<p>The show itself is in good shape on a phone. Links open the exact recording, Back closes it in place, sharing hands over a one-line reference, and the empty state names the filter to blame.</p>'
  '<p><b>Biggest wins, in order:</b> fix the A–Z jump (R1, minutes); two columns on every phone (R2, one line of code: 1 → 4–6 shows per screen); initials that work beside other words (R3); results that start under the bar and above the keyboard (R4); Back that steps back through the site (R5).</p>'
  '<table><tr><th>Scenario</th><th>Persona · phone</th><th>Job</th><th>Today</th></tr>' +
  ''.join(f'<tr><td><a href="#{s["id"]}">{s["id"]}</a></td><td>{e(s["who"])} · {e(s["dev"])}</td><td>{e(s["job"])}</td><td><span class="pill {v[s["id"]][1]}">{v[s["id"]][0]}</span></td></tr>' for s in SCEN) +
  '</table></div>')

parts.append('<div class="kpis">' +
  kpi('1 card', 'per screen on a standard iPhone or Galaxy. 4 with two columns, 6 with R4 too.') +
  kpi('10.8 → 2.9', 'screens to scroll Pearl Jam’s 24 shows, today vs proposed (iPhone 15)') +
  kpi('44% → 27%', 'of the screen taken by the bar and tab bar with four filters on') +
  kpi('0 of 8', 'initials-plus-word searches that find anything (“ratm swu”, “fnm bizarre 97”)') +
  kpi('Back = exit', 'after any search or artist page; only an open show adds history') +
  kpi('150 → 56px', 'docked show header while reading the setlist or info file') +
  '</div>')

# All together
parts.append('<h2 id="together">All changes together</h2><p class="note">The same four moments, today and with the recommendations applied. Every “after” is the live page restyled in the test browser; no code was changed. Tap an image for full size.</p>')
pairs = [('M-landing-before-iphone.jpg', 'M-landing-after-iphone.jpg', 'Arriving', '1 show', '4 shows'),
         ('M-keyboard-before-android.jpg', 'M-keyboard-after-android.jpg', 'Searching, keyboard up', '0 shows', '4 shows'),
         ('M-azjump-before-iphone.jpg', 'M-tiles-after2-iphone.jpg', 'An artist from the A–Z list', 'last 2 shows', 'first 6 shows'),
         ('M-bar-before-iphone.jpg', 'M-bar-after-iphone.jpg', 'Four filters on', '1 show', '6 shows')]
parts.append('<h3>Today</h3><div class="strip">' + ''.join(phone(b, t, f'{t}: <b>{nb}</b> in view', 'bad', 220) for b, a, t, nb, na in pairs) + '</div>')
parts.append('<h3>Proposed</h3><div class="strip">' + ''.join(phone(a, t, f'{t}: <b>{na}</b> in view', 'ok', 220) for b, a, t, nb, na in pairs) + '</div>')

# Scenarios
parts.append('<h2 id="scen">The five walkthroughs</h2><p class="note">Each persona from <code>docs/ux-research/02-participants.md</code>, on a phone, doing what traders do on phones: quick checks and replies, started from a message. Screens are the area a person sees (the screen minus Safari’s or Chrome’s bars). The quotes are illustrative, not real people.</p>')
for s in SCEN:
    vv = VERDICT[s['verdict']]
    parts.append(f'<h3 id="{s["id"]}">{s["id"]} · {e(s["who"])}, {s["age"]}, {e(s["where"])} <span class="pill {vv[1]}">{vv[0]}</span></h3>')
    parts.append(f'<div class="persona"><div><b>Phone:</b> {e(s["dev"])} · <b>Job:</b> {e(s["job"])}</div><div><b>Trigger:</b> {e(s["trig"])}</div><div class="q">{e(s["quote"])}</div></div>')
    parts.append('<div class="strip">' + ''.join(phone(f, '', f'<span class="step"><b class="t">{i+1}. {e(t)}</b>{c}</span>', '', 230) for i, (f, t, c) in enumerate(s['steps'])) + '</div>')
    parts.append(f'<p><b>Outcome:</b> {s["outcome"]}</p>')

# Findings
FIND = [
  ('Critical', 'An artist opened from the A–Z list lands at the bottom of its shows', 'S4', 'R1'),
  ('High', 'One card per screen on every phone under 400px wide (most phones)', 'S1, S2, S4, S5', 'R2'),
  ('High', 'Initials plus any other word find nothing (“ratm swu”, “fnm bizarre 97”, “qotsa reading”)', 'S2', 'R3'),
  ('High', 'Results hidden behind the keyboard: 164px of header before the first card; Search key keeps the keyboard up', 'S2', 'R4'),
  ('High', 'Back leaves the site after any search, artist or A–Z jump', 'S2, S4', 'R5'),
  ('Medium', '“All artists” returns to the top of a 19.7-screen list, not to where you were', 'S4', 'R6'),
  ('Medium', 'Controls take 44% of the screen with four filters; the fold saves 46px; “More filters” cut off', 'S5, S1', 'R7'),
  ('Medium', 'More filters runs 64–114px off the bottom of the screen; “New” unreachable at first; 32px options', 'S1, S5', 'R8, R13'),
  ('Medium', 'Copies’ specs squeezed into a 150px column; differences buried', 'S3', 'R9'),
  ('Medium', 'First screen: 1 show (iPhone), ½ (SE), none in landscape; artist list 5.6 screens down', 'S1', 'R10'),
  ('Low', 'Docked show header 150px (23% of the screen) while reading', 'S3', 'R11'),
  ('Low', 'Touch targets under 44px: Share 22px, field × 14px, chips 28px, pills 34px', 'all', 'R12'),
  ('Low', 'First card’s still at 5.2s on slow 4G (first paint 1.9s)', 'S2', 'R14'),
]
parts.append('<h2 id="findings">Findings by severity</h2><p class="note">Critical blocks a trader job. High leads to a wrong conclusion or a big detour. Medium slows people down. Low is polish.</p><table><tr><th>Severity</th><th>Finding</th><th>Seen in</th><th>Fix</th></tr>' +
  ''.join(f'<tr><td><span class="pill {"bad" if s in ("Critical","High") else "warn" if s=="Medium" else ""}">{s}</span></td><td>{e(t)}</td><td>{sc}</td><td>{r}</td></tr>' for s, t, sc, r in FIND) + '</table>')

# Recommendations
parts.append('''<h2 id="recs">Recommendations, ranked</h2>
<p class="note">Scored like the October report, so they slot into the same tracker. <b>Score = Impact × Reach × Confidence ÷ Effort.</b></p>
<ul class="note">
<li><b>Impact:</b> 3 = a job fails · 2 = wrong conclusion or big detour · 1 = friction.</li>
<li><b>Reach:</b> 3 = every phone visit · 2 = a common task · 1 = an edge case.</li>
<li><b>Confidence:</b> 1.0 = seen or measured here · 0.8 = predicted from the persona · 0.5 = judgement.</li>
<li><b>Effort:</b> 1 = under half a day · 2 = one to three days.</li>
</ul>
<p class="note">Pick <b>A</b> (keep today) or <b>B</b> (make the change) on each; “Copy for Claude Code” at the bottom gives me your picks.</p>''')
parts.append('<table><tr><th>#</th><th>Recommendation</th><th>I</th><th>R</th><th>C</th><th>E</th><th>Score</th></tr>' +
  ''.join(f'<tr><td><a href="#{r["id"]}">{r["id"]}</a></td><td>{e(r["title"])}{" <span class=call>· your call</span>" if r["call"] else ""}</td><td class=n>{r["I"]}</td><td class=n>{r["R"]}</td><td class=n>{r["C"]}</td><td class=n>{r["E"]}</td><td class=n><b>{r["score"]}</b></td></tr>' for r in REC) + '</table>')

for i, r in enumerate(REC, 1):
    sevc = 'bad' if r['sev'] in ('Critical', 'High') else 'warn' if r['sev'] == 'Medium' else ''
    parts.append(f'<div class="rec" id="{r["id"]}"><h3>{i}. {r["id"]} · {e(r["title"])}</h3>'
                 f'<div class="meta"><span class="pill {sevc}">{r["sev"]}</span><span class="score">Score {r["score"]} = {r["I"]} × {r["R"]} × {r["C"]} ÷ {r["E"]}</span><span>Confidence {r["C"]}</span><span>Batch {e(r["batch"])}</span>{"<span class=call>Your call</span>" if r["call"] else ""}</div>')
    for b, a, cap in r.get('pairs', []):
        parts.append(f'<div class="ba">{phone(b, "Today", "", "bad", 250)}<div class="arrow">→</div>{phone(a, "Proposed", "", "ok", 250)}<p class="note" style="max-width:300px;align-self:center">{cap}</p></div>')
    if r.get('extra'):
        parts.append('<div class="ba">' + ''.join(phone(f, t, c, tone, 200) for f, t, c, tone in r['extra']) + '</div>')
    if r.get('table'):
        parts.append('<table style="max-width:640px"><tr><th>Phone</th><th>Cards today</th><th>Two columns</th><th>+ R4</th><th>Screens for Pearl Jam</th></tr>' + ''.join(f'<tr>{"".join(f"<td class=n>{c}</td>" for c in row)}</tr>' for row in r['table']) + '</table>')
    if r.get('qtable'):
        rows = [('ratm swu', 'rage swu'), ('ratm 2010', 'rage 2010'), ('fnm bizarre', 'faith no more bizarre 1997'), ('fnm bizarre 97', 'faith no more bizarre 1997'), ('qotsa reading', 'queens of the stone age reading'), ('stp unplugged', 'stone temple pilots unplugged'), ('30stm rar', '(full name + rock am ring 2010)'), ('ratm brasil', '(rage + brasil)')]
        qd = {x['q']: x['count'] for x in Q}
        full = {'rage swu': '2 shows', 'rage 2010': '3 shows', 'faith no more bizarre 1997': '2 shows', 'queens of the stone age reading': '2 shows', 'stone temple pilots unplugged': '7 shows'}
        parts.append('<table style="max-width:640px"><tr><th>Typed on the phone</th><th>Today</th><th>Same with the full name</th></tr>' + ''.join(f'<tr><td><code>{e(a)}</code></td><td class="n bad">{e(qd.get(a, "0 shows"))}</td><td><code>{e(b)}</code> {e(full.get(b, ""))}</td></tr>' for a, b in rows) + '</table>')
    if r.get('flow'):
        parts.append('<p class="note" style="margin-bottom:4px"><b>Today</b>: Back works only for an open show</p><div class="flow">'
          f'<div class="node"><img src="{S}S1-01-first-screen-iphone.jpg">Landing</div><div class="ar">→</div>'
          f'<div class="node"><img src="{S}S4-01-artists-tab-iphone.jpg">A–Z list</div><div class="ar">→</div>'
          f'<div class="node"><img src="{S}M-azjump-after-iphone.jpg">Pearl Jam</div><div class="ar">→</div>'
          f'<div class="node"><img src="{S}S4-06-card-open-iphone.jpg">A show</div>'
          '<div class="ar g">Back ✓<br>closes the show</div><div class="ar b">Back again ✗<br>leaves the site</div></div>'
          '<p class="note" style="margin:14px 0 4px"><b>Proposed</b>: Back retraces the steps</p><div class="flow">'
          f'<div class="node"><img src="{S}S4-06-card-open-iphone.jpg">A show</div><div class="ar g">← Back</div>'
          f'<div class="node"><img src="{S}M-azjump-after-iphone.jpg">Pearl Jam, same place</div><div class="ar g">← Back</div>'
          f'<div class="node"><img src="{S}M-az-after-iphone.jpg">A–Z list, at P</div><div class="ar g">← Back</div>'
          f'<div class="node"><img src="{S}S1-01-first-screen-iphone.jpg">Landing</div><div class="ar">← Back<br>leaves</div></div>')
    parts.append('<div class="cols"><div><h4>What changes, exactly</h4><ul>' + ''.join(f'<li>{c}</li>' for c in r['change']) + '</ul></div>'
                 '<div><h4>Why</h4><ul>' + ''.join(f'<li>{w}</li>' for w in r['why']) + '</ul></div></div>')
    parts.append(f'<div class="pick" data-id="{r["id"]}"><button data-v="A">A · keep today</button><button data-v="B">B · make the change</button><button data-v="?">Discuss</button></div></div>')

# Order of work
parts.append('''<h2 id="order">Order of work</h2><p class="note">Items that touch the same code ship together, so each area is opened, tested and measured once. A batch’s place comes from its best score.</p>
<table class="batch"><tr><th>Batch</th><th>Items</th><th>What</th><th>Why together</th></tr>
<tr><td>M1 Navigation</td><td>R1, R6, R5</td><td>The A–Z jump lands at the top (minutes); “All artists” returns to your place; then Back through the site</td><td>All in App.tsx’s view and scroll handling; one set of history tests</td></tr>
<tr><td>M2 Density</td><td>R2, R4, R10, R14</td><td>Two columns; results under the bar; shorter masthead; first stills first</td><td>All change what fits on the first screen; one <code>npm run perf</code> run covers them</td></tr>
<tr><td>M3 Search</td><td>R3</td><td>Initials beside other words</td><td>Search index and its precision tests</td></tr>
<tr><td>M4 Phone filters</td><td>R7, R8, R13, R12 (bar)</td><td>One control row, the filter sheet, the New pill, 44px targets</td><td>The filter bar on phones, rebuilt once</td></tr>
<tr><td>M5 Show on phone</td><td>R9, R11, R12 (drawer)</td><td>Copies with differences lit; one-line docked header; drawer targets</td><td>The drawer; one drawer timing run</td></tr></table>
<p class="note">Before starting, I would bring the October tracker (<code>docs/ux-research/05-findings-report.md</code>) up to date with these as M-findings, as with F1–F18.</p>''')

# Keep
parts.append('''<h2 id="keep">What works on a phone — keep it</h2><ul>
<li><b>Links open the exact recording</b>, and the per-show page previews it in chats. × and Back close it; Back lands at the same scroll position (6,477 → 6,477).</li>
<li><b>Share</b> hands the phone’s share sheet a one-line reference (“Foo Fighters · 2000-01-16 · Big Day Out · SD 576 · 1h 10m”) and the show’s own link.</li>
<li><b>The tab bar</b>: labelled, under the thumb; Search focuses the field and raises the keyboard in one tap.</li>
<li><b>Search understands traders</b>: <code>24.05.96</code>, <code>16/01/00</code>, <code>brasil</code>, <code>multishow</code>, <code>channel v</code>, <code>glasto 2009</code> all work.</li>
<li><b>The empty state</b> names the filters to blame and offers “Show 22 without the filters”.</li>
<li><b>Honest dates</b>: “2001 (date unknown)” in the drawer.</li>
<li><b>Holds at 125% text</b>, with no sideways scrolling at any size tested (312–750px).</li>
<li><b>16px search field</b>: iOS does not zoom on focus.</li>
<li><b>The list view</b>: 8 dense, readable rows per screen. A good answer for completists today.</li>
<li><b>Speed</b>: first paint 1.9s on slow 4G with a 4× slower CPU; about 700 KB to the first screen.</li></ul>''')

# Limits
parts.append('''<h2 id="limits">Limits — what to check on a real phone</h2>
<p>This was scripted Chromium with phone emulation (touch, 2× pixels, mobile browser, the visible area after the browser’s bars), not people and not real devices. The persona reactions are predicted. Five things only a real phone can confirm, about two minutes each:</p>
<ol>
<li>iPhone Safari: tap an artist in the A–Z list. Does it also land at the bottom (R1)?</li>
<li>iPhone Safari: the edge-swipe back after a search. Does it leave the site (R5)?</li>
<li>The real keyboard: how many results show above it after typing “brasil” (R4)?</li>
<li>More filters on the landing page: can you reach “New” at all (R8, R13)?</li>
<li>Pinch-zoom on a still in the viewer: does it zoom (not tested; emulation can’t pinch)?</li>
</ol>''')

# Method
parts.append('''<h2 id="method">Method</h2><ul class="note">
<li>Live site, <code>main</code> = <code>origin/main</code> at <code>1bc1aa5b</code>, 2026-11-08.</li>
<li>Playwright (scratch install, not in the project) driving the Chromium already on this Mac, with mobile emulation.</li>
<li>Visible areas:
<ul>
<li>iPhone 15: 390×664 (852 minus status bar and Safari).</li>
<li>Galaxy S23: 360×660.</li>
<li>iPhone SE: 375×553.</li>
<li>Pro Max: 430×752.</li>
<li>125% text: 312×531.</li>
<li>Landscape: 750×340.</li>
</ul></li>
<li>The keyboard is drawn over the screen at its real height.</li>
<li>Each step logged a screenshot plus measurements: cards in view, the bar’s and tab bar’s height, controls under 44px, text sizes, sideways overflow, scroll positions.</li>
<li>31 trader searches on the Galaxy (full list in <code>~/VaultShots/reports/mobile-audit/queries.json</code>).</li>
<li>Slow 4G: 1.6 Mb/s, 150 ms latency, CPU 4× slower; two runs.</li>
<li>Every “Proposed” picture is the live page restyled in the test browser only. No file in the project was changed.</li>
<li>Personas: <code>docs/ux-research/01–02</code>. Scoring: <code>05-findings-report.md</code>.</li>
</ul>''')

parts.append('''<div class="export"><span id="cnt">0 of 14 picked</span><button id="copy">Copy for Claude Code</button></div>
<script>
const KEY='vault-mobile-audit-2026-11-08';let picks={};try{picks=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
function paint(){document.querySelectorAll('.pick').forEach(p=>{p.querySelectorAll('button').forEach(b=>b.classList.toggle('on',picks[p.dataset.id]===b.dataset.v))});document.getElementById('cnt').textContent=Object.keys(picks).length+' of 14 picked'}
document.querySelectorAll('.pick button').forEach(b=>b.addEventListener('click',()=>{const id=b.parentElement.dataset.id;picks[id]=picks[id]===b.dataset.v?undefined:b.dataset.v;if(!picks[id])delete picks[id];try{localStorage.setItem(KEY,JSON.stringify(picks))}catch(e){}paint()}));
document.getElementById('copy').addEventListener('click',async()=>{const ids=[...document.querySelectorAll('.pick')].map(p=>p.dataset.id);const lines=ids.map(id=>{const t=document.getElementById(id).querySelector('h3').textContent.replace(/^\\d+\\. /,'');return `${id} ${picks[id]||'-'}  ${t}`});const txt='MOBILE AUDIT PICKS (2026-11-08)\\nA = keep today, B = make the change, ? = discuss, - = not picked\\n'+lines.join('\\n');try{await navigator.clipboard.writeText(txt);document.getElementById('copy').textContent='Copied'}catch(e){prompt('Copy this:',txt)}setTimeout(()=>document.getElementById('copy').textContent='Copy for Claude Code',1800)});
paint();
</script></div></body></html>''')

OUT.write_text('\n'.join(parts), encoding='utf-8')
print('wrote', OUT, len('\n'.join(parts)) // 1024, 'KB')

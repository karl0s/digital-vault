# Swiping the stills (2026-11-13)

A follow-up to the mobile audit: swipe between screenshots in the show drawer's image viewer on a
touch screen. The story is in [07-mobile-case-study.md](../../../07-mobile-case-study.md#follow-up-2026-11-13-swiping-the-stills),
the design in [docs/frontend.md](../../../../frontend.md) (In-drawer screenshots and image viewer),
the code in `src/hooks/useSwipePager.ts` (commit `9a67fa5c`). Nothing in the site or its checks
runs anything here.

| Folder | What |
|---|---|
| `report/` | The page shown to the owner (`viewer-swipe.html`) and its real-time recording (`swipe.mp4`, 7.5 s, iPhone size): next by drag, next by flick, a change of mind that stays, two flicks back, the rubber band |
| `shots/` | `base-*` the viewer before the change, `final-*` after (at rest: pixel-identical on the phone, the same rectangle on desktop); the phone mid-swipe and at the rubber band; the recording's contact sheet |
| `data/` | `final-phone-results.json` (19 touch checks), `final-desktop-results.json` (2 mouse checks), the still's geometry before and after, and the drawer benchmark (`npm run perf -- --quick`) twice before and twice after |

## Scripts

Raw Chrome DevTools Protocol over a WebSocket, Playwright's headless Chromium from
`~/Library/Caches/ms-playwright/`, an iPhone's 390×844 with touch emulation and real touch events
(`Input.dispatchTouchEvent`). They open show `c90f6de6dd8b`.

| File | What it did |
|---|---|
| `swipe-test.mjs` | The test suite: `node swipe-test.mjs <baseUrl> <outDir> [desktop]` |
| `record.mjs` | The recording (`Page.startScreencast`) |
| `probe.mjs`–`probe4.mjs` | A mid-drag screenshot showed the still where the DOM said it wasn't: its position step by step, styling variants, waits, frame by frame |
| `probe5.mjs`–`probe7.mjs` | The cause, from an event log: taking a screenshot makes Chromium's touch emulation send a `pointermove` at the touch's first position, and the strip followed it. A test artefact, not a bug, so the pictures were recorded as a screencast instead |
| `probe8.mjs` | Landscape (the side drawer), a second finger mid-swipe, and pinch-zoom |

The base URL is a served build, for example `npm run build && npx vite preview --port 4402`, then
`http://localhost:4402/digital-vault/`.

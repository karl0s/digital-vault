# Mobile audit scripts (2026-11-08)

Kept as the record of how the audit and the build were measured
([06-mobile-audit.md](../../../06-mobile-audit.md), [07-mobile-case-study.md](../../../07-mobile-case-study.md)).
Nothing in the site or its checks runs them.

| File | What it did |
|---|---|
| `lib.mjs` | Phones (viewports after the browser's bars), launch, measurements, the drawn keyboard, screenshots. `BASE` env points it at another server |
| `scenarios.mjs` | The five scenarios, S1–S5, step by step |
| `mock.mjs` | The proposed fixes drawn on the live page, before and after |
| `queries.mjs`, `queries2.mjs` | The search battery (initials, dates, places) |
| `verify-artist.mjs`, `verify2.mjs`, `checkreport.mjs`, `smoke.mjs` | Checks of single findings and of the report page |
| `impl-check.mjs` | The build measured on phones and desktop against the live site |
| `drawer-measure.mjs`, `drawer-long.mjs`, `drawer-debug.mjs` | The show drawer's docking and copies, phone and desktop |
| `dbg-back.mjs` | The frame-by-frame trace that found the 92px Back offset |
| `build_report.py`, `build_built.py` | The two HTML pages in `../report/` |

To run again: `npm install` here (playwright-core), then for example
`BASE=http://localhost:5173/digital-vault/ node impl-check.mjs`. They expect Playwright's headless
Chromium in `~/Library/Caches/ms-playwright/` and write to `~/VaultShots/reports/mobile-audit/`.

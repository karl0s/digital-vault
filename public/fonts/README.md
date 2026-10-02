# Self-hosted fonts

Declared in `index.html` (`@font-face`, inline). Latin and latin-ext subsets only — the
same files Google Fonts serves a current browser, downloaded unmodified. Nothing in the
catalogue's displayed text needs another subset (checked 2026-10-02).

| File | Font | Used for | Source |
|---|---|---|---|
| `bebas-neue-latin*.woff2` | Bebas Neue 400 | display headings (`--font-display`) | Google Fonts |
| `dm-sans-latin*.woff2` | DM Sans, variable 300–700 + optical size | body text (`--font-body`) | Google Fonts, `dmsans/v17` |
| `archivo-700-latin*.woff2` | Archivo 700 | the wordmark only (`HalationLogo.tsx`) | Google Fonts, `archivo/v25` |

All three are licensed under the SIL Open Font License 1.1 (https://openfontlicense.org),
which permits self-hosting and redistribution.

To add a weight or subset: request the stylesheet from `fonts.googleapis.com/css2` with a
current Chrome user agent, download the `woff2` URLs it lists, and copy each block's
`unicode-range` into `index.html` unchanged.

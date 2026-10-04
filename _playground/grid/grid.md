# Grid Playground — Reference & Progress Notes

## Goal
Experiment with card layouts, filter chip styles, and other grid-level UI patterns
for the show browser. Isolated from the live app so visual ideas can be explored
without risk of breaking production.

---

## Versions

| File | Description |
|---|---|
| `v1-floating-glass-chip.tsx` | Frosted glass pill style for filter/quick-search chips — `bg-white/8`, `backdrop-blur-md`, `border-white/10`, soft shadow |

---

## Key Decisions / Techniques

### v1 — Floating Glass Chip
Explores a glassmorphism treatment for the quick-search pills that used to sit on the hero
section. Those pills were removed in the Browse redesign (live 2026-10-05); the experiment is
kept as a reference for pill styling.

Key properties:
- `bg-white/8 border border-white/10` — semi-transparent fill with hairline border
- `backdrop-blur-md` — frosted glass blur on content behind the chip
- `shadow-[0_2px_12px_rgba(0,0,0,0.4)]` — subtle depth lift
- Hover state: `bg-white/14 hover:border-white/20` — brightens slightly without a hard jump
- `rounded-full` — pill shape to distinguish from card/grid elements

Status: proof-of-concept only, never extracted to the live app. The nearest live pills are flat
rather than glass: the facet triggers in `components/filters/FacetPopover.tsx`
(`rounded-full border border-white/8 bg-white/5`, brightening to `bg-white/10` when active) and
the removable filter chips in `components/filters/FilterBar.tsx` (`rounded-full bg-white/10`).
Neither uses `backdrop-blur` — the filter bar behind them already does.

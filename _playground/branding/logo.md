# Logo Playground — Reference & Progress Notes

## Goal
Experiment with a new "THE VAULT" logo treatment inspired by a halation/chromatic blur effect
seen in a reference image (word: BLUR, dark background, purple/cyan radial glow).

---

## Typeface Decision
**Archivo** weight 700 (Google Fonts, free, CDN) — final choice for v4+.
- Heavy, wide, sharp square terminals — no rounding
- The reference image BLUR letterforms LOOK rounded only because the glow/blur softens them
- The underlying font is hard-edged; rounding is an artifact of the effect, not the typeface
- Rejected: Nunito Black (too rounded), VAG Rounded (too rounded), Archivo Black (too heavy at large sizes — switched to Archivo weight 700)
- Google Fonts URL: `https://fonts.googleapis.com/css2?family=Archivo:wght@700;800;900&display=swap`

---

## Reference Image Analysis

### Effect Vocabulary

| Term | What it means here |
|---|---|
| **Halation** | Light bleeding beyond the letterform edge, as if overexposed film |
| **Chromatic aberration** | Colour channels diverging — purple and cyan split to different positions |
| **Irradiation** | White visually swelling beyond its true boundary (optical illusion + blur) |
| **Film bleed** | Emulsion-era term for colour spreading into adjacent areas |
| **Bloom** | The soft luminous spread of a bright light source |
| **Colour fringe** | The visible coloured edge produced by chromatic aberration |
| **Radial aberration** | Aberration that points away from the image centre — stronger at edges |
| **Screen composite** | Additive blend mode — layers add light, never darken |
| **One-sided smear** | Asymmetric blur that trails in one direction only (not symmetric Gaussian) |

### Per-Letter Radial Effect — Key Insight
The effect is NOT applied globally. It behaves like **radial lens chromatic aberration**:
- **Left-side letters**: colour fringe and smear push **downward** (below baseline)
- **Right-side letters**: colour fringe and smear push **upward** (above cap line)
- **Centre letters**: effect tapers — weakest glow, least offset
- This creates a diagonal arc of colour across the word, not a flat uniform glow
- Intensity scales with distance from centre — edges are strongest

### Layer Structure (v5)

| Layer | Colour | Technique | Blend | Role |
|---|---|---|---|---|
| 1 | Purple `#9333ea` | feGaussianBlur + feOffset per letter | Screen | Wide outer bloom, radial offset |
| 2 | Cyan `#06b6d4` | feGaussianBlur + feOffset per letter | Screen | Chromatic fringe, directional offset |
| 3 | White | feGaussianBlur + feOffset + feComponentTransfer | Screen | Irradiation — bleed beyond edge (opacity-controlled) |
| 4 | White | Vertical gaussian + radial feOffset | Screen | One-sided vertical smear per letter |
| 5 | White | Elliptical gaussian (H >> V) | Screen | Horizontal taper blur (strong at edges, zero at centre) |
| 6 | White | SourceGraphic | Screen | Sharp luminous core letterform |
| Global | — | CSS `filter: blur()` on SVG element | — | Uniform overall softening |

---

## Implementation — SVG Filter Approach

### Why SVG filters
- `feGaussianBlur` operates on text alpha directly — no box bleed
- `feBlend mode="screen"` composites layers additively (bright on dark)
- `feOffset` enables per-layer directional push
- `feFlood` + `feComposite in2="SourceAlpha" operator="in"` flood-fills only the letter shape
- Applied per `<text>` element — enables per-letter filter variation
- No external dependencies, vector, scales perfectly

### Character positioning
Use SVG DOM `getStartPositionOfChar(i)` on a hidden measurement `<text>` element after
`document.fonts.ready`. Returns exact per-character x positions accounting for font metrics
and letter-spacing. Each character is then rendered as its own filtered `<text>` element
at its measured x position with its own unique filter ID.

### Normalised position formula
```
visibleChars = chars excluding spaces
mid = (N - 1) / 2          // where N = count of visible chars
t = (visibleIndex - mid) / mid    // −1 to +1
absT = Math.abs(t)                // 0 at centre, 1 at edges
```

### Per-letter value formulas (v5)
```
cyanDy          = −t × maxCyanOffset           // directional fringe offset
purpleBlur      = minBlur + absT × (maxBlur − minBlur)
cyanBlur        = minBlur + absT × (maxBlur − minBlur)
irradiation     = 4 + absT × (irradiationMax − 4)
irradDx/Dy      = t × irradOffset, −t × irradOffset   // radial direction
smearBlur       = absT × maxLetterBlur         // vertical smear magnitude
smearDy         = −t × maxLetterBlur           // vertical smear direction
hBlur           = absT × maxHBlur              // horizontal taper blur magnitude
```

---

## One-Sided Vertical Smear (key technique)

**Problem with feGaussianBlur alone:** standard Gaussian blur spreads equally in all directions.
Shifting with feOffset just moves the blur — it doesn't make it one-sided.

**Solution:** vertical-only Gaussian blur + directional offset equal to blur radius.
The offset shifts the blurred cloud so one side lands outside the letter and the other extends beyond it.

```
feGaussianBlur in="SourceAlpha" stdDeviation="smearBlur*0.4  smearBlur"
feOffset dy=smearDy
feComposite in="whiteFlood" in2="shifted" operator="in"  → white one-sided smear
```

- `stdDeviation="0.4*N  N"` — elliptical: mostly vertical, some horizontal to soften side edges
- `smearDy = −t × maxLetterBlur` — same direction as the radial glow
- Left letters (t<0): smearDy positive → smear trails **below**
- Right letters (t>0): smearDy negative → smear trails **above**
- Centre letters: smearBlur = 0, smearDy = 0 → no effect

**Why not feConvolveMatrix:** a 9-row convolution kernel is 9px at 130px font = 7% of letter height.
Visually imperceptible. The vertical gaussian + offset approach creates ~3σ of visible trail.

---

## Horizontal Taper Blur (key technique)

Adds a horizontal "spreading" effect: letters at the word edges appear to bleed left/right,
centre letters stay crisp.

```
feGaussianBlur in="SourceAlpha" stdDeviation="hBlur  hBlur*0.6"
feComposite in="whiteFlood" in2="h-blur" operator="in"  → white elliptical smear
```

- `stdDeviation="H  H*0.6"` — elliptical: primarily horizontal, 60% as much vertical
  - Without vertical component: sharp horizontal clip at top/bottom letter edges
  - 0.6 ratio gives ~22px vertical fade at default settings — clearly soft
- `hBlur = absT × maxHBlur` — zero at centre, max at edges
- Effect is symmetric left/right (no feOffset) — expands the letter horizontally
- Stacked above the vertical smear and below SourceGraphic in blend chain

---

## Global CSS Blur

**Problem with SVG group filter:** when children already have individual filters, a parent `<g>`
filter cannot correctly capture the full extent of child filter outputs. Attempting
`filterUnits="userSpaceOnUse"` with large absolute bounds still clips.

**Solution:** CSS `filter: blur(Npx)` applied directly to the `<svg>` element.
CSS blur runs post-render on the full composited pixel output — bypasses SVG filter
region constraints entirely. Applied after all per-letter SVG filters are resolved.

```tsx
<svg style={{ filter: ctrl.globalBlur > 0 ? `blur(${ctrl.globalBlur}px)` : undefined }}>
```

Slider range: 0–3 in 0.1 steps. Values above ~1.5 become quite soft.

---

## Irradiation Opacity (key technique)

The white irradiation layer can be dialled from invisible (0) to full (100) independently
of all other layers using `feComponentTransfer`:

```
feGaussianBlur in="SourceAlpha" → feOffset → feComposite(white flood) → irrad-raw
feComponentTransfer in="irrad-raw":
  feFuncA type="linear" slope={irradOpacity / 100}
→ irrad (opacity-scaled)
```

This scales only the alpha of the irradiation result without affecting any other layer.

---

## Filter Blend Chain (v5, per letter)

```
purple bloom (pb)
cyan fringe (cb)
irradiation with opacity (irrad)
vertical directional smear (letter-smear)
horizontal taper blur (h-smear)
SourceGraphic (sharp white letter)

screen(pb, cb)            → colors
screen(colors, irrad)     → glow-base
screen(glow-base, letter-smear) → with-vsmear
screen(with-vsmear, h-smear)    → with-hsmear
screen(with-hsmear, SourceGraphic) → output
```

Screen blend is additive on dark backgrounds — layers only ever brighten, never darken.
SourceGraphic last ensures the sharp white letterform always dominates.

---

## V5 Locked Defaults

```ts
maxPurpleBlur:  18    // purple bloom radius at word edges
minPurpleBlur:  3     // purple bloom radius at word centre
maxPurpleOffset: 45   // purple vertical offset at word edges
maxCyanOffset:  9     // cyan vertical offset at word edges
maxCyanBlur:    17    // cyan blur radius at word edges
minCyanBlur:    0     // cyan blur at word centre (sharp fringe at centre)
irradiationMax: 12    // white irradiation blur at word edges
irradOffset:    9     // radial irradiation direction magnitude
irradOpacity:   46    // irradiation layer opacity (0–100)
maxLetterBlur:  8     // vertical smear magnitude at word edges
maxHBlur:       11    // horizontal taper blur magnitude at word edges
globalBlur:     1     // CSS blur applied to entire SVG output
purpleColor:    '#9333ea'
cyanColor:      '#06b6d4'
```

---

## SVG Canvas Constants (playground)

```ts
TEXT     = 'THE VAULT'
FS       = 130          // font size in SVG user units
VW       = 1060         // viewBox width
VH       = 300          // viewBox height
BASELINE = 210          // text baseline y position
letterSpacing = -2      // SVG letterSpacing attribute
fontWeight    = 700     // Archivo weight
```

These are tuned for the playground canvas. When extracting to the live site nav,
all dimensional values (FS, VW, VH, BASELINE) and filter effect magnitudes must be
rescaled proportionally. The `t`/`absT` position formulas are dimensionless and carry over unchanged.

---

## Filter Region Bounds

Per-letter filter: `x="-300%" y="-600%" width="700%" height="1300%"`
These are generous enough to contain purple bloom (offset ±45), cyan (offset ±9),
and irradiation (offset ±9) at maximum values without clipping.
If effect magnitudes increase significantly beyond current defaults, these may need expanding.

---

## Live Site Integration — Implemented

**File:** `components/logos/HalationLogo.tsx`
**Font:** Archivo weight 700 added to `index.html` Google Fonts link (preloaded, no flash)

### Scaling approach
The SVG coordinate space stays fixed at `1060×300` with all effect values unchanged.
CSS `width` and `height` attributes on the SVG element control rendered size — the SVG
renderer scales everything proportionally (font size, blur radii, offsets).
Only the CSS-space global blur needs explicit scaling: `D.globalBlur * scale`.

**Props:**
- `scale?: number` — `1` = playground size (130px letters). `~0.19` for nav.
- `style?: React.CSSProperties` — overrides SVG element style (e.g. `width:'100%'` for responsive hero use)
- `className?: string`

**Filter IDs** namespaced as `hl-glow-0…7` to avoid collision with playground components.
**Opacity fade** — SVG renders at `opacity: 0` until `document.fonts.ready` resolves + character
positions are measured, then fades to `opacity: 1` over 0.15s. Imperceptible once Archivo is cached.

### Usage in TopNav
```tsx
<HalationLogo scale={0.19} />
// scale=0.19 → letters ~25px CSS, SVG box 201×57px
// Glows overflow nav height via overflow:visible — intentional
```

### Usage in HeroSearch (landing page)
```tsx
<HalationLogo scale={1} style={{ width: '70%', height: 'auto' }} />
// width:'70%' overrides the fixed CSS width from scale
// height:'auto' derives from viewBox aspect ratio (1060:300)
// Wrapped in motion.div for entry fade+slide animation
// Container is max-w-5xl — logo fills 70% of that
```

### Swapping logos in future
All logo variants live in `components/logos/`. To swap: change the import in `TopNav.tsx`
and/or `HeroSearch.tsx`. No other files need touching.

---

## Versions

| File | Description |
|---|---|
| `v1-logo.tsx` | Font comparison scaffold (Bebas Neue vs Archivo Black) |
| `v2-halation-svg.tsx` | Global SVG filter on whole word, single filter, live controls |
| `v3-halation-per-letter.tsx` | Per-letter radial aberration, symmetric Gaussian letterform blur |
| `v4-halation-per-letter.tsx` | Added one-sided vertical smear (feGaussianBlur+feOffset), horizontal taper blur, global CSS blur, irrad opacity |
| `v5-halation-per-letter.tsx` | **Current best** — v4 with tuned defaults, horizontal blur vertical ratio raised to 0.6 for soft top/bottom edges |

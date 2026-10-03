# The Vault — Claude Project Guide

## What this project is
A personal archive and browser for a private collection of concert video recordings.
Live site: https://karl0s.github.io/digital-vault/

The frontend is a React/Vite SPA. All show data lives in a flat JSON file (`public/shows.json`).
Images are static files served from `public/images/`. There is no backend.

---

## Repository layout

```
public/
  shows.json            ← master show data (source of truth)
  image-manifest.json   ← maps checksum → available image slot indices
  images/               ← {checksum}_01.jpg … _04.jpg per show
  images/temp-images/   ← staging folder for new images (should always be empty after a task)

dist/                   ← BUILD OUTPUT — never commit this, CI owns it
components/             ← React components
  CloseButton.tsx       ← shared close button (semi-transparent style) — use this for ALL close buttons
src/hooks/              ← custom React hooks
data-pipeline/          ← numbered Python scripts for scanning hard drives → CSV → shows.json
scripts/
  health-check.py       ← integrity validator (runs automatically as pre-push hook)
  check-perf.mjs        ← front-end performance guard rails (npm run check:perf)
  perf/bench.mjs        ← measures Browse + drawer in headless Chromium (npm run perf)
  thumbs.mjs            ← card thumbnails, built into dist/thumbs/ by vite-plugin-thumbs.mjs
  site-data.mjs         ← shows-lite.json + show-notes.json, derived from shows.json at build
_playground/            ← isolated UI experiments, never imported by the live app
  branding/             ← logo and typographic effect experiments
  grid/                 ← card layout and filter chip experiments
```

---

## Playground

`_playground/` is a sandbox for UI experiments. Each subdirectory is a topic area.
Experiments are routed automatically via `import.meta.glob` + `React.lazy` in `PlaygroundRouter.tsx`.

**Dev only — the playground never ships.** `main.tsx` gates the router behind
`import.meta.env.DEV` and loads it with a dynamic `import()`. Vite substitutes a
literal `false` for that flag in a production build, so Rollup drops the branch
and the glob with it: `dist/` contains no playground code at all.

Two consequences worth knowing:
- Run experiments with `npm run dev` and visit `/playground`. They are
  unreachable in a preview or deployed build by design.
- Keep the import dynamic and inside the `if`. A top-level
  `import { PlaygroundRouter } from './PlaygroundRouter'` is unconditional and
  bundles every experiment back into `dist/` regardless of the DEV check.

### Rules
- Every playground subfolder **must** have exactly one MD file named after the folder (e.g. `branding/logo.md`, `grid/grid.md`).
- The MD file covers **all** TSX variants in the folder — not just v1. Update it as new variants are added.
- MD filename must not include a version number. The versions table inside the file tracks individual variants.
- TSX files are named `v{N}-{slug}.tsx` (e.g. `v3-halation-per-letter.tsx`). The MD file is just `{topic}.md`.

### MD file structure (required sections)
```
# {Topic} Playground — Reference & Progress Notes

## Goal
One paragraph: what is being explored and why.

## Versions
| File | Description |
|---|---|
| `v1-...tsx` | What this version tried |
| `v2-...tsx` | What changed |
...

## Key Decisions / Techniques
Document non-obvious choices: rejected approaches, why a technique was chosen,
known constraints. Enough context that future work can pick up without re-deriving.

## Live Site Integration  ← only if extracted to the real app
File path, props, usage examples.
```

Additional sections (effect vocabulary, locked defaults, filter chains, etc.) are added
as needed when complexity warrants it. Follow the depth of `branding/logo.md` as a reference.

---

## Deployment

- **GitHub Actions** (`.github/workflows/deploy.yml`) runs `npm run build` on every push to `main`
- Vite copies everything from `public/` into `dist/` at build time
- The built `dist/` is deployed to GitHub Pages — **never manually commit `dist/`**
- `dist/` is already in `.gitignore` and should stay that way

---

## The data model

### What the site loads (derived at build time)
`public/shows.json` is the source of truth and still deploys untouched, but the site does
not load it. Every build (and `npm run dev`) derives two files from it —
`scripts/site-data.mjs`, wired in by `vite-plugin-site-data.mjs`:

- `shows-lite.json` — every record minus `Notes` and the pipeline-only fields in
  `DROPPED` (`FolderPath`, `RepVideoFiles`, `Lineage`, `LastScannedAt`, …). Loaded first:
  534 → 131 KB gzipped.
- `show-notes.json` — `{ ShowID: Notes }`, loaded straight after.

Nothing to do when editing `shows.json`; the derived files follow it. Two rules for code:
**read Notes only through `getNotes`** from `useShows` (show objects on the site carry no
`Notes`), and **before displaying a field, check it is not in `DROPPED`** — if it is,
remove it from the list, or it will be blank on the live site. `npm run check:perf`
fails on either mistake. If the derived files are ever missing, the site falls back to
the full `shows.json`.

### shows.json
Flat JSON array of show objects. Key fields:

| Field | Type | Notes |
|---|---|---|
| `ShowID` | 12-char hex string | Unique identifier |
| `Artist` | string | Must match exactly (used for grouping) |
| `ShowDate` | `YYYY-MM-DD` or `""` | Empty = undated; sorts to end of results |
| `EventOrFestival` | string | Festival/event name e.g. "Glastonbury", "MTV Unplugged" |
| `VenueName` | string | Physical venue name — not the festival name |
| `City` | string | |
| `Country` | string | |
| `RecordingType` | string | "Proshot", "Soundboard", "Audience": how it was **filmed**. Never "Documentary"; the health check rejects it |
| `ContentType` | `"Documentary"` or absent | What the record **is**. Absent = a live show. Drives the sidebar's Live / Documentaries filter, the card badge and the drawer pill. See *Documentaries* below |
| `ChecksumSHA1` | 40-char hex string | SHA1 of the source file; used as image key |
| `Notes` | string | Free text; temp checksum stubs have "TEMP CHECKSUM - update when files are scanned" here |
| `Hidden` | `"Yes"` or absent | Keeps the record in `shows.json` but off the site — filtered once in `src/hooks/useShows.ts`. For two records of one recording where only one should show; set `DuplicateOf` to the shown record and say why in `Notes`. Do **not** reuse `DuplicateOf` alone to hide: Jay-Z and Jack White carry it and are meant to show |
| `ParentShowID` | ShowID or absent | Set on a record cut from a multi-artist **master** recording (a festival broadcast, a talk-show compilation). The drawer shows a "Part of …" link to the master; the master's drawer lists every record pointing at it under "On this recording". One level only; the master must not be hidden. Checked by the health check |
| `SegmentStart` / `SegmentEnd` | `H:MM:SS` | Where that linked record sits on the master's timeline. Always set together with `ParentShowID` |

### Documentaries — `ContentType`

**The owner's rule: a record is a Documentary when half or more of its runtime is people
talking or narration over footage.** Standalone interviews, making-of, behind-the-scenes, MTV
Cribs-style shows, rockumentaries and TV biographies count. Storytellers, Unplugged and concert
films with backstage inserts do not. Judge it from the footage, never from the title: the Vines
titleset named "VTS_04 - documentary" is three-quarters live performance, and Foo Fighters MSG
2008's Notes claimed "about half interviews" when a full sweep found almost none.

The first full pass ran on 2026-10-04: every record's stills read blind, every folder name
checked against each artist's known documentaries, and a 48-frame sweep across the whole
programme for every borderline record. The owner decided all 87 candidates on a review page.
29 records are Documentary. Each changed record says why in `Notes` under `CONTENT TYPE (2026-10-04)`.
Before that pass, "Documentary" lived in `RecordingType` on 15 records, and 11 of them were
concerts (Rockpalast, Haldern, Weezer *Across the Sea*).

Set `ContentType` whenever a new record is created, the VA-master and screenshot procedures
included. To measure a borderline programme, use the read-only sweep tool, which samples MPEG
streams by byte position so broken DVD timestamps cannot misplace a frame:

```bash
python3 ~/VaultShots/doc_sweep.py <ShowID> [<ShowID> ...]   # contact sheets in ~/VaultShots/doc_sweeps/
```

Count the frames that are talking, interviews, archive or behind-the-scenes against the
performance frames. With 48 frames the estimate is about ±7%, so put anything between roughly
42% and 58% to the owner.

Four pieces of documentary footage have no record **by the owner's choice** (2026-10-04, "not
important"). Do not propose them again: the Cornell WDR interview (VTS_01 of the Audioslave `rar/`
disc), the interviews in VTS_03 of `Kings of Leon - BDO 2006 and 2004`, and the making-of (VTS_03)
and EPK (VTS_04) in `Supergrass - Pinkpop Festival Dutch TV 1997`.

### ShowDate rules
- Format is always `YYYY-MM-DD` or empty string `""`
- Compilations, documentaries, TV shows with no specific date → set to `""`
- When only year is known, use `YYYY-01-01` as a placeholder
- Shows with empty or non-date ShowDate sort to the **end** of all result lists
- Never use placeholder strings like `"0000-00-00"` or `"Compilation"`

### image-manifest.json
Maps `ChecksumSHA1 → [1, 2, 3, 4]` (array of available slot indices).
Only slots listed here are served — if a slot isn't in the array, the image is assumed missing.

---

## Image conventions

- Images are named `{ChecksumSHA1}_01.jpg`, `_02.jpg`, `_03.jpg`, `_04.jpg`
- Only `.jpg` format
- Up to 4 images per show; slot 1 is the primary (shown on cards)
- **All slots within a show must share identical pixel dimensions**
- When adding/replacing images:
  1. Copy new files to `public/images/` with correct `{checksum}_0{n}.jpg` name
  2. Update `public/image-manifest.json` to reflect the new set of indices
  3. **Never** leave files in `public/images/temp-images/` — clean it up every task

### Card thumbnails — build output, never committed

Cards do not load the originals. Every build makes a 640px-wide WebP of each slot-1
image (`scripts/thumbs.mjs`, run by the Vite plugin in `vite.config.ts`) and ships it as
`dist/thumbs/{checksum}_01.webp`. A card is at most ~580 real pixels wide even on a 3×
phone, so the thumbnail carries more detail than any card shows; it is encoded at WebP
quality 90 with sharp-YUV chroma. Originals are untouched and still serve the drawer
header and the image viewer.

- **Nothing to do when images change.** Thumbnails are regenerated from `public/images/`
  by content hash on the next build (or `npm run dev`); replaced images get new ones,
  removed ones are dropped. The images workflow above is unchanged.
- **Never commit them, never put them in `public/`.** They live in
  `node_modules/.cache/vault-thumbs/` (and the deploy's Actions cache), where
  `git add -f public/` cannot reach them.
- **A missing thumbnail is not an error.** The card falls back to the original, so a
  fresh `npm run dev` looks the same while it builds them in the background (~80 s for
  ~1,170 the first time, then incremental).
- Only slot 1 has a thumbnail; `getImageUrl(checksum, 1, 'thumb')` gives its URL.

### Image geometry — display shape, not stored shape

DVD and broadcast pixels are not square. An image written at the source's raw
`Width`×`Height` is **squashed** — 720×576 PAL displays as 4:3 or 16:9, never as its stored
1.25 ratio. The correct output is derived from the sample aspect ratio.

**Rule: reach the display shape by growing the under-sampled axis. Never downscale, and
never upscale past native just to make two shows match.** Sizes legitimately differ by
broadcast standard; what must be exact is the aspect ratio.

| Source | Standard | Display | Correct output |
|---|---|---|---|
| 720×576 | PAL | 4:3 | 768×576 |
| 720×576 | PAL | 16:9 | 1024×576 |
| 720×480 | NTSC | 4:3 | 720×540 |
| 720×480 | NTSC | 16:9 | 854×480 |
| 704×480 | NTSC | 4:3 | 704×528 |
| 1440×1080 | — | 16:9 | 1920×1080 |
| 1280×720 / 1920×1080 | — | 16:9 | unchanged |

Audit the whole collection at any time — read-only, changes nothing:

```bash
python3 scripts/audit-image-geometry.py                     # images vs record
python3 scripts/audit-image-geometry.py --artist "Nirvana"  # detail for one artist
python3 scripts/audit-aspect-vs-source.py --artist "Nirvana"   # record vs SOURCE
```

The two audits answer different questions. The first compares the **images** to the
**record** — it catches squashed stills. The second compares the **record** to the
**source on the drive** — it catches records that are themselves wrong, which the first
cannot, because when the record is wrong the images agree with it and the check passes.

**A show's recorded `AspectRatio` is frequently wrong.** Discs declare 4:3 when the
broadcast was 16:9, and letterboxed or pillarboxed material is recorded as though the
black bars were part of the picture. Where a correction is discovered during capture,
write it back to the record in the same session — use the two-part form
`4:3 (letterboxed 16:9)`, frame ratio first and true picture ratio second — and put the
evidence in `Notes`.

As of 2026-09-27: **74.5% of shows correct, 19.1% squashed, 2.6% undersized, 1.6%
internally inconsistent, 1.8% letterboxed and needing a crop decision.** The bad majority predates the capture pipeline. Fully corrected so
far: 30 Seconds to Mars, Aerosmith, Alanis Morissette, Alice in Chains, Audioslave, Beastie Boys, Ben Harper, Black Keys, Blink-182, Bush, Chris
Cornell, Faith No More, Filter, Foo Fighters, Green Day, Guns N' Roses, Incubus, Jane's Addiction,
Killers, Kings of Leon, Lenny Kravitz, Limp Bizkit, Manic Street Preachers, Muse, Nirvana, Oasis, Pearl Jam, Queens of the Stone Age, R.E.M.,
Radiohead, Rage Against the Machine, Red Hot Chili Peppers, Silverchair, Smashing Pumpkins,
Soundgarden, Stereophonics, Stone Temple Pilots, Supergrass, The Offspring, The Strokes, Them Crooked
Vultures, Tool, Velvet Revolver, Verve (and the Spiritualized set on its Glastonbury disc) and Weezer. A few residual flags remain on finished artists (Foo
Fighters 2; Filter, Kings of Leon, Nirvana and Radiohead 1 each). 30STM's "Late Show" record
`e814e4732ab9` was another band entirely: on 2026-10-02 it was re-filed, with the owner's agreement, as
Nickel Creek under the Late Night #6 2005 master, of whose VTS_14 it is a byte-identical copy.

**Look at a record's CURRENT stills before trusting its identity.** On 30STM, three records were
showing the wrong thing on the live site and no audit could say so: a "Kooks" record showing 30STM
(it held the wrong titleset's hash), a "Last Call" record showing Carson Daly's other guests (keyed
to the wrong titleset of a VA compilation), and a "Late Show" record whose only image was a black
frame, over footage of a different band on a different talk show. Geometry audits pass all three.
Everything else is outstanding — `python3 scripts/audit-image-geometry.py` ranks it worst first.

Two Smashing Pumpkins records (`d9b007dd78f2`, `32fafc677477`) can never be corrected: they point
at a nested folder that no longer exists on the drive, so their stills cannot be re-taken.

The capture pass is also the most reliable way this collection finds its own gaps: it has
turned up shows with **no record at all**, records holding **another band's setlist**, records
whose **dimensions disagree with the disc**, and several folders holding **two shows**. It has
also turned up a record stating the folder held **none of the artist's footage** when the disc
in fact carried their own episode in 1 of 16 titlesets.

**A "no footage here" conclusion needs the same evidence as a positive one.** On discs whose
containers report bad timestamps, sampling can appear to cover two hours while actually
covering seconds — so absence looks identical to a failed scan. Re-check before excluding.

### A record can cover one titleset while its name describes another

Check both, and check where the images come from. One record named `MTV Studios` covered only
its 7th titleset — a different concert. Another, dated for a 1993 TV appearance, drew every
screenshot from the 1992 appearance sitting alongside it on the same disc. Both look correct in
a review montage, because every frame is real footage of the right band. Sum the titleset
runtimes and confirm each pick's timestamp falls inside the titleset the record covers.

### Compilation discs: one wanted segment among many

The mirror of the problem below. `<artist> - MTV Cribs 2002 + Others` holds 16 titlesets,
~120 min, of which one 6.7-min segment is the band. Sweep **each titleset separately** —
concatenating them for identification is what caused this disc to be written off as containing
no Incubus at all. `Notes` on such a record should name the other programmes so the
identification is never repeated.

### Split bills: one record per band, per tape

Two MusiquePlus tapes (2000-11-14) were filed as `Artist` = `Incubus / Deftones`. An exact-match
filter on either band returned nothing, so they were invisible to both artists' runs *and* to
search on the live site. On 2026-09-30 the owner settled how split bills are filed: **each tape
becomes one record per band**, time-windowed to that band's performance only, each with its own
setlist. The two tapes are now four records (Incubus `34f2923f1e57`, `6aa691481fa9`; Deftones
`d4081bb1afc6`, `70dabb713576`). The joint interview between the sets belongs to neither. The disc
hash stays on the Incubus record and the Deftones record carries a derived key, as on the
Bush / James Brown Woodstock disc.

No joined artist names remain. Before calling an artist finished, still check for one:

```bash
python3 -c "
import json
a='Incubus'
for s in json.load(open('public/shows.json')):
    art=s.get('Artist') or ''
    if a.lower() in art.lower() and art != a: print(s['ShowID'], repr(art))
"
```

Split a new one only where the bands' sets are separable in time, and confirm with the owner first.

### A nested folder can hold a SECOND COMPLETE DISC, not just another titleset

`R.E.M. - T in the Park, 2008-07-13 + Oxegen 2008` held two full `VIDEO_TS` trees: the show
in the root, and an entirely different concert in a subfolder. The scan writes one row per
folder, so the Oxegen disc had **no record at all** — and the surviving row had T in the Park's
date with Oxegen's event, venue, city and lineage, because whoever wrote it read the nested
disc's sidecar.

This is not the §10b titleset case and the usual tools do not catch it:

- `find_multishow.py` scores titlesets inside ONE `VIDEO_TS`; two sibling trees look like one disc.
- `pick_source` in `shots.py` deliberately never recurses, so the parent unit captures only the
  root disc and the nested one is invisible to the whole pipeline.
- Both discs here are `VTS_01`, so a `vts` split cannot separate them either.

The discriminator is the **directory**. `data/splits.json` now takes a `subdir` key for this.
Keep the subdir readable in the unit's `rel` — squashing it to alphanumerics broke
`data/overrides.json`, which is keyed by path fragment, and the nested disc captured with its
letterbox bars still in frame.

**`promote.py --propose-map` mapped BOTH split units to the SAME record.** It matches on name,
and the two units share a folder name. Always build `data/promote_map.json` from each state
entry's `ShowID`, and assert the values are unique before applying — a name-derived map would
have put one concert's stills on the other's record.

### A sidecar's LINE-UP block gets imported as data — into three different fields

Queens of the Stone Age had the same sidecar section land in two records, two different ways:

| Record | Field | Value it was given | Where it came from |
|---|---|---|---|
| `8e8d56e0a5f7` | `EventOrFestival` | `Nick Oliveri` | the 2nd name in `Lineup:` |
| `8e8d56e0a5f7` | `VenueName` | `bass, lead vocals` | that name's instrument credit |
| `cdd7abcd3d24` | `Setlist` | `Complete show; Josh Homme; Joey Castillo; …` | the whole `Line up :` block as tracks |

This is the same class as the Alanis "Friesland" case (an uploader's home town read as the city) —
**the importer took whatever line sat where it expected a value.** The tell is a field holding a
person's name, an instrument, or a role.

```bash
# Fields holding something that looks like an instrument credit rather than a place
python3 -c "
import json, re
for s in json.load(open('public/shows.json')):
    for k in ('VenueName','EventOrFestival','City'):
        v = (s.get(k) or '')
        if re.search(r'(?i)\b(vocals|guitar|bass|drums|keyboards|backing)\b', v):
            print(s['ShowID'], s['Artist'], k, repr(v))
"
```

Read the whole sidecar before trusting any field derived from it, and check the **first and last
three** setlist entries (already the rule) — a line-up block sits at the top or the bottom.

### A circle test can lie — check the aspect against a known-good source instead

Austin City Limits 2009 declares 4:3 (720x480, SAR 8:9) and is internally consistent, so no gate
catches it. It is really 16:9: the sidecar's lineage is `HD Broadcast>SD Standalone DVD XP`, a
widescreen broadcast squeezed into a 4:3 frame by a recorder that writes a 4:3 flag whatever it is
fed. There are no letterbox bars, so nothing looks wrong until you look at a face.

**The drum-head circle test got this backwards.** A kit shot from the side is foreshortened
horizontally, so its head reads as *too wide* at any aspect and the frame "passes" as 4:3. Only use
a circle that is square-on to the camera, and prefer a defocused point light, which is always round.

**The reliable test is a person's head against a source whose geometry is beyond doubt** — a
square-pixel HD capture of the same performer, ideally from the same era. Render the disputed frame
at both shapes and compare. At 4:3 this one's face was visibly narrow and elongated; at 16:9 it
matched the 1920x1080 Storytellers capture exactly. Found only because the collection owner said a
show "looks squished" — after an automated check had cleared it.

### A 4:3 flag with no bars on a post-2000 broadcast can be a squeezed 16:9

Six Stereophonics sources (Headliners ×2, Re:covered, Later 2003, Glastonbury 2002, Move 2004 —
UK TV, 2002–2004) were 720x576 SAR 16:15 with the picture filling the frame: a self-consistent
4:3 flag on what was really anamorphic 16:9 squeezed by an off-air recorder. No gate can see it
— the flags agree, and there are no bars — and a face compared across the hero montage cleared
all six. The collection owner caught them.

`python3 ~/VaultShots/aspect_ab.py` lists every 4:3-flagged, bar-free, post-2000 source and
renders each hero at both shapes on one page. **Most of those are genuinely 4:3** (the same
artist's WDR, SF2 and SIC broadcasts were), so the page goes to the owner with the picks page,
before promotion. Details and the fix recipe: `concert-screenshots` skill §4.4.

### Point lights do NOT measure the aspect of an SD source — tested, and it fails

The idea is sound on paper: a defocused point light is circular on screen, so its stored-pixel
height/width is the sample aspect ratio. In practice, on SD broadcast material, it reads close to
square whatever the truth is. Tested on 2026-09-27 against Chris Cornell's Rock am Ring 2009 PAL DVD,
a true anamorphic 16:9 source that should read **1.422**:

| Method | Reading on the 16:9 control |
|---|---|
| bounding-box h/w, four different frame samplings | 1.000, 1.000, 0.909, 1.000 |
| the same, only blobs ≥ 60 px / ≥ 120 px | 0.900 / 1.364 |
| intensity-weighted second moments (sub-pixel) | 1.101, 1.106 |

Every one of those would call a 16:9 disc **4:3**. The same code reads exactly 1.000 on square-pixel
1920×1080 — which is why the flaw went unseen: **a control whose answer is 1.0 cannot reveal a bias
toward 1.0.** Always control a measurement with a source of the geometry you are trying to detect.
This is also the Stereophonics failure (Glasgow 2007, true 16:9, read 1.11).

Consequences:
- Silverchair's Melbourne Park 1999 "0.92, decisive" agreed with the owner only because the method
  reads ~1 on everything SD. The 4:3 verdict stands on the owner's eye, not on that number.
- Do not quote a point-light number as evidence in `Notes`, `overrides.json` or `aspect_confirmed.json`.

What does work: the owner's A/B (`aspect_ab.py`); a source of the **same performer and era** at an
undisputed aspect; a rigid designed graphic (a channel bug, a festival logo) shared with a source of
known geometry; and structural evidence such as two independent captures sharing one framing (next
section). A channel logo can still be misread by eye: the square Channel [V] box was called "square
at 16:9" when it is square at 4:3 — measure its box, do not look at it.

### A letterbox inside a 16:9-FLAGGED frame, and a container SAR that is simply invented

Limp Bizkit's Rock am Ring 2009 existed twice: an MKV flagged SAR 247:176 (displays at 2.06:1) and a
DVD flagged 16:9 whose picture sits in rows 44–529 behind digital-black bars — displaying at 2.11:1.
Neither audit caught the DVD: cropdetect and the letterbox checks only look for bars in 4:3 frames,
and "16:9 flag, 16:9 record" agreed. The tell was the scout: the MKV's geometry came back UNKNOWN
(an empty `AspectRatio` and a SAR no standard produces), and probing it led to the DVD.

What settled it was **structure, not measurement.** Frame-matching the two (64×36 grey thumbnails,
normalised, bars cropped from the DVD) put them at a constant 36.5 s offset with identical framing —
but only the DVD carries a Rock am Ring logo bug, so they are independent captures, and two captures
sharing one framing means neither is a crop. Other broadcasts of the festival are full-frame 16:9.
The DVD's whole frame is therefore 3:2 (16:9 picture × 576/486) — captured at 864×576 with the bars
kept, `AspectRatio: "3:2"`, via a `showid`-scoped `dar` override.

Check a 16:9-flagged DVD for bars the same way as a 4:3 one, and treat a non-standard container SAR
(anything not 1:1, 8:9, 10:11, 16:15, 32:27, 40:33, 16:11, 64:45, 4:3) as unexplained until proven.

Where a disc's own VOBs declare **different** aspects, pin the answer in `overrides.json` even when
the default happens to be right — VOB sort order is not evidence.

### cropdetect cannot see a VHS letterbox — measure rows instead

`cropdetect` reported **FULL FRAME** on Supergrass's MTV Five Night Stand across 1,026 unanimous
samples, and on the Köln VIVA disc across 3,486. Both are letterboxed. The bars come off a VHS or
off-air master and sit at luminance **8–20, never 0**, which no cropdetect threshold separates from
a dark picture.

A per-row luminance profile settles it in one decode — but take it from the **brightest** frames
only. An auto threshold over all frames reads a dark stage as bar and invents letterboxes: on the
same run it "found" 2.0:1 on three sources that are full-frame.

```python
frames.sort(key=lambda r: -mean(r))          # brightest third only
m = [mean(c) for c in zip(*frames[:len(frames)//3])]
```

**One disc can mix both.** MTV Five Night Stand letterboxes its concert and fills the frame for its
interview segments, which is why cropdetect, a row profile and a rendered frame all disagreed with
each other until the frames were looked at. A per-source crop is wrong for such a disc.

### The two-part `AspectRatio` form means the IMAGES ARE CROPPED

`parse_dar` returns the **second** ratio for a string containing "letterboxed", so
`audit-image-geometry.py` then expects the stills to *be* that shape. Writing `4:3 (letterboxed 16:9)`
while capturing the whole frame makes the audit report every one of that show's images as wrong.
When the owner asks to keep the bars, leave `AspectRatio` as the frame ratio and put the measured
letterbox rows in `Notes`.

### A letterbox is not necessarily 16:9 — measure it

Two Eurockéennes discs, same taper, same DVD recorder, same channel, both 4:3 PAL with the
Europe 2 TV logo burned into the upper bar. The 2005 disc's picture is rows 72-503 = 432 rows,
which is exactly 16:9. **The 2007 disc's is rows 56-519 = 464 rows, which is 1.66 — nearer 5:3.**
The letterbox is symmetric about the frame centre on both, so neither is a mis-crop.

Assuming 16:9 would have thrown away 32 rows of real picture. Record what it measures, using the
two-part form (`4:3 (letterboxed 5:3)`), and put the row numbers in `Notes`.

### A seek can land in the OTHER show — `Woodstock 1994 + 1999`

One continuous stream holds two broadcasts, and its container timestamps are not monotonic across
the join. The '94 window's seek path "succeeded" on 430 of 500 grabs — valid, distinct, correctly
sized — and ~200 of them were the '99 festival. Every yield and distinctness gate passed; the
broadcaster bug in the corner (circle-V vs RTL 5) is what showed it. The single decode pass
counts frames and was correct at the same indices. A split entry can now pin
`"decode": "single"` to skip seeking. **On any time-window split of a two-show stream, check the
bug or the staging across the whole unit, not just its first and last frames.**

Same artist, three smaller traps: ten folders are named `RHCP …`, which shares no token with the
name (an `rhcp` alias now catches them — the QOTSA case again); a record can be claimed for an
artist only through `splits.json` (Rolling Stone 25's one RHCP chapter), which discovery now
honours; and a folder shared by two artists now plans only the current artist's split part.

### An artist filed without its article returns ZERO records, silently — `Killers`

The Killers are filed as `Artist` = `Killers`. `scout.sh "The Killers"` printed a clean report of
`0 records` with every section empty — no error, no hint — while five shows sat under the shorter
name. Before any run, confirm the stored spelling:

```bash
python3 -c "
import json; a='killers'
print({s['Artist'] for s in json.load(open('public/shows.json')) if a in (s.get('Artist') or '').lower()})"
```

### A record captured once can still have NO saved capture rule — re-picks fail

The 2026-09-29 tier-2 hero review re-picked 107 already-captured shows and 20 of them would not plan:
their split or disc mapping had been done by hand at first capture and never written to
`~/VaultShots/data/splits.json`. Two-disc sets (`Disc 1/`, `Disc 2/`), time-window splits, a
Blu-ray `BDMV/STREAM/` folder, a folder renamed on the drive (`DVD-Offspring-LiveWembley2001` →
`Offspring - Live Wembley 2001`) and a drive-side typo (`Columbus OH 1009-5-28`) all dropped out
silently in a plain artist run. Prove each by re-hashing `RepVideoFiles`, then save the rule.

For a subset of shows across artists, `~/VaultShots/plan_subset.py --label L --ids ids.json` plans only
the listed ShowIDs and **refuses** if any produces no unit; run it with `set -o pipefail` so the
capture never starts on a refused plan.

### A folder can glue the artist's name to the date — `stereophonics2003-06-07dvd`

That tokenises to `{stereophonics2003, 06, 07dvd}`: no token equals `stereophonics`, so `plan`
reported `ready: 28  skipped: 0` for 29 records and the Rock am Ring 2003 disc was never captured.
`shots.py` now accepts the squashed artist name followed **only by digits**; checked across all
168 artists, it changes exactly that one match. The count check (folders found vs records) is
what caught it — run it every time.

### Five "FOTTP" discs held eighteen programmes

Stereophonics' fan compilations `FOTTP 1/2/4/7/10` were five records for **eighteen titlesets,
each a separate programme** (festival sets, *Later*, *Headliners*, *Re:covered*, talk shows, two
documentaries). Every existing record had the disc's whole sidecar pasted in as its Setlist, and
one (`f4445e77f8e6`) described *Later* 2002 while its checksum is Rock am Ring 2003. Now one
record per titleset, each keyed by a real content hash over that titleset's `VTS_NN_0..n.VOB`.

### An artist name of single letters matched EVERY folder on the drive

`toks("R.E.M.")` splits to `{r, e, m}`, all discarded by the `len > 1` filter, leaving the
artist's token set **empty**. `need` is `min(2, len(artist_toks))`, so it fell to 0 and the
`>= need` test passed for everything: `plan` reported **144 shows ready** for a nine-show artist
and flagged nothing. Fixed in `shots.py` by collapsing dotted initialisms to one token
(`r.e.m.` → `rem`, `n.e.r.d` → `nerd`) so artist and folder names meet, plus a guard that
refuses to match anything when a name yields no usable token.

The general lesson: **a matcher that silently widens is more dangerous than one that fails.**
The file already documented the opposite failure (too-strict matching dropping shows in
silence); this is the same bug with the sign flipped, and only R.E.M. exposed it.

### A prior session's "appears around X" is a GUESS unless it names its evidence

The Eurockéennes 1997 record's `Notes` said "Supergrass appear around 45-62 min". That window holds
two entirely different bands. The same note's Radiohead claim was exact — `'Radiohead (UK)' is first
visible at frame 16,950` — because it cited the disc's burned-in title card.

Read the evidence, not the conclusion. The Supergrass card turned out to be at frames 63,304-63,400
(35:12-35:15), and their segment is 34:51-42:28 — 7m38s, two songs, nowhere near the stated window.

**A twelve-song setlist cannot describe a seven-minute segment.** That record also carried a
twelve-song list described as "the SUPERGRASS segment's setlist"; it is the festival set from
somewhere else. Check a setlist's length against the runtime before trusting what it is attached to.

### One folder can hold more than one show

Several folders contain two or more concerts, and the scan records only one row per folder —
so the other show has no record and cannot appear on the site at all. Sometimes the surviving
row describes the *wrong* one. Detect before capturing:

```bash
python3 ~/VaultShots/find_multishow.py --artist "Nirvana"
```

**Read every sidecar it reports** (`info.txt`, `*.nfo`, `*.md5`). They are written by whoever
made the disc and have so far revealed a two-show disc, a three-programme disc, a wrong date,
a source lineage and two full setlists — before decoding a single frame. Roughly **20 folders
collection-wide** are genuine candidates. Full procedure in the `concert-screenshots` skill,
§10b.

**After merging, deleting or re-keying any record, check for images that now belong to no
record.** `promote.py` compares the manifest against files on disk in both directions and passes
happily when an orphaned pair agrees with itself; it never checks the manifest against
`shows.json`. `python3 scripts/audit-image-geometry.py` reports these as `no show record`.

**Run `python3 ~/VaultShots/preflight.py --artist "<name>"` before capturing.** One read-only
pass reports records with no checksum, duplicate groups whose metadata disagrees, loose media at
the drive root, folders holding more than one titleset, and durations that imply an impossible
bitrate. On Kings of Leon it found twelve multi-titleset folders and three loose root files.

**Assume a multi-titleset folder is several shows.** In one artist, twelve folders held more than
one programme — including a disc named for one festival that held three, and a "Big Day Out"
master whose titlesets were Jet, then Kings of Leon, then Muse.

**Image A is always a close-up of the lead singer.** The scorer picks the sharpest close-up
but has no idea who is in it, and lead guitarists get more close-ups on many broadcasts. Check
the heroes as one montage across all of an artist's shows before handing over. Where a source
genuinely has no close-up (distant audience recordings), use the best wide with the singer
centre stage and say so.

**Hand-pick all four slots, on every artist.** The hero gate guards slot A only, and the other
three are where commercials, title cards, credit rolls, channel idents and other bands land — they
are the highest-contrast, quietest-background frames a programme contains, so they lead the
shortlist on any source. Supergrass flagged **zero** of its 18 shows as dark and still needed 14 of
18 heroes and 16 of 54 other slots replaced; one slot held a **Manic Street Preachers** title card.
Read `reports/review.jpg` once for the whole artist — ~6k vision tokens — before handing anything over.

**The bassist singing backing vocals is the hero trap that actually bites.** A mouth-open close-up
of a *backing* singer at his own mic is indistinguishable from a hero frame by composition — it
passed a 420px identity check on Supergrass's Glastonbury 2004 and the collection owner caught it.
Before writing slot A, name one physical feature that separates the frontman from every other
member and check for it specifically (for Gaz Coombes: sideburns down the jaw). Hair colour is not
that feature — under stage light two members read the same shade.

**Reviewing costs more than capturing.** One full-size contact sheet is ~6,000 vision tokens;
a whole 16-programme disc can be identified for less by starting at 132px thumbnails and
zooming only the ambiguous rows. Details in the skill, §0a-1.

Capture and replacement is handled by the `concert-screenshots` skill
(`.claude/skills/concert-screenshots/SKILL.md`), which owns the full procedure, the fixed
encode settings (lanczos, `-q:v 2`, `yuvj420p`, `setsar=1`, no sharpening or colour changes)
and the read-only safety rules. Do not hand-roll ffmpeg calls for this.

---

### Temp images workflow
User drops images into `public/images/temp-images/` then asks Claude to assign them to a show.

**Temp image filename convention**: files are always named `vlcsnap-YYYY-MM-DD-HHhMMmSSsNNN.jpg`.
The user references the hero image by the last 3 digits (`NNN` — the milliseconds portion), e.g. `'839' hero` means the file ending in `s839.jpg` goes to `_01`.

**Slot ordering**: hero image → `_01`. Remaining images in ascending timestamp order (alphabetical by filename) unless the user specifies otherwise.

Steps:
1. Identify target show (by FolderPath, FolderName, ShowID, or description). When multiple versions of the same show exist, disambiguate by `TotalSizeHuman` — the user will specify the size.
2. Get the show's `ChecksumSHA1` from shows.json
3. Check what slots currently exist on disk: `ls public/images/{checksum}*`
4. Copy temp images to `public/images/{checksum}_0{n}.jpg` in the correct order
5. Update manifest indices to exactly match the new slot set
6. **Delete any old slot files on disk that are no longer in the manifest** — this always happens when replacing 4 images with 3. Skipping this step leaves orphaned files and broken UI image paths.
7. **Delete temp images** before completing the task

---

## Temp checksum stubs

When a show is created before files are physically scanned, a random 40-char hex is generated
as a placeholder checksum. These stubs are identified by:
- `Notes` field contains `"TEMP CHECKSUM - update when files are scanned"`

Shows with temp checksums — **none remain**. Regenerate this list rather than
hand-editing it; earlier versions have twice drifted out of date:

```bash
python3 -c "
import json
for s in sorted(json.load(open('public/shows.json')), key=lambda x: (x['Artist'], x.get('ShowDate') or 'zzzz')):
    if 'TEMP CHECKSUM' in (s.get('Notes') or ''):
        print(s['ShowID'], s['Artist'], s.get('ShowDate') or '(undated)')
"
```

Resolved on 2026-08-24: Radiohead Jools Holland, Soundgarden SNL 1996-05-18 and
STP Bizarre 2001-08-18, each confirmed by the sidecar in its own folder. Resolved on
2026-09-25: RHCP Woodstock 1999, by a time-window split of `Woodstock 1994 + 1999` (it carries a
derived checksum, explained in its `Notes`). Resolved on 2026-09-26, the last five, all STP and all by
their OWN existing images: the Unplugged stub was the Palladia HD rebroadcast, WAAF was VTS_02 of
`VH1 + WAAF 2000`, New York 2010 was an HD broadcast of the Blender Theater show, the "2010 Tour"
stub was the Palladia broadcast of the Riviera Theatre 2010-03-27 (it had the wrong date, venue and
setlist), and TV Compilation 6 was a duplicate of a record created a month later for the same file.

**Match a stub by CONTENT, never by name.** Two folders that a name-and-size audit
called undocumented were already recorded under names sharing nothing with them —
`Bon Jovi - Nokia Theatre` is filed as `STREAM` and the Kings of Leon EMAs as
`kingsema2010`. Hash the representative media and compare against every existing
`ChecksumSHA1` before writing anything.

When the real SHA1 is available: update `ChecksumSHA1` in shows.json, rename the image files,
and update the manifest key. Clear the Note.

---

## Git workflow

### Always use force-add for public/
`public/` is listed in `.gitignore` (Gatsby leftover) but its files are tracked.
Always use `git add -f public/` or `git add -f public/shows.json` etc.

### Never commit dist/
`dist/` is built by CI. Never `git add dist/` — it will be ignored correctly.

### Push 408 timeouts
GitHub occasionally returns `HTTP 408` on push. The commit is always created successfully — just retry `git push origin main` immediately. It succeeds on the second attempt.

### Health check runs automatically
A pre-push hook runs `scripts/health-check.py` before every push.
- **Warnings** (temp checksums, orphaned images, empty checksums) — printed but don't block
- **Errors** (bad dates, missing images listed in manifest, duplicate ShowIDs) — block the push
- **Setlist loss** — any song that disappears from a `Setlist` blocks the push. Songs that move
  to a record which gained them (a split) pass automatically; a deliberate removal needs an
  entry in `scripts/setlist-removals-approved.json` giving the exact strings and the reason

Run it manually anytime:
```bash
python3 scripts/health-check.py
```

### Commit message style
Uses conventional commits:
- `feat(shows):` — new show record or image added
- `fix(shows):` — metadata correction
- `feat(images):` — image replacement/addition
- `chore:` — sync, cleanup
- `feat(ui):` — frontend component changes
- `fix(ui):` — frontend bug fixes

Always end with:
```
Co-Authored-By: Claude <noreply@anthropic.com>
```
Unversioned on purpose — the model name would otherwise need updating every
time the model changes, and it goes stale silently.

---

## Metadata conventions

These rules apply every time any field in `shows.json` is created or edited. No exceptions.

---

### Duplicate recordings
When the same show exists as multiple recordings (different sources), all versions must share:
- Identical `ShowDate`
- Identical `EventOrFestival`
- Identical `VenueName`
- Identical `City` and `Country`

The record with the most complete metadata is the reference; others are updated to match.
Always scan for duplicates when editing any of these fields.

---

### ShowDate
- Format: `YYYY-MM-DD` or `""` — nothing else ever
- Only year known → `YYYY-01-01`
- Only year + month known → `YYYY-MM-01`
- Compilations, documentaries, rockumentaries, TV-only specials with no air/performance date → `""`
- Never use `"0000-00-00"`, `"Compilation"`, or any other placeholder string

---

### Mojibake — U+FFFD in imported text

Sidecars written in latin-1 or cp1252 and read as UTF-8 at scan time left a replacement
character wherever an accented letter should be. All nine **user-visible** occurrences are fixed
(Köln, Lüdinghausen, Nervión, Eurockéennes, Südwest, and a curly apostrophe in a lineage).

**75 records still carry it inside `Notes`** and are deliberately untouched: `Notes` holds
verbatim sidecar dumps, which are evidence, so each needs the original file re-read in its true
encoding rather than a guess at the missing character. Find them with:

```bash
python3 -c "
import json
for s in json.load(open('public/shows.json')):
    for k,v in s.items():
        if isinstance(v,str) and chr(0xFFFD) in v: print(s['ShowID'], s['Artist'], k)
"
```

This is not cosmetic: **the Artifact publisher refuses content containing U+FFFD**, so a review
page cannot be built for any artist whose records still carry it in a displayed field.

### Country
- Always the full English country name — never abbreviations or codes
- `"United States"` not `"USA"` / `"US"` / `"U.S.A."`
- `"United Kingdom"` not `"UK"` / `"U.K."`
- `"Netherlands"` not `"The Netherlands"` — confirmed collection-wide convention
- `"South Korea"` not `"Korea"`
- Apply consistently across all duplicate recordings of the same show

---

### VenueName
- Use the name the venue had **at the time of the show** — not its current or modern branding
- Examples:
  - "Brixton Academy" for shows before 2011 (became O2 Academy Brixton in 2011)
  - "Wembley Stadium" not "EE Wembley Stadium" for older shows
  - "The Shoreline Amphitheatre" not "Shoreline Amphitheater at Mountain View" for older shows
- Strip any date prefixes (e.g. `"2001-08-16 - Festival Name"` → `"Festival Name"`)
- `VenueName` is the physical venue only — festival name goes in `EventOrFestival`

### Known festival metadata (established conventions)
When enriching or correcting shows for these festivals, use exactly these values.
These are canonical — do not introduce variants.

| Festival / Show | EventOrFestival | VenueName | City | Country | Notes |
|---|---|---|---|---|---|
| Pinkpop | `Pinkpop` | `Megaland` | `Landgraaf` | `Netherlands` | |
| Roskilde Festival | `Roskilde Festival` | `Dyrskuepladsen` | `Roskilde` | `Denmark` | |
| Rock im Park | `Rock im Park` | `Frankenstadion` | `Nuremberg` | `Germany` | Not `Nürnberg` — matches the two existing records |
| Eurockéennes (Belfort) | `Eurockéennes Festival` | `Presqu'île de Malsaucy` | `Belfort` | `France` | Not `Les Eurockéennes` |
| Lowlands | `Lowlands Festival` | `Evenemententerrein Walibi Holland` | `Biddinghuizen` | `Netherlands` | Not just `Lowlands` |
| SWU (Brazil) | `SWU Music & Arts Festival` | _(blank)_ | `Itu - Sao Paulo` | `Brazil` | Not `SWU Festival` |
| Letterman | `David Letterman` | `Ed Sullivan Theater` | `New York` | `United States` | |
| Jools Holland | `Jools Holland` | `BBC Television Centre` | `London` | `United Kingdom` | |
| Tonight Show (Fallon) | `Jimmy Fallon` | `30 Rockefeller Plaza` | `New York` | `United States` | Shows from 2014 onward |
| Tonight Show (Leno) | `Jay Leno` | `NBC Studios` | `Burbank` | `United States` | Shows before 2014 |
| Conan (all eras) | `Conan O'Brien` | _(blank)_ | _(varies)_ | `United States` | Covers both NBC Late Night and TBS Conan eras |
| Jimmy Kimmel | `Jimmy Kimmel` | `El Capitan Theatre` | `Los Angeles` | `United States` | |
| Carson Daly | `Carson Daly` | _(blank)_ | `New York` | `United States` | |
| Saturday Night Live | `Saturday Night Live` | `30 Rockefeller Plaza` | `New York` | `United States` | |
| KROQ Almost Acoustic Christmas | `KROQ Almost Acoustic Christmas` | _(blank)_ | `Los Angeles` | `United States` | Annual KROQ radio event |
| MuchMusic (intimate) | `Much Music Intimate & Interactive` | `Chum City Building` | `Toronto` | `Canada` | `&` not `and` |
| Nissan Live Sets | `Nissan Live Sets on Yahoo! Music` | _(blank)_ | _(varies)_ | `United States` | Full name always |
| Farm Club | `Farm Club` | _(blank)_ | `Los Angeles` | `United States` | USA Network late-night music show (2000–2001) |
| Leeds Festival | `Leeds Festival` | `Bramham Park` | `Leeds` | `United Kingdom` | 2003 onward; settled on Reading 2006 (M21) |
| Reading + Leeds, site unknown | `Reading and Leeds Festival` | _(blank)_ | _(blank)_ | `United Kingdom` | Only when the footage names neither site — check stage banners ("Carling Weekend Reading") first |

---

### EventOrFestival
- Festival/event name only — never include dates, venue, or city in this field
- Examples: `"Glastonbury"`, `"Rock am Ring"`, `"MTV Unplugged"`, `"Later w/ Jools Holland"`
- Leave blank if it was a standard headline show with no named event/festival

---

### Setlist format
**Always** a single semicolon-separated string. Never newlines, numbered lists, or bullet points.

```
Song One; Song Two; Song Three; Encore break; Song Four; Song Five
```

Rules:
- Songs separated by `; ` (semicolon + space)
- Encore separator is exactly `Encore break` (capitalised, no dashes or symbols)
- No track numbers, no bullet points, no newlines
- Covers noted inline: `In the Flesh (Pink Floyd cover)`
- Acoustic versions noted inline: `Just Because (Acoustic)`
- If a setlist is partial/incomplete, append ` (incomplete)` at the end of the string

### Setlist sourcing

**The recording outranks everything.** What is captioned, printed or visible on screen is
primary evidence about *this* recording. Where a published setlist disagrees with the video,
the video wins — write it, mark a partial list `(incomplete)`, and record the conflict in
`Notes`. Rock in Rio 1991 captions `MY MICHELLE` on screen while four published sources omit
it from either possible night; the sources are simply incomplete.

The same applies to dates: use external sources to choose between candidates the recording
narrows down, then **commit to the best-evidenced one** and say why in `Notes`. A stated
judgement beats an empty field.

Verify a whole artist at once — read-only:

```bash
python3 scripts/audit-sidecar-setlists.py --artist "Bush"
```

**Exception, and check it first: a sidecar inside the show's own folder is truth on its
own.** `*.nfo`, `*.txt`, `info.txt`, `*.md5` — these were written by whoever made the disc,
from the disc. They are primary evidence about *this recording*, not a reconstruction of the
event, so the rule below does not apply to them. Write the setlist, and say in `Notes` which
file it came from. House formatting still applies.

For everything else, before writing any setlist **2+ independent sources must agree** on the
songs and order.

Acceptable sources (ranked by reliability):
1. setlist.fm (check user-confirmed count — higher = more reliable)
2. Official band site tour pages (e.g. janesaddiction.org/tour)
3. Published concert reviews (Rolling Stone, NME, Billboard, Pitchfork, local press)
4. YouTube full-show videos with confirmed date/venue
5. Fan forums or Dime A Dozen NFO files with eyewitness accounts

If only 1 source is found, or sources conflict: leave `Setlist` blank and note the conflict.
Never infer or reconstruct a setlist from tour averages or nearby-show patterns alone.

---

### Setlists that are populated but wrong

A non-empty `Setlist` is not a checked one. Eleven records were found holding things that were
never songs, always from a sidecar pasted in wholesale — header lines at the top (band, venue,
date, city) and trailer notes at the bottom (running time, lineage, credits, "thanx to"). One
held **another band's entire setlist**; another held `Didn't; figure; out`, an English sentence
split on spaces.

Check the **first and last three entries** of any long setlist — that is where the junk sits.

```bash
python3 scripts/audit-sidecar-setlists.py --artist "Foo Fighters"
```

Two things that look like junk but are not: a segment the disc numbers as a track
(`Interview (cuts in)`, `jam`) belongs in `Notes` rather than being deleted silently, and real
songs collide with junk patterns — Kings of Leon's *Taper Jean Girl*, Clapton's *Running on
Faith*.

### Common corrections to watch for
- `EventOrFestival` containing a date string → replace with the festival name only
- `VenueName` containing date prefixes → strip the date
- Venue using modern branding for a historic show → use name from the time of the show
- Rockumentaries, documentaries, compilations, TV-only shows → `ShowDate` should be `""`
- `Country` using abbreviation → expand to full name
- Setlist using newlines or numbered format → convert to semicolon format

---

## Data pipeline

Located in `data-pipeline/` — numbered Python scripts for scanning physical hard drives:

```
01_scan_hd_shows/     catalog_shows_v3_1.py — scans a drive, outputs CSV + checksums
04_merge_hd_csvs_identify_duplicates/     merge_catalogs_safe.py — merges multiple drive CSVs
05_merge_csvs/        enrichment scripts
07_merge_csvs_create_single_master/  merge_drives_master.py
08_final_create_master_CSV/          final merge → shows.json
```

**These CSV files are historical archives — do not edit them.**
The live source of truth is `public/shows.json`.
The pipeline is only re-run when a new hard drive is added to the collection.
The workflow for adding a new drive is not yet finalised.

---

## Metadata enrichment workflow

This is a **recurring weekly task**. Each session picks an artist (or a batch of artists) and enriches their shows in `shows.json` — filling in missing or placeholder values for dates, setlists, venue names, and event/festival names.

No API keys, no scripts, no external accounts needed. Claude handles all research inline using web search.

---

### What gets enriched

| Field | Missing/placeholder state | Target state |
|---|---|---|
| `ShowDate` | `YYYY-01-01` (year only) or `YYYY-MM-01` (year+month) | Full `YYYY-MM-DD` |
| `Setlist` | Empty string `""` | Semicolon-separated song list |
| `EventOrFestival` | Empty or generic string | Correct festival/event name |
| `VenueName` | Empty, approximate, or uses modern branding | Name at time of show |

---

### How to identify the show

Each show record contains clues that narrow down the exact date and event, even when the metadata is sparse. Claude should check these fields in order:

1. `FolderPath` and `FolderName` — often contain the date (`19961023`), venue shorthand, or event name encoded in the folder structure
2. `Notes` — may contain recording lineage text, broadcast source, or eyewitness descriptions that identify the show
3. `EventOrFestival` — if already present, use it as the primary search anchor
4. `City` + `Country` + approximate year — narrows the search to regional shows in that window
5. `VenueName` — cross-reference with known venue histories

---

### Research rules

- **2+ independent sources must agree** before any field is written. Never write from a single source.
- **A search engine's summary is not a source — only a page you fetched and read is.** On Ben Harper's
  Last Call record the search tool's summary stated "episodes May 2, 3, 4 and 5, 2006" as fact; no
  fetched page confirmed it (IMDb blocked, TheTVDB listed only a 2009 episode), so the date stayed
  year-only and the lead went into `Notes`. A summary can point at where to look; it never counts
  toward the two.
- Acceptable sources (ranked by reliability):
  1. setlist.fm (check user-confirmed count — higher = more reliable)
  2. Official band site tour pages
  3. Published concert reviews (Rolling Stone, NME, Billboard, Pitchfork, local press)
  4. YouTube full-show videos with confirmed date/venue
  5. Fan forums or Dime A Dozen NFO files with eyewitness accounts
- If only 1 source is found, or sources conflict: leave the field unchanged and note the conflict in a comment to the user
- Never infer or reconstruct a setlist from tour averages or nearby-show patterns alone
- For `VenueName`: use the name the venue had **at the time of the show**, not its current branding

---

### Batching and confirmation workflow

1. Claude scans `shows.json` for the requested artist and lists all shows with missing/placeholder fields
2. Claude researches each show and prepares a **proposal batch** — all proposed changes for that artist in one message
3. User reviews the batch and confirms (or rejects individual entries)
4. Claude writes only the confirmed changes to `shows.json`
5. Claude runs the health check and commits with `fix(shows):` or `feat(shows):` prefix

**Never write to `shows.json` before the user confirms the batch.**

---

### Trigger phrases

Start a session with any of these:

> "Check [Artist] for missing setlists"
> "Enrich [Artist] shows — dates, setlists, venues"
> "Pick up metadata enrichment — do [Artist] next"
> "Continue enrichment from last session"

Claude will scan the artist's shows, identify gaps, research each one, and present the full proposal batch for review before writing anything.

---

## Hard drives in the collection

Figures below are measured from `public/shows.json` (deduplicated) and the
`data-pipeline/` scan CSVs (raw). Sizes are GiB — multiply by 1.074 for the
decimal GB used on drive labels.

| Drive | Shows (deduped) | Size | Contents |
|---|---:|---:|---|
| Seagate Expansion Drive | 470 (57%) | 1,392 GiB | **Main collection** — the largest single source |
| Big Daddy | 347 (42%) | 1,043 GiB | Second collection, broadly the same era mix |
| `Untitled` (DVD archive) | 2 | 6 GiB | 316 scanned, but 313 are byte-identical duplicates of the above |
| **Unique total** | **829** | **~2,441 GiB** | ~2.4 TiB / ~2.6 TB. Add ~30 GiB for 10 shows with no recorded size |

**Both drives span the same eras** — roughly 1990s and 2000s heavy, with a
2010s tail. Neither is era-specific.

### Duplication across media
Raw scans total **1,421 show folders / 3,931 GiB (3.84 TiB)** across the three
volumes. After dedup that resolves to 829 unique shows / 2,441 GiB, so roughly
**1,490 GiB is redundant copies**. The `Untitled` volume is a DVD backup
archive: of its 316 folders, 313 match an existing `ChecksumSHA1` exactly and
were correctly dropped by the pipeline. Its one non-duplicate entry
(`Mainly Hunting - Target 2009`, filed under artist "DVDs") is not a concert
recording and is intentionally excluded.

> Historical note: this table previously described Big Daddy as the "bulk of
> all shows" and the Seagate as "overflow + 2010–2013 era". Both were wrong —
> the Seagate is larger on every measure, and only 13% of its shows fall in
> 2010–2013.

---

## Front-end performance

Measured, not guessed. On 2026-10-02 the drawer took 400–600 ms to open on a Mac
(~1.9 s at 4× CPU throttle, a stand-in for a phone) and Browse scrolled at ~6 fps on a
phone-class CPU. `a108257` brought the drawer to ~25 ms (~145 ms at 4×) and halved JS
memory. These rules keep it there, and `npm run check:perf` (part of `npm run check`)
fails on each of them:

- **No motion components inside `ShowCard`.** Its hover and focus layers are CSS
  (`group-hover`, `group-focus-visible`). Browse renders every show — ~1,200 cards — and
  four `motion.div`s per card was ~4,600 animated components re-rendering together. Use
  `motion` for one-off elements (drawer, hero), never per card. The vendored animation
  skills in `.claude/skills/` do not know this; this rule wins.
- **`AnimatePresence` around views or grids sets `presenceAffectsLayout={false}`.** At
  its default it hands every motion component beneath it a new context object on every
  render, which re-renders them all straight past `React.memo`. This was the single
  biggest cost.
- **Props that reach cards are stable.** `ShowCard` and `ShowGrid` are memoised: pass
  `onSelect={onShowClick}`, never `onClick={() => …}`. `getImageUrl` (useShows) and
  `handleShowClick` (App) are `useCallback`s. One inline arrow re-renders every card.
- **`inert` behind the drawer waits for the animation.** It goes on when the drawer
  finishes sliding in and comes off when it finishes sliding out (`drawerSettled` in App,
  `onSettled` in ShowDrawer). Toggling it restyles every element on the page (~26k on
  Browse); inside the click that delayed the drawer's first frame by ~100 ms (Mac) /
  ~0.5 s (phone). Nothing is exposed meanwhile: the backdrop covers the page and focus is
  moved into the drawer and trapped from its first frame.
- **Card images use native `loading="lazy"`** in `LazyImage`. No per-image
  IntersectionObserver, and no `translateZ(0)` or `will-change` — each pins a compositor
  layer per card.
- **Cards load the build thumbnail, not the original** (see Image conventions → Card
  thumbnails), with the original as `fallbackSrc`. Anything shown large — the drawer
  header, the viewer — uses the original; the drawer header shows the thumbnail first and
  fades the original in over it.
- **The first load is the trimmed show list, not `shows.json`** (see The data model →
  What the site loads). Notes arrive afterwards in their own lookup, never merged into the
  show objects: replacing every object would re-render every memoised card.
- **Fonts are self-hosted** (`public/fonts/README.md`), and DM Sans is preloaded. Never
  add a Google Fonts `<link>`: it is render-blocking, so nothing paints until a
  third-party server has answered.
- **No `content-visibility` on cards** — tried three ways and rejected. On the card
  button it clips the hover zoom and shadow. On the image it stops lazy loading until the
  card is nearly on screen, so cards scroll in blank. On the overlays and caption it made
  fast scrolling choppier and no longer sped up the drawer once `inert` was deferred.

**Measure before and after** any change to cards, grids, the drawer or image loading:

```bash
npm run perf               # build, serve, check drawer behaviour, time it, apply budgets (~4 min)
npm run perf -- --quick    # one run per CPU speed (~2 min)
npm run perf -- --url https://karl0s.github.io/digital-vault/   # probe any server, e.g. live
```

Single runs on this Mac swing widely (one drawer timing went 140 ms → 17 ms between
identical runs), so compare medians of alternating runs, never one against one. Chrome.app
will not start headless from a sandboxed shell; the script uses Playwright's headless
shell from `~/Library/Caches/ms-playwright/` when it is there.

Still open: virtualising Browse, only if a real phone still stutters. It costs in-page
Cmd+F, and what it would remove — grid first render and the stall when `inert` lands
after the drawer settles — is small on a Mac.

---

## UI patterns

### Content container width
The homepage and nav share a standard max-width container to keep content visually centred on wide screens:

- `max-w-[1924px] mx-auto` — used in `FeaturedRows` (outer wrapper) and `TopNav` (inner content wrapper). Caps the content area on ultra-wide screens so rows don't stretch edge-to-edge.
- `max-w-[1860px] mx-auto` — used in `SearchResultsGrid`. Same effective inner width as FeaturedRows (1924px − 64px outer padding already applied by `App.tsx`).

When adding any new full-width homepage section, wrap its content in `max-w-[1924px] mx-auto`. The nav background spans the full viewport; only its inner flex div gets the max-width wrapper.

### Homepage row card widths
On **mobile** (`< md`), each `FeaturedRow` renders as a 2-column CSS grid flowing vertically — no horizontal scroll, no fades, no arrows. All cards in the row are visible.

On **desktop** (`md+`), `FeaturedRows` uses viewport-calc card widths at the same breakpoints as `SearchResultsGrid`:

```
md:     calc((100vw - 64px - 36px) / 4)          ← 4 visible (= search grid)
lg:     calc((100vw - 64px - 48px) / 5)          ← 5 visible (= search grid)
xl:     calc((100vw - 64px - 60px) / 6)          ← 6 visible (= search grid)
2xl:    calc((min(100vw,1924px) - 64px - 72px) / 6.5)  ← 6.5 with scroll peek
```

At `2xl` the homepage shows 6.5 (one fewer than the grid's 7) to preserve the visible scroll peek.

### Homepage row fade gradients
Desktop only. In `FeaturedRow` (inside `FeaturedRows.tsx`), the left/right edge fades are **always visible** when there is content to scroll — they are separate `pointer-events-none` divs, not part of the arrow buttons. The arrow buttons (`z-20`) are hover-only (`opacity-0` → `opacity-100` on `isRowHovered`). The fade divs (`z-10`) have no opacity transition.

This means desktop users always see the scroll affordance without needing to hover first. On mobile the grid layout makes fades and arrows unnecessary.

### Search results grid
`SearchResultsGrid` uses CSS `grid` with responsive column counts — no fixed card widths (columns size automatically via `1fr`):

```
grid-cols-2  →  md:grid-cols-4  →  lg:grid-cols-5  →  xl:grid-cols-6  →  2xl:grid-cols-7
```

Card widths at each breakpoint match the homepage row cards (same calc denominators), so both views feel visually consistent.

### Close buttons
All close buttons use the shared `CloseButton` component (`components/CloseButton.tsx`).
Style: `bg-white/10 hover:bg-white/20 rounded-full`, icon `w-5 h-5 md:w-6 md:h-6`.
Pass positioning via `className` prop — the component handles appearance only.
Standard coordinates: `top-4 right-4` mobile, `top-6 right-6` desktop.
Currently used in: `ShowDrawer` (drawer close + image overlay close).

**ShowDrawer close button positioning**: the button is rendered **outside** the scrollable content div (sibling to it, inside the fixed drawer `motion.div`). This is intentional — placing it inside the scroll div with `sticky` caused it to occupy flow space on mobile and push the hero image down. With `absolute top-4 right-4 md:fixed md:top-6 md:right-6` it floats over the hero image on mobile without consuming layout space.

### Mobile input focus and iOS keyboard
iOS Safari only raises the software keyboard when `input.focus()` is called within the **same synchronous call stack** as the user gesture (tap). Any async path — `setTimeout`, `useEffect`, `Promise.then` — loses the gesture context and the keyboard is silently ignored.

When a mobile input is conditionally rendered (e.g. a search bar that mounts on tap), use `flushSync` from `react-dom` to force a synchronous React render, then call `.focus()` immediately:

```tsx
import { flushSync } from 'react-dom';

onClick={() => {
  flushSync(() => setInputVisible(true)); // renders the input into the DOM synchronously
  inputRef.current?.focus();             // still within the tap gesture — keyboard opens
}}
```

Also ensure mobile inputs have `font-size: 16px` (`text-base`) or larger. iOS auto-zooms the page when focusing any input with `font-size < 16px`.

### Hero section (HeroSearch)
The hero title block (site name, subtitle, quick-search pills) is always mounted but animates to
`height: 0 / opacity: 0` when `isSearching` is true. It is driven by Framer Motion's `animate` prop
(not `AnimatePresence`) so the nav search input is never unmounted while typing.
`App.tsx` passes `isSearching={isSearching || showAllMode}` to collapse it in both search and all-shows mode.

### ShowDrawer — mobile sizing
On mobile the drawer is `h-dvh` (`height: 100dvh`) — **not** `h-[88vh]` or `h-screen`. `dvh` is the dynamic viewport height unit: the browser recalculates it live as the URL bar appears or disappears, so the drawer always fills exactly the visible screen. Do not change this to a static `vh` value.

### Drawer metadata layout (ShowDrawer)
The drawer hero area and content grid follow this fixed structure:

**Hero area** (top of drawer, above thumbnails):
1. Artist name — large display font
2. Single subtitle line — `Date · EventOrFestival (or VenueName if no event) · Country (or City, Country if no event)` — built as a filtered join with ` · ` separator; "Date Unknown" if `ShowDate` is empty
3. Badge pills row — RecordingType, Duration (Clock icon + auto-formatted `DurationSec`), TVStandard — each only rendered if the field has a value

**Content grid** (below thumbnails):
- 3 columns on `md+`: Setlist | Technical | Notes
- Column count is dynamic — `md:grid-cols-3` when all three exist, `md:grid-cols-2` when only two, no grid class when only one
- Column labels use `text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600`
- Setlist: numbered list from semicolon-split `Setlist` field; `Encore break` rendered as a divider line
- Technical: array of `{ label, value }` rows — label fixed `w-16 text-gray-500`, value `text-white`; only rows with a value are rendered
- Notes: `whitespace-pre-wrap wrap-break-word font-mono text-xs text-gray-400`; truncated to `max-h-40` with a gradient fade when collapsed; **More ⌄ / Less ⌃** buttons toggle `notesExpanded` state; button only shown when `Notes.length > 320`. `wrap-break-word` is intentional — pipeline notes often contain long unbroken strings (URLs, codec lines, filenames) that would overflow the container on mobile and cause the browser to zoom

The Source & Files accordion has been removed — drive/folder/file metadata is no longer shown in the drawer.

**Tailwind v4 note**: use `bg-linear-to-t` not `bg-gradient-to-t` for gradient classes — the latter triggers a deprecation warning in v4.

### In-drawer screenshot thumbnails (ShowDrawer)
The screenshots grid is responsive:
- **Mobile**: `flex overflow-x-auto scrollbar-hide` — single horizontal scroll row. Each thumbnail is `w-[42%] shrink-0` so two fit fully in view with ~16% of the third peeking to signal scrollability.
- **Desktop** (`md+`): `grid grid-cols-4` — standard 4-column grid, `w-full` per item.

Both layouts share the same mapped element so `layoutId` refs for the image viewer animation are stable.

### In-drawer image viewer (ShowDrawer)
`ShowDrawer` manages image viewing internally — there is no external lightbox call.

Key state:
- `expandedFromIndex: number | null` — which thumbnail was clicked; anchors the `layoutId` for the open/close animation; set to `null` to close
- `viewingIndex: number` — which image is currently displayed; changes on prev/next without affecting the `layoutId` anchor

How it works:
- Each thumbnail is wrapped in `<motion.div layoutId={`drawer-img-${show.ShowID}-${idx}`}>` 
- The overlay renders a `<motion.div>` with the same `layoutId` matching `expandedFromIndex` — Framer Motion animates the element between thumbnail and expanded positions
- Navigating prev/next only updates `viewingIndex`; close always zooms back to the original thumbnail
- The drawer's own close button is hidden (`!isImageExpanded`) while the viewer is open to prevent z-index conflicts with the overlay's close button

---

## Featured shows (homepage)

`components/FeaturedRows.tsx` contains `FEATURED_IDS` — an array of ShowIDs shown in the
"Featured" row on the homepage. Edit this array to add/remove featured shows.

Current quick-search pills are defined in `components/HeroSearch.tsx` → `QUICK_SEARCHES`.

---

## Key stats
Recomputed from `public/shows.json`, not maintained by hand:

```bash
python3 -c "
import json, collections
d = json.load(open('public/shows.json'))
a = collections.Counter(s['Artist'] for s in d)
f = collections.Counter(s['EventOrFestival'] for s in d if s.get('EventOrFestival'))
print(len(d), 'shows /', len(a), 'artists'); print(a.most_common(9)); print(f.most_common(7))
"
```

- **973 shows** across **173 artists**
- Top artists by volume: Stone Temple Pilots (100), Smashing Pumpkins (63),
  Kings Of Leon (53), Soundgarden (36), Red Hot Chili Peppers (32), Foo Fighters (31),
  Stereophonics (29), Incubus (26), Various Artists (25)
- Top festivals: Rock am Ring (49), Glastonbury Festival (29), Reading Festival (28),
  MTV Unplugged (24), Pinkpop (23), Bizarre Festival (21), Big Day Out (19)

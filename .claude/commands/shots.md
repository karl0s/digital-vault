---
description: Full screenshot run for one artist — scout, resolve, capture, pick heroes, open the page
---

Do a complete screenshot run for **$ARGUMENTS**, following the `concert-screenshots` skill.

## 1. Scout — before any frame is captured

First confirm the name as **stored**. Every artist is filed without a leading "The"
(`Killers`, `Strokes`, `Offspring`), and a wrong name gives a clean, empty report with no
error. Case does not matter; spelling does. Use one distinctive word, lower-case:

```bash
cd ~/Desktop/Projects/the-vault && python3 -c "
import json; a='killers'
print({s['Artist'] for s in json.load(open('public/shows.json')) if a in (s.get('Artist') or '').lower()})"
```

If the stored name differs from **$ARGUMENTS**, use the stored name in every command below.

```bash
~/VaultShots/scout.sh "$ARGUMENTS"
```

Then **read every sidecar it lists**. They have revealed two-show discs, wrong dates,
a wrong band's setlist and full setlists before a single frame was decoded.

Resolve everything it reports — folders with more than one titleset, duplicate groups
that disagree, runtimes that imply an impossible bitrate, records with no checksum.
Build **one HTML page** of anything still ambiguous, `open` it, and ask Karl about all
of it together. Do not capture until that is settled: stills of the wrong concert are
not detectable afterwards. A disc with several acts on it is filed through the
`va-masters` skill — never as a standalone record made during this run (skill §10).

## 2. Identify the band once

Build the who's-who for this artist per era (skill §6.2d-3) before picking anything —
who fronts the centre mic, who plays what, and any extra people (touring keyboardists,
presenters, guests). Three misidentifications reached Karl on the last artist because
this was skipped.

## 3. Capture

```bash
~/VaultShots/run_artist.sh "$ARGUMENTS"
```

Run it in the background and **wait for the notification — do not poll**. It plans,
captures, scores, builds contact sheets, auto-picks and materialises.

## 4. Heroes — the part that must not be rushed

Slot A is **always a close-up of the lead singer**. `autopick` marks it `A?` because the
scorer cannot know who anyone is.

- choose heroes from a **full-capture sweep** (~40 frames per show at 150px, three shows
  per image), never from a per-show contact sheet — on dark or wide-camera sources the
  shortlist a contact sheet renders contains no close-up at all
- verify each hero at **≥340px** before writing it; identity errors survive a thumbnail
- record it in `data/hero_verified.json` as `{"<ShowID>": {"ts": "...", "checked_px": 360}}`
- where the singer has no usable close-up, use the tightest shot **of the singer**; where
  none exists at all, add the ShowID to `data/no_closeup.json` with a reason and flag it
  for Karl — never substitute another person or a wide

`promote.py` refuses until every hero is verified or flagged.

## 4b. Shape — every 4:3-flagged source that could be a squeezed 16:9 broadcast

```bash
python3 ~/VaultShots/aspect_ab.py
```

Lists every source flagged 4:3 with **no letterbox bars** and dated 2000 or later, and
renders each hero at 4:3 and at 16:9 side by side. An off-air recorder that squeezes a
widescreen broadcast into a 4:3 frame leaves flags that agree with each other and no bars,
so every automated gate passes: six Stereophonics sources (UK TV, 2002–2004) shipped
squashed that way and Karl caught them on the picks page. Most suspects are genuinely 4:3
— the profile is a reason to look, not a verdict — so **do not decide these yourself**:
not by comparing faces (that is exactly the check that cleared all six), not by a circle,
and never by a point-light number (invalid on SD). The shape is Karl's call on this page.
Fix confirmed ones per skill §4.4 ("A 4:3 flag with NO bars"). Letterboxed sources keep
their bars — measure the rows into `Notes`, never crop (skill §4.3).

## 5. Show Karl

```bash
~/VaultShots/showpicks.sh "$ARGUMENTS"
open ~/VaultShots/reports/<artist>_aspect_ab.html
```

The deliverable is those **local** pages opened in his browser, not a Claude Artifact.
He signs off on the picks **and** on each suspect source's shape.

## 6. Stop — then promote, sync, commit (skill §17 steps 7-9)

Promote only after he has signed off. Then:

1. `~/VaultShots/sync_skill_copies.sh` — `~/VaultShots` holds the master of every script;
   commit whatever copies it lists with the run.
2. In the repo, `python3 scripts/health-check.py`, then commit on **`main`** by explicit
   path in **one** command, new files `git add`ed by exact path (no `-f`) (skill §11). Leave nothing
   staged. **Never push** — each push to `main` deploys the live site; Karl says when.
3. Move `~/VaultShots/promote-backup` to `~/.Trash`: it only covers promotion → commit.

**Do not run `shots.py archive`** until all of that is done — it clears `work/` and moves
`picks/`, which breaks the page and forces a re-capture for any later correction.

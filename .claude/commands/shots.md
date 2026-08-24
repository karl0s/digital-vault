---
description: Full screenshot run for one artist — scout, resolve, capture, pick heroes, open the page
---

Do a complete screenshot run for **$ARGUMENTS**, following the `concert-screenshots` skill.

## 1. Scout — before any frame is captured

```bash
~/VaultShots/scout.sh "$ARGUMENTS"
```

Then **read every sidecar it lists**. They have revealed two-show discs, wrong dates,
a wrong band's setlist and full setlists before a single frame was decoded.

Resolve everything it reports — folders with more than one titleset, duplicate groups
that disagree, runtimes that imply an impossible bitrate, records with no checksum.
Build **one HTML page** of anything still ambiguous, `open` it, and ask Karl about all
of it together. Do not capture until that is settled: stills of the wrong concert are
not detectable afterwards.

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

## 5. Show Karl

```bash
~/VaultShots/showpicks.sh "$ARGUMENTS"
```

The deliverable is that **local** page opened in his browser, not a Claude Artifact.

## 6. Stop

Promote only after he has signed off, then commit. **Do not run `shots.py archive`**
until then — it clears `work/` and moves `picks/`, which breaks the page and forces a
re-capture for any later correction.

---
description: Materialise picks for the staged artist, verify the page, and open it in the browser
---

Run the local picks page for **$ARGUMENTS** and open it in Karl's browser.

```bash
~/VaultShots/showpicks.sh "$ARGUMENTS"
```

That script does all of it and refuses rather than showing something misleading:

- reads the staged artist from `data/state.json` and **refuses** if it does not match
  the name given — passing "Nirvana" while Smashing Pumpkins is staged is the stale-state
  failure that has silently shown the wrong artist's picks before
- runs `shots.py picks`, which re-materialises `picks/` from `picks.json`
- runs `check_report_links.py` and **refuses to open** if any image does not resolve;
  a broken page wastes a review pass and is worse than no page
- opens `reports/<artist>_picks.html`

If it refuses because images do not resolve, the usual cause is that `shots.py archive`
has already moved `picks/` out from under the page.

The deliverable here is the LOCAL html file, not a Claude Artifact. Do not archive the
run until Karl has signed off on the picks.

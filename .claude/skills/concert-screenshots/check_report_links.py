#!/usr/bin/env python3
"""Verify every <img src> in a report actually resolves. Run before opening a page.

Pages are written into reports/ but reference scratch directories that are SIBLINGS
of reports/ - so they need a "../" prefix. Getting that wrong produces a page of
broken images that looks fine to the author, who never opens it, and wastes the
reviewer's time. Opening an unverified page is the failure; the fix is one check.
"""
import os, re, sys
from pathlib import Path
R = Path(__file__).resolve().parent / "reports"
targets = [Path(a) for a in sys.argv[1:]] or sorted(R.glob("*.html"))
bad = 0
for f in targets:
    srcs = re.findall(r'src="([^"]+)"', f.read_text(encoding="utf-8", errors="replace"))
    miss = [s for s in srcs
            if not os.path.exists(s[7:] if s.startswith("file://")
                                  else os.path.join(str(f.parent), s))]
    if miss:
        bad += 1
        print("  BROKEN %s: %d/%d missing, e.g. %s" % (f.name, len(miss), len(srcs), miss[0][:80]))
    else:
        print("  OK     %s: %d images resolve" % (f.name, len(srcs)))
sys.exit(1 if bad else 0)

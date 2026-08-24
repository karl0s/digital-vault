#!/usr/bin/env python3
"""Verify every <img src> in a report actually resolves. Run before opening a page.

Pages are written into reports/ but reference scratch directories that are SIBLINGS
of reports/ - so they need a "../" prefix. Getting that wrong produces a page of
broken images that looks fine to the author, who never opens it, and wastes the
reviewer's time. Opening an unverified page is the failure; the fix is one check.
"""
import html as _html
import os, re, sys
from urllib.parse import unquote
from pathlib import Path
def _resolve(f, src):
    """A src attribute carries HTML entities AND percent-encoding, in that order.

    Browsers decode entities in attribute values, so `O&#x27;Brien` addresses the
    file `O'Brien`. Checking the raw string reports a break that does not exist -
    which is worse than no check, because the next real break gets ignored as
    another known false alarm.
    """
    s = _html.unescape(src)
    # A browser cuts the URL at the first '#' - that is a fragment, not part of
    # the path. A folder named "PRO #1" therefore truncates and every image on
    # that show 404s, while a filesystem check on the raw string passes happily.
    # Split BEFORE unquoting, so a properly encoded %23 survives.
    s = s.split("#", 1)[0]
    if s.startswith("file://"):
        return unquote(s[7:])
    return os.path.join(str(f.parent), unquote(s))



R = Path(__file__).resolve().parent / "reports"
targets = [Path(a) for a in sys.argv[1:]] or sorted(R.glob("*.html"))
bad = 0
for f in targets:
    srcs = re.findall(r'src="([^"]+)"', f.read_text(encoding="utf-8", errors="replace"))
    miss = [s for s in srcs
            if not os.path.exists(_resolve(f, s))]
    if miss:
        bad += 1
        print("  BROKEN %s: %d/%d missing, e.g. %s" % (f.name, len(miss), len(srcs), miss[0][:80]))
    else:
        print("  OK     %s: %d images resolve" % (f.name, len(srcs)))
sys.exit(1 if bad else 0)

#!/usr/bin/env python3
"""Compute the pipeline's ChecksumSHA1 for each DVD titleset separately. READ-ONLY.

ChecksumSHA1 = sha1(concatenated representative media, in order). For a DVD the
representative media is the VTS_*_[1-9].VOB segments in order. Computing it per
titleset does two things:

  1. proves WHICH show the existing record's checksum actually describes, and
  2. produces a genuine content hash for the show that has no record yet -
     far better than a derived hash, because it behaves like every other key
     in the collection.
"""
import hashlib, re, sys, collections
from pathlib import Path
DRIVE = Path("/Volumes/Live Music")
CHUNK = 8*1024*1024

folder = sys.argv[1]
# Not every disc has a VIDEO_TS subfolder - some rips put the VOBs at the folder
# root. Hardcoding VIDEO_TS made this print the folder name and nothing else, a
# silent no-op that looks like "no titlesets" rather than "wrong path".
d = DRIVE/folder/"VIDEO_TS"
if not any(d.glob("VTS_*_[1-9].VOB")):
    d = DRIVE/folder
PREFIX = "VIDEO_TS/" if d.name == "VIDEO_TS" else ""
sets = collections.defaultdict(list)
for f in sorted(d.glob("VTS_*_[1-9].VOB")):
    m = re.match(r"VTS_(\d+)_(\d+)\.VOB$", f.name)
    if m: sets[m.group(1)].append(f)
if not sets:
    sys.exit("  no VTS_*_n.VOB under %s or its VIDEO_TS - wrong folder name?" % (DRIVE/folder))

print("  %s" % folder)
for ts, files in sorted(sets.items()):
    h = hashlib.sha1(); n = 0
    for f in files:
        with open(f, "rb") as fh:          # read-only, never 'r+' or 'w'
            while True:
                b = fh.read(CHUNK)
                if not b: break
                h.update(b); n += len(b)
    print("    VTS_%s  %d file(s)  %8.1f MB  sha1 %s"
          % (ts, len(files), n/1048576, h.hexdigest()))
    print("             %s" % "; ".join(PREFIX+f.name for f in files))

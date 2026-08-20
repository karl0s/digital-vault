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
d = DRIVE/folder/"VIDEO_TS"
sets = collections.defaultdict(list)
for f in sorted(d.glob("VTS_*_[1-9].VOB")):
    m = re.match(r"VTS_(\d+)_(\d+)\.VOB$", f.name)
    if m: sets[m.group(1)].append(f)

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
    print("             %s" % "; ".join("VIDEO_TS/"+f.name for f in files))

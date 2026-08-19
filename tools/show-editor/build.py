#!/usr/bin/env python3
"""Generate the Show Editor page.

Reads public/shows.json and public/image-manifest.json and writes a single
self-contained index.html next to this script.

The generated page is CLIPBOARD-ONLY. It has no server, makes no network or
filesystem writes, and cannot modify shows.json, the manifest or any image.
Data is read once here, at generation time. The only way an edit leaves the
page is you pressing a Copy button.

Re-run this script whenever shows.json changes.
"""
from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SHOWS = ROOT / "public" / "shows.json"
MANIFEST = ROOT / "public" / "image-manifest.json"
OUT = HERE / "index.html"

# Curatorial fields - the ones you research and correct by hand.
EDITABLE = [
    ("Artist",          "select",   "Artist"),
    ("ShowDate",        "date",     "Show date"),
    ("EventOrFestival", "suggest",  "Event / festival"),
    ("VenueName",       "suggest",  "Venue"),
    ("City",            "suggest",  "City"),
    ("Country",         "select",   "Country"),
    ("RecordingType",   "select",   "Recording type"),
    ("Generation",      "select",   "Generation"),
    ("TVStandard",      "select",   "TV standard"),
    ("SourceEquipment", "text",     "Source equipment"),
    ("Lineage",         "textarea", "Lineage"),
]
# Shown but locked: derived from the actual media by the scan pipeline, so
# editing them here would only make them disagree with the files on disk.
LOCKED = [
    ("ShowID", "Show ID"), ("ChecksumSHA1", "Checksum"),
    ("Container", "Container"), ("VideoCodec", "Video codec"),
    ("_dims", "Dimensions"), ("AspectRatio", "Aspect ratio"),
    ("_dur", "Duration"), ("AudioCodec", "Audio codec"),
    ("AudioChannels", "Channels"), ("AudioSampleRate", "Sample rate"),
    ("FileCount", "Files"), ("TotalSizeHuman", "Total size"),
    ("RepVideoCount", "Rep. videos"), ("FolderName", "Folder name"),
    ("FolderPath", "Folder path"), ("MasterDriveName", "Master drive"),
    ("DuplicateOf", "Duplicate of"), ("IsPrimary", "Is primary"),
    ("SourceCatalog", "Source catalog"), ("LastScannedAt", "Last scanned"),
]
SELECT_EXTRA = {
    "RecordingType": ["Proshot", "Soundboard", "Audience"],
    "TVStandard": ["PAL", "NTSC"],
}


def fmt_dur(sec):
    try:
        s = int(float(sec))
    except (TypeError, ValueError):
        return ""
    h, rem = divmod(s, 3600)
    m, x = divmod(rem, 60)
    return "%02d:%02d:%02d" % (h, m, x)


def main() -> None:
    shows = json.loads(SHOWS.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))

    # A-Z by artist, then chronological, undated last.
    shows.sort(key=lambda s: ((s.get("Artist") or "").casefold(),
                              s.get("ShowDate") or "zzzz",
                              (s.get("FolderName") or "").casefold()))

    # Type-ahead / dropdown vocabularies, built from what you already use so the
    # page nudges toward existing values rather than inventing new ones.
    vocab = {}
    for field, kind, _label in EDITABLE:
        if kind not in ("select", "suggest"):
            continue
        vals = {str(s.get(field) or "").strip() for s in shows}
        vals.discard("")
        vals.update(SELECT_EXTRA.get(field, []))
        vocab[field] = sorted(vals, key=lambda x: x.casefold())

    rows = []
    for s in shows:
        ck = str(s.get("ChecksumSHA1") or "").strip()
        slots = manifest.get(ck) or []
        img = ("../../public/images/%s_%02d.jpg" % (ck, slots[0])) if (ck and slots) else None
        r = dict(s)
        r["_img"] = img
        r["_dims"] = ("%sx%s" % (s.get("Width"), s.get("Height"))
                      if s.get("Width") and s.get("Height") else "")
        r["_dur"] = fmt_dur(s.get("DurationSec"))
        rows.append(r)

    payload = {
        "shows": rows,
        "vocab": vocab,
        "editable": [{"f": f, "kind": k, "label": l} for f, k, l in EDITABLE],
        "locked": [{"f": f, "label": l} for f, l in LOCKED],
    }
    tpl = (HERE / "template.html").read_text(encoding="utf-8")
    OUT.write_text(
        tpl.replace("__DATA__", json.dumps(payload, ensure_ascii=False).replace("</", "<\\/")),
        encoding="utf-8",
    )
    print("wrote %s" % OUT)
    print("  %d shows, %d with a thumbnail" % (len(rows), sum(1 for r in rows if r["_img"])))
    print("  open it with:  open '%s'" % OUT)


if __name__ == "__main__":
    main()

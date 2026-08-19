#!/usr/bin/env python3
"""Promote hand-taken screenshots from public/images/temp-images into the vault.

Usage:
    python3 tools/add-temp-images.py --show "irving plaza" --hero s257
    python3 tools/add-temp-images.py --show "irving plaza" --hero s257 --apply

The hero may be given as the full filename, or just the trailing milliseconds
("s257" / "257") as Karl refers to them.

Slot order follows CLAUDE.md: hero -> _01, remaining in ascending filename
(= timestamp) order. Going from N images to fewer DELETES the surplus slots so
nothing is orphaned, and the manifest is rewritten as a contiguous [1..N].

Guarantees:
  * refuses if the show match is ambiguous or absent
  * refuses if any incoming image disagrees with the show's recorded aspect
  * backs up every replaced image plus the old manifest entry
  * asserts shows.json is byte-identical afterwards
  * asserts zero orphans collection-wide, not just for this show
  * empties temp-images without using shell globs
"""
from __future__ import annotations
import argparse, hashlib, json, os, re, shutil, sys
from pathlib import Path
from PIL import Image

REPO   = Path(__file__).resolve().parents[1]
IMGS   = REPO/"public"/"images"
TEMP   = IMGS/"temp-images"
MANI   = REPO/"public"/"image-manifest.json"
SHOWS  = REPO/"public"/"shows.json"
BACKUP = Path.home()/"VaultShots"/"promote-backup"


def audit(mani):
    miss=[f"{c}_{i:02d}" for c,s in mani.items() for i in s
          if not (IMGS/f"{c}_{i:02d}.jpg").exists()]
    orph=[]
    for p in IMGS.glob("*.jpg"):
        if "_" not in p.stem: continue
        c,i = p.stem.rsplit("_",1)
        if not i.isdigit(): continue
        if int(i) not in (mani.get(c) or []): orph.append(p.stem)
    return miss, orph


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--show", required=True, help="substring of Artist + FolderName")
    ap.add_argument("--hero", required=True, help="full filename or trailing ms, e.g. s257")
    ap.add_argument("--artist")
    ap.add_argument("--apply", action="store_true")
    a=ap.parse_args()

    shows=json.loads(SHOWS.read_text(encoding="utf-8"))
    mani=json.loads(MANI.read_text(encoding="utf-8"))
    miss,orph=audit(mani)
    if miss or orph:
        sys.exit(f"REFUSING: repo already has orphans ({len(miss)} missing, {len(orph)} stray)")

    # Normalise separators: folder names use dots and underscores as often as
    # spaces ("A.Perfect.Circle.on.Jimmy.Kimmel.Live"), so a literal substring
    # search on the query silently misses them.
    def norm(x): return re.sub(r"[^a-z0-9]+", " ", (x or "").lower()).strip()
    q=norm(a.show)
    cand=[s for s in shows
          if q in norm((s.get("FolderName") or "")+" "+(s.get("Artist") or ""))
          and (not a.artist or s.get("Artist")==a.artist)]
    if len(cand)!=1:
        for s in cand: print("   %s | %s" % (s.get("Artist"), s.get("FolderName")))
        sys.exit(f"REFUSING: --show matched {len(cand)} records; narrow it (or pass --artist)")
    show=cand[0]; ck=(show.get("ChecksumSHA1") or "").strip()
    if not ck: sys.exit("REFUSING: record has no ChecksumSHA1")

    files=sorted(p.name for p in TEMP.glob("*.jpg") if not p.name.startswith("."))
    if not files: sys.exit("no .jpg files in temp-images")
    # rstrip(".jpg") strips CHARACTERS, not the suffix - it would eat a trailing
    # "j"/"p"/"g" from the stem too. Match on the stem explicitly.
    def stem(x): return re.sub(r"\.jpg$", "", x, flags=re.I).lower()
    want=stem(a.hero).lstrip("s")
    hero=(a.hero if a.hero in files else
          next((f for f in files if stem(f)==stem(a.hero)), None) or
          next((f for f in files if stem(f).endswith(want)), None) or
          next((f for f in files if want in stem(f)), None))
    if not hero: sys.exit(f"REFUSING: hero {a.hero!r} not found among {files}")
    order=[hero]+[f for f in files if f!=hero]

    m=re.search(r"(\d+):(\d+)", show.get("AspectRatio") or "")
    declared=int(m.group(1))/int(m.group(2)) if m else None
    print(f"  {show['Artist']} — {show.get('FolderName')}")
    print(f"  checksum {ck}")
    print(f"  manifest now {mani.get(ck)}  ->  {list(range(1,len(order)+1))}")
    for i,f in enumerate(order,1):
        with Image.open(TEMP/f) as im: w,h=im.size
        bad = declared and abs(w/h-declared)/declared > 0.02
        print("    _%02d  %-46s %dx%d (%.3f)%s%s"
              % (i,f,w,h,w/h," <- hero" if i==1 else "", "  ASPECT MISMATCH" if bad else ""))
        if bad and a.apply:
            sys.exit(f"REFUSING: {f} is {w/h:.3f}:1 but the show declares {declared:.3f}:1")
    old=sorted(p.name for p in IMGS.glob(f"{ck}_*.jpg"))
    surplus=[n for n in old if int(n.rsplit("_",1)[1].split(".")[0])>len(order)]
    if surplus: print(f"  will DELETE surplus slots: {surplus}")
    if not a.apply:
        print("\n  dry run — rerun with --apply"); return 0

    before=hashlib.sha256(SHOWS.read_bytes()).hexdigest()
    dest=BACKUP/re.sub(r"[^a-z0-9]+","-",(show.get("FolderName") or ck).lower()).strip("-")[:40]
    dest.mkdir(parents=True, exist_ok=True)
    for n in old: shutil.copy2(IMGS/n, dest/n)
    json.dump({"checksum":ck,"old_slots":mani.get(ck),"old_files":old},
              open(dest/"_ledger.json","w"), indent=1)
    for i,f in enumerate(order,1): shutil.copy2(TEMP/f, IMGS/f"{ck}_{i:02d}.jpg")
    for n in surplus: (IMGS/n).unlink()
    mani[ck]=list(range(1,len(order)+1))
    MANI.write_text(json.dumps(mani,indent=2,ensure_ascii=False),encoding="utf-8")

    on=sorted(int(p.stem.rsplit("_",1)[1]) for p in IMGS.glob(f"{ck}_*.jpg"))
    miss,orph=audit(mani)
    same=hashlib.sha256(SHOWS.read_bytes()).hexdigest()==before
    print(f"\n  disk == manifest   : {on==mani[ck]}")
    print(f"  shows.json intact  : {same}")
    print(f"  global orphans     : {len(miss)} missing / {len(orph)} stray")
    if on!=mani[ck] or not same or miss or orph: sys.exit("VERIFICATION FAILED")
    n=0
    for p in list(TEMP.iterdir()):          # no shell globs: an unmatched one aborts the line
        if p.is_file(): p.unlink(); n+=1
    print(f"  backed up to {dest}\n  temp-images emptied ({n} files)")
    return 0


if __name__=="__main__":
    sys.exit(main())

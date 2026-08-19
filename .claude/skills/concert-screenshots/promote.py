#!/usr/bin/env python3
"""Promote chosen screenshots into the vault.

The ONLY step in this pipeline that writes to the repo. Guardrails:

  * refuses unless the repo image/manifest state starts with zero orphans
  * refuses unless every show maps to a CONFIRMED shows.json record
  * backs up every file it replaces, with the old manifest entry
  * deletes surplus slot files (replacing 4 images with 3 must not orphan _04)
  * rewrites manifest entries as a contiguous [1..N]
  * never touches shows.json - asserts it is byte-identical afterwards
  * verifies globally, not just on what changed

  --apply actually writes; without it this is a dry run.
"""
from __future__ import annotations
import argparse, glob, hashlib, json, os, re, shutil, sys
from pathlib import Path

H     = Path.home()/"VaultShots"
REPO  = Path("/Users/ko/Desktop/Projects/the-vault")
IMGS  = REPO/"public"/"images"
MANI  = REPO/"public"/"image-manifest.json"
SHOWS = REPO/"public"/"shows.json"
BACKUP= H/"promote-backup"

# Drive-folder key fragment -> exact shows.json FolderName. Confirmed, not guessed.
# Kept in data/promote_map.json so the script is artist-agnostic; a value may be a
# plain string, or [folder, artist] when two records share one FolderName.
MAPFILE = H/"data"/"promote_map.json"
MAP = json.loads(MAPFILE.read_text(encoding="utf-8")) if MAPFILE.exists() else {}
MAP = {k:(tuple(v) if isinstance(v,list) else v) for k,v in MAP.items()}

ORDER = ["A","B","C","spare"]


def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def audit(mani):
    """Return (manifest entries with no file, files with no manifest entry)."""
    miss=[]; orph=[]
    for ck,slots in mani.items():
        for i in slots:
            if not (IMGS/("%s_%02d.jpg"%(ck,i))).exists(): miss.append("%s_%02d"%(ck,i))
    for p in IMGS.glob("*.jpg"):
        b=p.stem
        if "_" not in b: continue
        ck,idx=b.rsplit("_",1)
        try: idx=int(idx)
        except ValueError: continue
        if idx not in (mani.get(ck) or []): orph.append(b)
    return miss,orph


def propose_map():
    """Print a draft drive-folder -> shows.json FolderName mapping.

    Typing FolderName strings by hand is error-prone: one character wrong
    ("(Upgrade Version)" vs "(Upgrade)") and the show is silently skipped.
    This proposes matches by token overlap for a human to confirm, and never
    writes the map itself.
    """
    import unicodedata
    shows=json.loads(SHOWS.read_text(encoding="utf-8"))
    state=json.loads((H/"data/state.json").read_text(encoding="utf-8"))
    artist=state.get("artist","")
    mine=[s for s in shows if s.get("Artist")==artist]
    picks=json.loads((H/"data/picks.json").read_text(encoding="utf-8"))
    def toks(x):
        x=unicodedata.normalize("NFKD",x or "").encode("ascii","ignore").decode().casefold()
        return set(t for t in re.sub(r"[^a-z0-9]+"," ",x).split() if len(t)>1)
    atk=toks(artist)
    BY={s["key"]:s for s in state["shows"]}
    print("  // draft data/promote_map.json for %s - CONFIRM each line before using" % artist)
    print("  {")
    for frag in picks:
        ks=[k for k in BY if frag in k]
        drive=BY[ks[0]]["FolderName"] if ks else frag
        want=toks(drive)-atk
        best,score=None,0
        for sh in mine:
            n=len(want & (toks(sh.get("FolderName") or "")-atk))
            if n>score: best,score=sh,n
        flag="" if score>=2 else "   // WEAK MATCH - verify"
        print('    "%s": %s,%s' % (frag, json.dumps((best or {}).get("FolderName","?")), flag))
    print("  }")
    print("\n  %d shows.json records exist for %s:" % (len(mine),artist))
    for sh in sorted(mine,key=lambda x:(x.get("FolderName") or "")):
        print("     %r" % (sh.get("FolderName") or ""))


def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--apply",action="store_true")
    ap.add_argument("--propose-map",action="store_true")
    a=ap.parse_args()
    if a.propose_map: return propose_map() or 0

    shows=json.loads(SHOWS.read_text(encoding="utf-8"))
    shows_before=hashlib.sha256(SHOWS.read_bytes()).hexdigest()
    mani=json.loads(MANI.read_text(encoding="utf-8"))
    by_folder={(s.get("FolderName") or "").strip():s for s in shows}

    miss,orph=audit(mani)
    print("PRE-FLIGHT")
    print("  manifest entries with no file : %d" % len(miss))
    print("  files with no manifest entry  : %d" % len(orph))
    if miss or orph:
        sys.exit("REFUSING: repo already has orphans; fix those first.")

    picks=json.loads((H/"data/picks.json").read_text(encoding="utf-8"))
    state=json.loads((H/"data/state.json").read_text(encoding="utf-8"))
    BY={s["key"]:s for s in state["shows"]}

    plan=[]; skipped=[]
    for frag,sel in picks.items():
        folder=MAP.get(frag)
        if not folder:
            skipped.append((frag,"no confirmed shows.json record")); continue
        rec=by_folder.get(folder)
        if not rec:
            skipped.append((frag,"FolderName %r not in shows.json"%folder)); continue
        ck=(rec.get("ChecksumSHA1") or "").strip()
        if not ck:
            skipped.append((frag,"record has no checksum")); continue
        keys=[k for k in BY if frag in k]
        if not keys: skipped.append((frag,"no capture state")); continue
        srcs=[]
        for label,ts in sel:
            hits=glob.glob(str(H/"work"/keys[0]/("*_t%s.jpg"%ts)))
            if hits: srcs.append((label.split()[0],hits[0]))
        srcs.sort(key=lambda x: ORDER.index(x[0]) if x[0] in ORDER else 99)
        if not srcs: skipped.append((frag,"picks did not resolve")); continue
        plan.append({"frag":frag,"folder":folder,"ck":ck,"srcs":srcs,
                     "old":sorted(mani.get(ck) or []),
                     "old_files":sorted(p.name for p in IMGS.glob("%s_*.jpg"%ck))})

    print("\nPLAN  (%s)" % ("APPLY" if a.apply else "DRY RUN"))
    print("  %-40s %-13s %-9s %s" % ("SHOW","CHECKSUM","OLD->NEW","REPLACING"))
    for p in plan:
        print("  %-40s %-13s %d -> %-4d %s" % (p["folder"][:40],p["ck"][:12],
              len(p["old"]),len(p["srcs"]),",".join(str(i) for i in p["old"])))
    if skipped:
        print("\n  SKIPPED (left untouched, do these manually later):")
        for f,why in skipped: print("    %-34s %s" % (f[:34],why))
    if not a.apply:
        print("\n  dry run only - rerun with --apply"); return 0

    BACKUP.mkdir(parents=True,exist_ok=True)
    ledger={}
    for p in plan:
        ck=p["ck"]
        # 1. back up everything we are about to disturb
        for name in p["old_files"]:
            shutil.copy2(IMGS/name, BACKUP/name)
        ledger[ck]={"old_slots":p["old"],"old_files":p["old_files"]}
        # 2. write the new slots
        for i,(label,src) in enumerate(p["srcs"],1):
            shutil.copy2(src, IMGS/("%s_%02d.jpg"%(ck,i)))
        # 3. remove surplus slots  <-- the orphan step
        for name in p["old_files"]:
            idx=int(name.rsplit("_",1)[1].split(".")[0])
            if idx > len(p["srcs"]):
                (IMGS/name).unlink()
        # 4. manifest becomes a contiguous run
        mani[ck]=list(range(1,len(p["srcs"])+1))
    json.dump(ledger,open(BACKUP/"_ledger.json","w"),indent=1)

    MANI.write_text(json.dumps(mani,indent=2,ensure_ascii=False),encoding="utf-8")

    print("\nPOST-FLIGHT")
    miss,orph=audit(mani)
    print("  manifest entries with no file : %d" % len(miss))
    print("  files with no manifest entry  : %d" % len(orph))
    same = hashlib.sha256(SHOWS.read_bytes()).hexdigest()==shows_before
    print("  shows.json byte-identical     : %s" % same)
    bad=0
    for p in plan:
        ck=p["ck"]; on=sorted(int(x.stem.rsplit("_",1)[1]) for x in IMGS.glob("%s_*.jpg"%ck))
        if on!=mani[ck]: print("  MISMATCH %s disk=%s manifest=%s"%(ck[:12],on,mani[ck])); bad+=1
    print("  per-show disk/manifest agreement: %s" % ("all OK" if not bad else "%d BAD"%bad))
    if miss or orph or not same or bad: sys.exit("VERIFICATION FAILED")
    print("\n  promoted %d shows, backup in %s" % (len(plan),BACKUP))
    return 0

if __name__=="__main__": sys.exit(main())

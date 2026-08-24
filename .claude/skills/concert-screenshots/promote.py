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

def _dtoks(x):
    """Distinctive tokens: drop the format/geography noise that matches everywhere."""
    import unicodedata
    STOP = set("usa us uk ca ny la live band pro shot dvd dvdr tv hd hdtv ntsc pal ws "
               "concert show set master disc source the a of and".split())
    x = unicodedata.normalize("NFKD", x or "").encode("ascii","ignore").decode().casefold()
    x = x.replace("'", "")
    return set(w for w in re.sub(r"[^a-z0-9]+", " ", x).split() if len(w) > 1 and w not in STOP)


DIM,RED,RESET = "\033[2m","\033[31m","\033[0m"

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
        x=x.replace("'","").replace("\u2019","")   # "Jane's" -> "janes"; see shots.discover
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
    by_showid={(s.get("ShowID") or "").strip():s for s in shows}
    by_ck    ={(s.get("ChecksumSHA1") or "").strip():s for s in shows}

    def resolve(v):
        """A promote_map value -> exactly one shows.json record, or an error.

        Accepts a ShowID (12 hex), a ChecksumSHA1 (40 hex), a FolderName, or
        [FolderName, Artist]. FolderName alone is NOT unique: one folder can
        hold two shows (a split bill, or two concerts on one disc), and the
        previous dict-comprehension silently kept whichever came last in the
        file. For same-artist splits even [folder, artist] is ambiguous - use
        the ShowID. Ambiguity is always an error, never a guess.
        """
        if isinstance(v, (list, tuple)):
            folder = str(v[0]).strip(); artist = str(v[1]).strip() if len(v) > 1 else None
            c = [s for s in shows if (s.get("FolderName") or "").strip() == folder
                 and (artist is None or (s.get("Artist") or "").strip() == artist)]
        else:
            v = str(v).strip()
            if re.fullmatch(r"[0-9a-f]{12}", v, re.I):
                return (by_showid.get(v.lower()), None) if v.lower() in by_showid \
                       else (None, "ShowID %s not in shows.json" % v)
            if re.fullmatch(r"[0-9a-f]{40}", v, re.I):
                return (by_ck.get(v.lower()), None) if v.lower() in by_ck \
                       else (None, "checksum %s not in shows.json" % v)
            c = [s for s in shows if (s.get("FolderName") or "").strip() == v]
        if not c:
            return None, "no shows.json record for %r" % (v,)
        if len(c) > 1:
            return None, ("%r matches %d records (%s) - use a ShowID in promote_map"
                          % (v, len(c), ", ".join(x.get("ShowID","?") for x in c)))
        return c[0], None

    miss,orph=audit(mani)
    print("PRE-FLIGHT")
    # Promotion is the only step that writes to the repo, so it is the last place
    # an unmirrored aspect override can be stopped before it ships.
    import check_overrides
    if check_overrides.main() != 0:
        sys.exit("REFUSING: an aspect override is not reflected in its shows.json record.")
    # Slot A is ALWAYS a close-up of the lead singer (owner's rule). The scorer
    # cannot know who anyone is, so an auto-picked hero must never reach the repo
    # unreviewed - it has shipped a presenter, a reporter, a caller, the bassist
    # and a keyboardist before now. Flag a show in data/no_closeup.json when the
    # singer genuinely has no usable close-up; that is the owner's call, not ours.
    import hero_gate
    if hero_gate.check():
        sys.exit("REFUSING: at least one hero is unconfirmed. Choose it, verify it at "
                 ">=340px, record it in data/hero_verified.json, or flag the show in "
                 "data/no_closeup.json with a reason.")
    print("  manifest entries with no file : %d" % len(miss))
    print("  files with no manifest entry  : %d" % len(orph))
    if miss or orph:
        sys.exit("REFUSING: repo already has orphans; fix those first.")

    picks=json.loads((H/"data/picks.json").read_text(encoding="utf-8"))
    state=json.loads((H/"data/state.json").read_text(encoding="utf-8"))
    BY={s["key"]:s for s in state["shows"]}

    # A discovered folder whose record EXISTS but was never linked is a bug that
    # promotes to a silent skip: the show simply never reaches the repo and the run
    # still reports cleanly. It cost a near-miss on two consecutive artists, caught
    # both times only because someone asked "is anything missing?". Fail loudly.
    #
    # A blank ShowID is only a bug when a matching record exists. A folder on the
    # drive with no record at all is legitimate (it is how new shows are found), so
    # that case warns instead.
    artist = state.get("artist","")
    by_folder = {}
    for s in shows:
        by_folder.setdefault((s.get("FolderName") or "").strip(), []).append(s)
    unlinked, no_record, ambiguous, near = [], [], [], []
    for e in state["shows"]:
        if (e.get("ShowID") or "").strip():
            continue
        fn = (e.get("FolderName") or "").strip()
        cand = [c for c in by_folder.get(fn, []) if (c.get("Artist") or "") == artist] \
               or by_folder.get(fn, [])
        if len(cand) == 1:   unlinked.append((e["key"], fn, cand[0]["ShowID"]))
        elif len(cand) > 1:  ambiguous.append((e["key"], fn, len(cand)))
        else:
            # An EXACT FolderName match is not the only way a record exists. A drive
            # folder "Offspring - Live Wembley 2001" had a record named after the
            # disc label, "DVD-Offspring-LiveWembley2001" - no exact match, so the
            # first version of this gate waved it through as "a new show" and the
            # show was silently skipped. Fall back to distinctive-token overlap
            # against the artist's UNCLAIMED records before believing that.
            claimed = {(x.get("ShowID") or "").strip() for x in state["shows"]}
            free = [c for c in shows if (c.get("Artist") or "") == artist
                    and (c.get("ShowID") or "") not in claimed]
            want = _dtoks(fn) - _dtoks(artist)
            best, score = None, 0
            for c in free:
                rfn = c.get("FolderName") or ""
                rt  = _dtoks(rfn) - _dtoks(artist)
                n   = len(want & rt)
                # A record may SQUASH the name into one token ("LiveWembley2001"),
                # which scores 0 on token overlap - the same squashed-name failure
                # as artist matching (SS2). Also count folder tokens that appear as
                # substrings of the record's separator-stripped name.
                squashed = re.sub(r"[^a-z0-9]+", "", rfn.casefold())
                n = max(n, sum(1 for w in want if len(w) >= 4 and w in squashed))
                if n > score: best, score = c, n
            if best is not None and score >= 2:
                near.append((e["key"], fn, best["ShowID"], best.get("FolderName") or "", score))
            else:
                no_record.append((e["key"], fn))

    print("  discovered folders            : %d" % len(state["shows"]))
    print("  folders with no shows.json id : %d" % (len(unlinked)+len(no_record)+len(ambiguous)))
    if no_record:
        print("  %sNOTE%s these folders have no record at all - new shows, not a linking bug:"
              % (DIM, RESET))
        for k, fn in no_record: print("      %s" % (fn or k))
    if ambiguous:
        print("  %sAMBIGUOUS%s FolderName matches >1 record - link by ShowID by hand:" % (RED, RESET))
        for k, fn, n in ambiguous: print("      %-52s %d records" % (fn[:52], n))
    if unlinked:
        print("  %sUNLINKED%s a matching record EXISTS but state.json has no ShowID:" % (RED, RESET))
        for k, fn, sid in unlinked: print("      %-52s -> %s" % (fn[:52], sid))
    if near:
        print("  %sPROBABLE MATCH%s no exact FolderName match, but an unclaimed record shares "
              "%d+ distinctive tokens:" % (RED, RESET, 2))
        for k, fn, sid, rfn, n in near:
            print("      %-44s" % fn[:44])
            print("        -> %s  %-44s (%d tokens)" % (sid, rfn[:44], n))
    if unlinked or ambiguous or near:
        sys.exit("REFUSING: %d discovered folder(s) are not linked to their records; they would "
                 "be skipped in silence. Set state.json ShowID for each (the id is printed above "
                 "when it is unambiguous) and re-run." % (len(unlinked)+len(ambiguous)+len(near)))

    # Coverage: every record for this artist that is NOT going to be written.
    # Exclusions are legitimate (wrong-artist discs, music videos), so this reports
    # rather than blocks - but it must be SAID, never left to be noticed.
    mine = [s for s in shows if (s.get("Artist") or "") == artist]
    covered = {(BY[k].get("ShowID") or "").strip() for k in picks if k in BY}
    uncovered = [s for s in mine if s["ShowID"] not in covered]
    print("  records for %-18s : %d, of which %d have picks"
          % (artist[:18], len(mine), len(mine)-len(uncovered)))
    if uncovered:
        print("  %sNO PICKS%s these records will not be touched:" % (DIM, RESET))
        for s in uncovered: print("      %-12s %s" % (s["ShowID"], (s.get("FolderName") or "")[:56]))

    plan=[]; skipped=[]
    for frag,sel in picks.items():
        folder=MAP.get(frag)
        if not folder:
            skipped.append((frag,"no confirmed shows.json record")); continue
        rec,err=resolve(folder)
        if not rec:
            skipped.append((frag,err)); continue
        folder=(rec.get("FolderName") or "").strip()
        ck=(rec.get("ChecksumSHA1") or "").strip()
        if not ck:
            skipped.append((frag,"record has no checksum")); continue
        keys=[k for k in BY if frag in k]
        if not keys: skipped.append((frag,"no capture state")); continue
        srcs=[]
        for label,ts in sel:
            tag=label.split()[0]
            # picks/ is the SOURCE OF TRUTH (SKILL.md 12); work/ is disposable and
            # is pruned or reset by `archive`. Resolving only from work/ meant a
            # hand-edit made directly to a staged pick never reached the repo, and
            # an archived artist could not be re-promoted at all - the show was
            # silently dropped from the plan with "picks did not resolve".
            staged=glob.glob(str(H/"picks"/("*_%s__%s.jpg"%((rec.get("ShowID") or "")[:6],tag))))
            if len(staged)==1:
                srcs.append((tag,staged[0])); continue
            if len(staged)>1:
                skipped.append((frag,"%d staged picks match __%s"%(len(staged),tag))); srcs=[]; break
            hits=glob.glob(str(H/"work"/keys[0]/("*_t%s.jpg"%ts)))
            if hits: srcs.append((tag,hits[0]))
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

"""Finds, by content, the records the drive scan couldn't find by name or size. READ-ONLY.

    python3 tools/drive-scan/hashfind.py      # then: python3 tools/drive-scan/scan.py --resume --refind

A record's ChecksumSHA1 is the SHA1 of its RepVideoFiles, in order, as the catalogue hashed them
(data-pipeline/01_scan_hd_shows: sha1_of_files_in_order). For each record still not found, every
folder on the drive whose name carries the artist (or its initials) and holds those same relative
files is hashed until one matches. A match is proof: same bytes, whatever the folder is called now.
Writes ~/VaultShots/drive-scan/hashfound.json: {ShowID: folder}. Slow only where it hashes (about
10 s per GB over USB), so it hashes nothing it can rule out by name first.
"""
import hashlib, json, re, sys, unicodedata
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
DRIVE = Path('/Volumes/Live Music')
SCAN = Path.home() / 'VaultShots' / 'drive-scan' / 'scan.json'
OUT = Path.home() / 'VaultShots' / 'drive-scan' / 'hashfound.json'
norm = lambda s: re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower())


def initials(name):
    words = [w for w in re.split(r'\s+', name) if w]
    return ''.join(w[0] for w in words).lower() if len(words) >= 2 else ''


def sha1(paths):
    h = hashlib.sha1()
    for p in paths:
        with open(p, 'rb') as fh:
            while True:
                b = fh.read(1 << 20)
                if not b:
                    break
                h.update(b)
    return h.hexdigest()


def folders():
    """Every folder two levels down, with its name and its parent's, for matching the artist."""
    out = []
    for top in DRIVE.iterdir():
        if top.name.startswith('.') or not top.is_dir():
            continue
        out.append((top, norm(top.name)))
        try:
            out += [(sub, norm(top.name) + norm(sub.name)) for sub in top.iterdir() if sub.is_dir() and not sub.name.startswith('.')]
        except OSError:
            pass
    return out


def main():
    shows = {s['ShowID']: s for s in json.load(open(REPO / 'public' / 'shows.json', encoding='utf-8'))}
    missing = [r['ShowID'] for r in json.load(open(SCAN)) if not r.get('found')]
    found = json.load(open(OUT)) if OUT.exists() else {}
    all_folders = folders()
    for n, sid in enumerate(missing, 1):
        if sid in found:
            continue
        s = shows[sid]
        rep = [r.strip() for r in (s.get('RepVideoFiles') or '').split(';') if r.strip()]
        want = (s.get('ChecksumSHA1') or '').lower()
        if not rep or len(want) != 40:
            print(f'{n}/{len(missing)} {sid} {s["Artist"]}: no checksum or files to match')
            continue
        keys = {norm(s['Artist']), initials(s['Artist'])} - {''}
        cands = [f for f, name in all_folders if any(k in name for k in keys) and all((f / r).is_file() for r in rep)]
        hit = None
        for f in cands:
            try:
                if sha1([f / r for r in rep]) == want:
                    hit = f
                    break
            except OSError:
                continue
        print(f'{n}/{len(missing)} {sid} {s["Artist"]}: {len(cands)} candidates, {"found " + str(hit.relative_to(DRIVE)) if hit else "no match"}', flush=True)
        if hit:
            found[sid] = str(hit)
            json.dump(found, open(OUT, 'w'), indent=1, ensure_ascii=False)
    json.dump(found, open(OUT, 'w'), indent=1, ensure_ascii=False)
    print(f'{len(found)} found by content, written to {OUT}')


if __name__ == '__main__':
    sys.exit(main())

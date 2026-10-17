"""The drive scan (docs/ux-research, "Planned: a drive scan for the missing specs").

    python3 tools/drive-scan/scan.py                 # every visible record (about half an hour over USB)
    python3 tools/drive-scan/scan.py --artist "Muse"  # one artist
    python3 tools/drive-scan/scan.py --resume         # skip records already in the staging file

READ-ONLY on the drive and on the repo: it reads each record's own files on /Volumes/Live Music
(found with ~/VaultShots/doc_sweep.py's locate(), the same way the capture tools find them) and
writes ~/VaultShots/drive-scan/scan.json. Nothing reaches public/shows.json until the owner has
seen tools/drive-scan/page.py's review and a separate step applies it.

Per record: frame rate and scan (interlaced / progressive) from the video stream; the show's own
size (its own files, not the folder); its duration (a DVD's IFO, which is right where VOB headers
are not); overall, video and audio bitrate; for DVDs, the disc type (DVD-5 / DVD-9 from the size of
the VIDEO_TS the files sit in), whether it has a menu, and its chapters. Also where the source
disagrees with the record (picture size, length), which the review flags.
"""
import argparse, json, os, re, subprocess, sys, time
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
VAULTSHOTS = Path.home() / 'VaultShots'
OUT = VAULTSHOTS / 'drive-scan' / 'scan.json'
sys.path.insert(0, str(VAULTSHOTS))
from doc_sweep import DRIVE, locate      # noqa: E402  the capture tools' own resolver
from dvd_chapters import titleset         # noqa: E402  chapters from a titleset's IFO

DVD5, DVD9 = 4.7e9, 8.54e9
DVD_MAX_KBPS = 10_080  # a DVD's ceiling, video and audio together
INDEX = VAULTSHOTS / 'drive-scan' / 'sizes.json'
_hf = VAULTSHOTS / 'drive-scan' / 'hashfound.json'
HASHFOUND = json.load(open(_hf)) if _hf.exists() else {}  # tools/drive-scan/hashfind.py


def size_index():
    """Every folder and file on the drive, two levels down, by exact size in bytes.

    Folders were renamed when the collection moved to Live Music ('30STM EMAs' is now
    '30 Seconds to Mars - EMAs'), so a stored name can miss; a folder moved whole keeps
    its exact size, which every record stored at catalogue time as TotalSizeBytes.
    """
    if INDEX.exists():
        return {int(k): v for k, v in json.load(open(INDEX)).items()}
    def total(p):
        n = 0
        for root, _, fs in os.walk(p):
            for f in fs:
                try:
                    n += os.path.getsize(os.path.join(root, f))
                except OSError:
                    pass
        return n
    idx = {}
    for top in os.scandir(DRIVE):
        if top.name.startswith('.'):
            continue
        paths = [top] + ([e for e in os.scandir(top.path) if not e.name.startswith('.')] if top.is_dir() else [])
        for e in paths:
            try:
                n = total(e.path) if e.is_dir() else e.stat().st_size
            except OSError:
                continue
            idx.setdefault(n, []).append(e.path)
    INDEX.parent.mkdir(parents=True, exist_ok=True)
    json.dump({str(k): v for k, v in idx.items()}, open(INDEX, 'w'))
    return idx


def by_size(show, idx):
    """The record's folder found by its exact size, confirmed by holding its own video files."""
    try:
        n = int(show.get('TotalSizeBytes') or 0)
    except ValueError:
        return None, []
    rep = [r.strip() for r in (show.get('RepVideoFiles') or '').split(';') if r.strip()]
    for path in idx.get(n, []):
        p = Path(path)
        if p.is_file():
            return p.parent, [p]
        files = [p / r for r in rep]
        if files and all(f.exists() for f in files):
            full = []
            for f in files:
                m = re.match(r'(VTS_\d+)_\d+\.VOB$', f.name, re.I)
                parts = sorted(f.parent.glob(m.group(1) + '_[1-9].VOB')) if m else [f]
                full += [q for q in parts if q not in full]
            return p, full
    return None, []


def rate_name(r):
    """'25/1' -> '25', '30000/1001' -> '29.97'."""
    try:
        n, d = (int(x) for x in r.split('/'))
        v = n / d if d else 0
    except (ValueError, AttributeError):
        return ''
    if not v or v > 120:
        return ''
    return str(int(v)) if abs(v - round(v)) < 0.01 else f'{v:.3f}'.rstrip('0').rstrip('.')


def probe(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)],
                       capture_output=True, text=True, timeout=180)
    if r.returncode != 0:
        return None
    try:
        return json.loads(r.stdout)
    except json.JSONDecodeError:
        return None


def audio_kbps(st):
    if st.get('bit_rate', '').isdigit():
        return round(int(st['bit_rate']) / 1000)
    if (st.get('codec_name') or '').startswith('pcm'):
        bits = int(st.get('bits_per_raw_sample') or st.get('bits_per_sample') or 16)
        return round(int(st.get('sample_rate') or 48000) * int(st.get('channels') or 2) * bits / 1000)
    return None


def scan(show, idx):
    rec = {'ShowID': show['ShowID'], 'Artist': show['Artist'], 'ShowDate': show.get('ShowDate') or ''}
    try:
        folder, files = locate(show)
    except Exception as e:  # an unreadable folder must not stop the run
        folder, files = None, []
        rec['error'] = f'locate: {e}'
    files = [f for f in files if f.is_file()]
    how = 'name'
    hashed = HASHFOUND.get(show['ShowID'])
    if hashed and (not files or folder is None):
        p = Path(hashed)
        rep_files = [p / r.strip() for r in (show.get('RepVideoFiles') or '').split(';') if r.strip()]
        full = []
        for f in rep_files:
            m = re.match(r'(VTS_\d+)_\d+\.VOB$', f.name, re.I)
            parts = sorted(f.parent.glob(m.group(1) + '_[1-9].VOB')) if m else [f]
            full += [q for q in parts if q not in full]
        if full:
            folder, files, how = p, full, 'content'
    if not files or folder is None:
        f2, files2 = by_size(show, idx)
        if files2:
            folder, files, how = f2, files2, 'size'
    if not files:
        rec['found'] = False
        return rec
    rec['found'] = True
    rec['matched_by'] = how
    rec['approximate'] = folder is None          # locate fell back to the folder's main titleset
    rec['paths'] = [str(f.relative_to(DRIVE)) for f in files]
    rec['files'] = len(files)
    rec['own_bytes'] = sum(f.stat().st_size for f in files)
    first = files[0]
    rec['container'] = first.suffix.lower()
    info = probe(first) or {}
    streams = info.get('streams') or []
    v = next((s for s in streams if s.get('codec_type') == 'video'), None)
    if v:
        rec['codec'] = v.get('codec_name')
        rec['width'], rec['height'] = v.get('width'), v.get('height')
        rec['frame_rate'] = rate_name(v.get('r_frame_rate') or v.get('avg_frame_rate') or '')
        fo = (v.get('field_order') or '').lower()
        rec['scan'] = 'interlaced' if fo in ('tt', 'bb', 'tb', 'bt') else 'progressive' if fo == 'progressive' else ''
    rec['audio'] = [{'codec': s.get('codec_name'), 'channels': s.get('channels'), 'kbps': audio_kbps(s),
                     'lang': (s.get('tags') or {}).get('language')} for s in streams if s.get('codec_type') == 'audio']

    # Duration: a DVD titleset's IFO is right where VOB headers often are not.
    duration = None
    m = re.match(r'(VTS_\d+)_\d+\.VOB$', first.name, re.I)
    if m:
        ifo = first.parent / f'{m.group(1)}_0.IFO'
        if ifo.is_file():
            try:
                best = titleset(ifo)
                if best:
                    duration = best[0]
                    rec['chapters'] = len(best[1])
            except Exception as e:
                rec['ifo_error'] = str(e)
        vts = first.parent
        disc = sum(f.stat().st_size for f in vts.iterdir() if f.is_file())
        rec['disc_bytes'] = disc
        rec['disc_type'] = 'DVD-5' if disc <= DVD5 else 'DVD-9' if disc <= DVD9 else 'more than a DVD-9'
        menu = [f for f in vts.glob('VIDEO_TS.VOB')] + [f for f in vts.glob('VTS_*_0.VOB')]
        rec['menu'] = any(f.stat().st_size > 200_000 for f in menu)
    elif (first.parent.name.upper() == 'STREAM' and (first.parent.parent / 'PLAYLIST').is_dir()) or 'BDMV' in first.parts:
        rec['disc_type'] = 'Blu-ray'
    else:
        rec['disc_type'] = 'File'
    if duration is None:
        try:
            duration = float((info.get('format') or {}).get('duration') or 0) or None
        except ValueError:
            duration = None
        if len(files) > 1 and duration:
            duration = None  # one part's header is not the programme's length
    if duration is None:
        duration = float(show.get('DurationSec') or 0) or None
        rec['duration_from'] = 'record'
    rec['duration'] = round(duration, 1) if duration else None
    if duration and rec['own_bytes']:
        overall = rec['own_bytes'] * 8 / duration / 1000
        rec['overall_kbps'] = round(overall)
        audio = sum(a['kbps'] or 0 for a in rec['audio'])
        # The average, from size and length: an MPEG-2 header gives the ceiling (9800), not this.
        rec['video_kbps'] = round(overall - audio) if overall > audio else None

    # Where the source disagrees with the record.
    flags = []
    try:
        if v and show.get('Height') and int(show['Height']) and v.get('height') and int(show['Height']) != int(v['height']):
            flags.append(f"height: record {show['Height']}, source {v['height']}")
    except (TypeError, ValueError):
        pass
    try:
        rd = float(show.get('DurationSec') or 0)
        if rd and duration and abs(rd - duration) / max(rd, duration) > 0.1 and not show.get('ParentShowID'):
            flags.append(f"length: record {round(rd / 60)} min, source {round(duration / 60)} min")
    except (TypeError, ValueError):
        pass
    if rec.get('disc_type', '').startswith('DVD') and rec.get('overall_kbps') and rec['overall_kbps'] > DVD_MAX_KBPS:
        flags.append(f"bitrate {rec['overall_kbps']} kbps is beyond a DVD's: the length is wrong")
    rec['flags'] = flags
    return rec


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--artist')
    ap.add_argument('--resume', action='store_true')
    ap.add_argument('--refind', action='store_true', help='with --resume: rescan records not found before')
    a = ap.parse_args()
    if not DRIVE.is_dir():
        sys.exit(f'{DRIVE} is not mounted')
    shows = [s for s in json.load(open(REPO / 'public' / 'shows.json', encoding='utf-8')) if s.get('Hidden') != 'Yes']
    if a.artist:
        shows = [s for s in shows if s['Artist'] == a.artist]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    done = {}
    if a.resume and OUT.exists():
        done = {r['ShowID']: r for r in json.load(open(OUT)) if r.get('found') or not a.refind}
    t0 = time.time()
    results = dict(done)
    todo = [s for s in shows if s['ShowID'] not in done]
    t1 = time.time()
    idx = size_index()
    print(f'size index: {sum(len(v) for v in idx.values())} folders and files ({time.time() - t1:.0f}s)', flush=True)
    for i, show in enumerate(todo, 1):
        results[show['ShowID']] = scan(show, idx)
        if i % 25 == 0 or i == len(todo):
            json.dump(list(results.values()), open(OUT, 'w'), indent=1, ensure_ascii=False)
            found = sum(1 for r in results.values() if r.get('found'))
            print(f'{i}/{len(todo)} scanned, {found} found on the drive, {time.time() - t0:.0f}s', flush=True)
    # Records cut from one titleset share its files: their size is not their own.
    share = {}
    for r in results.values():
        if r.get('paths'):
            share.setdefault(tuple(r['paths']), []).append(r['ShowID'])
    for r in results.values():
        r['shared'] = len(share.get(tuple(r.get('paths') or ()), [])) > 1
    json.dump(list(results.values()), open(OUT, 'w'), indent=1, ensure_ascii=False)
    print(f'Wrote {OUT}: {len(results)} records')


if __name__ == '__main__':
    main()

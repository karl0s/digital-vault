#!/usr/bin/env python3
"""Runtime sweep for documentary classification. READ-ONLY on the drive.

For each ShowID: locate its media on /Volumes/Live Music, decode keyframes only
(no seeking, so DVD timestamp bugs cannot land frames in the wrong place), keep
48 evenly spaced across the record's own files, and tile them 8x6 at 132px.
Output goes to the scratchpad, never the repo or the drive.

usage: doc_sweep.py SHOWID [SHOWID ...]
"""
import json, re, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

REPO = Path('/Users/ko/Desktop/Projects/the-vault')
DRIVE = Path('/Volumes/Live Music')
OUT = Path.home() / 'VaultShots' / 'doc_sweeps'
N_FRAMES, COLS, TW = 48, 8, 132
norm = lambda x: re.sub(r'[^a-z0-9]', '', x.lower())


def locate(show):
    """Folder on Live Music holding this record's RepVideoFiles, or None."""
    fp = Path(show['FolderPath'])
    rep = [r.strip() for r in (show.get('RepVideoFiles') or '').split(';') if r.strip()]
    cands = []
    if str(fp).startswith(str(DRIVE)):
        cands.append(fp)
    parts = fp.parts[3:] if len(fp.parts) > 3 else fp.parts[-1:]
    for i in range(len(parts)):
        cands.append(DRIVE.joinpath(*parts[i:]))
    # fuzzy: same normalised name at top level or one level down
    # Live Music often prefixes the artist: "A Perfect Circle - Phoenix + ..."
    art = norm(show['Artist'])
    keys = [norm(p) for p in parts]
    for top in DRIVE.iterdir():
        if top.name.startswith('._'): continue  # macOS AppleDouble sidecar
        t = norm(top.name)
        for k, key in enumerate(keys):
            if key and t in (key, art + key):
                cands.append(top)
                if parts[k + 1:]:
                    cands.append(top.joinpath(*parts[k + 1:]))
    for c in cands:
        if c.is_file() and (not rep or c.name == rep[0] or len(rep) == 1):
            return c.parent, [c]
        if c.is_dir():
            files = [c / r for r in rep] if rep else []
            if files and all(f.exists() for f in files):
                # RepVideoFiles often names only the first VOB part of a
                # titleset; the programme is every part of that titleset.
                full = []
                for f in files:
                    m = re.match(r'(VTS_\d+)_\d+\.VOB$', f.name, re.I)
                    parts = sorted(f.parent.glob(m.group(1) + '_[1-9].VOB')) if m else [f]
                    full += [p for p in parts if p not in full]
                return c, full
    # Same folder, authored differently on this drive: fall back to its main
    # (largest) titleset. The caller marks the result approximate.
    for c in cands:
        if c.is_dir():
            sets = {}
            for v in c.glob('**/VTS_*_[1-9].VOB'):
                sets.setdefault(v.parent / v.name[:6], []).append(v)
            if sets:
                main = max(sets.values(), key=lambda vs: sum(v.stat().st_size for v in vs))
                return None, sorted(main)
    return None, []


def probe_duration(files):
    tot = 0.0
    for f in files:
        r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                            '-of', 'csv=p=0', str(f)], capture_output=True, text=True)
        try: tot += float(r.stdout.strip())
        except ValueError: pass
    return tot




def sweep(show, font):
    folder, files = locate(show)
    if not files:
        return {'id': show['ShowID'], 'status': 'not_on_drive'}
    dur = float(show.get('DurationSec') or 0) or probe_duration(files)
    vobs = all(f.suffix.upper() == '.VOB' for f in files)
    src = 'concat:' + '|'.join(str(f) for f in files) if vobs and len(files) > 1 else str(files[0])
    def grab(sel, tmp):
        for f in Path(tmp).glob('f_*.jpg'): f.unlink()
        subprocess.run(['ffmpeg', '-v', 'error', '-skip_frame', 'nokey', '-i', src,
                        '-vf', f"select='{sel}',scale={TW}:-2",
                        '-vsync', 'vfr', '-frames:v', str(N_FRAMES + 4), '-q:v', '4',
                        f'{tmp}/f_%03d.jpg'], capture_output=True, timeout=1800)
        return sorted(Path(tmp).glob('f_*.jpg'))[:N_FRAMES]

    def sample_fast(tmp):
        """48 single keyframes at evenly spaced points, reading ~3 MB at each.

        MPEG streams (VOB, TS) are sampled by BYTE position through the
        subfile protocol, so broken container timestamps cannot misplace a
        frame; other containers seek by time against their own index.
        """
        out = []
        body = [f for f in files if not f.name.upper().endswith('_0.VOB')] or files
        mpeg = all(f.suffix.upper() in ('.VOB', '.TS', '.MPG', '.MPEG', '.M2TS', '.M2T') for f in body)
        sizes = [f.stat().st_size for f in body]
        total = sum(sizes)
        for k in range(N_FRAMES):
            dst = f'{tmp}/f_{k:03d}.jpg'
            if mpeg:
                pos = int((k + 0.5) / N_FRAMES * total)
                for f, sz in zip(body, sizes):
                    if pos < sz: break
                    pos -= sz
                tries = [['-i', f'subfile,,start,{pos},end,{min(sz, pos + n)},,:{f}'] for n in (1_500_000, 5_000_000)]
            else:
                tries = [['-ss', f'{(k + 0.5) / N_FRAMES * (dur or 3600):.2f}', '-i', str(body[0])]]
            for inp in tries:
                subprocess.run(['ffmpeg', '-v', 'error', '-skip_frame', 'nokey', *inp, '-frames:v', '1',
                                '-vf', f'scale={TW}:-2', '-q:v', '4', '-y', dst], capture_output=True, timeout=120)
                if Path(dst).exists():
                    out.append(Path(dst)); break
        return out

    with tempfile.TemporaryDirectory() as tmp:
        frames = sample_fast(tmp)
        # Time-spaced keyframes over a full decode; if container timestamps are
        # broken the count comes up short, so fall back to keyframe count.
        step_t = max(1.0, (dur or 3600) / N_FRAMES)
        if len(frames) < N_FRAMES * 0.3:
            frames = grab(f"isnan(prev_selected_t)+gte(t-prev_selected_t\\,{step_t:.2f})", tmp)
        if len(frames) < N_FRAMES * 0.3:
            r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
                                '-show_entries', 'packet=flags', '-of', 'csv=p=0', src],
                               capture_output=True, text=True, timeout=1800)
            nkey = sum(1 for l in r.stdout.splitlines() if 'K' in l)
            if nkey:
                alt = grab(f"not(mod(n\\,{max(1, nkey // N_FRAMES)}))", tmp)
                if len(alt) > len(frames): frames = alt
        if not frames:
            return {'id': show['ShowID'], 'status': 'decode_failed', 'src': src}
        ims = [Image.open(f).convert('RGB') for f in frames]
        th = max(i.height for i in ims)
        rows = (len(ims) + COLS - 1) // COLS
        sheet = Image.new('RGB', (COLS * (TW + 2), rows * (th + 2)), (30, 30, 30))
        dr = ImageDraw.Draw(sheet)
        for k, im in enumerate(ims):
            x, y = (k % COLS) * (TW + 2), (k // COLS) * (th + 2)
            sheet.paste(im, (x, y))
            dr.text((x + 2, y + 1), str(k + 1), fill=(255, 220, 0), font=font)
        OUT.mkdir(exist_ok=True)
        out = OUT / f"{show['ShowID']}.jpg"
        sheet.save(out, quality=85)
    return {'id': show['ShowID'], 'status': 'ok', 'approx': folder is None, 'frames': len(ims), 'dur': round(dur),
            'src': src[:200], 'sheet': str(out)}


if __name__ == '__main__':
    shows = {s['ShowID']: s for s in json.load(open(REPO / 'public/shows.json'))}
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 12)
    OUT.mkdir(parents=True, exist_ok=True)
    log = OUT / 'sweep_log.jsonl'
    for sid in sys.argv[1:]:
        try:
            res = sweep(shows[sid], font)
        except Exception as e:  # keep going; one bad file must not stop the batch
            res = {'id': sid, 'status': 'error', 'err': str(e)[:200]}
        print(json.dumps(res), flush=True)
        with open(log, 'a') as fh:
            fh.write(json.dumps(res) + '\n')

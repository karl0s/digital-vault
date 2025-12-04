#!/usr/bin/env python3
"""
catalog_shows_v3_2.py

Ventura-safe, read-only cataloger for concert show folders.

This version adds robust, heuristic parsing for Event/Venue/City/Country
from free-form info files and folder names. It avoids relying solely on
explicit "Venue:" or "Location:" anchors, improving coverage for
real-world notes.

Adds over v3.1:
- Smarter location parsing supporting comma-separated and stacked formats
- "Event – Venue" line detection with next-line City/Region
- Region→Country inference (US states, CA provinces, AU states, etc.)
- Light-touch warnings to indicate inference paths used
- All previous v3.1 features retained
"""

import argparse
import csv
import json
import os
import re
import shlex
import subprocess
import sys
import hashlib
import platform
from pathlib import Path
from datetime import datetime
from typing import List, Tuple, Dict, Optional

# Optional packages improve text extraction
try:
    import textract  # handles .doc and .rtf (not required on macOS due to textutil)
except Exception:
    textract = None
try:
    from docx import Document  # handles .docx
except Exception:
    Document = None

# ====== Formats ======
VIDEO_EXTS = {".vob", ".ts", ".mpg", ".mpeg", ".m2ts", ".mp4", ".m4v", ".avi", ".mov", ".mkv", ".wmv"}
TEXT_EXTS = {".txt", ".nfo", ".docx", ".doc", ".rtf"}

# ===== Artist detection support =====
BAND_NAMES = [
    "30 Seconds to Mars", "Aerosmith", "Alanis Morissette", "Alice In Chains", "Arctic Monkeys",
    "Army of Anyone", "Ash", "Audioslave", "Beastie Boys", "Beck",
    "Ben Harper & The Innocent Criminals", "Billy Corgan", "Black Crowes", "Blind Melon",
    "Blink 182", "Bloodhound Gang", "Blur", "Bon Jovi",
    "Bruce Springsteen & the E Street Band", "Bush", "The Cardigans", "The Cars", "Cat Stevens",
    "Chris Cornell", "Coldplay", "Counting Crows", "Creed", "Creedence Clearwater Revival",
    "Crowded House", "The Dandy Warhols", "Dave Navarro", "Deep Purple", "Deftones", "Dire Straits",
    "Editors", "Erykah Badu", "Everclear", "Evermore", "Faith No More", "The Feelers", "Filter",
    "Flight Of The Conchords", "Fly My Pretties", "Foo Fighters", "Franz Ferdinand", "The Fray",
    "Fu Manchu", "Fuel", "Fun Lovin' Criminals", "Green Day", "Grinspoon", "Guns N' Roses",
    "Hed PE", "Hole", "Incubus", "Jamiroquai", "Jane's Addiction", "Jay-Z", "Jeff Buckley",
    "Jessica Mauboy", "Jet", "John Butler Trio", "John Fogerty", "Kaiser Chiefs", "Kanye West",
    "Kelly Jones", "The Killers", "Kings Of Leon", "The Kinks", "Kiss", "Korn", "KT Tunstall",
    "Lady Gaga", "Ladyhawke", "Led Zeppelin", "Lenny Kravitz", "Limp Bizkit", "Live",
    "Manic Street Preachers", "Marcy Playground", "Marilyn Manson", "The Mars Volta",
    "Mercury Crowe", "Metallica", "Michael Jackson", "Millencolin", "Moby", "Motörhead", "Muse",
    "Nickelback", "Nirvana", "Oasis", "The Offspring", "Orgy", "Our Lady Peace", "Papa Roach",
    "Pearl Jam", "A Perfect Circle", "The Police", "Portishead", "Powderfinger",
    "Presidents of the United States of America", "Prodigy", "Queen", "Queens of the Stone Age",
    "Queensrÿche", "R.E.M.", "The Raconteurs", "Radiohead", "Rage Against the Machine",
    "Red Hot Chili Peppers", "Rob Zombie", "Rolling Stones", "Scott Weiland", "Sheryl Crow",
    "Shihad", "Sia", "Silverchair", "Smashing Pumpkins", "Snoop Dogg", "Soundgarden",
    "Spiritualized", "Staind", "Steppenwolf", "Stereophonics", "Stone Temple Pilots", "The Strokes",
    "Sum 41", "Supergrass", "Them Crooked Vultures", "Third Eye Blind", "Tool", "Train", "U2",
    "Velvet Revolver", "The Verve", "The Vines", "Weezer", "White Stripes", "Wolfmother", "Zwan",
    "ZZ Top"
]

BAND_ALIASES = {
    "RHCP": "Red Hot Chili Peppers",
    "QOTSA": "Queens of the Stone Age",
    "REM": "R.E.M.",
    "STP": "Stone Temple Pilots",
    "POTUSA": "Presidents of the United States of America",
    "TPOTUSA": "Presidents of the United States of America",
    "GNR": "Guns N' Roses"
}

_norm_punct = re.compile(r"[\s\-_.,:;!/\\]+")
_norm_apos = re.compile(r"[’'`]")

def _normalize_for_match(s: str) -> str:
    s = _norm_apos.sub("", s.lower())
    s = _norm_punct.sub(" ", s)
    return " ".join(s.split())


def _compile_band_patterns(names: List[str]) -> List[Tuple[str, re.Pattern, str]]:
    prepared = []
    for n in names:
        n_norm = _normalize_for_match(n)
        tokens = [re.escape(t) for t in n_norm.split()]
        pat = r"\b" + r"\s+".join(tokens) + r"\b"
        prepared.append((n, re.compile(pat, re.IGNORECASE), n_norm))
    prepared.sort(key=lambda t: len(t[2]), reverse=True)
    return prepared


_BAND_PATTERNS = _compile_band_patterns(BAND_NAMES + list(BAND_ALIASES.keys()))

DATE_PATTERNS = [
    r'\b(\d{4})[-/\.]([\d]{1,2})[-/\.]([\d]{1,2})\b',
    r'\b(\d{1,2})[-/\.]([\d]{1,2})[-/\.]([\d]{2,4})\b',
    r'\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b',
]

SETLIST_ANCHORS = re.compile(r'^(setlist|tracklist|tracks|songs)\s*:?\s*$', re.IGNORECASE)
NON_SONG_HINTS = re.compile(r'(lineage|taper|venue|location|source|video|audio|menu|chapters|checksum|md5|author|www|http|https|torrent|poster)', re.IGNORECASE)
SONG_LINE = re.compile(
    r'^\s*(?:\d{1,2}\s*[.)-]\s*|\[\d{1,2}:\d{2}\]\s*|~?\d{1,2}:\d{2}\s*|-?\s*)?'
    r'([A-Za-z][A-Za-z0-9&/’\'()\-\. ]{2,})\s*$'
)

VENUE_KEYS = re.compile(r'^(venue|place)\s*:?\s*$', re.IGNORECASE)
LOCATION_KEYS = re.compile(r'^(location|city)\s*:?\s*$', re.IGNORECASE)
COUNTRY_KEYS = re.compile(r'^(country)\s*:?\s*$', re.IGNORECASE)

INFO_DIR_HINTS = {"info", "nfo", "notes", "docs", "documentation", "about"}

# ===== Location & event inference helpers =====
US_STATE_ABBR = {
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY",
    "LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND",
    "OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"
}
REGION_TO_COUNTRY = {
    **{st: "USA" for st in US_STATE_ABBR},
    # Canada
    "AB":"Canada","BC":"Canada","MB":"Canada","NB":"Canada","NL":"Canada","NS":"Canada",
    "NT":"Canada","NU":"Canada","ON":"Canada","PE":"Canada","QC":"Canada","SK":"Canada","YT":"Canada",
    # Australia
    "NSW":"Australia","VIC":"Australia","QLD":"Australia","SA":"Australia","WA":"Australia","TAS":"Australia","ACT":"Australia","NT":"Australia",
    # UK regions (rare as abbreviations, but present for completeness)
    "ENG":"United Kingdom","SCT":"United Kingdom","WLS":"United Kingdom","NIR":"United Kingdom"
}
COUNTRY_NAMES = {
    "United States","USA","US","United Kingdom","UK","England","Scotland","Wales",
    "Germany","France","Spain","Italy","Portugal","Netherlands","Belgium","Switzerland","Austria",
    "Brazil","Argentina","Chile","Mexico","Canada","Australia","New Zealand","Japan","South Korea",
    "Norway","Sweden","Denmark","Finland","Ireland","Poland","Czech Republic","Hungary","Greece",
    "Iceland","Luxembourg"
}
_SEP = r"[,\-|–—]\s*"  # flexible separators


def now_iso() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def run_cmd(cmd: str) -> str:
    try:
        return subprocess.check_output(cmd, shell=True, stderr=subprocess.DEVNULL).decode("utf-8", errors="replace")
    except Exception:
        return ""


def ffprobe_json(path: Path, header_only: bool) -> dict:
    quoted = shlex.quote(str(path))

    if header_only:
        cmd = (
            f'ffprobe -v quiet -print_format json -show_format -show_streams '
            f'-read_intervals %+10 {quoted}'
        )
    else:
        cmd = (
            f'ffprobe -v quiet -print_format json -show_format -show_streams '
            f'{quoted}'
        )

    out = run_cmd(cmd)
    if out.strip():
        try:
            return json.loads(out)
        except Exception:
            pass

    ex = run_cmd(f'exiftool -json {quoted}')
    try:
        arr = json.loads(ex)
        if isinstance(arr, list) and arr:
            return {}
    except Exception:
        pass
    return {}


def first_audio_stream(data: dict) -> dict:
    for s in data.get("streams", []):
        if s.get("codec_type") == "audio":
            return s
    return {}


def first_video_stream(data: dict) -> dict:
    for s in data.get("streams", []):
        if s.get("codec_type") == "video":
            return s
    return {}


def fps_to_float_str(fr: str) -> str:
    if not fr or fr == "0/0":
        return ""
    if "/" in fr:
        try:
            n, d = fr.split("/")
            val = float(n) / float(d)
            return f"{val:.3f}"
        except Exception:
            return ""
    try:
        return f"{float(fr):.3f}"
    except Exception:
        return ""


def parse_media_info(file_path: Path, header_only: bool) -> Dict[str, str]:
    info = {
        "video_codec": "", "width": "", "height": "", "duration_sec": "", "dar": "", "sar": "", "fps": "",
        "audio_codec": "", "audio_channels": "", "audio_sample_rate": ""
    }
    data = ffprobe_json(file_path, header_only)
    try:
        v = first_video_stream(data)
        if v:
            info["video_codec"] = v.get("codec_name", "") or v.get("codec_long_name", "")
            info["width"] = str(v.get("width", "") or "")
            info["height"] = str(v.get("height", "") or "")
            info["dar"] = v.get("display_aspect_ratio", "") or ""
            info["sar"] = v.get("sample_aspect_ratio", "") or ""
            info["fps"] = fps_to_float_str(v.get("avg_frame_rate") or v.get("r_frame_rate") or "")
        fmt = data.get("format", {})
        dur = fmt.get("duration") or fmt.get("tags", {}).get("DURATION") or ""
        if dur:
            try:
                info["duration_sec"] = str(int(float(dur)))
            except Exception:
                pass
        a = first_audio_stream(data)
        if a:
            info["audio_codec"] = a.get("codec_name", "") or a.get("codec_long_name", "")
            ch = a.get("channels"); info["audio_channels"] = str(ch) if ch is not None else ""
            sr = a.get("sample_rate"); info["audio_sample_rate"] = str(sr) if sr is not None else ""
        return info
    except Exception:
        return info


def human_size(num_bytes: int) -> str:
    step = 1024.0
    units = ["B", "KB", "MB", "GB", "TB", "PB"]
    s = float(num_bytes)
    for u in units:
        if s < step:
            return f"{s:.2f} {u}"
        s /= step
    return f"{s:.2f} EB"


def safe_read_text(path: Path) -> str:
    ext = path.suffix.lower()
    try:
        if ext in {".txt", ".nfo"}:
            try:
                return path.read_text(encoding="utf-8")
            except Exception:
                return path.read_text(errors="replace")
        if ext == ".docx" and 'Document' in globals() and Document is not None:
            try:
                doc = Document(str(path))
                return "\n".join(p.text for p in doc.paragraphs)
            except Exception:
                return ""
        if ext in {".doc", ".rtf"} and platform.system().lower() == "darwin":
            try:
                quoted = shlex.quote(str(path))
                out = run_cmd(f'textutil -convert txt -stdout {quoted}')
                return out if out else ""
            except Exception:
                return ""
        if textract and ext in {".doc", ".rtf"}:
            try:
                return textract.process(str(path)).decode("utf-8", errors="replace")
            except Exception:
                return ""
    except Exception:
        pass
    return ""


def collect_notes(folder: Path, warnings: List[str]) -> str:
    texts = []
    try:
        for p in folder.rglob("*"):
            if not p.is_file():
                continue
            if p.suffix.lower() in TEXT_EXTS:
                parts = [seg.lower() for seg in p.relative_to(folder).parts[:-1]]
                score = 1 if any(seg in INFO_DIR_HINTS for seg in parts) else 0
                texts.append((score, p))
        texts.sort(key=lambda t: (-t[0], str(t[1])))
        chunks = []
        seen_paths = set()
        for _, path in texts:
            if str(path) in seen_paths:
                continue
            t = safe_read_text(path)
            if t.strip():
                header = f"\n---- {path.relative_to(folder)} ----\n"
                chunks.append(header + t.strip())
                seen_paths.add(str(path))
            else:
                warnings.append(f"Could not parse text from {path.name}")
        return "\n".join(chunks).strip()
    except Exception:
        return ""


def guess_date(text: str) -> str:
    if not text:
        return ""
    for pat in DATE_PATTERNS:
        m = re.search(pat, text, flags=re.IGNORECASE | re.MULTILINE)
        if m:
            try:
                if len(m.groups()) == 3:
                    g = m.groups()
                    if pat.startswith(r'\b(\d{4})'):
                        y, mo, d = int(g[0]), int(g[1]), int(g[2])
                    elif pat.startswith(r'\b(\d{1,2})'):
                        a, b, c = int(g[0]), int(g[1]), int(g[2])
                        if c < 100:
                            c += 2000
                        if a > 12:
                            d, mo, y = a, b, c
                        else:
                            mo, d, y = a, b, c
                    else:
                        from datetime import datetime as _dt
                        mon, d, y = g[0], int(g[1]), int(g[2])
                        mo = _dt.strptime(mon[:3], "%b").month
                    return f"{y:04d}-{mo:02d}-{d:02d}"
            except Exception:
                continue
    return ""


def extract_section_by_anchor(text: str, anchor_re: re.Pattern) -> List[str]:
    if not text:
        return []
    lines = text.splitlines()
    grabbing = False
    collected = []
    for ln in lines:
        if anchor_re.match(ln.strip()):
            grabbing = True
            continue
        if grabbing:
            if ln.strip() == "":
                if collected:
                    break
                else:
                    continue
            collected.append(ln.rstrip())
    return collected


def clean_song_title(line: str) -> Optional[str]:
    if not line:
        return None
    raw = line.strip()
    m_ts = re.match(r'^\s*(?:\[\s*\d{1,2}:\d{2}\s*\]|\d{1,2}:\d{2})\s*[-–:]?\s*(.+)$', raw)
    if m_ts:
        title = m_ts.group(1).strip()
        title = re.sub(r'\s{2,}', ' ', title).strip(' .-')
        if len(re.findall(r'[A-Za-z]', title)) >= 2:
            return title
        return None
    if NON_SONG_HINTS.search(raw):
        return None
    m = SONG_LINE.match(raw)
    if not m:
        return None
    title = m.group(1).strip()
    title = re.sub(r'\s*\((live|cut|jam|tape|alt\.? mix|remix|reprise|acoustic|intro|outro)\)\s*$', '', title, flags=re.IGNORECASE)
    title = re.sub(r'\s{2,}', ' ', title).strip(' .-')
    if len(re.findall(r'[A-Za-z]', title)) < 2:
        return None
    return title


def extract_setlist(notes: str) -> str:
    if not notes:
        return ""
    anchored = extract_section_by_anchor(notes, SETLIST_ANCHORS)
    candidates = anchored if anchored else notes.splitlines()
    titles, seen = [], set()
    for ln in candidates:
        t = clean_song_title(ln)
        if t and t.lower() not in seen:
            titles.append(t)
            seen.add(t.lower())
    return "; ".join(titles[:200])


def first_line_after_key(text: str, anchors: List[re.Pattern]) -> str:
    if not text:
        return ""
    lines = text.splitlines()
    for i, ln in enumerate(lines):
        for anchor in anchors:
            if anchor.match(ln.strip()):
                for j in range(i + 1, min(i + 6, len(lines))):
                    if lines[j].strip():
                        return lines[j].strip()
    return ""


# ===== Improved location parsing =====

def parse_location(notes: str, folder_name: str) -> Tuple[str, str, str, str, str]:
    """
    Robustly infer (venue, city, country, festival, hint) from free-form notes.
    Handles:
      - "Venue, City, Country" (with optional region)
      - Stacked lines: Venue / City[-|, Region] / Country
      - "Event - Venue" then city on next line
      - Folder-name fallbacks
    Returns a hint key like "loc:comma", "loc:stack", "loc:eventline", "loc:folder", or "".
    """
    venue, city, country, festival, hint = "", "", "", "", ""

    if not notes:
        # Folder-name fallback only
        venue, city, country, hint = _folder_name_loc_fallback(folder_name)
        return venue, city, country, festival, hint

    lines = [ln.strip() for ln in notes.splitlines() if ln.strip()]
    lines = [re.sub(r"\s{2,}", " ", ln) for ln in lines]

    # 1) Single-line comma-separated: Venue, City[, Region], Country
    for ln in lines:
        parts = [p.strip() for p in re.split(r"\s*,\s*", ln) if p.strip()]
        if len(parts) >= 2:
            last = parts[-1]
            last_up = last.upper()
            if last in COUNTRY_NAMES or last_up in REGION_TO_COUNTRY:
                country = last if last in COUNTRY_NAMES else REGION_TO_COUNTRY[last_up]
                if len(parts) >= 3:
                    mid = parts[-2]
                    m = re.match(r"(.+?)\s+([A-Z]{2,3})$", mid)
                    if m and m.group(2).upper() in REGION_TO_COUNTRY:
                        city = m.group(1).strip()
                        if not country:
                            country = REGION_TO_COUNTRY[m.group(2).upper()]
                    else:
                        city = mid.strip()
                    venue = ", ".join(parts[:-2]).strip() if len(parts) > 2 else ""
                else:
                    city = parts[0]
                    venue = ""
                return venue, city, country, festival, "loc:comma"

    # 2) Three-line stack: Venue / City[-|, Region] / Country
    for i in range(len(lines) - 2):
        a, b, c = lines[i], lines[i + 1], lines[i + 2]
        c_up = c.upper()
        if c in COUNTRY_NAMES or c_up in REGION_TO_COUNTRY:
            b_city = b
            b_country = ""
            m = re.match(r"(.+?)\s*[-,]\s*([A-Za-z]{2,3})$", b)
            if m and m.group(2).upper() in REGION_TO_COUNTRY:
                b_city = m.group(1).strip()
                b_country = REGION_TO_COUNTRY[m.group(2).upper()]
            venue = a
            city = b_city
            country = c if c in COUNTRY_NAMES else REGION_TO_COUNTRY[c_up]
            if b_country and not country:
                country = b_country
            return venue, city, country, festival, "loc:stack"

    # 3) Event - Venue on one line; next line City[, Region/Country]
    for i in range(len(lines) - 1):
        m = re.match(r"(.+?)\s+[–\-]\s+(.+)$", lines[i])
        if m:
            ev, ven = m.group(1).strip(), m.group(2).strip()
            nxt = lines[i + 1]
            m2 = re.match(r"(.+?)\s*[,–\-]\s*([A-Za-z]{2,3})$", nxt)
            if m2 and m2.group(2).upper() in REGION_TO_COUNTRY:
                city = m2.group(1).strip()
                country = REGION_TO_COUNTRY[m2.group(2).upper()]
                venue = ven
                festival = ev
                return venue, city, country, festival, "loc:eventline"
            parts = [p.strip() for p in re.split(r"\s*,\s*", nxt) if p.strip()]
            if len(parts) == 2:
                pr2 = parts[1]
                pr2_up = pr2.upper()
                if pr2 in COUNTRY_NAMES or pr2_up in REGION_TO_COUNTRY:
                    city = parts[0]
                    country = pr2 if pr2 in COUNTRY_NAMES else REGION_TO_COUNTRY[pr2_up]
                    venue = ven
                    festival = ev
                    return venue, city, country, festival, "loc:eventline"

    # 4) City - Region or City, Country alone
    for ln in lines:
        m = re.match(r"(.+?)\s*[-,]\s*([A-Za-z]{2,3})$", ln)
        if m and m.group(2).upper() in REGION_TO_COUNTRY:
            city = m.group(1).strip()
            country = REGION_TO_COUNTRY[m.group(2).upper()]
            return venue, city, country, festival, "loc:cityregion"
        parts = [p.strip() for p in re.split(r"\s*,\s*", ln) if p.strip()]
        if len(parts) == 2:
            pr2 = parts[1]
            pr2_up = pr2.upper()
            if pr2 in COUNTRY_NAMES or pr2_up in REGION_TO_COUNTRY:
                city = parts[0]
                country = pr2 if pr2 in COUNTRY_NAMES else REGION_TO_COUNTRY[pr2_up]
                return venue, city, country, festival, "loc:citycountry"

    # 5) Folder-name fallback
    venue, city, country, hint = _folder_name_loc_fallback(folder_name)
    if venue or city or country:
        return venue, city, country, festival, hint

    # 6) Festival keyword fallback
    if not festival and notes:
        m = re.search(r'\b(Festival|Rockpalast|Lollapalooza|Glastonbury|Reading|Leeds|Bonnaroo|Primavera|Big Day Out|Splendour in the Grass)\b', notes, re.IGNORECASE)
        if m:
            festival = m.group(1)
    return venue, city, country, festival, ""


def _folder_name_loc_fallback(folder_name: str) -> Tuple[str, str, str, str]:
    """Infer location from folder name patterns. Returns (venue, city, country, hint)."""
    venue, city, country, hint = "", "", "", ""
    m = re.search(r'\b\d{4}[-_]\d{2}[-_]\d{2}\b\s+(.+)', folder_name)
    cand = m.group(1).strip() if m else folder_name
    parts = [p.strip() for p in re.split(_SEP, cand) if p.strip()]
    if len(parts) >= 3:
        venue, city, country = parts[0], parts[1], parts[2]
        hint = "loc:folder"
    elif len(parts) == 2:
        venue, city = parts[0], parts[1]
        hint = "loc:folder"
    return venue, city, country, hint


# ===== Event extractor =====

def extract_event_and_split_venue(notes: str, existing_venue: str) -> Tuple[str, str, str]:
    """
    If we find a strong 'Event - Venue' line, prefer that for Event and (if existing_venue empty) fill Venue.
    Returns (event, venue_override, hint) where venue_override is "" if not overriding.
    """
    if not notes:
        return "", "", ""
    for ln in notes.splitlines():
        ln = ln.strip()
        if not ln:
            continue
        if re.search(r'(concert|festival|live|rockpalast|tour|show)', ln, re.IGNORECASE) and re.search(r'\s[–\-]\s', ln):
            m = re.match(r'(.+?)\s+[–\-]\s+(.+)$', ln)
            if m:
                event = m.group(1).strip()
                ven = m.group(2).strip()
                return event, (ven if not existing_venue else ""), "evt:eventline"
    return "", "", ""


def _compile_search_set(names: List[str]) -> Dict[str, str]:
    return { _normalize_for_match(n): n for n in names }


def resolve_artist(folder: Path, notes: str) -> str:
    # 1) Exact segment match against canonical names
    segments = [p for p in folder.resolve().parts if p and p != os.sep]
    seg_norm_map = {seg: _normalize_for_match(seg) for seg in segments}
    name_norm_map = _compile_search_set(BAND_NAMES)
    for seg, seg_norm in seg_norm_map.items():
        if seg_norm in name_norm_map:
            return name_norm_map[seg_norm]

    # Patterns support partial matches and aliases
    folder_norm = _normalize_for_match(folder.name)
    parent_norm = _normalize_for_match(folder.parent.name) if folder.parent else ""
    notes_norm = _normalize_for_match(notes or "")

    def search_longest(hay: str) -> Optional[str]:
        if not hay:
            return None
        for key, pat, _ in _BAND_PATTERNS:
            if pat.search(hay):
                return BAND_ALIASES.get(key, key)
        return None

    artist = search_longest(folder_norm) or search_longest(parent_norm) or search_longest(notes_norm)
    if artist:
        return artist

    parent = folder.parent.name.strip()
    if parent and parent.lower() not in {"video_ts", "audio_ts"}:
        return parent
    return folder.name


def master_drive_name_for(folder: Path, roots: List[Path]) -> Path:
    f = str(folder.resolve())
    chosen = None
    for r in sorted(roots, key=lambda p: len(str(p)), reverse=True):
        rp = str(r.resolve())
        if f.startswith(rp):
            chosen = r
            break
    return chosen if chosen else Path("")


def master_drive_label_and_id(root: Path) -> Tuple[str, str]:
    label = ""
    devid = ""
    try:
        sysname = platform.system().lower()
        if sysname == "darwin":
            parts = root.resolve().parts
            if len(parts) >= 3 and parts[1] == "Volumes":
                label = parts[2]
                out = run_cmd(f'diskutil info -plist {shlex.quote(str(root))}')
                m = re.search(r'<key>VolumeUUID</key>\s*<string>([^<]+)</string>', out)
                if m:
                    devid = m.group(1)
        elif sysname == "windows":
            drv = os.path.splitdrive(str(root))[0]
            if drv:
                out = run_cmd(
                    f'powershell -NoProfile -Command "Get-Volume -DriveLetter {drv[0]} | '
                    f'Format-List -Property DriveLetter,FileSystemLabel,UniqueId,SerialNumber"'
                )
                mlabel = re.search(r'FileSystemLabel\s*:\s*(.+)', out)
                mid = re.search(r'UniqueId\s*:\s*(.+)', out) or re.search(r'SerialNumber\s*:\s*(.+)', out)
                if mlabel:
                    label = mlabel.group(1).strip()
                if mid:
                    devid = mid.group(1).strip()
            if not label:
                label = drv or str(root)
        else:
            label = root.name or str(root)
            st = os.stat(str(root))
            devid = f"dev-{st.st_dev}"
    except Exception:
        pass
    if not devid:
        devid = hashlib.sha1(str(root.resolve()).encode("utf-8")).hexdigest()[:12]
    if not label:
        label = root.name or str(root)
    return label, devid


def _video_ts_present(dirpath: Path) -> bool:
    """Case-insensitive VIDEO_TS detection with case-insensitive .VOB check."""
    try:
        for child in dirpath.iterdir():
            if child.is_dir() and child.name.lower() == "video_ts":
                for f in child.iterdir():
                    if f.is_file() and f.suffix.lower() == ".vob":
                        return True
    except Exception:
        return False
    return False


def _has_direct_video_files(dirpath: Path) -> bool:
    try:
        for p in dirpath.iterdir():
            if p.is_file() and p.suffix.lower() in VIDEO_EXTS:
                return True
    except Exception:
        return False
    return False


def _child_looks_like_show(child: Path) -> bool:
    if _video_ts_present(child):
        return True
    try:
        for p in child.iterdir():
            if p.is_file() and p.suffix.lower() in VIDEO_EXTS:
                return True
    except Exception:
        return False
    return False


def is_show_folder(folder: Path) -> bool:
    """
    Count a folder as a show only if:
      - It directly contains a VIDEO_TS folder with at least one .VOB (case-insensitive), OR
      - It directly contains at least one recognized video file.
    If the folder appears to be a container holding multiple child show folders,
    do NOT count the parent as a show.
    """
    try:
        if _video_ts_present(folder):
            return True
        direct_video = _has_direct_video_files(folder)
        child_show_dirs = 0
        for child in folder.iterdir():
            if child.is_dir() and _child_looks_like_show(child):
                child_show_dirs += 1
                if child_show_dirs >= 2:
                    return False
        return bool(direct_video)
    except Exception:
        return False


def determine_recording_type(notes: str, folder: Path) -> str:
    text = f"{notes}\n{folder.name}".lower()
    if re.search(r'(pro-?shot|broadcast|tv|multicam|soundboard|sbd|webcast|ppv|dvd\s*author)', text):
        return "Proshot"
    if re.search(r'(audience|aud\b|taper|camcorder|handheld|hi8|minidv|\bvx\d{3,4}\b)', text):
        return "Audience"
    if re.search(r'(documentary|interview|featurette|behind the scenes|bts)', text):
        return "Documentary"
    return ""


def determine_generation(notes: str, folder: Path) -> str:
    text = f"{notes}\n{folder.name}".lower()
    m = re.search(r'\b(master)\b', text)
    if m:
        return "Master"
    m = re.search(r'\b(\d+)(st|nd|rd|th)\s*gen(eration)?\b', text)
    if m:
        return f"{m.group(1)}{m.group(2)} Gen"
    m = re.search(r'\bgen(?:eration)?\s*[:\- ]\s*(\d+)\b', text)
    if m:
        return f"{m.group(1)} Gen"
    return ""


def extract_source_equipment(lineage: str) -> str:
    if not lineage:
        return ""
    m = re.search(r'(mini\s*dv|minidv|hi8|betacam|vx\d{3,4}|xl1|xl2|hd pvr|hvr|sony|panasonic|canon)[^\n,;]*', lineage, re.IGNORECASE)
    return m.group(0).strip() if m else ""


def derive_aspect_ratio(width: str, height: str, dar: str, sar: str, codec: str, notes: str, foldername: str) -> str:
    if dar in {"16:9", "1.78:1", "1.7778"}:
        return "16:9 (native)"
    if dar in {"4:3", "1.33:1", "1.3333"}:
        if codec.lower() == "mpeg2video":
            if re.search(r'(16:?9|widescreen)', f"{notes} {foldername}", re.IGNORECASE):
                return "4:3 (letterboxed 16:9)"
        return "4:3 (native)"
    try:
        w = int(width or 0)
        h = int(height or 0)
        if w and h:
            ratio = w / h
            if abs(ratio - 16 / 9) < 0.05:
                return "16:9 (native)"
            if abs(ratio - 4 / 3) < 0.05:
                if codec.lower() == "mpeg2video" and re.search(r'(16:?9|widescreen)', f"{notes} {foldername}", re.IGNORECASE):
                    return "4:3 (letterboxed 16:9)"
                return "4:3 (native)"
    except Exception:
        pass
    return ""


def derive_tv_standard(fps_str: str) -> str:
    try:
        fps = float(fps_str)
        if 24.5 <= fps <= 25.5 or 49.0 <= fps <= 50.5:
            return "PAL"
        if 29.0 <= fps <= 30.5 or 59.0 <= fps <= 60.5:
            return "NTSC"
    except Exception:
        pass
    return ""


def sha1_of_files_in_order(paths: List[Path]) -> str:
    h = hashlib.sha1()
    bufsize = 1024 * 1024
    for p in paths:
        try:
            with open(p, "rb") as f:
                while True:
                    b = f.read(bufsize)
                    if not b:
                        break
                    h.update(b)
        except Exception:
            return ""
    return h.hexdigest()


def extract_lineage(notes: str) -> str:
    if not notes:
        return ""
    inline = re.findall(r'(?im)^(lineage|source|taper|gen(?:eration)?)\s*[:\-]\s*(.+)$', notes)
    pieces = [p[1].strip() for p in inline if p[1].strip()]

    if not pieces:
        anchored = extract_section_by_anchor(notes, re.compile(r'^(lineage|source|taper|gen|generation)\s*:?\s*$', re.IGNORECASE))
        if anchored:
            pieces = [re.sub(r'\s+', ' ', x).strip() for x in anchored if x.strip()]

    if not pieces:
        line = first_line_after_key(notes, [re.compile(r'^(lineage|source|taper|gen|generation)\s*:?\s*$', re.IGNORECASE)])
        if line:
            pieces = [re.sub(r'\s+', ' ', line).strip()]

    seen = set()
    out = []
    for p in pieces:
        key = p.lower()
        if key not in seen:
            seen.add(key)
            out.append(p)
    return " | ".join(out)[:2000]


def dvd_group_segments(folder: Path) -> List[Path]:
    vts_dir = None
    for p in folder.rglob("*"):
        if p.is_dir() and p.name.lower() == "video_ts":
            vts_dir = p
            break
    if not vts_dir:
        return []
    vobs = [p for p in vts_dir.iterdir() if p.is_file() and p.suffix.lower() == ".vob"]
    groups: Dict[str, List[Path]] = {}
    for v in vobs:
        m = re.match(r'(?i)^(VTS_\d{2})_\d+\.VOB$', v.name)
        if not m:
            continue
        key = m.group(1).upper()
        groups.setdefault(key, []).append(v)
    best_key, best_total = None, -1
    for k, files in groups.items():
        files_sorted = sorted(files, key=lambda p: int(re.search(r'_(\d+)\.VOB$', p.name, re.IGNORECASE).group(1)))
        groups[k] = files_sorted
        total = sum((p.stat().st_size for p in files_sorted if p.exists()), 0)
        if total > best_total:
            best_total = total
            best_key = k
    return groups.get(best_key, []) if best_key else []


def representative_media(folder: Path):
    dvd_group = dvd_group_segments(folder)
    if dvd_group:
        return dvd_group, ".vob"
    best, best_size = None, 0
    for p in folder.rglob("*"):
        if p.is_file() and p.suffix.lower() in VIDEO_EXTS:
            try:
                s = p.stat().st_size
                if s > best_size:
                    best, best_size = p, s
            except Exception:
                continue
    return ([best] if best else []), (best.suffix.lower() if best else "")


def total_size_and_count(folder: Path):
    total, count = 0, 0
    for p in folder.rglob("*"):
        if p.is_file():
            try:
                st = p.stat()
                total += st.st_size
                count += 1
            except Exception:
                pass
    return total, count


def normalize_show_id(folder_path: Path) -> str:
    h = hashlib.sha1(str(folder_path).encode("utf-8")).hexdigest()
    return h[:12]


def scan_roots(roots: List[Path], header_only: bool, no_media: bool, do_checksums: bool, do_drive_id: bool) -> List[Dict[str, str]]:
    rows = []
    seen_ids = set()
    drive_meta_cache: Dict[str, Tuple[str, str]] = {}
    checksum_to_showid: Dict[str, str] = {}

    for root in roots:
        if not root.exists():
            continue

        label, devid = ("", "")
        if do_drive_id:
            cached = drive_meta_cache.get(str(root.resolve()))
            if cached:
                label, devid = cached
            else:
                label, devid = master_drive_label_and_id(root)
                drive_meta_cache[str(root.resolve())] = (label, devid)

        for dirpath, dirnames, filenames in os.walk(root):
            print(f"Scanning: {dirpath}", flush=True)
            fpath = Path(dirpath)
            try:
                _excluded = {"video_ts", "audio_ts", "info", "nfo", "docs", "artwork", "extras"}
                if fpath.name.lower() in _excluded:
                    dirnames[:] = []
                    continue

                if not is_show_folder(fpath):
                    # NEW: if this directory is a container (e.g., the root) but has loose media files,
                    # add one row per loose file so they aren't lost.
                    loose = []
                    for fn in filenames:
                        p = Path(dirpath) / fn
                        if p.is_file() and p.suffix.lower() in VIDEO_EXTS:
                            loose.append(p)
                    if loose:
                        for lf in loose:
                            try:
                                row = build_row_for_loose_file(lf, roots, header_only, no_media, do_checksums, do_drive_id)
                                # Deduplicate by ShowID (file path based)
                                if row["ShowID"] not in seen_ids:
                                    rows.append(row)
                                    seen_ids.add(row["ShowID"])
                            except Exception:
                                pass
                    # Do not prune children; allow descent to find nested show folders
                    continue

                show_id = normalize_show_id(fpath)
                if show_id in seen_ids:
                    dirnames[:] = []
                seen_ids.add(show_id)

                warnings: List[str] = []
                notes = collect_notes(fpath, warnings)
                show_date = guess_date(notes)
                setlist = extract_setlist(notes)

                # Improved location/event extraction
                venue, city, country, festival, hint_loc = parse_location(notes, fpath.name)
                if hint_loc:
                    warnings.append(hint_loc)
                event_guess, venue_override, hint_evt = extract_event_and_split_venue(notes, venue)
                if hint_evt:
                    warnings.append(hint_evt)
                if venue_override:
                    venue = venue_override
                event_or_festival = event_guess or festival

                rep_files, container = representative_media(fpath)
                rep_count = len(rep_files)
                rep_rel: List[str] = []
                for rf in rep_files:
                    try:
                        rep_rel.append(str(rf.relative_to(fpath)))
                    except Exception:
                        rep_rel.append(str(rf))

                media_info = {
                    "video_codec": "", "width": "", "height": "", "duration_sec": "", "dar": "", "sar": "", "fps": "",
                    "audio_codec": "", "audio_channels": "", "audio_sample_rate": ""
                }
                total_dur = 0
                if not no_media and rep_files:
                    if container == ".vob" and rep_count > 1:
                        for seg in rep_files:
                            info = parse_media_info(seg, header_only=header_only)
                            if not media_info["video_codec"] and info.get("video_codec"):
                                media_info["video_codec"] = info["video_codec"]
                            if not media_info["width"] and info.get("width"):
                                media_info["width"] = info["width"]
                            if not media_info["height"] and info.get("height"):
                                media_info["height"] = info["height"]
                            if not media_info["dar"] and info.get("dar"):
                                media_info["dar"] = info["dar"]
                            if not media_info["sar"] and info.get("sar"):
                                media_info["sar"] = info["sar"]
                            if not media_info["fps"] and info.get("fps"):
                                media_info["fps"] = info["fps"]
                            if not media_info["audio_codec"] and info.get("audio_codec"):
                                media_info["audio_codec"] = info["audio_codec"]
                            if not media_info["audio_channels"] and info.get("audio_channels"):
                                media_info["audio_channels"] = info["audio_channels"]
                            if not media_info["audio_sample_rate"] and info.get("audio_sample_rate"):
                                media_info["audio_sample_rate"] = info["audio_sample_rate"]
                            try:
                                total_dur += int(info.get("duration_sec") or 0)
                            except Exception:
                                pass
                        if total_dur:
                            media_info["duration_sec"] = str(total_dur)
                    else:
                        media_info = parse_media_info(rep_files[0], header_only=header_only)

                total_bytes, file_count = total_size_and_count(fpath)

                lineage_text = extract_lineage(notes)
                source_equip = extract_source_equipment(lineage_text)
                rec_type = determine_recording_type(notes, fpath)
                gen = determine_generation(notes, fpath)

                aspect = derive_aspect_ratio(
                    media_info.get("width", ""), media_info.get("height", ""),
                    media_info.get("dar", ""), media_info.get("sar", ""),
                    media_info.get("video_codec", ""), notes, fpath.name
                )
                tvstd = derive_tv_standard(media_info.get("fps", ""))

                mdn_path = master_drive_name_for(fpath, roots)
                master_label = ""
                master_id = ""
                if mdn_path and do_drive_id:
                    master_label, master_id = master_drive_label_and_id(mdn_path)
                elif mdn_path:
                    master_label = master_drive_label_and_id(mdn_path)[0]

                row = {
                    "ShowID": show_id,
                    "Artist": resolve_artist(fpath, notes),
                    "ShowDate": show_date,
                    "EventOrFestival": event_or_festival,
                    "VenueName": venue,
                    "City": city,
                    "Country": country,
                    "RecordingType": rec_type,
                    "Generation": gen,
                    "Lineage": lineage_text[:2000],
                    "SourceEquipment": source_equip,
                    "FolderName": fpath.name,
                    "FolderPath": str(fpath.resolve()),
                    "MasterDriveName": master_label,
                    "MasterDriveID": master_id,
                    "RepVideoCount": str(rep_count),
                    "RepVideoFiles": "; ".join(rep_rel),
                    "Container": container,
                    "VideoCodec": media_info.get("video_codec", ""),
                    "Width": media_info.get("width", ""),
                    "Height": media_info.get("height", ""),
                    "DurationSec": media_info.get("duration_sec", ""),
                    "AspectRatio": aspect,
                    "TVStandard": tvstd,
                    "AudioCodec": media_info.get("audio_codec", ""),
                    "AudioChannels": media_info.get("audio_channels", ""),
                    "AudioSampleRate": media_info.get("audio_sample_rate", ""),
                    "FileCount": str(file_count),
                    "TotalSizeBytes": str(total_bytes),
                    "TotalSizeHuman": human_size(total_bytes),
                    "ChecksumSHA1": "",
                    "DuplicateOf": "",
                    "Setlist": setlist[:2000],
                    "Notes": notes[:8000],
                    "LastScannedAt": now_iso(),
                    "ExtractionWarnings": "; ".join(warnings),
                }

                if do_checksums and rep_files:
                    ch = sha1_of_files_in_order(rep_files)
                    row["ChecksumSHA1"] = ch
                    if ch and ch in checksum_to_showid:
                        row["DuplicateOf"] = checksum_to_showid[ch]
                    elif ch:
                        checksum_to_showid[ch] = row["ShowID"]

                rows.append(row)

                # Do not descend further once this folder is counted as a show
                dirnames[:] = []

            except Exception:
                dirnames[:] = []
                try:
                    rows.append({
                        "ShowID": normalize_show_id(fpath),
                        "Artist": fpath.name,
                        "ShowDate": "",
                        "EventOrFestival": "",
                        "VenueName": "",
                        "City": "",
                        "Country": "",
                        "RecordingType": "",
                        "Generation": "",
                        "Lineage": "",
                        "SourceEquipment": "",
                        "FolderName": fpath.name,
                        "FolderPath": str(fpath.resolve()),
                        "MasterDriveName": "",
                        "MasterDriveID": "",
                        "RepVideoCount": "0",
                        "RepVideoFiles": "",
                        "Container": "",
                        "VideoCodec": "",
                        "Width": "",
                        "Height": "",
                        "DurationSec": "",
                        "AspectRatio": "",
                        "TVStandard": "",
                        "AudioCodec": "",
                        "AudioChannels": "",
                        "AudioSampleRate": "",
                        "FileCount": "0",
                        "TotalSizeBytes": "0",
                        "TotalSizeHuman": "0 B",
                        "ChecksumSHA1": "",
                        "DuplicateOf": "",
                        "Setlist": "",
                        "Notes": "",
                        "LastScannedAt": now_iso(),
                        "ExtractionWarnings": "Unhandled error while scanning this folder",
                    })
                except Exception:
                    pass
                continue

    rows.sort(key=lambda r: (
        (r.get("Artist") or "").lower(),
        (r.get("ShowDate") or "9999-99-99"),
        (r.get("FolderName") or "").lower()
    ))
    return rows


def main():
    ap = argparse.ArgumentParser(description="Catalog concert shows into a CSV. Read-only.")
    ap.add_argument("roots", nargs="+", help="Root folders or drive mount points to scan")
    ap.add_argument("--output", default="shows_catalog.csv", help="Output CSV path")
    ap.add_argument("--no-media", action="store_true", help="Skip media probing for speed")
    ap.add_argument("--header-only", action="store_true", help="Probe only headers using -read_intervals %+10")
    ap.add_argument("--checksums", action="store_true", help="Compute SHA1 over representative media set and detect duplicates")
    ap.add_argument("--drive-id", action="store_true", help="Capture stable MasterDriveID when possible")
    args = ap.parse_args()

    roots = [Path(r).resolve() for r in args.roots]
    rows = scan_roots(
        roots,
        header_only=args.header_only,
        no_media=args.no_media,
        do_checksums=args.checksums,
        do_drive_id=args.drive_id
    )

    fieldnames = [
        "ShowID", "Artist", "ShowDate", "EventOrFestival", "VenueName", "City", "Country",
        "RecordingType", "Generation", "Lineage", "SourceEquipment",
        "FolderName", "FolderPath", "MasterDriveName", "MasterDriveID",
        "RepVideoCount", "RepVideoFiles", "Container", "VideoCodec", "Width", "Height", "DurationSec",
        "AspectRatio", "TVStandard", "AudioCodec", "AudioChannels", "AudioSampleRate",
        "FileCount", "TotalSizeBytes", "TotalSizeHuman",
        "ChecksumSHA1", "DuplicateOf",
        "Setlist", "Notes", "LastScannedAt", "ExtractionWarnings"
    ]

    with open(args.output, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow(r)

    print(f"Wrote {args.output} with {len(rows)} shows.")


if __name__ == "__main__":
    main()

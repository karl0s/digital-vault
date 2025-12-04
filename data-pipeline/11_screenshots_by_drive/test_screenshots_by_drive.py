#!/usr/bin/env python3
"""
test_screenshots_by_drive.py

Generate screenshots for shows from a specific drive,
using the MASTER merged CSV.

- Reads from a master catalog CSV (all drives)
- Filters rows by MasterDriveName (e.g. "BIG DADDY", "SEAGATE", "UNTITLED")
- For each matching show, generates up to SHOTS_PER_SHOW screenshots
- Uses canonical IDs so screenshots are deduped across drives
- Skips any screenshot file that already exists (manual fixes are safe)
- Logs every attempt to a CSV report

Image naming:
  <CanonicalID>_01.jpg, <CanonicalID>_02.jpg, <CanonicalID>_03.jpg, etc.

CanonicalID:
  - ChecksumSHA1 if present and non-empty
  - otherwise ShowID

Screenshot resolution behaviour (this version):
  - Preserve the original video aspect ratio.
  - Do NOT upscale.
  - If the video’s longest side > MAX_DIM (e.g. 1280), scale it down
    so the longest side becomes MAX_DIM (with correct aspect).
  - If the video is smaller than MAX_DIM, keep the original resolution.
"""

import csv
import subprocess
import json
import shlex
from pathlib import Path
from typing import Optional, List, Tuple
from io import StringIO
from datetime import datetime
from functools import lru_cache

# ========= CONFIG YOU CAN TWEAK =========

# Master merged CSV with ALL unique shows
MASTER_CSV_PATH = Path("/Users/ko/Desktop/NEW_MASTER_merged_shows_2025-11-06_2113.csv")

# Only process shows whose MasterDriveName CONTAINS this string (case-insensitive)
# For Big Daddy ... BIG DADDY:
DRIVE_FILTER = "UNTITLED"
# Later you can change this to "SEAGATE", "UNTITLED" etc.

# Where to put the screenshots (shared images folder for your site)
OUTPUT_DIR = Path("/Users/ko/Desktop/build/images")

# Where to put the log/report CSV
REPORT_DIR = Path("/Users/ko/Desktop")

# Limit how many shows to process (for testing):
#   - None or 0  => process ALL matching shows
#   - positive N => process the first N matching rows
MAX_SHOWS: Optional[int] = None

# How many screenshots per show
SHOTS_PER_SHOW = 4

# SHOT_TIMES:
#   - If value is between 0 and 1 (e.g. 0.23, 0.57, 0.82) and file duration is known,
#       it's treated as a FRACTION of that file's duration (23%, 57%, 82%).
#   - If duration is missing OR the value > 1, we fall back to fixed seconds
#       using FALLBACK_SECONDS below.
SHOT_TIMES = [0.11, 0.27, 0.56, 0.73]
FALLBACK_SECONDS = [10, 60, 180, 220]

# Ignore very small files (likely menus, intros, logos)
# Files smaller than this (in MB) are filtered out, unless ALL files are small.
MIN_VIDEO_FILE_SIZE_MB = 50  # tweak if menus still slip through

# Output image format: "jpg", "png", or "webp"
OUTPUT_FORMAT = "jpg"

# JPEG/WEBP quality
JPEG_QUALITY = 1   # ffmpeg -q:v (2–4 good range; lower = better quality, 1 is very high)
WEBP_QUALITY = 80  # for webp, 0–100 (higher = better quality)

# Maximum dimension (pixels) for the longest side of the screenshot.
# - If the source video is larger than this, it will be downscaled.
# - If it is smaller, it will be kept as-is.
MAX_DIM = 1280

# Deinterlace: DVDs are often interlaced, so True is a sensible default
DEINTERLACE = False

# ========= END CONFIG =========


def canonical_id(row: dict) -> str:
    """Pick a canonical ID for filenames: checksum if present, else ShowID."""
    checksum = (row.get("ChecksumSHA1") or "").strip()
    if checksum:
        return checksum
    return (row.get("ShowID") or "").strip()


def row_matches_drive(row: dict) -> bool:
    """
    Return True if this row belongs to the target drive, based on MasterDriveName.
    Uses case-insensitive substring match.
    """
    if not DRIVE_FILTER:
        return True
    md = (row.get("MasterDriveName") or "").lower()
    return DRIVE_FILTER.lower() in md


def get_rep_video_paths(row: dict) -> List[Path]:
    """
    Return a list of ALL candidate video files for this show.

    Uses RepVideoFiles (semicolon-separated filenames) under FolderPath.
    Filters to files that actually exist on disk.
    Applies a minimum size filter to avoid tiny menu files.
    """
    folder = (row.get("FolderPath") or "").strip()
    rep_files = (row.get("RepVideoFiles") or "").strip()

    if not folder or not rep_files:
        return []

    parts = [p.strip() for p in rep_files.split(";") if p.strip()]
    folder_path = Path(folder)
    paths: List[Path] = []

    for name in parts:
        p = folder_path / name
        if p.exists():
            paths.append(p)

    if not paths:
        return []

    # Filter out very small files (likely menus)
    size_threshold = int(MIN_VIDEO_FILE_SIZE_MB * 1024 * 1024)
    large_paths = [p for p in paths if p.stat().st_size >= size_threshold]

    # If we found any "large" files, prefer those; otherwise keep all
    if large_paths:
        paths = large_paths

    # Sort by size descending so we tend to use big/main files first
    paths.sort(key=lambda x: x.stat().st_size, reverse=True)

    return paths


@lru_cache(maxsize=1024)
def get_file_duration_sec(file_path: Path) -> int:
    """
    Use ffprobe to get the duration (in seconds) of a single file.
    Returns 0 on failure.
    """
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=nw=1:nk=1",
        str(file_path),
    ]
    try:
        out = subprocess.check_output(cmd, text=True).strip()
        if not out:
            return 0
        return int(float(out))
    except Exception:
        return 0


@lru_cache(maxsize=1024)
def get_file_dimensions(file_path: Path) -> Tuple[Optional[int], Optional[int]]:
    """
    Use ffprobe to get (width, height) for the first video stream.
    Returns (None, None) on failure.
    """
    cmd = [
        "ffprobe",
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-of", "json",
        str(file_path),
    ]
    try:
        out = subprocess.check_output(cmd, text=True)
        data = json.loads(out)
        streams = data.get("streams") or []
        if not streams:
            return None, None
        s = streams[0]
        w = int(s.get("width") or 0) or None
        h = int(s.get("height") or 0) or None
        return w, h
    except Exception:
        return None, None


def build_scale_filter_for_file(file_path: Path) -> Optional[str]:
    """
    Build a scale filter that:
      - Does NOT upscale.
      - Downscales so that the longest side is MAX_DIM, preserving aspect.
      - Returns None if no scaling is necessary or dimensions are unknown.
    """
    if MAX_DIM is None or MAX_DIM <= 0:
        return None

    w, h = get_file_dimensions(file_path)
    if not w or not h:
        return None

    longest = max(w, h)
    if longest <= MAX_DIM:
        # Already small enough; keep original resolution
        return None

    # If width is the longer side, cap width.
    # If height is the longer side, cap height.
    if w >= h:
        return f"scale={MAX_DIM}:-1"
    else:
        return f"scale=-1:{MAX_DIM}"


def compute_shot_time_for_file(file_path: Path, shot_idx: int) -> int:
    """
    Decide at what second to capture a screenshot within THIS file.

    If duration is known and SHOT_TIMES entry is 0–1,
    treat as a fraction of duration. Otherwise, use FALLBACK_SECONDS.
    """
    duration = get_file_duration_sec(file_path)
    cfg = SHOT_TIMES[shot_idx % len(SHOT_TIMES)]

    try:
        val = float(cfg)
    except Exception:
        val = 0.5  # middle-ish default

    # Case 1: valid duration and fractional value
    if duration > 0 and 0 < val <= 1.0:
        t = int(duration * val)
        if t < 3 and duration > 6:
            t = 3
        if t >= duration:
            t = max(1, duration - 1)
        return t

    # Case 2: fallback seconds
    fb = FALLBACK_SECONDS[shot_idx % len(FALLBACK_SECONDS)]
    try:
        t = int(fb)
    except Exception:
        t = 30

    if duration > 0 and t >= duration:
        t = max(1, duration - 1)

    return t


def choose_file_for_shot(files: List[Path], shot_idx: int, total_shots: int) -> Path:
    """
    Choose which file to use for this screenshot.

    Strategy:
      - If only one file → always that file.
      - If multiple files and multiple shots → spread indices across the range
        (first, middle, last, etc.) so shots sample the whole DVD structure.
    """
    n = len(files)
    if n == 1:
        return files[0]

    if total_shots <= 1:
        # Just pick the largest (already sorted) – main title
        return files[0]

    # Spread shots across [0, n-1]
    ratio = shot_idx / float(max(1, total_shots - 1))
    index = int(round(ratio * (n - 1)))
    index = max(0, min(n - 1, index))
    return files[index]


def parse_aspect_hint(row: dict) -> Optional[str]:
    """
    Try to derive an aspect ratio hint (for setdar) from CSV metadata.

    We look at a few possible columns and try to map them to 16/9 or 4/3.

    Returns:
      - "16/9", "4/3", or None if no reliable hint is found.
    """
    candidates = [
        "AspectRatio",
        "VideoAspectRatio",
        "VideoDisplayAspectRatio",
        "DAR",
    ]

    raw = ""
    for key in candidates:
        if key in row and str(row[key]).strip():
            raw = str(row[key]).strip()
            break

    if not raw:
        return None

    txt = raw.lower().replace(" ", "")
    # direct ratios / common values
    if "16:9" in txt or "1.78" in txt or "1.77" in txt:
        return "16/9"
    if "4:3" in txt or "1.33" in txt or "1.34" in txt:
        return "4/3"

    try:
        if txt.endswith(":1"):
            txt = txt[:-2]
        val = float(txt)
        if 1.6 <= val <= 1.9:
            return "16/9"
        if 1.2 <= val <= 1.4:
            return "4/3"
    except Exception:
        pass

    return None


def build_ffmpeg_cmd(
    input_path: Path,
    output_path: Path,
    t_second: int,
    aspect_hint: Optional[str] = None,
):
    """
    Build an ffmpeg command line for one screenshot.

    We:
      - optional deinterlace (yadif)
      - optional setdar based on aspect_hint ("16/9" or "4/3")
      - optionally scale down so longest side <= MAX_DIM (no upscaling)
      - never pad, never force a fixed canvas size
    """
    vf_filters = []

    if DEINTERLACE:
        vf_filters.append("yadif")

    if aspect_hint in ("16/9", "4/3"):
        vf_filters.append(f"setdar={aspect_hint}")

    scale_filter = build_scale_filter_for_file(input_path)
    if scale_filter:
        vf_filters.append(scale_filter)

    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel", "warning",
        "-ss", str(t_second),
        "-i", str(input_path),
        "-frames:v", "1",
    ]

    if vf_filters:
        vf_arg = ",".join(vf_filters)
        cmd += ["-vf", vf_arg]

    if OUTPUT_FORMAT.lower() == "jpg":
        cmd += ["-q:v", str(JPEG_QUALITY)]
    elif OUTPUT_FORMAT.lower() == "webp":
        cmd += ["-quality", str(WEBP_QUALITY)]

    cmd.append(str(output_path))
    return cmd


def load_csv_rows(path: Path):
    """
    Load CSV rows, stripping any NUL characters that might break csv.reader.
    """
    if not path.exists():
        raise FileNotFoundError(f"CSV not found: {path}")

    with path.open("r", encoding="utf-8", errors="replace", newline="") as f:
        text = f.read().replace("\0", "")
    sio = StringIO(text)
    reader = csv.DictReader(sio)
    return list(reader)


def main():
    if not MASTER_CSV_PATH.exists():
        print(f"❌ CSV not found: {MASTER_CSV_PATH}")
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    # Load rows from CSV (NUL-safe)
    try:
        rows = load_csv_rows(MASTER_CSV_PATH)
    except Exception as e:
        print(f"❌ Failed to load CSV: {e}")
        return

    if not rows:
        print("❌ No rows found in CSV.")
        return

    # Filter rows for the chosen drive
    drive_rows = [r for r in rows if row_matches_drive(r)]
    if not drive_rows:
        print(f"❌ No rows matched drive filter: {DRIVE_FILTER}")
        return

    # Apply optional MAX_SHOWS limit (for testing)
    if MAX_SHOWS and MAX_SHOWS > 0:
        sample_rows = drive_rows[:MAX_SHOWS]
    else:
        sample_rows = drive_rows

    total_shows = len(sample_rows)
    print(f"🎬 Processing {total_shows} show(s) for drive filter: {DRIVE_FILTER!r}")

    # Prepare logging
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = REPORT_DIR / f"screenshot_capture_report_{timestamp}.csv"

    log_rows = []
    total_attempts = 0
    total_ok = 0

    for idx, row in enumerate(sample_rows, start=1):
        cid = canonical_id(row)
        files = get_rep_video_paths(row)
        aspect_hint = parse_aspect_hint(row)

        print(f"\n[{idx}/{total_shows}] ShowID={row.get('ShowID')} CanonicalID={cid}")
        print(f"  Artist: {row.get('Artist')}")
        print(f"  MasterDriveName: {row.get('MasterDriveName')}")
        print(f"  Folder: {row.get('FolderPath')}")
        print(f"  RepVideoFiles: {row.get('RepVideoFiles')}")
        print(f"  Candidate files (after size filter): {len(files)}")
        print(f"  Aspect hint: {aspect_hint}")

        if not cid:
            msg = "No CanonicalID (missing ChecksumSHA1 and ShowID)."
            print(f"  ⚠️ Skipping show: {msg}")
            log_rows.append({
                "ShowID": row.get("ShowID"),
                "CanonicalID": "",
                "Artist": row.get("Artist"),
                "MasterDriveName": row.get("MasterDriveName"),
                "FolderPath": row.get("FolderPath"),
                "RepVideoFiles": row.get("RepVideoFiles"),
                "VideoFileUsed": "",
                "ShotIndex": "",
                "ShotTimeSec": "",
                "Status": "SKIP_NO_ID",
                "ErrorMessage": msg,
            })
            continue

        if not files:
            msg = (
                "No usable video files found. Either RepVideoFiles are missing on disk "
                "or all are below MIN_VIDEO_FILE_SIZE_MB threshold."
            )
            print(f"  ⚠️ Skipping show: {msg}")
            log_rows.append({
                "ShowID": row.get("ShowID"),
                "CanonicalID": cid,
                "Artist": row.get("Artist"),
                "MasterDriveName": row.get("MasterDriveName"),
                "FolderPath": row.get("FolderPath"),
                "RepVideoFiles": row.get("RepVideoFiles"),
                "VideoFileUsed": "",
                "ShotIndex": "",
                "ShotTimeSec": "",
                "Status": "SKIP_NO_VIDEO",
                "ErrorMessage": msg,
            })
            continue

        for shot_idx in range(SHOTS_PER_SHOW):
            total_attempts += 1

            video_file = choose_file_for_shot(files, shot_idx, SHOTS_PER_SHOW)
            t_sec = compute_shot_time_for_file(video_file, shot_idx)

            ext = OUTPUT_FORMAT.lower()
            out_name = f"{cid}_{shot_idx+1:02d}.{ext}"
            out_path = OUTPUT_DIR / out_name

            if out_path.exists():
                msg = "Output file already exists; skipping to avoid overwrite."
                print(f"  ⏭️  {msg} ({out_name})")
                log_rows.append({
                    "ShowID": row.get("ShowID"),
                    "CanonicalID": cid,
                    "Artist": row.get("Artist"),
                    "MasterDriveName": row.get("MasterDriveName"),
                    "FolderPath": row.get("FolderPath"),
                    "RepVideoFiles": row.get("RepVideoFiles"),
                    "VideoFileUsed": str(video_file),
                    "ShotIndex": shot_idx + 1,
                    "ShotTimeSec": t_sec,
                    "Status": "SKIP_EXISTS",
                    "ErrorMessage": msg,
                })
                continue

            cmd = build_ffmpeg_cmd(video_file, out_path, t_sec, aspect_hint=aspect_hint)
            print(f"  📸 Capturing {out_name} from {video_file.name} at {t_sec}s")
            # Uncomment for debugging:
            # print("    ffmpeg cmd:", " ".join(shlex.quote(c) for c in cmd))

            try:
                result = subprocess.run(
                    cmd,
                    check=True,
                    capture_output=True,
                    text=True,
                )

                stderr_text = (result.stderr or "").strip()
                if stderr_text:
                    status = "OK_WITH_WARN"
                else:
                    status = "OK"

                log_rows.append({
                    "ShowID": row.get("ShowID"),
                    "CanonicalID": cid,
                    "Artist": row.get("Artist"),
                    "MasterDriveName": row.get("MasterDriveName"),
                    "FolderPath": row.get("FolderPath"),
                    "RepVideoFiles": row.get("RepVideoFiles"),
                    "VideoFileUsed": str(video_file),
                    "ShotIndex": shot_idx + 1,
                    "ShotTimeSec": t_sec,
                    "Status": status,
                    "ErrorMessage": stderr_text,
                })
                total_ok += 1

            except subprocess.CalledProcessError as e:
                err_msg = (e.stderr or "").strip() if e.stderr else str(e)
                print(f"  ❌ ffmpeg failed for {out_name}: {err_msg}")
                log_rows.append({
                    "ShowID": row.get("ShowID"),
                    "CanonicalID": cid,
                    "Artist": row.get("Artist"),
                    "MasterDriveName": row.get("MasterDriveName"),
                    "FolderPath": row.get("FolderPath"),
                    "RepVideoFiles": row.get("RepVideoFiles"),
                    "VideoFileUsed": str(video_file),
                    "ShotIndex": shot_idx + 1,
                    "ShotTimeSec": t_sec,
                    "Status": "ERROR_FFMPEG",
                    "ErrorMessage": err_msg,
                })

    # Write report CSV
    if log_rows:
        fieldnames = [
            "ShowID",
            "CanonicalID",
            "Artist",
            "MasterDriveName",
            "FolderPath",
            "RepVideoFiles",
            "VideoFileUsed",
            "ShotIndex",
            "ShotTimeSec",
            "Status",
            "ErrorMessage",
        ]
        with report_path.open("w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(log_rows)

        print(f"\n🧾 Capture report written to: {report_path}")
    else:
        print("\nℹ️ No log rows created (no shows processed?).")

    print(f"✅ Done. Screenshots (if any) are in: {OUTPUT_DIR}")
    print(f"   Total shot attempts: {total_attempts}, successful: {total_ok}")


if __name__ == "__main__":
    main()

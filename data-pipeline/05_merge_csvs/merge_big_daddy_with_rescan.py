#!/usr/bin/env python3
"""
merge_big_daddy_with_rescan.py (v2)

Safely merge your manually edited Big Daddy CSV with a rescan CSV
that includes ChecksumSHA1 / drive info — while preserving column order.

Preserves:
  • All manual edits and technical metadata from the cleaned CSV
  • Original column order from your manual CSV
Adds:
  • Missing checksum / drive / file size data from the rescan
Appends any new columns (from rescan) at the end.
"""

import pandas as pd
from pathlib import Path
from datetime import datetime

# Technical or scan metadata fields that can be safely updated from rescan
TECH_COLUMNS = [
    "FolderName", "FolderPath", "MasterDriveName", "MasterDriveID",
    "RepVideoCount", "RepVideoFiles", "Container", "VideoCodec",
    "Width", "Height", "DurationSec", "AspectRatio", "TVStandard",
    "AudioCodec", "AudioChannels", "AudioSampleRate",
    "FileCount", "TotalSizeBytes", "TotalSizeHuman",
    "ChecksumSHA1", "DuplicateOf",
    "LastScannedAt", "ExtractionWarnings",
]


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [c.strip() for c in df.columns]
    return df


def load_csv(path: Path) -> pd.DataFrame:
    print(f"📂 Loading {path} ...")
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    return normalize_columns(df)


def enrich_big_daddy(manual_path: Path, rescan_path: Path) -> Path:
    manual = load_csv(manual_path)
    rescan = load_csv(rescan_path)

    if "ShowID" not in manual.columns or "ShowID" not in rescan.columns:
        raise RuntimeError("Both CSVs must include a 'ShowID' column for matching.")

    # Preserve column order from manual
    original_order = list(manual.columns)

    # Identify any new columns in rescan not in manual
    new_cols = [c for c in rescan.columns if c not in manual.columns]
    all_cols = original_order + new_cols

    # Add missing columns to both
    for df in (manual, rescan):
        for c in all_cols:
            if c not in df.columns:
                df[c] = ""

    manual_idx = manual.set_index("ShowID", drop=False)
    rescan_idx = rescan.set_index("ShowID", drop=False)

    all_ids = sorted(set(manual_idx.index) | set(rescan_idx.index))

    merged_rows = []
    for sid in all_ids:
        base = manual_idx.loc[sid].copy() if sid in manual_idx.index else rescan_idx.loc[sid].copy()

        if sid in rescan_idx.index:
            new = rescan_idx.loc[sid]
            for col in all_cols:
                if col in TECH_COLUMNS:
                    val = str(new.get(col, "")).strip()
                    if val:
                        base[col] = val
                else:
                    current = str(base.get(col, "")).strip()
                    if not current:
                        base[col] = str(new.get(col, "")).strip()

        merged_rows.append(base)

    enriched = pd.DataFrame(merged_rows, columns=all_cols)

    # Sort logically for readability (optional)
    sort_cols = [c for c in ["Artist", "ShowDate", "FolderName"] if c in enriched.columns]
    if sort_cols:
        enriched.sort_values(by=sort_cols, inplace=True)

    # Save output
    ts = datetime.now().strftime("%Y-%m-%d_%H%M")
    out_path = manual_path.parent / f"BIG_DADDY_enriched_with_checksums_{ts}.csv"
    enriched.to_csv(out_path, index=False, encoding="utf-8")

    print(f"✅ Wrote enriched Big Daddy catalog (order preserved): {out_path}")
    print(f"📊 Total shows: {len(enriched)}")
    return out_path


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python3 merge_big_daddy_with_rescan.py <manual_csv> <rescan_csv>")
        sys.exit(1)

    manual_csv = Path(sys.argv[1]).expanduser().resolve()
    rescan_csv = Path(sys.argv[2]).expanduser().resolve()
    enrich_big_daddy(manual_csv, rescan_csv)

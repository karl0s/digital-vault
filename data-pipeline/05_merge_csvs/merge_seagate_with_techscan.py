#!/usr/bin/env python3
"""
merge_seagate_with_techscan.py

Combine:
  - your existing Seagate CSV (with checksums + manual edits)
  - a new tech-only scan CSV (with Video/Audio metadata)

Goal:
  - Preserve all manual edits and checksum fields from the original Seagate CSV
  - Add/refresh technical fields from the new tech scan
  - Output a new enriched Seagate CSV
"""

import pandas as pd
from pathlib import Path
from datetime import datetime

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

def enrich_seagate(manual_path: Path, techscan_path: Path) -> Path:
    manual = load_csv(manual_path)
    tech = load_csv(techscan_path)

    if "ShowID" not in manual.columns or "ShowID" not in tech.columns:
        raise RuntimeError("Both CSVs must include a 'ShowID' column for matching.")

    # Preserve column order from manual; append any new columns from techscan at the end
    original_order = list(manual.columns)
    new_cols = [c for c in tech.columns if c not in manual.columns]
    all_cols = original_order + new_cols

    # Ensure all columns exist in both
    for df in (manual, tech):
        for c in all_cols:
            if c not in df.columns:
                df[c] = ""

    manual_idx = manual.set_index("ShowID", drop=False)
    tech_idx = tech.set_index("ShowID", drop=False)

    all_ids = sorted(set(manual_idx.index) | set(tech_idx.index))

    merged_rows = []
    for sid in all_ids:
        # Start from your manual/edited row if it exists
        if sid in manual_idx.index:
            base = manual_idx.loc[sid].copy()
        else:
            base = tech_idx.loc[sid].copy()

        if sid in tech_idx.index:
            new = tech_idx.loc[sid]
            for col in all_cols:
                if col in TECH_COLUMNS:
                    # For Seagate, we want to keep existing ChecksumSHA1 from manual,
                    # so don't overwrite non-empty checksum with empty techscan checksum.
                    if col == "ChecksumSHA1":
                        continue
                    val = str(new.get(col, "")).strip()
                    if val:
                        base[col] = val
                else:
                    current = str(base.get(col, "")).strip()
                    if not current:
                        base[col] = str(new.get(col, "")).strip()

        merged_rows.append(base)

    enriched = pd.DataFrame(merged_rows, columns=all_cols)

    # Optional: sort for sanity
    sort_cols = [c for c in ["Artist", "ShowDate", "FolderName"] if c in enriched.columns]
    if sort_cols:
        enriched.sort_values(by=sort_cols, inplace=True)

    ts = datetime.now().strftime("%Y-%m-%d_%H%M")
    out_path = manual_path.parent / f"SEAGATE_enriched_with_tech_{ts}.csv"
    enriched.to_csv(out_path, index=False, encoding="utf-8")
    print(f"✅ Wrote enriched Seagate catalog: {out_path}")
    print(f"📊 Total shows: {len(enriched)}")
    return out_path

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python3 merge_seagate_with_techscan.py <manual_csv> <techscan_csv>")
        sys.exit(1)

    manual_csv = Path(sys.argv[1]).expanduser().resolve()
    techscan_csv = Path(sys.argv[2]).expanduser().resolve()
    enrich_seagate(manual_csv, techscan_csv)

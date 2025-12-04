#!/usr/bin/env python3
"""
merge_catalogs_safe.py

Safely merge two Show Catalog CSVs into a single master file,
preserving all unique shows and flagging duplicates.

Usage:
    python3 merge_catalogs_safe.py \
      shows_catalog_BIG_DADDY_2025-10-31_1409-cleaned-01.csv \
      seagate_musicvideo_catalog.csv
"""

import pandas as pd
from pathlib import Path
from datetime import datetime

def normalize_columns(df):
    """Lowercase and strip column names for consistent access."""
    df.columns = [c.strip() for c in df.columns]
    return df

def load_csv(path):
    print(f"📂 Loading {path} ...")
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    return normalize_columns(df)

def merge_catalogs(file1, file2):
    df1 = load_csv(file1)
    df2 = load_csv(file2)

    # Align columns (ensure same headers)
    all_cols = sorted(set(df1.columns) | set(df2.columns))
    for df in (df1, df2):
        for c in all_cols:
            if c not in df.columns:
                df[c] = ""

    # Concatenate
    combined = pd.concat([df1, df2], ignore_index=True, sort=False)
    print(f"🧩 Combined total before deduplication: {len(combined)} rows")

    # Determine unique key (prefer ChecksumSHA1, else ShowID)
    combined["__key__"] = combined["ChecksumSHA1"].replace("", pd.NA)
    combined["__key__"].fillna(combined["ShowID"], inplace=True)

    # Identify duplicates
    duplicates = combined[combined["__key__"].duplicated(keep="first")]
    print(f"⚠️  Found {len(duplicates)} duplicate rows (same ChecksumSHA1 or ShowID)")

    # Keep first instance only
    deduped = combined.drop_duplicates(subset="__key__", keep="first").copy()

    # Add info for tracking origin
    deduped["MergedFrom"] = ""
    deduped.loc[deduped.index < len(df1), "MergedFrom"] = "Big Daddy"
    deduped.loc[deduped.index >= len(df1), "MergedFrom"] = "Seagate"

    # Add marker for duplicates (for transparency)
    dup_keys = set(duplicates["__key__"].tolist())
    deduped["DuplicateInOtherFile"] = deduped["__key__"].apply(lambda k: "Yes" if k in dup_keys else "")

    # Sort by artist/date for readability
    deduped.sort_values(by=["Artist", "ShowDate", "FolderName"], inplace=True, na_position="last")

    # Output file path
    ts = datetime.now().strftime("%Y-%m-%d_%H%M")
    out_path = Path(file1).parent / f"merged_catalogs_{ts}.csv"
    deduped.to_csv(out_path, index=False, encoding="utf-8")

    print(f"✅ Wrote merged catalog: {out_path}")
    print(f"📊 Final unique shows: {len(deduped)} rows")

    return out_path

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python3 merge_catalogs_safe.py <file1.csv> <file2.csv>")
        sys.exit(1)
    file1, file2 = sys.argv[1], sys.argv[2]
    merge_catalogs(file1, file2)

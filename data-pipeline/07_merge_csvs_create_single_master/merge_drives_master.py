#!/usr/bin/env python3
"""
merge_drives_master.py

Merge two fully-enriched show catalogs (Big Daddy + Seagate) into:
  1) A master CSV with one row per unique show (by ChecksumSHA1, fallback ShowID)
  2) A duplicates report CSV listing all duplicate entries across drives

Usage:
    python3 merge_drives_master.py \
      BIG_DADDY_enriched_with_checksums_2025-11-06_0800.csv \
      SEAGATE_enriched_with_tech_2025-11-06_0930.csv
"""

import pandas as pd
from pathlib import Path
from datetime import datetime

def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [c.strip() for c in df.columns]
    return df

def load_catalog(path: Path, source_name: str) -> pd.DataFrame:
    print(f"📂 Loading {source_name} catalog: {path}")
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    df = normalize_columns(df)
    df["SourceCatalog"] = source_name
    return df

def compute_duplicate_key(df: pd.DataFrame) -> pd.Series:
    # Prefer ChecksumSHA1; fallback to ShowID
    checksum = df["ChecksumSHA1"].replace("", pd.NA)
    key = checksum.copy()
    no_checksum = key.isna()
    key[no_checksum] = df.loc[no_checksum, "ShowID"]
    return key.fillna("")

def merge_catalogs(big_path: Path, seagate_path: Path):
    # Load both catalogs
    big = load_catalog(big_path, "BigDaddy")
    sea = load_catalog(seagate_path, "Seagate")

    # Preserve column order from Big Daddy, append any extra columns from Seagate
    big_cols = list(big.columns)
    sea_cols = [c for c in sea.columns if c not in big_cols]
    all_cols = big_cols + sea_cols

    # Ensure both have all columns
    for df in (big, sea):
        for c in all_cols:
            if c not in df.columns:
                df[c] = ""

    # Combine
    combined = pd.concat([big[all_cols], sea[all_cols]], ignore_index=True)
    print(f"🧩 Combined rows before dedupe: {len(combined)}")

    # Compute duplicate key
    combined["DuplicateKey"] = compute_duplicate_key(combined)

    # Identify duplicate groups
    key_counts = combined["DuplicateKey"].value_counts()
    dup_keys = set(key_counts[key_counts > 1].index)

    # Mark primary rows: prefer BigDaddy when duplicates exist
    is_primary = []
    primary_catalog_for_key = {}

    # Precompute groups
    grouped = combined.groupby("DuplicateKey", sort=False)

    for key, group in grouped:
        if key == "" or key not in dup_keys:
            # Either no key or unique key: first occurrence is primary
            idxs = list(group.index)
            for i, idx in enumerate(idxs):
                is_primary.append((idx, "Yes" if i == 0 else "No"))
            if idxs:
                primary_catalog_for_key[key] = combined.loc[idxs[0], "SourceCatalog"]
        else:
            # Duplicate group
            # Prefer BigDaddy row as primary if present
            big_rows = group[group["SourceCatalog"] == "BigDaddy"]
            if not big_rows.empty:
                primary_idx = big_rows.index[0]
            else:
                primary_idx = group.index[0]

            for idx in group.index:
                is_primary.append((idx, "Yes" if idx == primary_idx else "No"))

            primary_catalog_for_key[key] = combined.loc[primary_idx, "SourceCatalog"]

    # Attach IsPrimary flag
    primary_map = {idx: val for idx, val in is_primary}
    combined["IsPrimary"] = combined.index.map(primary_map)

    # Attach PrimaryCatalog column
    combined["PrimaryCatalog"] = combined["DuplicateKey"].map(
        lambda k: primary_catalog_for_key.get(k, combined.loc[combined["DuplicateKey"] == k, "SourceCatalog"].iloc[0] if (combined["DuplicateKey"] == k).any() else "")
    )

    # Duplicates report: all rows where that DuplicateKey appears more than once
    duplicates_report = combined[combined["DuplicateKey"].isin(dup_keys)].copy()

    # Master unique: keep only primary rows
    master_unique = combined[combined["IsPrimary"] == "Yes"].copy()

    # Sort master for readability
    sort_cols = [c for c in ["Artist", "ShowDate", "FolderName"] if c in master_unique.columns]
    if sort_cols:
        master_unique.sort_values(by=sort_cols, inplace=True)

    print(f"✅ Unique shows in master: {len(master_unique)}")
    print(f"⚠️ Duplicate groups: {len(dup_keys)} (rows in duplicates report: {len(duplicates_report)})")

    # Output paths
    ts = datetime.now().strftime("%Y-%m-%d_%H%M")
    out_dir = big_path.parent

    master_path = out_dir / f"MASTER_merged_shows_{ts}.csv"
    dup_path = out_dir / f"MASTER_duplicates_report_{ts}.csv"

    master_unique.to_csv(master_path, index=False, encoding="utf-8")
    duplicates_report.to_csv(dup_path, index=False, encoding="utf-8")

    print(f"💾 Wrote master merged catalog: {master_path}")
    print(f"💾 Wrote duplicates report:     {dup_path}")

    return master_path, dup_path

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python3 merge_drives_master.py <BIG_DADDY_csv> <SEAGATE_csv>")
        sys.exit(1)

    big = Path(sys.argv[1]).expanduser().resolve()
    sea = Path(sys.argv[2]).expanduser().resolve()
    merge_catalogs(big, sea)

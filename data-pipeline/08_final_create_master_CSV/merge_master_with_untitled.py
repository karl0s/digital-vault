#!/usr/bin/env python3
"""
merge_master_with_untitled.py

Merge:
  1) Your existing MASTER merged catalog (BigDaddy + Seagate)
  2) A new catalog from the 3rd drive (Untitled)

Behavior:
  - Preserves ALL rows from the existing MASTER
  - Adds all new shows from Untitled
  - Identifies duplicates using ChecksumSHA1 (fallback ShowID)
  - Keeps MASTER rows as primary when duplicates exist
  - Writes:
      * NEW_MASTER_merged_shows_YYYY-MM-DD_HHMM.csv
      * NEW_MASTER_duplicates_report_YYYY-MM-DD_HHMM.csv
"""

import pandas as pd
from pathlib import Path
from datetime import datetime
from typing import Optional

def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [c.strip() for c in df.columns]
    return df

def load_catalog(path: Path, source_label: Optional[str] = None) -> pd.DataFrame:
    print(f"📂 Loading catalog: {path}")
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    df = normalize_columns(df)

    # Ensure SourceCatalog exists; if not, set it
    if "SourceCatalog" not in df.columns:
        df["SourceCatalog"] = source_label or "Master"
    else:
        # If a specific label is provided (for Untitled), override only empties
        if source_label:
            df.loc[df["SourceCatalog"] == "", "SourceCatalog"] = source_label

    return df

def compute_duplicate_key(df: pd.DataFrame) -> pd.Series:
    # Prefer checksum; fallback to ShowID
    checksum = df["ChecksumSHA1"].replace("", pd.NA)
    key = checksum.copy()
    no_checksum = key.isna()
    key[no_checksum] = df.loc[no_checksum, "ShowID"]
    return key.fillna("")

def merge_master_with_untitled(master_path: Path, untitled_path: Path):
    # Load existing master (already deduped BigDaddy + Seagate)
    master = load_catalog(master_path, None)

    # Load Untitled catalog; tag rows as Untitled
    unt = load_catalog(untitled_path, "Untitled")

    # Preserve column order from master; append any new columns from Untitled
    master_cols = list(master.columns)
    unt_cols_extra = [c for c in unt.columns if c not in master_cols]
    all_cols = master_cols + unt_cols_extra

    # Ensure both have all columns
    for df in (master, unt):
        for c in all_cols:
            if c not in df.columns:
                df[c] = ""

    # Combine
    combined = pd.concat([master[all_cols], unt[all_cols]], ignore_index=True)
    print(f"🧩 Combined rows before dedupe: {len(combined)}")

    # Compute duplicate key
    combined["DuplicateKey"] = compute_duplicate_key(combined)

    # Group by DuplicateKey
    key_counts = combined["DuplicateKey"].value_counts()
    dup_keys = set(key_counts[key_counts > 1].index)

    # Decide primary rows
    is_primary = []
    primary_catalog_for_key = {}

    grouped = combined.groupby("DuplicateKey", sort=False)

    for key, group in grouped:
        idxs = list(group.index)
        # If no key or it's unique -> first row is primary
        if key == "" or key not in dup_keys:
            for i, idx in enumerate(idxs):
                is_primary.append((idx, "Yes" if i == 0 else "No"))
            if idxs:
                primary_catalog_for_key[key] = combined.loc[idxs[0], "SourceCatalog"]
            continue

        # Duplicate group: prefer any non-Untitled row as primary (i.e., existing MASTER)
        non_unt = group[group["SourceCatalog"] != "Untitled"]
        if not non_unt.empty:
            primary_idx = non_unt.index[0]
        else:
            primary_idx = idxs[0]

        for idx in idxs:
            is_primary.append((idx, "Yes" if idx == primary_idx else "No"))

        primary_catalog_for_key[key] = combined.loc[primary_idx, "SourceCatalog"]

    # Attach IsPrimary flag
    primary_map = {idx: flag for idx, flag in is_primary}
    combined["IsPrimary"] = combined.index.map(primary_map)

    # Attach PrimaryCatalog column
    def get_primary_catalog(k: str) -> str:
        if k in primary_catalog_for_key:
            return primary_catalog_for_key[k]
        # Fallback: first SourceCatalog for that key
        rows = combined[combined["DuplicateKey"] == k]
        return rows["SourceCatalog"].iloc[0] if not rows.empty else ""

    combined["PrimaryCatalog"] = combined["DuplicateKey"].map(get_primary_catalog)

    # Build duplicates report: all rows where DuplicateKey appears more than once
    duplicates_report = combined[combined["DuplicateKey"].isin(dup_keys)].copy()

    # Build new master: only primary rows
    new_master = combined[combined["IsPrimary"] == "Yes"].copy()

    # Sort master logically for readability
    sort_cols = [c for c in ["Artist", "ShowDate", "FolderName"] if c in new_master.columns]
    if sort_cols:
        new_master.sort_values(by=sort_cols, inplace=True)

    print(f"✅ Unique shows in NEW master: {len(new_master)}")
    print(f"⚠️ Duplicate groups (incl. Untitled): {len(dup_keys)}")
    print(f"   Rows in NEW duplicates report: {len(duplicates_report)}")

    # Output paths
    ts = datetime.now().strftime("%Y-%m-%d_%H%M")
    out_dir = master_path.parent

    master_out = out_dir / f"NEW_MASTER_merged_shows_{ts}.csv"
    dup_out = out_dir / f"NEW_MASTER_duplicates_report_{ts}.csv"

    new_master.to_csv(master_out, index=False, encoding="utf-8")
    duplicates_report.to_csv(dup_out, index=False, encoding="utf-8")

    print(f"💾 Wrote NEW master catalog:    {master_out}")
    print(f"💾 Wrote NEW duplicates report: {dup_out}")

    return master_out, dup_out

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python3 merge_master_with_untitled.py <MASTER_csv> <UNTITLED_csv>")
        sys.exit(1)

    master_csv = Path(sys.argv[1]).expanduser().resolve()
    untitled_csv = Path(sys.argv[2]).expanduser().resolve()

    merge_master_with_untitled(master_csv, untitled_csv)

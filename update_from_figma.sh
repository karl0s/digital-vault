#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   From your project root (the-vault / digital-vault repo):
#     ./update_from_figma.sh /path/to/the-vault.zip
#
#   If no ZIP argument is given, it auto-selects the newest the-vault*.zip in ~/Downloads.
#
# What this script does NOW:
#   - Unzips the Figma Make export into a TEMP folder
#   - Treats TEMP/src as the Figma project root (same as your previous script)
#   - Syncs ONLY UI code & layout files into your project:
#       * main.tsx, App.tsx, other .tsx/.ts files, components, styles, etc.
#   - EXPLICITLY DOES NOT TOUCH:
#       * public/      (your real images + shows.json stay safe)
#       * .github/     (GitHub Actions + deploy workflow)
#       * package.json / package-lock.json
#       * vite.config.ts
#       * postcss.config.js, tailwind.config.*, tsconfig.*
#
#   - Keeps the Tailwind injection and build step as before.

# 0. Determine ZIP file
if [ "$#" -ge 1 ]; then
  ZIP="$1"
else
  ZIP=$(ls -t "$HOME/Downloads"/the-vault*.zip 2>/dev/null | head -n 1 || true)
  if [ -z "$ZIP" ]; then
    echo "No ZIP provided and no the-vault*.zip found in ~/Downloads"
    exit 1
  fi
fi

if [ ! -f "$ZIP" ]; then
  echo "ZIP not found: $ZIP"
  exit 1
fi

echo "Using Figma ZIP: $ZIP"

# 1. Unzip export to a temp directory
TEMP_DIR=$(mktemp -d)
unzip -q "$ZIP" -d "$TEMP_DIR"

# In this export format, the REAL project root is TEMP_DIR/src
PROJECT_SRC_ROOT="$TEMP_DIR/src"

if [ ! -d "$PROJECT_SRC_ROOT" ]; then
  echo "Expected project root at $PROJECT_SRC_ROOT but it does not exist."
  echo "If Figma changes its export structure, update PROJECT_SRC_ROOT in this script."
  exit 1
fi

echo "Detected Figma project root: $PROJECT_SRC_ROOT"

# 2. Stable project paths
PROJECT_DIR="$(pwd)"
PUBLIC_DIR="$PROJECT_DIR/public"

mkdir -p "$PUBLIC_DIR"

# 3. Sync UI code from Figma into our project, but DO NOT touch config/infra.
#
#    We rsync the whole Figma project root into our project root, but with
#    a bunch of excludes so we ONLY update "UI shell" files.
#
#    Safe to overwrite (comes from Figma):
#      - main.tsx, App.tsx, other .tsx/.ts components
#      - styles/, index.html, etc.
#
#    Protected (never overwritten by Figma):
#      - public/ (real images + JSON)
#      - .git/, .github/
#      - update_from_figma.sh
#      - package.json, package-lock.json
#      - vite.config.ts
#      - postcss.config.js
#      - tailwind.config.*
#      - tsconfig.json, tsconfig.node.json
echo "Syncing UI files from Figma into $PROJECT_DIR (configs & data are protected) ..."
rsync -av --delete \
  --exclude "public/" \
  --exclude "node_modules/" \
  --exclude ".git/" \
  --exclude ".github/" \
  --exclude "update_from_figma.sh" \
  --exclude "package.json" \
  --exclude "package-lock.json" \
  --exclude "vite.config.ts" \
  --exclude "postcss.config.js" \
  --exclude "tailwind.config.*" \
  --exclude "tsconfig.json" \
  --exclude "tsconfig.node.json" \
  "$PROJECT_SRC_ROOT/" "$PROJECT_DIR/"

# 4. DO NOT sync Figma's public/ at all anymore.
#    Your real data lives in PROJECT_DIR/public (shows.json + images),
#    and we want to keep that under your control.
echo "Skipping Figma public/ entirely to preserve your real images and JSON."
echo "Local public/ directory remains untouched."

# Ensure images directory still exists for your screenshots (just in case)
mkdir -p "$PUBLIC_DIR/images"

# 5. Install dependencies if needed
if [ ! -d node_modules ]; then
  echo "node_modules missing, running npm install..."
  npm install
else
  echo "node_modules already present. If you changed dependencies manually, run 'npm install' yourself."
fi

# 6. Inject Tailwind directives into the main CSS file if missing
#    In this export, index.css lives at the project root.
CSS_FILE="$PROJECT_DIR/index.css"

if [ -f "$CSS_FILE" ]; then
  if ! grep -q "@tailwind base" "$CSS_FILE"; then
    echo "Injecting Tailwind directives into $CSS_FILE ..."
    TMP="$CSS_FILE.tmp"
    {
      echo "@tailwind base;"
      echo "@tailwind components;"
      echo "@tailwind utilities;"
      echo ""
      cat "$CSS_FILE"
    } > "$TMP"
    mv "$TMP" "$CSS_FILE"
  else
    echo "Tailwind directives already present in $CSS_FILE; leaving as-is."
  fi
else
  echo "WARNING: $CSS_FILE not found. If Figma uses a different main CSS file, update CSS_FILE in this script."
fi

# 7. Build the project
echo "Running npm run build..."
npm run build

echo ""
echo "✅ Figma UI sync complete."
echo "   - Configs (vite.config.ts, package.json, workflows, etc.) preserved."
echo "   - public/ (shows.json + images) preserved."
echo "You can now run 'npm run dev' to preview locally."

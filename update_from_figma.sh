#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./update_from_figma.sh /path/to/the-vault.zip
#
# If no ZIP argument is given, auto-select the newest the-vault*.zip in ~/Downloads.

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
  exit 1
fi

echo "Detected Figma project root: $PROJECT_SRC_ROOT"

# 2. Stable project paths
PROJECT_DIR="$(pwd)"
PUBLIC_DIR="$PROJECT_DIR/public"

mkdir -p "$PUBLIC_DIR"

# 3. Sync project root files from Figma (App.tsx, main.tsx, index.css, package.json, vite.config.ts, etc.)
#    We exclude Figma's public/ (handled separately), node_modules/, and our own script.
echo "Syncing project root files from Figma into $PROJECT_DIR ..."
rsync -av --delete \
  --exclude "public/" \
  --exclude "node_modules/" \
  --exclude ".git/" \
  --exclude "update_from_figma.sh" \
  "$PROJECT_SRC_ROOT/" "$PROJECT_DIR/"

# 4. Sync public/, preserving your own images and JSON data files
echo "Syncing public/ (preserving images and JSON data) ..."
rsync -av --delete \
  --exclude "images/" \
  --exclude "shows.json" \
  --exclude "shows-test.json" \
  --exclude "test-images.json" \
  "$PROJECT_SRC_ROOT/public/" "$PUBLIC_DIR/"

# Ensure images directory exists for your screenshots
mkdir -p "$PUBLIC_DIR/images"

# 5. Install dependencies if needed
if [ ! -d node_modules ]; then
  echo "node_modules missing, running npm install..."
  npm install
else
  echo "node_modules already present. If you changed package.json, run 'npm install' manually."
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

# 7. Build the project (package.json should now contain the correct scripts)
echo "Running npm run build..."
npm run build

echo "Update complete. You can now run 'npm run dev' to preview."

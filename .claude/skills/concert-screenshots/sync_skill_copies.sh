#!/bin/bash
# Refresh the repo's copies of the pipeline scripts from the live ones here.
#
# ~/VaultShots is the MASTER copy of every script. The files beside each skill's
# SKILL.md in the repo are copies, kept so the tools are versioned and backed up
# with the site. Run this at the end of every run, before the commit, and include
# whatever it lists in that commit.
#
# Every script already in a skill folder is refreshed from its namesake here. To
# bundle a new script, copy it into the skill folder once; this keeps it current.
#
#   ~/VaultShots/sync_skill_copies.sh          # copy and list changes
#   ~/VaultShots/sync_skill_copies.sh --check  # list only; exit 1 if any differ

REPO="$HOME/Desktop/Projects/the-vault"
LIVE="$HOME/VaultShots"
CHECK=0; [ "$1" = "--check" ] && CHECK=1
changed=0

for skill in concert-screenshots va-masters; do
  dir="$REPO/.claude/skills/$skill"
  for copy in "$dir"/*; do
    name=$(basename "$copy")
    case "$name" in *.md) continue ;; esac
    src="$LIVE/$name"
    if [ ! -f "$src" ]; then
      echo "  no live copy:  $skill/$name  (only exists in the repo)"
      continue
    fi
    if ! cmp -s "$src" "$copy"; then
      changed=$((changed + 1))
      if [ $CHECK -eq 1 ]; then
        echo "  differs:       $skill/$name"
      else
        cp -p "$src" "$copy"
        echo "  updated:       .claude/skills/$skill/$name"
      fi
    fi
  done
done

if [ $changed -eq 0 ]; then
  echo "Skill copies match ~/VaultShots."
elif [ $CHECK -eq 1 ]; then
  echo "$changed copy/copies out of date — run without --check to refresh."
  exit 1
else
  echo "$changed copy/copies refreshed — commit them with this run."
fi

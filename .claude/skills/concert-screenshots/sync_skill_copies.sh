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
# It then commits ~/VaultShots itself (its own local git: scripts and data/, the
# big generated folders are ignored). It has no remote by the owner's choice
# (2026-10-05), so this commit is its only history — it went nine days
# uncommitted before this step existed.
#
#   ~/VaultShots/sync_skill_copies.sh "Nirvana run"  # copy, list, commit VaultShots
#   ~/VaultShots/sync_skill_copies.sh --check        # list only; exit 1 if any differ

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

[ $CHECK -eq 1 ] && exit 0
if [ -n "$(git -C "$LIVE" status --porcelain)" ]; then
  git -C "$LIVE" add -A && \
  git -C "$LIVE" commit -q -m "run: ${1:-end-of-run snapshot} ($(date +%Y-%m-%d))" && \
  echo "~/VaultShots committed: $(git -C "$LIVE" log --oneline -1)"
else
  echo "~/VaultShots already committed."
fi

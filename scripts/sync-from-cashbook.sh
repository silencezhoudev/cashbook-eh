#!/usr/bin/env bash
set -euo pipefail

# Sync content from sibling 'cashbook' into this repo, preserving .git and this script
# Usage: /absolute/path/to/cashbook-git/scripts/sync-from-cashbook.sh

SCRIPT_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$(cd "$REPO_DIR/../cashbook" && pwd)"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "Source directory not found: $SOURCE_DIR" >&2
  exit 1
fi
if [ ! -d "$REPO_DIR/.git" ]; then
  echo "Target .git directory not found: $REPO_DIR/.git" >&2
  exit 1
fi

echo "Syncing from $SOURCE_DIR to $REPO_DIR, preserving .git and this script ..."
rsync -a --delete \
  --exclude=".git" \
  --exclude="$(basename "$SCRIPT_FILE")" \
  --exclude="scripts/$(basename "$SCRIPT_FILE")" \
  "$SOURCE_DIR"/ "$REPO_DIR"/

echo "Sync complete. Current remotes:"
 git -C "$REPO_DIR" remote -v || true

echo "Done."

#!/usr/bin/env bash
set -euo pipefail

# Run from anywhere: ./tools/sync.sh "feat: describe the update"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MESSAGE="${1:-chore: sync project progress}"

git add -A

if git diff --cached --quiet; then
  echo "Already in sync: no local changes to commit."
  exit 0
fi

git commit -m "$MESSAGE"
git push origin main
echo "Synced to GitHub Pages source."

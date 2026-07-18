#!/usr/bin/env bash
# Sweeps any stale git lock files out of .git so git can run again.
# Can't truly delete over the Cowork device bridge, so locks are moved
# into _to_delete/ (functionally the same — git sees them gone).
set -e
cd "$(dirname "$0")"
mkdir -p _to_delete
found=$(find .git -name '*.lock' 2>/dev/null)
if [ -z "$found" ]; then echo "No lock files."; exit 0; fi
i=0
for f in $found; do
  mv "$f" "_to_delete/$(basename "$f").$i" && echo "cleared: $f"
  i=$((i+1))
done

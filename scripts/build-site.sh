#!/usr/bin/env bash
# Assemble ./public — the gated static app the Worker serves to subscribers.
# Copies ONLY git-tracked site files (index.html, data/*.json, photos, logo),
# never local/untracked scratch. Excludes the Worker, scripts, docs, git.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf public && mkdir -p public
git ls-files \
  | grep -vE '^(worker/|scripts/|\.github/|Gilly Lab/|node_modules/)' \
  | grep -vE '^(wrangler\.toml|package(-lock)?\.json)$' \
  | grep -vE '\.(py|md|sh)$' \
  | grep -vE '^[^/]*\.txt$' \
  | grep -vE '^data/_' \
  > /tmp/gl-site-files
rsync -a --files-from=/tmp/gl-site-files ./ public/

echo "public/ assembled: $(find public -type f | wc -l) files, $(du -sh public | cut -f1)"

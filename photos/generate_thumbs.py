#!/usr/bin/env python3
"""
Generates small avatar thumbnails for fighter photos.

The site's small avatars (rankings, odds, nav fight rows, simulator results,
tape study -- all 26-44px) load from photos/thumb/ instead of the full-res
photos/ originals, since the originals are ~350x254px and average ~120KB,
which is way oversized for a tiny circular avatar and was causing real
slowdown when many of them loaded in a row (e.g. clicking through every
rankings division).

This script is idempotent: it only generates a thumbnail for a source photo
that doesn't already have one in photos/thumb/, so it's safe to re-run any
time after adding new fighter photos to photos/ -- it won't waste time
re-processing photos that already have a thumbnail.

Usage:
    python3 photos/generate_thumbs.py

Requires: Pillow (pip install Pillow)
"""
from PIL import Image
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = HERE
DST_DIR = os.path.join(HERE, 'thumb')
THUMB_WIDTH = 110  # ~2.5x the largest avatar display size (44px), sharp on retina

def main():
    os.makedirs(DST_DIR, exist_ok=True)
    # Full photos are .jpg now (.png still supported for any legacy files).
    files = [f for f in os.listdir(SRC_DIR) if f.lower().endswith(('.jpg', '.png'))]

    generated = []
    skipped_existing = []
    errors = []

    for f in files:
        src_path = os.path.join(SRC_DIR, f)
        dst_path = os.path.join(DST_DIR, os.path.splitext(f)[0] + '.png')  # thumbs stay .png
        if os.path.exists(dst_path):
            skipped_existing.append(f)
            continue
        try:
            im = Image.open(src_path).convert('RGBA')
            w, h = im.size
            target_h = round(h * THUMB_WIDTH / w)
            thumb = im.resize((THUMB_WIDTH, target_h), Image.LANCZOS)
            thumb.save(dst_path, optimize=True)
            generated.append(f)
        except Exception as e:
            errors.append((f, str(e)))

    print(f'Generated {len(generated)} new thumbnail(s).')
    print(f'Skipped {len(skipped_existing)} already-existing thumbnail(s).')
    if errors:
        print(f'{len(errors)} error(s):')
        for name, err in errors:
            print(f'  {name}: {err}')

if __name__ == '__main__':
    main()

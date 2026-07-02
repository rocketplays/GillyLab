#!/usr/bin/env python3
"""Shrink full-size profile photos: photos/<slug>.png (~250KB, 600px) -> 400px
JPEG photos/<slug>.jpg (~15KB), then remove the .png. The hero avatar displays
in a 120px circle (object-fit:cover), so 400px stays crisp on retina and the
crop/fit is unchanged. Thumbnails (photos/thumb/) are left as-is. Resumable."""
from PIL import Image
import glob, os

MAX, Q = 400, 82
files = glob.glob("photos/*.png")   # top-level only, not photos/thumb/
conv = 0
for f in files:
    jpg = f[:-4] + ".jpg"
    if os.path.exists(jpg):
        if os.path.exists(f): os.remove(f)
        continue
    try:
        im = Image.open(f).convert("RGB")
        w, h = im.size
        s = MAX / max(w, h)
        if s < 1:
            im = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
        im.save(jpg, "JPEG", quality=Q, optimize=True)
        os.remove(f)
        conv += 1
    except Exception as e:
        print("ERR", f, e)
print("converted this run: %d | .png remaining: %d | .jpg total: %d"
      % (conv, len(glob.glob("photos/*.png")), len(glob.glob("photos/*.jpg"))))

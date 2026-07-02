#!/usr/bin/env python3
"""Shrink full-size profile photos to 400px JPEG (~15KB) and remove the .png.

ESPN headshots are transparent cutouts (RGBA). JPEG can't hold transparency, so
we flatten the alpha onto the avatar's exact background color (#18181d) — the
hero shows the photo in a #18181d circle, so this looks identical to the original
transparent version. Thumbnails (photos/thumb/) stay transparent PNG. Resumable:
converts any photos/<slug>.png present, overwriting the .jpg."""
from PIL import Image
import glob, os

MAX, Q = 400, 82
BG = (0x18, 0x18, 0x1d)   # --surface2, the fighter-big-avatar background

def convert(png):
    im = Image.open(png)
    rgba = im.convert("RGBA")
    flat = Image.new("RGB", rgba.size, BG)
    flat.paste(rgba, (0, 0), rgba)          # composite over BG using the alpha
    w, h = flat.size
    s = MAX / max(w, h)
    if s < 1:
        flat = flat.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    flat.save(png[:-4] + ".jpg", "JPEG", quality=Q, optimize=True)
    os.remove(png)

def main():
    pngs = glob.glob("photos/*.png")        # top-level only, not photos/thumb/
    n = 0
    for f in pngs:
        try:
            convert(f); n += 1
        except Exception as e:
            print("ERR", f, e)
    print("converted %d | .png remaining: %d | .jpg total: %d"
          % (n, len(glob.glob("photos/*.png")), len(glob.glob("photos/*.jpg"))))

if __name__ == "__main__":
    main()

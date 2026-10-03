"""Rasterise the Nudgio SVG master into the PNGs the site serves.

Draws the same primitives the SVG declares — round-capped strokes are circles
swept along their centreline — at 4x and downsamples, so the output is the
master rather than a lookalike. Keep the numbers here in sync with
assets/brand/nudgio-mark.svg; both are read from the same measurements.
"""
from PIL import Image, ImageDraw
import os

COBALT = (45, 77, 181)      # #2D4DB5
APRICOT = (233, 181, 142)   # #E9B58E
VIEW = (551, 512, 968)      # viewBox x, y, side

STEM = ((715, 788), (715, 1358), 242)
SHOULDER = (((718, 1350), (718, 1050), (720, 772), (1037, 772)),
            ((1037, 772), (1250, 772), (1241, 850), (1241, 1350)))
CHIMES = ((((1026, 536), (1120, 536), (1215, 560), (1259, 598)), 49),
          (((1412, 799), (1448, 860), (1456, 930), (1452, 998)), 49))
SPHERE = (1372, 671, 73)

def bez(p, t):
    mt = 1 - t
    return (mt**3*p[0][0] + 3*mt*mt*t*p[1][0] + 3*mt*t*t*p[2][0] + t**3*p[3][0],
            mt**3*p[0][1] + 3*mt*mt*t*p[1][1] + 3*mt*t*t*p[2][1] + t**3*p[3][1])

def sweep(draw, pts, width, scale, ox, oy, colour):
    r = width / 2 * scale
    for x, y in pts:
        cx, cy = (x - ox) * scale, (y - oy) * scale
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=colour)

def render(size, ss=4):
    n = size * ss
    scale = n / VIEW[2]
    ox, oy = VIEW[0], VIEW[1]
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    (x0, y0), (x1, y1), w = STEM
    sweep(d, [(x0, y0 + (y1 - y0) * i / 600) for i in range(601)], w, scale, ox, oy, COBALT + (255,))
    pts = [bez(SHOULDER[0], i / 800) for i in range(801)] + [bez(SHOULDER[1], i / 800) for i in range(801)]
    sweep(d, pts, 224, scale, ox, oy, COBALT + (255,))
    for curve, w in CHIMES:
        sweep(d, [bez(curve, i / 400) for i in range(401)], w, scale, ox, oy, COBALT + (255,))
    cx, cy, r = SPHERE
    cx, cy, r = (cx - ox) * scale, (cy - oy) * scale, r * scale
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=APRICOT + (255,))
    return img.resize((size, size), Image.LANCZOS)

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
out = os.path.join(root, "web", "brand")
os.makedirs(out, exist_ok=True)
for size in (512, 192, 64):
    render(size).save(os.path.join(out, "nudgio-mark-%d.png" % size), optimize=True)
    print("wrote nudgio-mark-%d.png" % size)

og = Image.new("RGB", (1200, 630), (247, 244, 238))
m = render(300)
og.paste(m, (450, 165), m)
og.save(os.path.join(out, "nudgio-og.png"), optimize=True)
print("wrote nudgio-og.png")

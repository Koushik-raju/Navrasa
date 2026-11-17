# Rebuilds public/img/hero-cup.webp and hero-depth.png from tools/source-photo.webp.
# Run from the tools/ folder:  python3 make-hero-3d.py   (needs Pillow + NumPy)
from PIL import Image, ImageFilter
import numpy as np
def box1(a, r, axis):
    if r < 1: return a
    pad = [(0, 0), (0, 0)]; pad[axis] = (r + 1, r)
    p = np.pad(a, pad, mode='edge'); c = np.cumsum(p, axis=axis)
    n = a.shape[axis]
    hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis); lo = np.take(c, np.arange(0, n), axis=axis)
    return (hi - lo) / (2 * r + 1)
def blur(a, r):
    r = max(1, int(r / 1.7))
    for _ in range(3): a = box1(box1(a, r, 0), r, 1)
    return a
im = Image.open('source-photo.webp').convert('RGB'); W, H = im.size
# 1) cut the product out of its plain white background
from PIL import ImageDraw
_a = np.asarray(im).astype(np.int16); _mn, _mx = _a.min(2), _a.max(2)
_b = Image.fromarray((((_mn > 236) & (_mx - _mn < 14)) * 255).astype(np.uint8), 'L').copy()
for pt in [(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)]:
    if _b.getpixel(pt) == 255: ImageDraw.floodfill(_b, pt, 128)
_mask = Image.fromarray(np.where(np.array(_b) == 128, 0, 255).astype(np.uint8), 'L').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.0))
_cut = im.copy(); _cut.putalpha(_mask)
# 2) soft shadow + depth map (outline numbers below are tuned to the current photo)
A = np.array(_cut).astype(np.float32)
rgb, alpha = A[..., :3], A[..., 3] / 255
mn, mx = rgb.min(2), rgb.max(2)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
cx = 762.0
def Rbody(y): return 555 + (373 - 555) * np.clip((y - 360) / (975 - 360), 0, 1)
bx = np.abs(xx - 766)
base = 942 + 42 * np.sqrt(np.clip(1 - (bx / 372) ** 2, 0, 1))
inside_body = ((yy <= 840) & (np.abs(xx - cx) < Rbody(yy) + 4)) | ((yy > 840) & (bx < 374) & (yy < base))
shadow = (yy > 820) & ~inside_body & (alpha > 0)
dark = np.clip((250 - rgb.mean(2)) / 110, 0, 1)
alpha2 = np.where(shadow, np.clip(dark, 0, 0.6) * alpha, alpha)
label = ((xx - 754) / 262) ** 2 + ((yy - 740) / 134) ** 2 < 1
clear = (yy > 835) & inside_body & ~label & (mx - mn < 26) & (mn > 125)
alpha2 = np.where(clear, np.clip((250 - rgb.mean(2)) / 110, 0, 0.6) * alpha, alpha2)
shadow = shadow | clear
rgb2 = np.where(shadow[..., None], np.array([60, 45, 30], np.float32), rgb)
_hero = Image.fromarray(np.dstack([rgb2, alpha2 * 255]).astype(np.uint8), 'RGBA')
# gentle sharpening (colour only, not the transparency) so fruit detail stays crisp when the photo is shown in 3D
_rgb = _hero.convert('RGB').filter(ImageFilter.UnsharpMask(radius=1.4, percent=70, threshold=2)); _rgb.putalpha(_hero.getchannel('A'))
_rgb.save('../public/img/hero-cup.webp', quality=95, method=6)
Rr = 555.0; dx = xx - cx
body = np.sqrt(np.clip(Rbody(yy) ** 2 - dx ** 2, 0, None)) / Rr
heapF = 0.35 + 0.65 * np.clip((yy - 40) / (360 - 40), 0, 1) ** 1.2
heap = np.sqrt(np.clip(Rr ** 2 - dx ** 2, 0, None)) / Rr * heapF
depth = np.where(yy >= 360, body, heap)
lum = rgb.mean(2)
hp = (blur(lum, 5) - blur(lum, 25)) / 255
depth = depth + np.where(yy < 420, hp * 0.12, 0)
fg = (alpha > 0.5) & ~shadow
m = fg.astype(np.float32); d = np.where(fg, depth, 0)
filled = d.copy(); known = m.copy()
for r in [3, 8, 20, 50, 120]:
    num, den = blur(d, r), blur(m, r)
    est = np.where(den > 1e-4, num / np.maximum(den, 1e-4), 0)
    filled = np.where(known > 0.5, filled, est); known = np.maximum(known, (den > 0.02).astype(np.float32))
fade = np.where(yy > 975, np.clip(1 - (yy - 975) / 60, 0, 1), 1)
filled = np.where(fg, d, filled * fade)
filled = blur(filled, 2)
filled = np.clip(filled / max(filled.max(), 1e-3), 0, 1)
dimg = Image.fromarray((filled * 255).astype(np.uint8), 'L').resize((768, 512), Image.LANCZOS)
dimg.save('../public/img/hero-depth.png'); 
print('ok')

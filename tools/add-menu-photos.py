# Adds menu photos (e.g. made with ChatGPT) to the website.
#
# 1. Put the images in a folder, each named after its item — either the item id or the item name:
#      tropical-fruit-bowl.png   or   Tropical Fruit Bowl.jpg
# 2. Run:  python3 add-menu-photos.py /path/to/folder
#
# Each photo is trimmed of plain white edges, fitted onto a white 1200x800 canvas, saved as
# public/img/menu/<id>.webp, and linked to its item in data/menu.json (menuVersion is raised so the
# live site picks them up; photos already uploaded in the admin panel are kept).
import json, os, re, sys
from PIL import Image, ImageOps, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
OUT = os.path.join(ROOT, 'public', 'img', 'menu')
MENU = os.path.join(ROOT, 'data', 'menu.json')
slug = lambda t: re.sub(r'[^a-z0-9]+', '-', t.lower()).strip('-')

def fit(im, W=1200, H=800, pad=0.06):
    im = ImageOps.exif_transpose(im).convert('RGB')
    bg = Image.new('RGB', im.size, (255, 255, 255))
    box = ImageChops.difference(im, bg).convert('L').point(lambda v: 255 if v > 18 else 0).getbbox()
    if box: im = im.crop(box)
    k = min(W * (1 - 2 * pad) / im.width, H * (1 - 2 * pad) / im.height)
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    canvas = Image.new('RGB', (W, H), (255, 255, 255))
    canvas.paste(im, ((W - im.width) // 2, (H - im.height) // 2))
    return canvas

def main(folder):
    menu = json.load(open(MENU))
    by = {}
    for b in menu['bowls']:
        by[b['id']] = b; by[slug(b['name'])] = b
    os.makedirs(OUT, exist_ok=True)
    done, unknown = [], []
    for f in sorted(os.listdir(folder)):
        name, ext = os.path.splitext(f)
        if ext.lower() not in ('.png', '.jpg', '.jpeg', '.webp'): continue
        item = by.get(slug(name))
        if not item: unknown.append(f); continue
        fit(Image.open(os.path.join(folder, f))).save(os.path.join(OUT, item['id'] + '.webp'), quality=88, method=6)
        item['image'] = f"/img/menu/{item['id']}.webp"; done.append(item['name'])
    if done:
        menu['menuVersion'] = menu.get('menuVersion', 1) + 1
        json.dump(menu, open(MENU, 'w'), indent=2, ensure_ascii=False); open(MENU, 'a').write('\n')
    print(f"added {len(done)} photo(s): {', '.join(done) or '-'}")
    if unknown: print('names not matched to a menu item:', ', '.join(unknown))
    print('still without a photo:', ', '.join(b['name'] for b in menu['bowls'] if not b.get('image')) or 'none')

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')

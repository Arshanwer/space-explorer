#!/usr/bin/env python3
"""Prepare the real astronomy pictures and the galaxy catalogue for Space Explorer.

    python3 -I scripts/astro-prep.py <folder with the source pictures> <galaxies.dsc>

Sources: see scripts/astro-sources.json (where each picture came from, credit, licence) and
Celestia's galaxy catalogue (CelestiaContent/data/galaxies.dsc, GPL-2.0-or-later; built from the
Revised NGC/IC catalogue, Karachentsev+ 2004, NED and RC3).

Writes:
  public/tex/astro/<id>.jpg        picture for the 3D scene (edges faded to black, sky level removed)
  public/tex/astro/sm/<id>.jpg     the same, small (used until you get close)
  public/tex/astro/card/<id>.jpg   picture for the info card (as published, smaller)
  public/tex/astro/thumb/<id>.jpg  little round dock picture (cropped square)
  public/tex/astro/deepfield.jpg   every galaxy in the Hubble Ultra Deep Field, cut out and packed
  public/tex/astro/galaxies.jpg    face-on galaxy pictures used for the 11,000 catalogue galaxies
  src/data/deepfield.json          where each cut-out sits in the deep field
  src/data/galaxies.json           the catalogue, packed (positions, sizes, real tilts, types)
"""
import base64
import json
import math
import re
import struct
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as nd

SRC = Path(sys.argv[1])
DSC = Path(sys.argv[2])
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'tex' / 'astro'
for d in (OUT, OUT / 'card', OUT / 'thumb', OUT / 'sm'):
    d.mkdir(parents=True, exist_ok=True)


def load(name):
    return np.asarray(Image.open(SRC / name).convert('RGB')).astype(np.float32) / 255.0


def save(arr, path, q=86):
    Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8)).save(path, quality=q, optimize=True, progressive=True)


def resize(arr, longest):
    h, w = arr.shape[:2]
    k = min(1.0, longest / max(h, w))
    if k >= 1:
        return arr
    im = Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8))
    im = im.resize((round(w * k), round(h * k)), Image.LANCZOS)
    return np.asarray(im).astype(np.float32) / 255.0


def lum(a):
    return a[..., 0] * 0.3 + a[..., 1] * 0.59 + a[..., 2] * 0.11


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def remove_stars(a, size=13, k=3.5):
    """Take out small sharp dots (foreground stars) so a galaxy can be laid flat in 3D without
    them stretching into streaks. Replaces each one with the smooth light around it."""
    L = lum(a)
    med = nd.median_filter(L, size=size)
    resid = L - med
    noise = np.median(np.abs(resid)) * 1.48 + 1e-4
    peaks = (resid > k * noise) & (resid > 0.05)
    # only compact things: an opening with a small disc keeps big structures out
    lab, n = nd.label(peaks)
    if n == 0:
        return a
    areas = nd.sum(peaks, lab, range(1, n + 1))
    small = np.isin(lab, np.nonzero(areas < size * size * 0.6)[0] + 1)
    small = nd.binary_dilation(small, iterations=2)
    out = a.copy()
    for c in range(3):
        m = nd.median_filter(a[..., c], size=size)
        out[..., c] = np.where(small, m, a[..., c])
    soft = nd.gaussian_filter(small.astype(np.float32), 1.0)[..., None]
    return a * (1 - soft) + out * soft


def prep_3d(a, feather=0.1, notch=False, sky=None):
    """Picture for the 3D scene: sky level taken off, black corners and the outer edge faded."""
    h, w = a.shape[:2]
    L = lum(a)
    if sky is None:
        border = np.concatenate([L[:12].ravel(), L[-12:].ravel(), L[:, :12].ravel(), L[:, -12:].ravel()])
        sky = float(np.median(border)) * 1.1 if np.median(border) < 0.12 else 0.0
    if sky > 0:
        a = np.clip((a - sky) / (1 - sky), 0, 1)
    m = np.ones((h, w), np.float32)
    if feather > 0:
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        e = np.minimum(np.minimum(xx, w - 1 - xx), np.minimum(yy, h - 1 - yy)) / min(h, w)
        m *= smoothstep(0.0, feather, e)
    if notch:
        # pure black areas outside the camera's view (mosaic gaps, the stepped corner of the old camera)
        valid = nd.gaussian_filter(L, 2) > 0.012
        valid = nd.binary_closing(valid, iterations=6)
        valid = nd.binary_fill_holes(valid)
        sig = min(h, w) / 45
        valid = nd.binary_erosion(valid, iterations=int(sig * 1.6))
        m *= nd.gaussian_filter(valid.astype(np.float32), sig)
    return a * m[..., None]


def thumb(a, cx, cy, size, path, px=112):
    """Square crop around (cx, cy) (fractions of the width/height), `size` = fraction of the shorter side."""
    h, w = a.shape[:2]
    s = int(min(h, w) * size)
    x0 = int(np.clip(cx * w - s / 2, 0, w - s))
    y0 = int(np.clip(cy * h - s / 2, 0, h - s))
    crop = a[y0:y0 + s, x0:x0 + s]
    im = Image.fromarray((np.clip(crop, 0, 1) * 255 + 0.5).astype(np.uint8)).resize((px, px), Image.LANCZOS)
    im.save(path, quality=84, optimize=True)


# id: (source, longest side in 3D, feather, black notches?, remove stars?, thumb centre x, y, size)
PICS = {
    'orion': ('orion-nebula-m42-hubble.jpg', 2048, 0.16, False, False, 0.55, 0.45, 0.8),
    'horsehead': ('horsehead-nebula-hubble-ir.jpg', 1200, 0.14, False, False, 0.5, 0.42, 0.85),
    'eagle': ('pillars-of-creation-hubble-1995.jpg', 1200, 0.1, True, False, 0.36, 0.6, 0.62),
    'carina': ('carina-cosmic-cliffs-jwst.jpg', 2048, 0.14, False, False, 0.42, 0.5, 0.95),
    'mystic': ('carina-mystic-mountain-hubble.jpg', 1200, 0.14, False, False, 0.55, 0.5, 0.9),
    'crab': ('crab-nebula-m1-hubble.jpg', 985, 0.08, False, False, 0.5, 0.5, 0.95),
    'crabcore': ('crab-nebula-center-hubble.jpg', 0, 0, False, False, 0.55, 0.5, 0.7),
    'ring': ('ring-nebula-m57-hubble-1999.jpg', 1215, 0.08, False, False, 0.5, 0.5, 0.9),
    'helix': ('helix-nebula-hubble.jpg', 2048, 0.08, False, False, 0.5, 0.5, 0.95),
    'southernring': ('southern-ring-nebula-jwst.jpg', 1600, 0.08, False, False, 0.5, 0.5, 0.75),
    'tarantula': ('tarantula-nebula-jwst.jpg', 2048, 0.14, False, False, 0.45, 0.5, 0.9),
    'r136': ('tarantula-r136-hubble.jpg', 0, 0, False, False, 0.6, 0.4, 0.8),
    'n159': ('lmc-n159-hubble.jpg', 1600, 0.16, False, False, 0.5, 0.5, 0.9),
    'e0102': ('snr-e0102-hubble.jpg', 1200, 0.12, False, False, 0.42, 0.78, 0.3),
    'pleiades': ('pleiades-m45-matariki.jpg', 0, 0, False, False, 0.5, 0.5, 0.95),
    'vycma': ('vy-canis-majoris-hubble.jpg', 0, 0, False, False, 0.5, 0.5, 0.6),
    'andromeda': ('andromeda-m31-amateur.jpg', 2048, 0.05, False, True, 0.49, 0.45, 0.5),
    'triangulum': ('triangulum-m33-hubble-mosaic.jpg', 1000, 0.02, True, True, 0.6, 0.57, 0.55),
    'whirlpool': ('whirlpool-m51-hubble.jpg', 2048, 0.08, False, False, 0.4, 0.47, 0.9),
    'pinwheel': ('pinwheel-m101-hubble.jpg', 1280, 0.08, False, False, 0.49, 0.52, 0.95),
    'sombrero': ('sombrero-m104-hubble.jpg', 2048, 0.22, False, False, 0.5, 0.5, 0.75),
    'cena': ('centaurus-a-hubble-core.jpg', 1600, 0.18, True, False, 0.5, 0.5, 0.55),
    'm87': ('m87-jet-hubble.jpg', 1024, 0.3, False, False, 0.53, 0.48, 0.5),
    'hudf': ('hubble-ultra-deep-field.jpg', 0, 0, False, False, 0.5, 0.5, 0.45),
    'xdf': ('hubble-xdf.jpg', 0, 0, False, False, 0.5, 0.5, 0.5),
    'hdf': ('hubble-deep-field-1995.jpg', 0, 0, False, False, 0.3, 0.7, 0.4),
    'webbdeep': ('jwst-smacs0723-first-deep-field.jpg', 0, 0, False, False, 0.5, 0.5, 0.45),
}

# disc galaxies laid flat in 3D: keep only the galaxy's own oval (no foreground stars or neighbours)
# (centre x, y as fractions, semi-major axis as a fraction of the width, short/long ratio, angle in degrees)
ELLIPSE = {'andromeda': (0.4929, 0.4542, 0.45, 0.33, -36.6)}


def ellipse_mask(a, cx, cy, A, ratio, ang):
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    t = math.radians(ang)
    dx, dy = xx - cx * w, yy - cy * h
    u = dx * math.cos(t) + dy * math.sin(t)
    v = -dx * math.sin(t) + dy * math.cos(t)
    rho = np.sqrt((u / (A * w)) ** 2 + (v / (A * w * ratio)) ** 2)
    return a * smoothstep(1.0, 0.72, rho)[..., None]


info = {}
for pid, (src, n3d, feather, notch, starless, tx, ty, ts) in PICS.items():
    a = load(src)
    h, w = a.shape[:2]
    card = resize(a, 720)
    save(card, OUT / 'card' / f'{pid}.jpg', 84)
    thumb(a, tx, ty, ts, OUT / 'thumb' / f'{pid}.jpg')
    if n3d:
        b = resize(a, n3d)
        if starless:
            b = remove_stars(b)
        b = prep_3d(b, feather, notch)
        if pid in ELLIPSE:
            b = ellipse_mask(b, *ELLIPSE[pid])
        save(b, OUT / f'{pid}.jpg', 88)
        save(resize(b, 512), OUT / 'sm' / f'{pid}.jpg', 86)  # while it is small on screen
        info[pid] = {'w': b.shape[1], 'h': b.shape[0]}
    print(pid, w, h, info.get(pid))


# ---------------- the deep field, galaxy by galaxy ----------------
def cutouts(a, drop):
    L = lum(a)
    h, w = L.shape
    S = nd.gaussian_filter(L, 1.2)
    bg = float(np.median(S))
    noise = float(np.median(np.abs(S - bg))) * 1.48 + 1e-4
    det = S > bg + 4.0 * noise + 0.012
    lab, n = nd.label(det, structure=np.ones((3, 3)))
    objs = nd.find_objects(lab)
    out = []
    for i, sl in enumerate(objs):
        k = i + 1
        m = lab[sl] == k
        area = int(m.sum())
        if area < 5:
            continue
        ys, xs = np.nonzero(m)
        flux = float((L[sl][m] - bg).clip(0).sum())
        cy = sl[0].start + float(ys.mean())
        cx = sl[1].start + float(xs.mean())
        if any(math.hypot(cx - dx, cy - dy) < dr for dx, dy, dr in drop):
            continue
        # a soft mask around the galaxy so its neighbours don't come with it
        pad = 3 + int(math.sqrt(area) * 0.35)
        y0, y1 = max(0, sl[0].start - pad), min(h, sl[0].stop + pad)
        x0, x1 = max(0, sl[1].start - pad), min(w, sl[1].stop + pad)
        mm = (lab[y0:y1, x0:x1] == k).astype(np.float32)
        mm = nd.binary_dilation(mm > 0, iterations=2 + pad // 3).astype(np.float32)
        mm = nd.gaussian_filter(mm, 1.0 + pad * 0.25)
        patch = np.clip((a[y0:y1, x0:x1] - bg) / (1 - bg), 0, 1) * mm[..., None]
        col = patch.reshape(-1, 3).sum(0)
        col = col / (col.sum() + 1e-6)
        out.append({'patch': patch, 'cx': cx, 'cy': cy, 'area': area, 'flux': flux, 'col': col.tolist(), 'peak': float(L[sl][m].max())})
    return out, (w, h)


def pack(items, W, H, gap=1):
    """Shelf packing, tallest first. Returns False if they don't fit."""
    items = sorted(items, key=lambda o: -o['patch'].shape[0])
    x = y = shelf = 0
    for o in items:
        ph, pw = o['patch'].shape[:2]
        if x + pw > W:
            x, y, shelf = 0, y + shelf + gap, 0
        if y + ph > H:
            return False
        o['ax'], o['ay'] = x, y
        x += pw + gap
        shelf = max(shelf, ph)
    return True


hudf = load('hubble-ultra-deep-field.jpg')
# foreground stars in our own galaxy (the ones with spikes): leave them out of the fly-through
STARS = [(318, 213, 14), (963, 748, 30), (176, 282, 12), (515, 18, 8)]
gals, (fw, fh) = cutouts(hudf, STARS)
gals = [g for g in gals if not (g['peak'] > 0.97 and g['area'] < 60)]  # other tiny saturated dots: stars
AW = AH = 2048
while not pack(gals, AW, AH):
    gals = sorted(gals, key=lambda o: -o['flux'])[:int(len(gals) * 0.9)]
atlas = np.zeros((AH, AW, 3), np.float32)
for g in gals:
    ph, pw = g['patch'].shape[:2]
    atlas[g['ay']:g['ay'] + ph, g['ax']:g['ax'] + pw] = np.maximum(atlas[g['ay']:g['ay'] + ph, g['ax']:g['ax'] + pw], g['patch'])
used_h = max(g['ay'] + g['patch'].shape[0] for g in gals)
AH2 = 1 << math.ceil(math.log2(used_h))
save(atlas[:AH2], OUT / 'deepfield.jpg', 90)
recs = []
for g in gals:
    ph, pw = g['patch'].shape[:2]
    r, gg, b = g['col']
    recs.append([round(g['cx'] / fw * 2 - 1, 4), round(1 - g['cy'] / fh * 2, 4),          # place in the picture (-1..1)
                 g['ax'], g['ay'], pw, ph,                                              # where in the atlas (px)
                 round(math.log10(g['flux'] + 1e-3), 3), round(r - b, 3)])             # brightness, redness
deepfield = {'atlas': [AW, AH2], 'field': [fw, fh], 'galaxies': recs}
(ROOT / 'src' / 'data' / 'deepfield.json').write_text(json.dumps(deepfield, separators=(',', ':')))
print('deep field:', len(recs), 'galaxies; atlas', AW, 'x', AH2)


# ---------------- pictures for the 11,000 catalogue galaxies ----------------
# Face-on pictures go on discs tipped to each galaxy's real tilt; round smooth ones are ellipticals.
CELL = 128
tmpl = []


def add_tmpl(img, kind):
    im = Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)).resize((CELL, CELL), Image.LANCZOS)
    arr = np.asarray(im).astype(np.float32) / 255
    yy, xx = np.mgrid[0:CELL, 0:CELL]
    r = np.hypot(xx - CELL / 2 + 0.5, yy - CELL / 2 + 0.5) / (CELL / 2)
    tmpl.append((arr * smoothstep(1.0, 0.8, r)[..., None], kind))


def square(a, cx, cy, s):
    h, w = a.shape[:2]
    s = int(s)
    x0 = int(np.clip(cx - s / 2, 0, w - s)); y0 = int(np.clip(cy - s / 2, 0, h - s))
    return a[y0:y0 + s, x0:x0 + s]


m51 = prep_3d(load('whirlpool-m51-hubble.jpg'), 0)
add_tmpl(square(m51, 965, 708, 1250), 0)
m101 = prep_3d(load('pinwheel-m101-hubble.jpg'), 0)
add_tmpl(square(m101, 629, 525, 1000), 0)
m87 = prep_3d(load('m87-jet-hubble.jpg'), 0)
add_tmpl(square(m87, 512, 512, 700), 1)
# the biggest, clearest deep-field galaxies (scaled up)
big = sorted(gals, key=lambda o: -o['area'])
for g in big:
    if len(tmpl) >= 64:
        break
    p = g['patch']
    ph, pw = p.shape[:2]
    if min(ph, pw) < 18:
        continue
    s = max(ph, pw)
    sq = np.zeros((s, s, 3), np.float32)
    sq[(s - ph) // 2:(s - ph) // 2 + ph, (s - pw) // 2:(s - pw) // 2 + pw] = p
    L = lum(p)
    ys, xs = np.nonzero(L > L.max() * 0.15)
    ratio = (min(np.ptp(xs), np.ptp(ys)) + 1) / (max(np.ptp(xs), np.ptp(ys)) + 1)
    red = g['col'][0] - g['col'][2]
    kind = 1 if (red > 0.12 and ratio > 0.6) else 0 if ratio > 0.62 else 2
    add_tmpl(sq / max(sq.max(), 1e-3) * 0.9, kind)
tatlas = np.zeros((1024, 1024, 3), np.float32)
for i, (img, k) in enumerate(tmpl):
    tx, ty = (i % 8) * CELL, (i // 8) * CELL
    tatlas[ty:ty + CELL, tx:tx + CELL] = img
save(tatlas, OUT / 'galaxies.jpg', 88)
kinds = [k for _, k in tmpl]
print('templates', len(tmpl), 'kinds', {k: kinds.count(k) for k in set(kinds)})


# ---------------- the galaxy catalogue ----------------
T = np.array([
    [-0.0548755604162154, -0.8734370902348850, -0.4838350155487132],
    [+0.4941094278755837, -0.4448296299600112, +0.7469822444972189],
    [-0.8676661490190047, -0.1980763734312015, +0.4559837761750669],
])
EPS = math.radians(23.4393)
RX = np.array([[1, 0, 0], [0, math.cos(EPS), -math.sin(EPS)], [0, math.sin(EPS), math.cos(EPS)]])


def eq_to_deep(v):
    g = T @ v
    return np.array([g[0], g[2], -g[1]])


def rot(axis, ang):
    a = np.array(axis) / np.linalg.norm(axis); t = math.radians(ang)
    K = np.array([[0, -a[2], a[1]], [a[2], 0, -a[0]], [-a[1], a[0], 0]])
    return np.eye(3) + math.sin(t) * K + (1 - math.cos(t)) * K @ K


def oct_enc(v):
    v = v / np.abs(v).sum()
    x, y = v[0], v[1]
    if v[2] < 0:
        x, y = (1 - abs(v[1])) * (1 if v[0] >= 0 else -1), (1 - abs(v[0])) * (1 if v[1] >= 0 else -1)
    return int(round(np.clip(x, -1, 1) * 32767)), int(round(np.clip(y, -1, 1) * 32767))


SKIP = {'Milky Way', 'LMC', 'SMC'}  # drawn separately
txt = DSC.read_text()
TYPES = ['E', 'S0', 'Sa', 'Sb', 'Sc', 'SBa', 'SBb', 'SBc', 'Irr']
rows = []
for name, body in re.findall(r'Galaxy\s+"([^"]*)"\s*\{(.*?)\}', txt, re.S):
    names = name.split(':')
    if names[0] in SKIP:
        continue
    g = lambda k: re.search(r'\b' + k + r'\s+(\S+)', body).group(1)
    t = re.search(r'Type\s+"([^"]*)"', body).group(1)
    ra, dec, dist = math.radians(float(g('RA')) * 15), math.radians(float(g('Dec'))), float(g('Distance'))
    radius, absmag = float(g('Radius')), float(g('AbsMag'))
    ax = [float(x) for x in re.search(r'Axis\s*\[\s*(\S+)\s+(\S+)\s+(\S+)\s*\]', body).groups()]
    ang = float(g('Angle'))
    L = np.array([math.cos(ra) * math.cos(dec), math.sin(ra) * math.cos(dec), math.sin(dec)])
    # Celestia's convention (checked against M31, M33, M81, NGC 891, NGC 4565 and others):
    # the disc's spin axis is the rotation's inverse applied to +y, in its ecliptic frame
    v = rot(ax, ang).T[:, 1]
    n_eq = RX @ np.array([v[0], -v[2], v[1]])
    rows.append((names, 'E' if t.startswith('E') else t, eq_to_deep(L), dist, radius, absmag, eq_to_deep(n_eq)))

rows.sort(key=lambda r: r[3])
lnD = [math.log(rows[0][3]), math.log(rows[-1][3])]
buf = bytearray()
rng = np.random.default_rng(5)
tk = np.array(kinds)
pools = {k: np.nonzero(tk == k)[0] for k in (0, 1, 2)}
named = {}
for i, (names, t, d, dist, radius, absmag, n) in enumerate(rows):
    ox, oy = oct_enc(d)
    nx, ny = oct_enc(n if n[1] >= 0 else -n)
    q = int(round((math.log(dist) - lnD[0]) / (lnD[1] - lnD[0]) * 65535))
    kind = 1 if t == 'E' else 2 if t == 'Irr' else 0
    tid = int(rng.choice(pools[kind])) if kind != 0 or rng.random() < 0.85 else int(rng.choice(pools[2]))
    ti = TYPES.index(t)
    rq = int(np.clip(round((math.log10(radius) - 2.5) / 3.0 * 255), 0, 255))      # radius 300 ly .. 300,000 ly
    mq = int(np.clip(round((absmag + 24) * 20), 0, 255))                          # -24 .. -11.25
    # direction (octahedral), log distance, spin axis (octahedral, coarse), radius, brightness, type, picture
    buf += struct.pack('<hhHbbBBBB', ox, oy, q, int(round(nx / 258)), int(round(ny / 258)), rq, mq, ti, tid)
    for nm in names:
        if re.fullmatch(r'M \d+|NGC \d+', nm):
            named[nm.replace(' ', '')] = i
REC = 4 + 2 + 6
assert len(buf) == len(rows) * REC
gal = {'count': len(rows), 'rec': REC, 'lnDist': lnD, 'types': TYPES, 'tmplKinds': kinds,
       'named': {k: named[k] for k in ['M31', 'M33', 'M51', 'M101', 'M104', 'M87', 'NGC5128', 'M81', 'M82'] if k in named},
       'b64': base64.b64encode(bytes(buf)).decode()}
(ROOT / 'src' / 'data' / 'galaxies.json').write_text(json.dumps(gal, separators=(',', ':')))
print('catalogue:', len(rows), 'galaxies,', len(buf) // 1024, 'KB')
json.dump(info, open(ROOT / 'scripts' / 'astro-sizes.json', 'w'))

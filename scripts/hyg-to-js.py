"""Turn the HYG star catalogue into a compact 3D star map for the deep-space view.

Run:  python3 scripts/hyg-to-js.py path/to/hygdata_v41.csv  > src/data/starsNear.js

Source: HYG database v4.1 by David Nash (astronexus), CC BY-SA 4.0
(https://github.com/astronexus/HYG-Database). The output is a derived subset and
shares that licence.

Keeps every star brighter than magnitude 8 plus everything within 30 parsecs
(so the faint red dwarfs next door, like Proxima and Wolf 359, are there too).
Positions are in light-years in the "deep frame": x towards the centre of the
Milky Way, y towards galactic north, z = -(direction the Sun is orbiting).
Each star is 8 bytes: direction as two int16 (octahedral encoding, ~0.003 degrees),
distance as uint16 on a log scale (0.016% steps from 0.1 to 4000 ly), uint8 absolute
magnitude, uint8 colour index.
"""
import base64, csv, json, math, struct, sys

LY_PER_PC = 3.26156
# J2000 equatorial -> galactic rotation (IAU / Hipparcos)
T = [[-0.0548755604162154, -0.8734370902348850, -0.4838350155487132],
     [+0.4941094278755837, -0.4448296299600112, +0.7469822444972189],
     [-0.8676661490190047, -0.1980763734312015, +0.4559837761750669]]

def to_deep(x, y, z):
    g = [T[i][0] * x + T[i][1] * y + T[i][2] * z for i in range(3)]
    return g[0], g[2], -g[1]

NAMED_HIP = {
    'proxima': 70890, 'alphacen': 71683, 'alphacenb': 71681, 'barnard': 87937, 'sirius': 32349,
    'epseri': 16537, 'procyon': 37279, 'tauceti': 8102, 'altair': 97649, 'vega': 91262,
    'fomalhaut': 113368, 'arcturus': 69673, 'capella': 24608, 'pollux': 37826, 'aldebaran': 21421,
    'achernar': 7588, 'canopus': 30438, 'acrux': 60718, 'mimosa': 62434, 'gacrux': 61084,
    'imai': 59747, 'ginan': 60260, 'polaris': 11767, 'betelgeuse': 27989, 'antares': 80763,
    'rigel': 24436, 'deneb': 102098, 'spica': 65474, 'alcyone': 17702, 'hadar': 68702,
}
NAMED_ID = {'wolf359': 118720}
# Distances the Hipparcos satellite is known to have got wrong, replaced with modern values
# (these are the ones the app's cards talk about, so the 3D map should agree with them).
PLEIADES_RA_H, PLEIADES_DEC, PLEIADES_PC = 3.79, 24.117, 136.2   # Gaia / VLBI: ~444 ly (Hipparcos said ~390)
DIST_FIX_PC = {27989: 168.0}                                      # Betelgeuse: Joyce et al. 2020, ~548 ly

def ang_sep_deg(ra1_h, dec1, ra2_h, dec2):
    a1, d1, a2, d2 = map(math.radians, (ra1_h * 15, dec1, ra2_h * 15, dec2))
    c = math.sin(d1) * math.sin(d2) + math.cos(d1) * math.cos(d2) * math.cos(a1 - a2)
    return math.degrees(math.acos(max(-1.0, min(1.0, c))))
PLEIADES = {'Alcyone', 'Atlas', 'Electra', 'Maia', 'Merope', 'Taygeta', 'Pleione', 'Celaeno', 'Asterope'}

def main(path):
    rows = list(csv.DictReader(open(path, newline='')))
    keep, named, pleiades = [], {}, []
    for r in rows:
        try:
            dist = float(r['dist']); mag = float(r['mag']); absmag = float(r['absmag'])
        except ValueError:
            continue
        if r['id'] == '0' or dist >= 100000 or dist <= 0:
            continue
        hip = int(float(r['hip'])) if r['hip'] else None
        is_named = hip in NAMED_HIP.values() or int(r['id']) in NAMED_ID.values()
        if not (mag <= 8.0 or dist <= 30 or is_named):
            continue
        x, y, z = (float(r['x']) * LY_PER_PC, float(r['y']) * LY_PER_PC, float(r['z']) * LY_PER_PC)
        new_pc = DIST_FIX_PC.get(hip)
        if new_pc is None and 100 < dist < 150 and ang_sep_deg(float(r['ra']), float(r['dec']), PLEIADES_RA_H, PLEIADES_DEC) < 2.0:
            new_pc = PLEIADES_PC
        if new_pc is not None:
            k = new_pc / dist
            x, y, z = x * k, y * k, z * k
            absmag = mag - 5 * math.log10(new_pc / 10)
        dx, dy, dz = to_deep(x, y, z)
        try:
            ci = float(r['ci'])
        except ValueError:
            ci = 0.65
        idx = len(keep)
        keep.append((dx, dy, dz, absmag, ci))
        for k, h in NAMED_HIP.items():
            if hip == h:
                named[k] = idx
        for k, i in NAMED_ID.items():
            if int(r['id']) == i:
                named[k] = idx
        if r['proper'] in PLEIADES:
            pleiades.append((dx, dy, dz))
    # brightest first, so the GPU draws the stars that matter on top when they overlap
    order = sorted(range(len(keep)), key=lambda i: keep[i][3])
    remap = {old: new for new, old in enumerate(order)}
    buf = bytearray()
    LN_MIN, LN_MAX = math.log(0.1), math.log(4000.0)
    sgn = lambda v: 1.0 if v >= 0 else -1.0
    for i in order:
        dx, dy, dz, am, ci = keep[i]
        d = math.sqrt(dx * dx + dy * dy + dz * dz)
        n = abs(dx) + abs(dy) + abs(dz)
        ox, oy, oz = dx / n, dy / n, dz / n
        if oz < 0:
            ox, oy = (1 - abs(oy)) * sgn(ox), (1 - abs(ox)) * sgn(oy)
        qx = max(-32767, min(32767, round(ox * 32767)))
        qy = max(-32767, min(32767, round(oy * 32767)))
        qd = max(0, min(65535, round((math.log(max(d, 0.1)) - LN_MIN) / (LN_MAX - LN_MIN) * 65535)))
        a = max(0, min(255, round((am + 8) * 8)))
        c = max(0, min(255, round((ci + 0.5) * 80)))
        buf += struct.pack('<hhHBB', qx, qy, qd, a, c)
    named = {k: remap[v] for k, v in named.items()}
    pl = [sum(p[j] for p in pleiades) / len(pleiades) for j in range(3)]
    out = []
    out.append('// Generated by scripts/hyg-to-js.py from the HYG star database v4.1 (David Nash, CC BY-SA 4.0).')
    out.append('// Do not edit by hand.')
    out.append(f'export const STAR_COUNT = {len(keep)};')
    out.append('export const STAR_DIST_LN = [Math.log(0.1), Math.log(4000)];')
    out.append(f'export const STAR_NAMED = {json.dumps(named, sort_keys=True)};')
    out.append(f'export const PLEIADES_CENTRE = {json.dumps([round(v, 1) for v in pl])};')
    out.append(f'export const STARS_B64 = "{base64.b64encode(bytes(buf)).decode()}";')
    sys.stdout.write('\n'.join(out) + '\n')
    sys.stderr.write(f'{len(keep)} stars, {len(buf)} bytes, named {len(named)}, pleiades members {len(pleiades)}\n')

main(sys.argv[1])

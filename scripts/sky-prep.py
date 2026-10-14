#!/usr/bin/env python3
"""Star-pattern lines and star names for "Tonight's sky from home".

    python3 -I scripts/sky-prep.py <hygdata_v41.csv> <stellarium modern index.json> <stellarium maori index.json>

Line data: Stellarium's sky cultures (modern IAU stick figures, and the Maori sky culture).
Star positions: the HYG database v4.1 (Hipparcos numbers -> RA/Dec).
Writes src/data/skyLines.json.
"""
import csv
import json
import sys
from pathlib import Path

HYG, MODERN, MAORI = (Path(a) for a in sys.argv[1:4])
ROOT = Path(__file__).resolve().parent.parent

stars = {}
named = []
with open(HYG, newline='') as f:
    for r in csv.DictReader(f):
        if not r['hip']:
            continue
        hip = int(r['hip'])
        ra, dec, mag = float(r['ra']) * 15, float(r['dec']), float(r['mag'])
        stars[hip] = (round(ra, 3), round(dec, 3), mag)
        if r['proper'] and mag < 2.1 and r['proper'] != 'Sol':  # (the Sun is drawn separately)
            named.append({'hip': hip, 'n': r['proper'], 'ra': round(ra, 3), 'dec': round(dec, 3), 'mag': round(mag, 2)})


def lines_of(c):
    out = []
    for poly in c['lines']:
        pts = []
        for h in poly:
            if h in stars:
                pts += [stars[h][0], stars[h][1]]
        if len(pts) >= 4:
            out.append(pts)
    return out


def centre(c):
    # label spot: the middle of the pattern's stars (as a direction on the sky)
    import math
    x = y = z = 0
    seen = set()
    for poly in c['lines']:
        for h in poly:
            if h in stars and h not in seen:
                seen.add(h)
                ra, dec = math.radians(stars[h][0]), math.radians(stars[h][1])
                x += math.cos(dec) * math.cos(ra); y += math.cos(dec) * math.sin(ra); z += math.sin(dec)
    n = math.sqrt(x * x + y * y + z * z) or 1
    return [round(math.degrees(math.atan2(y, x)) % 360, 2), round(math.degrees(math.asin(z / n)), 2)]


# spellings with macrons (Te Ara / Māori Dictionary), and a typo in the source data
FIX = {
    'Whanui': 'Whānui', 'Rehua': 'Rēhua', 'Ruawahia': 'Ruawāhia', 'Poutu-te-Rangi': 'Poutūterangi', 'Taumata-kuku': 'Taumatakuku',
    'Takarua': 'Takurua', 'Te-Ra-o-Tainui': 'Te Rā o Tainui', 'Te-Waka-o-Tama-Rereti': 'Te Waka o Tamarereti',
    'Te Taura-o-te-waka-o-tamarereti': 'Te Taura o te Waka o Tamarereti', 'Tau-toro': 'Tautoru', 'Taki-o-Autahi': 'Te Taki o Autahi',
    "Bernice's Hair": "Berenice's Hair",
}
fix = lambda n: FIX.get(n, n)


def name_of(cn):
    # kid-friendly: the picture's name ("Scorpion", "Southern Cross"), or the person's name ("Orion")
    e, n = cn.get('english', ''), cn.get('native', '')
    return fix(e or n)


modern = json.loads(MODERN.read_text())
maori = json.loads(MAORI.read_text())
out = {'modern': [], 'maori': [], 'stars': []}
for c in modern['constellations']:
    out['modern'].append({'id': c['id'].split()[-1], 'n': name_of(c.get('common_name', {})), 'latin': c.get('common_name', {}).get('native', ''), 'c': centre(c), 'l': lines_of(c)})
for c in maori['constellations']:
    out['maori'].append({'id': c['id'].split()[-1], 'n': fix(c['common_name'].get('native') or c['common_name'].get('english')), 'c': centre(c), 'l': lines_of(c)})
# Maori names for some bright stars (Stellarium's Maori sky culture)
mnames = {}
for k, v in maori.get('common_names', {}).items():
    if k.startswith('HIP '):
        mnames[int(k.split()[1])] = fix(v[0].get('native') or v[0].get('english'))
for s in sorted(named, key=lambda s: s['mag']):
    if s['hip'] in mnames:
        s['m'] = mnames[s['hip']]
    del s['hip']
    out['stars'].append(s)
(ROOT / 'src' / 'data' / 'skyLines.json').write_text(json.dumps(out, separators=(',', ':'), ensure_ascii=False))
print(len(out['modern']), 'modern,', len(out['maori']), 'maori,', len(out['stars']), 'named stars')
print([(s['n'], s.get('m')) for s in out['stars']])

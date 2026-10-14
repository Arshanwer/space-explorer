// Where the Sun, Moon and planets are in the sky at a given moment, seen from a place on Earth.
// Accurate to a fraction of a degree, which is plenty for looking at the sky (checked against
// astropy). Directions are in J2000 equatorial coordinates, the same frame as the star catalogue.
//
//  - Planets: NASA JPL's "Keplerian elements for approximate positions of the major planets"
//    (E.M. Standish), valid 1800–2050.
//  - Sun and Moon: Paul Schlyter's method (the Moon with its 12 biggest wobbles), turned from
//    "of date" back to J2000.

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const EPS_J2000 = 23.43928 * D2R;
const norm360 = (x) => ((x % 360) + 360) % 360;

export function julianDate(date) { return date.getTime() / 86400000 + 2440587.5; }

// Greenwich mean sidereal time (degrees)
export function gmst(jd) {
  const T = (jd - 2451545.0) / 36525;
  return norm360(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - (T * T * T) / 38710000);
}

function kepler(M, e) {
  let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
  for (let k = 0; k < 12; k++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-10) break;
  }
  return E;
}

// ecliptic (J2000) unit-ish vector -> RA/Dec in degrees
function eclToEq(x, y, z) {
  const ce = Math.cos(EPS_J2000), se = Math.sin(EPS_J2000);
  const xe = x, ye = y * ce - z * se, ze = y * se + z * ce;
  const r = Math.hypot(xe, ye, ze);
  return { ra: norm360(Math.atan2(ye, xe) * R2D), dec: Math.asin(ze / r) * R2D, dist: r };
}

// [a (au), e, I, L, long. perihelion, long. node] and their rates per century
const EL = {
  mercury: [[0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593], [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
  venus: [[0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255], [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418]],
  earth: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0], [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0]],
  mars: [[1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891], [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
  jupiter: [[5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
  saturn: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
  uranus: [[19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503], [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589]],
  neptune: [[30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574], [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]],
};

// heliocentric ecliptic J2000 position (au)
function helio(id, jd) {
  const T = (jd - 2451545.0) / 36525;
  const [e0, r] = EL[id];
  const a = e0[0] + r[0] * T, e = e0[1] + r[1] * T, I = (e0[2] + r[2] * T) * D2R;
  const L = e0[3] + r[3] * T, wbar = e0[4] + r[4] * T, node = (e0[5] + r[5] * T) * D2R;
  const w = wbar * D2R - node;
  let M = norm360(L - wbar); if (M > 180) M -= 360;
  const E = kepler(M * D2R, e);
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(node), sO = Math.sin(node), cI = Math.cos(I), sI = Math.sin(I);
  return [
    (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    (sw * sI) * xp + (cw * sI) * yp,
  ];
}

export function planetEq(id, jd) {
  const p = helio(id, jd), g = helio('earth', jd);
  const res = eclToEq(p[0] - g[0], p[1] - g[1], p[2] - g[2]);
  res.sunDist = Math.hypot(...p);
  return res;
}

// Schlyter's day number, and the shift from "equinox of date" back to J2000 (degrees)
const dayNum = (jd) => jd - 2451543.5;
const precess = (d) => 3.82394e-5 * (d - 1.5);

export function sunEq(jd) {
  const d = dayNum(jd);
  const w = 282.9404 + 4.70935e-5 * d, e = 0.016709 - 1.151e-9 * d, M = norm360(356.0470 + 0.9856002585 * d) * D2R;
  const E = kepler(M, e);
  const xv = Math.cos(E) - e, yv = Math.sqrt(1 - e * e) * Math.sin(E);
  const lon = (Math.atan2(yv, xv) * R2D + w - precess(d)) * D2R;
  const r = Math.hypot(xv, yv);
  return { ...eclToEq(Math.cos(lon) * r, Math.sin(lon) * r, 0), lon: lon * R2D };
}

export function moonEq(jd) {
  const d = dayNum(jd);
  const N = 125.1228 - 0.0529538083 * d, i = 5.1454 * D2R, w = 318.0634 + 0.1643573223 * d;
  const a = 60.2666, e = 0.054900, M = norm360(115.3654 + 13.0649929509 * d);
  const E = kepler(M * D2R, e);
  const xv = a * (Math.cos(E) - e), yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv), r0 = Math.hypot(xv, yv);
  const Nr = N * D2R, vw = v + w * D2R;
  const xh = r0 * (Math.cos(Nr) * Math.cos(vw) - Math.sin(Nr) * Math.sin(vw) * Math.cos(i));
  const yh = r0 * (Math.sin(Nr) * Math.cos(vw) + Math.cos(Nr) * Math.sin(vw) * Math.cos(i));
  const zh = r0 * Math.sin(vw) * Math.sin(i);
  let lon = Math.atan2(yh, xh) * R2D, lat = Math.atan2(zh, Math.hypot(xh, yh)) * R2D;
  let dist = Math.hypot(xh, yh, zh);
  // the biggest wobbles caused by the Sun
  const Ms = norm360(356.0470 + 0.9856002585 * d), ws = 282.9404 + 4.70935e-5 * d;
  const Ls = Ms + ws, Lm = N + w + M, Dm = Lm - Ls, F = Lm - N;
  const s = (x) => Math.sin(x * D2R), c = (x) => Math.cos(x * D2R);
  lon += -1.274 * s(M - 2 * Dm) + 0.658 * s(2 * Dm) - 0.186 * s(Ms) - 0.059 * s(2 * M - 2 * Dm) - 0.057 * s(M - 2 * Dm + Ms)
    + 0.053 * s(M + 2 * Dm) + 0.046 * s(2 * Dm - Ms) + 0.041 * s(M - Ms) - 0.035 * s(Dm) - 0.031 * s(M + Ms)
    - 0.015 * s(2 * F - 2 * Dm) + 0.011 * s(M - 4 * Dm);
  lat += -0.173 * s(F - 2 * Dm) - 0.055 * s(M - F - 2 * Dm) - 0.046 * s(M + F - 2 * Dm) + 0.033 * s(F + 2 * Dm) + 0.017 * s(2 * M + F);
  dist += -0.58 * c(M - 2 * Dm) - 0.46 * c(2 * Dm);
  lon -= precess(d);
  const lr = lon * D2R, br = lat * D2R;
  const res = eclToEq(Math.cos(br) * Math.cos(lr), Math.cos(br) * Math.sin(lr), Math.sin(br));
  // how much of it is lit, and whether it's growing (waxing) or shrinking
  const sun = sunEq(jd);
  const elong = norm360(lon - sun.lon);
  res.lit = (1 - Math.cos(elong * D2R)) / 2;
  res.waxing = elong < 180;
  res.age = (elong / 360) * 29.53; // days since new moon (roughly)
  res.distEarthRadii = dist;
  return res;
}

// unit vector (equatorial J2000) from RA/Dec degrees
export function eqVector(ra, dec, out = [0, 0, 0]) {
  const a = ra * D2R, d = dec * D2R;
  out[0] = Math.cos(d) * Math.cos(a); out[1] = Math.cos(d) * Math.sin(a); out[2] = Math.sin(d);
  return out;
}

// Precession: J2000 directions -> directions of the date (Lieske 1977 angles)
function precessionMatrix(jd) {
  const T = (jd - 2451545.0) / 36525, as = D2R / 3600;
  const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T ** 3) * as;
  const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T ** 3) * as;
  const th = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T ** 3) * as;
  const R3 = (f) => [[Math.cos(f), Math.sin(f), 0], [-Math.sin(f), Math.cos(f), 0], [0, 0, 1]];
  const R2 = (f) => [[Math.cos(f), 0, -Math.sin(f)], [0, 1, 0], [Math.sin(f), 0, Math.cos(f)]];
  return mul(mul(R3(-z), R2(th)), R3(-zeta));
}
function mul(A, B) {
  return A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
}

// The 3x3 matrix turning equatorial (J2000) vectors into the local sky (x = east, y = up,
// z = south) for a place (degrees, east positive) at a moment.
export function skyMatrix(jd, latDeg, lonDeg) {
  const lst = (gmst(jd) + lonDeg) * D2R, phi = latDeg * D2R;
  const cl = Math.cos(lst), sl = Math.sin(lst), sp = Math.sin(phi), cp = Math.cos(phi);
  // x' = the point on the equator on the meridian, y' = east, z' = north pole:
  //   x' = x cos(lst) + y sin(lst), y' = -x sin(lst) + y cos(lst), z' = z
  // and in the local sky: x' = -sin φ·north + cos φ·up, y' = east, z' = cos φ·north + sin φ·up
  const m = [
    [-sl, cl, 0],                // east
    [cp * cl, cp * sl, sp],      // up
    [sp * cl, sp * sl, -cp],     // south
  ];
  return mul(m, precessionMatrix(jd));
}

export function altAz(m, v) {
  const e = m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2];
  const u = m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2];
  const s = m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2];
  return { alt: Math.asin(Math.max(-1, Math.min(1, u))) * R2D, az: norm360(Math.atan2(e, -s) * R2D) }; // azimuth from north through east
}

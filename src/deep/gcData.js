import * as THREE from 'three';
import { GC_POS, galacticToDeep } from './frames.js';

// The middle of the Milky Way: Sagittarius A* and the stars racing around it.
//
// Units: the deep scene works in light-years. Right next to the black hole we use its own natural
// unit "M" (half the radius of the event horizon): for Sgr A*, M = G·mass/c² = 6.35 million km.

export const BH_MASS_SUN = 4.297e6; // GRAVITY Collaboration 2022
const GM_SUN_M = 1476.625; // G·(Sun's mass)/c², metres
const LY_M = 9.4607e15;
export const M_LY = (BH_MASS_SUN * GM_SUN_M) / LY_M; // 6.71e-7 light-years
export const M_KM = (BH_MASS_SUN * GM_SUN_M) / 1000;
export const M_SECONDS = (BH_MASS_SUN * GM_SUN_M) / 299792458; // 21 s: light-crossing time of M
export const RS_LY = 2 * M_LY; // event horizon radius

// The disc of glowing gas. Its spin axis is tipped 25° from our line of sight towards galactic
// north, so from Earth we see it nearly face-on and turning clockwise, as the Event Horizon
// Telescope and GRAVITY found.
export const DISK_N = new THREE.Vector3(Math.cos(THREE.MathUtils.degToRad(25)), Math.sin(THREE.MathUtils.degToRad(25)), 0).normalize();
export const DISK_X = new THREE.Vector3(0, 0, 1);
export const DISK_Y = new THREE.Vector3().crossVectors(DISK_N, DISK_X).normalize();
export const DISK_RIN = 2.05; // gas glows all the way down to (almost) the horizon at r = 2
export const DISK_ROUT = 24;

// Directions on the sky at the galactic centre, as seen from Earth (for the star orbits and the
// telescope view): L = line of sight (Earth -> Sgr A*), N = north, E = east.
const NCP = galacticToDeep(122.932, 27.128, 1).normalize();
export const SKY_L = GC_POS.clone().normalize();
export const SKY_N = NCP.clone().addScaledVector(SKY_L, -NCP.dot(SKY_L)).normalize();
export const SKY_E = new THREE.Vector3().crossVectors(NCP, SKY_L).normalize();

const ARCSEC_LY = GC_POS.length() * THREE.MathUtils.degToRad(1 / 3600); // 0.129 ly at the galactic centre
export const ARCSEC_AU = ARCSEC_LY * 63241.08;

// Measured orbits (GRAVITY Collaboration 2022, A&A 657, A82, table 5).
// a in arcseconds, angles in degrees, tp = year of closest approach, P = period in years.
export const S_STARS = [
  { id: 's2', name: 'S2', a: 0.12495, e: 0.88441, i: 134.70, O: 228.19, w: 66.25, tp: 2018.379, P: 16.046, mK: 13.95, hot: true },
  { id: 's29', name: 'S29', a: 0.3975, e: 0.96927, i: 144.37, O: 7.00, w: 205.79, tp: 2021.41, P: 91.04, mK: 16.6, hot: true },
  { id: 's38', name: 'S38', a: 0.14254, e: 0.81451, i: 166.65, O: 109.45, w: 27.17, tp: 2003.15, P: 19.55, mK: 17.0, hot: false },
  { id: 's42', name: 'S42', a: 0.41142, e: 0.77385, i: 39.57, O: 309.60, w: 48.29, tp: 2022.12, P: 95.9, mK: 17.5, hot: true },
  { id: 's55', name: 'S55', a: 0.10440, e: 0.72669, i: 158.52, O: 314.94, w: 322.78, tp: 2009.44, P: 12.25, mK: 17.5, hot: true },
  { id: 's60', name: 'S60', a: 0.48921, e: 0.77733, i: 126.60, O: 178.03, w: 30.43, tp: 2023.62, P: 124.3, mK: 16.3, hot: true },
];

// Thiele-Innes constants turn the orbit's shape and tilt into directions on our sky
function orbitBasis(o) {
  const r = THREE.MathUtils.degToRad;
  const cw = Math.cos(r(o.w)), sw = Math.sin(r(o.w)), cO = Math.cos(r(o.O)), sO = Math.sin(r(o.O)), ci = Math.cos(r(o.i)), si = Math.sin(r(o.i));
  const A = cw * cO - sw * sO * ci, B = cw * sO + sw * cO * ci, F = -sw * cO - cw * sO * ci, G = -sw * sO + cw * cO * ci;
  const C = sw * si, H = cw * si;
  // X axis of the orbit (towards closest approach) and Y axis, as deep-frame directions
  const P = SKY_N.clone().multiplyScalar(A).addScaledVector(SKY_E, B).addScaledVector(SKY_L, C);
  const Q = SKY_N.clone().multiplyScalar(F).addScaledVector(SKY_E, G).addScaledVector(SKY_L, H);
  return { P, Q };
}

// Kepler's equation, solved with Newton's method (works for the very stretched orbits too)
export function eccentricAnomaly(Mean, e) {
  let m = Mean % (2 * Math.PI);
  if (m < -Math.PI) m += 2 * Math.PI; else if (m > Math.PI) m -= 2 * Math.PI;
  let E = e > 0.8 ? Math.PI * Math.sign(m || 1) : m + e * Math.sin(m);
  for (let k = 0; k < 30; k++) {
    const d = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
}

// One star on a Keplerian orbit; position in light-years relative to the black hole.
export class Orbit {
  constructor(o) {
    Object.assign(this, o);
    this.aLy = o.aLy ?? o.a * ARCSEC_LY;
    this.P = o.P ?? Math.sqrt(Math.pow(this.aLy * 63241.08, 3) / BH_MASS_SUN);
    const b = o.basis ?? orbitBasis(o);
    this.Pv = b.P; this.Qv = b.Q;
    this.bFac = Math.sqrt(1 - this.e * this.e);
  }
  position(year, out = new THREE.Vector3()) {
    const E = eccentricAnomaly((2 * Math.PI * (year - this.tp)) / this.P, this.e);
    const x = this.aLy * (Math.cos(E) - this.e), y = this.aLy * this.bFac * Math.sin(E);
    return out.copy(this.Pv).multiplyScalar(x).addScaledVector(this.Qv, y);
  }
  // speed in km/s at a given distance from the black hole (vis-viva)
  speedKmS(rLy) {
    const mu = 1.32712440018e11 * BH_MASS_SUN; // km^3/s^2
    const r = rLy * 9.4607e12, a = this.aLy * 9.4607e12;
    return Math.sqrt(mu * (2 / r - 1 / a));
  }
  // closed curve of the orbit for drawing
  path(n = 256) {
    const pts = [];
    for (let k = 0; k <= n; k++) {
      const E = (k / n) * Math.PI * 2;
      const x = this.aLy * (Math.cos(E) - this.e), y = this.aLy * this.bFac * Math.sin(E);
      pts.push(this.Pv.clone().multiplyScalar(x).addScaledVector(this.Qv, y));
    }
    return pts;
  }
}

export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export const gauss = (r) => { let u = 0; for (let i = 0; i < 4; i++) u += r(); return (u - 2) * 1.7320508; };

// The rest of the S-cluster: the measured stars above plus more on random, believable orbits
// (sizes and stretches like the real ones), so the swarm looks as busy as it really is.
export function makeOrbits(extra = 30) {
  const list = S_STARS.map((o) => new Orbit({ ...o, real: true }));
  const r = rng(4242);
  for (let k = 0; k < extra; k++) {
    const a = 0.08 * Math.pow(0.5 / 0.08, r()); // arcsec, spread evenly in log
    const e = Math.min(0.95, Math.sqrt(r()));
    const ci = r() * 2 - 1;
    const o = { id: `sx${k}`, a, e, i: THREE.MathUtils.radToDeg(Math.acos(ci)), O: r() * 360, w: r() * 360, tp: 2026 - r() * 200, mK: 15.5 + r() * 2.5, hot: r() > 0.18, real: false };
    list.push(new Orbit(o));
  }
  return list;
}

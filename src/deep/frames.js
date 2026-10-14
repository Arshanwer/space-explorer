import * as THREE from 'three';

// Two ways of laying out space, and how to turn one into the other.
//
// Solar-system scene ("scene" frame, kid units): x towards the March equinox, y = ecliptic north,
//   z = -(ecliptic y). Matches the star catalogue in stars.js and the planet orbits in world.js.
// Deep-space scene ("deep" frame, light-years, the Sun at 0,0,0): x towards the centre of the
//   Milky Way, y = galactic north, z = -(the direction the Sun is orbiting in).

export const LY_PER_PC = 3.26156;
export const R0_LY = 26600; // the Sun is 8.15 kpc from the centre of the Milky Way
export const GC_POS = new THREE.Vector3(R0_LY, -20, 0); // centre of the Milky Way, deep frame
const EPS = THREE.MathUtils.degToRad(23.4393); // tilt of Earth's axis (J2000)

// J2000 equatorial -> galactic (rows are the galactic axes in equatorial coordinates)
const T = [
  [-0.0548755604162154, -0.8734370902348850, -0.4838350155487132],
  [+0.4941094278755837, -0.4448296299600112, +0.7469822444972189],
  [-0.8676661490190047, -0.1980763734312015, +0.4559837761750669],
];

function sceneToEq(v, out) {
  const xe = v.x, ye = -v.z, ze = v.y; // ecliptic
  return out.set(xe, ye * Math.cos(EPS) - ze * Math.sin(EPS), ye * Math.sin(EPS) + ze * Math.cos(EPS));
}
function eqToScene(e, out) {
  const ye = e.y * Math.cos(EPS) + e.z * Math.sin(EPS);
  const ze = -e.y * Math.sin(EPS) + e.z * Math.cos(EPS);
  return out.set(e.x, ze, -ye);
}
function eqToGal(e, out) {
  return out.set(
    T[0][0] * e.x + T[0][1] * e.y + T[0][2] * e.z,
    T[1][0] * e.x + T[1][1] * e.y + T[1][2] * e.z,
    T[2][0] * e.x + T[2][1] * e.y + T[2][2] * e.z,
  );
}
function galToEq(g, out) {
  return out.set(
    T[0][0] * g.x + T[1][0] * g.y + T[2][0] * g.z,
    T[0][1] * g.x + T[1][1] * g.y + T[2][1] * g.z,
    T[0][2] * g.x + T[1][2] * g.y + T[2][2] * g.z,
  );
}
const galToDeep = (g, out) => out.set(g.x, g.z, -g.y);
const deepToGal = (d, out) => out.set(d.x, -d.z, d.y);

const _a = new THREE.Vector3(), _b = new THREE.Vector3();
export function sceneDirToDeep(v, out = new THREE.Vector3()) {
  return galToDeep(eqToGal(sceneToEq(v, _a), _b), out);
}
export function deepDirToScene(v, out = new THREE.Vector3()) {
  return eqToScene(galToEq(deepToGal(v, _a), _b), out);
}

// Galactic longitude/latitude (degrees) and distance -> deep frame
export function galacticToDeep(lDeg, bDeg, dist, out = new THREE.Vector3()) {
  const l = THREE.MathUtils.degToRad(lDeg), b = THREE.MathUtils.degToRad(bDeg);
  _a.set(Math.cos(b) * Math.cos(l), Math.cos(b) * Math.sin(l), Math.sin(b)).multiplyScalar(dist);
  return galToDeep(_a, out);
}

// Right ascension/declination (J2000, degrees) and distance -> deep frame
export function equatorialToDeep(raDeg, decDeg, dist, out = new THREE.Vector3()) {
  const a = THREE.MathUtils.degToRad(raDeg), d = THREE.MathUtils.degToRad(decDeg);
  _a.set(Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)).multiplyScalar(dist);
  return galToDeep(eqToGal(_a, _b), out);
}
// Directions on the sky around a point (deep frame): L = from us outwards, N = celestial north, E = east
export function skyBasis(raDeg, decDeg) {
  const L = equatorialToDeep(raDeg, decDeg, 1);
  const N = equatorialToDeep(raDeg, decDeg + 90, 1); // a quarter turn north along the same meridian
  const E = new THREE.Vector3().crossVectors(N, L).normalize();
  return { L, N, E };
}

// The Milky Way photo is an all-sky picture in galactic coordinates with the centre of the
// galaxy in the middle and the south pole at the top. On a three.js sphere a direction with
// galactic coordinates (X,Y,Z) lands on the mesh's local (X, -Z, Y).
function photoBasis(toFrame) {
  const cols = [];
  for (const m of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
    const g = new THREE.Vector3(m[0], m[2], -m[1]); // mesh-local -> galactic
    const out = new THREE.Vector3();
    if (toFrame === 'deep') galToDeep(g, out);
    else if (toFrame === 'eq') galToEq(g, out);
    else eqToScene(galToEq(g, _b), out);
    cols.push(out);
  }
  return new THREE.Matrix4().makeBasis(cols[0], cols[1], cols[2]);
}
export const PHOTO_TO_SCENE = photoBasis('scene');
export const PHOTO_TO_DEEP = photoBasis('deep');
export const PHOTO_TO_EQ = photoBasis('eq'); // J2000 equatorial (x = RA 0h, z = north pole)

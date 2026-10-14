// Every path light can take past a (non-spinning) black hole, worked out once and stored in tables.
//
// In units of M (half the event horizon's radius), a light ray stays in one flat plane and its
// distance r = 1/u follows u'' + u = 3u² along the angle ψ swept round the hole. Each ray is fixed by
// one number, its impact parameter b (how far off-centre it would pass if gravity didn't bend it).
// For each b we follow the ray in from very far away (u = 0):
//   b > 3√3 (about 5.2): it swings round and comes back out. Its closest point is u_end at angle ψ_end,
//                        and the way out is the mirror image of the way in.
//   b < 3√3:             it falls in, reaching the event horizon (u = 0.5) at angle ψ_end.
// The shader then places the camera somewhere on that path and reads off where the light goes.
//
// Tables (all values normalised to 0..1 so neighbouring rows can be blended):
//   U[row][x]   = u / u_end at ψ = x·ψ_end            (x from 0 to 1)
//   PSI[row][y] = ψ / ψ_end at u = u_end·(1-(1-y)²)    (y from 0 to 1; packs extra samples near the end)
//   ROW[row]    = (ψ_end, u_end, b)
// Rows are spaced evenly in log|b - 3√3| on each side of the critical value, so the photon ring
// (where light can circle the hole) gets plenty of detail.

export const B_CRIT = 3 * Math.sqrt(3);
export const NB_LO = 200; // rows for light that falls in
export const NB = 512; // all rows
export const NX = 512; // samples along each path
export const B_MAX = 400; // beyond this a simple formula is used instead
const EPS = 1e-6;

export function rowB(i) {
  if (i < NB_LO) {
    const t = i / (NB_LO - 1);
    return Math.max(1e-3, B_CRIT - B_CRIT * Math.pow(EPS / B_CRIT, t));
  }
  const t = (i - NB_LO) / (NB - 1 - NB_LO);
  return B_CRIT + EPS * Math.pow((B_MAX - B_CRIT) / EPS, t);
}
// the inverse, as a fractional row number (the shader does the same sums)
export function rowOf(b) {
  if (b < B_CRIT) return Math.min(NB_LO - 1, Math.max(0, (Math.log((B_CRIT - b) / B_CRIT) / Math.log(EPS / B_CRIT)) * (NB_LO - 1)));
  return NB_LO + Math.min(NB - 1 - NB_LO, Math.max(0, (Math.log((b - B_CRIT) / EPS) / Math.log((B_MAX - B_CRIT) / EPS)) * (NB - 1 - NB_LO)));
}

// follow one ray in from infinity; returns dense samples of (ψ, u)
function trace(b) {
  const f = (u) => 3 * u * u - u;
  let u = 0, w = 1 / b, psi = 0;
  const P = [0], U = [0];
  const capture = b < B_CRIT;
  for (let k = 0; k < 400000; k++) {
    const h = Math.min(3e-3, 0.004 / Math.abs(w) + 1e-9, 0.02 * Math.max(u, 1e-3) / Math.max(Math.abs(w), 1e-12));
    // RK4 on (u, w)
    const k1u = w, k1w = f(u);
    const k2u = w + 0.5 * h * k1w, k2w = f(u + 0.5 * h * k1u);
    const k3u = w + 0.5 * h * k2w, k3w = f(u + 0.5 * h * k2u);
    const k4u = w + h * k3w, k4w = f(u + h * k3u);
    const un = u + (h / 6) * (k1u + 2 * k2u + 2 * k3u + k4u);
    const wn = w + (h / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
    if (capture && un >= 0.5) {
      const t = (0.5 - u) / (un - u);
      P.push(psi + t * h); U.push(0.5);
      return { P, U, psiEnd: psi + t * h, uEnd: 0.5 };
    }
    if (!capture && wn <= 0) {
      // closest approach: where w crosses zero. Its distance is the root of 2u³ - u² + 1/b² = 0.
      const t = w / (w - wn);
      let up = Math.max(u, un);
      for (let n = 0; n < 30; n++) { const g = 2 * up ** 3 - up * up + 1 / (b * b), dg = 6 * up * up - 2 * up; const d = g / dg; up -= d; if (Math.abs(d) < 1e-15) break; }
      const psiEnd = psi + t * h;
      P.push(psiEnd); U.push(up);
      return { P, U, psiEnd, uEnd: up };
    }
    u = un; w = wn; psi += h;
    P.push(psi); U.push(u);
  }
  return { P, U, psiEnd: psi, uEnd: u };
}

// linear interpolation in sorted arrays
function interp(xs, ys, x) {
  let lo = 0, hi = xs.length - 1;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[hi]) return ys[hi];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
  const t = (x - xs[lo]) / (xs[hi] - xs[lo]);
  return ys[lo] + t * (ys[hi] - ys[lo]);
}

export function buildPhotonTables() {
  const U = new Float32Array(NB * NX), PSI = new Float32Array(NB * NX), ROW = new Float32Array(NB * 4);
  for (let i = 0; i < NB; i++) {
    const b = rowB(i);
    const tr = trace(b);
    const { psiEnd, uEnd } = tr;
    for (let x = 0; x < NX; x++) {
      const t = x / (NX - 1);
      U[i * NX + x] = interp(tr.P, tr.U, t * psiEnd) / uEnd;
      const s = 1 - t;
      const uu = uEnd * (1 - s * s);
      PSI[i * NX + x] = interp(tr.U, tr.P, uu) / psiEnd;
    }
    ROW[i * 4] = psiEnd; ROW[i * 4 + 1] = uEnd; ROW[i * 4 + 2] = b;
  }
  return { U, PSI, ROW };
}

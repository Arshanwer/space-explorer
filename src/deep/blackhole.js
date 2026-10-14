import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { noiseGLSL } from '../scene/shaders.js';
import { GC_POS } from './frames.js';
import { M_LY, DISK_N, DISK_X, DISK_Y, DISK_RIN, DISK_ROUT } from './gcData.js';
import { buildPhotonTables, B_CRIT, NB, NB_LO, NX, B_MAX } from './photonTable.js';

// Sagittarius A*, drawn by following light backwards from the camera.
//
// For every pixel the light path is traced through the black hole's curved space (Schwarzschild):
// a photon's path stays in one flat plane, and in that plane 1/r obeys u'' + u = 3u² (units of M).
// Along the way we look for where the path crosses the glowing disc of gas, and work out how much
// the light is shifted bluer/brighter (gas rushing towards us, the Doppler effect) or redder/dimmer
// (gas moving away, or light climbing out of the hole's gravity). If the path falls in, the pixel is
// black: that is the hole's shadow. If it escapes, we look up what is out there in that direction:
// the picture of the scene already drawn this frame, or (for light bent right round from behind
// the camera) a 360° picture of the sky taken from the galactic centre.

// ---------- colour of hot things, from their temperature ----------
function blackbodyTexture() {
  const N = 128, T0 = 800, T1 = 40000;
  const g = (x, mu, s1, s2) => { const t = (x - mu) / (x < mu ? s1 : s2); return Math.exp(-0.5 * t * t); };
  const data = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    const T = T0 * Math.pow(T1 / T0, i / (N - 1));
    let X = 0, Y = 0, Z = 0;
    for (let l = 380; l <= 780; l += 5) {
      const B = Math.pow(l, -5) / (Math.exp(1.4388e7 / (l * T)) - 1);
      X += B * (1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2));
      Y += B * (0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1));
      Z += B * (1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8));
    }
    X /= Y; Z /= Y; Y = 1;
    const r = Math.max(0, 3.2406 * X - 1.5372 * Y - 0.4986 * Z);
    const gg = Math.max(0, -0.9689 * X + 1.8758 * Y + 0.0415 * Z);
    const b = Math.max(0, 0.0557 * X - 0.2040 * Y + 1.0570 * Z);
    data.set([r, gg, b].map((v) => Math.round(THREE.MathUtils.clamp(v / 2, 0, 1) * 255)).concat(255), i * 4);
  }
  const t = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

const QUAD_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// The disc's swirling pattern, painted each frame into a small map (angle across, distance out),
// so the light-tracer only has to look it up.
const DISK_FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime, uRin, uRout;
  varying vec2 vUv;
  ${noiseGLSL}
  // swirling lumps in the gas, carried round at the speed of the orbit there. Two copies of the
  // pattern take turns (each lives for one and a half turns of the gas at that distance, then
  // fades out), so it never gets wound up into impossibly thin streaks.
  float lumps(float r, float ang){
    float om = pow(r, -1.5);
    float L = 9.42478 / om, d = 0.0;
    for (int k = 0; k < 2; k++){
      float tk = uTime + float(k) * 0.5 * L;
      float age = mod(tk, L), cyc = floor(tk / L);
      float a = ang - om * age;
      vec3 p = vec3(cos(a) * 2.4, sin(a) * 2.4, log(r) * 4.2 + cyc * 13.7 + float(k) * 41.0);
      float wgt = 1.0 - abs(2.0 * age / L - 1.0);
      // big soft clumps, plus finer streaks that the flow stretches round
      d += wgt * (fbm(p) * 0.95 + 0.3 * snoise(vec3(p.xy * 2.3, p.z * 3.2)));
    }
    return d;
  }

  void main(){
    float ang = (vUv.x - 0.5) * 6.2831853;
    float r = uRin * exp(vUv.y * log(uRout / uRin));
    gl_FragColor = vec4(lumps(r, ang), 0.0, 0.0, 1.0);
  }
`;

const LENS_FRAG = /* glsl */ `
  precision highp float;
  precision highp sampler2D;
  uniform sampler2D tScene, tBB, tDisk, tU, tPsi, tRow;
  uniform samplerCube tEnv;
  uniform float uEnvSize, uEnvOn;
  uniform vec3 uCamM;
  uniform mat3 uCamRot, uViewRot;
  uniform mat4 uProjInv, uProj;
  uniform vec3 uDiskN, uDiskX, uDiskY;
  uniform float uRin, uRout, uDisk, uPxPerRad, uObsA, uEht;
  varying vec2 vUv;
  const float PI = 3.14159265;
  const float B_WEAK = ${B_MAX.toFixed(1)};  // rays passing further out than this only bend a little: a formula does
  const float BC = ${B_CRIT.toFixed(7)};
  const int NB = ${NB}, NB_LO = ${NB_LO}, NX = ${NX};
  const float LO_K = ${(1 / Math.log(1e-6 / B_CRIT)).toFixed(9)}, HI_K = ${(1 / Math.log((B_MAX - B_CRIT) / 1e-6)).toFixed(9)};

  // which row of the light-path tables a ray belongs to (rows are spaced in log|b - BC|)
  float rowOf(float b){
    if (b < BC) return clamp(log((BC - b) / BC) * LO_K, 0.0, 1.0) * float(NB_LO - 1);
    return float(NB_LO) + clamp(log((b - BC) * 1e6) * HI_K, 0.0, 1.0) * float(NB - 1 - NB_LO);
  }
  float tabRow(sampler2D t, int row, float xn){
    float xf = clamp(xn, 0.0, 1.0) * float(NX - 1);
    int x0 = int(xf); int x1 = min(x0 + 1, NX - 1);
    return mix(texelFetch(t, ivec2(x0, row), 0).r, texelFetch(t, ivec2(x1, row), 0).r, xf - float(x0));
  }
  float tab(sampler2D t, int i0, int i1, float fb, float xn){ return mix(tabRow(t, i0, xn), tabRow(t, i1, xn), fb); }

  vec3 blackbody(float T){
    float u = clamp(log(T / 800.0) / log(50.0), 0.0, 1.0);
    return texture2D(tBB, vec2(u * (127.0 / 128.0) + 0.5 / 128.0, 0.5)).rgb * 2.0;
  }

  // light from the disc where the path crosses it (yc = (u, du/dphi) at the crossing)
  void shade(vec2 yc, float ph, vec3 e1, vec3 e2, float b, float Lz, inout vec4 acc){
    float u = yc.x, r = 1.0 / u;
    if (r < uRin || r > uRout) return;
    vec3 P = r * (cos(ph) * e1 + sin(ph) * e2);
    float ang = atan(dot(P, uDiskY), dot(P, uDiskX));
    // the photon's own motion there (it travels the opposite way to our backwards ray)
    float f = 1.0 - 2.0 * u;
    float sgn = yc.y > 0.0 ? 1.0 : -1.0;
    float pr = sgn * sqrt(max(0.0, 1.0 - f * b * b * u * u)) / f;
    // the gas: circling outside 6 M, spiralling in below that
    float ut, ur, uph;
    if (r >= 6.0) { ut = inversesqrt(1.0 - 3.0 * u); ur = 0.0; uph = ut * u * sqrt(u); }
    else { const float E = 0.94280904, L = 3.46410162; ut = E / f; uph = L * u * u; ur = -sqrt(max(0.0, E * E - f * (1.0 + L * L * u * u))); }
    float g = 1.0 / ((ut - pr * ur - Lz * uph) * uObsA);   // frequency we see / frequency sent
    float den = texture2D(tDisk, vec2(ang * 0.15915494 + 0.5, log(r / uRin) / log(uRout / uRin))).r;
    // brightest just outside 6 M, fading outwards; inside 6 M the gas thins out as it plunges in
    float inner = r >= 6.0 ? pow(6.0 / r, 2.4) : pow(max(r - 2.0, 0.0) / 4.0, 1.2);
    float outer = 1.0 - smoothstep(uRout * 0.55, uRout, r);
    float dens = clamp(0.72 + 0.6 * den, 0.15, 1.5);
    float T = (r >= 6.0 ? 6200.0 * pow(6.0 / r, 0.75) : 6200.0 * pow(max(r - 2.0, 0.01) / 4.0, 0.25)) * g;
    float I = inner * outer * dens * g * g * g * 2.4;
    I = 3.2 * (1.0 - exp(-I / 3.2)) * uDisk;   // keep the brightest side from burning out completely
    float alpha = clamp(0.95 * smoothstep(0.1, 0.8, dens) * outer * smoothstep(2.3, 5.0, r), 0.0, 0.95);
    vec3 bb = blackbody(T);
    bb = max(mix(vec3(dot(bb, vec3(0.2126, 0.7152, 0.0722))), bb, 1.35), 0.0); // a little richer colour
    vec3 col = bb * I;
    // the telescope's radio "eyes" see hot, see-through gas glowing mostly very close to the hole
    if (uEht > 0.0) {
      float Ir = pow(5.0 / max(r, 2.2), 5.0) * smoothstep(2.2, 4.0, r) * g * g * g * (0.8 + 0.4 * den);
      col = mix(col, vec3(Ir), uEht);
      alpha = mix(alpha, 0.4 * smoothstep(2.2, 4.2, r), uEht);
    }
    acc.rgb += (1.0 - acc.a) * col * alpha;
    acc.a += (1.0 - acc.a) * alpha;
  }

  vec3 sky(vec3 D, float lod){
    vec3 env = uEnvOn > 0.5 ? textureLod(tEnv, D, lod).rgb : vec3(0.0);
    vec4 c = uProj * vec4(uViewRot * D, 0.0);
    if (c.w > 1e-6) {
      vec2 ndc = c.xy / c.w;
      float e = 1.0 - smoothstep(0.9, 0.995, max(abs(ndc.x), abs(ndc.y)));
      if (e > 0.0) env = mix(env, textureLod(tScene, ndc * 0.5 + 0.5, 0.0).rgb, e);
    }
    return env;
  }

  void main(){
    vec2 ndc = vUv * 2.0 - 1.0;
    // (through the near plane: with the near plane this close, the far plane's maths loses all precision)
    vec4 vv = uProjInv * vec4(ndc, -1.0, 1.0);
    vec3 d = normalize(uCamRot * vv.xyz);
    float r0 = length(uCamM);
    vec3 nr = uCamM / r0;
    float cth = dot(d, nr);
    vec3 perp = d - cth * nr;
    float sth = length(perp);
    vec3 e1 = nr;
    vec3 e2 = sth > 1e-9 ? perp / sth : normalize(cross(nr, abs(nr.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    float b = r0 * sth / uObsA;              // impact parameter
    float Lz = -b * dot(cross(e1, e2), uDiskN); // the photon's spin about the disc's axis
    vec2 y = vec2(1.0 / r0, -(1.0 / r0) * uObsA * cth / max(sth, 1e-9));

    vec4 acc = vec4(0.0);
    int state = 0;      // 0: still going, 1: escaped, 2: fell in
    float phiEsc = 0.0;
    if (sth < 2e-6) {
      if (cth > 0.0) { state = 1; phiEsc = 0.0; } else state = 2;
    } else if (b > B_WEAK) {
      // far from the hole: first-order bending (path u = sin p / b + (1 + cos²p) / b², which leaves
      // for good at p = PI + 2/b). Where the camera sits on it comes from both u and its slope.
      float sp = b * y.x, cp = y.y * b;
      for (int k = 0; k < 3; k++) { sp = b * y.x - (1.0 + cp * cp) / b; cp = y.y * b / (1.0 - 2.0 * sp / b); }
      phiEsc = PI + 2.0 / b - atan(sp, cp);
      state = 1;
    } else {
      // look the path up: the camera sits at angle psiC on the stored path for this b
      bool capt = b < BC;
      float fr = rowOf(b);
      int i0 = int(fr); int i1 = min(i0 + 1, capt ? NB_LO - 1 : NB - 1);
      float fb = fr - float(i0);
      float psiEnd = mix(texelFetch(tRow, ivec2(i0, 0), 0).r, texelFetch(tRow, ivec2(i1, 0), 0).r, fb);
      // closest approach (exact): smallest positive root of 2u³ - u² + 1/b² = 0
      float uEnd = capt ? 0.5 : 1.0 / 6.0 + cos(acos(clamp(1.0 - 54.0 / (b * b), -1.0, 1.0)) / 3.0 - 2.0943951) / 3.0;
      float u0 = 1.0 / r0;
      bool ingoing = cth < 0.0;
      float psiC = tab(tPsi, i0, i1, fb, 1.0 - sqrt(max(0.0, 1.0 - u0 / uEnd))) * psiEnd;
      float phiEnd;
      if (ingoing) { phiEnd = capt ? psiEnd - psiC : 2.0 * psiEnd - psiC; state = capt ? 2 : 1; }
      else { phiEnd = psiC; state = 1; }  // heading outwards: straight back up the path to far away
      // where the path crosses the disc's plane: every half turn from the first crossing
      float a1 = dot(e1, uDiskN), c1 = dot(e2, uDiskN);
      float ph = mod(atan(-a1, c1), PI);
      if (ph < 1e-5) ph += PI;
      for (int k = 0; k < 4; k++) {
        if (ph >= phiEnd || acc.a > 0.985) break;
        float psi = ingoing ? psiC + ph : psiC - ph;
        bool after = ingoing && psi > psiEnd;   // already past the closest point, heading out again
        if (after) psi = 2.0 * psiEnd - psi;
        float u = tab(tU, i0, i1, fb, psi / psiEnd) * uEnd;
        shade(vec2(u, (ingoing && !after) ? 1.0 : -1.0), ph, e1, e2, b, Lz, acc);
        ph += PI;
      }
      phiEsc = phiEnd;
    }
    vec3 D = cos(phiEsc) * e1 + sin(phiEsc) * e2;
    vec3 dDx = dFdx(D), dDy = dFdy(D);
    float lod = clamp(log2(max(length(dDx), length(dDy)) * uEnvSize / (0.5 * PI) + 1e-6), 0.0, 7.0);
    vec3 bg = vec3(0.0);
    float w = 1.0;
    if (state == 1) {
      bg = sky(D, lod) * (1.0 - uEht);
      float defl = length(cross(D, d));
      w = acc.a > 0.002 ? 1.0 : smoothstep(0.35, 1.2, defl * uPxPerRad);
    }
    gl_FragColor = vec4(acc.rgb + (1.0 - acc.a) * bg, w);
  }
`;

// Put the bent picture together with the sharp, unbent one (and, for the telescope view, blur it
// and colour it like the Event Horizon Telescope's radio pictures).
const COMP_FRAG = /* glsl */ `
  uniform sampler2D tScene, tLens;
  uniform float uEht, uEhtLod, uEhtGain;
  uniform vec2 uEhtStep;
  varying vec2 vUv;
  // the colours the Event Horizon Telescope team uses: black, deep red, orange, yellow, pale gold
  vec3 ehtColour(float t){
    t = pow(clamp(t, 0.0, 1.0), 1.3);
    vec3 c = mix(vec3(0.0), vec3(0.32, 0.02, 0.0), smoothstep(0.0, 0.18, t));
    c = mix(c, vec3(0.80, 0.18, 0.0), smoothstep(0.18, 0.42, t));
    c = mix(c, vec3(1.0, 0.52, 0.05), smoothstep(0.42, 0.66, t));
    c = mix(c, vec3(1.0, 0.80, 0.30), smoothstep(0.66, 0.86, t));
    return mix(c, vec3(1.0, 0.96, 0.75), smoothstep(0.86, 1.0, t));
  }
  void main(){
    vec3 s = texture2D(tScene, vUv).rgb;
    vec4 L = texture2D(tLens, vUv);
    vec3 c = mix(s, L.rgb, L.a);
    if (uEht > 0.001) {
      float I = 0.0, W = 0.0;
      for (int k = 0; k < 24; k++) {
        float fk = float(k);
        float rr = sqrt((fk + 0.5) / 24.0) * 2.2;
        float a = fk * 2.39996;
        float wk = exp(-rr * rr * 0.5);
        vec3 t = textureLod(tLens, vUv + vec2(cos(a), sin(a)) * rr * uEhtStep, uEhtLod).rgb;
        I += dot(t, vec3(0.2126, 0.7152, 0.0722)) * wk; W += wk;
      }
      c = mix(c, ehtColour(I / W * uEhtGain) * 0.8, uEht); // (kept below the glow threshold so it stays crisp)
    }
    gl_FragColor = vec4(c, 1.0);
  }
`;

// ---------- light beams: what happens to light passing a black hole ----------
// Parallel beams come in from the left. The paths are worked out once (same physics as above,
// in an ordinary x-y plane): far ones bend a little, close ones wrap round, the closest fall in.
// (all on one side of the hole, like the usual diagram: the closer they pass, the more they bend)
const BEAM_B = [1.5, 3.5, 4.9, 5.21, 5.32, 5.7, 6.8, 8.5, 11, 14];
function beamPaths() {
  const paths = [];
  for (const b of BEAM_B) {
    let x = -34, y = b, vx = 1, vy = 0;
    const h2 = b * b;
    const acc = (px, py) => { const r2 = px * px + py * py; const r5 = r2 * r2 * Math.sqrt(r2); return [-1.5 * h2 * px / r5, -1.5 * h2 * py / r5]; };
    const pts = [[x, y, 0, Math.hypot(x, y)]];
    let t = 0, sinceStore = 0;
    for (let i = 0; i < 40000; i++) {
      const r = Math.hypot(x, y);
      const ds = Math.min(0.05 * r, 0.25);
      // RK4 on (x, y, vx, vy)
      const f = (s) => { const [ax, ay] = acc(s[0], s[1]); return [s[2], s[3], ax, ay]; };
      const s0 = [x, y, vx, vy];
      const k1 = f(s0);
      const k2 = f(s0.map((v, j) => v + 0.5 * ds * k1[j]));
      const k3 = f(s0.map((v, j) => v + 0.5 * ds * k2[j]));
      const k4 = f(s0.map((v, j) => v + ds * k3[j]));
      [x, y, vx, vy] = s0.map((v, j) => v + (ds / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
      const rn = Math.hypot(x, y);
      // light seems to slow right down near the edge of the hole (seen from far away)
      t += ds / Math.max(1 - 2 / rn, 0.02);
      sinceStore += ds;
      if (rn < 2.04) { pts.push([x, y, t, rn]); break; }
      if (sinceStore > 0.3) { pts.push([x, y, t, rn]); sinceStore = 0; }
      if (rn > 26 && x * vx + y * vy > 0) { pts.push([x, y, t, rn]); break; }
    }
    paths.push(pts);
  }
  return paths;
}

const BEAM_VERT = /* glsl */ `
  attribute float aT, aSide, aR;
  uniform float uClock, uFade;
  varying float vI, vSide;
  void main(){
    float since = uClock - aT;
    float head = exp(-pow(since / 2.2, 2.0));
    float trail = since > 0.0 ? exp(-since / 22.0) : 0.0;
    float red = clamp((1.0 - 2.0 / aR) * 1.6, 0.0, 1.0);   // light climbing out of the hole's pull fades
    vI = (0.22 + 0.55 * trail + 2.6 * head) * red * uFade;
    vSide = aSide;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const BEAM_FRAG = /* glsl */ `
  varying float vI, vSide;
  void main(){ float a = 1.0 - vSide * vSide; gl_FragColor = vec4(vec3(1.0, 0.88, 0.55) * vI * a, 1.0); }`;

function beamMesh() {
  const paths = beamPaths();
  const pos = [], aT = [], aSide = [], aR = [], idx = [];
  const W = 0.16;
  let base = 0;
  for (const pts of paths) {
    for (let i = 0; i < pts.length; i++) {
      const [x, y, t, r] = pts[i];
      const [x0, y0] = pts[Math.max(0, i - 1)], [x1, y1] = pts[Math.min(pts.length - 1, i + 1)];
      let nx = -(y1 - y0), ny = x1 - x0; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      pos.push(x + nx * W, y + ny * W, 0, x - nx * W, y - ny * W, 0);
      aT.push(t, t); aSide.push(1, -1); aR.push(r, r);
      if (i > 0) { const a = base + (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    base += pts.length * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(aSide, 1));
  g.setAttribute('aR', new THREE.Float32BufferAttribute(aR, 1));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
    uniforms: { uClock: { value: 0 }, uFade: { value: 0 } }, vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  m.frustumCulled = false;
  m.renderOrder = 10;
  return m;
}

// ---------- the pass ----------
export class BlackHoleLens extends Pass {
  constructor({ touch }) {
    super();
    this.enabled = false;
    this.needsSwap = true;
    this.touch = touch;
    this.scale = touch ? 0.72 : 1;
    this.time = 0;
    this.beamClock = 0;
    this.beamsOn = false;
    this.beamFade = 0;
    this.eht = 0;
    this.ehtOn = false;
    this.envSize = 1;
    this.region = null;
    this.diskOn = true;
    this.lensRT = new THREE.WebGLRenderTarget(4, 4, {
      type: THREE.HalfFloatType, depthBuffer: false, generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
    });
    this.diskRT = new THREE.WebGLRenderTarget(1024, 96, { type: THREE.HalfFloatType, depthBuffer: false, wrapS: THREE.RepeatWrapping, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.diskMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uRin: { value: DISK_RIN }, uRout: { value: DISK_ROUT } },
      vertexShader: QUAD_VERT, fragmentShader: DISK_FRAG, depthTest: false, depthWrite: false,
    });
    this.lensMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null }, tBB: { value: blackbodyTexture() }, tDisk: { value: this.diskRT.texture }, tEnv: { value: null }, uEnvSize: { value: 1 }, uEnvOn: { value: 0 },
        tU: { value: null }, tPsi: { value: null }, tRow: { value: null },
        uCamM: { value: new THREE.Vector3() }, uCamRot: { value: new THREE.Matrix3() }, uViewRot: { value: new THREE.Matrix3() },
        uProjInv: { value: new THREE.Matrix4() }, uProj: { value: new THREE.Matrix4() },
        uDiskN: { value: DISK_N.clone() }, uDiskX: { value: DISK_X.clone() }, uDiskY: { value: DISK_Y.clone() },
        uRin: { value: DISK_RIN }, uRout: { value: DISK_ROUT }, uDisk: { value: 1 },
        uPxPerRad: { value: 1000 }, uObsA: { value: 1 }, uEht: { value: 0 },
      },
      vertexShader: QUAD_VERT, fragmentShader: LENS_FRAG, depthTest: false, depthWrite: false,
    });
    this.compMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null }, tLens: { value: this.lensRT.texture },
        uEht: { value: 0 }, uEhtLod: { value: 0 }, uEhtGain: { value: 1 }, uEhtStep: { value: new THREE.Vector2() },
      },
      vertexShader: QUAD_VERT, fragmentShader: COMP_FRAG, depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.lensMat);
    this.buildTables();

    // things drawn after the bending (in front of the hole, or diagrams)
    this.overlay = new THREE.Scene();
    this.overlayGC = new THREE.Group();
    this.overlayGC.position.copy(GC_POS);
    this.overlay.add(this.overlayGC);
    this.beams = beamMesh();
    this.beamGroup = new THREE.Group();
    this.beamGroup.position.copy(GC_POS);
    this.beamGroup.scale.setScalar(M_LY);
    this.beamGroup.add(this.beams);
    this.beamGroup.visible = false;
    this.overlay.add(this.beamGroup);
  }

  // every path light can take past the hole (about 0.1 s of sums, done once)
  buildTables() {
    const { U, PSI, ROW } = buildPhotonTables();
    const tex = (data, w, h) => {
      const t = new THREE.DataTexture(data, w, h, THREE.RedFormat, THREE.FloatType);
      t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
      return t;
    };
    const row = new Float32Array(NB);
    for (let i = 0; i < NB; i++) row[i] = ROW[i * 4];
    const u = this.lensMat.uniforms;
    u.tU.value = tex(U, NX, NB); u.tPsi.value = tex(PSI, NX, NB); u.tRow.value = tex(row, NB, 1);
  }

  setEnv(texture, size) {
    const u = this.lensMat.uniforms;
    u.tEnv.value = texture; u.uEnvSize.value = size; u.uEnvOn.value = texture ? 1 : 0;
  }

  setSize(w, h) {
    this.width = w; this.height = h;
    this.lensRT.setSize(Math.max(4, Math.round(w * this.scale)), Math.max(4, Math.round(h * this.scale)));
  }

  setBeams(on) { this.beamsOn = on; if (on) this.beamClock = 0; }
  // hand the big pictures' memory back (they're made again the next time they're needed)
  release() { this.lensRT.dispose(); this.diskRT.dispose(); }
  setEht(on) { this.ehtOn = on; }

  // Each frame: where the camera is, and how much of the screen needs bending
  // Every frame in deep space, even when the bending itself is off: time, and the fades of the
  // telescope view and the light beams (so a switched-off view can't linger until the next visit)
  tick(dt) {
    this.time += dt * 15; // the gas at the inner edge goes round in about 6 seconds here (really ~30 minutes)
    this.diskMat.uniforms.uTime.value = this.time;
    const u = this.lensMat.uniforms;
    this.eht += ((this.ehtOn ? 1 : 0) - this.eht) * (1 - Math.exp(-dt * 1.6));
    if (!this.ehtOn && this.eht < 0.003) this.eht = 0;
    u.uEht.value = this.eht;
    this.beamFade += ((this.beamsOn ? 1 : 0) - this.beamFade) * (1 - Math.exp(-dt * 3));
    if (!this.beamsOn && this.beamFade < 0.003) this.beamFade = 0;
    u.uDisk.value = 1 - 0.7 * this.beamFade; // the gas dims so the beams stand out
    this.beamGroup.visible = this.beamFade > 0.01;
    if (this.beamGroup.visible) {
      this.beamClock = (this.beamClock + dt * 9) % 110;
      this.beams.material.uniforms.uClock.value = this.beamClock;
      this.beams.material.uniforms.uFade.value = this.beamFade;
    }
  }

  // Where the camera is, and how much of the screen needs bending. False = nothing to do this frame.
  update(camera) {
    const u = this.lensMat.uniforms;
    const cam = _v.copy(camera.position).sub(GC_POS).divideScalar(M_LY);
    const r0 = cam.length();
    u.uCamM.value.copy(cam);
    u.uObsA.value = Math.sqrt(Math.max(1 - 2 / r0, 1e-4));
    camera.updateMatrixWorld();
    u.uCamRot.value.setFromMatrix4(camera.matrixWorld);
    u.uViewRot.value.copy(u.uCamRot.value).transpose();
    u.uProj.value.copy(camera.projectionMatrix);
    u.uProjInv.value.copy(camera.projectionMatrixInverse);
    const H = this.lensRT.height, W = this.lensRT.width;
    const pxPerRad = (H * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    u.uPxPerRad.value = pxPerRad;
    if (this.beamGroup.visible) this.beamGroup.quaternion.copy(camera.quaternion); // the beams always face you
    // the disc's swirl map only matters once the disc is more than a speck
    this.diskOn = r0 < 3000 || this.eht > 0;
    // the part of the screen that needs bending: everything when close, a circle round the hole when far
    this.region = null;
    if (r0 < 2500 || this.eht > 0) return true;
    const p = _v.copy(GC_POS).applyMatrix4(camera.matrixWorldInverse);
    if (p.z > 0) return false; // the hole is behind us and far: bending is too small to see
    const ndc = _v2.copy(GC_POS).project(camera);
    const R = Math.min(13.3 * pxPerRad * pxPerRad / r0 + (40 / r0) * pxPerRad + 6, 4 * Math.max(W, H));
    const cx = (ndc.x * 0.5 + 0.5) * W, cy = (ndc.y * 0.5 + 0.5) * H;
    const x0 = Math.max(0, Math.floor(cx - R)), y0 = Math.max(0, Math.floor(cy - R));
    const x1 = Math.min(W, Math.ceil(cx + R)), y1 = Math.min(H, Math.ceil(cy + R));
    if (x1 <= x0 || y1 <= y0) return false;
    this.region = [x0, y0, x1 - x0, y1 - y0];
    return true;
  }

  render(renderer, writeBuffer, readBuffer) {
    const oldAutoClear = renderer.autoClear;
    renderer.getClearColor(_c); const oldAlpha = renderer.getClearAlpha();
    renderer.autoClear = false;
    // 0. the disc's swirls for this moment
    if (this.diskOn) {
      this.quad.material = this.diskMat;
      renderer.setRenderTarget(this.diskRT);
      this.quad.render(renderer);
    }
    // 1. trace the light (only where it matters)
    const rt = this.lensRT;
    rt.texture.generateMipmaps = this.eht > 0; // the blurred telescope view samples smaller copies
    this.lensMat.uniforms.tScene.value = readBuffer.texture;
    rt.scissorTest = false;
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, false, false);
    if (this.region) {
      // (three.js takes a target's scissor when it's bound, so bind it again)
      rt.scissor.set(...this.region); rt.scissorTest = true;
      renderer.setRenderTarget(rt);
    }
    this.quad.material = this.lensMat;
    this.quad.render(renderer);
    rt.scissorTest = false;
    // 2. combine with the sharp picture
    const cu = this.compMat.uniforms;
    cu.tScene.value = readBuffer.texture;
    cu.uEht.value = this.eht;
    if (this.eht > 0) {
      // blur like the telescope: its sharpness is about 0.4 of the ring's width across
      const ringPx = (10.4 / this.lensMat.uniforms.uCamM.value.length()) * this.lensMat.uniforms.uPxPerRad.value;
      const sigma = Math.max(1, (0.385 * ringPx) / 2.355);
      cu.uEhtLod.value = Math.max(0, Math.log2(sigma * 0.6));
      cu.uEhtStep.value.set(sigma / rt.width, sigma / rt.height);
      cu.uEhtGain.value = 6.2; // (so the bright side of the blurred ring comes out near white, like the real picture)
    }
    this.quad.material = this.compMat;
    renderer.setRenderTarget(writeBuffer);
    this.quad.render(renderer);
    // 3. things in front of the hole, and the light-beam diagram
    if (this.camera && this.eht < 0.5) renderer.render(this.overlay, this.camera); // (the radio view shows only the glowing gas)
    renderer.setClearColor(_c, oldAlpha);
    renderer.autoClear = oldAutoClear;
  }

  dispose() {
    this.lensRT.dispose(); this.diskRT.dispose();
    this.lensMat.dispose(); this.compMat.dispose(); this.diskMat.dispose();
    for (const k of ['tU', 'tPsi', 'tRow', 'tBB']) this.lensMat.uniforms[k].value?.dispose();
    this.beams.geometry.dispose(); this.beams.material.dispose();
  }
}
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _c = new THREE.Color();

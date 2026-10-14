import * as THREE from 'three';
import { noiseGLSL } from '../scene/shaders.js';
import { GC_POS } from './frames.js';

// The Milky Way, built from what astronomers have measured:
// a long central bar, two big spiral arms that start at the ends of the bar (Scutum-Centaurus and
// Perseus), two smaller ones (Sagittarius-Carina and Norma-Outer), and the little Orion Spur where
// the Sun lives. Arm shapes follow the maser measurements of Reid et al. (2019) near the Sun and
// are carried round the far side with the same twist.
//
// How it is drawn:
//  1. A map of the arms (young stars, dust, glowing gas) is painted once on the graphics chip.
//  2. Every frame (only when the camera moves) a "ray marcher" walks through the galaxy for each
//     pixel at reduced resolution, adding starlight and dimming it through dust, so it looks right
//     from above, from the side, and from inside the disc.
//  3. Sparkly stars, pink star nurseries and old star clusters are drawn on top as points.
//
// Units inside this file: kly (thousands of light-years), centred on the middle of the galaxy.

const RG = 64; // half-width of the arms map (kly)
const BAR_BETA = THREE.MathUtils.degToRad(30); // near end of the bar, measured from the Sun's direction

// [start angle (deg), start radius, pitch (deg), end radius, width, strength, ramp in, ramp out, seed]
const ARMS = [
  [30, 14.7, 12.5, 50, 1.15, 1.0, 3.0, 9.0, 1], // Scutum-Centaurus
  [210, 14.7, 12.5, 50, 1.15, 1.0, 3.0, 9.0, 2], // Perseus
  [120, 13.8, 13.0, 48, 0.95, 0.55, 3.0, 9.0, 3], // Sagittarius-Carina
  [300, 13.8, 13.0, 50, 0.95, 0.55, 3.0, 9.0, 4], // Norma-Outer
  [50, 23.3, 11.4, 31.5, 0.75, 0.45, 2.0, 3.0, 5], // Orion Spur (local arm)
];
export const ARM_INFO = [
  { id: 'arm-sct', name: 'Scutum–Centaurus Arm', arm: 0 },
  { id: 'arm-per', name: 'Perseus Arm', arm: 1 },
  { id: 'arm-sgr', name: 'Sagittarius Arm', arm: 2 },
  { id: 'arm-out', name: 'Outer Arm', arm: 3 },
  { id: 'arm-ori', name: 'Orion Spur', arm: 4 },
];
// A point on an arm (deep frame, light-years) at a given angle round the galaxy
export function armPoint(armIndex, betaDeg, out = new THREE.Vector3()) {
  const [bs, rs, psi] = ARMS[armIndex];
  const b = THREE.MathUtils.degToRad(betaDeg);
  const R = rs * Math.exp(-(b - THREE.MathUtils.degToRad(bs)) * Math.tan(THREE.MathUtils.degToRad(psi)));
  return out.set(-R * Math.cos(b) * 1000, 0, -R * Math.sin(b) * 1000).add(GC_POS);
}

const armUniforms = () => {
  const a = [], b = [], c = [];
  for (const [bs, rs, psi, re, w, k, ri, ro, seed] of ARMS) {
    const p = THREE.MathUtils.degToRad(psi);
    a.push(new THREE.Vector4(THREE.MathUtils.degToRad(bs), rs, Math.tan(p), re));
    b.push(new THREE.Vector4(w, k, Math.sin(p), seed));
    c.push(new THREE.Vector4(ri, ro, 0, 0));
  }
  return { uArmA: { value: a }, uArmB: { value: b }, uArmC: { value: c } };
};

const BAR_GLSL = /* glsl */ `
  const float BAR_BETA = ${BAR_BETA.toFixed(6)};
  vec2 barAxis(){ return vec2(-cos(BAR_BETA), -sin(BAR_BETA)); }
  vec2 barPerp(){ return vec2(sin(BAR_BETA), -cos(BAR_BETA)); }
`;

// ---------- 1. the arms map ----------
const ARMS_FRAG = /* glsl */ `
  uniform vec4 uArmA[5]; uniform vec4 uArmB[5]; uniform vec4 uArmC[5];
  uniform float uRG;
  varying vec2 vUv;
  ${noiseGLSL}
  ${BAR_GLSL}
  const float PI = 3.14159265;
  float wrapPi(float a){ return a - 6.2831853 * floor((a + PI) / 6.2831853); }
  void main(){
    vec2 p = (vUv * 2.0 - 1.0) * uRG;          // (x, z) in kly from the centre
    float R = length(p);
    float beta = atan(-p.y, -p.x);
    float young = 0.0, dust = 0.0, hii = 0.0, env2 = 0.0;
    float wob = fbm(vec3(p * 0.035, 1.7));
    for (int i = 0; i < 5; i++){
      vec4 A = uArmA[i]; vec4 B = uArmB[i]; vec4 C = uArmC[i];
      if (R < A.y * 0.85 || R > A.w + 2.0) continue;
      float ba = A.x - log(R / A.y) / A.z;
      float d = wrapPi(beta - ba + 0.07 * wob + 0.04 * snoise(vec3(R * 0.11, B.w * 3.1, 0.5)));
      float s = R * d * B.z;                     // across the arm, + = outer side (kly)
      float sig = B.x * (0.62 + 0.22 * R / 26.0);
      float env = smoothstep(A.y, A.y + C.x, R) * (1.0 - smoothstep(A.w - C.y, A.w, R)) * B.y;
      // knots of young stars strung along the arm
      float lump = smoothstep(-0.15, 0.6, fbm(vec3(R * 0.32, s * 0.5, B.w * 7.0)));
      lump = 0.25 + 1.5 * lump * lump;
      young += env * exp(-s * s / (2.0 * sig * sig)) * lump;
      env2 += env * exp(-s * s / (2.0 * 6.0 * sig * sig));
      // dark dust lane along the inside edge
      float sd = s + 0.75 * sig, ds = 0.32 * sig;
      float streaks = 0.5 + 0.9 * clamp(fbm(vec3(R * 0.6, s * 1.8, B.w * 5.0)) + 0.5, 0.0, 1.2);
      dust += env * exp(-sd * sd / (2.0 * ds * ds)) * streaks;
      // feathery dust spurs leaving the outside of the arm
      float spur = smoothstep(0.6, 0.95, sin((s * 3.2 - R * 1.9) + 4.0 * snoise(vec3(p * 0.12, B.w))) * 0.5 + 0.5);
      dust += env * 0.45 * spur * exp(-(s - 1.4 * sig) * (s - 1.4 * sig) / (2.0 * 1.3 * sig * sig));
      // pink star nurseries just downstream of the dust lane
      float sh = s - 0.1 * sig;
      float spots = smoothstep(0.38, 0.85, snoise(vec3(p * 0.95, B.w * 11.0)) * 0.6 + snoise(vec3(p * 2.3, B.w * 5.0)) * 0.4);
      hii += env * exp(-sh * sh / (2.0 * 0.5 * sig * sig)) * spots;
    }
    // ring of star birth where the arms leave the bar
    float ring = exp(-pow(R - 15.0, 2.0) / (2.0 * 1.1 * 1.1));
    float rspots = smoothstep(0.35, 0.8, snoise(vec3(p * 0.9, 21.0)));
    young += ring * 0.3 * (0.4 + rspots);
    hii += ring * 0.3 * smoothstep(0.2, 0.9, rspots * (0.6 + 0.8 * snoise(vec3(p * 0.25, 3.0))));
    dust += ring * 0.4 * (0.6 + 0.6 * snoise(vec3(p * 0.6, 4.0)));
    // the bar's two straight dust lanes, on the leading edges
    float xb = dot(p, barAxis()), zb = dot(p, barPerp());
    float lane = sign(xb) * (0.9 + 0.1 * abs(xb));
    dust += 1.2 * exp(-pow(zb - lane, 2.0) / (2.0 * 0.28 * 0.28)) * smoothstep(1.5, 4.0, abs(xb)) * (1.0 - smoothstep(11.0, 15.0, abs(xb)));
    // a few loose star clouds between the arms and towards the edge
    float floc = smoothstep(0.25, 0.8, fbm(vec3(p * 0.3, 9.0)) + 0.3);
    float outer = smoothstep(16.0, 26.0, R) * (1.0 - smoothstep(46.0, 58.0, R));
    young += 0.07 * floc * outer;
    dust += 0.08 * floc * outer;
    float edge = 1.0 - smoothstep(55.0, 63.0, R);
    gl_FragColor = vec4(clamp(young * 0.55, 0.0, 1.0) * edge, clamp(dust * 0.75, 0.0, 1.0) * edge, clamp(hii, 0.0, 1.0) * edge, clamp(env2 * 0.8, 0.0, 1.0) * edge);
  }
`;
const QUAD_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// Automatic exposure, like a camera. The smallest mip level of the galaxy picture is its average
// brightness; looking along the thin disc (edge-on) is capped separately so the bright line of the
// disc doesn't burn out.
const EXPO_GLSL = /* glsl */ `
  uniform sampler2D uVol; uniform float uKey, uEdgeCap, uExpoFix, uExpoMix;
  float autoExposure(){
    vec3 avg = textureLod(uVol, vec2(0.5), 14.0).rgb;
    float lum = dot(avg, vec3(0.3, 0.59, 0.11));
    float e = clamp(min(uKey / max(lum, 1e-4), uEdgeCap), 0.06, 2.5);
    // deep inside the middle of the galaxy the exposure is held steady (the black hole's
    // light-bending mixes this picture with a 360-degree one taken from the same spot)
    return mix(e, uExpoFix, uExpoMix);
  }
`;

// ---------- 2. the ray marcher ----------
const VOLUME_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uArms;
  uniform float uRG, uTexel, uPix, uSteps, uBright, uTime;
  uniform vec3 uCam;
  uniform mat4 uProjInv, uCamRot;
  varying vec2 vUv;
  ${BAR_GLSL}
  float sech(float x){ float e = exp(-abs(x)); return 2.0 * e / (1.0 + e * e); }
  float sech2(float x){ float s = sech(x); return s * s; }

  void medium(vec3 p, float lod, out vec3 E, out vec3 S){
    float R = length(p.xz);
    vec4 a = textureLod(uArms, p.xz / (2.0 * uRG) + 0.5, lod);
    float vYoung = sech2(p.y / 0.26), vDust = sech2(p.y / 0.24) + 0.15 * sech2(p.y / 0.6), vHII = sech2(p.y / 0.14);
    float vOld = sech(p.y / 0.8) + 0.12 * sech(p.y / 2.6);
    float disk = exp(-R / 9.0) * (1.0 - smoothstep(46.0, 60.0, R));
    float old = disk * vOld * (0.35 + 1.1 * a.a);
    vec2 q = vec2(dot(p.xz, barAxis()), dot(p.xz, barPerp()));
    float bar = sech2(length(vec3(q.x / 7.0, p.y / 0.9, q.y / 1.6)));
    float bulge = exp(-2.4 * length(vec3(q.x / 2.2, p.y / 1.45, q.y / 1.6)));
    float core = exp(-length(p) / 0.1);
    float young = (a.r * 1.5 + a.a * 0.32) * vYoung;
    float hii = a.b * vHII;
    float dust = (a.g * 1.3 + 0.18 * a.a) * vDust
      + 0.3 * exp(-R / 14.0) * (1.0 - smoothstep(40.0, 56.0, R)) * vDust          // thin dust everywhere in the disc
      + 2.6 * exp(-length(vec3(q.x / 0.8, p.y / 0.06, q.y / 0.35)));             // dense clouds around the centre
    E = old * vec3(1.0, 0.86, 0.68) * 0.55
      + (bar * 0.5 + bulge * 0.75) * vec3(1.0, 0.76, 0.48)
      + core * vec3(1.0, 0.9, 0.72) * 2.0
      + young * vec3(0.42, 0.62, 1.0) * 1.7
      + hii * vec3(1.0, 0.28, 0.55) * 4.5;
    S = dust * vec3(0.55, 0.78, 1.0) * 6.0;
  }

  vec2 slab(vec3 ro, vec3 rd, float h){
    if (abs(rd.y) < 1e-6) return abs(ro.y) < h ? vec2(-1e9, 1e9) : vec2(1.0, -1.0);
    float t1 = (-h - ro.y) / rd.y, t2 = (h - ro.y) / rd.y;
    return vec2(min(t1, t2), max(t1, t2));
  }
  vec2 cylinder(vec3 ro, vec3 rd, float r){
    float a = dot(rd.xz, rd.xz), b = 2.0 * dot(ro.xz, rd.xz), c = dot(ro.xz, ro.xz) - r * r;
    if (a < 1e-10) return c < 0.0 ? vec2(-1e9, 1e9) : vec2(1.0, -1.0);
    float disc = b * b - 4.0 * a * c;
    if (disc < 0.0) return vec2(1.0, -1.0);
    float sq = sqrt(disc);
    return vec2((-b - sq) / (2.0 * a), (-b + sq) / (2.0 * a));
  }

  void main(){
    vec4 v = uProjInv * vec4(vUv * 2.0 - 1.0, -1.0, 1.0); // near plane: stays precise even when it is tiny
    vec3 rd = normalize(mat3(uCamRot) * v.xyz);
    vec3 ro = uCam;
    vec2 s = slab(ro, rd, 4.6), c = cylinder(ro, rd, 62.0);
    float t0 = max(max(s.x, c.x), 0.0), t1 = min(s.y, c.y);
    if (t1 <= t0) { gl_FragColor = vec4(0.0); return; }
    vec2 th = slab(ro, rd, 1.0);
    float a0 = clamp(th.x, t0, t1), a1 = clamp(th.y, t0, t1);
    float lenIn = a1 - a0, lenA = a0 - t0, lenB = t1 - a1;
    float N = uSteps * mix(1.0, 1.6, clamp(lenIn / 40.0, 0.0, 1.0));
    float nIn = lenIn > 1e-4 ? floor(N * 0.62) : 0.0;
    float rest = N - nIn;
    float nA = lenA > 1e-4 ? max(3.0, floor(rest * lenA / max(lenA + lenB, 1e-4))) : 0.0;
    float nB = lenB > 1e-4 ? max(3.0, rest - nA) : 0.0;
    float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))) + uTime * 0.61803);
    vec3 col = vec3(0.0), T = vec3(1.0);
    float total = nA + nIn + nB;
    for (int i = 0; i < 200; i++){
      float fi = float(i);
      if (fi >= total) break;
      // which stretch of the ray this step belongs to; steps bunch up near the camera when it is inside
      float ta, tb, k, n;
      if (fi < nA) { ta = t0; tb = a0; k = fi; n = nA; }
      else if (fi < nA + nIn) { ta = a0; tb = a1; k = fi - nA; n = nIn; }
      else { ta = a1; tb = t1; k = fi - nA - nIn; n = nB; }
      float u0 = k / n, u1 = (k + 1.0) / n, uu = (k + jit) / n;
      bool inside = ta < 1e-3;
      float t = inside ? mix(ta, tb, uu * uu) : mix(ta, tb, uu);
      float dt = inside ? (tb - ta) * (u1 * u1 - u0 * u0) : (tb - ta) / n;
      vec3 p = ro + rd * t;
      float foot = max(t * uPix, 0.5 * dt * length(rd.xz));
      float lod = log2(max(foot / uTexel, 1.0));
      vec3 E, S;
      medium(p, lod, E, S);
      col += T * E * dt;
      T *= exp(-S * dt);
      if (max(T.r, max(T.g, T.b)) < 0.01) break;
    }
    gl_FragColor = vec4(col * uBright, 1.0 - dot(T, vec3(0.3333)));
  }
`;

// ---------- 3. points: sparkle, star nurseries, old clusters ----------
const POINT_VERT = /* glsl */ `
  attribute float aSize; attribute vec3 aColor;
  uniform float uPixelRatio, uFade, uSizeK, uMinPx, uMaxPx, uPhys;
  varying vec3 vC;
  ${EXPO_GLSL}
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float d = max(-mv.z, 1.0);
    // uPhys > 0: things with a real size (light-years); otherwise a gentle distance falloff
    float px = uPhys > 0.0 ? aSize * uSizeK / d : uSizeK * aSize * pow(30000.0 / d, 0.35);
    float size = clamp(px, uMinPx, uMaxPx);
    vC = aColor * uFade * min(1.0, px / uMinPx) * clamp(autoExposure() / 2.4, 0.04, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = size * uPixelRatio;
    if (uFade < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
`;
const POINT_FRAG = /* glsl */ `
  uniform float uSoft;
  varying vec3 vC;
  void main(){ float r = length(gl_PointCoord - 0.5) * 2.0;
    float a = mix(pow(max(1.0 - r, 0.0), 2.0), exp(-r * r * 4.0) * (1.0 - smoothstep(0.8, 1.0, r)), uSoft);
    gl_FragColor = vec4(vC * a, a); }
`;
function pointMaterial(opts, expo) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...expo,
      uPixelRatio: { value: 1 }, uFade: { value: 0 }, uSizeK: { value: opts.sizeK }, uMinPx: { value: opts.minPx },
      uMaxPx: { value: opts.maxPx }, uPhys: { value: opts.phys ? 1 : 0 }, uSoft: { value: opts.soft ?? 0 },
    },
    vertexShader: POINT_VERT, fragmentShader: POINT_FRAG,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
}

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const gauss = (r) => { let u = 0; for (let i = 0; i < 4; i++) u += r(); return (u - 2) * 1.7320508; };
const laplace = (r, b) => { const u = r() - 0.5; return -b * Math.sign(u) * Math.log(1 - 2 * Math.abs(u)); };

export class Galaxy {
  constructor(renderer, { mapSize = 2048, touch = false } = {}) {
    this.renderer = renderer;
    this.mapSize = mapSize;
    this.touch = touch;
    this.group = new THREE.Group();
    this.group.position.copy(GC_POS);
    this.fade = 0;
    this.volScale = touch ? 0.42 : 0.5;
    this.steps = touch ? 52 : 64;
    this.ready = false;
    this.cacheKey = '';
  }

  // Paint the arms map and scatter the sparkle stars (once, when you first fly out this far)
  prepare() {
    if (this.ready) return;
    const r = this.renderer;
    const prev = r.getRenderTarget();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { uRG: { value: RG }, ...armUniforms() }, vertexShader: QUAD_VERT, fragmentShader: ARMS_FRAG,
    }));
    const sc = new THREE.Scene(); sc.add(quad);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.arms = new THREE.WebGLRenderTarget(this.mapSize, this.mapSize, {
      depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
    });
    r.setRenderTarget(this.arms); r.render(sc, cam);
    // a small copy read back to the CPU, so the sparkle stars follow the same arms
    const S = 256;
    const small = new THREE.WebGLRenderTarget(S, S, { depthBuffer: false });
    r.setRenderTarget(small); r.render(sc, cam);
    const px = new Uint8Array(S * S * 4);
    r.readRenderTargetPixels(small, 0, 0, S, S, px);
    r.setRenderTarget(prev);
    small.dispose(); quad.geometry.dispose(); quad.material.dispose();

    this.volMat = new THREE.ShaderMaterial({
      uniforms: {
        uArms: { value: this.arms.texture }, uRG: { value: RG }, uTexel: { value: (2 * RG) / this.mapSize },
        uPix: { value: 0.001 }, uSteps: { value: this.steps }, uBright: { value: 1 }, uTime: { value: 0 },
        uCam: { value: new THREE.Vector3() }, uProjInv: { value: new THREE.Matrix4() }, uCamRot: { value: new THREE.Matrix4() },
      },
      vertexShader: QUAD_VERT, fragmentShader: VOLUME_FRAG, depthTest: false, depthWrite: false,
    });
    this.volScene = new THREE.Scene();
    this.volScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.volMat));
    this.volCam = cam;
    this.volRT = new THREE.WebGLRenderTarget(4, 4, {
      type: THREE.HalfFloatType, depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
    });
    this.expo = { uVol: { value: this.volRT.texture }, uKey: { value: 0.11 }, uEdgeCap: { value: 2.5 }, uExpoFix: { value: 0.04 }, uExpoMix: { value: 0 } };

    // the volume, laid over the scene ("over" blending with premultiplied colour)
    this.composite = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { ...this.expo, uFade: { value: 0 } },
      vertexShader: QUAD_VERT,
      fragmentShader: /* glsl */ `uniform float uFade; varying vec2 vUv;
        ${EXPO_GLSL}
        void main(){
          vec4 c = textureLod(uVol, vUv, 0.0);
          gl_FragColor = vec4(c.rgb * autoExposure() * uFade, c.a * uFade);
        }`,
      transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    }));
    this.composite.frustumCulled = false;
    this.composite.renderOrder = 0;
    this.composite.position.copy(GC_POS).negate(); // cancel the group offset (the quad ignores it anyway)
    this.group.add(this.composite);

    this.makePoints(px, S);
    this.ready = true;
    this.cacheKey = '';
  }

  makePoints(px, S) {
    const r = rng(7);
    const N = this.touch ? 34000 : 52000;
    // weighted pick of a map texel by its young-star brightness
    const w = new Float32Array(S * S); let sum = 0;
    for (let i = 0; i < S * S; i++) { sum += px[i * 4] / 255; w[i] = sum; }
    const hw = new Float32Array(S * S); let hsum = 0;
    for (let i = 0; i < S * S; i++) { hsum += Math.pow(px[i * 4 + 2] / 255, 1.5); hw[i] = hsum; }
    const pick = (cdf, total) => {
      const t = r() * total; let lo = 0, hi = cdf.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < t) lo = m + 1; else hi = m; }
      return lo;
    };
    const cell = (2 * RG) / S;
    const texelToXZ = (i) => [(((i % S) + r()) / S * 2 - 1) * RG, ((Math.floor(i / S) + r()) / S * 2 - 1) * RG];
    const pos = [], col = [], size = [];
    const push = (x, y, z, c, s) => { pos.push(x * 1000, y * 1000, z * 1000); col.push(c[0], c[1], c[2]); size.push(s); };
    const bright = () => 0.35 + Math.pow(r(), 6) * 2.4;
    const ca = Math.cos(BAR_BETA), sa = Math.sin(BAR_BETA);
    for (let i = 0; i < N; i++) {
      const kind = r();
      if (kind < 0.47) { // young blue-white stars in the arms
        const [x, z] = texelToXZ(pick(w, sum));
        const b = bright();
        push(x + gauss(r) * cell * 0.3, laplace(r, 0.22), z + gauss(r) * cell * 0.3, [0.62 * b, 0.76 * b, 1.0 * b], 0.8 + r() * 0.5);
      } else if (kind < 0.8) { // older yellow-white stars everywhere in the disc
        const R = -8.5 * Math.log(Math.max(1e-6, r() * r()));
        if (R > 58) { i--; continue; }
        const th = r() * Math.PI * 2, b = bright() * 0.8;
        push(R * Math.cos(th), laplace(r, 0.7), R * Math.sin(th), [1.0 * b, 0.86 * b, 0.66 * b], 0.75 + r() * 0.4);
      } else { // the bar and bulge: old orange stars
        const inBulge = r() < 0.45;
        const xb = gauss(r) * (inBulge ? 1.7 : 5.2), zb = gauss(r) * (inBulge ? 1.2 : 1.7), y = gauss(r) * (inBulge ? 1.1 : 0.75);
        const x = -xb * ca + zb * sa, z = -xb * sa - zb * ca;
        const b = bright() * 0.9;
        push(x, y, z, [1.0 * b, 0.74 * b, 0.48 * b], 0.75 + r() * 0.4);
      }
    }
    this.sparkle = this.pointsFrom(pos, col, size, { sizeK: 1.5, minPx: 0.9, maxPx: 3.2, soft: 0 });
    this.sparkle.renderOrder = 1;

    // pink glowing gas clouds where new stars are born (a few hundred light-years across)
    const hp = [], hc = [], hs = [];
    for (let i = 0; i < (this.touch ? 1400 : 2200); i++) {
      const [x, z] = texelToXZ(pick(hw, hsum));
      const k = 0.5 + r() * 0.8;
      hp.push(x * 1000, laplace(r, 0.12) * 1000, z * 1000);
      hc.push(1.0 * k * 0.5, 0.3 * k * 0.5, 0.5 * k * 0.5);
      hs.push(50 + Math.pow(r(), 2) * 220);
    }
    this.nurseries = this.pointsFrom(hp, hc, hs, { sizeK: 900, minPx: 1.2, maxPx: 16, soft: 1, phys: true });
    this.nurseries.renderOrder = 2;

    // ~160 old star clusters in a ball around the galaxy
    const gp = [], gc = [], gs = [];
    for (let i = 0; i < 160; i++) {
      const rad = 2 + Math.pow(r(), 2.2) * 95;
      const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      gp.push(rad * s * Math.cos(th) * 1000, rad * u * 0.85 * 1000, rad * s * Math.sin(th) * 1000);
      const k = 0.5 + r() * 0.6;
      gc.push(1.0 * k, 0.88 * k, 0.7 * k);
      gs.push(120 + r() * 160);
    }
    this.clusters = this.pointsFrom(gp, gc, gs, { sizeK: 900, minPx: 2.0, maxPx: 14, soft: 1, phys: true });
    this.clusters.renderOrder = 2;
    this.group.add(this.sparkle, this.nurseries, this.clusters);
  }

  pointsFrom(pos, col, size, opts) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
    const p = new THREE.Points(g, pointMaterial(opts, this.expo));
    p.frustumCulled = false;
    return p;
  }

  setPixelRatio(pr) {
    for (const p of [this.sparkle, this.nurseries, this.clusters]) if (p) p.material.uniforms.uPixelRatio.value = pr;
  }

  setFade(f) {
    this.fade = f;
    if (!this.ready) return;
    this.composite.material.uniforms.uFade.value = f;
    this.composite.visible = f > 0.002;
    this.sparkle.material.uniforms.uFade.value = f * 0.9;
    this.nurseries.material.uniforms.uFade.value = f;
    this.clusters.material.uniforms.uFade.value = f * 0.8;
  }

  // Ray-march the galaxy into a small off-screen picture (only when the view has changed)
  render(camera, width, height, dpr) {
    if (!this.ready || this.fade <= 0.002) return;
    const w = Math.max(16, Math.round(width * dpr * this.volScale));
    const h = Math.max(16, Math.round(height * dpr * this.volScale));
    if (this.volRT.width !== w || this.volRT.height !== h) { this.volRT.setSize(w, h); this.cacheKey = ''; }
    camera.updateMatrixWorld();
    const key = camera.matrixWorld.elements.map((v) => v.toFixed(5)).join(',') + '|' + camera.projectionMatrix.elements.map((v) => v.toFixed(6)).join(',') + `|${w}x${h}|${this.steps}`;
    if (key === this.cacheKey) return;
    this.cacheKey = key;
    const u = this.volMat.uniforms;
    u.uCam.value.copy(camera.position).sub(GC_POS).multiplyScalar(0.001);
    const off = camera.position.clone().sub(GC_POS);
    this.expo.uEdgeCap.value = 20 * Math.max(Math.abs(off.y) / Math.max(off.length(), 1), 0.02);
    u.uProjInv.value.copy(camera.projectionMatrixInverse);
    u.uCamRot.value.copy(camera.matrixWorld);
    u.uPix.value = Math.abs(2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / h; // (cube cameras use a negative fov)
    u.uSteps.value = this.steps;
    u.uTime.value = (u.uTime.value + 1) % 64;
    const r = this.renderer;
    const prev = r.getRenderTarget();
    r.setRenderTarget(this.volRT);
    r.render(this.volScene, this.volCam);
    r.setRenderTarget(prev);
  }
}

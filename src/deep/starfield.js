import * as THREE from 'three';
import { STARS_B64, STAR_COUNT, STAR_DIST_LN, STAR_NAMED } from '../data/starsNear.js';
import { bvToColor } from '../scene/stars.js';

// ~43,000 real stars around the Sun, each in its real place (HYG catalogue).
// Brightness is worked out on the graphics chip from each star's real power and how far away
// the camera is, so stars brighten as you fly towards them and the constellations change shape
// as you move. Near the Sun it looks exactly like the night sky in the solar-system view.

export function decodeStars() {
  const raw = atob(STARS_B64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const dv = new DataView(bytes.buffer);
  const n = STAR_COUNT;
  const pos = new Float32Array(n * 3);
  const abs = new Float32Array(n);
  const col = new Float32Array(n * 3);
  const [ln0, ln1] = STAR_DIST_LN;
  for (let i = 0; i < n; i++) {
    const o = i * 8;
    const ox = dv.getInt16(o, true) / 32767, oy = dv.getInt16(o + 2, true) / 32767;
    let x = ox, y = oy; const z = 1 - Math.abs(ox) - Math.abs(oy);
    if (z < 0) { x = (1 - Math.abs(oy)) * (ox >= 0 ? 1 : -1); y = (1 - Math.abs(ox)) * (oy >= 0 ? 1 : -1); }
    const d = Math.exp(ln0 + (dv.getUint16(o + 4, true) / 65535) * (ln1 - ln0));
    const len = Math.hypot(x, y, z);
    pos[i * 3] = (x / len) * d; pos[i * 3 + 1] = (y / len) * d; pos[i * 3 + 2] = (z / len) * d;
    abs[i] = bytes[o + 6] / 8 - 8;
    const c = bvToColor(bytes[o + 7] / 80 - 0.5);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  return { n, pos, abs, col };
}

// Shared GLSL: apparent magnitude -> how big and bright a star dot is. Matches stars.js exactly
// when gamma = 1 and shift = 0, so switching from the solar-system sky is seamless.
const STAR_COMMON = /* glsl */ `
  uniform float uPixelRatio, uGamma, uShift, uLimit, uNear, uFade;
  attribute float aAbs; attribute vec3 aColor;
  varying vec3 vC;
  float effMag(vec3 wp){
    float d = max(distance(wp, cameraPosition), 1e-6);
    float m = aAbs + 5.0 * (log2(d / 3.26156) * 0.30103) - 5.0;   // real apparent magnitude
    float me = uGamma * m + uShift;                                  // squeezed + "eye adjusting"
    float near = smoothstep(uNear * 2.5, uNear * 0.35, d);           // stars around the view's centre stay findable
    return min(me, mix(99.0, uLimit - 1.6, near));
  }
`;

export function makeStarfield(data) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(data.pos, 3));
  g.setAttribute('aAbs', new THREE.BufferAttribute(data.abs, 1));
  g.setAttribute('aColor', new THREE.BufferAttribute(data.col, 3));
  const uniforms = {
    uPixelRatio: { value: 1 }, uGamma: { value: 1 }, uShift: { value: 0 }, uLimit: { value: 6.5 },
    uNear: { value: 0.001 }, uFade: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `${STAR_COMMON}
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float me = effMag(wp.xyz);
        float vis = smoothstep(uLimit + 0.6, uLimit - 0.4, me);
        float bright = pow(10.0, -0.4 * (me - 1.0));
        float b = min(1.6, 0.35 + sqrt(bright) * 0.9);
        vC = aColor * b * vis * uFade;
        gl_Position = projectionMatrix * viewMatrix * wp;
        gl_PointSize = clamp(5.2 - me * 0.62, 1.4, 6.5) * uPixelRatio;
        if (vis * uFade < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vC;
      void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); float a = smoothstep(0.5, 0.0, r); a *= a;
        gl_FragColor = vec4(vC * a * 1.4, a); }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 3;
  return pts;
}

// A soft glow around the stars that have names, so they stand out and are easy to tap.
export function makeNamedGlows(data, ids) {
  const n = ids.length;
  const pos = new Float32Array(n * 3), abs = new Float32Array(n), col = new Float32Array(n * 3);
  ids.forEach((id, k) => {
    const i = STAR_NAMED[id];
    pos.set(data.pos.subarray(i * 3, i * 3 + 3), k * 3);
    abs[k] = data.abs[i];
    col.set(data.col.subarray(i * 3, i * 3 + 3), k * 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aAbs', new THREE.BufferAttribute(abs, 1));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: 1 }, uGamma: { value: 1 }, uShift: { value: 0 }, uLimit: { value: 6.5 },
      uNear: { value: 0.001 }, uFade: { value: 0 },
    },
    vertexShader: /* glsl */ `${STAR_COMMON}
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float me = effMag(wp.xyz);
        float vis = smoothstep(uLimit + 1.5, uLimit - 0.5, me);
        vC = aColor * vis * uFade * 0.55;
        gl_Position = projectionMatrix * viewMatrix * wp;
        gl_PointSize = clamp(34.0 - me * 3.2, 12.0, 46.0) * uPixelRatio;
        if (vis * uFade < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vC;
      void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0;
        float a = exp(-r * r * 9.0) * 0.9 + exp(-r * 3.2) * 0.25; a *= 1.0 - smoothstep(0.85, 1.0, r);
        gl_FragColor = vec4(vC * a, a); }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 4;
  return pts;
}

export function starPosition(data, id, out = new THREE.Vector3()) {
  const i = STAR_NAMED[id];
  return out.set(data.pos[i * 3], data.pos[i * 3 + 1], data.pos[i * 3 + 2]);
}

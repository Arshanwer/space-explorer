import * as THREE from 'three';
import { GC_POS } from './frames.js';
import { bvToColor } from '../scene/stars.js';
import { makeOrbits, rng, gauss, M_LY } from './gcData.js';

// The middle of the Milky Way, built around Sagittarius A*:
//  - the nuclear star cluster ("star city"): millions of stars packed into a ball ~30 light-years wide
//  - the circumnuclear disc: a lumpy ring of warm dust and gas 10-25 light-years across
//  - the "minispiral": glowing gas streamers falling in towards the middle
//  - the S-stars, racing round the black hole on their real measured orbits
// Everything lives in a group placed at the galactic centre with small local coordinates
// (light-years), so it stays sharp even when the camera is a few light-minutes from the hole.

const _v = new THREE.Vector3();
const CND_N = new THREE.Vector3(-0.342, 0.94, 0).normalize();
const CND_A = new THREE.Vector3(0, 0, 1);
const CND_B = new THREE.Vector3().crossVectors(CND_N, CND_A).normalize();
const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---- stars with a real brightness (absolute magnitude), measured in view space ----
const NSC_VERT = /* glsl */ `
  uniform float uPixelRatio, uFade, uLimit, uGamma, uShift;
  attribute float aAbs; attribute vec3 aColor;
  varying vec3 vC;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float d = max(length(mv.xyz), 1e-7);                       // light-years
    float m = aAbs + 5.0 * log2(d / 32.6156) * 0.30103;        // apparent magnitude
    float me = uGamma * m + uShift;
    float vis = smoothstep(uLimit + 0.6, uLimit - 0.4, me);
    float bright = pow(10.0, -0.4 * (me - 1.0));
    float b = min(1.15, 0.35 + sqrt(bright) * 0.8);
    vC = aColor * b * vis * uFade;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(5.2 - me * 0.62, 1.4, 6.5) * uPixelRatio;
    if (vis * uFade < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }`;
const STAR_FRAG = /* glsl */ `
  varying vec3 vC;
  void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); float a = smoothstep(0.5, 0.0, r); a *= a;
    gl_FragColor = vec4(vC * a * 1.4, a); }`;

// ---- soft clouds with a real size (light-years) ----
const CLOUD_VERT = /* glsl */ `
  uniform float uPixelRatio, uFade, uProjScale;
  attribute float aSize; attribute vec4 aColor;
  varying vec4 vC;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float d = -mv.z;
    float px = aSize * uProjScale / max(d, 1e-7);
    // clouds the camera is flying through dissolve instead of filling the screen
    float k = uFade * (1.0 - smoothstep(70.0, 160.0, px)) * min(1.0, px / 1.5);
    vC = vec4(aColor.rgb * k, aColor.a * k);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(px, 1.0, 160.0) * uPixelRatio;
    if (d <= 0.0 || k < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }`;
const GLOW_FRAG = /* glsl */ `
  varying vec4 vC;
  void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = exp(-r * r * 3.5) * (1.0 - smoothstep(0.8, 1.0, r));
    gl_FragColor = vec4(vC.rgb * a, 1.0); }`; // (additive blending multiplies by alpha, so it must be 1)
const DUST_FRAG = /* glsl */ `
  varying vec4 vC;
  void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = exp(-r * r * 3.0) * (1.0 - smoothstep(0.75, 1.0, r)) * vC.a;
    gl_FragColor = vec4(vC.rgb * a, a); }`;

// ---- the S-stars: always easy to see, sized by distance; split into "behind the black hole"
// (drawn before the light-bending pass so they get bent) and "in front" (drawn after) ----
const SSTAR_VERT = /* glsl */ `
  uniform float uPixelRatio, uFade, uSide;
  uniform vec3 uBhView;
  attribute vec3 aColor; attribute float aSize;
  varying vec3 vC;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float d = max(length(mv.xyz), 1e-9);
    float behind = (-mv.z > -uBhView.z) ? 1.0 : -1.0;
    float keep = (uSide == 0.0 || uSide == behind) ? 1.0 : 0.0;
    float px = clamp(aSize * pow(0.02 / d, 0.28), 2.5, 22.0);
    vC = aColor * uFade * keep;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = px * uPixelRatio;
    if (keep * uFade < 0.002 || mv.z > 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }`;
const SSTAR_FRAG = /* glsl */ `
  varying vec3 vC;
  void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = exp(-r * r * 5.0) + 0.35 * exp(-r * 2.6); a *= 1.0 - smoothstep(0.9, 1.0, r);
    gl_FragColor = vec4(vC * a, a); }`;

function cloudMaterial(frag, blending) {
  const o = {
    uniforms: { uPixelRatio: { value: 1 }, uFade: { value: 0 }, uProjScale: { value: 800 } },
    vertexShader: CLOUD_VERT, fragmentShader: frag, transparent: true, depthTest: false, depthWrite: false,
  };
  if (blending === 'over') Object.assign(o, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  else o.blending = THREE.AdditiveBlending;
  return new THREE.ShaderMaterial(o);
}
function points(pos, attrs, material, order) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  for (const [k, v, n] of attrs) g.setAttribute(k, new THREE.Float32BufferAttribute(v, n));
  const p = new THREE.Points(g, material);
  p.frustumCulled = false;
  p.renderOrder = order;
  return p;
}
const inCnd = (R, th, h, out = new THREE.Vector3()) => out.copy(CND_A).multiplyScalar(R * Math.cos(th)).addScaledVector(CND_B, R * Math.sin(th)).addScaledVector(CND_N, h);

export class GalCentre {
  constructor({ touch }) {
    this.group = new THREE.Group();
    this.group.position.copy(GC_POS);
    this.year = 2026.8;
    this.yearsPerSecond = 1;
    this.fades = { nsc: 0, cnd: 0, sstars: 0 };
    this.buildCluster(touch);
    this.buildRing();
    this.buildSStars();
  }

  // ---------- the nuclear star cluster ----------
  buildCluster(touch) {
    const r = rng(9001);
    const nOld = touch ? 20000 : 28000, nYoung = touch ? 420 : 600;
    const pos = [], abs = [], col = [];
    const v = new THREE.Vector3();
    const dir = () => { const u = r() * 2 - 1, t = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); return v.set(s * Math.cos(t), u, s * Math.sin(t)); };
    const rmin = 0.15, rmax = 90, k = 1.2;
    for (let i = 0; i < nOld; i++) {
      const R = Math.pow(Math.pow(rmin, k) + r() * (Math.pow(rmax, k) - Math.pow(rmin, k)), 1 / k);
      dir().multiplyScalar(R); v.y *= 0.72; // flattened along the galaxy's disc
      pos.push(v.x, v.y, v.z);
      abs.push(3.5 - 6.5 * Math.pow(r(), 3)); // mostly ordinary stars, a few bright giants
      const c = bvToColor(1.05 + 0.6 * r());
      col.push(c.r, c.g, c.b);
    }
    // young, hot, blue giants packed close to the middle (the "IRS 16" group)
    for (let i = 0; i < nYoung; i++) {
      const R = 0.12 + 2.4 * Math.pow(r(), 1.4);
      dir().multiplyScalar(R); v.y *= 0.8;
      pos.push(v.x, v.y, v.z);
      abs.push(-5.0 + 3.5 * r());
      const c = bvToColor(-0.3 + 0.25 * r());
      col.push(c.r, c.g, c.b);
    }
    const mat = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: 1 }, uFade: { value: 0 }, uLimit: { value: 6.5 }, uGamma: { value: 1 }, uShift: { value: 0 } },
      vertexShader: NSC_VERT, fragmentShader: STAR_FRAG,
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.nsc = points(pos, [['aAbs', abs, 1], ['aColor', col, 3]], mat, 2.8);
    this.group.add(this.nsc);
  }

  // ---------- the dusty ring and the glowing streamers ----------
  buildRing() {
    const r = rng(777);
    const gp = [], gs = [], gc = [], dp = [], ds = [], dc = [];
    const v = new THREE.Vector3();
    // lumps of warm dust and gas, strung round the ring
    const lumps = [];
    for (let i = 0; i < 80; i++) {
      const R = i < 64 ? 5.0 + 4.5 * Math.pow(r(), 1.5) : 9 + 6 * r();
      lumps.push([R, r() * Math.PI * 2, gauss(r) * 0.45]);
    }
    for (const [R, th, h] of lumps) {
      const n = 10 + Math.floor(r() * 8);
      for (let j = 0; j < n; j++) {
        const RR = R + gauss(r) * 0.55, tt = th + (gauss(r) * 0.7) / R, hh = h + gauss(r) * 0.3;
        inCnd(RR, tt, hh, v);
        gp.push(v.x, v.y, v.z);
        gs.push(0.6 + 1.3 * r());
        const k = 0.05 + 0.09 * r();
        gc.push(1.0 * k, 0.42 * k, 0.2 * k, 1);
      }
      for (let j = 0; j < 6; j++) {
        inCnd(R + gauss(r) * 0.5, th + (gauss(r) * 0.6) / R, h + gauss(r) * 0.25, v);
        dp.push(v.x, v.y, v.z);
        ds.push(0.9 + 1.2 * r());
        dc.push(0.06, 0.03, 0.025, 0.22 + 0.15 * r());
      }
    }
    // the inner edge glows pink where the bright stars in the middle light it up
    for (let i = 0; i < 260; i++) {
      inCnd(4.6 + 0.8 * r(), r() * Math.PI * 2, gauss(r) * 0.25, v);
      gp.push(v.x, v.y, v.z);
      gs.push(0.3 + 0.5 * r());
      const k = 0.08 + 0.1 * r();
      gc.push(1.0 * k, 0.3 * k, 0.48 * k, 1);
    }
    // the minispiral: glowing streamers of gas falling in towards the middle
    const deg = THREE.MathUtils.degToRad;
    const arms = [
      (t) => [5.0 + 0.3 * Math.sin(t * 9), deg(-70 + 110 * t), 0.2 * Math.sin(t * 5)], // western arc
      (t) => [8.5 * Math.pow(1 - t, 1.2) + 0.45, deg(100 + 150 * t), 2.0 * (1 - t)], // northern arm
      (t) => [6.5 * (1 - t) + 1.0, deg(190 + 80 * t), -1.0 * (1 - t)], // eastern arm
      (t) => { const a = new THREE.Vector2(1.2 * Math.cos(deg(260)), 1.2 * Math.sin(deg(260))), b = new THREE.Vector2(1.5 * Math.cos(deg(60)), 1.5 * Math.sin(deg(60))); const p = a.lerp(b, t); p.y += 0.6 * Math.sin(t * Math.PI); return [p.length(), Math.atan2(p.y, p.x), 0.2]; }, // the bar
    ];
    for (const arm of arms) {
      for (let i = 0; i < 240; i++) {
        const [R, th, h] = arm(r());
        inCnd(R, th, h, v).add(new THREE.Vector3(gauss(r), gauss(r), gauss(r)).multiplyScalar(0.12));
        gp.push(v.x, v.y, v.z);
        gs.push(0.1 + 0.24 * r());
        const k = 0.07 + 0.1 * r();
        if (r() < 0.2) gc.push(1.0 * k, 0.72 * k, 0.78 * k, 1);
        else gc.push(1.0 * k, 0.3 * k, 0.36 * k, 1);
      }
    }
    this.cndGlow = points(gp, [['aSize', gs, 1], ['aColor', gc, 4]], cloudMaterial(GLOW_FRAG, 'add'), 3.0);
    this.cndDust = points(dp, [['aSize', ds, 1], ['aColor', dc, 4]], cloudMaterial(DUST_FRAG, 'over'), 2.9);
    this.group.add(this.cndDust, this.cndGlow);
  }

  // ---------- the S-stars ----------
  buildSStars() {
    this.orbits = makeOrbits(30);
    const n = this.orbits.length;
    this.sPos = new Float32Array(n * 3);
    const col = [], size = [];
    for (const o of this.orbits) {
      const c = o.hot ? new THREE.Color(0.72, 0.84, 1.0) : new THREE.Color(1.0, 0.78, 0.55);
      const k = o.id === 's2' ? 1.8 : o.real ? 1.05 : 0.75;
      col.push(c.r * k, c.g * k, c.b * k);
      size.push(o.id === 's2' ? 17 : o.real ? 9 : 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.sPos, 3));
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
    const mk = (side) => new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: 1 }, uFade: { value: 0 }, uSide: { value: side }, uBhView: { value: new THREE.Vector3() } },
      vertexShader: SSTAR_VERT, fragmentShader: SSTAR_FRAG,
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.sStars = new THREE.Points(g, mk(0)); // in the main picture
    this.sStarsFront = new THREE.Points(g, mk(-1)); // drawn after the light bending (lives in the overlay)
    for (const p of [this.sStars, this.sStarsFront]) { p.frustumCulled = false; p.renderOrder = 3.2; }
    this.group.add(this.sStars);

    // the measured orbits, drawn as faint loops (S2's in gold)
    this.orbitLines = new THREE.Group();
    for (const o of this.orbits.filter((x) => x.real)) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(o.path(360)),
        new THREE.LineBasicMaterial({ color: o.id === 's2' ? 0xffc93c : 0x8fb4ff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
      line.userData.base = o.id === 's2' ? 0.85 : 0.4;
      line.frustumCulled = false;
      line.renderOrder = 3.1;
      this.orbitLines.add(line);
    }
    this.group.add(this.orbitLines);
    this.s2 = this.orbits.find((o) => o.id === 's2');
    this.s2Pos = new THREE.Vector3();
    this.updateOrbits();
  }

  updateOrbits() {
    const v = _v;
    this.orbits.forEach((o, k) => { o.position(this.year, v); this.sPos[k * 3] = v.x; this.sPos[k * 3 + 1] = v.y; this.sPos[k * 3 + 2] = v.z; });
    this.sStars.geometry.attributes.position.needsUpdate = true;
    this.s2.position(this.year, this.s2Pos);
  }

  // Called every frame. dGC = camera distance from the black hole (light-years).
  update(dt, camera, dGC, pixelRatio, lensOn) {
    const z = Math.log10(Math.max(dGC, 1e-12));
    this.year += dt * this.yearsPerSecond;
    // star city: appears as you close in, the "eye adjusts" once you're inside it
    const nsc = 1 - smooth(3.6, 4.2, z);
    const nu = this.nsc.material.uniforms;
    nu.uFade.value = nsc;
    nu.uGamma.value = THREE.MathUtils.lerp(1, 0.78, smooth(2.2, 0.0, z));
    nu.uShift.value = 3.4 * smooth(2.0, -0.5, z);
    nu.uPixelRatio.value = pixelRatio;
    this.nsc.visible = nsc > 0.002;
    // the dusty ring and the streamers (fading once you're deep inside, where they'd just be a haze)
    const cnd = smooth(2.9, 2.1, z) * smooth(-1.1, 0.1, z);
    const H = window.innerHeight;
    const projScale = (H * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    for (let i = 0; i < 2; i++) {
      const p = i ? this.cndDust : this.cndGlow;
      const u = p.material.uniforms;
      u.uFade.value = cnd; u.uPixelRatio.value = pixelRatio; u.uProjScale.value = projScale;
      p.visible = cnd > 0.002;
    }
    // the S-stars, once you're close enough to see them move
    const ss = smooth(0.4, -0.6, z);
    if (ss > 0.002) this.updateOrbits();
    else this.s2.position(this.year, this.s2Pos);
    const bhView = _v.copy(GC_POS).applyMatrix4(camera.matrixWorldInverse);
    for (let i = 0; i < 2; i++) {
      const u = (i ? this.sStarsFront : this.sStars).material.uniforms;
      u.uFade.value = ss; u.uPixelRatio.value = pixelRatio; u.uBhView.value.copy(bhView);
    }
    this.sStars.material.uniforms.uSide.value = lensOn ? 1 : 0;
    this.sStars.visible = ss > 0.002;
    this.sStarsFront.visible = lensOn && ss > 0.002;
    const lines = ss * (1 - smooth(-2.6, -3.4, z));
    for (const l of this.orbitLines.children) l.material.opacity = l.userData.base * lines;
    this.orbitLines.visible = lines > 0.002;
    this.fades.nsc = nsc; this.fades.cnd = cnd; this.fades.sstars = ss;
  }

  // camera-facing distance where the black hole's event horizon would be one pixel wide, etc.
  static get M_LY() { return M_LY; }
}

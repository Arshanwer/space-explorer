import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import gsap from 'gsap';
import { noiseGLSL } from './shaders.js';
import { glowTexture, loadTex } from './textures.js';
import { sphereGeo } from './bodies3d.js';
import { Cutaway } from './cutaway.js';
import { STAR_PATHS } from '../data/starLife.js';

// The life of a star, acted out in its own little scene.
//
// One star changes from stage to stage (its size, colour and bubbling surface are tweened, so you
// watch the Sun swell into a red giant), with the extras each stage needs: the birth cloud, a dusty
// disc with jets, rings showing where the planets' paths are, a glowing shell of puffed-off gas,
// a supernova blast, a pulsar's beams and magnetic loops, and a black hole.
// Each stage is framed so the star is about the same size on screen; true sizes are shown by the
// things around it (planet paths, Earth, the Sun) and by zooming out as the star grows.

const AU_RSUN = 215;
const ORBIT_AU = { mercury: 0.39, venus: 0.72, earth: 1, mars: 1.52, jupiter: 5.2 };
const ORBIT_COLOR = { mercury: '#b9b2a8', venus: '#e8c58a', earth: '#5aa0ff', mars: '#e0734a', jupiter: '#e8b98a' };
const ORBIT_NAME = { mercury: 'Mercury’s path', venus: 'Venus’s path', earth: 'Earth’s path', mars: 'Mars’s path', jupiter: 'Jupiter’s path' };

// What each stage looks like. r = how big the star really is, in Suns (for the zoom-outs).
const LOOKS = {
  cloud: { cam: 9, star: null, cloud: 1, knot: 1 },
  baby: { cam: 6.5, star: { color: [1.0, 0.45, 0.16], cell: 2.2, contrast: 0.5, bright: 1.7, r: 0.35, glow: 1.3 }, cloud: 0.35, disc: 1, jets: 1 },
  sun: { cam: 4.2, star: { color: [1.0, 0.74, 0.36], cell: 3.4, contrast: 0.4, bright: 1.45, r: 1, glow: 0.8 }, rSun: 1, compare: 'earth' },
  bluegiant: { cam: 4.2, star: { color: [0.6, 0.72, 1.0], cell: 3.0, contrast: 0.3, bright: 1.6, r: 1, glow: 1 }, rSun: 7, compare: 'sun' },
  redgiant: { cam: 4.8, star: { color: [1.0, 0.42, 0.17], cell: 1.6, contrast: 0.55, bright: 1.35, r: 1, glow: 0.7 }, rSun: 200 },
  supergiant: { cam: 4.8, star: { color: [1.0, 0.3, 0.12], cell: 1.1, contrast: 0.7, bright: 1.25, r: 1, glow: 0.7 }, rSun: 800 },
  nebula: { cam: 8, star: { color: [0.85, 0.92, 1.0], cell: 4, contrast: 0.1, bright: 3.0, r: 0.07, glow: 1.4 }, shell: 1 },
  whitedwarf: { cam: 5.8, star: { color: [0.8, 0.88, 1.0], cell: 5, contrast: 0.12, bright: 1.0, r: 1, glow: 0.7 }, compare: 'earthsame' },
  supernova: { cam: 12, star: { color: [0.8, 0.88, 1.0], cell: 5, contrast: 0.1, bright: 3.0, r: 0.05, glow: 2 }, blast: 1 },
  neutron: { cam: 6.5, star: { color: [0.7, 0.82, 1.0], cell: 6, contrast: 0.15, bright: 1.5, r: 1, glow: 0.8 }, pulsar: 1 },
  blackhole: { cam: 22, star: null, bh: 1 },
};

const STAR_VERT = /* glsl */ `
  varying vec3 vLocal, vN, vPos;
  void main(){ vLocal = position; vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vPos = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const STAR_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uTime, uCell, uContrast, uBright;
  varying vec3 vLocal, vN, vPos;
  ${noiseGLSL}
  void main(){
    vec3 p = normalize(vLocal);
    float n = fbm(p * uCell + vec3(0.0, 0.0, uTime * 0.05));
    float cells = snoise(p * uCell * 3.2 - vec3(uTime * 0.07));
    vec3 V = normalize(cameraPosition - vPos);
    float mu = max(dot(normalize(vN), V), 0.0);
    float limb = 0.42 + 0.58 * pow(mu, 0.5);
    vec3 c = uColor * (1.0 + uContrast * (0.75 * n + 0.3 * cells));
    c = mix(c * vec3(1.0, 0.55, 0.3), c, limb);
    gl_FragColor = vec4(c * limb * uBright, 1.0);
  }`;

// soft dots with a real size (they shrink with distance), for clouds, discs and shells
const DOTS_VERT = /* glsl */ `
  attribute vec3 aColor; attribute float aSize;
  uniform float uK, uProj, uPixelRatio;
  varying vec3 vC;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float px = aSize * uProj / max(-mv.z, 1e-4);
    vC = aColor * uK * min(1.0, px / 1.5);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(px, 1.0, 48.0) * uPixelRatio;
    if (uK < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }`;
const DOTS_FRAG = /* glsl */ `
  varying vec3 vC;
  void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float g = exp(-2.5 * r * r) * (1.0 - smoothstep(0.8, 1.0, r)); gl_FragColor = vec4(vC * g, 1.0); }`;

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const bell = (r) => Math.sqrt(-2 * Math.log(1 - r() * 0.9999)) * Math.cos(2 * Math.PI * r());

function dots(P, C, S) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('aColor', new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(S, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uK: { value: 0 }, uProj: { value: 800 }, uPixelRatio: { value: 1 } },
    vertexShader: DOTS_VERT, fragmentShader: DOTS_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  return p;
}

function glowSprite(inner, outer, scale) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(inner, outer), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  s.scale.setScalar(scale);
  return s;
}

function ringTexture(rgb, width = 6) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.strokeStyle = `rgba(${rgb},1)`; g.lineWidth = width; g.shadowColor = `rgba(${rgb},1)`; g.shadowBlur = 18;
  g.beginPath(); g.arc(128, 128, 100, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function label(text, cls = 'story-label') {
  const el = document.createElement('div');
  el.className = cls;
  el.textContent = text;
  const o = new CSS2DObject(el);
  o.center.set(0.5, 1.2);
  return o;
}

// a gradient beam (cone), bright at the star end
function beam(len, rad, rgb) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uK: { value: 0 }, uColor: { value: new THREE.Color(...rgb) } },
    vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uK; uniform vec3 uColor; varying float vY; void main(){ gl_FragColor = vec4(uColor * pow(vY, 1.8) * uK, 1.0); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const g = new THREE.Group();
  for (const s of [1, -1]) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(rad, len, 32, 1, true), m);
    c.position.y = (s * len) / 2;
    if (s > 0) c.rotation.z = Math.PI; // the narrow end at the star
    g.add(c);
  }
  return { g, m };
}

export class StarStory {
  constructor({ renderer, camera, dom, touch, onLayerTap }) {
    this.renderer = renderer;
    this.camera = camera;
    this.touch = touch;
    this.onLayerTap = onLayerTap;
    this.scene = new THREE.Scene();
    this.pixelRatio = 1;
    this.t = 0;
    this.k = {}; // how much each part is showing (eased towards its target)
    this.goal = {};

    const c = this.controls = new OrbitControls(camera, dom);
    c.enabled = false; c.enablePan = false; c.enableDamping = true; c.dampingFactor = 0.08;
    c.rotateSpeed = 0.55; c.zoomSpeed = 0.9; c.autoRotate = true; c.autoRotateSpeed = 0.35;
    this.dolly = { logD: Math.log10(9) };

    this.buildStar();
    this.buildCloud();
    this.buildDisc();
    this.buildShell();
    this.buildBlast();
    this.buildPulsar();
    this.buildBlackHole();
    this.buildCompare();
    this.buildOrbits();
  }

  // ---------- the star ----------
  buildStar() {
    const group = new THREE.Group();
    const tilt = new THREE.Group();
    group.add(tilt);
    this.starMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(1, 0.8, 0.5) }, uTime: { value: 0 }, uCell: { value: 3 }, uContrast: { value: 0.3 }, uBright: { value: 2.4 } },
      vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
    });
    this.starMesh = new THREE.Mesh(sphereGeo(0, Math.PI * 2, 96, 64), this.starMat);
    tilt.add(this.starMesh);
    this.glowA = glowSprite('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)', 3.2);
    this.glowB = glowSprite('rgba(255,255,255,0.45)', 'rgba(255,255,255,0)', 7);
    tilt.add(this.glowA, this.glowB);
    this.scene.add(group);
    this.star = { group, tilt };
    this.look = { r: 1, color: new THREE.Color(1, 0.8, 0.5), cell: 3, contrast: 0.3, bright: 2.4, glow: 1, show: 0 };
    // the "body" the slicing code expects
    this.body = {
      def: { id: 'story', inside: [] }, tilt,
      worldPos: (o = new THREE.Vector3()) => group.getWorldPosition(o),
      surfaceVisible: (v) => { this.starMesh.visible = v; this.sliced = !v; },
    };
  }

  // ---------- the cloud a star is born in ----------
  buildCloud() {
    const r = rng(3), P = [], C = [], S = [];
    const n = this.touch ? 4500 : 6000;
    const lumps = [];
    for (let i = 0; i < 26; i++) lumps.push([bell(r) * 1.4, bell(r) * 0.9, bell(r) * 1.1, 0.4 + r() * 0.8]);
    const pal = [[1.0, 0.36, 0.55], [1.0, 0.55, 0.28], [0.5, 0.7, 1.0], [0.9, 0.45, 0.8]];
    for (let i = 0; i < n; i++) {
      const L = lumps[(r() * lumps.length) | 0];
      const x = L[0] + bell(r) * L[3], y = L[1] + bell(r) * L[3] * 0.7, z = L[2] + bell(r) * L[3];
      const c = pal[Math.min(3, (Math.abs(x * 0.7 + y * 1.3 + z * 0.4 + r() * 1.2) | 0) % 4)];
      const k = 0.008 + r() * 0.012;
      P.push(x, y, z); C.push(c[0] * k, c[1] * k, c[2] * k); S.push(0.25 + r() * 0.45);
    }
    this.cloud = dots(P, C, S);
    this.scene.add(this.cloud);
    // the clump that is becoming a star
    this.knot = glowSprite('rgba(255,190,140,1)', 'rgba(255,120,60,0)', 1.6);
    this.scene.add(this.knot);
  }

  // ---------- a baby star's dusty disc and jets ----------
  buildDisc() {
    const r = rng(5), P = [], C = [], S = [];
    for (let i = 0; i < 3500; i++) {
      const rad = 0.55 + Math.pow(r(), 0.7) * 2.3, th = r() * Math.PI * 2;
      const k = (0.1 + r() * 0.1) * (1.2 - rad / 3.2);
      P.push(Math.cos(th) * rad, bell(r) * 0.03 * rad, Math.sin(th) * rad);
      C.push(1.0 * k, 0.62 * k, 0.36 * k); S.push(0.08 + r() * 0.12);
    }
    this.disc = dots(P, C, S);
    this.discGroup = new THREE.Group();
    this.discGroup.rotation.x = 0.28;
    this.discGroup.add(this.disc);
    const j = beam(3.0, 0.4, [0.55, 0.7, 1.0]);
    this.jets = j;
    this.discGroup.add(j.g);
    this.scene.add(this.discGroup);
  }

  // ---------- gas puffed off by a dying Sun-like star ----------
  buildShell() {
    const r = rng(7), P = [], C = [], S = [];
    for (let i = 0; i < (this.touch ? 4500 : 6500); i++) {
      // a fat ring, like the Ring Nebula: more gas round the middle than at the top and bottom
      let u, th;
      do { u = r() * 2 - 1; th = r() * Math.PI * 2; } while (r() > 1 - 0.75 * Math.abs(u));
      const rr = 0.85 + Math.pow(r(), 1.5) * 0.4 + bell(r) * 0.03;
      const s = Math.sqrt(1 - u * u);
      P.push(Math.cos(th) * s * rr, u * rr * 0.8, Math.sin(th) * s * rr);
      const outer = THREE.MathUtils.smoothstep(rr, 0.95, 1.12);
      const k = 0.026 + r() * 0.02;
      C.push(THREE.MathUtils.lerp(0.2, 1.0, outer) * k, THREE.MathUtils.lerp(0.85, 0.28, outer) * k, THREE.MathUtils.lerp(1.0, 0.1, outer) * k);
      S.push(0.12 + r() * 0.16);
    }
    this.shell = dots(P, C, S);
    this.shellGroup = new THREE.Group();
    this.shellGroup.add(this.shell);
    this.shellGroup.rotation.set(0.5, 0, 0.3);
    this.scene.add(this.shellGroup);
  }

  // ---------- a supernova ----------
  buildBlast() {
    const r = rng(9), P = [], C = [], S = [];
    // glowing threads on the outside, like the Crab Nebula's
    const nThreads = this.touch ? 110 : 150;
    for (let f = 0; f < nThreads; f++) {
      const a = new THREE.Vector3(bell(r), bell(r), bell(r)).normalize();
      const b = new THREE.Vector3(bell(r), bell(r), bell(r)).cross(a).normalize();
      const len = 0.4 + r() * 0.9, start = r() * Math.PI * 2;
      const rr0 = 0.78 + r() * 0.22;
      const warm = r();
      for (let k = 0; k < 40; k++) {
        const t = start + (k / 40) * len;
        const w = rr0 * (1 + 0.05 * Math.sin(t * 9 + f));
        const p = a.clone().multiplyScalar(Math.cos(t) * w).addScaledVector(b, Math.sin(t) * w);
        P.push(p.x + bell(r) * 0.015, p.y + bell(r) * 0.015, p.z + bell(r) * 0.015);
        const kk = 0.14 + r() * 0.1;
        if (warm < 0.7) C.push(1.0 * kk, 0.42 * kk, 0.16 * kk); else C.push(1.0 * kk, 0.78 * kk, 0.35 * kk);
        S.push(0.025 + r() * 0.03);
      }
    }
    // a blue-white glow filling the middle
    for (let i = 0; i < 1800; i++) {
      const u = r() * 2 - 1, th = r() * Math.PI * 2, sq = Math.sqrt(1 - u * u), rr = Math.pow(r(), 0.6) * 0.75;
      P.push(Math.cos(th) * sq * rr, u * rr, Math.sin(th) * sq * rr);
      const kk = 0.03 + r() * 0.02;
      C.push(0.45 * kk, 0.75 * kk, 1.0 * kk);
      S.push(0.08 + r() * 0.08);
    }
    this.blast = dots(P, C, S);
    this.blastGroup = new THREE.Group();
    this.blastGroup.add(this.blast);
    this.flash = glowSprite('rgba(255,255,255,1)', 'rgba(200,220,255,0)', 1);
    this.shock = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTexture('170,210,255', 3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    this.scene.add(this.blastGroup, this.flash, this.shock);
  }

  // ---------- a pulsar: beams and magnetic loops, spinning ----------
  buildPulsar() {
    const spin = new THREE.Group();
    const mag = new THREE.Group();
    mag.rotation.z = 0.5; // the magnetic poles are tipped from the spin axis
    const b = beam(9, 0.5, [0.6, 0.78, 1.0]);
    mag.add(b.g);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x7fb0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const L of [1.8, 2.8, 4.2]) {
      for (let a = 0; a < 6; a++) {
        const pts = [];
        for (let k = 0; k <= 64; k++) {
          const th = 0.08 + (k / 64) * (Math.PI - 0.16);
          const rr = L * Math.sin(th) ** 2;
          if (rr < 1) continue;
          pts.push(new THREE.Vector3(rr * Math.sin(th), rr * Math.cos(th), 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), (a / 6) * Math.PI * 2));
        }
        if (pts.length > 1) mag.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
      }
    }
    spin.add(mag);
    this.scene.add(spin);
    this.pulsar = { spin, beam: b, lineMat };
  }

  // ---------- a black hole ----------
  buildBlackHole() {
    const g = new THREE.Group();
    this.bhSphere = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 }));
    g.add(this.bhSphere);
    const r = rng(11), P = [], C = [], S = [];
    for (let i = 0; i < 6000; i++) {
      const rad = 3 + Math.pow(r(), 1.6) * 5, th = r() * Math.PI * 2;
      const hot = THREE.MathUtils.smoothstep(rad, 8, 3);
      const k = (0.12 + r() * 0.1) * (0.4 + hot);
      P.push(Math.cos(th) * rad, bell(r) * 0.05, Math.sin(th) * rad);
      C.push(1.0 * k, (0.45 + 0.45 * hot) * k, (0.15 + 0.6 * hot) * k); S.push(0.07 + r() * 0.1);
    }
    this.bhDisc = dots(P, C, S);
    const disc = new THREE.Group();
    disc.rotation.x = 0.32;
    disc.add(this.bhDisc);
    g.add(disc);
    this.bhRing = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTexture('255,200,140', 7), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    this.bhRing.scale.setScalar(2.6 * 2 * 1.28);
    g.add(this.bhRing);
    this.scene.add(g);
    this.bh = { g, disc };
  }

  // ---------- things to compare sizes with ----------
  buildCompare() {
    const earthMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: loadTex('tex/sd/earth.jpg') }, uK: { value: 0 } },
      vertexShader: 'varying vec2 vUv; varying vec3 vN, vW; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform sampler2D map; uniform float uK; varying vec2 vUv; varying vec3 vN, vW; void main(){ vec3 L = normalize(-vW); float d = max(dot(normalize(vN), L), 0.0); gl_FragColor = vec4(texture2D(map, vUv).rgb * (0.12 + 1.1 * d) * uK, 1.0); }',
      transparent: true,
    });
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), earthMat);
    this.earthLabel = label('Earth');
    this.earth.add(this.earthLabel);
    this.sunMat = this.starMat.clone();
    this.sunMat.uniforms.uColor.value = new THREE.Color(1.0, 0.78, 0.42);
    this.sunMat.uniforms.uCell.value = 3.4; this.sunMat.uniforms.uContrast.value = 0.35;
    this.sunMat.transparent = true;
    this.sunBall = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), this.sunMat);
    this.sunLabel = label('The Sun');
    this.sunBall.add(this.sunLabel);
    this.scene.add(this.earth, this.sunBall);
    // the Sun as it is today, while a giant star grows from it
    this.todayLabel = label('The Sun today');
    this.scene.add(this.todayLabel);
  }

  buildOrbits() {
    this.orbits = {};
    const g = new THREE.Group();
    g.rotation.x = 0.42;
    for (const id of Object.keys(ORBIT_AU)) {
      const pts = [];
      for (let k = 0; k <= 128; k++) { const a = (k / 128) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a))); }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: ORBIT_COLOR[id], transparent: true, opacity: 0, depthWrite: false }));
      const lab = label(ORBIT_NAME[id], 'story-label orbit');
      lab.position.set(0, 0, 1);
      line.add(lab);
      g.add(line);
      this.orbits[id] = { line, lab };
    }
    this.scene.add(g);
    this.orbitGroup = g;
  }

  // ---------- going from stage to stage ----------
  setStage(pathId, index, { intro = true } = {}) {
    const stage = STAR_PATHS[pathId].stages[index];
    const look = LOOKS[stage.look];
    const prev = this.stage;
    this.pathId = pathId; this.index = index; this.stage = stage;
    this.unslice(true);
    this.tl?.kill();
    const tl = this.tl = gsap.timeline();
    const L = this.look;
    const goal = this.goal = { cloud: look.cloud ?? 0, knot: look.knot ?? 0, disc: look.disc ?? 0, jets: look.jets ?? 0, shell: look.shell ?? 0, blast: look.blast ?? 0, pulsar: look.pulsar ?? 0, bh: look.bh ?? 0, earth: 0, sun: 0, today: 0 };
    for (const k of Object.keys(goal)) if (this.k[k] === undefined) this.k[k] = 0;
    const s = look.star;
    const camTo = (d, dur = 2.2, at = 0) => tl.to(this.dolly, { logD: Math.log10(d), duration: dur, ease: 'power2.inOut' }, at);
    const starTo = (o, dur = 2, at = 0, ease = 'power2.inOut') => {
      tl.to(L, { r: o.r, cell: o.cell, contrast: o.contrast, bright: o.bright, glow: o.glow, duration: dur, ease }, at);
      tl.to(L.color, { r: o.color[0], g: o.color[1], b: o.color[2], duration: dur, ease }, at);
    };
    tl.to(L, { show: s ? 1 : 0, duration: 1.0 }, 0);
    // the planets' paths (sizes in units of this stage's star)
    for (const id of Object.keys(this.orbits)) this.orbits[id].on = false;
    if (stage.orbits) for (const id of stage.orbits) { this.orbits[id].on = true; this.orbits[id].line.scale.setScalar((ORBIT_AU[id] * AU_RSUN) / look.rSun); }

    const grows = intro && s && look.rSun > 20 && prev && (prev.look === 'sun' || prev.look === 'bluegiant');
    if (grows) {
      // zoom out from the star as it was, then watch it swell up
      const before = LOOKS[prev.look];
      const r0 = before.rSun / look.rSun;
      L.r = r0;
      this.dolly.logD = Math.log10(before.cam * r0);
      if (prev.look === 'sun') { this.todayLabel.position.set(0, r0 * 1.2, 0); goal.today = 1; tl.call(() => { this.goal.today = 0; }, null, 4.2); }
      camTo(look.cam, 3.2, 0.2);
      starTo({ ...s, r: r0 }, 2.5, 0.4);
      tl.to(L, { r: s.r, duration: 4.5, ease: 'power1.inOut' }, 3.2);
    } else if (intro && stage.look === 'supernova') {
      // the core caves in, a flash, then the blast spreads out
      starTo({ ...LOOKS.supergiant.star, r: 0.12, bright: 2.6 }, 1.2, 0, 'power3.in');
      tl.call(() => { this.flashT = 0; }, null, 1.2);
      starTo(s, 0.3, 1.2);
      this.blastGroup.scale.setScalar(0.2);
      this.k.blast = 0; goal.blast = 0;
      tl.call(() => { this.goal.blast = 1; }, null, 1.25);
      tl.to(this.blastGroup.scale, { x: 4.2, y: 4.2, z: 4.2, duration: 9, ease: 'power2.out' }, 1.25);
      camTo(look.cam, 6, 0.6);
    } else if (intro && stage.look === 'nebula' && prev?.look === 'redgiant') {
      // the outside drifts away; what's left shrinks to a tiny hot core
      this.shellGroup.scale.setScalar(0.5);
      tl.to(this.shellGroup.scale, { x: 2.6, y: 2.6, z: 2.6, duration: 7, ease: 'power2.out' }, 0);
      starTo(s, 3, 0.5);
      camTo(look.cam, 4, 0.3);
    } else if (intro && ['whitedwarf', 'neutron', 'blackhole'].includes(stage.look)) {
      // zoom right in on something tiny
      if (s) { L.r = s.r; starTo(s, 0.01, 0); }
      this.dolly.logD = Math.log10(look.cam * 60);
      camTo(look.cam, 3.4, 0.2);
    } else {
      if (s) starTo(s, 2.2, 0);
      if (stage.look === 'nebula') this.shellGroup.scale.setScalar(2.6);
      if (stage.look === 'supernova') this.blastGroup.scale.setScalar(4.2);
      camTo(look.cam, 2.2, 0);
    }
    // things to compare with
    const cmp = look.compare;
    if (cmp === 'earth') { this.earth.scale.setScalar(1 / 109); this.earth.position.set(1.55, 0.05, 0.6); this.earthLabel.element.textContent = 'Earth'; goal.earth = 1; }
    if (cmp === 'earthsame') { this.earth.scale.setScalar(0.92); this.earth.position.set(2.5, 0, 0.4); this.earthLabel.element.textContent = 'Earth (for size)'; goal.earth = 1; }
    if (cmp === 'sun') { this.sunBall.scale.setScalar(1 / 7); this.sunBall.position.set(1.65, 0.1, 0.5); goal.sun = 1; }
    // let the camera moves above run freely, then limit zooming to around this stage
    const c = this.controls;
    c.minDistance = 0; c.maxDistance = Infinity;
    tl.call(() => { c.minDistance = look.cam * 0.45; c.maxDistance = look.cam * 3; }, null, Math.max(tl.duration(), 0.01));
  }

  // ---------- slicing ----------
  canSlice() { return !!(this.stage?.inside && LOOKS[this.stage.look].star && this.look.show > 0.9); }
  slice() {
    if (!this.canSlice() || this.cut) return false;
    // one cutaway per kind of star, made the first time and reused (opening it again stops any
    // "putting back together" that's still running)
    const look = this.stage.look;
    this.cuts ||= {};
    if (!this.cuts[look]) {
      this.body.def.inside = this.stage.inside;
      this.body.def.id = `story-${look}`;
      this.cuts[look] = new Cutaway(this.body, this.starMat, (i) => this.onLayerTap?.(i));
    }
    for (const [k, c] of Object.entries(this.cuts)) if (k !== look && c.group.parent) c.detach(); // one still closing
    this.cut = this.cuts[look];
    const view = this.camera.position.clone().normalize();
    this.cut.open(view);
    this.controls.autoRotate = false;
    return true;
  }
  unslice(instant) {
    if (!this.cut) return;
    const cut = this.cut;
    this.cut = null;
    this.controls.autoRotate = true;
    if (instant) cut.detach(); else cut.close();
  }
  highlight(i) { this.cut?.setHighlight(i); }

  enter() {
    this.controls.target.set(0, 0, 0);
    this.camera.up.set(0, 1, 0);
    // the controls remember which way was "up" when they were made (it may have been tipped in deep space)
    this.controls._quat.identity(); this.controls._quatInverse.identity();
    this.camera.position.set(0.35, 0.22, 1).normalize().multiplyScalar(Math.pow(10, this.dolly.logD));
    this.camera.lookAt(0, 0, 0);
    this.controls.enabled = true;
  }
  leave() {
    this.unslice(true);
    this.tl?.kill();
    this.controls.enabled = false;
  }

  // ---------- each frame ----------
  update(dt, t) {
    this.t += dt;
    const ease = 1 - Math.exp(-dt * 2.5);
    for (const k of Object.keys(this.goal)) this.k[k] += (this.goal[k] - this.k[k]) * ease;
    const K = this.k;
    const cam = this.camera;
    // keep the camera at the stage's distance while you drag around
    const want = Math.pow(10, this.dolly.logD);
    if (this.tl?.isActive()) {
      const off = cam.position.clone().sub(this.controls.target);
      cam.position.copy(this.controls.target).addScaledVector(off.normalize(), want);
    }
    this.controls.update();
    const pxPerRad = (innerHeight / THREE.MathUtils.degToRad(cam.fov));
    const setDots = (p, k) => { const u = p.material.uniforms; u.uK.value = k; u.uProj.value = pxPerRad; u.uPixelRatio.value = this.pixelRatio; p.visible = k > 0.002; };

    // star
    const L = this.look;
    const show = L.show * (K.blast > 0.5 && this.stage?.look === 'supernova' ? 1 : 1);
    this.star.tilt.scale.setScalar(Math.max(L.r, 1e-4));
    this.star.tilt.rotation.y += dt * 0.05;
    this.starMat.uniforms.uTime.value = this.t;
    this.starMat.uniforms.uColor.value.setRGB(L.color.r, L.color.g, L.color.b);
    this.starMat.uniforms.uCell.value = L.cell;
    this.starMat.uniforms.uContrast.value = L.contrast;
    this.starMat.uniforms.uBright.value = L.bright * show;
    this.starMesh.visible = show > 0.01 && !this.sliced;
    for (const [g, k] of [[this.glowA, 0.38], [this.glowB, 0.16]]) {
      g.material.color.setRGB(L.color.r, L.color.g, L.color.b);
      g.material.opacity = k * L.glow * show * (this.sliced ? 0.3 : 1);
      g.visible = g.material.opacity > 0.003;
    }
    this.cut?.update(this.t);

    // birth cloud
    this.cloud.rotation.y += dt * 0.03;
    setDots(this.cloud, K.cloud);
    this.cloud.scale.setScalar(1 + (1 - K.cloud) * 0.6);
    this.knot.material.opacity = K.knot * (0.75 + 0.25 * Math.sin(this.t * 1.5));
    this.knot.visible = K.knot > 0.003;

    // disc and jets
    this.disc.rotation.y += dt * 0.25;
    setDots(this.disc, K.disc);
    this.jets.m.uniforms.uK.value = K.jets * (0.4 + 0.1 * Math.sin(this.t * 3));
    this.jets.g.visible = K.jets > 0.003;

    // puffed-off shell
    this.shell.rotation.y += dt * 0.02;
    setDots(this.shell, K.shell);

    // supernova
    setDots(this.blast, K.blast);
    if (this.flashT !== undefined) {
      this.flashT += dt;
      const f = this.flashT;
      const a = f < 0.25 ? f / 0.25 : Math.max(0, 1 - (f - 0.25) / 2.6);
      this.flash.material.opacity = a;
      this.flash.scale.setScalar(2 + f * 26);
      this.shock.material.opacity = Math.max(0, 0.9 - f / 4.5);
      this.shock.scale.setScalar(1 + f * 9);
      this.flash.visible = this.shock.visible = a > 0.002 || this.shock.material.opacity > 0.002;
      if (f > 5) this.flashT = undefined;
    } else { this.flash.visible = false; this.shock.visible = false; }

    // pulsar
    const P = this.pulsar;
    P.spin.rotation.y += dt * 2.4;
    P.beam.m.uniforms.uK.value = K.pulsar * 0.45;
    P.lineMat.opacity = K.pulsar * 0.55;
    P.spin.visible = K.pulsar > 0.003;

    // black hole
    this.bhSphere.material.opacity = K.bh;
    this.bh.g.visible = K.bh > 0.003;
    this.bh.disc.rotation.y += dt * 0.3;
    setDots(this.bhDisc, K.bh);
    this.bhRing.material.opacity = K.bh * 0.85;

    // comparisons and planet paths
    this.earth.material.uniforms.uK.value = K.earth;
    this.earth.visible = K.earth > 0.01;
    this.earth.rotation.y += dt * 0.2;
    this.earthLabel.element.style.opacity = K.earth;
    this.sunMat.uniforms.uTime.value = this.t;
    this.sunMat.uniforms.uBright.value = 1.45 * K.sun;
    this.sunBall.visible = K.sun > 0.01;
    this.sunLabel.element.style.opacity = K.sun;
    this.todayLabel.element.style.opacity = K.today;
    this.todayLabel.visible = K.today > 0.01;
    for (const o of Object.values(this.orbits)) {
      o.k = (o.k ?? 0) + ((o.on ? 1 : 0) - (o.k ?? 0)) * ease;
      o.line.material.opacity = o.k * 0.8;
      o.line.visible = o.k > 0.01;
      o.lab.element.style.opacity = o.k * (this.sliced ? 0 : 1); // out of the way of the layer names
      // a path inside the star is swallowed: show it fading under the star
      const inside = o.line.scale.x < L.r * 0.98;
      o.lab.element.classList.toggle('swallowed', inside);
    }
  }
}

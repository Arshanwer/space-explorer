import * as THREE from 'three';
import { PHOTO, CLOUDS } from '../data/astro.js';
import { equatorialToDeep, skyBasis } from './frames.js';
import { rng, gauss } from './gcData.js';

// a properly round bell curve (the quick one in gcData is boxy at its edges, which shows in 2D)
const bell = (r) => Math.sqrt(-2 * Math.log(1 - r() * 0.9999)) * Math.cos(2 * Math.PI * r());
import { glowTexture } from '../scene/textures.js';

// Real telescope pictures, put where the things really are.
//
// Each picture hangs in space facing the Sun, so from home it looks just like the photo. Nebulae
// also get a cloud of soft dots made from the picture's own colours, pushed back and forth to give
// them depth (a hollow bubble for a dying star's puffed-off gas, a bowl for the Orion Nebula, a lumpy
// slab for star nurseries): fly round one and the flat picture melts into the cloud.
// Galaxies are flat, so their pictures are laid on a disc at the galaxy's real tilt.
//
// Pictures are loaded only when needed: a small one (512 px) once the thing is a few pixels wide,
// the sharp one when it fills a good part of the screen, and they're let go again as you leave.

const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const loader = new THREE.TextureLoader();
const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
// which way a direction in space points on the screen (radians, anticlockwise from screen-right)
function screenAngle(camera, p, dir, step) {
  _a.copy(p).project(camera);
  _b.copy(p).addScaledVector(dir, step).project(camera);
  return Math.atan2(_b.y - _a.y, (_b.x - _a.x) * camera.aspect);
}

const CLOUD_VERT = /* glsl */ `
  attribute vec3 aColor; attribute float aSize;
  uniform float uProj, uK, uMaxPx, uPixelRatio, uNear;
  varying vec3 vC;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float d = max(-mv.z, 1e-6);
    float px = aSize * uProj / d;
    float size = min(px, uMaxPx);
    // dots right in front of your nose fade away instead of filling the screen
    float k = uK * smoothstep(uNear * 0.4, uNear, d) * min(1.0, px / 1.2);
    vC = aColor * k;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = max(size, 1.0) * uPixelRatio;
    if (k < 0.002 || mv.z > 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
`;
const CLOUD_FRAG = /* glsl */ `
  varying vec3 vC;
  void main(){
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float g = exp(-2.0 * r * r) * (1.0 - smoothstep(0.8, 1.0, r));
    gl_FragColor = vec4(vC * g, 1.0);
  }
`;
function cloudMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uProj: { value: 800 }, uK: { value: 0 }, uMaxPx: { value: 48 }, uPixelRatio: { value: 1 }, uNear: { value: 1 } },
    vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

// sRGB 0..1 -> linear
const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

// A cloud of dots made from a picture, given depth by `def.model`
function buildCloud(img, def, touch) {
  const W = touch ? 150 : 190, H = Math.max(8, Math.round(W * def.asp));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, W, H);
  const px = g.getImageData(0, 0, W, H).data;
  // the big shapes: a very blurry copy (shrink a lot, then stretch back)
  const sw = Math.max(2, Math.round(W / 14)), sh = Math.max(2, Math.round(H / 14));
  const s = document.createElement('canvas'); s.width = sw; s.height = sh;
  s.getContext('2d').drawImage(img, 0, 0, sw, sh);
  g.clearRect(0, 0, W, H);
  g.imageSmoothingEnabled = true;
  g.drawImage(s, 0, 0, W, H);
  const big = g.getImageData(0, 0, W, H).data;
  let bigMax = 1e-3;
  for (let i = 0; i < W * H; i++) bigMax = Math.max(bigMax, big[i * 4] * 0.3 + big[i * 4 + 1] * 0.59 + big[i * 4 + 2] * 0.11);

  const w = def.w, h = def.w * def.asp, cell = w / W;
  const [ax, ay] = def.anchor ?? [0.5, 0.5];
  const ox = (0.5 - ax) * w, oy = (ay - 0.5) * h;
  const r = rng(def.seed ?? (w * 1000) | 0);
  const pos = [], col = [], size = [];
  const sigma = 0.7; // dot radius in cells
  const norm = 1 / (2 * Math.PI * sigma * sigma);
  const R = (def.r ?? 0.4) * w;
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const o = (j * W + i) * 4;
      let cr = px[o] / 255, cg = px[o + 1] / 255, cb = px[o + 2] / 255;
      const L = cr * 0.3 + cg * 0.59 + cb * 0.11;
      if (L < 0.025) continue;
      // faint areas: fewer, brighter dots (same light on average)
      let boost = 1;
      if (L < 0.09) { if (r() > L / 0.09) continue; boost = 0.09 / L; }
      const x = ((i + 0.5 + (r() - 0.5) * 0.6) / W - 0.5) * w + ox;
      const y = (0.5 - (j + 0.5 + (r() - 0.5) * 0.6) / H) * h + oy;
      const Lb = (big[o] * 0.3 + big[o + 1] * 0.59 + big[o + 2] * 0.11) / bigMax;
      let z;
      const rho = Math.hypot(x, y) / R;
      if (def.model === 'shell') {
        z = rho < 1 ? (r() < 0.5 ? -1 : 1) * Math.sqrt(1 - rho * rho) * R * (def.squash ?? 1) + gauss(r) * 0.05 * R : gauss(r) * 0.12 * R / rho;
      } else if (def.model === 'ball') {
        z = rho < 1 ? (r() * 2 - 1) * Math.sqrt(1 - rho * rho) * R : gauss(r) * 0.08 * R;
      } else {
        z = gauss(r) * def.depth * w * (0.3 + 0.7 * Lb);
        if (def.model === 'bowl') z += 0.16 * w * Math.pow(Math.hypot(x / w, y / h) * 2, 2) * (0.6 + 0.4 * Lb);
      }
      pos.push(x, y, z);
      const k = norm * boost * (def.gain ?? 1);
      col.push(lin(cr) * k, lin(cg) * k, lin(cb) * k);
      size.push(cell * sigma * 4 * (0.85 + r() * 0.3));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  const pts = new THREE.Points(geo, cloudMaterial());
  pts.frustumCulled = false;
  pts.renderOrder = 3;
  pts.material.uniforms.uNear.value = w * 0.05;
  return pts;
}

// The disc a galaxy picture is laid on. Points on the disc are worked out back to where they'd
// appear on the sky (squashed by the tilt), and that's where they read the photo.
function discGeometry(def) {
  const a = THREE.MathUtils.degToRad(def.iang);
  const dx = Math.cos(a), dy = -Math.sin(a); // long axis in the picture (x right, y up)
  const ci = Math.cos(THREE.MathUtils.degToRad(def.inc));
  const W = def.w, H = def.w * def.asp;
  // how much of the disc to cover: the galaxy's oval, or else the whole picture
  let U, V;
  if (def.ell) { U = def.ell[0] * W * 1.04; V = (U * def.ell[1]) / ci; } else {
    U = 0; V = 0;
    for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const X = (sx - def.ix) * W, Y = (1 - sy - (1 - def.iy)) * H;
      U = Math.max(U, Math.abs(X * dx + Y * dy)); V = Math.max(V, Math.abs((-X * dy + Y * dx) / ci));
    }
  }
  const geo = new THREE.PlaneGeometry(2 * U, 2 * V, 1, 1);
  const uv = geo.attributes.uv, p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i), v = p.getY(i) * ci; // along the long axis, and the squashed short axis
    const X = u * dx - v * dy, Y = u * dy + v * dx;
    uv.setXY(i, def.ix + X / W, 1 - def.iy + Y / H);
  }
  return geo;
}

function textureFrom(url, onLoad) {
  const t = loader.load(url, onLoad);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export class Photos {
  constructor({ touch, base = 'tex/astro/' }) {
    this.touch = touch;
    this.base = base;
    this.group = new THREE.Group();
    this.items = {};
    this.focusId = null;
    this.pixelRatio = 1;
    for (const [id, def] of Object.entries(PHOTO)) this.items[id] = this.makeItem(id, def);
    this.clouds = {};
    for (const [id, def] of Object.entries(CLOUDS)) this.clouds[id] = this.makeMagellanic(id, def);
    this.makePulsar();
  }

  // The Crab Pulsar: a spinning neutron star sweeping two beams round like a lighthouse
  // (really 30 turns a second; slowed right down here so you can see it)
  makePulsar() {
    const g = new THREE.Group();
    g.position.copy(this.items.crab.pos);
    const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(235,245,255,1)', 'rgba(120,170,255,0)'), blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true }));
    star.renderOrder = 5;
    g.add(star);
    const spin = new THREE.Group();
    spin.rotation.z = 0.5; // the magnetic poles are tipped from the spin axis
    const beamMat = new THREE.ShaderMaterial({
      uniforms: { uK: { value: 1 } },
      vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uK; varying float vY; void main(){ float a = pow(vY, 1.6) * uK; gl_FragColor = vec4(vec3(0.55, 0.75, 1.0) * a, 1.0); }',
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    for (const s of [1, -1]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.35, 4, 24, 1, true), beamMat);
      cone.position.y = s * 2;
      if (s > 0) cone.rotation.z = Math.PI; // the narrow end at the star
      cone.renderOrder = 4;
      spin.add(cone);
    }
    const axis = new THREE.Group();
    axis.add(spin);
    axis.rotation.x = 0.9;
    g.add(axis);
    g.visible = false;
    this.group.add(g);
    this.pulsar = { g, star, spin, beamMat };
  }

  makeItem(id, def) {
    const pos = equatorialToDeep(def.ra, def.dec, def.dist);
    const { L, N, E } = skyBasis(def.ra, def.dec);
    const g = new THREE.Group();
    g.position.copy(pos);
    const toSun = L.clone().negate();
    const it = { id, def, pos, g, L, N, E, toSun, state: 'none', vis: 0, size: 0 };
    let mat;
    if (def.model === 'disc') {
      // the galaxy's own frame: long axis a, disc normal n
      const pa = THREE.MathUtils.degToRad(def.pa), inc = THREE.MathUtils.degToRad(def.inc);
      const a = N.clone().multiplyScalar(Math.cos(pa)).addScaledVector(E, Math.sin(pa));
      const m = new THREE.Vector3().crossVectors(a, L);
      const n = toSun.clone().multiplyScalar(Math.cos(inc)).addScaledVector(m, Math.sin(inc)).normalize();
      const w = new THREE.Vector3().crossVectors(n, a);
      g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(a, w, n));
      it.normal = n;
      mat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0 });
      it.mesh = new THREE.Mesh(discGeometry(def), mat);
      // a soft glow for the bulge, seen when the disc is side-on
      it.bulge = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,228,190,0.9)', 'rgba(255,170,90,0)'), blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, opacity: 0 }));
      it.bulge.scale.setScalar(def.w * 0.16);
      it.bulge.renderOrder = 3;
      g.add(it.bulge);
    } else if (def.model === 'ball2' || def.model === 'edge') {
      // a picture that always faces you, turned so its long axis (or its "up") stays put in space
      mat = new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
      it.mesh = new THREE.Sprite(mat);
      it.mesh.scale.set(def.w, def.w * def.asp, 1);
      const pa = THREE.MathUtils.degToRad(def.pa ?? 0);
      it.axis = N.clone().multiplyScalar(Math.cos(pa)).addScaledVector(E, Math.sin(pa));
      it.axisIsUp = def.model === 'ball2';
    } else {
      // a nebula: picture in the sky plane, upright with the galaxy's north at the top (which is
      // "up" on the screen out here), z = towards us
      const up = new THREE.Vector3(0, 1, 0).addScaledVector(toSun, -toSun.y).normalize();
      const right = new THREE.Vector3().crossVectors(up, toSun);
      g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, toSun));
      mat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0 });
      it.mesh = new THREE.Mesh(new THREE.PlaneGeometry(def.w, def.w * def.asp), mat);
      const [ax, ay] = def.anchor ?? [0.5, 0.5];
      it.mesh.position.set((0.5 - ax) * def.w, (ay - 0.5) * def.w * def.asp, 0);
    }
    mat.color.setScalar(def.gain ?? 1);
    it.mesh.renderOrder = 3;
    it.mesh.visible = false;
    g.add(it.mesh);
    g.visible = false;
    this.group.add(g);
    return it;
  }

  // ---------- the Magellanic Clouds, from points ----------
  makeMagellanic(id, def) {
    const pos = equatorialToDeep(def.ra, def.dec, def.dist);
    const { L, N, E } = skyBasis(def.ra, def.dec);
    const pa = THREE.MathUtils.degToRad(def.pa), inc = THREE.MathUtils.degToRad(def.inc);
    const a = N.clone().multiplyScalar(Math.cos(pa)).addScaledVector(E, Math.sin(pa));
    const m = new THREE.Vector3().crossVectors(a, L);
    const n = L.clone().negate().multiplyScalar(Math.cos(inc)).addScaledVector(m, Math.sin(inc)).normalize();
    const w = new THREE.Vector3().crossVectors(n, a);
    const g = new THREE.Group();
    g.position.copy(pos);
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(a, w, n));
    const r = rng(def.seed);
    const P = [], C = [], S = [];
    const R = def.r;
    const push = (x, y, z, c, k, s) => { P.push(x, y, z); C.push(c[0] * k, c[1] * k, c[2] * k); S.push(s); };
    const old = [1.0, 0.86, 0.68], young = [0.62, 0.74, 1.0], pink = [1.0, 0.32, 0.55];
    // lumps of young stars scattered over the disc
    const lumps = [];
    for (let i = 0; i < 70; i++) {
      const rr = R * Math.sqrt(r()) * 0.95, th = r() * Math.PI * 2;
      lumps.push([Math.cos(th) * rr, Math.sin(th) * rr * (id === 'smc' ? 0.6 : 0.9), R * (0.04 + r() * 0.1)]);
    }
    const n0 = this.touch ? Math.round(def.points * 0.7) : def.points;
    const [bl, bw] = def.bar;
    const barX = id === 'lmc' ? -0.12 * R : 0;
    for (let i = 0; i < n0; i++) {
      const k = r();
      if (k < 0.3) { // the bar: old, crowded stars
        push(barX + bell(r) * bl * 0.4, bell(r) * bw * 0.45, bell(r) * bw * 0.3, old, 0.45 + r() * 0.35, 70 + r() * 70);
      } else if (k < 0.62) { // the smooth disc of older stars
        const rr = -R * 0.38 * Math.log(Math.max(1e-4, r())), th = r() * Math.PI * 2;
        if (rr > R * 1.3) { i--; continue; }
        push(Math.cos(th) * rr, Math.sin(th) * rr * (id === 'smc' ? 0.62 : 1), bell(r) * R * 0.05, old, 0.35 + r() * 0.35, 80 + r() * 90);
      } else { // young stars in lumps
        const L0 = lumps[(r() * lumps.length) | 0];
        push(L0[0] + bell(r) * L0[2], L0[1] + bell(r) * L0[2], bell(r) * L0[2] * 0.4, young, 0.7 + Math.pow(r(), 3) * 2.2, 40 + r() * 50);
      }
    }
    // pink star nurseries, the biggest where the Tarantula Nebula is
    for (let i = 0; i < 160; i++) {
      const L0 = lumps[(r() * lumps.length) | 0];
      push(L0[0] + bell(r) * L0[2] * 0.8, L0[1] + bell(r) * L0[2] * 0.8, bell(r) * 50, pink, 0.6 + r() * 0.9, 120 + Math.pow(r(), 2) * 380);
    }
    if (id === 'lmc') {
      const t = PHOTO.tarantula;
      const tp = equatorialToDeep(t.ra, t.dec, t.dist).sub(pos);
      const lx = tp.dot(a), ly = tp.dot(w);
      for (let i = 0; i < 90; i++) push(lx + bell(r) * 160, ly + bell(r) * 160, bell(r) * 80, pink, 0.9 + r(), 120 + r() * 260);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('aColor', new THREE.Float32BufferAttribute(C, 3));
    geo.setAttribute('aSize', new THREE.Float32BufferAttribute(S, 1));
    const pts = new THREE.Points(geo, cloudMaterial());
    pts.frustumCulled = false;
    pts.renderOrder = 2;
    pts.material.uniforms.uMaxPx.value = 40;
    pts.material.uniforms.uNear.value = 150;
    g.add(pts);
    this.group.add(g);
    return { id, def, pos, g, pts, r: R };
  }

  // ---------- loading pictures ----------
  load(it, level) {
    if (it.loading === level || it.level === level) return;
    it.loading = level;
    const url = `${this.base}${level === 'full' ? '' : 'sm/'}${it.id}.jpg`;
    const tex = textureFrom(url, () => {
      if (it.loading !== level) { tex.dispose(); return; }
      const old = it.tex;
      it.tex = tex; it.level = level; it.loading = null;
      it.mesh.material.map = tex;
      it.mesh.material.needsUpdate = true;
      it.img = tex.image;
      if (old) old.dispose();
    });
  }
  unload(it) {
    it.loading = null;
    if (it.tex) { it.tex.dispose(); it.tex = null; }
    it.level = null; it.img = null;
    it.mesh.material.map = null; it.mesh.material.needsUpdate = true;
    this.dropCloud(it);
  }
  dropCloud(it) {
    if (!it.cloud) return;
    it.g.remove(it.cloud);
    it.cloud.geometry.dispose(); it.cloud.material.dispose();
    it.cloud = null;
  }
  release() {
    for (const it of Object.values(this.items)) this.unload(it);
  }

  // ---------- each frame ----------
  // pxPerRad: screen pixels per radian; inMilkyWayPhoto: how much the all-sky photo is showing
  // (it already has the Magellanic Clouds and Andromeda in it, so ours fade in as it fades out)
  update(camera, pxPerRad, skyPhotoK, dt, boost = 1) {
    const cam = camera.position;
    for (const it of Object.values(this.items)) {
      const def = it.def;
      const d = cam.distanceTo(it.pos);
      const size = (def.w / Math.max(d, 1e-6)) * pxPerRad;
      it.size = size;
      let vis = smooth(1.2, 5, size) * smooth(def.w * 0.03, def.w * 0.12, d);
      const flat = smooth(def.w * 0.12, def.w * 0.45, d); // close up, a flat picture would look like a wall
      if (it.id === 'crab' && this.pulsarFocus) vis *= 0.3; // visiting the pulsar: dim the cloud round it
      if (def.dist > 1e5) vis *= 1 - skyPhotoK; // seen from home, the all-sky photo already shows them (or they're too faint)
      it.vis = vis;
      if (def.dist > 1e5) it.mesh.material.color.setScalar((def.gain ?? 1) * boost);
      const on = vis > 0.003;
      it.g.visible = on;
      if (!on) {
        if (it.tex && size < 0.6) this.unload(it); // far away: give the memory back
        continue;
      }
      // the sharp picture once it's big on the screen (or it's the place you're visiting)
      const wantFull = size > 420 || (this.focusId === it.id && size > 120);
      if (wantFull) this.load(it, 'full');
      else if (size < 220 && it.level === 'full') this.load(it, 'sm');
      else if (!it.tex && !it.loading) this.load(it, 'sm');
      const ready = !!it.tex;
      it.mesh.visible = ready;
      if (!ready) continue;

      // how squarely we're looking at it from the Sun's side
      _v.copy(cam).sub(it.pos).divideScalar(Math.max(d, 1e-9));
      if (def.model === 'disc') {
        const c = Math.abs(_v.dot(it.normal));
        it.mesh.material.opacity = vis;
        it.bulge.material.opacity = vis * 0.55 * (1 - smooth(0.25, 0.7, c));
      } else if (def.model === 'ball2' || def.model === 'edge') {
        it.mesh.material.opacity = vis;
        const ang = screenAngle(camera, it.pos, it.axis, d * 0.01);
        it.mesh.material.rotation = it.axisIsUp ? ang - Math.PI / 2 : ang;
      } else {
        const c = Math.abs(_v.dot(it.toSun));
        const cloudK = smooth(260, 520, size);
        if (cloudK > 0.01 && !it.cloud && it.img) {
          it.cloud = buildCloud(it.img, def, this.touch);
          it.g.add(it.cloud);
        } else if (cloudK <= 0 && it.cloud && size < 160) this.dropCloud(it);
        const planeK = cloudK > 0 && it.cloud ? THREE.MathUtils.lerp(1, smooth(0.8, 0.97, c), cloudK) : 1;
        it.mesh.material.opacity = vis * planeK * (it.cloud ? flat : 1);
        if (it.cloud) {
          const u = it.cloud.material.uniforms;
          u.uK.value = vis * (1 - planeK * flat) * cloudK;
          u.uProj.value = pxPerRad;
          u.uPixelRatio.value = this.pixelRatio;
          it.cloud.visible = u.uK.value > 0.002;
        }
      }
    }
    // the pulsar shows when you're right inside the Crab Nebula
    const P = this.pulsar;
    const dp = cam.distanceTo(P.g.position);
    const pk = 1 - smooth(8, 14, dp);
    P.g.visible = pk > 0.003;
    if (P.g.visible) {
      P.star.scale.setScalar(dp * 0.07);
      P.star.material.opacity = pk;
      P.beamMat.uniforms.uK.value = pk * 1.0;
      P.spin.rotation.y = (P.spin.rotation.y + dt * 2.2) % (Math.PI * 2);
    }
    for (const c of Object.values(this.clouds)) {
      const d = cam.distanceTo(c.pos);
      const size = (c.r * 2 / Math.max(d, 1e-6)) * pxPerRad;
      const k = smooth(2, 10, size) * (1 - skyPhotoK) * boost;
      const u = c.pts.material.uniforms;
      u.uK.value = k * 0.32;
      u.uProj.value = pxPerRad;
      u.uPixelRatio.value = this.pixelRatio;
      c.g.visible = k > 0.003;
    }
  }
}

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { STAR_NAMED, PLEIADES_CENTRE } from '../data/starsNear.js';
import { DEEP, RUNGS } from '../data/deep.js';
import { decodeStars, makeStarfield, makeNamedGlows, starPosition } from './starfield.js';
import { Galaxy, ARM_INFO, armPoint } from './galaxy.js';
import { GC_POS, PHOTO_TO_DEEP, sceneDirToDeep, deepDirToScene, galacticToDeep } from './frames.js';
import { makeMilkyWay } from '../scene/stars.js';
import { glowTexture } from '../scene/textures.js';
import { GalCentre } from './galcentre.js';
import { BlackHoleLens } from './blackhole.js';
import { M_LY, DISK_N, SKY_N, SKY_L } from './gcData.js';
import { Photos } from './photos.js';
import { Universe } from './universe.js';
import { PHOTO, CLOUDS, DEEP_FIELD } from '../data/astro.js';

// Deep space: everything beyond the planets, in light-years with the Sun at the middle.
// One camera rig covers the nearest stars (a few light-years) all the way out to the whole Milky Way
// (150,000 light-years) and the galaxies next door. "Z" is how far the camera is from what it is
// looking at, as a power of ten (Z = 2 means 100 light-years).

export const Z_HANDOFF = Math.log10(0.004); // where the solar-system view hands over (~250 times Earth-Sun)
const SUN_MIN_D = 0.9; // zooming in closer than this (ly) heads back to the planets
const GAL_UP = new THREE.Vector3(0, 1, 0);
// places you orbit as they are: zooming out from these doesn't drift towards the galaxy's middle
const NO_SLIDE = new Set(['galcentre', 'nsc', 'sgra', 's2', 'milkyway', 'arm-ori', 'arm-per', 'arm-sct', 'arm-sgr', 'arm-out',
  'lmc', 'smc', 'tarantula', 'n159', 'e0102', 'andromeda', 'triangulum', 'whirlpool', 'pinwheel', 'sombrero', 'cena', 'm87', 'virgo', 'deepfield', 'localgroup']);
// places at the very middle of the galaxy: you can zoom right in to the black hole from these
const GC_FOCUS = new Set(['galcentre', 'nsc', 'sgra', 's2']);
const BH_MIN_D = 8 * M_LY; // closest you can get to the black hole: 4 times the event horizon's radius
export const BH_VIEW_D = 34 * M_LY; // where a visit to the black hole stops
const clamp = THREE.MathUtils.clamp;
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const slideK = (z) => smooth(3.9, 4.85, z); // how far the orbit point has slid towards the galaxy's middle
const RUNG_Z = RUNGS.filter((r) => r.z !== undefined).map((r) => r.z);
const MW_RUNG = RUNGS.filter((r) => r.z !== undefined).findIndex((r) => r.id === 'milkyway') + 1, MW_Z = RUNG_Z[MW_RUNG - 1];

// Where the arm names sit (angle round the galaxy, measured from the Sun's direction)
const ARM_LABEL_BETA = { 'arm-ori': 22, 'arm-per': -42, 'arm-sct': -95, 'arm-sgr': 48, 'arm-out': 40 };

function ringTexture(rgb = '255,214,110') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.strokeStyle = `rgba(${rgb},1)`; g.lineWidth = 7;
  g.beginPath(); g.arc(64, 64, 50, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = `rgba(${rgb},0.35)`; g.lineWidth = 16;
  g.beginPath(); g.arc(64, 64, 50, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class DeepSpace {
  constructor({ renderer, camera, dom, touch, test, onPick }) {
    this.renderer = renderer;
    this.camera = camera;
    this.touch = touch;
    this.onPick = onPick;
    this.scene = new THREE.Scene();
    this.Z = Z_HANDOFF;
    this.focusId = 'sun';
    this.focusPos = new THREE.Vector3();
    this.handoffUp = sceneDirToDeep(new THREE.Vector3(0, 1, 0)).normalize();
    this.flight = null;
    this.pixelRatio = 1;
    this.active = false;
    this.cardFor = null; // the place whose card is open
    this.blocked = []; // screen rectangles names must stay out of (the ladder, an open card)

    const c = this.controls = new OrbitControls(camera, dom);
    c.enabled = false;
    c.enablePan = false;
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.rotateSpeed = 0.5;
    c.zoomSpeed = 1.6;
    c.minDistance = SUN_MIN_D;
    c.maxDistance = 6e9;

    // the Milky Way photo, while we are still close to home
    this.photo = makeMilkyWay(1, PHOTO_TO_DEEP);
    this.photo.material.depthTest = false;
    this.photo.renderOrder = -10;
    this.scene.add(this.photo);

    // real stars
    this.data = decodeStars();
    this.stars = makeStarfield(this.data);
    this.scene.add(this.stars);
    this.glowIds = Object.keys(DEEP).filter((id) => DEEP[id].kind === 'star' && STAR_NAMED[id] !== undefined);
    this.glows = makeNamedGlows(this.data, this.glowIds);
    this.scene.add(this.glows);

    // the Sun: same glow as in the planets view, shrinking to a star as we leave
    const sm = (inner, outer, op) => new THREE.SpriteMaterial({ map: glowTexture(inner, outer), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity: op });
    this.sunCore = new THREE.Sprite(sm('rgba(255,250,230,1)', 'rgba(255,200,120,0)', 1));
    this.sunGlowA = new THREE.Sprite(sm('rgba(255,236,190,0.95)', 'rgba(255,140,40,0)', 1));
    this.sunGlowB = new THREE.Sprite(sm('rgba(255,170,60,0.55)', 'rgba(255,90,10,0)', 0.4));
    for (const s of [this.sunGlowB, this.sunGlowA, this.sunCore]) { s.renderOrder = 5; this.scene.add(s); }
    this.here = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTexture(), depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
    this.here.renderOrder = 6;
    this.scene.add(this.here);

    // the galaxy
    this.galaxy = new Galaxy(renderer, { mapSize: test ? 1024 : touch ? 1536 : 2048, touch });
    this.scene.add(this.galaxy.group);

    // its middle: the star city, the dusty ring, the S-stars, and the black hole's light-bending
    this.gc = new GalCentre({ touch });
    this.scene.add(this.gc.group);
    this.lens = new BlackHoleLens({ touch });
    this.lens.camera = camera;
    this.lens.overlayGC.add(this.gc.sStarsFront);
    this.env = null;
    this.upOverride = null; // e.g. "north up" for the telescope view
    this.upOverrideOn = false;
    this.upOverrideK = 0;
    // a ring that shows where the black hole is while it's still far too small to see
    const mk = () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTexture('205,190,255'), depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, opacity: 0 }));
      s.position.copy(GC_POS); s.renderOrder = 6; s.visible = false; return s;
    };
    this.bhMark = mk();
    this.bhMarkFront = mk();
    this.scene.add(this.bhMark);
    this.lens.overlay.add(this.bhMarkFront);

    // real pictures of nebulae and galaxies, the Magellanic Clouds, 11,000 real galaxies and the deep field
    this.photos = new Photos({ touch });
    this.scene.add(this.photos.group);
    this.universe = new Universe({ touch });
    this.scene.add(this.universe.group);

    // the Southern Cross, drawn in 3D so you can watch it fall apart
    const sc = DEEP.southerncross;
    const lp = [];
    for (const [a, b] of sc.lines) lp.push(starPosition(this.data, a), starPosition(this.data, b));
    this.crossLines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lp),
      new THREE.LineBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
    this.crossLines.renderOrder = 4;
    this.scene.add(this.crossLines);

    this.buildPlaces();
  }

  // ---------- places and their names ----------
  buildPlaces() {
    this.places = {};
    const add = (id, pos) => {
      const def = DEEP[id];
      const el = document.createElement('button');
      el.className = 'label-btn deep-label hidden' + (def.kind === 'arm' ? ' arm' : '');
      el.textContent = def.short || def.name;
      if (def.color) el.style.color = def.color;
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('click', (e) => { e.stopPropagation(); this.onPick?.(id); });
      const obj = new CSS2DObject(el);
      obj.center.set(0.5, 1);
      obj.position.copy(pos);
      this.scene.add(obj);
      this.places[id] = { id, def, pos: pos.clone(), obj, el, w: el.textContent.length * 8.5 + 20 };
    };
    for (const id of Object.keys(DEEP)) {
      const def = DEEP[id];
      if (def.kind === 'star') {
        if (id === 'sun') add(id, new THREE.Vector3());
        else if (STAR_NAMED[id] !== undefined) add(id, starPosition(this.data, id));
      }
    }
    add('matariki', new THREE.Vector3().fromArray(PLEIADES_CENTRE));
    const cross = new THREE.Vector3();
    DEEP.southerncross.stars.forEach((s) => cross.add(starPosition(this.data, s)));
    add('southerncross', cross.divideScalar(DEEP.southerncross.stars.length));
    add('galcentre', GC_POS.clone());
    add('nsc', GC_POS.clone().add(new THREE.Vector3(0, 7, 0)));
    add('sgra', GC_POS.clone());
    add('s2', GC_POS.clone().add(this.gc.s2Pos));
    for (const a of ARM_INFO) add(a.id, armPoint(a.arm, ARM_LABEL_BETA[a.id]));
    for (const id of Object.keys(PHOTO)) add(id, this.photos.items[id].pos);
    add('crabpulsar', this.photos.items.crab.pos);
    for (const id of Object.keys(CLOUDS)) add(id, this.photos.clouds[id].pos);
    add('virgo', this.photos.items.m87.pos.clone().add(new THREE.Vector3(0, 1.2e6, 0)));
    add('deepfield', this.universe.deepFieldTarget(0.02));
    add('milkyway', GC_POS.clone());
  }

  placePos(id, out = new THREE.Vector3()) { return out.copy(this.places[id]?.pos ?? GC_POS); }
  // the telescope view: from Earth's side, north up, close enough that the ring fills the middle
  get skyNorth() { return SKY_N; }
  get earthDir() { return SKY_L.clone().negate(); }
  get ehtViewD() { return 30 * M_LY; }
  get zHandoff() { return Z_HANDOFF; }
  get minSunDistance() { return Math.min(SUN_MIN_D, this.controls.minDistance); }

  // a place's colour as CSS, for dock buttons and chips (stars use their real colour)
  cssColor(id) {
    const def = DEEP[id];
    if (def?.color) return def.color;
    const i = STAR_NAMED[id];
    if (i === undefined) return '#ffffff';
    const c = this.data.col;
    return `#${new THREE.Color(c[i * 3], c[i * 3 + 1], c[i * 3 + 2]).getHexString()}`;
  }

  // ---------- coming in from the planets ----------
  // dirScene: unit vector from the Sun towards the camera, in the solar-system scene's frame
  enterFromSolarSystem(dirScene) {
    this.active = true;
    this.focusId = 'sun';
    this.focusPos.set(0, 0, 0);
    const dir = sceneDirToDeep(dirScene).normalize();
    this.camera.up.copy(this.handoffUp);
    this.syncControlsUp();
    this.controls.target.set(0, 0, 0);
    this.camera.position.copy(dir).multiplyScalar(Math.pow(10, Z_HANDOFF));
    this.camera.lookAt(0, 0, 0);
    this.Z = Z_HANDOFF;
    this.zPrev = Z_HANDOFF;
    this.controls.enabled = false;
    this.applyScale(true, 0);
  }

  // Do the one-time graphics work early (paint the galaxy's arms, build its stars, compile every
  // shader) so the first trip out to the stars doesn't stutter.
  warmUp() {
    this.galaxy.prepare();
    const cam = new THREE.PerspectiveCamera(50, 4 / 3, 10, 1e7);
    cam.position.set(GC_POS.x - 90000, 110000, -40000);
    cam.lookAt(GC_POS);
    cam.updateMatrixWorld();
    this.galaxy.setFade(1);
    this.galaxy.render(cam, 64, 48, 1);
    this.galaxy.setFade(0);
    this.galaxy.cacheKey = '';
    // Everything here draws into off-screen pictures first (the glow effect's buffers), and three.js
    // builds a different version of each shader for that, so compile with one of those bound.
    const r = this.renderer;
    const prev = r.getRenderTarget();
    r.setRenderTarget(this.lens.lensRT);
    r.compile(this.scene, cam);
    // the black hole's shaders are big: get them ready now too
    const tmp = new THREE.Scene();
    for (const m of [this.lens.lensMat, this.lens.compMat, this.lens.diskMat]) tmp.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m));
    r.compile(tmp, cam);
    r.compile(this.lens.overlay, cam);
    r.setRenderTarget(prev);
  }

  // A 360° picture of the sky as seen from the black hole, for light that gets bent right round.
  // Taken once (when you first head for the middle of the galaxy), thrown away when you go home.
  captureEnv() {
    if (this.env) return;
    const r = this.renderer;
    const size = this.touch ? 384 : 512;
    const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
    const cc = new THREE.CubeCamera(0.002, 6e6, rt);
    cc.position.copy(GC_POS);
    cc.coordinateSystem = r.coordinateSystem;
    cc.updateCoordinateSystem();
    cc.updateMatrixWorld(true);
    if (!this.galaxy.ready) this.galaxy.prepare();
    // what to show: everything out there, but not the markers and nothing near the Sun
    const hide = [this.photo, this.here, this.bhMark, this.gc.sStars, this.gc.orbitLines, this.crossLines, this.glows, this.sunCore, this.sunGlowA, this.sunGlowB, this.stars, this.photos.group, this.universe.group];
    const vis = hide.map((o) => o.visible);
    hide.forEach((o) => { o.visible = false; });
    const fade = this.galaxy.fade;
    this.galaxy.setFade(1);
    const ex = this.galaxy.expo;
    const mix0 = ex.uExpoMix.value;
    ex.uExpoMix.value = 1;
    const nu = this.gc.nsc.material.uniforms;
    const nsc0 = [nu.uFade.value, nu.uGamma.value, nu.uShift.value, this.gc.nsc.visible];
    nu.uFade.value = 1; nu.uGamma.value = 0.78; nu.uShift.value = 3.4;
    this.gc.nsc.visible = true;
    const clouds = [this.gc.cndGlow, this.gc.cndDust];
    const cl0 = clouds.map((p) => [p.visible, p.material.uniforms.uFade.value, p.material.uniforms.uProjScale.value]);
    clouds.forEach((p) => { p.visible = true; p.material.uniforms.uFade.value = 0.35; p.material.uniforms.uProjScale.value = size * 0.5; });
    const prev = r.getRenderTarget();
    const oldAuto = r.autoClear;
    r.autoClear = true;
    cc.children.forEach((cam, i) => {
      this.galaxy.render(cam, size, size, 1);
      rt.texture.generateMipmaps = i === 5;
      r.setRenderTarget(rt, i);
      r.render(this.scene, cam);
    });
    r.setRenderTarget(prev);
    r.autoClear = oldAuto;
    // put everything back the way it was
    hide.forEach((o, i) => { o.visible = vis[i]; });
    this.galaxy.setFade(fade);
    this.galaxy.cacheKey = '';
    ex.uExpoMix.value = mix0;
    [nu.uFade.value, nu.uGamma.value, nu.uShift.value, this.gc.nsc.visible] = nsc0;
    clouds.forEach((p, i) => { p.visible = cl0[i][0]; p.material.uniforms.uFade.value = cl0[i][1]; p.material.uniforms.uProjScale.value = cl0[i][2]; });
    this.env = rt;
    this.lens.setEnv(rt.texture, size);
  }
  releaseEnv() {
    if (!this.env) return;
    this.env.dispose();
    this.env = null;
    this.lens.setEnv(null, 1);
  }
  // direction (solar-system frame) the camera is looking from, for handing back
  dirToSolarSystem() {
    return deepDirToScene(this.camera.position.clone().sub(this.controls.target).normalize());
  }
  leave() {
    this.active = false;
    this.crossLinesOn = false;
    this.cardFor = null;
    this.camera.fov = 50; this.camera.updateProjectionMatrix();
    this.flight = null;
    this.controls.enabled = false;
    this.crossLines.material.opacity = 0;
    this.camera.up.set(0, 1, 0);
    this.lens.enabled = false;
    this.lens.setBeams(false); this.lens.setEht(false); this.lens.eht = 0; this.lens.beamFade = 0;
    this.upOverride = null; this.upOverrideOn = false; this.upOverrideK = 0;
    this.releaseEnv(); // give the graphics memory back to the planets
    this.lens.release();
    this.photos.release();
    this.universe.release();
    this.galaxy.releaseFar();
  }

  syncControlsUp() {
    const c = this.controls;
    c._quat.setFromUnitVectors(this.camera.up, GAL_UP);
    c._quatInverse.copy(c._quat).invert();
  }

  // Which way is "up" on screen. Next to the Sun at the tiniest zoom it matches the planets view;
  // everywhere else it's galactic north. A smooth function of zoom and of where we're looking,
  // so nothing ever rolls suddenly (even if a flight is interrupted).
  upFor(z, target, out = new THREE.Vector3()) {
    const w = (1 - smooth(Z_HANDOFF + 0.15, -0.3, z)) * clamp(1 - target.length() / 0.2, 0, 1);
    out.copy(GAL_UP).lerp(this.handoffUp, w);
    // right next to the black hole, "up" turns to the spin axis of its glowing disc, so the disc
    // looks level and you circle round it
    const nearGC = clamp(1 - target.distanceTo(GC_POS) / 0.01, 0, 1);
    if (nearGC > 0) out.normalize().lerp(DISK_N, smooth(-2.6, -3.6, z) * nearGC);
    if (this.upOverride && this.upOverrideK > 0) out.normalize().lerp(this.upOverride, this.upOverrideK);
    return out.normalize();
  }
  get slides() { return !NO_SLIDE.has(this.focusId); }

  // drop any leftover drag "spin" so it can't nudge the camera after a flight lands
  stillControls() {
    const c = this.controls;
    c._sphericalDelta.set(0, 0, 0);
    c._scale = 1;
  }

  // ---------- flights ----------
  // A "powers of ten" trip: pull back until both places fit, slide over, then dive in.
  flyTo({ target, z, dir, duration, focusId, onDone, locked = false, straight = false }) {
    if (this.flight?.locked) return false; // already on the way home to the planets
    this.stillControls();
    const cam = this.camera;
    const t0 = this.controls.target.clone();
    const d0 = cam.position.distanceTo(t0);
    const z0 = Math.log10(Math.max(d0, 1e-9));
    const dir0 = cam.position.clone().sub(t0).normalize();
    const dir1 = (dir || dir0).clone().normalize();
    const sep = t0.distanceTo(target);
    // (a "straight" flight glides along without pulling back first)
    const zp = Math.max(z0, z, sep > 1e-6 && !straight ? Math.log10(sep * 1.4) : -99);
    // control point chosen so the highest point of the curve is exactly zp (no overshoot when we're
    // already high enough, e.g. diving straight in to something right in the middle of the view)
    const zc = zp + Math.sqrt(Math.max(0, (zp - z0) * (zp - z)));
    const travel = Math.abs(zp - z0) + Math.abs(zp - z);
    this.flight = {
      t: 0, dur: duration ?? clamp(2.0 + travel * 0.42, 2.2, travel > 11 ? 8.5 : 6.5),
      t0, t1: target.clone(), z0, z1: z, zc, q: new THREE.Quaternion().setFromUnitVectors(dir0, dir1), dir0,
      onDone, locked,
    };
    if (focusId) { this.focusId = focusId; this.focusPos.copy(target); }
    this.controls.enabled = false;
    return true;
  }
  // A touch takes over from an automatic flight: stay exactly where we are and orbit this spot
  cancelFlight() {
    if (!this.flight || this.flight.locked) return false;
    const f = this.flight;
    this.flight = null;
    const t = f.cur ?? this.controls.target;
    this.controls.target.copy(t);
    this.focusPos.copy(t);
    this.focusId = t.length() < 0.05 ? 'sun' : t.distanceTo(GC_POS) < 0.05 ? 'galcentre' : 'free';
    this.zPrev = Math.log10(Math.max(this.viewDistance, 1e-9));
    this.syncControlsUp();
    this.stillControls();
    this.controls.enabled = true;
    return true;
  }
  updateFlight(dt) {
    const f = this.flight;
    f.t = Math.min(1, f.t + dt / f.dur);
    const u = easeInOut(f.t);
    const z = (1 - u) * (1 - u) * f.z0 + 2 * u * (1 - u) * f.zc + u * u * f.z1;
    const s = smooth(0.12, 0.88, u);
    const target = (f.cur ||= new THREE.Vector3()).copy(f.t0).lerp(f.t1, s);
    const dir = _v1.copy(f.dir0).applyQuaternion(_q.identity().slerp(f.q, u));
    this.upFor(z, target, this.camera.up);
    this.camera.position.copy(target).addScaledVector(dir, Math.pow(10, z));
    this.camera.lookAt(target);
    this.controls.target.copy(target);
    if (f.t >= 1) {
      this.flight = null;
      this.zPrev = z;
      this.syncControlsUp();
      this.stillControls();
      this.controls.enabled = true;
      f.onDone?.();
    }
  }

  // Camera direction for arriving somewhere: tipped up from the galaxy's flat plane by `elev` degrees
  viewDir(target, elevDeg, azimuthFrom) {
    const flat = (azimuthFrom ? azimuthFrom.clone() : this.camera.position.clone().sub(target)).setY(0);
    if (flat.lengthSq() < 1e-12) flat.set(-1, 0, 0);
    flat.normalize();
    const e = THREE.MathUtils.degToRad(elevDeg);
    return flat.multiplyScalar(Math.cos(e)).add(new THREE.Vector3(0, Math.sin(e), 0)).normalize();
  }

  // tall phone screens see less from side to side, so stand back a little further
  get portraitZ() { const a = innerWidth / innerHeight; return a < 1 ? Math.log10(Math.max(1, 0.85 / a)) : 0; }

  flyToRung(id, onDone) {
    const r = RUNGS.find((x) => x.id === id);
    if (!r || r.z === undefined) return;
    if (this.flight?.locked) return;
    this.crossLinesOn = false;
    if (r.target === 'localgroup') {
      // between us and Andromeda, looking from the side so both galaxies show
      const m31 = this.photos.items.andromeda.pos;
      const target = GC_POS.clone().lerp(m31, 0.42);
      const side = new THREE.Vector3().subVectors(m31, GC_POS).cross(new THREE.Vector3(0, 1, 0)).normalize();
      this.flyTo({ target, z: r.z + this.portraitZ, dir: this.viewDir(target, r.elev, side), focusId: 'localgroup', onDone });
      return;
    }
    const target = r.target === 'galcentre' ? GC_POS.clone() : new THREE.Vector3();
    // the whole galaxy: look from the Sun's side so "you are here" is near the front
    const from = r.target === 'galcentre' ? new THREE.Vector3(-1, 0, -0.42) : null;
    this.flyTo({ target, z: r.z + this.portraitZ, dir: this.viewDir(target, r.elev, from), focusId: r.target === 'galcentre' ? 'galcentre' : 'sun', onDone });
  }

  // Glide right through the Hubble Ultra Deep Field, from where Hubble looks in to the far end
  flyThroughDeepField(onDone) {
    const u = this.universe, L = DEEP_FIELD.length;
    const look = L * 0.3;
    const apex = u.deepFieldApex;
    const off = this.camera.position.clone().sub(apex);
    const along0 = off.dot(u.dfAxis);
    const along = THREE.MathUtils.clamp(along0, 0, L * 0.5);
    // looking at it from the side, or already at the far end: first go back to Hubble's spot
    if (along0 > L * 0.5 || off.addScaledVector(u.dfAxis, -along0).length() > L * 0.04 || this.camera.position.distanceTo(this.controls.target) > look * 3) {
      this.flyTo({ target: apex.clone().addScaledVector(u.dfAxis, look), z: Math.log10(look), dir: u.dfAxis.clone().negate(), focusId: 'deepfield', onDone: () => this.flyThroughDeepField(onDone) });
      return;
    }
    this.camera.position.copy(apex).addScaledVector(u.dfAxis, along);
    this.controls.target.copy(this.camera.position).addScaledVector(u.dfAxis, look);
    this.camera.lookAt(this.controls.target);
    this.flyTo({ target: apex.clone().addScaledVector(u.dfAxis, L * 0.86 + look), z: Math.log10(look), dir: u.dfAxis.clone().negate(), duration: 16, focusId: 'deepfield', straight: true, onDone });
  }

  // How far back to stand so something w x h light-years fits beside the card
  fitDistance(w, h) {
    const vt = Math.tan(THREE.MathUtils.degToRad(50 / 2)), ht = vt * this.camera.aspect;
    const portrait = this.camera.aspect < 1;
    const fw = portrait ? 0.92 : 0.56, fh = portrait ? 0.5 : 0.84;
    return Math.max(w / (2 * ht * fw), h / (2 * vt * fh));
  }

  // Look at a picture from (about) where we see it from: home, nudged a little off to one side
  // so it's clear it isn't flat
  photoView(pos, toSun, z, off = 0.2) {
    const side = new THREE.Vector3().crossVectors(toSun, GAL_UP).normalize();
    const dir = toSun.clone().addScaledVector(side, off).add(new THREE.Vector3(0, off * 0.6, 0)).normalize();
    return { target: pos.clone(), z, dir };
  }

  // Visit a place: frame it so the Sun (home) is usually still in view
  select(id, onDone) {
    const p = this.places[id];
    if (!p || this.flight?.locked) return null;
    const def = p.def;
    const pos = p.pos.clone();
    let z, dir;
    const fromSun = pos.length();
    if (id === 'sun') {
      z = Math.log10(16); dir = this.viewDir(pos, 22);
    } else if (GC_FOCUS.has(id) && id !== 'galcentre') {
      // diving into the middle of the galaxy: take the 360° sky picture first (a short pause)
      this.captureEnv();
      const target = GC_POS.clone();
      const cur = this.camera.position.clone().sub(GC_POS).normalize();
      if (id === 'sgra') {
        // stop beside the black hole, looking across its glowing disc (76° from straight above it)
        const flat = cur.clone().addScaledVector(DISK_N, -cur.dot(DISK_N));
        if (flat.lengthSq() < 1e-8) flat.set(0, 0, 1);
        flat.normalize();
        const inc = THREE.MathUtils.degToRad(76);
        z = Math.log10(BH_VIEW_D) + this.portraitZ;
        dir = DISK_N.clone().multiplyScalar(Math.cos(inc)).addScaledVector(flat, Math.sin(inc)).normalize();
      } else if (id === 's2') {
        // look down on S2's stretched orbit (centred on the whole loop) so you can watch it whip round
        const o = this.gc.s2;
        const n = new THREE.Vector3().crossVectors(o.Pv, o.Qv).normalize();
        if (n.dot(cur) < 0) n.negate();
        target.addScaledVector(o.Pv, -o.aLy * o.e);
        z = Math.log10(o.aLy * 3.7) + this.portraitZ;
        dir = n.add(cur.multiplyScalar(0.25)).normalize();
      } else {
        z = Math.log10(75) + this.portraitZ;
        dir = this.viewDir(target, 35, cur.lengthSq() > 0 ? cur : null);
      }
      this.crossLinesOn = false;
      this.flyTo({ target, z, dir, focusId: id, onDone });
      return def;
    } else if (PHOTO[id] || id === 'crabpulsar') {
      // a real picture: frame it the way the telescope saw it
      const it = this.photos.items[id === 'crabpulsar' ? 'crab' : id];
      const w = it.def.w;
      const big = it.def.model === 'disc' || it.def.model === 'edge' || it.def.model === 'ball2';
      const fit = this.fitDistance(w, w * it.def.asp) * 1.2;
      const zz = id === 'crabpulsar' ? Math.log10(6.5) : Math.log10(fit);
      const v = this.photoView(it.pos, it.toSun, zz, id === 'crabpulsar' ? 0.5 : big ? 0.12 : 0.16);
      this.crossLinesOn = false;
      this.flyTo({ ...v, focusId: id, onDone });
      return def;
    } else if (CLOUDS[id]) {
      const c = this.photos.clouds[id];
      const toSun = c.pos.clone().normalize().negate();
      const v = this.photoView(c.pos, toSun, Math.log10(c.r * 4.2) + this.portraitZ, 0.3);
      this.crossLinesOn = false;
      this.flyTo({ ...v, focusId: id, onDone });
      return def;
    } else if (id === 'virgo') {
      const m87 = this.photos.items.m87;
      const v = this.photoView(m87.pos, m87.toSun, Math.log10(1.4e7) + this.portraitZ, 0.35);
      this.crossLinesOn = false;
      this.flyTo({ ...v, focusId: id, onDone });
      return def;
    } else if (id === 'deepfield') {
      // stand where Hubble stood (in the right direction), looking into the field
      const target = this.universe.deepFieldTarget(0.55);
      this.crossLinesOn = false;
      this.flyTo({ target, z: Math.log10(DEEP_FIELD.length * 0.55), dir: this.universe.dfAxis.clone().negate(), focusId: id, onDone });
      return def;
    } else if (id === 'milkyway') {
      const target = GC_POS.clone();
      this.crossLinesOn = false;
      this.flyTo({ target, z: Math.log10(150000) + this.portraitZ, dir: this.viewDir(target, 52, new THREE.Vector3(-1, 0, -0.42)), focusId: 'galcentre', onDone });
      return def;
    } else if (def.kind === 'star') {
      // stand a little beyond the star, looking back past it towards home, so the Sun is in view too
      const d = clamp(fromSun * 0.45, 1.6, 320);
      z = Math.log10(d);
      const out = pos.clone().normalize();
      const side = new THREE.Vector3().crossVectors(out, GAL_UP).normalize();
      dir = out.multiplyScalar(0.92).addScaledVector(side, 0.3).add(new THREE.Vector3(0, 0.2, 0)).normalize();
    } else if (id === 'matariki') {
      z = Math.log10(26); dir = pos.clone().normalize().add(new THREE.Vector3(0, 0.4, 0)).normalize();
    } else if (id === 'southerncross') {
      // stand at home (the Sun) and look out at the cross, the way we see it from New Zealand.
      // Turning around then swings you round the middle of the cross, so you see it fall apart.
      z = Math.log10(pos.length());
      dir = pos.clone().normalize().negate();
      this.crossLinesOn = true;
      this.flyTo({ target: pos, z, dir, focusId: id, onDone });
      return def;
    } else if (id === 'galcentre') {
      z = Math.log10(28000); dir = this.viewDir(pos, 40, new THREE.Vector3(-1, 0, -0.3));
    } else if (def.kind === 'arm') {
      z = Math.log10(42000); dir = this.viewDir(pos, 55, pos.clone().sub(GC_POS));
    } else {
      z = Math.log10(def.kind === 'galaxy' ? 60000 : 20000);
      dir = pos.clone().normalize().negate().add(new THREE.Vector3(0, 0.3, 0)).normalize();
    }
    this.crossLinesOn = false;
    if (def.kind === 'region' || def.kind === 'arm' || def.kind === 'galaxy') z += this.portraitZ;
    this.flyTo({ target: pos, z, dir, focusId: id, onDone });
    return def;
  }

  // ---------- each frame ----------
  update(dt) {
    if (!this.active) return;
    if (this.flight) {
      this.updateFlight(dt);
      if (!this.active) return; // that flight just took us home to the planets
    } else {
      // when looking at the Sun, the closest you can get hands back to the planets; and the limit
      // never yanks the camera outwards (e.g. right after arriving from the planets)
      const d0 = this.camera.position.distanceTo(this.controls.target);
      const base = this.focusId === 'sun' ? SUN_MIN_D : GC_FOCUS.has(this.focusId) ? BH_MIN_D : 0.4;
      this.controls.minDistance = Math.min(base, d0);
      const zPrev = this.zPrev ?? Math.log10(d0);
      this.controls.update();
      const z = Math.log10(this.camera.position.distanceTo(this.controls.target));
      // zooming right out slides what we orbit towards the middle of the galaxy; zooming back in
      // slides it home again. Done in small steps as the zoom changes, so it never jumps.
      if (this.slides) {
        const s0 = slideK(zPrev), s1 = slideK(z);
        let f = 0, goal = null;
        if (s1 > s0 + 1e-7) { f = (s1 - s0) / (1 - s0 + 1e-6); goal = GC_POS; }
        else if (s1 < s0 - 1e-7) { f = (s0 - s1) / (s0 + 1e-6); goal = this.focusPos; }
        if (goal) {
          const delta = _v2.copy(goal).sub(this.controls.target).multiplyScalar(clamp(f, 0, 1));
          this.camera.position.add(delta); this.controls.target.add(delta);
        }
      }
      this.zPrev = z;
      const up = this.upFor(z, this.controls.target, _v1);
      if (up.distanceToSquared(this.camera.up) > 1e-10) {
        this.camera.up.copy(up);
        this.syncControlsUp();
        this.camera.lookAt(this.controls.target);
      }
    }
    // the telescope view turns "north" to the top of the screen, gently
    const ok = this.upOverrideOn ? 1 : 0;
    if (this.upOverride && this.upOverrideK !== ok) {
      this.upOverrideK += (ok - this.upOverrideK) * (1 - Math.exp(-dt * 2.5));
      if (Math.abs(ok - this.upOverrideK) < 1e-3) { this.upOverrideK = ok; if (!ok) this.upOverride = null; }
    }
    this.applyScale(false, dt);
  }

  setUpOverride(v) {
    if (v) { this.upOverride = v.clone(); this.upOverrideOn = true; } else this.upOverrideOn = false;
  }

  get viewDistance() { return this.camera.position.distanceTo(this.controls.target); }

  applyScale(force, dt = 0.016) {
    const cam = this.camera;
    const d = this.viewDistance;
    const z = Math.log10(Math.max(d, 1e-9));
    this.Z = z;
    // clipping planes follow the zoom (nothing here relies on depth testing)
    const near = Math.max(d * 0.002, 1e-7), far = Math.max(d * 80, 6e6);
    if (force || Math.abs(cam.near - near) / near > 0.1 || Math.abs(cam.far - far) / far > 0.1) {
      cam.near = near; cam.far = far; cam.updateProjectionMatrix();
    }
    const H = window.innerHeight;
    const pxPerRad = H / THREE.MathUtils.degToRad(cam.fov);

    // fades between the different scales (the Milky Way photo is the sky seen from home, so it
    // goes by how far we are from the Sun)
    const photoK = 1 - smooth(3.35, 4.05, Math.log10(Math.max(cam.position.length(), 1e-9)));
    this.photo.material.opacity = 0.55 * photoK;
    this.photo.visible = photoK > 0.002;
    this.photo.position.copy(cam.position);
    this.photo.scale.setScalar((near + far) * 0.5);
    const starK = 1 - smooth(3.55, 4.3, z);
    const su = this.stars.material.uniforms;
    su.uFade.value = starK;
    // squeeze the range of brightness a little as we leave, and let the "eye" adjust when far out
    su.uGamma.value = THREE.MathUtils.lerp(1, 0.82, smooth(Z_HANDOFF + 0.3, 1.5, z));
    su.uShift.value = -0.9 * Math.max(0, z - 1.6);
    // stars right around where we're looking stay findable, but only at the nearest-stars scale
    su.uNear.value = d * 0.9 * (1 - smooth(1.6, 2.3, z)) + 1e-4;
    su.uPixelRatio.value = this.pixelRatio;
    this.stars.visible = starK > 0.002;
    const gu = this.glows.material.uniforms;
    gu.uGamma.value = su.uGamma.value; gu.uShift.value = su.uShift.value; gu.uNear.value = su.uNear.value;
    gu.uFade.value = smooth(Z_HANDOFF + 0.6, -0.4, z) * (1 - smooth(3.3, 3.9, z));
    gu.uPixelRatio.value = this.pixelRatio;
    this.glows.visible = gu.uFade.value > 0.002;

    // the galaxy: seen from outside when zoomed out, and all around you near its middle
    const dGC = cam.position.distanceTo(GC_POS);
    const zg = Math.log10(Math.max(dGC, 1e-12));
    const galK = Math.max(smooth(3.4, 4.0, z), 1 - smooth(3.3, 3.9, zg));
    if (galK > 0 && !this.galaxy.ready) this.galaxy.prepare();
    const farK = smooth(6.15, 6.55, zg); // far away the Milky Way becomes a flat picture of itself
    this.galaxy.setFade(galK * (1 - farK));
    this.farK = farK;
    this.galaxy.setPixelRatio(this.pixelRatio);
    this.galaxy.expo.uExpoMix.value = smooth(3.7, 2.5, zg); // inside the bulge: a steady, darker exposure so its stars stand out
    // pictures of nebulae and galaxies, and the galaxies all around
    this.photos.focusId = this.focusId === 'crabpulsar' ? 'crab' : this.focusId;
    this.photos.pulsarFocus = this.focusId === 'crabpulsar';
    this.photos.pixelRatio = this.pixelRatio;
    const boost = 1 + 2.4 * smooth(5.4, 6.8, z); // far out, the "eye" adjusts so faint galaxies show
    this.photos.update(cam, pxPerRad, photoK, dt, boost);
    this.universe.pixelRatio = this.pixelRatio;
    this.universe.update(cam, pxPerRad, z, boost);
    this.galaxy.setFar(this.farK, 2.2 * boost);

    // the middle of the galaxy and its black hole
    if (zg < 1.5 && !this.env && this.active) this.captureEnv();
    this.lens.tick(dt);
    this.lens.enabled = this.active && zg < -0.3 && this.lens.update(cam);
    this.gc.update(dt, cam, dGC, this.pixelRatio, this.lens.enabled);
    const mk = smooth(2.6, 2.1, zg) * (1 - smooth(-2.5, -3.1, zg));
    for (let i = 0; i < 2; i++) {
      const m = i ? this.bhMarkFront : this.bhMark;
      m.material.opacity = 0.85 * mk;
      m.visible = (i === 1) === this.lens.enabled && mk > 0.002;
      m.scale.setScalar((30 / pxPerRad) * dGC);
    }
    const s2 = this.places.s2;
    s2.pos.copy(GC_POS).add(this.gc.s2Pos);
    s2.obj.position.copy(s2.pos);

    // the Sun: starts as the big glow you saw from the planets, ends as a modest star
    const sunD = cam.position.length();
    const zs = Math.log10(Math.max(sunD, 1e-9));
    const shrink = Math.pow(10, -0.55 * Math.max(0, zs - Z_HANDOFF));
    const angA = Math.max(0.0072 * shrink, 0.0034), angB = Math.max(0.0156 * shrink, 0.0058), angC = Math.max(0.0052 * shrink, 0.0018);
    this.sunGlowA.scale.setScalar(angA * sunD);
    this.sunGlowB.scale.setScalar(angB * sunD);
    this.sunCore.scale.setScalar(angC * sunD);
    const sunFade = 1 - smooth(3.7, 4.3, zs);
    this.sunGlowA.material.opacity = sunFade;
    this.sunGlowB.material.opacity = 0.4 * sunFade;
    this.sunCore.material.opacity = sunFade;
    // "you are here" ring once the Sun is just one star among many
    const hereK = smooth(2.4, 3.2, zs);
    this.here.material.opacity = 0.9 * hereK;
    this.here.visible = hereK > 0.002;
    this.here.scale.setScalar((34 / pxPerRad) * sunD);

    const cross = this.crossLinesOn && this.focusId === 'southerncross';
    this.crossLines.material.opacity += ((cross && z < 3.2 ? 0.75 : 0) - this.crossLines.material.opacity) * 0.08;
    this.crossLines.visible = this.crossLines.material.opacity > 0.01;
    // a telephoto lens while standing at home, widening as you move away
    const lens = cross ? THREE.MathUtils.lerp(20, 50, smooth(0.04, 0.35, sunD / Math.max(d, 1))) : 50;
    if (Math.abs(cam.fov - lens) > 0.05) { cam.fov += (lens - cam.fov) * (1 - Math.exp(-dt * 3.5)); cam.updateProjectionMatrix(); }
  }

  // ---------- names on screen ----------
  updateLabels(names) {
    const cam = this.camera;
    const W = innerWidth, H = innerHeight;
    const d = this.viewDistance;
    const cands = [];
    const v = new THREE.Vector3();
    for (const id in this.places) {
      const p = this.places[id];
      const [lo, hi] = p.def.range;
      // things at the very middle of the galaxy go by how far away they really are
      const dd = GC_FOCUS.has(id) && id !== 'galcentre' ? p.pos.distanceTo(cam.position) : d;
      let show = names && dd >= lo && dd <= hi && !(this.flight && this.flight.t < 0.85);
      if (show && id === this.cardFor && id !== 's2') show = false; // the card already says what it is (but S2 moves: keep its name on it)
      if (show) {
        v.copy(p.pos).project(cam);
        if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) show = false;
        else cands.push({ p, x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, pri: p.def.pri ?? 5, dist: p.pos.distanceTo(cam.position) });
      }
      if (!show) p.el.classList.add('hidden');
    }
    if (this.places.sun) {
      const txt = this.Z > 3 ? 'You are here' : 'Sun';
      if (this.places.sun.el.textContent !== txt) { this.places.sun.el.textContent = txt; this.places.sun.w = txt.length * 8.5 + 20; }
      this.places.sun.def.range[1] = this.Z > 3 ? 1e6 : 9000;
    }
    cands.sort((a, b) => a.pri - b.pri || a.dist - b.dist);
    const placed = this.blocked.slice();
    let shown = 0;
    for (const c of cands) {
      const r = { x0: c.x - c.p.w / 2, x1: c.x + c.p.w / 2, y0: c.y - 30, y1: c.y + 4 };
      const hit = shown >= 14 || r.x0 < 4 || r.x1 > W - 4 || placed.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0);
      c.p.el.classList.toggle('hidden', hit);
      if (!hit) { placed.push(r); shown++; }
    }
  }

  // Tap on the picture: the nearest named thing within reach of a finger
  pickAt(x, y) {
    let best = null, bestD = 44;
    const v = new THREE.Vector3();
    for (const id in this.places) {
      const p = this.places[id];
      if (p.el.classList.contains('hidden') && id !== 'sun') continue;
      v.copy(p.pos).project(this.camera);
      if (v.z > 1 || v.z < -1) continue;
      const px = (v.x * 0.5 + 0.5) * innerWidth, py = (-v.y * 0.5 + 0.5) * innerHeight;
      const dd = Math.hypot(px - x, py - y);
      if (dd < bestD) { bestD = dd; best = id; }
    }
    return best;
  }

  // the galaxy is drawn into its own small picture first
  renderVolume(width, height, dpr) { this.galaxy.render(this.camera, width, height, dpr); }

  // how far along the ladder we are (0 = planets, 1 = nearest stars, ...), for the indicator
  ladderPos() {
    const zs = RUNG_Z;
    const z = this.Z;
    // diving into the middle of the galaxy is still "the Milky Way"
    if (GC_FOCUS.has(this.focusId) && z < MW_Z) return MW_RUNG;
    if (z <= zs[0]) return clamp(1 - (zs[0] - z) / (zs[0] - Z_HANDOFF), 0, 1);
    for (let i = 0; i < zs.length - 1; i++) if (z <= zs[i + 1]) return 1 + i + (z - zs[i]) / (zs[i + 1] - zs[i]);
    return zs.length;
  }
}

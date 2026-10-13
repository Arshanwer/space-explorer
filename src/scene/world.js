import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { BODIES, SUN_RADIUS, kidRadius, kidDistance } from '../data/bodies.js';
import {
  makeSun, makeEarthMaterial, makeAtmosphere, makeRings, makeRockyMaterial,
  loadRockModel, loadGLTF, normaliseModel, sphereGeo,
} from './bodies3d.js';
import { loadTex, swapHD } from './textures.js';
import { makeBelt, makeDustRing, makeRockField } from './belt.js';

const DAY_MS = 86400000;
const J2000 = Date.UTC(2000, 0, 1, 12);
const SPHERE = sphereGeo();
const SPHERE_LOW = sphereGeo(0, Math.PI * 2, 48, 32);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const CRAFT_SIZE = { iss: 0.07, hubble: 0.035 };
const NEAR_EARTH = new Set(['earth', 'moon', 'iss', 'hubble']);

export class Body {
  constructor(def) {
    this.def = def;
    this.group = new THREE.Group();
    this.group.name = def.id;
    this.tilt = new THREE.Group();
    this.spin = new THREE.Group();
    this.group.add(this.tilt);
    this.tilt.add(this.spin);
    this.tilt.rotation.z = THREE.MathUtils.degToRad(def.tilt || 0);
    this.radius = 1;
    this.targetRadius = 1;
    this.pickables = [];
    this.extras = []; // things hidden while the planet is opened up
    this.spinAngle = Math.random() * Math.PI * 2;
  }
  setRadius(r) {
    this.radius = r;
    this.tilt.scale.setScalar(r);
    if (this.label) this.label.position.set(0, r * 1.12 + 0.12, 0);
  }
  surfaceVisible(v) { if (this.mesh) this.mesh.visible = v; this.extras.forEach((e) => (e.visible = v)); }
  worldPos(out = new THREE.Vector3()) { return this.group.getWorldPosition(out); }
}

function disposeTree(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      if (!m) return;
      for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose();
      m.dispose();
    });
  });
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.sunPos = new THREE.Vector3(0, 0, 0);
    this.bodies = {};
    this.list = [];
    this.realSizes = false;
    this.simDays = (Date.now() - J2000) / DAY_MS; // planets start where they really are today
    this.orbitLines = new THREE.Group();
    this.root.add(this.orbitLines);
    this.orbitOpacity = 1;

    this.light = new THREE.PointLight(0xfff4e6, 3.2, 0, 0);
    this.root.add(this.light);
    this.ambient = new THREE.AmbientLight(0x8899bb, 0.14);
    this.root.add(this.ambient);

    for (const def of BODIES) this.add(def);
    this.belt = makeBelt();
    this.root.add(this.belt);
    this.dust = makeDustRing();
    this.root.add(this.dust);
    this.rockField = makeRockField();
    this.rockField.visible = false;
    this.root.add(this.rockField);
    this.orbitScale = 1;
  }

  add(def) {
    const b = new Body(def);
    this.bodies[def.id] = b;
    this.list.push(b);
    const parent = def.parent ? this.bodies[def.parent].group : this.root;
    parent.add(b.group);

    if (def.kind === 'star') {
      def.textureUrl = 'tex/sd/sun.jpg';
      const s = makeSun(def);
      b.group.remove(b.tilt); b.group.add(s.group);
      b.tilt = s.tilt; b.spin = s.spin; b.mesh = s.mesh; b.material = s.material;
      b.extras.push(...s.glows);
      b.pickables.push(s.mesh);
    } else if (def.id === 'earth') {
      b.material = makeEarthMaterial(def, this.sunPos);
      b.mesh = new THREE.Mesh(SPHERE, b.material);
      b.spin.add(b.mesh);
      b.clouds = new THREE.Mesh(SPHERE, new THREE.MeshStandardMaterial({
        color: 0xffffff, alphaMap: loadTex(def.clouds.sd, { srgb: false }), transparent: true, depthWrite: false, roughness: 1, metalness: 0,
      }));
      b.clouds.scale.setScalar(1.008);
      b.spin.add(b.clouds);
      b.extras.push(b.clouds);
      b.atmo = makeAtmosphere(def.atmosphere, this.sunPos, 0.035, 0.9);
      b.tilt.add(b.atmo); b.extras.push(b.atmo);
      b.pickables.push(b.mesh);
    } else if (def.model) {
      // Simple rock until the real NASA shape has loaded
      const ph = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshStandardMaterial({ color: def.color, roughness: 1 }));
      b.spin.add(ph); b.mesh = ph; b.pickables.push(ph);
      loadRockModel(def.model, def.color).then((holder) => {
        if (!holder) return;
        b.spin.remove(ph);
        b.spin.add(holder);
        b.mesh = holder;
        b.pickables = [];
        holder.traverse((o) => { if (o.isMesh) { o.userData.bodyId = def.id; b.pickables.push(o); } });
        this.pickDirty = true;
      });
    } else if (def.kind === 'craft') {
      this.loadCraft(b);
    } else {
      b.material = makeRockyMaterial(def);
      b.mesh = new THREE.Mesh(SPHERE, b.material);
      b.spin.add(b.mesh);
      b.pickables.push(b.mesh);
      if (def.atmosphere) {
        const giant = def.radiusEarths > 3;
        const thick = giant ? 0.022 : def.id === 'venus' || def.id === 'titan' ? 0.05 : 0.025;
        const strength = giant ? 0.32 : def.id === 'mars' ? 0.45 : 0.75;
        b.atmo = makeAtmosphere(def.atmosphere, this.sunPos, thick, strength);
        b.tilt.add(b.atmo); b.extras.push(b.atmo);
      }
      if (def.rings) {
        b.rings = makeRings(this.sunPos);
        b.tilt.add(b.rings); b.extras.push(b.rings);
      }
    }
    b.pickables.forEach((m) => (m.userData.bodyId = def.id));
    this.applyRadius(b, true);

    // The road each planet travels on
    if (def.au && def.kind !== 'star' && def.kind !== 'asteroid') {
      const r = kidDistance(def.au);
      const pts = [];
      for (let i = 0; i <= 360; i++) { const a = (i / 360) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, -Math.sin(a) * r)); }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x7fa6ff, transparent: true, opacity: 0.22, depthWrite: false }));
      line.userData.base = 0.22;
      this.orbitLines.add(line);
    }
  }

  loadCraft(b) {
    const def = b.def;
    // Invisible tap target so a tiny spacecraft is still easy to hit
    const hit = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.scale.setScalar(1.6);
    b.spin.add(hit);
    b.pickables.push(hit);
    const url = def.id === 'iss' ? 'models/iss_lite.glb' : 'models/hubble.glb';
    loadGLTF(url, (gltf) => {
      const holder = normaliseModel(gltf.scene);
      gltf.scene.traverse((o) => { if (o.isMesh && o.material) o.material.side = THREE.DoubleSide; });
      b.spin.add(holder);
      b.model = holder; b.liteModel = holder;
    });
  }

  // NASA's detailed Space Station only loads when someone goes to look at it, and is put away afterwards.
  setISSDetail(on) {
    const b = this.bodies.iss;
    if (on) {
      if (b.hdModel || b.hdLoading) return;
      b.hdLoading = true;
      // NASA's detailed station comes in two halves (each file stays small enough for any host)
      const parts = ['models/iss_0.glb', 'models/iss_1.glb'].map((url) => new Promise((res, rej) => loadGLTF(url, res, rej)));
      Promise.all(parts).then((gltfs) => {
        b.hdLoading = false;
        const whole = new THREE.Group();
        gltfs.forEach((g) => whole.add(g.scene));
        if (!this.wantISSDetail) { disposeTree(whole); return; }
        const holder = normaliseModel(whole);
        if (b.liteModel) b.liteModel.visible = false;
        b.spin.add(holder);
        b.hdModel = holder; b.model = holder;
      }).catch(() => { b.hdLoading = false; });
    } else if (b.hdModel) {
      b.spin.remove(b.hdModel);
      disposeTree(b.hdModel);
      b.hdModel = null;
      if (b.liteModel) { b.liteModel.visible = true; b.model = b.liteModel; }
    }
  }

  radiusFor(def, real) {
    if (def.kind === 'star') return SUN_RADIUS;
    if (def.kind === 'craft') return CRAFT_SIZE[def.id];
    if (real) return Math.max(def.radiusEarths, def.kind === 'asteroid' || def.kind === 'moon' ? 0.02 : 0.05);
    return Math.max(kidRadius(def.radiusEarths), def.minKidRadius || 0);
  }

  applyRadius(b, immediate) {
    b.targetRadius = this.radiusFor(b.def, this.realSizes);
    if (immediate) b.setRadius(b.targetRadius);
  }

  setRealSizes(on) { this.realSizes = on; this.list.forEach((b) => this.applyRadius(b, false)); }

  // Only the thing you're looking at gets the sharp 4K maps.
  setHD(id) {
    this.wantISSDetail = NEAR_EARTH.has(id) && id !== 'moon';
    this.setISSDetail(id === 'iss' || (this.bodies.iss.hdModel && this.wantISSDetail));
    if (this.hdId === id) return;
    if (this.hdHandle) { this.hdHandle.restore(); this.hdHandle = null; }
    this.hdId = id;
    const b = this.bodies[id];
    if (!b || !b.material) return;
    const d = b.def;
    const slots = [];
    if (id === 'earth') {
      const u = b.material.uniforms;
      slots.push({ target: u.dayMap, key: 'value', url: d.texture.hd, srgb: true });
      slots.push({ target: u.nightMap, key: 'value', url: d.night.hd, srgb: true });
      slots.push({ target: u.cloudMap, key: 'value', url: d.clouds.hd, srgb: false });
      slots.push({ target: u.normalMap, key: 'value', url: d.normal.hd, srgb: false });
      slots.push({ target: b.clouds.material, key: 'alphaMap', url: d.clouds.hd, srgb: false });
    } else if (b.material.isMeshStandardMaterial) {
      if (d.texture?.hd) slots.push({ target: b.material, key: 'map', url: d.texture.hd, srgb: true });
      if (d.normal?.hd) slots.push({ target: b.material, key: 'normalMap', url: d.normal.hd, srgb: false });
    }
    if (slots.length) this.hdHandle = swapHD(slots);
  }

  setOrbitFade(k) { this.orbitOpacity = k; }

  // things that depend on where the camera is: detail levels, hiding what's too small to see
  updateView(camera) {
    const d = camera.position.length();
    this.dust.material.uniforms.opacity.value = THREE.MathUtils.clamp((d - 140) / 380, 0, 0.55);
    const ring = Math.hypot(Math.hypot(camera.position.x, camera.position.z) - kidDistance(2.7), camera.position.y);
    this.belt.visible = ring < 75;
    const k = 1 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const p = new THREE.Vector3();
    for (const b of this.list) {
      if (b.def.kind === 'star') continue;
      const screenR = (b.radius / Math.max(1e-6, b.worldPos(p).distanceTo(camera.position))) * k;
      b.spin.visible = screenR > 0.0015; // smaller than a pixel: skip drawing it
      if (b.mesh && b.mesh.geometry && (b.mesh.geometry === SPHERE || b.mesh.geometry === SPHERE_LOW)) {
        const g = screenR > 0.06 ? SPHERE : SPHERE_LOW;
        if (b.mesh.geometry !== g) { b.mesh.geometry = g; if (b.clouds) b.clouds.geometry = g; }
      }
      if (b.atmo) b.atmo.visible = b.spin.visible && b.mesh?.visible !== false;
    }
  }

  spinRate(b, speed) {
    const d = b.def;
    if (!d.dayHours) return 0;
    const motion = speed > 0 ? Math.min(1, speed / 3) : 0;
    const visualPeriod = THREE.MathUtils.clamp(Math.abs(d.dayHours) / 24 * 30, 24, 240);
    return Math.sign(d.dayHours) * (2 * Math.PI / visualPeriod) * motion;
  }

  // Turn a world so a favourite spot (the heart on Pluto, New Zealand on Earth) faces the camera when we arrive
  faceTowards(b, worldDir, speed, inSeconds) {
    const u = b.def?.faceU;
    if (u === undefined || !b.tilt) return;
    const c = b.worldPos(new THREE.Vector3());
    const p = b.tilt.worldToLocal(c.add(worldDir));
    const phi = u * Math.PI * 2;
    const target = Math.atan2(-p.z, p.x);
    const source = Math.atan2(-Math.sin(phi), -Math.cos(phi));
    b.spinAngle = target - source - this.spinRate(b, speed) * inSeconds;
    b.spin.rotation.y = b.spinAngle;
  }

  update(dt, speed, t) {
    const daysPerSec = speed;
    const motion = daysPerSec > 0 ? Math.min(1, daysPerSec / 3) : 0;
    this.simDays += dt * daysPerSec * this.orbitScale;
    const tmp = new THREE.Vector3();
    for (const b of this.list) {
      const d = b.def;
      if (Math.abs(b.radius - b.targetRadius) > 1e-4) b.setRadius(THREE.MathUtils.lerp(b.radius, b.targetRadius, 1 - Math.pow(0.02, dt)));
      if (d.au) {
        const L = THREE.MathUtils.degToRad(d.L0 + (360 / d.periodDays) * this.simDays);
        const r = kidDistance(d.au);
        b.group.position.set(Math.cos(L) * r, d.kind === 'asteroid' ? Math.sin(L * 3 + d.L0) * 1.2 : 0, -Math.sin(L) * r);
      } else if (d.parent) {
        const parent = this.bodies[d.parent];
        if (b.orbitAngle === undefined) b.orbitAngle = Math.random() * Math.PI * 2;
        // fast moons are slowed down so you can still watch them go round
        const minPeriodSec = d.kind === 'craft' ? 45 : 14;
        const w = Math.sign(d.periodDays) * Math.min((2 * Math.PI / Math.abs(d.periodDays)) * daysPerSec, (2 * Math.PI / minPeriodSec) * motion);
        b.orbitAngle += w * dt * this.orbitScale;
        const dist = parent.radius * d.orbitR + (d.kind === 'craft' ? 0 : b.radius);
        const incl = d.kind === 'craft' ? (d.id === 'iss' ? 0.9 : -0.5) : 0.08;
        tmp.set(Math.cos(b.orbitAngle) * dist, 0, -Math.sin(b.orbitAngle) * dist).applyAxisAngle(X_AXIS, incl);
        b.group.position.copy(tmp);
        if (d.kind === 'craft') b.group.lookAt(parent.worldPos());
      }
      if (d.dayHours) {
        b.spinAngle += this.spinRate(b, daysPerSec) * dt;
        b.spin.rotation.y = b.spinAngle;
      } else if (d.kind === 'moon') {
        b.spin.rotation.y = b.orbitAngle + Math.PI; // the same side always faces its planet
      }
    }
    const e = this.bodies.earth;
    e.clouds.rotation.y += dt * 0.004 * motion;
    e.material.uniforms.cloudShift.value = -e.clouds.rotation.y / (Math.PI * 2);
    this.belt.rotation.y += dt * daysPerSec * this.orbitScale * (2 * Math.PI / 1680);
    this.rockField.rotation.y += dt * 0.02 * motion;
    this.bodies.sun.material.uniforms.time.value = t;
    for (const b of this.list) {
      if (!b.atmo && !b.rings) continue;
      const c = b.worldPos(tmp);
      if (b.atmo) { const u = b.atmo.material.uniforms; u.center.value.copy(c); u.planetR.value = b.radius; u.atmoR.value = b.radius * (1 + b.atmo.userData.thickness); }
      if (b.rings) { const u = b.rings.material.uniforms; u.center.value.copy(c); u.planetR.value = b.radius; }
    }
    // fade the orbit roads in and out smoothly
    for (const l of this.orbitLines.children) {
      const target = l.userData.base * this.orbitOpacity;
      l.material.opacity += (target - l.material.opacity) * Math.min(1, dt * 3);
    }
  }

  getPickables() {
    if (!this._pick || this.pickDirty) { this._pick = this.list.flatMap((b) => b.pickables); this.pickDirty = false; }
    return this._pick;
  }

  // Names floating next to things
  makeLabels(onTap) {
    for (const b of this.list) {
      const el = document.createElement('button');
      el.className = 'label-btn hidden' + (['moon', 'asteroid', 'craft'].includes(b.def.kind) ? ' small' : '');
      el.textContent = b.def.kind === 'star' ? 'Sun' : b.def.name.replace(/^The /, '');
      if (b.def.kind === 'craft') el.style.color = '#ffc93c';
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('click', (e) => { e.stopPropagation(); onTap(b.def.id); });
      const obj = new CSS2DObject(el);
      obj.center.set(0.5, 1);
      b.group.add(obj);
      b.label = obj; b.labelEl = el;
      b.labelW = el.textContent.length * 8.5 + 20;
      b.setRadius(b.radius);
    }
  }
}

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import starData from '../data/stars.json';
import SKY from '../data/skyLines.json';
import { bvToColor } from './stars.js';
import { loadTex, glowTexture } from './textures.js';
import { PHOTO_TO_EQ } from '../deep/frames.js';
import { julianDate, skyMatrix, sunEq, moonEq, planetEq, eqVector } from './ephemeris.js';

// Tonight's sky from home: standing in Newlands, Wellington, looking up.
//
// Everything on the sky lives in one group in J2000 equatorial coordinates (stars, the Milky Way
// photo, star-pattern lines, and the Sun, Moon and planets placed for the chosen moment). That
// group is turned each frame by the "sky matrix" for the time and place, so the sky wheels round
// the south celestial pole exactly as it does over Wellington. Below the horizon is the ground,
// with a line of hills. The local frame: x = east, y = up, z = south.

export const HOME = { name: 'Newlands, Wellington', lat: -41.22, lon: 174.81 };
const R = 1000; // radius of the sky
const D2R = Math.PI / 180;
const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const PLANETS = [
  { id: 'mercury', name: 'Mercury', color: '#d9cbb8', mag: 0.0 },
  { id: 'venus', name: 'Venus', color: '#fff3d6', mag: -4.2 },
  { id: 'mars', name: 'Mars', color: '#ff9a6a', mag: 0.5 },
  { id: 'jupiter', name: 'Jupiter', color: '#ffe9c4', mag: -2.4 },
  { id: 'saturn', name: 'Saturn', color: '#ffe1a6', mag: 0.6 },
  { id: 'uranus', name: 'Uranus', color: '#c9f2ff', mag: 5.7 },
  { id: 'neptune', name: 'Neptune', color: '#9cb8ff', mag: 7.8 },
];
// Maori names for planets and a few things (Stellarium's Maori sky culture; Te Ara)
export const MAORI = { venus: 'Kōpū', mars: 'Matawhero', jupiter: 'Pareārau', saturn: 'Pareārau', mercury: 'Whiro', moon: 'Marama', sun: 'Rā', matariki: 'Matariki', cross: 'Māhutonga' };

const SKY_VERT = 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const SKY_FRAG = /* glsl */ `
  uniform vec3 uSun; uniform float uSunAlt;
  varying vec3 vDir;
  void main(){
    vec3 d = normalize(vDir);
    float up = clamp(d.y, 0.0, 1.0);
    float day = smoothstep(-7.0, 5.0, uSunAlt);
    float twi = smoothstep(-18.0, -5.0, uSunAlt) * (1.0 - smoothstep(-3.0, 9.0, uSunAlt));
    vec3 dayC = mix(vec3(0.52, 0.68, 0.9), vec3(0.12, 0.32, 0.75), pow(up, 0.55));
    vec3 nightC = mix(vec3(0.014, 0.02, 0.04), vec3(0.002, 0.004, 0.011), pow(up, 0.45));
    float toSun = max(dot(d, uSun), 0.0);
    // sunrise and sunset colours, strongest low down near the Sun
    vec3 twiC = mix(vec3(0.03, 0.05, 0.14), vec3(1.0, 0.42, 0.12), pow(toSun, 2.5) * pow(1.0 - up, 3.0));
    vec3 c = mix(nightC, dayC, day) + twiC * twi * 0.75;
    c += vec3(1.0, 0.92, 0.75) * (pow(toSun, 300.0) * 3.0 + pow(toSun, 12.0) * 0.25) * smoothstep(-2.0, 2.0, uSunAlt);
    // the glow of the city lights, low in the south
    float city = pow(max(dot(normalize(vec3(d.x, 0.0, d.z) + 1e-5), normalize(vec3(-0.15, 0.0, 1.0))), 0.0), 6.0) * pow(1.0 - up, 6.0);
    c += vec3(0.09, 0.05, 0.025) * city * (1.0 - day);
    gl_FragColor = vec4(c, 1.0);
  }`;

const STAR_VERT = /* glsl */ `
  attribute float size; attribute vec3 color;
  uniform float uPixelRatio, uNight, uTwinkle, uZoom;
  varying vec3 vC;
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    float h = normalize(wp.xyz).y;
    float ext = 0.3 + 0.7 * smoothstep(0.0, 0.3, h);              // dimmer near the horizon
    float tw = 0.82 + 0.18 * sin(uTwinkle * (1.0 + fract(position.x * 0.137)) + position.y * 0.05);
    vC = color * uNight * ext * mix(1.0, tw, 1.0 - smoothstep(0.2, 0.7, h));
    gl_Position = projectionMatrix * viewMatrix * wp;
    gl_PointSize = size * uPixelRatio * uZoom;
    if (h < -0.02 || uNight < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }`;
const STAR_FRAG = /* glsl */ `
  varying vec3 vC;
  void main(){ float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, r); a *= a; gl_FragColor = vec4(vC * a * 1.5, 1.0); }`;

// change a name only when it really changes (writing text makes the browser redo its layout)
const setText = (el, t) => { if (el.textContent !== t) el.textContent = t; };
const _look = new THREE.Vector3();

function label(text, cls) {
  const el = document.createElement('button');
  el.className = `label-btn sky-label ${cls || ''}`;
  el.textContent = text;
  const o = new CSS2DObject(el);
  o.center.set(0.5, -0.3);
  return o;
}

// A soft horizon of hills around Newlands (lower towards the city and harbour in the south)
function hills() {
  const N = 360, alt = [];
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const waves = Array.from({ length: 7 }, (_, k) => [rnd() * Math.PI * 2, 2 + k * 2.3, 1 / (1 + k * 0.9)]);
  for (let i = 0; i <= N; i++) {
    const az = (i / N) * Math.PI * 2;
    let h = 0;
    for (const [ph, f, a] of waves) h += Math.sin(az * f + ph) * a;
    const south = Math.max(0, Math.cos(az - Math.PI)); // lower towards the harbour
    alt.push(THREE.MathUtils.clamp(3.2 + 1.6 * h - 2.2 * south, 0.6, 8));
  }
  const rings = [-89, -12, -3];
  const pos = [], col = [], idx = [];
  const rr = R * 0.6;
  for (let i = 0; i <= N; i++) {
    const az = (i / N) * Math.PI * 2;
    const dir = [Math.sin(az), Math.cos(az)]; // (east, north)
    for (const [j, a] of [...rings, alt[i]].entries()) {
      const ar = a * D2R;
      pos.push(dir[0] * Math.cos(ar) * rr, Math.sin(ar) * rr, -dir[1] * Math.cos(ar) * rr);
      const top = j === 3 ? 1 : 0;
      col.push(0.6 + 0.4 * top, 0.6 + 0.4 * top, 0.6 + 0.4 * top);
    }
  }
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < 3; j++) {
      const a = i * 4 + j, b = (i + 1) * 4 + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return { geo: g, alt };
}

export class HomeSky {
  constructor({ camera, touch, onPick }) {
    this.camera = camera;
    this.touch = touch;
    this.onPick = onPick;
    this.scene = new THREE.Scene();
    this.date = new Date();
    this.speed = 0; // sky-seconds per real second while "watching it turn"
    this.yaw = Math.PI; this.pitch = 0.45; this.fov = 70; // start looking south, a little up
    this.pixelRatio = 1;
    this.showLines = true;
    this.maori = false;
    this.labels = [];

    // the sky's colour
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(R * 1.2, 48, 24), new THREE.ShaderMaterial({
      uniforms: { uSun: { value: new THREE.Vector3(0, -1, 0) }, uSunAlt: { value: -30 } },
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false,
    }));
    this.dome.renderOrder = -20;
    this.scene.add(this.dome);

    // everything fixed to the stars
    const cel = this.celestial = new THREE.Group();
    cel.matrixAutoUpdate = false;
    this.scene.add(cel);
    this.mw = new THREE.Mesh(new THREE.SphereGeometry(R * 1.05, 64, 32), new THREE.MeshBasicMaterial({ map: loadTex('tex/sd/stars.jpg'), side: THREE.BackSide, depthWrite: false, transparent: true, opacity: 0.8, color: 0xb4c0e0 }));
    this.mw.quaternion.setFromRotationMatrix(PHOTO_TO_EQ);
    this.mw.renderOrder = -10;
    cel.add(this.mw);
    this.buildStars();
    this.buildLines();
    this.buildBodies();
    this.buildNames();

    // the ground and hills
    const h = hills();
    this.hillAlt = h.alt;
    this.groundMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x0a120c, side: THREE.DoubleSide });
    this.ground = new THREE.Mesh(h.geo, this.groundMat);
    this.ground.renderOrder = 5;
    this.scene.add(this.ground);
    this.cityGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,170,90,0.6)', 'rgba(255,120,40,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35 }));
    this.cityGlow.position.set(-0.15, 0.01, 1).normalize().multiplyScalar(R * 0.58);
    this.cityGlow.scale.set(R * 0.5, R * 0.12, 1);
    this.cityGlow.renderOrder = 6;
    this.scene.add(this.cityGlow);
    for (const [t, az, cls] of [['North', 0, 'compass'], ['East', 90, 'compass'], ['South', 180, 'compass'], ['West', 270, 'compass'], ['Wellington city', 172, 'place']]) {
      const o = label(t, cls);
      const a = az * D2R;
      o.position.set(Math.sin(a), 0.004, -Math.cos(a)).multiplyScalar(R * 0.55);
      o.center.set(0.5, 1.4);
      o.element.disabled = true;
      this.scene.add(o);
    }
    this.setTime(new Date());
  }

  buildStars() {
    const n = starData.length / 4;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
    const v = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      eqVector(starData[i * 4], starData[i * 4 + 1], v);
      pos.set([v[0] * R, v[1] * R, v[2] * R], i * 3);
      const mag = starData[i * 4 + 2];
      const c = bvToColor(starData[i * 4 + 3]);
      const b = Math.min(1.6, 0.3 + Math.sqrt(Math.pow(10, -0.4 * (mag - 1.0))) * 0.9);
      col.set([c.r * b, c.g * b, c.b * b], i * 3);
      size[i] = THREE.MathUtils.clamp(5.6 - mag * 0.68, 1.3, 7.5);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    this.starMat = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: 1 }, uNight: { value: 1 }, uTwinkle: { value: 0 }, uZoom: { value: 1 } },
      vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.stars = new THREE.Points(g, this.starMat);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -5;
    this.celestial.add(this.stars);
  }

  buildLines() {
    const mk = (list, color, opacity) => {
      const pts = [];
      const a = [0, 0, 0], b = [0, 0, 0];
      for (const c of list) for (const l of c.l) for (let k = 0; k + 3 < l.length; k += 2) {
        eqVector(l[k], l[k + 1], a); eqVector(l[k + 2], l[k + 3], b);
        pts.push(a[0] * R * 0.99, a[1] * R * 0.99, a[2] * R * 0.99, b[0] * R * 0.99, b[1] * R * 0.99, b[2] * R * 0.99);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
      const ls = new THREE.LineSegments(g, m);
      ls.renderOrder = -4;
      ls.frustumCulled = false;
      this.celestial.add(ls);
      return ls;
    };
    this.linesModern = mk(SKY.modern, 0x6f9bff, 0.45);
    this.linesMaori = mk(SKY.maori, 0xffb36b, 0.7);
  }

  buildBodies() {
    this.bodies = {};
    for (const p of PLANETS) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), color: p.color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      const k = THREE.MathUtils.clamp(1.6 - p.mag * 0.22, 0.3, 2.4);
      s.scale.setScalar(R * 0.012 * k);
      s.renderOrder = -3;
      this.celestial.add(s);
      const lab = label(p.name, 'planet');
      lab.element.dataset.pick = p.id;
      s.add(lab);
      this.bodies[p.id] = { sprite: s, lab, def: p };
    }
    // the Sun
    this.sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,250,235,1)', 'rgba(255,190,90,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.sun.scale.setScalar(R * 0.07);
    this.sun.renderOrder = -3;
    this.celestial.add(this.sun);
    this.sunLab = label('Sun', 'planet');
    this.sunLab.element.dataset.pick = 'sun';
    this.sun.add(this.sunLab);
    // the Moon: a real ball lit from the Sun's direction, so its phase is right
    this.moonMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: loadTex('tex/sd/moon.jpg') }, uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uK: { value: 1 } },
      vertexShader: 'varying vec2 vUv; varying vec3 vN; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D map; uniform vec3 uSunDir; uniform float uK; varying vec2 vUv; varying vec3 vN; void main(){ float l = smoothstep(-0.05, 0.12, dot(normalize(vN), uSunDir)); vec3 c = texture2D(map, vUv).rgb; gl_FragColor = vec4(c * (0.012 + 1.7 * l) * uK, 1.0); }',
      // added on top of the sky, so the dark part of the Moon is see-through like the real one
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const mg = new THREE.SphereGeometry(1, 48, 24);
    mg.rotateY(-Math.PI / 2); // the side of the Moon we always see faces +z, which lookAt points at us
    this.moon = new THREE.Mesh(mg, this.moonMat);
    this.moon.scale.setScalar(R * 0.0045 * 4); // drawn 4 times its real size so you can see its shape
    this.moon.renderOrder = -2;
    this.scene.add(this.moon); // placed in the local frame each frame (it's close, so it shifts a little)
    this.moonLab = label('Moon', 'planet');
    this.moonLab.element.dataset.pick = 'moon';
    this.moon.add(this.moonLab);
  }

  buildNames() {
    const v = [0, 0, 0];
    const add = (text, ra, dec, cls, pick, extra) => {
      const o = label(text, cls);
      eqVector(ra, dec, v);
      o.position.set(v[0] * R * 0.98, v[1] * R * 0.98, v[2] * R * 0.98);
      if (pick) o.element.dataset.pick = pick;
      this.celestial.add(o);
      this.labels.push({ o, kind: cls, ...extra });
      return o;
    };
    const rename = { 'Rigil Kentaurus': 'Alpha Centauri' };
    const skip = new Set(['Toliman', 'Alsephina', 'Tiaki']);
    for (const s of SKY.stars) {
      if (skip.has(s.n)) continue;
      const n = rename[s.n] || s.n;
      const m = s.m;
      add(n, s.ra, s.dec, 'star', `star:${n}`, { en: n, mi: m ? `${m}` : null, mag: s.mag });
    }
    // the patterns children are most likely to hear about get their names shown all the time; the rest when zoomed in
    const KNOWN = new Set(['Ori', 'Sco', 'Cru', 'Cen', 'Car', 'CMa', 'Gem', 'Tau', 'Leo', 'Sgr', 'Cyg', 'Aql', 'Lyr', 'Crv', 'Cet', 'Psc', 'Ari', 'Cnc', 'Vir', 'Lib', 'Cap', 'Aqr', 'Pav', 'Tuc', 'Phe', 'UMa', 'Peg', 'And', 'Vel', 'Gru', 'Hya', 'Lup']);
    for (const c of SKY.modern) add(c.n, c.c[0], c.c[1], 'pattern', `pattern:${c.id}`, { en: c.n, mi: c.id === 'Cru' ? 'Māhutonga' : null, lines: 'modern', minor: !KNOWN.has(c.id) });
    for (const c of SKY.maori) add(c.n, c.c[0], c.c[1], 'pattern maori', `maori:${c.id}`, { en: c.n, mi: c.n, lines: 'maori', maoriOnly: true });
    add('Matariki', 56.75, 24.12, 'pattern', 'matariki', { en: 'Matariki (the Pleiades)', mi: 'Matariki' });
    add('Large Magellanic Cloud', 80.89, -69.76, 'pattern', 'lmc', { en: 'Large Magellanic Cloud', mi: null });
    add('Small Magellanic Cloud', 13.19, -72.83, 'pattern', 'smc', { en: 'Small Magellanic Cloud', mi: null });
  }

  // ---------- time ----------
  setTime(date) {
    this.date = new Date(date.getTime());
    this.place();
  }
  // Put the sky where it is at this moment
  place() {
    const jd = julianDate(this.date);
    const m = skyMatrix(jd, HOME.lat, HOME.lon);
    this.m = m;
    this.celestial.matrix.set(m[0][0], m[0][1], m[0][2], 0, m[1][0], m[1][1], m[1][2], 0, m[2][0], m[2][1], m[2][2], 0, 0, 0, 0, 1);
    this.celestial.matrixWorldNeedsUpdate = true;
    const toSky = (v) => new THREE.Vector3(m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]);
    const v = [0, 0, 0];
    for (const p of PLANETS) {
      const q = planetEq(p.id, jd);
      eqVector(q.ra, q.dec, v);
      this.bodies[p.id].sprite.position.set(v[0], v[1], v[2]).multiplyScalar(R * 0.97);
      this.bodies[p.id].alt = Math.asin(toSky(v).y) / D2R;
    }
    const s = sunEq(jd);
    eqVector(s.ra, s.dec, v);
    this.sun.position.set(v[0], v[1], v[2]).multiplyScalar(R * 0.97);
    const sunSky = toSky(v);
    this.sunAlt = Math.asin(sunSky.y) / D2R;
    this.dome.material.uniforms.uSun.value.copy(sunSky);
    this.dome.material.uniforms.uSunAlt.value = this.sunAlt;
    // the Moon, seen from the ground rather than from the Earth's middle
    const mo = moonEq(jd);
    eqVector(mo.ra, mo.dec, v);
    const ms = toSky(v).multiplyScalar(mo.distEarthRadii);
    ms.y -= 1;
    ms.normalize();
    this.moon.position.copy(ms).multiplyScalar(R * 0.9);
    this.moonAlt = Math.asin(ms.y) / D2R;
    this.moonMat.uniforms.uSunDir.value.copy(sunSky).sub(ms.clone().multiplyScalar(0.0026)).normalize();
    this.moonInfo = mo;
    this.moon.lookAt(0, 0, 0);
  }
  get isDay() { return this.sunAlt > -4; }
  // how high the Sun is (degrees) at another moment
  sunAltAt(date) {
    const jd = julianDate(date);
    const m = skyMatrix(jd, HOME.lat, HOME.lon);
    const s = sunEq(jd), v = eqVector(s.ra, s.dec);
    return Math.asin(m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2]) / D2R;
  }
  // is something above the horizon right now? (for labels and challenges)
  altitudeOf(id) {
    if (id === 'moon') return this.moonAlt;
    if (id === 'sun') return this.sunAlt;
    return this.bodies[id]?.alt ?? -90;
  }
  // which way the camera looks: azimuth (0 = north, 90 = east) and altitude, in degrees
  get facing() { return { az: ((this.yaw * 180) / Math.PI + 360) % 360, alt: (this.pitch * 180) / Math.PI }; }

  // ---------- looking around ----------
  enter() {
    this.camera.up.set(0, 1, 0);
    this.camera.position.set(0, 0, 0);
    this.camera.near = 0.5; this.camera.far = R * 3;
    this.applyView();
  }
  applyView() {
    const c = this.camera;
    if (this.tiltQ) c.quaternion.copy(this.tiltQ);
    else {
      // yaw 0 = north (-z), turning towards east (+x)
      c.lookAt(_look.set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)));
    }
    if (Math.abs(c.fov - this.fov) > 0.01) { c.fov = this.fov; c.updateProjectionMatrix(); }
  }
  drag(dx, dy) {
    const k = (this.fov * D2R) / innerHeight;
    if (this.tiltQ) { this.tiltYaw = (this.tiltYaw || 0) + dx * k; return; } // nudge the compass
    this.yaw -= dx * k * 1.1;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * k * 1.1, -0.35, Math.PI / 2 - 0.01);
  }
  zoom(f) { this.fov = THREE.MathUtils.clamp(this.fov * f, 18, 95); }
  lookAt(id) {
    let p;
    if (id === 'moon') p = this.moon.position.clone();
    else if (id === 'sun') p = this.sun.getWorldPosition(new THREE.Vector3());
    else if (this.bodies[id]) p = this.bodies[id].sprite.getWorldPosition(new THREE.Vector3());
    else {
      const l = this.labels.find((x) => x.o.element.dataset.pick === id);
      if (l) p = l.o.getWorldPosition(new THREE.Vector3());
    }
    if (!p) return;
    p.normalize();
    this.yaw = Math.atan2(p.x, -p.z);
    this.pitch = THREE.MathUtils.clamp(Math.asin(p.y), -0.35, Math.PI / 2 - 0.01);
  }

  // ---------- each frame ----------
  update(dt, t) {
    if (this.speed) { this.date = new Date(this.date.getTime() + dt * 1000 * this.speed); this.place(); }
    this.applyView();
    const night = 1 - smooth(-12, -2, this.sunAlt);
    const dark = 1 - smooth(-14, -4, this.sunAlt); // 1 once it's properly dark
    this.starMat.uniforms.uNight.value = Math.max(0.02, dark);
    this.starMat.uniforms.uTwinkle.value = t * 2;
    this.starMat.uniforms.uPixelRatio.value = this.pixelRatio;
    this.starMat.uniforms.uZoom.value = THREE.MathUtils.clamp(Math.sqrt(70 / this.fov), 0.8, 1.6);
    this.mw.material.opacity = 0.8 * (1 - smooth(-18, -10, this.sunAlt));
    this.mw.visible = this.mw.material.opacity > 0.01;
    this.linesModern.visible = this.showLines && !this.maori;
    this.linesMaori.visible = this.showLines && this.maori;
    this.linesModern.material.opacity = 0.45 * Math.max(0.35, night);
    this.cityGlow.material.opacity = 0.3 * night;
    const day = smooth(-6, 4, this.sunAlt);
    this.groundMat.color.setRGB(0.04 + 0.15 * day, 0.07 + 0.2 * day, 0.05 + 0.1 * day);
    this.moonMat.uniforms.uK.value = 1;
    for (const p of PLANETS) {
      const b = this.bodies[p.id];
      // the bright planets show in twilight; faint ones only in the dark
      const vis = p.mag < -1 ? Math.max(0.15, 1 - day) : (p.mag < 2 ? 1 - smooth(-10, -3, this.sunAlt) : night);
      b.sprite.material.opacity = vis;
      b.sprite.visible = vis > 0.02;
      b.lab.visible = b.sprite.visible && b.alt > -1 && (p.mag < 5 || this.fov < 40);
      setText(b.lab.element, this.maori && MAORI[p.id] ? `${p.name} · ${MAORI[p.id]}` : p.name);
    }
    this.sun.visible = this.sunAlt > -1;
    this.sunLab.visible = this.sun.visible;
    this.moonLab.visible = this.moonAlt > -1;
    setText(this.moonLab.element, this.maori ? 'Moon · Marama' : 'Moon');
    // star and pattern names: only above the horizon, and pattern names only with the lines on
    const sky = new THREE.Vector3();
    for (const l of this.labels) {
      l.o.getWorldPosition(sky);
      const up = sky.y / sky.length();
      let show = up > 0.02;
      if (l.kind.startsWith('pattern')) show = show && (l.maoriOnly ? this.showLines && this.maori : (l.lines ? this.showLines && !this.maori && (!l.minor || this.fov < 45) : true));
      if (l.kind === 'star') show = show && (night > 0.5) && (l.mag < 1.3 || this.fov < 50 || (this.maori && l.mi));
      l.o.visible = show;
      if (show) setText(l.o.element, this.maori && l.mi ? l.mi : l.en);
    }
  }

  // Tap on the sky: the nearest name within reach of a finger
  pickAt(x, y) {
    let best = null, bestD = 44;
    const v = new THREE.Vector3();
    const check = (o, id) => {
      if (!o.visible || !id) return;
      o.getWorldPosition(v).project(this.camera);
      if (v.z > 1) return;
      const d = Math.hypot((v.x * 0.5 + 0.5) * innerWidth - x, (-v.y * 0.5 + 0.5) * innerHeight - y);
      if (d < bestD) { bestD = d; best = id; }
    };
    for (const p of PLANETS) check(this.bodies[p.id].lab, p.id);
    check(this.moonLab, 'moon'); check(this.sunLab, 'sun');
    for (const l of this.labels) check(l.o, l.o.element.dataset.pick);
    return best;
  }
}

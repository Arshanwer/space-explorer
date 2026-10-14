import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import gsap from 'gsap';

import { BODY, BELT, ISS_SPOTS, kidDistance } from './data/bodies.js';
import { World } from './scene/world.js';
import { makeStars, makeMilkyWay } from './scene/stars.js';
import { Cutaway } from './scene/cutaway.js';
import { loadingManager, setAnisotropy, acquireTex, releaseTex } from './scene/textures.js';
import { FlyControls } from './controls/fly.js';
import { buildDock, buildDeepDock, starOrbStyle, markDock, showCard, showInside, markLayer, showSpot, hideCard, toast, speak, stopSpeaking } from './ui/ui.js';
import { RUNGS, DEEP, DEEP_DOCK, LIGHT_YEAR_FACT } from './data/deep.js';
import { sceneDirToDeep } from './deep/frames.js';

const $ = (s) => document.querySelector(s);
document.body.classList.add('loading');
// ?test makes animations follow the wall clock even when frames are slow (used for automated checks)
const TEST = new URLSearchParams(location.search).has('test');
if (TEST) { gsap.ticker.lagSmoothing(0); document.body.classList.add('test'); }

// ---------------- Renderer ----------------
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const isTouch = matchMedia('(pointer: coarse)').matches;
const MAX_DPR = Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2);
let dpr = MAX_DPR;
renderer.setPixelRatio(dpr);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

const labelRenderer = new CSS2DRenderer({ element: $('#labels') });
labelRenderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 30000);
camera.position.set(0, 1400, 2200);

const sky = new THREE.Group();
const stars = makeStars();
sky.add(makeMilkyWay(), stars);
stars.material.uniforms.pixelRatio.value = dpr;
scene.add(sky);

const world = new World(scene);
world.makeLabels((id) => select(id));

// HDR render target with 4x multisampling so edges stay smooth with the glow effect on
const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: isTouch ? 2 : 4 });
const composer = new EffectComposer(renderer, rt);
// The scene is drawn into renderTarget2 (the composer's starting readBuffer). renderTarget1 is only
// ever written by the black hole's light-bending pass, which needs no edge smoothing.
composer.renderTarget1.samples = 0;
composer.setPixelRatio(dpr);
composer.setSize(innerWidth, innerHeight);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.5, 0.85);
composer.addPass(bloom);
const outputPass = new OutputPass();
outputPass.needsSwap = false; // keep drawing into one buffer so the second big one is never created
composer.addPass(outputPass);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.9;
const HANDOFF_D = 5000; // zoom out past this and you leave the solar system for the stars
controls.maxDistance = HANDOFF_D;

const fly = new FlyControls(camera, renderer.domElement, $('#flyhud'));

// ---------------- State ----------------
const TIME = [
  { label: 'Slow', icon: '🐢', speed: 3 },
  { label: 'Fast', icon: '🐇', speed: 45 },
  { label: 'Stopped', icon: '⏸️', speed: 0 },
];
let timeIdx = 0;
const state = {
  mode: 'space', // space | fly | inside | iss
  focus: null,
  focusId: null,
  lastFocusPos: new THREE.Vector3(),
  flight: null,
  cut: null,
  cuts: {},
  voice: false,
  iss: null,
  viewShift: { x: 0, y: 0 },
  deep: null, // deep space (stars and the Milky Way), loaded the first time you go there
};

// Stand-in "body" for the asteroid belt so the camera has something to circle around
const beltAnchor = {
  def: BELT, radius: 6, targetRadius: 6, group: new THREE.Object3D(),
  worldPos(out = new THREE.Vector3()) { return out.copy(this.group.position); },
};
scene.add(beltAnchor.group);

// Drop any leftover drag "spin" so it can't nudge the camera once an automatic flight lands
function stillControls(c) { c._sphericalDelta.set(0, 0, 0); c._scale = 1; }

// Stop any running camera animation (so a quick tap can't leave one writing old positions)
function stopCameraTweens() {
  state.camTween?.kill(); state.camTween = null;
  gsap.killTweensOf(camera.position);
  gsap.killTweensOf(fly);
}

// ---------------- Visiting things ----------------
// On a tall (portrait) screen the side-to-side view is narrow, so stand further back
function viewFactor() {
  const aspect = innerWidth / innerHeight;
  if (aspect >= 1) return 1;
  const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect);
  return (1 / Math.sin(0.35 * hfov)) / 3.33 * 1.15;
}
function focusDistance(b) {
  const d = b.def;
  const r = b.targetRadius ?? b.radius;
  const k = viewFactor();
  if (d.kind === 'star') return 54 * k;
  if (d.kind === 'region') return 24 * k;
  if (d.kind === 'craft') return r * 5 * k;
  if (d.rings) return r * 5.2 * (k > 1 ? k * 1.3 : 1);
  return r * 3.3 * k;
}

function cardHandlers() {
  return {
    onClose: () => { hideCard(); setViewShift(false); stopSpeaking(); },
    onInside: () => openInside(),
    onEnter: () => enterISS(),
    onGo: (gid) => select(gid),
  };
}

function select(id, { duration } = {}) {
  if (state.mode === 'iss' || state.mode === 'deep' || state.busy) return;
  stopCameraTweens();
  if (state.mode === 'fly') exitFly();
  if (state.cut) closeInside(true);
  const target = id === 'belt' ? beltAnchor : world.bodies[id];
  if (!target) return;
  if (id === 'belt') {
    // the bit of the belt nearest to where we are now
    const a = Math.atan2(-camera.position.z, camera.position.x);
    const r = kidDistance(2.7);
    beltAnchor.group.position.set(Math.cos(a) * r, 0, -Math.sin(a) * r);
  }
  state.focusId = id;
  world.rockField.visible = id === 'belt';
  if (id === 'belt') world.rockField.position.copy(beltAnchor.group.position);
  world.setHD(id);
  world.setOrbitFade(0.45);
  flyTo(target, duration);
  showCard(target.def, cardHandlers());
  setViewShift(true);
  markDock(id);
  if (state.voice) speak(`${target.def.name}. ${target.def.tagline}`);
  updateLabelVisibility();
}

function flyTo(target, duration) {
  const end = target.worldPos(new THREE.Vector3());
  const up = new THREE.Vector3(0, 1, 0);
  // look from the sunny side, a little off to one side, so the planet is lit like a "full moon"
  const sunDir = end.lengthSq() < 1 ? camera.position.clone().sub(end).normalize() : end.clone().negate().normalize();
  const side = new THREE.Vector3().crossVectors(sunDir, up).normalize();
  const dir = sunDir.clone().multiplyScalar(0.85).add(side.multiplyScalar(0.5)).add(new THREE.Vector3(0, 0.28, 0)).normalize();
  if (target.def.kind === 'region') {
    // the asteroid belt: hang back on the Sun side so the rocks are lit, looking out across them
    const out = new THREE.Vector3(end.x, 0, end.z).normalize();
    dir.copy(out).multiplyScalar(-0.8).add(new THREE.Vector3(0, 0.45, 0)).normalize();
  }
  const dist = focusDistance(target);
  const travel = camera.position.distanceTo(end);
  stillControls(controls);
  state.flight = {
    target, dir, dist, t: 0,
    dur: duration ?? THREE.MathUtils.clamp(1.3 + Math.log10(1 + travel) * 0.55, 1.4, 3.2),
    fromPos: camera.position.clone(), fromTarget: controls.target.clone(),
    arc: Math.min(travel * 0.22, 220),
  };
  state.focus = target;
  if (target.tilt) world.faceTowards(target, dir, TIME[timeIdx].speed, state.flight.dur);
  controls.enabled = false;
  const r = target.targetRadius ?? target.radius;
  controls.minDistance = target.def.kind === 'craft' ? r * 1.8 : target.def.kind === 'region' ? 2 : r * 1.2 + 0.02;
}

function goHome() {
  if (state.mode === 'deep') { backToPlanets(); return; }
  if (state.mode === 'iss' || state.busy) return;
  stopCameraTweens();
  if (state.mode === 'fly') exitFly(false);
  if (state.cut) closeInside(true);
  hideCard(); setViewShift(false); markDock(null); stopSpeaking();
  state.focusId = null;
  world.rockField.visible = false;
  world.setHD(null);
  world.setOrbitFade(1);
  const home = { def: { kind: 'home' }, radius: 1, worldPos: (o = new THREE.Vector3()) => o.set(0, 0, 0) };
  stillControls(controls);
  state.flight = {
    target: home, dir: new THREE.Vector3(0.25, 0.62, 0.74).normalize(), dist: 640, t: 0, dur: 2.4,
    fromPos: camera.position.clone(), fromTarget: controls.target.clone(), arc: 60,
  };
  state.focus = home;
  controls.minDistance = 20;
  controls.enabled = false;
  updateLabelVisibility();
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function updateFlight(dt) {
  const f = state.flight;
  f.t = Math.min(1, f.t + dt / f.dur);
  const e = easeInOut(f.t);
  const endTarget = f.target.worldPos(new THREE.Vector3());
  const endPos = endTarget.clone().addScaledVector(f.dir, f.dist);
  camera.position.lerpVectors(f.fromPos, endPos, e);
  camera.position.y += Math.sin(Math.PI * e) * f.arc;
  const et = 1 - Math.pow(1 - Math.min(1, f.t * 1.35), 3);
  controls.target.lerpVectors(f.fromTarget, endTarget, et);
  camera.lookAt(controls.target);
  state.lastFocusPos.copy(endTarget);
  if (f.t >= 1) {
    state.flight = null;
    controls.enabled = true;
    if (f.onDone) f.onDone();
    else if (!state.hinted) { state.hinted = true; toast('Drag to spin around. Pinch to zoom. Tap anything to visit it.', 5000); }
  }
}

function followFocus() {
  if (!state.focus) return;
  const p = state.focus.worldPos(new THREE.Vector3());
  const delta = p.clone().sub(state.lastFocusPos);
  camera.position.add(delta);
  controls.target.add(delta);
  state.lastFocusPos.copy(p);
}

// Slide the picture over so the planet sits in the open space beside the card
function setViewShift(on) {
  const portrait = innerWidth / innerHeight < 1 || innerWidth < 760;
  const card = $('#card');
  const w = on && !card.hidden ? card.getBoundingClientRect() : null;
  const tx = on && w && !portrait ? (w.width + 16) / 2 : 0;
  const ty = on && w && portrait ? (w.height + 16) / 2 - 40 : 0;
  gsap.to(state.viewShift, { x: tx, y: Math.max(0, ty), duration: 0.7, ease: 'power2.out', onUpdate: applyViewShift });
}
function applyViewShift() {
  const { x, y } = state.viewShift;
  if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5) camera.clearViewOffset();
  else camera.setViewOffset(innerWidth, innerHeight, x, y, innerWidth, innerHeight);
}

// ---------------- Looking inside a planet ----------------
function openInside() {
  const b = state.focus;
  if (!b || !b.def.inside || !b.material) return;
  stopSpeaking();
  stopCameraTweens();
  state.flight = null;
  controls.enabled = true;
  state.mode = 'inside';
  if (!state.cuts[b.def.id]) state.cuts[b.def.id] = new Cutaway(b, b.material, (i) => pickLayer(i));
  state.cut = state.cuts[b.def.id];
  // Back off a little and rise slightly, keeping the same side of the planet in view
  const c = b.worldPos(new THREE.Vector3());
  controls.target.copy(c);
  state.lastFocusPos.copy(c);
  const from = camera.position.clone().sub(c);
  const dir = from.clone().normalize();
  dir.y += 0.22; dir.normalize();
  const to = dir.clone().multiplyScalar(b.targetRadius * 4.0 * viewFactor());
  const tw = { k: 0 };
  state.camTween = gsap.to(tw, {
    k: 1, duration: 0.9, ease: 'power2.inOut',
    onUpdate: () => camera.position.copy(controls.target).add(from.clone().lerp(to, tw.k)),
  });
  state.cut.open(dir);
  state.layer = -1;
  showInside(b.def, {
    onLayer: pickLayer,
    onBack: () => closeInside(),
    onRead: () => {
      const L = b.def.inside;
      speak(state.layer >= 0 ? `${L[state.layer].name}. ${L[state.layer].kid}` : `Inside ${b.def.name.replace(/^The /, '')} there are ${L.length} layers: ${L.map((x) => x.name).join(', ')}.`);
    },
  });
  if (state.voice) speak(`Let's look inside ${b.def.name.replace(/^The /, '')}! Tap a layer.`);
  updateLabels();
}
function pickLayer(i) {
  if (!state.cut) return;
  state.cut.setHighlight(i);
  markLayer(i);
  const l = state.focus.def.inside[i];
  state.layer = i;
  if (state.voice) speak(`${l.name}. ${l.kid}`);
}
function closeInside(instant) {
  const cut = state.cut;
  if (!cut) return;
  state.cut = null;
  state.mode = 'space';
  cut.setHighlight(-1);
  stopSpeaking();
  if (instant) { cut.detach(); return; }
  cut.close();
  showCard(state.focus.def, cardHandlers());
}

// ---------------- Free flying ----------------
const _p = new THREE.Vector3();
function surfaceDistance(pos) {
  let best = Infinity;
  for (const b of world.list) {
    const d = b.worldPos(_p).distanceTo(pos) - b.radius;
    if (d < best) best = d;
  }
  return best;
}
const spaceSpeed = (pos) => THREE.MathUtils.clamp(surfaceDistance(pos) * 0.9, 0.25, 180);
const spaceClamp = (pos) => {
  for (const b of world.list) {
    const c = b.worldPos(_p);
    const min = b.radius * (b.def.kind === 'star' ? 1.4 : 1.08);
    const off = pos.clone().sub(c);
    if (off.length() < min) pos.copy(c).add(off.setLength(min));
  }
};
fly.speedFn = spaceSpeed;
fly.clampFn = spaceClamp;

function enterFly() {
  if (state.mode === 'iss' || state.busy) return;
  stopCameraTweens();
  if (state.cut) closeInside(true);
  state.flight = null;
  hideCard(); setViewShift(false); markDock(null); stopSpeaking();
  world.setHD(null);
  world.setOrbitFade(0.8);
  state.mode = 'fly';
  state.focus = null; state.focusId = null;
  controls.enabled = false;
  fly.start();
  document.body.classList.add('flying');
  $('#dock').hidden = true;
  $('#fly').setAttribute('aria-pressed', 'true');
  $('#fly span:last-child').textContent = 'Stop flying';
  const help = $('.fly-help'); help.style.opacity = '1'; setTimeout(() => (help.style.opacity = '0'), 6000);
  updateLabelVisibility();
}
function exitFly(resetTarget = true) {
  fly.stop();
  state.mode = 'space';
  document.body.classList.remove('flying');
  $('#dock').hidden = false;
  $('#fly').setAttribute('aria-pressed', 'false');
  $('#fly span:last-child').textContent = 'Fly';
  if (resetTarget) {
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const d = THREE.MathUtils.clamp(surfaceDistance(camera.position), 2, 60);
    controls.target.copy(camera.position).addScaledVector(fwd, d);
    controls.minDistance = 0.5;
    controls.enabled = true;
    updateLabelVisibility();
  }
}

// ---------------- Inside the Space Station ----------------
const fade = document.createElement('div');
fade.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;z-index:40;transition:opacity .6s';
$('#app').appendChild(fade);
const fadeTo = (v) => new Promise((r) => { fade.style.opacity = v; setTimeout(r, 650); });
const ISS_EARTH = ['tex/hd/earth.jpg', 'tex/hd/earth_clouds.jpg', 'tex/hd/earth_night.jpg'];

async function enterISS() {
  if (state.mode === 'iss' || state.busy) return;
  state.busy = true;
  stopSpeaking();
  stopCameraTweens();
  state.flight = null;
  controls.enabled = false;
  let entered = false;
  try {
    await fadeTo(1);
    if (!state.iss) {
      const { ISSInterior } = await import('./scene/issInterior.js');
      state.iss = new ISSInterior((id, pos) => onSpot(id, pos));
    }
    state.iss.attachEarth(ISS_EARTH.map((u, i) => acquireTex(u, i !== 1)));
    entered = true;
    state.mode = 'iss';
    document.body.classList.add('in-iss');
    hideCard(); state.viewShift.x = state.viewShift.y = 0; camera.clearViewOffset();
    renderPass.scene = state.iss.scene;
    camera.near = 0.02; camera.updateProjectionMatrix();
    // start in the US lab, looking down the station towards Japan's Kibo lab
    camera.position.set(1.4, 0.15, 0.35);
    camera.lookAt(-10, 0, 0);
    fly.clampFn = (p) => state.iss.clamp(p);
    fly.speedFn = () => 2.4;
    fly.start();
    $('#dock').hidden = true; $('#topbar').hidden = true; $('#isshud').hidden = false;
    $('#labels').classList.add('iss');
    bloom.strength = 0.35;
    toast('Welcome aboard! Tap the glowing circles. Float down through the floor to the big window.', 6500);
    if (state.voice) speak('Welcome aboard the Space Station! Tap the glowing circles to explore.');
  } catch (err) {
    console.error(err);
    if (entered) ISS_EARTH.forEach((u) => releaseTex(u));
    state.mode = 'space';
    controls.enabled = true;
    toast("Couldn't open the Space Station. Check the internet and try again.", 4500);
  } finally {
    await fadeTo(0);
    state.busy = false;
  }
}

async function leaveISS() {
  if (state.mode !== 'iss' || state.busy) return;
  state.busy = true;
  stopSpeaking();
  stopCameraTweens();
  try {
    await fadeTo(1);
    fly.stop();
    state.iss.hideSpots();
    state.iss.detachEarth();
    ISS_EARTH.forEach((u) => releaseTex(u));
    renderPass.scene = scene;
    fly.clampFn = spaceClamp; fly.speedFn = spaceSpeed;
    $('#dock').hidden = false; $('#topbar').hidden = false; $('#isshud').hidden = true;
    $('#labels').classList.remove('iss');
    document.body.classList.remove('in-iss');
    bloom.strength = 0.7;
    hideCard();
    state.mode = 'space';
    const iss = world.bodies.iss;
    const p = iss.worldPos(new THREE.Vector3());
    camera.position.copy(p).add(new THREE.Vector3(0.25, 0.12, 0.3));
    controls.target.copy(p);
    state.focus = iss; state.lastFocusPos.copy(p);
    await fadeTo(0);
  } finally {
    state.busy = false;
  }
  select('iss', { duration: 0.8 });
}

function onSpot(id, pos) {
  const spot = ISS_SPOTS[id];
  showSpot(spot, () => hideCard());
  if (state.voice) speak(`${spot.name}. ${spot.text}`);
  // turn to look at it, and float closer if it's far away
  const look = pos.clone().sub(camera.position);
  const yaw = Math.atan2(-look.x, -look.z);
  const pitch = Math.atan2(look.y, Math.hypot(look.x, look.z));
  let dy = yaw - fly.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  gsap.to(fly, { yaw: fly.yaw + dy, pitch, duration: 0.8, ease: 'power2.inOut' });
  if (look.length() > 2.2) {
    const dest = camera.position.clone().addScaledVector(look.clone().normalize(), look.length() - 1.8);
    state.iss.clamp(dest);
    gsap.to(camera.position, { x: dest.x, y: dest.y, z: dest.z, duration: 1.2, ease: 'power2.inOut' });
  }
}

// ---------------- Deep space: the stars and the Milky Way ----------------
// Loaded the first time it's needed (it brings ~43,000 real stars with it).
let deepLoading = null;
function loadDeep() {
  if (state.deep) return Promise.resolve(state.deep);
  if (!deepLoading) {
    const slow = setTimeout(() => toast('Getting the stars ready…', 2500), 500);
    deepLoading = import('./deep/deepSpace.js').then(({ DeepSpace }) => {
      clearTimeout(slow);
      state.deep = new DeepSpace({ renderer, camera, dom: renderer.domElement, touch: isTouch, test: TEST, onPick: (id) => deepSelect(id) });
      state.deep.pixelRatio = dpr;
      composer.insertPass(state.deep.lens, 1); // bends the picture round the black hole (only switched on near it)
      state.deep.warmUp();
      return state.deep;
    }).catch((e) => { clearTimeout(slow); deepLoading = null; throw e; });
  }
  return deepLoading;
}

const HOME_DIR = new THREE.Vector3(0.25, 0.62, 0.74).normalize(); // the "whole solar system" view direction
const smoothstep = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Leave the planets: back away until the solar system is a dot, swap to deep space (the two views
// look the same at that moment), then carry on out to wherever we're going.
async function goDeep(dest = 'nearby') {
  if (state.busy) return;
  if (state.mode === 'deep') { deepGo(dest); return; }
  if (state.mode === 'iss') return;
  state.busy = true;
  try {
    stopCameraTweens();
    if (state.mode === 'fly') exitFly(); // looks ahead from where we are, so the flight starts smoothly
    if (state.cut) closeInside(true);
    hideCard(); setViewShift(false); markDock(null); stopSpeaking();
    const deepP = loadDeep();
    if (camera.position.distanceTo(controls.target) < HANDOFF_D * 0.97 || controls.target.lengthSq() > 1) {
      const home = { def: { kind: 'home' }, radius: 1, worldPos: (o = new THREE.Vector3()) => o.set(0, 0, 0) };
      const dir = camera.position.lengthSq() > 1 ? camera.position.clone().normalize() : HOME_DIR.clone();
      state.focus = home; state.focusId = null;
      world.setHD(null);
      await new Promise((resolve) => {
        stillControls(controls);
        state.flight = { target: home, dir, dist: HANDOFF_D, t: 0, dur: 1.8, fromPos: camera.position.clone(), fromTarget: controls.target.clone(), arc: 0, onDone: resolve };
        controls.enabled = false;
      });
    }
    const deep = await deepP;
    enterDeepScene(deep);
    state.busy = false;
    deepGo(dest, true);
  } catch (err) {
    console.error(err);
    toast("Couldn't load the stars. Check the internet and try again.", 4000);
    controls.enabled = true;
  } finally {
    state.busy = false;
  }
}

function enterDeepScene(deep) {
  const dir = camera.position.clone().sub(controls.target).normalize();
  controls.enabled = false;
  state.flight = null;
  state.focus = null; state.focusId = null;
  state.mode = 'deep';
  world.setHD(null); // put away the sharp planet maps and the detailed Space Station while we're out here
  renderPass.scene = deep.scene;
  document.body.classList.add('deep');
  $('#labels').classList.add('deep');
  $('#scale').hidden = false;
  deep.enterFromSolarSystem(dir);
  refreshBlocked();
  buildDeepDock(DEEP_DOCK.map((id) => ({ id, name: DEEP[id].name, short: DEEP[id].short || DEEP[id].name, emoji: DEEP[id].emoji, color: deep.cssColor(id) })), deepSelect);
}

function deepGo(dest, first) {
  const deep = state.deep;
  if (!deep || state.mode !== 'deep' || state.busy) return;
  if (dest === 'planets') { backToPlanets(); return; }
  const rung = RUNGS.find((r) => r.id === dest);
  if (!rung) { deepSelect(dest); return; }
  resetBlackHole();
  hideCard(); setViewShift(false); markDock(null); stopSpeaking();
  deep.cardFor = null;
  refreshBlocked();
  deep.flyToRung(dest, () => {
    const msg = first && !state.lyHinted ? LIGHT_YEAR_FACT : rung.toast;
    if (first) state.lyHinted = true;
    toast(msg, 6000);
    if (state.voice) speak(msg);
  });
}

function deepCard(id, def) {
  const chips = (def.chips || []).filter((c) => DEEP[c]);
  const lens = state.deep.lens;
  return {
    ...def, id: `deep-${id}`, chips: undefined,
    chipsTitle: def.chipsTitle || 'Close by',
    chipItems: chips.length ? chips.map((c) => ({ id: c, name: DEEP[c].short || DEEP[c].name, style: DEEP[c].emoji ? '' : starOrbStyle(state.deep.cssColor(c)), emoji: DEEP[c].emoji })) : null,
    actions: id === 'sgra' ? [
      { id: 'beams', icon: '🔦', label: 'Light beams', pressed: lens.beamsOn },
      { id: 'eht', icon: '📡', label: 'Telescope view', pressed: lens.ehtOn },
    ] : null,
  };
}

// The black hole's two experiments: shine light past it, and see it the way the telescope does
function blackHoleAction(act, btn) {
  const deep = state.deep;
  const lens = deep.lens;
  const other = (id) => btn.parentElement.querySelector(`[data-x="${id}"]`);
  if (act === 'beams') {
    const on = !lens.beamsOn;
    if (on && lens.ehtOn) { setTelescopeView(false); other('eht')?.setAttribute('aria-pressed', 'false'); }
    lens.setBeams(on);
    btn.setAttribute('aria-pressed', String(on));
    if (on) { const m = 'Watch the light! Beams far away bend a little. Close ones swing right round. The closest fall in and never come out.'; toast(m, 7000); if (state.voice) speak(m); }
  } else if (act === 'eht') {
    const on = !lens.ehtOn;
    if (on && lens.beamsOn) { lens.setBeams(false); other('beams')?.setAttribute('aria-pressed', 'false'); }
    setTelescopeView(on);
    btn.setAttribute('aria-pressed', String(on));
    if (on) { const m = 'This is how the Event Horizon Telescope sees it from Earth: a blurry ring of light around a dark middle. Compare it with the real picture below!'; toast(m, 7500); if (state.voice) speak(m); }
  }
}
function setTelescopeView(on) {
  const deep = state.deep;
  if (!deep) return;
  deep.lens.setEht(on);
  if (on) {
    deep.setUpOverride(deep.skyNorth);
    deep.flyTo({ target: deep.placePos('sgra'), z: Math.log10(deep.ehtViewD) + deep.portraitZ, dir: deep.earthDir, focusId: 'sgra', duration: 2.6 });
  } else deep.setUpOverride(null);
}
function resetBlackHole() {
  const lens = state.deep?.lens;
  if (!lens) return;
  if (lens.ehtOn) setTelescopeView(false);
  lens.setBeams(false);
}

function deepSelect(id) {
  const deep = state.deep;
  if (!deep || state.mode !== 'deep' || state.busy) return;
  resetBlackHole();
  const def = deep.select(id);
  if (!def) return;
  deep.cardFor = id;
  showCard(deepCard(id, def), {
    onClose: () => { hideCard(); setViewShift(false); stopSpeaking(); markDock(null); deep.cardFor = null; resetBlackHole(); refreshBlocked(); },
    onGo: (g) => deepSelect(g),
    onAction: blackHoleAction,
  });
  if (id === 'sgra' && !state.bhHinted) {
    state.bhHinted = true;
    setTimeout(() => { if (deep.cardFor === 'sgra') toast('A black hole! Drag to fly around it and watch the light bend.', 6000); }, 4000);
  }
  setViewShift(true);
  refreshBlocked();
  markDock(id);
  if (state.voice) speak(`${def.name}. ${def.tagline}`);
}

// Come home: fly back to the Sun until it's the big glow again, swap scenes, then settle on the planets
function backToPlanets() {
  const deep = state.deep;
  if (state.mode !== 'deep' || state.busy || !deep) return;
  state.busy = true;
  resetBlackHole();
  hideCard(); setViewShift(false); markDock(null); stopSpeaking();
  deep.flyTo({
    target: new THREE.Vector3(), z: deep.zHandoff, dir: sceneDirToDeep(HOME_DIR), focusId: 'sun', locked: true,
    onDone: () => {
      const dirScene = deep.dirToSolarSystem();
      deep.leave();
      composer.renderTarget1.dispose(); // only the black hole's pass draws into this one
      state.mode = 'space';
      renderPass.scene = scene;
      document.body.classList.remove('deep');
      $('#labels').classList.remove('deep');
      $('#scale').hidden = true;
      buildDock((id) => select(id));
      camera.up.set(0, 1, 0);
      camera.near = 1; camera.far = 30000; camera.updateProjectionMatrix();
      controls.target.set(0, 0, 0);
      camera.position.copy(dirScene).multiplyScalar(HANDOFF_D);
      camera.lookAt(0, 0, 0);
      controls.enabled = true;
      state.busy = false;
      goHome();
    },
  });
}

// Pinching (or scrolling) past the edge of one view carries on into the next one
const namesBox = $('#opt-names');
// screen areas the deep-space names keep clear of
function refreshBlocked() {
  const deep = state.deep;
  if (!deep) return;
  const rects = [];
  for (const el of [$('#ladder'), $('#card')]) {
    if (el.hidden || el.offsetParent === null) continue;
    const r = el.getBoundingClientRect();
    rects.push({ x0: r.left - 6, x1: r.right + 6, y0: r.top - 6, y1: r.bottom + 6 });
  }
  deep.blocked = rects;
}
addEventListener('resize', () => setTimeout(refreshBlocked, 50));
const touchPts = new Map();
let pinchAcc = 0, lastPinch = 0, wheelAcc = 0, wheelT = 0;
function zoomIntent(dir) {
  if (state.busy) return;
  if (state.mode === 'space' && dir === 'out' && !state.flight && controls.enabled
    && camera.position.distanceTo(controls.target) >= HANDOFF_D * 0.97) goDeep('nearby');
  else if (state.mode === 'deep' && dir === 'in' && state.deep && !state.deep.flight && state.deep.focusId === 'sun'
    && state.deep.viewDistance <= state.deep.minSunDistance * 1.05) backToPlanets();
}
// names floating over the picture shouldn't stop the mouse wheel from zooming
$('#labels').addEventListener('wheel', (e) => canvas.dispatchEvent(new WheelEvent('wheel', e)), { passive: true });
canvas.addEventListener('wheel', (e) => {
  const now = performance.now();
  if (now - wheelT > 800) wheelAcc = 0;
  wheelT = now;
  wheelAcc += e.deltaY;
  if (wheelAcc >= 100) { wheelAcc = 0; zoomIntent('out'); } else if (wheelAcc <= -100) { wheelAcc = 0; zoomIntent('in'); }
}, { passive: true });
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') touchPts.set(e.pointerId, [e.clientX, e.clientY]);
  pinchAcc = 0; lastPinch = 0;
});
canvas.addEventListener('pointermove', (e) => {
  if (!touchPts.has(e.pointerId)) return;
  touchPts.set(e.pointerId, [e.clientX, e.clientY]);
  if (touchPts.size !== 2) return;
  const [a, b] = [...touchPts.values()];
  const dd = Math.hypot(a[0] - b[0], a[1] - b[1]);
  if (lastPinch > 0) pinchAcc += Math.log(dd / lastPinch);
  lastPinch = dd;
  if (pinchAcc < -0.35) { pinchAcc = 0; zoomIntent('out'); } else if (pinchAcc > 0.35) { pinchAcc = 0; zoomIntent('in'); }
});
const endTouch = (e) => { touchPts.delete(e.pointerId); lastPinch = 0; pinchAcc = 0; };
canvas.addEventListener('pointerup', endTouch);
canvas.addEventListener('pointercancel', endTouch);

// ---------------- The zoom ladder and the scale bar ----------------
function buildLadder() {
  const wrap = $('#ladder .ladder-rungs');
  wrap.innerHTML = '';
  for (const r of [...RUNGS].reverse()) {
    const b = document.createElement('button');
    b.className = 'rung';
    b.dataset.rung = r.id;
    b.innerHTML = `<span class="ico" aria-hidden="true">${r.icon}</span><span class="txt">${r.name}</span>`;
    b.setAttribute('aria-label', r.id === 'planets' ? 'Back to the planets' : `Go and see the ${r.name.toLowerCase()}`);
    b.addEventListener('click', () => (r.id === 'planets' ? (state.mode === 'deep' ? backToPlanets() : goHome()) : goDeep(r.id)));
    wrap.appendChild(b);
  }
}
let ladderCur = -1, ladderTop = '';
function updateLadder(pos) {
  const n = RUNGS.length - 1;
  const top = `${((1 - THREE.MathUtils.clamp(pos, 0, n) / n) * 100).toFixed(1)}%`;
  if (top !== ladderTop) { ladderTop = top; $('.ladder-dot').style.top = top; }
  const cur = THREE.MathUtils.clamp(Math.round(pos), 0, n);
  if (cur !== ladderCur) {
    ladderCur = cur;
    document.querySelectorAll('.rung').forEach((b) => b.setAttribute('aria-current', String(b.dataset.rung === RUNGS[cur].id)));
  }
}
let scaleKey = '';
const LY_UNITS = [
  { per: 525960, one: 'light-minute', many: 'light-minutes' }, // how far light goes in a minute
  { per: 8766, one: 'light-hour', many: 'light-hours' }, // ... in an hour
  { per: 365.25, one: 'light-day', many: 'light-days' },
  { per: 1, one: 'light-year', many: 'light-years' },
];
function updateScale(d) {
  // how wide the picture is, in light-years, and a tidy length for the bar (1, 2 or 5 x 10^n)
  const w = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
  const pxPerLy = innerWidth / w;
  const wantLy = 90 / pxPerLy;
  const unit = wantLy < 0.00008 ? LY_UNITS[0] : wantLy < 0.004 ? LY_UNITS[1] : wantLy < 0.6 ? LY_UNITS[2] : LY_UNITS[3];
  const want = wantLy * unit.per;
  const p10 = Math.pow(10, Math.floor(Math.log10(want)));
  let nice = p10;
  for (const k of [1, 2, 5, 10]) if (Math.abs(Math.log((k * p10) / want)) < Math.abs(Math.log(nice / want))) nice = k * p10;
  const px = Math.round((nice / unit.per) * pxPerLy);
  const key = `${px}|${nice}|${unit.one}`;
  if (key === scaleKey) return;
  scaleKey = key;
  $('#scale .scale-bar').style.width = `${px}px`;
  $('#scale .scale-text').textContent = `${nice.toLocaleString('en-NZ')} ${nice === 1 ? unit.one : unit.many}`;
}
buildLadder();

// ---------------- Names: show what matters, never let them pile up ----------------
function updateLabelVisibility() {
  const f = state.focusId;
  const fDef = f ? (f === 'belt' ? BELT : BODY[f]) : null;
  const family = new Set();
  if (fDef) {
    family.add(f);
    const parent = fDef.parent || f;
    family.add(parent);
    (BODY[parent]?.moons || []).forEach((m) => family.add(m));
    if (parent === 'earth') ['iss', 'hubble', 'moon'].forEach((x) => family.add(x));
    if (f === 'belt' || fDef.kind === 'asteroid') BELT.chips.forEach((a) => family.add(a));
  }
  for (const b of world.list) {
    const k = b.def.kind;
    let show = k === 'planet' || k === 'star' || k === 'dwarf' || family.has(b.def.id);
    if (state.mode === 'fly') show = k !== 'asteroid' || b.def.id === 'ceres' || b.def.id === 'vesta';
    b.labelShouldShow = show;
  }
}
const PRIORITY_ID = { earth: 0, jupiter: 1, saturn: 1, mars: 2, venus: 2, uranus: 2, neptune: 2, mercury: 3, sun: 3, pluto: 3 };
const PRIORITY_KIND = { craft: 4, moon: 4, dwarf: 4, asteroid: 5 };
const tmpV = new THREE.Vector3();
const placed = [];
const _oc = new THREE.Vector3(), _dir = new THREE.Vector3(), _bp = new THREE.Vector3();
function updateLabels() {
  const fovK = 1 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const W = innerWidth, H = innerHeight;
  const cands = [];
  // big things on screen can hide the names of things behind them
  const blockers = [];
  for (const b of world.list) {
    const c = b.worldPos(new THREE.Vector3());
    const d = c.distanceTo(camera.position);
    if ((b.radius / d) * fovK > 0.03) blockers.push({ b, c, r: b.radius * (b.def.rings ? 1.0 : 1.02) });
  }
  const hidden = (b, p) => {
    _dir.copy(p).sub(camera.position); const len = _dir.length(); _dir.divideScalar(len);
    for (const k of blockers) {
      if (k.b === b) continue;
      _oc.copy(k.c).sub(camera.position);
      const t = _oc.dot(_dir);
      if (t <= 0 || t >= len) continue;
      if (_oc.lengthSq() - t * t < k.r * k.r) return true;
    }
    return false;
  };
  for (const b of world.list) {
    if (!b.labelEl) continue;
    let show = b.labelShouldShow && state.mode !== 'inside' && !(state.focusId === b.def.id && state.mode !== 'fly');
    if (world.farFade > 0.4 && b.def.kind !== 'star') show = false;
    if (show) {
      const d = b.worldPos(tmpV).distanceTo(camera.position);
      if ((b.radius / d) * fovK > 0.22) show = false; // big on screen already
    }
    if (show && hidden(b, b.worldPos(_bp))) show = false;
    if (show) {
      b.label.getWorldPosition(tmpV).project(camera);
      if (tmpV.z > 1 || tmpV.z < -1) show = false;
      else cands.push({ b, x: (tmpV.x * 0.5 + 0.5) * W, y: (-tmpV.y * 0.5 + 0.5) * H, p: PRIORITY_ID[b.def.id] ?? PRIORITY_KIND[b.def.kind] ?? 6, d: tmpV.z });
    }
    if (!show) b.labelEl.classList.add('hidden');
  }
  // keep the important names, drop the ones that would overlap them
  cands.sort((a, b) => a.p - b.p || a.d - b.d);
  placed.length = 0;
  for (const c of cands) {
    const w = c.b.labelW, h = 30;
    const r = { x0: c.x - w / 2, x1: c.x + w / 2, y0: c.y - h, y1: c.y + 4 };
    const hit = placed.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0);
    c.b.labelEl.classList.toggle('hidden', hit);
    if (!hit) placed.push(r);
  }
}

// ---------------- Tapping things in 3D ----------------
const raycaster = new THREE.Raycaster();
let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  down = { x: e.clientX, y: e.clientY, t: performance.now() };
  if (state.mode === 'deep') state.deep?.cancelFlight(); // a touch takes over from an automatic flight
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  const quick = performance.now() - down.t < 450;
  down = null;
  if (moved > 10 || !quick || state.mode === 'iss' || state.mode === 'inside') return;
  if (state.mode === 'deep') {
    const id = state.deep.pickAt(e.clientX, e.clientY);
    if (id) deepSelect(id);
    return;
  }
  const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(world.getPickables(), false);
  for (const h of hits) {
    let o = h.object; let id = o.userData.bodyId;
    while (!id && o.parent) { o = o.parent; id = o.userData.bodyId; }
    if (id) { if (id !== state.focusId) select(id); break; }
  }
});

// ---------------- Top bar and settings ----------------
$('#home').addEventListener('click', goHome);
$('#fly').addEventListener('click', () => (state.mode === 'fly' ? exitFly() : enterFly()));
$('#time').addEventListener('click', () => {
  timeIdx = (timeIdx + 1) % TIME.length;
  $('#time .time-icon').textContent = TIME[timeIdx].icon;
  $('#time .time-label').textContent = TIME[timeIdx].label;
  toast(['Time is going slowly.', 'Whoosh! Time is going fast.', 'Time has stopped.'][timeIdx], 2000);
});
$('#settings').addEventListener('click', (e) => {
  const p = $('#settings-panel'); p.hidden = !p.hidden;
  e.currentTarget.setAttribute('aria-expanded', String(!p.hidden));
});
document.addEventListener('pointerdown', (e) => {
  const p = $('#settings-panel');
  if (!p.hidden && !p.contains(e.target) && !$('#settings').contains(e.target)) { p.hidden = true; $('#settings').setAttribute('aria-expanded', 'false'); }
});
$('#opt-real').addEventListener('change', (e) => {
  world.setRealSizes(e.target.checked);
  toast(e.target.checked ? 'Real sizes! The real Sun is 109 Earths wide, too big to fit here.' : 'Explorer sizes. Small things are made bigger so you can see them.', 4500);
  if (state.focusId && state.focusId !== 'belt') select(state.focusId, { duration: 1.2 });
});
$('#opt-orbits').addEventListener('change', (e) => (world.orbitLines.visible = e.target.checked));
$('#opt-names').addEventListener('change', (e) => $('#labels').classList.toggle('no-names', !e.target.checked));
$('#opt-voice').addEventListener('change', (e) => { state.voice = e.target.checked; if (state.voice) speak('I will read things out loud for you.'); });
$('#credits-btn').addEventListener('click', () => {
  const d = $('#credits');
  if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
});
$('#credits form').addEventListener('submit', (e) => { const d = $('#credits'); if (typeof d.close !== 'function') { e.preventDefault(); d.removeAttribute('open'); } });
$('#leave-iss').addEventListener('click', leaveISS);

buildDock((id) => select(id));

// ---------------- Works without internet (when installed from a secure web address) ----------------
let framed = true;
try { framed = window.self !== window.top; } catch { /* cross-origin parent */ }
if (import.meta.env.PROD && 'serviceWorker' in navigator && !TEST && !framed && (location.protocol === 'https:' || location.hostname === 'localhost')) try {
  navigator.serviceWorker.register('sw.js').then(async () => {
    const res = await fetch('files.json', { cache: 'no-store' }).catch(() => null);
    if (!res || !res.ok) return;
    const info = await res.json();
    const box = $('#offline'); const note = box.querySelector('.offline-note'); const btn = $('#save-offline');
    box.hidden = false;
    const mb = Math.round(info.bytes / 1e6);
    note.textContent = `Downloads everything (about ${mb} MB) so it works on a plane or in the car.`;
    if (localStorageGet('saved') === info.version) { btn.textContent = 'Saved for no-internet use'; note.textContent = 'Everything is saved on this iPad.'; }
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.type !== 'save-progress') return;
      note.textContent = `Saving ${Math.round((e.data.done / e.data.total) * 100)}%`;
      if (e.data.done >= e.data.total) {
        btn.disabled = false;
        btn.textContent = e.data.failed ? 'Try saving again' : 'Saved for no-internet use';
        note.textContent = e.data.failed ? `${e.data.failed} files didn't save. Check the internet and try again.` : 'Everything is saved on this iPad.';
        if (!e.data.failed) localStorageSet('saved', info.version);
      }
    });
    btn.addEventListener('click', async () => {
      const reg = await navigator.serviceWorker.ready;
      btn.disabled = true; btn.textContent = 'Saving…';
      reg.active?.postMessage({ type: 'save-all', files: info.files });
    });
  }).catch(() => {});
} catch { /* sandboxed frame: no offline saving */ }
function localStorageGet(k) { try { return localStorage.getItem('space-' + k); } catch { return null; } }
function localStorageSet(k, v) { try { localStorage.setItem('space-' + k, v); } catch { /* private mode */ } }

// ---------------- Loading ----------------
const fill = $('.launch-fill');
const status = $('.launch-status');
const lines = ['Fuelling the rocket…', 'Polishing the planets…', 'Counting the stars…', 'Checking the space suits…'];
let lineI = 0;
const lineTimer = setInterval(() => { status.textContent = lines[++lineI % lines.length]; }, 1400);
let ready = false;
const markReady = () => {
  if (ready) return; ready = true;
  clearInterval(lineTimer);
  fill.style.width = '100%';
  status.textContent = 'Ready for launch!';
  const btn = $('#start'); btn.disabled = false; btn.focus();
};
loadingManager.onProgress = (_u, loaded, total) => { fill.style.width = `${Math.round((loaded / total) * 100)}%`; };
loadingManager.onLoad = markReady;
setTimeout(markReady, 15000);

$('#start').addEventListener('click', () => {
  // iOS only lets a page talk after a tap, so wake the voice up now
  if ('speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); }
  $('#launch').classList.add('gone');
  document.body.classList.remove('loading');
  setTimeout(() => $('#launch').remove(), 1000);
  camera.position.set(-300, 900, 1600);
  controls.target.set(0, 0, 0);
  camera.lookAt(0, 0, 0);
  select('earth', { duration: 4.2 });
  setTimeout(() => loadDeep().catch(() => {}), TEST ? 0 : 9000);
});

// ---------------- Resize and quality ----------------
function applySize() {
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight);
  composer.setPixelRatio(dpr);
  composer.setSize(innerWidth, innerHeight);
  labelRenderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  stars.material.uniforms.pixelRatio.value = dpr;
  if (state.deep) state.deep.pixelRatio = dpr;
}
addEventListener('resize', () => { applySize(); if (!$('#card').hidden) setViewShift(true); else applyViewShift(); });

// If frames get slow (an older iPad), quietly render fewer pixels; speed back up if there's room.
const frameTimes = [];
let lastQualityChange = 0;
function adaptQuality(ms, now) {
  if (TEST) return;
  frameTimes.push(ms);
  if (frameTimes.length < 90) return;
  const sorted = [...frameTimes].sort((a, b) => a - b);
  const median = sorted[45];
  frameTimes.length = 0;
  if (now - lastQualityChange < 2500) return;
  if (median > 21 && dpr > 1) { dpr = Math.max(1, dpr - 0.25); lastQualityChange = now; applySize(); }
  else if (median < 11 && dpr < MAX_DPR && now - lastQualityChange > 12000) { dpr = Math.min(MAX_DPR, dpr + 0.25); lastQualityChange = now; applySize(); }
}

// ---------------- Main loop ----------------
const clock = new THREE.Clock();
let speedoTick = 0;
let lastNow = performance.now();
function frame() {
  const now = performance.now();
  adaptQuality(now - lastNow, now);
  lastNow = now;
  const dt = Math.min(clock.getDelta(), TEST ? 0.5 : 0.05);
  const t = clock.elapsedTime;
  if (state.mode === 'iss') {
    fly.update(dt);
    state.iss.update(dt, t, camera);
    composer.render(dt);
    labelRenderer.render(state.iss.scene, camera);
    return;
  }
  if (state.mode === 'deep') {
    const deep = state.deep;
    deep.update(dt);
    deep.renderVolume(innerWidth, innerHeight, dpr);
    deep.updateLabels(namesBox.checked);
    updateLadder(deep.ladderPos());
    updateScale(deep.viewDistance);
    composer.render(dt);
    if (deep.lens.enabled) composer.swapBuffers(); // the light-bending pass swapped them; next frame starts as usual
    labelRenderer.render(deep.scene, camera);
    return;
  }
  world.orbitScale = state.mode === 'fly' ? 0.08 : 1;
  world.farFade = state.mode === 'fly' ? 0 : smoothstep(1700, 4700, camera.position.length());
  world.update(dt, TIME[timeIdx].speed, t);
  if (state.flight) updateFlight(dt);
  else if (state.mode === 'fly') {
    const v = fly.update(dt);
    if ((speedoTick += dt) > 0.15) { speedoTick = 0; $('.speedo-val').textContent = Math.round(v * 20).toLocaleString(); }
  } else {
    followFocus();
    controls.update();
  }
  if (state.cut) { state.cut.update(t); state.cut.layout(camera, innerWidth, innerHeight); }
  // keep the near clipping plane snug so tiny things (the Space Station) and huge distances both look right
  const near = THREE.MathUtils.clamp(surfaceDistance(camera.position) * 0.3, 0.004, 4);
  if (Math.abs(camera.near - near) / near > 0.15) { camera.near = near; camera.updateProjectionMatrix(); applyViewShift(); }
  sky.position.copy(camera.position);
  stars.material.uniforms.twinkle.value = t * 1.5;
  world.updateView(camera);
  updateLabels();
  updateLadder(0);
  composer.render(dt);
  labelRenderer.render(scene, camera);
}
renderer.setAnimationLoop(frame);

// handy for checking things from the browser console
window.__space = { world, camera, controls, select, state, enterISS, leaveISS, openInside, closeInside, pickLayer, goHome, enterFly, exitFly, gsap, renderer, fly, goDeep, backToPlanets, deepSelect, loadDeep, bloom, composer };

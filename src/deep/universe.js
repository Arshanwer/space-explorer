import * as THREE from 'three';
import GAL from '../data/galaxies.json';
import DF from '../data/deepfield.json';
import { DEEP_FIELD } from '../data/astro.js';
import { equatorialToDeep, skyBasis } from './frames.js';
import { rng } from './gcData.js';

// Beyond the Milky Way.
//
// 1. Nearly 11,000 real galaxies at their real places (Celestia's catalogue: the NGC/IC catalogues
//    plus nearby dwarf galaxies, with distances from NED). Each one is a little picture tipped to
//    its real tilt. Far-off ones shrink to dots that keep their real share of light, so you see the
//    crowds (like the Virgo Cluster) and the empty spaces between them.
// 2. The Hubble Ultra Deep Field: all 1,700-odd galaxies cut out of the real picture and spread out
//    in depth (the redder and smaller, the farther), so you can fly in among them. Seen from the
//    front it is exactly the photo.

const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const loader = new THREE.TextureLoader();
function tex(url) {
  const t = loader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function octDecode(x, y, out) {
  let z = 1 - Math.abs(x) - Math.abs(y);
  if (z < 0) { const ox = x; x = (1 - Math.abs(y)) * (ox >= 0 ? 1 : -1); y = (1 - Math.abs(ox)) * (y >= 0 ? 1 : -1); }
  return out.set(x, y, z).normalize();
}

export function decodeGalaxies() {
  const raw = atob(GAL.b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const dv = new DataView(bytes.buffer);
  const n = GAL.count;
  const [l0, l1] = GAL.lnDist;
  const out = { n, pos: new Float32Array(n * 3), nrm: new Float32Array(n * 3), rad: new Float32Array(n), mag: new Float32Array(n), type: new Uint8Array(n), tile: new Uint8Array(n) };
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const o = i * GAL.rec;
    octDecode(dv.getInt16(o, true) / 32767, dv.getInt16(o + 2, true) / 32767, v);
    const d = Math.exp(l0 + (dv.getUint16(o + 4, true) / 65535) * (l1 - l0));
    out.pos[i * 3] = v.x * d; out.pos[i * 3 + 1] = v.y * d; out.pos[i * 3 + 2] = v.z * d;
    octDecode(dv.getInt8(o + 6) / 127, dv.getInt8(o + 7) / 127, v);
    out.nrm[i * 3] = v.x; out.nrm[i * 3 + 1] = v.y; out.nrm[i * 3 + 2] = v.z;
    out.rad[i] = Math.pow(10, 2.5 + (bytes[o + 8] / 255) * 3);
    out.mag[i] = bytes[o + 9] / 20 - 24;
    out.type[i] = bytes[o + 10];
    out.tile[i] = bytes[o + 11];
  }
  return out;
}

const GAL_VERT = /* glsl */ `
  attribute vec2 corner;
  attribute vec3 iPos, iNrm;
  attribute float iRad, iBright, iKind, iRot, iPhoto, iTile;
  uniform float uProj, uMinPx, uK, uCells, uNearFade;
  varying vec2 vUv, vCorner; varying float vB, vDot;
  void main(){
    vec4 mvC = modelViewMatrix * vec4(iPos, 1.0);
    float d = max(-mvC.z, 1e-6);
    float px = iRad * uProj / d;                       // radius on screen (px)
    float sc = max(1.0, uMinPx / max(px, 1e-6));      // tiny ones grow into a visible dot...
    float b = iBright * uK * pow(1.0 / (sc * sc), 0.42); // ...but keep (some of) their real share of light
    if (iPhoto > 0.5) b *= 1.0 - smoothstep(4.0, 10.0, px); // the real photo takes over close up
    b *= smoothstep(iRad * 0.6, iRad * uNearFade, d);   // don't fill the screen when you fly right through one
    vB = b;
    vDot = smoothstep(1.0, 2.5, sc);  // too small to see its shape: a soft dot instead of the picture
    vCorner = corner;
    float r = iRad * sc;
    float cr = cos(iRot), sr = sin(iRot);
    vec2 cc = vec2(corner.x * cr - corner.y * sr, corner.x * sr + corner.y * cr);
    // a dot faces you; once it's big enough to see, a spiral lies at its real tilt
    vec4 mvB = mvC + vec4(cc * r, 0.0, 0.0);
    vec4 mv = mvB;
    if (iKind < 0.5) {
      vec3 t1 = normalize(cross(iNrm, abs(iNrm.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
      vec3 t2 = cross(iNrm, t1);
      vec4 mvD = modelViewMatrix * vec4(iPos + (t1 * cc.x + t2 * cc.y) * r, 1.0);
      mv = mix(mvB, mvD, smoothstep(2.0, 1.0, sc));
    }
    float tx = mod(iTile, uCells), ty = floor(iTile / uCells);
    vUv = (vec2(tx, uCells - 1.0 - ty) + corner * 0.5 + 0.5) / uCells;
    gl_Position = projectionMatrix * mv;
    if (b < 0.0015 || mvC.z > 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
`;
const GAL_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  varying vec2 vUv, vCorner; varying float vB, vDot;
  void main(){
    vec3 c = texture2D(uMap, vUv).rgb;
    float r2 = dot(vCorner, vCorner);
    vec3 dot = vec3(1.0, 0.93, 0.84) * exp(-r2 * 5.0) * 0.8;
    gl_FragColor = vec4(mix(c, dot, vDot) * vB, 1.0);
  }
`;
const DF_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  varying vec2 vUv; varying float vB;
  void main(){ gl_FragColor = vec4(texture2D(uMap, vUv).rgb * vB, 1.0); }
`;

const DF_VERT = /* glsl */ `
  attribute vec2 corner;
  attribute vec3 iPos; attribute vec4 iRect; attribute vec2 iHalf;
  uniform float uK, uProj;
  uniform vec2 uAtlas;
  varying vec2 vUv; varying float vB;
  void main(){
    vec4 mvC = modelViewMatrix * vec4(iPos, 1.0);
    float d = max(-mvC.z, 1e-6);
    float r = max(iHalf.x, iHalf.y);
    float px = r * uProj / d;
    float sc = max(1.0, 1.2 / max(px, 1e-6));
    vB = uK * pow(1.0 / (sc * sc), 0.62) * smoothstep(r * 0.8, r * 3.0, d);
    vec4 mv = mvC + vec4(corner * iHalf * sc, 0.0, 0.0);
    vec2 f = vec2(corner.x * 0.5 + 0.5, 0.5 - corner.y * 0.5); // atlas pixels run downwards
    vUv = (iRect.xy + f * iRect.zw) / uAtlas;
    vUv.y = 1.0 - vUv.y;
    gl_Position = projectionMatrix * mv;
    if (vB < 0.0015 || mvC.z > 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
`;

function quadGeometry(n) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('corner', new THREE.Float32BufferAttribute([-1, -1, 1, -1, 1, 1, -1, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.instanceCount = n;
  return g;
}

export class Universe {
  constructor({ touch, base = 'tex/astro/' }) {
    this.touch = touch;
    this.base = base;
    this.group = new THREE.Group();
    this.pixelRatio = 1;
    this.data = decodeGalaxies();
    this.buildCatalogue();
    this.buildDeepField();
  }

  // which catalogue entries have their own real photo (they hand over to it close up)
  static PHOTO_OF = { M31: 'andromeda', M33: 'triangulum', M51: 'whirlpool', M101: 'pinwheel', M104: 'sombrero', M87: 'm87', NGC5128: 'cena' };

  buildCatalogue() {
    const D = this.data, n = D.n;
    const g = quadGeometry(n);
    const r = rng(77);
    const bright = new Float32Array(n), kind = new Float32Array(n), rot = new Float32Array(n), photo = new Float32Array(n), tile = new Float32Array(n);
    const kinds = GAL.tmplKinds;
    for (let i = 0; i < n; i++) {
      // brightness per area, relative to a middle-sized galaxy, squeezed so none vanish or blind you
      const lum = Math.pow(10, -0.4 * (D.mag[i] + 20));
      const sb = lum / Math.pow(D.rad[i] / 30000, 2);
      bright[i] = Math.sqrt(THREE.MathUtils.clamp(sb, 0.15, 6)) * 1.6;
      kind[i] = kinds[D.tile[i]] === 0 ? 0 : 1;
      rot[i] = r() * Math.PI * 2;
      tile[i] = D.tile[i];
    }
    for (const [name, id] of Object.entries(Universe.PHOTO_OF)) {
      const i = GAL.named[name];
      if (i !== undefined) { photo[i] = 1; rot[i] = 0; }
    }
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(D.pos, 3));
    g.setAttribute('iNrm', new THREE.InstancedBufferAttribute(D.nrm, 3));
    g.setAttribute('iRad', new THREE.InstancedBufferAttribute(D.rad, 1));
    g.setAttribute('iBright', new THREE.InstancedBufferAttribute(bright, 1));
    g.setAttribute('iKind', new THREE.InstancedBufferAttribute(kind, 1));
    g.setAttribute('iRot', new THREE.InstancedBufferAttribute(rot, 1));
    g.setAttribute('iPhoto', new THREE.InstancedBufferAttribute(photo, 1));
    g.setAttribute('iTile', new THREE.InstancedBufferAttribute(tile, 1));
    this.catMat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: null }, uProj: { value: 800 }, uMinPx: { value: 1.3 }, uK: { value: 0 }, uCells: { value: 8 }, uNearFade: { value: 2.5 } },
      vertexShader: GAL_VERT, fragmentShader: GAL_FRAG,
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.catalogue = new THREE.Mesh(g, this.catMat);
    this.catalogue.frustumCulled = false;
    this.catalogue.renderOrder = 1;
    this.catalogue.visible = false;
    this.group.add(this.catalogue);
  }

  // position of a named catalogue galaxy (deep frame, ly)
  galaxyPos(name, out = new THREE.Vector3()) {
    const i = GAL.named[name];
    return out.fromArray(this.data.pos, i * 3);
  }

  buildDeepField() {
    const F = DEEP_FIELD;
    const { L, N, E } = skyBasis(F.ra, F.dec);
    this.dfAxis = L.clone();
    this.dfApex = equatorialToDeep(F.ra, F.dec, F.dist);
    const g = new THREE.Group();
    g.position.copy(this.dfApex);
    // local frame: x = west (picture right), y = north (picture up), z = outwards (away from us)
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(E.clone().negate(), N, L.clone().negate()));
    const list = DF.galaxies;
    const n = list.length;
    const [fw, fh] = DF.field;
    const tanA = Math.tan(THREE.MathUtils.degToRad(F.halfAngle));
    // farther = fainter and redder; spread them out in depth by that
    const score = list.map((q, i) => ({ i, s: -q[6] + 1.6 * q[7] }));
    score.sort((a, b) => a.s - b.s);
    const rank = new Float32Array(n);
    score.forEach((o, k) => { rank[o.i] = k / (n - 1); });
    const r = rng(99);
    const pos = new Float32Array(n * 3), rect = new Float32Array(n * 4), half = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const [u, v, ax, ay, pw, ph] = list[i];
      const q = THREE.MathUtils.clamp(rank[i] + (r() - 0.5) * 0.25, 0, 1);
      const s = F.length * (0.05 + 0.95 * Math.pow(q, 0.9));
      const k = tanA * s;               // half-width of the view at that depth
      pos[i * 3] = u * k; pos[i * 3 + 1] = v * (fh / fw) * k; pos[i * 3 + 2] = -s;
      rect.set([ax, ay, pw, ph], i * 4);
      half[i * 2] = (pw / fw) * k; half[i * 2 + 1] = (ph / fw) * k;
    }
    const geo = quadGeometry(n);
    geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 3));
    geo.setAttribute('iRect', new THREE.InstancedBufferAttribute(rect, 4));
    geo.setAttribute('iHalf', new THREE.InstancedBufferAttribute(half, 2));
    this.dfMat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: null }, uK: { value: 0 }, uProj: { value: 800 }, uAtlas: { value: new THREE.Vector2(DF.atlas[0], DF.atlas[1]) } },
      vertexShader: DF_VERT, fragmentShader: DF_FRAG,
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.deepField = new THREE.Mesh(geo, this.dfMat);
    this.deepField.frustumCulled = false;
    this.deepField.renderOrder = 1;
    g.add(this.deepField);
    g.visible = false;
    this.dfGroup = g;
    this.group.add(g);
  }
  // where to stand to see the deep field just like Hubble did, and a point inside it to orbit
  get deepFieldApex() { return this.dfApex.clone(); }
  deepFieldTarget(frac = 0.55, out = new THREE.Vector3()) { return out.copy(this.dfApex).addScaledVector(this.dfAxis, DEEP_FIELD.length * frac); }

  release() {
    for (const m of [this.catMat, this.dfMat]) {
      if (m.uniforms.uMap.value) { m.uniforms.uMap.value.dispose(); m.uniforms.uMap.value = null; }
    }
  }

  // z: the zoom (log10 of view distance, ly)
  // boost: the "eye adjusting" when far out, so faint far-off galaxies still show
  update(camera, pxPerRad, z, boost = 1) {
    const k = smooth(4.5, 5.4, z) * boost;
    this.catalogue.visible = k > 0.002;
    if (this.catalogue.visible && !this.catMat.uniforms.uMap.value) this.catMat.uniforms.uMap.value = tex(`${this.base}galaxies.jpg`);
    const u = this.catMat.uniforms;
    u.uK.value = k;
    u.uProj.value = pxPerRad * this.pixelRatio;
    u.uMinPx.value = 1.7 * this.pixelRatio;

    // the deep field: once you're far enough out to see that far, or right there
    const dDF = camera.position.distanceTo(this.dfApex);
    const kd = Math.max(smooth(7.6, 8.4, z), 1 - smooth(DEEP_FIELD.length * 3, DEEP_FIELD.length * 12, dDF));
    this.dfGroup.visible = kd > 0.002;
    if (this.dfGroup.visible && !this.dfMat.uniforms.uMap.value) this.dfMat.uniforms.uMap.value = tex(`${this.base}deepfield.jpg`);
    this.dfMat.uniforms.uK.value = kd * 1.25;
    this.dfMat.uniforms.uProj.value = pxPerRad * this.pixelRatio;
  }
}

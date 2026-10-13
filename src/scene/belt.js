import * as THREE from 'three';
import { kidDistance } from '../data/bodies.js';
import { rockDetail } from './bodies3d.js';
import { noiseGLSL } from './shaders.js';

function rockGeometry(seed, detail = 2) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position; const v = new THREE.Vector3();
  const rnd = mulberry(seed);
  // a few random "waves" of different sizes make a lumpy, chipped rock
  const waves = Array.from({ length: 7 }, (_, i) => ({
    dir: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(),
    f: 1.2 + i * 1.1 + rnd(), ph: rnd() * 6.28, a: 0.22 / (1 + i * 0.7),
  }));
  const stretch = new THREE.Vector3(0.75 + rnd() * 0.5, 0.6 + rnd() * 0.35, 0.7 + rnd() * 0.45);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let n = 1;
    for (const w of waves) n += w.a * Math.sin(v.dot(w.dir) * w.f + w.ph);
    // flatten some bumps into facets, like broken rock
    n = Math.min(n, 1.12 + 0.05 * Math.sin(seed + i));
    v.multiplyScalar(n).multiply(stretch);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function makeBelt(count = 3200) {
  const group = new THREE.Group();
  const rnd = mulberry(42);
  const geos = [rockGeometry(1, 1), rockGeometry(7, 1), rockGeometry(13, 1), rockGeometry(29, 1)];
  const mat = rockDetail(new THREE.MeshStandardMaterial({ color: 0x9a8f80, roughness: 1, metalness: 0 }), 3);
  // Rocks shrink away with distance: up close you fly through a field of boulders,
  // from far away they don't paint a fake band across the sky (the dust ring does that job)
  const detail = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader) => {
    detail(shader);
    shader.uniforms.fadeNear = { value: 26 };
    shader.uniforms.fadeFar = { value: 58 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float fadeNear, fadeFar;')
      .replace('vRockPos=position;', `vRockPos=position;
        vec4 instC = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        transformed *= 1.0 - smoothstep(fadeNear, fadeFar, distance(instC.xyz, cameraPosition));`);
  };
  const per = Math.ceil(count / geos.length);
  const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e = new THREE.Euler(); const s = new THREE.Vector3(); const pos = new THREE.Vector3();
  const color = new THREE.Color();
  geos.forEach((geo, gi) => {
    const inst = new THREE.InstancedMesh(geo, mat, per);
    for (let i = 0; i < per; i++) {
      const au = 2.15 + Math.pow(rnd(), 0.8) * 1.15;
      const r = kidDistance(au) + (rnd() - 0.5) * 2;
      const a = rnd() * Math.PI * 2;
      pos.set(Math.cos(a) * r, (rnd() - 0.5) * 2 * (2 + rnd() * 2) * (rnd() < 0.8 ? 0.5 : 1), -Math.sin(a) * r);
      e.set(rnd() * 6, rnd() * 6, rnd() * 6); q.setFromEuler(e);
      const sz = 0.035 + Math.pow(rnd(), 4) * 0.26;
      s.set(sz, sz, sz);
      m.compose(pos, q, s);
      inst.setMatrixAt(i, m);
      const tone = 0.45 + rnd() * 0.45;
      color.setRGB(tone, tone * (0.92 + rnd() * 0.08), tone * (0.82 + rnd() * 0.1));
      inst.setColorAt(i, color);
    }
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
  });
  return group;
}

// Faint dusty ring that shows where the belt is when you look from far away
export function makeDustRing() {
  const inner = kidDistance(2.1), outer = kidDistance(3.35);
  const mat = new THREE.ShaderMaterial({
    uniforms: { inner: { value: inner }, outer: { value: outer }, opacity: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float inner, outer, opacity; varying vec2 vP;
      ${noiseGLSL}
      void main(){
        float r=length(vP); float t=(r-inner)/(outer-inner);
        float prof=smoothstep(0.0,0.3,t)*smoothstep(1.0,0.55,t);
        float a=atan(vP.y,vP.x);
        float n=0.55+0.45*snoise(vec3(cos(a)*9.0, sin(a)*9.0, t*6.0));
        float g=0.6+0.4*snoise(vec3(vP*0.35, 1.0));
        float alpha=prof*n*g*opacity;
        if(alpha<0.002) discard;
        gl_FragColor=vec4(vec3(0.78,0.7,0.6)*alpha, alpha);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 256, 4), mat);
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 1;
  return ring;
}

// A close-up field of boulders that appears around you when you visit the belt
export function makeRockField(count = 330, radius = 18) {
  const group = new THREE.Group();
  const rnd = mulberry(7);
  const geos = [rockGeometry(3, 3), rockGeometry(11, 3), rockGeometry(19, 3)];
  const mat = rockDetail(new THREE.MeshStandardMaterial({ color: 0x9a8f80, roughness: 1, metalness: 0 }), 2.5);
  const per = Math.ceil(count / geos.length);
  const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e = new THREE.Euler(); const s = new THREE.Vector3(); const pos = new THREE.Vector3();
  const color = new THREE.Color();
  geos.forEach((geo) => {
    const inst = new THREE.InstancedMesh(geo, mat, per);
    for (let i = 0; i < per; i++) {
      // flattened cloud, denser in the middle
      const r = radius * Math.pow(rnd(), 0.7);
      const a = rnd() * Math.PI * 2;
      pos.set(Math.cos(a) * r, (rnd() - 0.5) * 5 * (1 - r / radius * 0.6), Math.sin(a) * r);
      e.set(rnd() * 6, rnd() * 6, rnd() * 6); q.setFromEuler(e);
      const sz = 0.05 + Math.pow(rnd(), 3.5) * 0.75;
      s.set(sz, sz * (0.7 + rnd() * 0.3), sz);
      m.compose(pos, q, s);
      inst.setMatrixAt(i, m);
      const tone = 0.5 + rnd() * 0.45;
      color.setRGB(tone, tone * (0.92 + rnd() * 0.08), tone * (0.82 + rnd() * 0.1));
      inst.setColorAt(i, color);
    }
    group.add(inst);
  });
  return group;
}

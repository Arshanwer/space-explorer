import * as THREE from 'three';
import starData from '../data/stars.json';
import { loadTex } from './textures.js';
import { PHOTO_TO_SCENE } from '../deep/frames.js';

// Star colour from its B-V colour index (blue-white hot stars to orange cool stars).
export function bvToColor(bv) {
  bv = Math.max(-0.4, Math.min(2.0, bv));
  let r, g, b;
  if (bv < 0) { r = 0.62 + 0.38 * (bv + 0.4) / 0.4; g = 0.72 + 0.28 * (bv + 0.4) / 0.4; b = 1; }
  else if (bv < 0.4) { r = 1; g = 1 - 0.06 * bv / 0.4; b = 1 - 0.25 * bv / 0.4; }
  else if (bv < 1.6) { const t = (bv - 0.4) / 1.2; r = 1; g = 0.94 - 0.3 * t; b = 0.75 - 0.5 * t; }
  else { r = 1; g = 0.62; b = 0.22; }
  return new THREE.Color(r, g, b);
}

export function makeStars(radius = 9000) {
  const n = starData.length / 4;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const obliquity = THREE.MathUtils.degToRad(23.44);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const ra = THREE.MathUtils.degToRad(starData[i * 4]);
    const dec = THREE.MathUtils.degToRad(starData[i * 4 + 1]);
    const mag = starData[i * 4 + 2];
    const bv = starData[i * 4 + 3];
    // Equatorial -> ecliptic, then map ecliptic (x,y,z) to scene (x, z-up -> y)
    const xe = Math.cos(dec) * Math.cos(ra), ye = Math.cos(dec) * Math.sin(ra), ze = Math.sin(dec);
    const yEc = ye * Math.cos(obliquity) + ze * Math.sin(obliquity);
    const zEc = -ye * Math.sin(obliquity) + ze * Math.cos(obliquity);
    v.set(xe, zEc, -yEc).multiplyScalar(radius);
    pos.set([v.x, v.y, v.z], i * 3);
    const c = bvToColor(bv);
    const bright = Math.pow(10, -0.4 * (mag - 1.0));
    const b = Math.min(1.6, 0.35 + Math.sqrt(bright) * 0.9);
    col.set([c.r * b, c.g * b, c.b * b], i * 3);
    size[i] = THREE.MathUtils.clamp(5.2 - mag * 0.62, 1.4, 6.5);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { pixelRatio: { value: Math.min(window.devicePixelRatio, 2) }, twinkle: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float size; attribute vec3 color; varying vec3 vC; uniform float pixelRatio; uniform float twinkle;
      void main(){ vC=color*(0.85+0.15*sin(twinkle+position.x*0.013+position.y*0.021));
        vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=size*pixelRatio; }`,
    fragmentShader: /* glsl */ `
      varying vec3 vC;
      void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d); float a=smoothstep(0.5,0.0,r); a=a*a;
        gl_FragColor=vec4(vC*a*1.4,a);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.renderOrder = -1;
  return pts;
}

// The Milky Way photo, turned so its band lines up exactly with the real stars
// (and with the 3D galaxy you can fly out to).
export function makeMilkyWay(radius = 9500, orientation = PHOTO_TO_SCENE) {
  const tex = loadTex('tex/sd/stars.jpg');
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, transparent: true, opacity: 0.55, color: 0x8a96b8 });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 32), mat);
  m.quaternion.setFromRotationMatrix(orientation);
  m.renderOrder = -2;
  return m;
}

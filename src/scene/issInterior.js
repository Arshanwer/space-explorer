import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { ISS_SPOTS, BODY } from '../data/bodies.js';
import { makeEarthMaterial, makeAtmosphere } from './bodies3d.js';
import { loadTex } from './textures.js';
import { noiseGLSL } from './shaders.js';

// A walk-through (well, float-through) of the Space Station's US and Japanese side.
// The real station is a string of metal cans lined with equipment "racks" on all
// four walls, so that's what we build: square tunnels of racks joined by hatches.

function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const STICKERS = ['EXPRESS', 'MSG', 'HRF', 'ARED', 'CHeCS', 'WHC', 'SABL', 'MELFI', 'FIR', 'ER-4', 'CIR', 'GLACIER', 'JEM', 'ECLSS', 'TCS', 'ZSR'];
function rackTexture(seed, kind = 'rack') {
  const r = rng(seed);
  const W = 512, H = 1024;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  // base panel
  const base = kind === 'pod' ? '#d9dde3' : ['#e6e7e2', '#dfe2e4', '#e9e6dd', '#d6dadf'][Math.floor(r() * 4)];
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6);
  if (kind === 'pod') {
    // crew quarters door with fabric curtain
    g.fillStyle = '#3b5f9a'; g.fillRect(40, 60, W - 80, H - 120);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let x = 60; x < W - 60; x += 38) g.fillRect(x, 60, 10, H - 120);
    g.fillStyle = '#c9a227'; g.fillRect(W / 2 - 40, H / 2 - 8, 80, 16);
    g.fillStyle = '#fff'; g.font = 'bold 34px sans-serif'; g.fillText('CREW', W / 2 - 50, 120);
  } else {
    // sub-panels
    let y = 20;
    while (y < H - 60) {
      const h = 90 + r() * 220;
      const inset = 14;
      const tone = 0.86 + r() * 0.12;
      g.fillStyle = `rgb(${tone * 235},${tone * 236},${tone * 232})`;
      g.fillRect(inset, y, W - inset * 2, h - 12);
      g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 3; g.strokeRect(inset, y, W - inset * 2, h - 12);
      // fasteners
      g.fillStyle = 'rgba(60,60,60,0.6)';
      [[inset + 12, y + 12], [W - inset - 12, y + 12], [inset + 12, y + h - 24], [W - inset - 12, y + h - 24]].forEach(([x, yy]) => { g.beginPath(); g.arc(x, yy, 5, 0, 7); g.fill(); });
      const roll = r();
      if (roll < 0.25) { // sticker
        const col = ['#1f5fbf', '#c0392b', '#f1c40f', '#27ae60', '#e67e22'][Math.floor(r() * 5)];
        g.fillStyle = col; g.fillRect(40, y + 30, 160, 44);
        g.fillStyle = col === '#f1c40f' ? '#222' : '#fff'; g.font = 'bold 28px sans-serif';
        g.fillText(STICKERS[Math.floor(r() * STICKERS.length)], 50, y + 62);
      } else if (roll < 0.45) { // buttons and switches
        for (let i = 0; i < 6; i++) { g.fillStyle = ['#333', '#2b6', '#d33', '#fb0'][Math.floor(r() * 4)]; g.fillRect(50 + i * 64, y + 40, 26, 26); }
      } else if (roll < 0.6) { // velcro patches
        g.fillStyle = '#e8e2cf';
        for (let i = 0; i < 3; i++) g.fillRect(40 + r() * 300, y + 20 + r() * (h - 70), 90, 34);
      } else if (roll < 0.72) { // vents
        g.fillStyle = 'rgba(0,0,0,0.35)';
        for (let i = 0; i < 8; i++) g.fillRect(60, y + 26 + i * 10, W - 120, 4);
      }
      y += h;
    }
    // cable bundles across the rack
    const n = 1 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      g.strokeStyle = ['#222', '#555', '#2a4b7c', '#7a1f1f'][Math.floor(r() * 4)]; g.lineWidth = 6 + r() * 6;
      g.beginPath(); const y0 = r() * H; g.moveTo(-10, y0);
      g.bezierCurveTo(W * 0.3, y0 + (r() - 0.5) * 300, W * 0.7, y0 + (r() - 0.5) * 300, W + 10, y0 + (r() - 0.5) * 200); g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function screenTexture(kind) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#0b1a33'; g.fillRect(0, 0, 256, 160);
  if (kind === 0) { // orbit map
    g.fillStyle = '#16406b'; g.fillRect(10, 10, 236, 140);
    g.strokeStyle = '#ffd34d'; g.lineWidth = 3; g.beginPath();
    for (let x = 10; x < 246; x++) g.lineTo(x, 80 + Math.sin(x / 236 * Math.PI * 2) * 45); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(120, 80 + Math.sin(110 / 236 * 6.28) * 45, 6, 0, 7); g.fill();
  } else if (kind === 1) { // graphs
    g.strokeStyle = '#4fe08a'; g.lineWidth = 2;
    for (let k = 0; k < 3; k++) { g.beginPath(); for (let x = 0; x < 256; x += 4) g.lineTo(x, 40 + k * 45 + Math.sin(x * 0.07 + k) * 12 + Math.random() * 6); g.stroke(); }
  } else { // video call
    g.fillStyle = '#2d4f7a'; g.fillRect(8, 8, 240, 144);
    g.fillStyle = '#f2c79b'; g.beginPath(); g.arc(128, 70, 30, 0, 7); g.fill();
    g.fillStyle = '#5a3a22'; g.beginPath(); g.arc(128, 58, 30, Math.PI, 0); g.fill();
    g.fillStyle = '#e74c3c'; g.fillRect(88, 102, 80, 50);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class ISSInterior {
  constructor(onSpot) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.onSpot = onSpot;
    this.floaters = [];
    this.spots = [];
    this.sunPos = new THREE.Vector3(3000, 900, -1200);
    this.build();
  }

  build() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xf4f7ff, 0x6b6f78, 1.4));
    const S = 1.5; // half-width of the square tunnel
    const modules = [
      { id: 'kibo', x0: -27, x1: -14.6, color: 0xe9e6dd, wide: 1.12 },
      { id: 'node2', x0: -14.2, x1: -8.6, pods: true },
      { id: 'destiny', x0: -8.2, x1: 2.0 },
      { id: 'node1', x0: 2.4, x1: 8.0, galley: true },
      { id: 'node3', x0: 8.4, x1: 14.5, cupola: true },
    ];
    this.bounds = { x0: modules[0].x0 + 0.8, x1: modules[modules.length - 1].x1 - 0.8 };
    const rackMats = Array.from({ length: 10 }, (_, i) => new THREE.MeshStandardMaterial({ map: rackTexture(100 + i), roughness: 0.75, metalness: 0.05 }));
    const podMat = new THREE.MeshStandardMaterial({ map: rackTexture(7, 'pod'), roughness: 0.9 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: 0.5, metalness: 0.4 });
    const handrailMat = new THREE.MeshStandardMaterial({ color: 0x3f74c9, roughness: 0.5, metalness: 0.2 });
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e8, emissiveIntensity: 2.6 });
    const cornerMat = new THREE.MeshStandardMaterial({ color: 0xd9dce1, roughness: 0.7, metalness: 0.1 });
    let seed = 1;

    for (const m of modules) {
      const w = S * (m.wide || 1);
      const len = m.x1 - m.x0;
      const rackLen = 1.05;
      const nRacks = Math.max(1, Math.floor(len / rackLen));
      const step = len / nRacks;
      for (let i = 0; i < nRacks; i++) {
        const cx = m.x0 + step * (i + 0.5);
        // four walls: floor, ceiling, left, right (the station has no real "up")
        const walls = [
          { pos: [cx, -w, 0], rot: [-Math.PI / 2, 0, 0] },
          { pos: [cx, w, 0], rot: [Math.PI / 2, 0, 0] },
          { pos: [cx, 0, -w], rot: [0, 0, 0] },
          { pos: [cx, 0, w], rot: [0, Math.PI, 0] },
        ];
        walls.forEach((wl, wi) => {
          if (m.cupola && wi === 0 && Math.abs(cx - 11.4) < 1.0) return; // hole down to the Cupola
          const geo = new THREE.PlaneGeometry(step * 0.96, w * 2 * 0.78);
          let mat = rackMats[(seed++ * 7) % rackMats.length];
          if (m.pods && (wi === 2 || wi === 3) && i % 2 === 0) mat = podMat;
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(...wl.pos); mesh.rotation.set(...wl.rot);
          if (wi < 2) mesh.rotateZ(Math.PI / 2);
          // racks sit a little proud of the hull
          s.add(mesh);
        });
        // light panels in the corners
        if (i % 2 === 0) {
          [[1, 1], [-1, -1]].forEach(([a, b]) => {
            const lp = new THREE.Mesh(new THREE.BoxGeometry(step * 0.7, 0.05, 0.42), lightMat);
            lp.position.set(cx, a * w * 0.89, b * w * 0.89);
            lp.rotation.x = a === b ? -Math.PI / 4 : Math.PI / 4;
            s.add(lp);
          });
        }
        // handrails
        const hr = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, step * 0.7, 10), handrailMat);
        hr.rotation.z = Math.PI / 2; hr.position.set(cx, w * 0.55, -w * 0.88); s.add(hr);
        const hr2 = hr.clone(); hr2.position.set(cx, -w * 0.55, w * 0.88); s.add(hr2);
      }
      // corner beams (the chamfers of the square)
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(len, 0.5, 0.5), cornerMat);
        beam.position.set((m.x0 + m.x1) / 2, a * w * 0.99, b * w * 0.99);
        beam.rotation.x = Math.PI / 4;
        s.add(beam);
      });
    }

    // One continuous outer hull behind all the racks so there are never gaps to the outside,
    // with an opening underneath Node 3 for the Cupola
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x8e939b, side: THREE.BackSide, roughness: 0.8 });
    const HR = 2.9;
    const segs = [[this.bounds.x0 - 2.2, 9.3, null], [9.3, 13.5, [Math.PI * 1.7, Math.PI * 1.6]], [13.5, this.bounds.x1 + 2.2, null]];
    for (const [a, b, arc] of segs) {
      const g = arc ? new THREE.CylinderGeometry(HR, HR, b - a, 32, 1, true, arc[0], arc[1]) : new THREE.CylinderGeometry(HR, HR, b - a, 32, 1, true);
      const h = new THREE.Mesh(g, hullMat);
      h.rotation.z = Math.PI / 2; h.position.x = (a + b) / 2; s.add(h);
    }
    for (const x of [this.bounds.x0 - 2.2, this.bounds.x1 + 2.2]) {
      const cap = new THREE.Mesh(new THREE.CircleGeometry(HR, 32), new THREE.MeshStandardMaterial({ color: 0x8e939b, side: THREE.DoubleSide, roughness: 0.8 }));
      cap.position.x = x; cap.rotation.y = Math.PI / 2; s.add(cap);
    }

    // hatches between modules
    const hatchX = [-14.4, -8.4, 2.2, 8.2];
    hatchX.forEach((x) => this.hatch(x, frameMat));
    // end caps
    [this.bounds.x0 - 0.9, this.bounds.x1 + 0.9].forEach((x, i) => {
      const cap = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), rackMats[i + 3]);
      cap.position.x = x; cap.rotation.y = i === 0 ? Math.PI / 2 : -Math.PI / 2; s.add(cap);
      this.hatch(x + (i === 0 ? 0.05 : -0.05), frameMat, true);
    });

    // some point lights so racks get nice falloff
    [-21, -11.4, -3, 5.2, 11.4].forEach((x) => { const l = new THREE.PointLight(0xfff3e2, 6, 12, 1.6); l.position.set(x, 0.6, 0); s.add(l); });

    this.buildCupola(frameMat);
    this.buildProps();
    this.buildEarth();
    this.addSpots();
  }

  hatch(x, mat, closed = false) {
    const shape = new THREE.Shape();
    const o = 2.0, i = 0.62, rr = 0.18;
    shape.moveTo(-o, -o); shape.lineTo(o, -o); shape.lineTo(o, o); shape.lineTo(-o, o); shape.lineTo(-o, -o);
    const hole = new THREE.Path();
    hole.moveTo(-i + rr, -i); hole.lineTo(i - rr, -i); hole.quadraticCurveTo(i, -i, i, -i + rr); hole.lineTo(i, i - rr);
    hole.quadraticCurveTo(i, i, i - rr, i); hole.lineTo(-i + rr, i); hole.quadraticCurveTo(-i, i, -i, i - rr); hole.lineTo(-i, -i + rr); hole.quadraticCurveTo(-i, -i, -i + rr, -i);
    if (!closed) shape.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 });
    g.translate(0, 0, -0.175);
    const m = new THREE.Mesh(g, closed ? new THREE.MeshStandardMaterial({ color: 0xd6d8dc, roughness: 0.5, metalness: 0.3 }) : mat);
    m.rotation.y = Math.PI / 2; m.position.x = x;
    this.scene.add(m);
  }

  buildCupola(frameMat) {
    const s = this.scene;
    const cx = 11.4;
    // floor plate around the opening, and a short square tunnel down from Node 3
    const tunnelMat = new THREE.MeshStandardMaterial({ color: 0xdfe1e4, roughness: 0.7, side: THREE.DoubleSide });
    const plate = new THREE.Shape(); plate.moveTo(-0.65, -1.25); plate.lineTo(0.65, -1.25); plate.lineTo(0.65, 1.25); plate.lineTo(-0.65, 1.25); plate.lineTo(-0.65, -1.25);
    const ph = new THREE.Path(); ph.moveTo(-0.6, -0.6); ph.lineTo(0.6, -0.6); ph.lineTo(0.6, 0.6); ph.lineTo(-0.6, 0.6); ph.lineTo(-0.6, -0.6); plate.holes.push(ph);
    const plateM = new THREE.Mesh(new THREE.ShapeGeometry(plate), tunnelMat); plateM.rotation.x = -Math.PI / 2; plateM.position.set(cx, -1.49, 0); s.add(plateM);
    for (const [x, z, ry] of [[cx - 0.6, 0, Math.PI / 2], [cx + 0.6, 0, -Math.PI / 2], [cx, -0.6, 0], [cx, 0.6, Math.PI]]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.25), tunnelMat);
      p.position.set(x, -2.12, z); p.rotation.y = ry; s.add(p);
    }
    // the dome: six slanted windows around a round one at the bottom
    const dome = new THREE.Group();
    dome.position.set(cx, -2.9, 0);
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xaad4ff, transparent: true, opacity: 0.08, roughness: 0.05, metalness: 0, depthWrite: false });
    const R0 = 1.15, R1 = 1.9, H = 0.9;
    for (let i = 0; i < 6; i++) {
      const a0 = (i / 6) * Math.PI * 2, a1 = ((i + 1) / 6) * Math.PI * 2;
      const p = [
        new THREE.Vector3(Math.cos(a0) * R1, 0, Math.sin(a0) * R1), new THREE.Vector3(Math.cos(a1) * R1, 0, Math.sin(a1) * R1),
        new THREE.Vector3(Math.cos(a1) * R0, -H, Math.sin(a1) * R0), new THREE.Vector3(Math.cos(a0) * R0, -H, Math.sin(a0) * R0),
      ];
      const g = new THREE.BufferGeometry().setFromPoints([p[0], p[1], p[2], p[0], p[2], p[3]]);
      g.computeVertexNormals();
      dome.add(new THREE.Mesh(g, glass));
      // window frame bars
      [[p[0], p[3]], [p[0], p[1]], [p[3], p[2]]].forEach(([a, b]) => {
        const len = a.distanceTo(b);
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, len, 0.1), frameMat);
        bar.position.copy(a).add(b).multiplyScalar(0.5);
        bar.lookAt(b); bar.rotateX(Math.PI / 2);
        dome.add(bar);
      });
    }
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(R0, 6), glass);
    bottom.rotation.x = Math.PI / 2; bottom.position.y = -H; dome.add(bottom);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 10, 48), frameMat);
    ring.rotation.x = Math.PI / 2; ring.position.y = -H; dome.add(ring);
    // collar
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(R1 + 0.05, R1 + 0.05, 0.25, 6, 1, true), new THREE.MeshStandardMaterial({ color: 0xbfc3c9, side: THREE.DoubleSide, roughness: 0.6 }));
    collar.position.y = 0.12; dome.add(collar);
    // floor around the opening at the top of the dome
    const hex = new THREE.Shape();
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI * 2; const fn = i ? 'lineTo' : 'moveTo'; hex[fn](Math.cos(a) * (R1 + 0.06), Math.sin(a) * (R1 + 0.06)); }
    const sq = new THREE.Path(); sq.moveTo(-0.6, -0.6); sq.lineTo(0.6, -0.6); sq.lineTo(0.6, 0.6); sq.lineTo(-0.6, 0.6); sq.lineTo(-0.6, -0.6); hex.holes.push(sq);
    const lid = new THREE.Mesh(new THREE.ShapeGeometry(hex), new THREE.MeshStandardMaterial({ color: 0xc9ccd2, side: THREE.DoubleSide, roughness: 0.6 }));
    lid.rotation.x = Math.PI / 2; lid.position.y = 0.26; dome.add(lid);
    s.add(dome);
    this.cupolaCenter = new THREE.Vector3(cx, -2.6, 0);
  }

  buildProps() {
    const s = this.scene;
    // Floating water ball
    const waterMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `uniform float time; varying vec3 vN; varying vec3 vV; ${noiseGLSL}
        void main(){ vec3 p=position*(1.0+0.12*snoise(position*2.0+vec3(time*0.6))); vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(p,1.0); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.0-max(dot(normalize(vN),normalize(vV)),0.0),2.0); vec3 c=mix(vec3(0.55,0.8,1.0)*0.35,vec3(0.9,0.97,1.0),f); gl_FragColor=vec4(c,0.35+f*0.6);
        #include <colorspace_fragment>
      }`,
      transparent: true,
    });
    const water = new THREE.Mesh(new THREE.SphereGeometry(0.22, 48, 32), waterMat);
    water.position.set(-3.2, 0.2, 0.3); s.add(water);
    this.water = water;
    this.floaters.push({ obj: water, base: water.position.clone(), sp: 0.5, rot: 0 });

    // Laptops on the lab walls
    for (let i = 0; i < 4; i++) {
      const lap = new THREE.Group();
      const baseM = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.03, 0.32), new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.4 }));
      const scr = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.02), new THREE.MeshStandardMaterial({ color: 0x111, emissive: 0xffffff, emissiveMap: screenTexture(i % 3), emissiveIntensity: 1.3 }));
      scr.position.set(0, 0.15, -0.16); scr.rotation.x = -0.25;
      lap.add(baseM, scr);
      lap.position.set(-6.8 + i * 2.4, -0.2 + (i % 2) * 0.6, -1.32);
      lap.rotation.x = Math.PI / 2; lap.rotation.z = 0;
      lap.rotation.set(Math.PI / 2, 0, 0);
      s.add(lap);
      if (i === 1) this.laptopPos = lap.position.clone();
    }

    // Floating things: a pen, a drink pouch, a torch, and a plush toy dino (crews often bring a zero-g mascot!)
    const add = (mesh, pos, sp) => { mesh.position.copy(pos); s.add(mesh); this.floaters.push({ obj: mesh, base: pos.clone(), sp, rot: 0.3 + Math.random() * 0.5 }); };
    const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 8), new THREE.MeshStandardMaterial({ color: 0x2255cc }));
    add(pen, new THREE.Vector3(4.5, 0.4, -0.4), 0.7);
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.04), new THREE.MeshStandardMaterial({ color: 0xd8c27a, roughness: 0.6, metalness: 0.4 }));
    add(pouch, new THREE.Vector3(5.6, -0.3, 0.5), 0.4);
    const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.22, 12), new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.3 }));
    add(torch, new THREE.Vector3(-18.5, 0.6, 0.4), 0.3);
    add(this.plushDino(), new THREE.Vector3(-1.2, 0.5, 0.6), 0.25);

    // Galley table in Node 1
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.7), new THREE.MeshStandardMaterial({ color: 0xbfc4cc, metalness: 0.4, roughness: 0.4 }));
    table.position.set(5.2, -0.95, 0); s.add(table);
    for (let i = 0; i < 6; i++) {
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.2), new THREE.MeshStandardMaterial({ color: [0xe74c3c, 0xf1c40f, 0x27ae60, 0x2980b9][i % 4], roughness: 0.6 }));
      pack.position.set(4.85 + (i % 3) * 0.3, -0.9, -0.15 + Math.floor(i / 3) * 0.3); s.add(pack);
    }

    // Treadmill on the Node 3 "floor"
    const tread = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.6), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 }));
    const rails = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.08), new THREE.MeshStandardMaterial({ color: 0xc9ccd2, metalness: 0.5 }));
    rails.position.set(0, 0.4, 0.33);
    const rails2 = rails.clone(); rails2.position.z = -0.33;
    tread.add(deck, rails, rails2);
    tread.position.set(9.4, 0, 1.36); tread.rotation.x = Math.PI / 2; tread.rotation.set(-Math.PI / 2, 0, 0);
    s.add(tread);
    // Toilet cabinet
    const loo = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.2, 0.15), new THREE.MeshStandardMaterial({ color: 0xbec8d6, roughness: 0.6 }));
    loo.position.set(13.2, 0, -1.35); s.add(loo);
    const sign = new THREE.Mesh(new THREE.CircleGeometry(0.12, 24), new THREE.MeshStandardMaterial({ color: 0x2c6fd1, emissive: 0x2c6fd1, emissiveIntensity: 0.5 }));
    sign.position.set(13.2, 0.6, -1.27); s.add(sign);
  }

  plushDino() {
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: 0x5fbf6a, roughness: 1 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), m); body.scale.set(1.3, 1, 1);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), m); head.position.set(0.17, 0.09, 0);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 10), m); tail.rotation.z = Math.PI / 2 + 0.3; tail.position.set(-0.22, -0.02, 0);
    const legM = new THREE.MeshStandardMaterial({ color: 0x4aa556, roughness: 1 });
    for (const [x, z] of [[0.07, 0.06], [0.07, -0.06], [-0.07, 0.06], [-0.07, -0.06]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.08, 8), legM); l.position.set(x, -0.11, z); g.add(l); }
    const eyeM = new THREE.MeshStandardMaterial({ color: 0x111111 });
    for (const z of [0.035, -0.035]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), eyeM); e.position.set(0.22, 0.12, z); g.add(e); }
    for (let i = 0; i < 4; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 6), new THREE.MeshStandardMaterial({ color: 0xffb340 })); sp.position.set(0.08 - i * 0.07, 0.13 - Math.abs(i - 1.5) * 0.01, 0); g.add(sp); }
    g.add(body, head, tail);
    g.scale.setScalar(1.4);
    return g;
  }

  buildEarth() {
    // Earth seen from 420 km up: big, curved, right below the Cupola
    const def = BODY.earth;
    const mat = makeEarthMaterial(def, this.sunPos);
    const R = 400;
    const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 160, 120), mat);
    earth.position.set(11.4, -4 - 70 - R, 0); // a little higher than the real station so more of Earth fits in the window
    earth.rotation.z = 0.5;
    this.scene.add(earth);
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.003, 160, 120), new THREE.MeshStandardMaterial({
      color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, roughness: 1, alphaMap: loadTex(def.clouds.sd, { srgb: false }),
    }));
    clouds.position.copy(earth.position);
    this.scene.add(clouds);
    const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.copy(this.sunPos); this.scene.add(sun);
    sun.target = earth;
    const atmo = makeAtmosphere('#6fb3ff', this.sunPos, 0.02, 1.1);
    atmo.scale.setScalar(R * 1.02); atmo.position.copy(earth.position);
    const u = atmo.material.uniforms; u.center.value.copy(earth.position); u.planetR.value = R; u.atmoR.value = R * 1.02;
    this.scene.add(atmo);
    this.earth = earth; this.earthClouds = clouds;
    this.earthSD = { day: mat.uniforms.dayMap.value, clouds: mat.uniforms.cloudMap.value, night: mat.uniforms.nightMap.value };
  }

  // Swap in the sharp 4K Earth while we're on board (promises from the shared texture cache)
  attachEarth([day, clouds, night]) {
    const u = this.earth.material.uniforms;
    this.earthToken = {};
    const token = this.earthToken;
    const skip = () => {}; // offline without the big maps: keep the small ones
    day.then((t) => { if (this.earthToken === token) u.dayMap.value = t; }, skip);
    night.then((t) => { if (this.earthToken === token) u.nightMap.value = t; }, skip);
    clouds.then((t) => { if (this.earthToken === token) { u.cloudMap.value = t; this.earthClouds.material.alphaMap = t; } }, skip);
  }
  detachEarth() {
    this.earthToken = null;
    const u = this.earth.material.uniforms;
    u.dayMap.value = this.earthSD.day; u.nightMap.value = this.earthSD.night; u.cloudMap.value = this.earthSD.clouds;
    this.earthClouds.material.alphaMap = this.earthSD.clouds;
  }

  addSpots() {
    const spots = [
      ['kibo', [-21, 0.6, 0]], ['sleep', [-11.4, 0, -1.2]], ['hatch', [-8.4, -0.85, 0.85]],
      ['science', [-5.2, 1.15, 0.6]], ['water', [-3.2, 0.55, 0.3]], ['laptop', [-4.4, 0.2, -1.15]],
      ['food', [5.2, -0.5, 0]], ['treadmill', [9.4, 0.2, 1.1]], ['toilet', [13.2, 0.4, -1.1]], ['cupola', [11.4, -1.3, 0]],
    ];
    for (const [id, p] of spots) {
      const el = document.createElement('button');
      el.className = 'hotspot';
      el.textContent = ISS_SPOTS[id].icon;
      el.setAttribute('aria-label', ISS_SPOTS[id].name);
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('click', (e) => { e.stopPropagation(); this.onSpot?.(id, new THREE.Vector3(...p)); });
      const o = new CSS2DObject(el);
      o.position.set(...p);
      this.scene.add(o);
      this.spots.push(o);
    }
  }

  // keep the explorer inside the station
  clamp(pos) {
    const inCupolaShaft = Math.abs(pos.x - 11.4) < 0.7 && Math.abs(pos.z) < 0.7;
    pos.x = THREE.MathUtils.clamp(pos.x, this.bounds.x0, this.bounds.x1);
    const w = pos.x < -14.6 ? 1.3 : 1.12;
    pos.z = THREE.MathUtils.clamp(pos.z, -w, w);
    pos.y = THREE.MathUtils.clamp(pos.y, inCupolaShaft ? -3.0 : -w, w);
    if (pos.y < -1.2) { pos.x = THREE.MathUtils.clamp(pos.x, 10.7, 12.1); pos.z = THREE.MathUtils.clamp(pos.z, -0.7, 0.7); }
    return pos;
  }

  update(dt, t, camera) {
    this.water.material.uniforms.time.value = t;
    // only show the circles for things in this part of the station
    if (camera) for (const s of this.spots) s.visible = s.position.distanceTo(camera.position) < 7.5;
    for (const f of this.floaters) {
      f.obj.position.set(f.base.x + Math.sin(t * f.sp) * 0.15, f.base.y + Math.sin(t * f.sp * 1.3 + 1) * 0.12, f.base.z + Math.cos(t * f.sp * 0.8) * 0.1);
      f.obj.rotation.x += dt * f.rot; f.obj.rotation.y += dt * f.rot * 0.7;
    }
    if (this.earth) { this.earth.rotation.y += dt * 0.01; this.earthClouds.rotation.y += dt * 0.0115; this.earthClouds.rotation.z = this.earth.rotation.z; }
  }

  // CSS labels outside the rendered scene would stay frozen on screen, so hide them by hand
  hideSpots() { this.spots.forEach((s) => { s.element.style.display = 'none'; }); }
}

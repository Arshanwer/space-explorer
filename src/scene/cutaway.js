import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import gsap from 'gsap';
import { sphereGeo } from './bodies3d.js';
import { noiseGLSL } from './shaders.js';

const MAX_LAYERS = 5;
const A0 = Math.PI / 4;          // wedge starts here (azimuth)
const A1 = (3 * Math.PI) / 4;    // and ends here; centred on +Z

function faceMaterial(layers, isGas) {
  const outer = new Array(MAX_LAYERS).fill(0);
  const colors = new Array(MAX_LAYERS).fill(0).map(() => new THREE.Color());
  const glows = new Array(MAX_LAYERS).fill(0);
  layers.forEach((l, i) => { outer[i] = l.r1; colors[i] = new THREE.Color(l.color); glows[i] = l.glow || 0; });
  return new THREE.ShaderMaterial({
    uniforms: {
      outer: { value: outer }, colors: { value: colors }, glows: { value: glows },
      count: { value: layers.length }, highlight: { value: -1 }, time: { value: 0 }, gas: { value: isGas ? 1 : 0 },
      reveal: { value: 0 },
    },
    vertexShader: /* glsl */ `varying vec2 vP; varying vec3 vW; void main(){ vP=position.xy; vW=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      #define N ${MAX_LAYERS}
      uniform float outer[N]; uniform vec3 colors[N]; uniform float glows[N]; uniform int count; uniform int highlight; uniform float time; uniform float gas; uniform float reveal;
      varying vec2 vP; varying vec3 vW;
      ${noiseGLSL}
      void main(){
        float r=length(vP);
        if(r>1.0) discard;
        int idx=0;
        for(int i=0;i<N;i++){ if(i<count && r<=outer[i]) idx=i; }
        vec3 c=colors[0]; float g=glows[0]; float o=outer[0]; float inner=0.0;
        for(int i=0;i<N;i++){ if(i==idx){ c=colors[i]; g=glows[i]; o=outer[i]; } }
        for(int i=0;i<N;i++){ if(i==idx+1 && i<count) inner=outer[i]; }
        // texture inside each layer: swirls for hot/liquid layers, grain for rock
        float n=fbm(vec3(vP*6.0, time*0.06*(0.4+g)));
        float swirl=fbm(vec3(vP*3.0+vec2(sin(time*0.2+r*8.0)*0.1), time*0.1));
        c*= 0.82+0.28*mix(n, swirl, clamp(g*1.6+gas*0.5,0.0,1.0));
        // depth shading: darker toward the outside of each layer band
        float band=(r-inner)/max(o-inner,0.001);
        c*= 1.0-0.18*band;
        // thin dark seam between layers
        float edge=smoothstep(0.0,0.006,abs(r-o))*smoothstep(0.0,0.006,abs(r-inner));
        c*= mix(0.35,1.0,edge);
        float pulse= highlight==idx ? 0.35+0.25*sin(time*4.0) : 0.0;
        vec3 col=c*(0.95+g*1.6+pulse);
        if(highlight>=0 && highlight!=idx) col*=0.55;
        col*= reveal;
        gl_FragColor=vec4(col,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.DoubleSide,
  });
}

function halfDisc(phi) {
  // Half disc in the vertical plane at azimuth phi, spanning from the axis outwards.
  const g = new THREE.CircleGeometry(1, 96, -Math.PI / 2, Math.PI);
  const d = new THREE.Vector3(-Math.cos(phi), 0, Math.sin(phi));
  const y = new THREE.Vector3(0, 1, 0);
  const z = new THREE.Vector3().crossVectors(d, y);
  const m = new THREE.Matrix4().makeBasis(d, y, z);
  const mesh = new THREE.Mesh(g, null);
  mesh.applyMatrix4(m);
  return mesh;
}

export class Cutaway {
  constructor(body, surfaceMaterial, onLayerTap) {
    this.body = body;
    this.layers = body.def.inside;
    this.group = new THREE.Group();
    this.onLayerTap = onLayerTap;
    const isGas = ['jupiter', 'saturn', 'uranus', 'neptune', 'sun'].includes(body.def.id);
    this.faceMat = faceMaterial(this.layers, isGas);

    // Main body: three-quarters of the sphere plus two cut faces
    this.main = new THREE.Group();
    const shell = new THREE.Mesh(sphereGeo(A1, Math.PI * 1.5, 128, 80), surfaceMaterial);
    const f1 = halfDisc(A0); f1.material = this.faceMat;
    const f2 = halfDisc(A1); f2.material = this.faceMat;
    this.main.add(shell, f1, f2);

    // The wedge that breaks away
    this.wedge = new THREE.Group();
    const wShell = new THREE.Mesh(sphereGeo(A0, Math.PI / 2, 48, 80), surfaceMaterial);
    const w1 = halfDisc(A0); w1.material = this.faceMat;
    const w2 = halfDisc(A1); w2.material = this.faceMat;
    this.wedge.add(wShell, w1, w2);
    this.group.add(this.main, this.wedge);

    // Labels for each layer on the face
    this.labels = this.layers.map((l, i) => {
      const wrap = document.createElement('div');
      const el = document.createElement('button');
      wrap.appendChild(el);
      el.className = 'label-layer';
      el.style.setProperty('--c', l.color);
      el.textContent = l.name;
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('click', (e) => { e.stopPropagation(); this.onLayerTap?.(i); });
      const obj = new CSS2DObject(wrap);
      // Spread the names out: outer layers higher up, alternating sides; the very middle sits on the axis below
      const n = this.layers.length;
      if (l.r0 === 0) {
        obj.position.set(0, -Math.max(0.1, l.r1 * 0.5), 0);
      } else {
        const rp = l.r0 + (l.r1 - l.r0) * 0.6;
        const ang = THREE.MathUtils.degToRad(75 - i * (55 / Math.max(1, n - 2)));
        const face = i % 2 === 0 ? A0 : A1;
        const d = new THREE.Vector3(-Math.cos(face), 0, Math.sin(face));
        obj.position.copy(d.multiplyScalar(rp * Math.cos(ang))).add(new THREE.Vector3(0, rp * Math.sin(ang), 0));
      }
      return { el, obj, dy: 0 };
    });
  }

  // viewDir: unit vector (world space) from the planet's centre towards where the camera will be
  open(viewDir) {
    const b = this.body;
    this.isOpen = true;
    b.tilt.add(this.group);
    this.labels.forEach((l) => { l.el.classList.remove('show', 'on'); this.main.add(l.obj); });
    // Turn the opening towards the camera (in the tilted planet's own frame)
    const c = b.worldPos(new THREE.Vector3());
    const local = b.tilt.worldToLocal(c.add(viewDir)).normalize();
    this.group.rotation.set(0, Math.atan2(local.x, local.z), 0);
    b.surfaceVisible(false);
    this.wedge.position.set(0, 0, 0); this.wedge.rotation.set(0, 0, 0); this.wedge.scale.setScalar(1);
    const u = this.faceMat.uniforms;
    u.reveal.value = 0;
    this.tl?.kill();
    this.tl = gsap.timeline();
    // a little push outwards, then the chunk floats up and away so the layers show
    this.tl.to(this.wedge.position, { z: 0.22, duration: 0.35, ease: 'power2.in' })
      .to(u.reveal, { value: 1, duration: 0.7 }, 0.15)
      .to(this.wedge.position, { x: -0.95, y: 1.02, z: 0.35, duration: 1.4, ease: 'power3.out' }, 0.35)
      .to(this.wedge.rotation, { x: -0.35, y: 0.95, z: 0.2, duration: 1.5, ease: 'power3.out' }, 0.35)
      .to(this.wedge.scale, { x: 0.5, y: 0.5, z: 0.5, duration: 1.4, ease: 'power3.out' }, 0.35);
    clearTimeout(this.labelTimer);
    this.labelTimer = setTimeout(() => {
      this.labels.forEach((l, i) => setTimeout(() => { if (this.isOpen) l.el.classList.add('show'); }, i * 140));
    }, 1000);
  }

  close(done) {
    this.isOpen = false;
    clearTimeout(this.labelTimer);
    this.tl?.kill();
    this.labels.forEach((l) => l.el.classList.remove('show', 'on'));
    this.tl = gsap.timeline({ onComplete: () => { this.detach(); done?.(); } });
    this.tl.to(this.wedge.position, { x: 0, y: 0, z: 0, duration: 0.9, ease: 'power3.inOut' })
      .to(this.wedge.rotation, { x: 0, y: 0, z: 0, duration: 0.9, ease: 'power3.inOut' }, 0)
      .to(this.wedge.scale, { x: 1, y: 1, z: 1, duration: 0.9, ease: 'power3.inOut' }, 0);
  }

  detach() {
    this.isOpen = false;
    this.tl?.kill();
    clearTimeout(this.labelTimer);
    this.labels.forEach((l) => l.obj.removeFromParent());
    this.group.removeFromParent();
    this.body.surfaceVisible(true);
  }

  setHighlight(i) {
    this.faceMat.uniforms.highlight.value = i;
    this.labels.forEach((l, j) => l.el.classList.toggle('on', j === i));
  }

  update(t) { this.faceMat.uniforms.time.value = t; }

  // Nudge layer names up or down on screen so they never sit on top of each other
  layout(camera, W, H) {
    if (!this.isOpen) return;
    const placed = [];
    const v = new THREE.Vector3();
    for (const l of this.labels) {
      l.obj.getWorldPosition(v).project(camera);
      const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      const w = l.el.offsetWidth || 110, h = l.el.offsetHeight || 34;
      let dy = 0;
      for (let k = 0; k < 10; k++) {
        const r = { x0: x - w / 2 - 4, x1: x + w / 2 + 4, y0: y + dy - h / 2 - 3, y1: y + dy + h / 2 + 3 };
        const hit = placed.find((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0);
        if (!hit) { placed.push(r); break; }
        dy += (r.y0 + r.y1) / 2 < (hit.y0 + hit.y1) / 2 ? hit.y0 - r.y1 - 1 : hit.y1 - r.y0 + 1;
      }
      l.dy += (dy - l.dy) * 0.3;
      l.el.style.transform = `translateY(${l.dy.toFixed(1)}px)`;
    }
  }
}

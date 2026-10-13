import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadTex, glowTexture, loadingManager } from './textures.js';
import { noiseGLSL, perturbGLSL } from './shaders.js';

export const gltfLoader = new GLTFLoader(loadingManager);
// Decode the pictures inside models with a plain <img>. The default path fetch()es a blob:
// address, which strict hosts (a shared link, a locked-down frame) can refuse.
gltfLoader.register((parser) => {
  parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
  parser.textureLoader.setCrossOrigin(parser.options.crossOrigin);
  return { name: 'img_decode' };
});

// A shared claude.ai link only serves web file types, so that build (VITE_PACKED_MODELS=1) ships
// each model as base64 text next to where the .glb would be. Normal builds load the .glb directly.
const PACKED = import.meta.env.VITE_PACKED_MODELS === '1';
function base64ToBuffer(s) {
  if (typeof Uint8Array.fromBase64 === 'function') return Uint8Array.fromBase64(s).buffer;
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
export function loadGLTF(url, onLoad, onError = () => {}) {
  if (!PACKED) { gltfLoader.load(url, onLoad, undefined, onError); return; }
  const key = `${url}.txt`;
  const dir = url.slice(0, url.lastIndexOf('/') + 1);
  loadingManager.itemStart(key);
  fetch(key)
    .then((r) => { if (!r.ok) throw new Error(`${r.status} ${key}`); return r.text(); })
    .then((text) => new Promise((res, rej) => gltfLoader.parse(base64ToBuffer(text.trim()), dir, res, rej)))
    .then(
      (gltf) => { try { onLoad(gltf); } catch (e) { onError(e); } finally { loadingManager.itemEnd(key); } },
      (e) => { loadingManager.itemError(key); loadingManager.itemEnd(key); onError(e); },
    );
}

// Sphere (or slice of one) with UVs that still line up with an equirectangular map.
export function sphereGeo(phiStart = 0, phiLength = Math.PI * 2, w = 128, h = 80) {
  const g = new THREE.SphereGeometry(1, w, h, phiStart, phiLength);
  if (phiLength < Math.PI * 2) {
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, (phiStart + uv.getX(i) * phiLength) / (Math.PI * 2));
  }
  return g;
}
const FULL_SPHERE = sphereGeo();

// ---------------- Sun ----------------
export function makeSunMaterial(def) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: loadTex(def.textureUrl) }, time: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vPos; varying vec3 vLocal;
      void main(){ vUv=uv; vLocal=position; vN=normalize(mat3(modelMatrix)*normal); vec4 wp=modelMatrix*vec4(position,1.0); vPos=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform float time; varying vec2 vUv; varying vec3 vN; varying vec3 vPos; varying vec3 vLocal;
      ${noiseGLSL}
      void main(){
        float n=fbm(vLocal*3.5+vec3(0.0,0.0,time*0.05));
        float n2=snoise(vLocal*14.0-vec3(time*0.08));
        vec2 uv=vUv+vec2(n*0.006,n*0.004);
        vec3 c=texture2D(map,uv).rgb;
        vec3 V=normalize(cameraPosition-vPos);
        float mu=max(dot(normalize(vN),V),0.0);
        float limb=0.45+0.55*pow(mu,0.45);
        c*= (1.05+0.35*n+0.15*n2);
        c=mix(c*vec3(1.0,0.55,0.2), c, limb);
        gl_FragColor=vec4(c*limb*2.4,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export function makeSun(def) {
  const group = new THREE.Group();
  const tilt = new THREE.Group();
  const spin = new THREE.Group();
  group.add(tilt); tilt.add(spin);
  const material = makeSunMaterial(def);
  const mesh = new THREE.Mesh(FULL_SPHERE, material);
  spin.add(mesh);
  const glowA = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,236,190,0.95)', 'rgba(255,140,40,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glowA.scale.setScalar(3.0);
  const glowB = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,170,60,0.55)', 'rgba(255,90,10,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.4 }));
  glowB.scale.setScalar(6.5);
  tilt.add(glowA, glowB);
  return { group, tilt, spin, mesh, material, glows: [glowA, glowB] };
}

// ---------------- Earth ----------------
export function makeEarthMaterial(def, sunPos) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      dayMap: { value: loadTex(def.texture.sd) },
      nightMap: { value: loadTex(def.night.sd) },
      specMap: { value: loadTex(def.spec.sd, { srgb: false }) },
      cloudMap: { value: loadTex(def.clouds.sd, { srgb: false }) },
      normalMap: { value: loadTex(def.normal.sd, { srgb: false }) },
      sunPos: { value: sunPos },
      cloudShift: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vPos;
      void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); vec4 wp=modelMatrix*vec4(position,1.0); vPos=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D dayMap, nightMap, specMap, cloudMap, normalMap; uniform vec3 sunPos; uniform float cloudShift;
      varying vec2 vUv; varying vec3 vN; varying vec3 vPos;
      ${perturbGLSL}
      void main(){
        vec3 N0=normalize(vN);
        vec3 mapN=texture2D(normalMap,vUv).xyz*2.0-1.0; mapN.xy*=0.9;
        vec3 N=perturbN(N0,vPos,vUv,normalize(mapN));
        vec3 L=normalize(sunPos-vPos); vec3 V=normalize(cameraPosition-vPos);
        float ndl0=dot(N0,L); float ndl=dot(N,L);
        float day=smoothstep(-0.12,0.22,ndl0);
        vec3 dayC=texture2D(dayMap,vUv).rgb;
        float cloud=texture2D(cloudMap,vUv+vec2(cloudShift-0.0025,0.0015)).r;
        dayC*= 1.0-0.45*cloud*day;
        vec3 col=dayC*max(ndl,0.0)*1.35 + dayC*0.012;
        float spec=texture2D(specMap,vUv).r;
        vec3 H=normalize(L+V);
        float nh=max(dot(N0,H),0.0);
        col+= vec3(1.0,0.9,0.72)*(pow(nh,160.0)*0.35+pow(nh,24.0)*0.03)*spec*day;
        vec3 night=texture2D(nightMap,vUv).rgb;
        col+= night*vec3(1.0,0.85,0.6)*(1.0-day)*1.4*(1.0-0.6*cloud);
        float fres=pow(1.0-max(dot(N0,V),0.0),3.0);
        col+= vec3(0.35,0.6,1.0)*fres*smoothstep(-0.3,0.5,ndl0)*0.9;
        float twilight=smoothstep(-0.25,0.0,ndl0)*(1.0-smoothstep(0.0,0.25,ndl0));
        col+= vec3(0.9,0.35,0.1)*twilight*0.12;
        gl_FragColor=vec4(col,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  return m;
}

// ---------------- Atmosphere halo ----------------
export function makeAtmosphere(color, sunPos, thickness = 0.06, strength = 1.0) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(color) },
      center: { value: new THREE.Vector3() },
      planetR: { value: 1 },
      atmoR: { value: 1 + thickness },
      sunPos: { value: sunPos },
      strength: { value: strength },
    },
    vertexShader: /* glsl */ `varying vec3 vPos; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vPos=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color, center, sunPos; uniform float planetR, atmoR, strength; varying vec3 vPos;
      void main(){
        vec3 rd=normalize(vPos-cameraPosition);
        vec3 oc=center-cameraPosition;
        float t=dot(oc,rd);
        vec3 closest=cameraPosition+rd*max(t,0.0);
        float d=length(closest-center);
        float h=clamp((atmoR-d)/(atmoR-planetR),0.0,1.0);
        float a=pow(h,2.2);
        vec3 nrm=normalize(closest-center);
        float lit=smoothstep(-0.35,0.45,dot(nrm,normalize(sunPos-center)));
        a*=lit*strength;
        if(a<0.002) discard;
        gl_FragColor=vec4(color*1.4,a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), mat);
  mesh.scale.setScalar(1 + thickness);
  mesh.renderOrder = 2;
  mesh.userData.thickness = thickness;
  return mesh;
}

// ---------------- Saturn's rings ----------------
export function makeRings(sunPos, inner = 1.24, outer = 2.27) {
  const g = new THREE.RingGeometry(inner, outer, 256, 1);
  const pos = g.attributes.position; const uv = g.attributes.uv; const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5); }
  const map = loadTex('tex/sd/saturn_ring.png');
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, sunPos: { value: sunPos }, center: { value: new THREE.Vector3() }, planetR: { value: 1 } },
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vPos; void main(){ vUv=uv; vec4 wp=modelMatrix*vec4(position,1.0); vPos=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform vec3 sunPos, center; uniform float planetR; varying vec2 vUv; varying vec3 vPos;
      void main(){
        vec4 t=texture2D(map,vec2(vUv.x,0.5));
        vec3 L=normalize(sunPos-vPos); vec3 oc=vPos-center;
        float b=dot(oc,L); float c=dot(oc,oc)-planetR*planetR;
        float shadow=(b<0.0 && b*b-c>0.0)?0.08:1.0;
        float a=t.a*0.95;
        if(a<0.01) discard;
        gl_FragColor=vec4(t.rgb*1.15*shadow,a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.DoubleSide, transparent: true, depthWrite: false,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 1;
  return mesh;
}

// ---------------- Generic textured world ----------------
export function makeRockyMaterial(def) {
  const m = new THREE.MeshStandardMaterial({
    map: def.texture ? loadTex(def.texture.sd) : null,
    color: def.texture ? 0xffffff : new THREE.Color(def.color),
    roughness: def.kind === 'planet' && def.radiusEarths > 3 ? 0.85 : 1,
    metalness: 0,
  });
  if (def.normal) { m.normalMap = loadTex(def.normal.sd, { srgb: false }); const k = def.normalScale ?? 1; m.normalScale.set(k, k); }
  return m;
}

// Normalise a loaded model so it fits inside a sphere of radius 1 centred on the origin.
export function normaliseModel(root) {
  const box = new THREE.Box3().setFromObject(root);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  root.position.sub(sphere.center);
  const holder = new THREE.Group();
  holder.add(root);
  holder.scale.setScalar(1 / sphere.radius);
  return holder;
}

export function loadRockModel(url, color) {
  return new Promise((resolve) => {
    loadGLTF(url, (gltf) => {
      const root = gltf.scene;
      root.traverse((o) => {
        if (o.isMesh) {
          if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
          const hasMap = o.material && o.material.map;
          if (!hasMap) {
            o.material = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 1, metalness: 0 });
            rockDetail(o.material);
          }
        }
      });
      resolve(normaliseModel(root));
    }, () => resolve(null));
  });
}

// Adds fine grainy detail to an untextured rock so close-ups don't look like plastic.
export function rockDetail(material, scale = 9) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRockPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRockPos=position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vRockPos;\n${noiseGLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float rn=fbm(vRockPos*${scale.toFixed(1)});
        float rn2=snoise(vRockPos*${(scale * 5).toFixed(1)});
        diffuseColor.rgb*=0.78+0.32*rn+0.08*rn2;`);
  };
  return material;
}

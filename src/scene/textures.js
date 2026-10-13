import * as THREE from 'three';

let maxAniso = 4;
export const setAnisotropy = (n) => (maxAniso = n);

// Everything needed for the first view goes through this manager so the launch screen can show progress.
export const loadingManager = new THREE.LoadingManager();
const managedLoader = new THREE.TextureLoader(loadingManager);
const loader = new THREE.TextureLoader();

const cache = new Map();
export function loadTex(url, { srgb = true } = {}) {
  const key = url + '|' + srgb;
  if (cache.has(key)) return cache.get(key);
  const t = managedLoader.load(url);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = maxAniso;
  t.wrapS = THREE.RepeatWrapping; // planet maps wrap all the way round
  cache.set(key, t);
  return t;
}

// High-resolution maps are reference counted: they are only kept on the graphics chip while
// something is using them, so an iPad never has every 4K map loaded at once.
const hd = new Map();
export function acquireTex(url, srgb = true) {
  let e = hd.get(url);
  if (!e) {
    e = { refs: 0, tex: null };
    e.promise = new Promise((resolve, reject) => {
      loader.load(url, (t) => {
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.anisotropy = maxAniso;
        t.wrapS = THREE.RepeatWrapping;
        e.tex = t;
        resolve(t);
      }, undefined, reject);
    });
    hd.set(url, e);
  }
  e.refs++;
  return e.promise;
}
export function releaseTex(url) {
  const e = hd.get(url);
  if (!e) return;
  e.refs--;
  if (e.refs <= 0) {
    hd.delete(url);
    e.promise.then((t) => { t.dispose(); t.image = null; }).catch(() => {});
  }
}

// Swap a set of material slots to high-res maps; returns a handle that puts the small maps back.
// slots: [{ target, key, url, srgb }] — target[key] is the texture property (material.map or uniform.value)
export function swapHD(slots, onSwap) {
  let active = true;
  const saved = slots.map((s) => ({ ...s, sd: s.target[s.key] }));
  saved.forEach((s) => {
    acquireTex(s.url, s.srgb).then((t) => {
      if (!active) return;
      s.target[s.key] = t;
      onSwap?.();
    }).catch(() => {});
  });
  return {
    restore() {
      if (!active) return;
      active = false;
      saved.forEach((s) => { s.target[s.key] = s.sd; releaseTex(s.url); });
      onSwap?.();
    },
  };
}

// Soft round glow sprite drawn on a canvas.
export function glowTexture(inner = 'rgba(255,220,150,1)', outer = 'rgba(255,140,40,0)', size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.2, inner.replace(/[\d.]+\)$/, '0.5)'));
  grd.addColorStop(0.5, inner.replace(/[\d.]+\)$/, '0.12)'));
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

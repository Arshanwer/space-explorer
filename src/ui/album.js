import { CHALLENGES } from '../data/challenges.js';

// The space camera's photo album, kept on this iPad (IndexedDB). If the browser won't keep
// things (a private window, or a host that blocks storage), photos last until the page closes.

const $ = (s) => document.querySelector(s);
const DB_NAME = 'space-explorer', STORE = 'photos';
let dbp = null;
const memory = []; // fallback store (negative ids, so they never clash with the database's)
let memId = -1;

function openDb() {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbp;
}
// run a transaction; if the browser dropped the connection, open it again and try once more
async function run(mode, fn) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const db = await openDb();
    if (!db) return undefined;
    try { return await tx(db, mode, fn); } catch { dbp = null; }
  }
  throw new Error('storage');
}
function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function savePhoto(blob, meta) {
  const rec = { blob, title: meta.title, icon: meta.icon || '📷', date: Date.now(), challenge: meta.challenge || null };
  try { const id = await run('readwrite', (s) => s.add(rec)); if (id !== undefined) return id; } catch { /* fall through */ }
  rec.id = memId--;
  memory.push(rec);
  return rec.id;
}
async function listPhotos() {
  let list = [];
  try { list = (await run('readonly', (s) => s.getAll())) || []; } catch { list = []; }
  return [...list, ...memory].sort((a, b) => b.date - a.date);
}
async function deletePhoto(id) {
  const i = memory.findIndex((p) => p.id === id);
  if (i >= 0) { memory.splice(i, 1); return; }
  try { await run('readwrite', (s) => s.delete(id)); } catch { /* ignore */ }
}

// ---------- challenges (kept as a little list in localStorage) ----------
const DONE_KEY = 'space-challenges';
export function doneChallenges() { try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY) || '[]')); } catch { return new Set(); } }
function markDone(id) { const s = doneChallenges(); s.add(id); try { localStorage.setItem(DONE_KEY, JSON.stringify([...s])); } catch { /* private mode */ } }
// Which challenges does this photo complete? ctx describes what's on screen.
export function checkChallenges(ctx) {
  const done = doneChallenges();
  const hits = CHALLENGES.filter((c) => { try { return c.test(ctx); } catch { return false; } });
  return { hits, fresh: hits.filter((c) => !done.has(c.id)) };
}
// call once the photo is safely saved
export function completeChallenges(list) { for (const c of list) markDone(c.id); }

// ---------- the album screen ----------
const urls = new Set();
const url = (blob) => { const u = URL.createObjectURL(blob); urls.add(u); return u; };
function freeUrls() { for (const u of urls) URL.revokeObjectURL(u); urls.clear(); }
const fmtDate = (t) => new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(t));

let root = null;
function build() {
  root = document.createElement('div');
  root.id = 'album';
  root.className = 'album';
  root.hidden = true;
  root.innerHTML = `
    <div class="album-panel visor" role="dialog" aria-modal="true" aria-label="My space photos">
      <header class="album-head">
        <h2>My space photos</h2>
        <div class="album-tabs" role="tablist">
          <button class="album-tab" role="tab" data-tab="photos" aria-selected="true">📸 Photos</button>
          <button class="album-tab" role="tab" data-tab="missions" aria-selected="false">🏅 Photo missions</button>
        </div>
        <button class="card-close album-close" aria-label="Close">×</button>
      </header>
      <div class="album-body"></div>
    </div>
    <div class="album-view" hidden>
      <img alt="" />
      <p class="album-view-title"></p>
      <div class="actions">
        <button class="btn btn-sun" data-v="share"><span aria-hidden="true">📤</span> Share</button>
        <button class="btn btn-ghost" data-v="delete"><span aria-hidden="true">🗑️</span> Delete</button>
        <button class="btn btn-ghost" data-v="close"><span aria-hidden="true">◀</span> Back</button>
      </div>
      <p class="album-view-hint">Tip: press and hold the picture to save it to Photos.</p>
      <div class="album-confirm" hidden>
        <p>Delete this photo?</p>
        <div class="actions"><button class="btn btn-rust" data-v="yes">Yes, delete it</button><button class="btn btn-ghost" data-v="no">Keep it</button></div>
      </div>
    </div>`;
  $('#app').appendChild(root);
  root.querySelector('.album-close').onclick = closeAlbum;
  root.addEventListener('pointerdown', (e) => { if (e.target === root) closeAlbum(); });
  root.querySelectorAll('.album-tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
}
let tab = 'photos', viewing = null;
export function isAlbumOpen() { return !!root && !root.hidden; }
export async function openAlbum(which = 'photos') {
  if (!root) build();
  root.hidden = false;
  await showTab(which);
}
export function closeAlbum() {
  if (!root) return;
  root.hidden = true;
  root.querySelector('.album-view').hidden = true;
  viewing = null;
  freeUrls();
}
let tabToken = 0;
async function showTab(which) {
  tab = which;
  const token = ++tabToken;
  root.querySelectorAll('.album-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === which)));
  const body = root.querySelector('.album-body');
  if (which === 'missions') {
    const done = doneChallenges();
    body.innerHTML = `<p class="album-intro">Take a photo of each of these with the 📷 button. You have done ${[...done].filter((d) => CHALLENGES.some((c) => c.id === d)).length} of ${CHALLENGES.length}!</p>
      <ul class="missions">${CHALLENGES.map((c) => `<li class="mission${done.has(c.id) ? ' done' : ''}"><span class="m-icon" aria-hidden="true">${c.icon}</span><div><b>${c.title}</b><span>${c.hint}</span></div><span class="m-tick" aria-label="${done.has(c.id) ? 'Done' : 'Not yet'}">${done.has(c.id) ? '✅' : '⬜'}</span></li>`).join('')}</ul>`;
    return;
  }
  const list = await listPhotos();
  if (token !== tabToken) return; // they switched tabs while we were loading
  freeUrls();
  if (!list.length) {
    body.innerHTML = '<p class="album-empty">No photos yet! Tap the 📷 button at the top to take a picture of anything you find.</p>';
    return;
  }
  body.innerHTML = `<div class="album-grid">${list.map((p, i) => `<button class="album-item" data-i="${i}"><img src="${url(p.blob)}" alt="${p.title}" loading="lazy" /><span>${p.icon} ${p.title}</span></button>`).join('')}</div>`;
  body.querySelectorAll('.album-item').forEach((b) => b.addEventListener('click', () => view(list[+b.dataset.i])));
}
function view(p) {
  viewing = p;
  const v = root.querySelector('.album-view');
  v.hidden = false;
  v.querySelector('img').src = url(p.blob);
  v.querySelector('img').alt = p.title;
  v.querySelector('.album-view-title').textContent = `${p.icon} ${p.title} · ${fmtDate(p.date)}`;
  v.querySelector('.album-confirm').hidden = true;
  v.querySelector('[data-v="share"]').hidden = !canShare(p);
  v.querySelectorAll('[data-v]').forEach((b) => { b.onclick = () => viewAction(b.dataset.v); });
}
function fileOf(p) { return new File([p.blob], `space-photo-${new Date(p.date).toISOString().slice(0, 10)}.jpg`, { type: 'image/jpeg' }); }
function canShare(p) { try { return !!navigator.canShare?.({ files: [fileOf(p)] }); } catch { return false; } }
async function viewAction(x) {
  const v = root.querySelector('.album-view');
  if (x === 'close') { v.hidden = true; viewing = null; return; }
  if (x === 'share' && viewing) {
    try { await navigator.share({ files: [fileOf(viewing)], title: viewing.title, text: `${viewing.title}, from Space Explorer` }); } catch { /* cancelled */ }
  } else if (x === 'delete') v.querySelector('.album-confirm').hidden = false;
  else if (x === 'no') v.querySelector('.album-confirm').hidden = true;
  else if (x === 'yes' && viewing) {
    await deletePhoto(viewing.id);
    v.hidden = true; viewing = null;
    await showTab('photos');
  }
}

// Space Explorer offline helper: keeps a copy of everything it has loaded,
// and can download the whole app when asked so it works with no internet.
// One cache that keeps growing with new versions, so a saved copy keeps working after an update.
// (The app's own files have unique names per version; pictures and models keep their names.)
const CACHE = 'space-explorer';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate' || url.pathname.endsWith('files.json')) {
    // newest page when online, saved page when offline
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
        return res;
      } catch {
        return (await caches.match(req)) || (await caches.match('./')) || (await caches.match('index.html')) || Response.error();
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
    return res;
  })());
});

self.addEventListener('message', (e) => {
  if (e.data?.type !== 'save-all') return;
  const files = e.data.files || [];
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    let done = 0, failed = 0;
    for (const f of ['./', ...files]) {
      try { if (!(await c.match(f))) await c.add(f); } catch { failed++; }
      done++;
      if (done % 3 === 0 || done === files.length + 1) e.source.postMessage({ type: 'save-progress', done, total: files.length + 1, failed });
    }
  })());
});

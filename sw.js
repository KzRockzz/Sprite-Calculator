// Minimal SW to set scope; app-shell caching will be added next
const CACHE = 'app-shell-v1';
self.addEventListener('install', (e) => {
  e.waitUntil((async ()=>{
    const c = await caches.open(CACHE);
    const base = new URL('./', self.registration.scope).toString();
    const urls = ['index.html','styles.css','app.js','manifest.webmanifest'].map(p => new URL(p, base).toString());
    try { await c.addAll(urls); } catch(_) {}
    self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async ()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k!==CACHE).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});
self.addEventListener('fetch', (e) => {
  const {request} = e;
  if (request.method !== 'GET') return;
  e.respondWith((async ()=>{
    const cached = await caches.match(request);
    try {
      const fresh = await fetch(request);
      const c = await caches.open(CACHE);
      c.put(request, fresh.clone());
      return fresh;
    } catch {
      return cached || Response.error();
    }
  })());
});

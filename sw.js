const CACHE = 'spark-v3';
const CORE = ['./', './index.html', './css/app.css', './js/data.js', './js/app.js', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  // Network-first: luôn lấy bản mới nhất từ server, cache chỉ dùng khi offline.
  // Tránh kẹt cache cũ (app.js cũ hiển thị mãi).
  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => { try { c.put(req, copy); } catch(_) {} });
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || Response.error()))
  );
});

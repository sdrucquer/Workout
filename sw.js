// Offline cache. Tries the network first so updates show up right away, and
// falls back to the cached copy when offline or the gym signal is bad.
const VERSION = 'wt-v3';
const FILES = ['./', 'index.html', 'styles.css', 'js/app.js', 'js/program.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-180.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const net = fetch(e.request, { cache: 'no-cache' }).then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; });
    const timeout = new Promise(r => setTimeout(r, 2500));
    try {
      const res = await Promise.race([net, timeout]);
      if (res) return res;
    } catch {}
    return (await cache.match(e.request, { ignoreSearch: true })) || net;
  })());
});

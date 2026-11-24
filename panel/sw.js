/* UNIFORMA ERP - service worker. Solo guarda archivos estáticos (estilos, scripts, fuentes, íconos) para que la app abra rápido
   y muestre un aviso sin conexión. NUNCA guarda datos, sesiones, fotos ni páginas con información de clientes. */
const CACHE = 'uniforma-static-v1';
const STATIC_EXT = /\.(?:css|js|woff2|png|jpg|jpeg|webp|svg|ico|webmanifest)$/i;
const NEVER = /(?:api|photos|backup|lead|labels|manual|track|studio-api|estudio)\.php|\/data\//i;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['offline.html', 'icons/icon-192.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || NEVER.test(url.pathname)) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('offline.html')));
    return;
  }
  if (STATIC_EXT.test(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      const net = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});

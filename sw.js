const CACHE = 'little-viewer-v1.4.2';
const SHELL = [
  './',
  './index.html',
  './assets/css/style.css?v=1.4.2',
  './assets/js/app.js?v=1.4.2',
  './assets/js/bridge.js?v=1.4.2',
  './manifest.webmanifest',
  './assets/icons/code.svg',
  './assets/icons/touch-icon.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('little-viewer-') && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  if (request.mode !== 'navigate' && !SHELL.some(path => new URL(path, self.registration.scope).href === url.href)) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request, { cache: 'no-store' });
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') return (await caches.match(new URL('./index.html', self.registration.scope).href)) || Response.error();
      return Response.error();
    }
  })());
});

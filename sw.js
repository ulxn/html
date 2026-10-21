const CACHE = 'little-viewer-v1.6.2';
const SHELL = [
  './',
  './index.html',
  './assets/css/style.css?v=1.6.2',
  './assets/js/app.js?v=1.6.2',
  './assets/js/bridge.js?v=1.6.2',
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
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('little-viewer-') && key !== CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin ||
      !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  const navigation = request.mode === 'navigate';
  const included = SHELL.some(path => new URL(path, self.registration.scope).href === url.href);
  if (!navigation && !included) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const home = new URL('./index.html', self.registration.scope).href;
    try {
      const result = await fetch(request, { cache: 'no-store' });
      if (result.ok) {
        try { await cache.put(navigation ? home : request, result.clone()); } catch { /* Storage full. */ }
      }
      return result;
    } catch {
      return (await cache.match(navigation ? home : request)) || Response.error();
    }
  })());
});

const cacheName = 'local-budget-app-v2';
const appShell = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(cacheName)
      .then((cache) => cache.addAll(appShell))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  if (isFreshAppAsset(event.request)) {
    event.respondWith(fetchAndCache(event.request));
    return;
  }

  event.respondWith(caches.match(event.request).then((cachedResponse) => cachedResponse ?? fetch(event.request)));
});

function isFreshAppAsset(request) {
  return (
    request.mode === 'navigate' ||
    request.destination === 'script' ||
    request.destination === 'style' ||
    new URL(request.url).pathname === '/' ||
    new URL(request.url).pathname === '/index.html'
  );
}

function fetchAndCache(request) {
  return fetch(request)
    .then((networkResponse) => {
      const responseCopy = networkResponse.clone();
      void caches.open(cacheName).then((cache) => cache.put(request, responseCopy)).catch(() => undefined);
      return networkResponse;
    })
    .catch(() => caches.match(request).then((cachedResponse) => cachedResponse ?? fetch(request)));
}

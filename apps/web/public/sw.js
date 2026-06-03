/* Axis ERP — yangi deployda eski versiya qolmasin: asosan network-first */
const CACHE_NAME = 'axis-erp-v6';
const OFFLINE_URL = '/';

function safeResponse(body, status = 503) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

function networkFirst(request) {
  return fetch(request, { cache: 'no-store' }).catch(async () => {
    const cached = await caches.match(OFFLINE_URL);
    return cached || safeResponse('Offline', 503);
  });
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL).catch(() => undefined)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Next build fayllari va API — service worker aralashmasin
  if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/api/')) return;

  const isDocument =
    event.request.mode === 'navigate' ||
    event.request.destination === 'document' ||
    (event.request.headers.get('accept') || '').includes('text/html');

  // HTML va sahifalar: doim tarmoqdan (deploydan keyin yangi versiya)
  if (isDocument) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Favicon/logo — SW aralashmasin (404/500 da "Failed to convert to Response" bo'lmasin)
  if (
    url.pathname.includes('favicon') ||
    url.pathname.includes('apple-touch-icon') ||
    url.pathname.startsWith('/brand/')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      return cached || safeResponse('', 404);
    }),
  );
});

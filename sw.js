// Blood & Bridle — service worker
//
// Strategy:
//   - HTML/JS/CSS:  network-first (try fresh, fall back to cache)
//   - /assets/*:    cache-first (large immutable images, serve from cache,
//                   refresh in background)
//   - Fonts:        cache-first with long TTL
//   - Other:        network-first
//
// Versioned cache so deploys evict old files. Bump CACHE_VERSION on every
// deploy to force a clean refresh.

const CACHE_VERSION = 'bab-v15-a1';
const STATIC_CACHE = `bab-static-${CACHE_VERSION}`;
const ASSETS_CACHE = `bab-assets-${CACHE_VERSION}`;
const RUNTIME_CACHE = `bab-runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  './',
  './manifest.json',
  './assets/pwa/icon-192.png',
  './assets/pwa/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // Evict old-version caches.
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== ASSETS_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

function isAssetRequest(url) {
  // /assets/* — large media files (images, audio). Cache-first because
  // they're effectively immutable: the URL identifies the asset, and a
  // new deploy means new files.
  return url.pathname.startsWith('/assets/') || url.pathname.startsWith('./assets/');
}

function isHtmlRequest(request) {
  if (request.mode === 'navigate') return true;
  if (request.method !== 'GET') return false;
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET on same origin.
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Network-first for HTML navigations so players always get the latest
  // dashboard. Cache as fallback for offline.
  if (isHtmlRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('./')))
    );
    return;
  }

  // Cache-first for /assets/* — they're the bulk of the install size.
  if (isAssetRequest(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') return response;
          const clone = response.clone();
          caches.open(ASSETS_CACHE).then((cache) => cache.put(request, clone));
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Network-first for everything else (src/*.js, src/*.css).
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        const clone = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Allow the page to skip waiting on update.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
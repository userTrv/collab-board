/*
 * Minimal offline service worker (hand-written instead of @angular/service-worker, see README).
 * Every path is relative to this file, so it works from any sub-path.
 * __VERSION__ and __FILES__ are filled in by scripts/generate-sw.mjs after `ng build`.
 */
const VERSION = '__VERSION__';
const FILES = __FILES__;
const CACHE = `collab-board-${VERSION}`;
const SCOPE = self.registration.scope;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
  // No skipWaiting(): an open tab keeps the version (and lazy chunks) it started with.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('collab-board-') && k !== CACHE).map((k) => caches.delete(k)))),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(SCOPE)) return;

  if (request.mode === 'navigate') {
    // Network first for the HTML shell so deploys show up; cached shell when offline.
    event.respondWith(fetch(request).catch(() => caches.match(new URL('index.html', SCOPE).href)));
    return;
  }
  // Hashed build files are immutable: cache first.
  event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request)));
});

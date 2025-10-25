// service-worker.js
const CACHE_NAME = 'lens-prescription-v2';
// Updated ASSETS list to reflect the actual files in the application structure
const ASSETS = [
  '/',
  '/index.html',
  '/auth.html',
  '/app.html',
  '/app.css',
  '/auth.css',
  '/app.js',
  '/auth.js',
  '/firebase-config.js',
  '/manifest.json'
  // Note: External CDN files (bootstrap, firebase sdk) are usually not cached here
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.filter((cache) => cache !== CACHE_NAME)
                .map((cache) => caches.delete(cache))
            );
        })
    );
});

// service-worker.js - UPDATED VERSION WITH CORS SUPPORT

const CACHE_NAME = 'lens-prescription-v7';
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
];

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - Enhanced for CORS and external resources
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  
  // Handle external resources (ImgBB, etc.) with CORS
  if (url.href.includes('imgbb.com') || 
      url.href.includes('api.imgbb.com')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the CORS response
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(event.request);
        })
    );
    return;
  }

  // Don't cache other external requests aggressively
  if (url.href.includes('firebase') || 
      url.href.includes('googleapis') ||
      url.href.includes('gstatic.com')) {
    return;
  }

  // For HTML files, use network first strategy
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request) || caches.match('/index.html');
        })
    );
    return;
  }

  // For other assets, use cache first
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        });
      })
  );
});

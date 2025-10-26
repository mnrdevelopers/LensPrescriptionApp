// service-worker.js - FIXED VERSION
const CACHE_NAME = 'lens-prescription-v5';
const ASSETS = [
  '/LensPrescriptionApp/',
  '/LensPrescriptionApp/index.html',
  '/LensPrescriptionApp/auth.html',
  '/LensPrescriptionApp/app.html',
  '/LensPrescriptionApp/app.css',
  '/LensPrescriptionApp/auth.css',
  '/LensPrescriptionApp/app.js',
  '/LensPrescriptionApp/auth.js',
  '/LensPrescriptionApp/firebase-config.js',
  '/LensPrescriptionApp/manifest.json',
  '/LensPrescriptionApp/lenslogo.png'
];

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching app shell');
        // Use cache.addAll but catch individual failures
        return Promise.all(
          ASSETS.map(asset => {
            return cache.add(asset).catch(err => {
              console.log('Failed to cache:', asset, err);
            });
          })
        );
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

// Fetch event - FIXED: Better error handling
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and chrome-extension requests
  if (event.request.method !== 'GET' || 
      event.request.url.startsWith('chrome-extension:') ||
      event.request.url.includes('chrome-extension')) {
    return;
  }

  const url = new URL(event.request.url);
  
  // Don't cache Firebase requests or external APIs
  if (url.href.includes('firebase') || 
      url.href.includes('googleapis') ||
      url.href.includes('gstatic.com') ||
      url.href.includes('render.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached version if available
        if (cachedResponse) {
          return cachedResponse;
        }

        // Otherwise make network request
        return fetch(event.request)
          .then((response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Cache the new response
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              })
              .catch(err => {
                console.log('Cache put error:', err);
              });

            return response;
          })
          .catch(() => {
            // If both cache and network fail, show offline page
            if (event.request.headers.get('accept')?.includes('text/html')) {
              return caches.match('/LensPrescriptionApp/index.html');
            }
          });
      })
  );
});

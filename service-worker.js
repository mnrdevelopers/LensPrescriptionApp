// service-worker.js - UPDATED VERSION WITH OFFLINE FALLBACK

const CACHE_NAME = 'lens-prescription-v6'; // Incrementing cache version
const ASSETS = [
  '/', // Root of the app
  '/index.html', // Offline Fallback
  '/auth.html', // Authentication page
  '/app.html', // Main application page (Start URL)
  '/app.css',
  '/auth.css',
  '/app.js',
  '/auth.js',
  '/firebase-config.js',
  '/manifest.json',
  '/lenslogo.png' // Icon/Logo
];

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching app shell');
        // Ensure all critical assets are pre-cached
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

// Fetch event - Enhanced for CORS, external resources, and offline fallback
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

  // Don't cache other external requests aggressively (Firebase, Google APIs)
  if (url.href.includes('firebase') || 
      url.href.includes('googleapis') ||
      url.href.includes('gstatic.com') ||
      url.href.includes('cdn.jsdelivr.net') || // Bootstrap, FontAwesome
      url.href.includes('checkout.razorpay.com')) {
    return;
  }

  // For internal requests, use cache first, falling back to network, and finally to offline page
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Try network
        return fetch(event.request).catch(() => {
            // If both cache and network fail, serve the offline page (index.html)
            console.log('Serving offline fallback for:', event.request.url);
            return caches.match('/index.html');
        });
      })
  );
});

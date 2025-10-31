// service-worker.js - UPDATED WITH PAYMENT PAGE

const CACHE_NAME = 'lens-prescription-v8'; // Incremented version
// --- CRITICAL FIX: Prepended /LensPrescriptionApp to all root-relative paths ---
const APP_BASE_PATH = '/LensPrescriptionApp';
const ASSETS = [
  APP_BASE_PATH + '/', // Root of the app, becomes /LensPrescriptionApp/
  APP_BASE_PATH + '/index.html', // Offline Fallback
  APP_BASE_PATH + '/auth.html', // Authentication page
  APP_BASE_PATH + '/app.html', // Main application page (Start URL)
  APP_BASE_PATH + '/payment.html', // NEW: Payment page
  APP_BASE_PATH + '/app.css',
  APP_BASE_PATH + '/auth.css',
  APP_BASE_PATH + '/payment.css', // NEW: Payment page styles
  APP_BASE_PATH + '/app.js',
  APP_BASE_PATH + '/auth.js',
  APP_BASE_PATH + '/payment.js', // NEW: Payment page logic
  APP_BASE_PATH + '/firebase-config.js',
  APP_BASE_PATH + '/reset-password.html',
  APP_BASE_PATH + '/reset-password.js',
  APP_BASE_PATH + '/manifest.json',
  APP_BASE_PATH + '/lenslogo.png' // Icon/Logo
];
// --------------------------------------------------------------------------------

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching app shell');
        // Cache critical assets, but don't block installation if some fail
        return Promise.allSettled(
          ASSETS.map(asset => 
            // NOTE: The cache.add() call is modified here to directly use the prefixed asset path
            cache.add(asset).catch(err => 
              console.warn(`Failed to cache ${asset}:`, err)
            )
          )
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

// Fetch event - Enhanced caching strategy
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and browser extensions
  if (event.request.method !== 'GET' || 
      event.request.url.startsWith('chrome-extension://') ||
      event.request.url.includes('extension')) {
    return;
  }

  const url = new URL(event.request.url);
  
  // Skip Remote Config requests - always fetch fresh
  if (url.href.includes('firebaseremoteconfig.googleapis.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Skip Razorpay and payment-related requests
  if (url.href.includes('checkout.razorpay.com') ||
      url.href.includes('api.razorpay.com')) {
    return;
  }

  // Handle external APIs (ImgBB) with network-first strategy
  if (url.href.includes('imgbb.com') || 
      url.href.includes('api.imgbb.com')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Only cache successful responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(event.request);
        })
    );
    return;
  }

  // Dynamic resources (Firebase, CDNs) - network first, no aggressive caching
  if (url.href.includes('firebase') || 
      url.href.includes('googleapis') ||
      url.href.includes('gstatic.com') ||
      url.href.includes('cdn.jsdelivr.net') ||
      url.href.includes('bootstrap') ||
      url.href.includes('fontawesome')) {
    
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful responses for CDN resources
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Try cache as fallback
          return caches.match(event.request);
        })
    );
    return;
  }

  // App shell and internal resources - cache first strategy
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached version if available
        if (cachedResponse) {
          // Update cache in background for next visit
          fetchAndCache(event.request);
          return cachedResponse;
        }
        
        // Otherwise, fetch from network
        return fetchAndCache(event.request)
          .catch(() => {
            // If both cache and network fail, serve appropriate offline page
            if (event.request.destination === 'document') {
              // --- CRITICAL FIX: Ensure offline fallback URL is correctly prefixed ---
              return caches.match(APP_BASE_PATH + '/index.html');
            }
            // For other resources, return a generic offline response
            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// Helper function to fetch and cache requests
function fetchAndCache(request) {
  return fetch(request)
    .then((response) => {
      // Check if we received a valid response
      if (!response || response.status !== 200 || response.type !== 'basic') {
        return response;
      }

      // Clone the response
      const responseToCache = response.clone();

      caches.open(CACHE_NAME)
        .then((cache) => {
          cache.put(request, responseToCache);
        });

      return response;
    });
}

// Background sync for offline data (optional enhancement)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Background sync triggered');
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Implement background sync logic here if needed
  // For example, sync offline prescriptions when back online
  console.log('Performing background sync...');
}

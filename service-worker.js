// service-worker.js - OPTIMIZED VERSION WITH INSTANT UPDATES
const CACHE_NAME = 'lens-prescription-v17'; // Increment this with each code change
const APP_BASE_PATH = '/LensPrescriptionApp';

// CRITICAL: Add timestamp to force cache busting
const BUILD_TIMESTAMP = '20241201-1700'; // UPDATE THIS WITH EACH DEPLOYMENT

const ASSETS = [
  `${APP_BASE_PATH}/`,
  `${APP_BASE_PATH}/index.html`,
  `${APP_BASE_PATH}/auth.html`,
  `${APP_BASE_PATH}/app.html`,
  `${APP_BASE_PATH}/app.css`,
  `${APP_BASE_PATH}/auth.css`,
  `${APP_BASE_PATH}/app.js`,
  `${APP_BASE_PATH}/auth.js`,
  `${APP_BASE_PATH}/firebase-config.js`,
  `${APP_BASE_PATH}/reset-password.html`,
  `${APP_BASE_PATH}/reset-password.js`,
  `${APP_BASE_PATH}/manifest.json`,
  `${APP_BASE_PATH}/lenslogo.png`
];

// Install event - SKIP WAITING FOR INSTANT UPDATES
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing version', CACHE_NAME);
  
  // CRITICAL: Skip waiting to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(ASSETS).catch(error => {
          console.warn('Failed to cache some assets:', error);
        });
      })
  );
});

// Activate event - CLAIM CLIENTS FOR INSTANT UPDATES
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating version', CACHE_NAME);
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete ALL old caches (not just different named ones)
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      // CRITICAL: Claim all clients immediately
      return self.clients.claim();
    })
    .then(() => {
      // Send message to all clients to reload
      return self.clients.matchAll();
    })
    .then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'SW_UPDATED',
          version: CACHE_NAME,
          timestamp: BUILD_TIMESTAMP
        });
      });
    })
  );
});

// Fetch event - NETWORK FIRST FOR HTML, CACHE FIRST FOR STATIC ASSETS
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  
  // Skip external services that shouldn't be cached
  if (url.href.includes('firebaseremoteconfig.googleapis.com') ||
      url.href.includes('checkout.razorpay.com') ||
      url.href.includes('api.razorpay.com') ||
      url.href.includes('googleapis.com') ||
      url.href.includes('gstatic.com')) {
    return;
  }

  // HTML pages - Network First (always fresh)
  if (event.request.destination === 'document' || 
      event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the fresh version
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Ultimate fallback
              return caches.match(`${APP_BASE_PATH}/index.html`);
            });
        })
    );
    return;
  }

  // Static assets (CSS, JS, images) - Cache First
  if (event.request.destination === 'style' ||
      event.request.destination === 'script' || 
      event.request.destination === 'image' ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.json')) {
    
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            // Return cached version, but update in background
            fetchAndUpdateCache(event.request);
            return cachedResponse;
          }
          
          // Not in cache, fetch from network
          return fetchAndCache(event.request);
        })
    );
    return;
  }

  // Default: Network First for other requests
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Helper function to fetch and cache
function fetchAndCache(request) {
  return fetch(request)
    .then((response) => {
      // Only cache valid responses
      if (response.status === 200) {
        const responseClone = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => cache.put(request, responseClone));
      }
      return response;
    });
}

// Helper function to update cache in background
function fetchAndUpdateCache(request) {
  fetch(request)
    .then((response) => {
      if (response.status === 200) {
        const responseClone = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => cache.put(request, responseClone));
      }
    })
    .catch(() => {
      // Silently fail - we already have cached version
    });
}

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    event.ports[0].postMessage({
      version: CACHE_NAME,
      timestamp: BUILD_TIMESTAMP
    });
  }
});






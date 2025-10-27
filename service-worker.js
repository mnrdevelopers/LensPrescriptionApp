// service-worker.js - FIXED VERSION WITH ERROR HANDLING

const CACHE_NAME = 'lens-prescription-v6';
const ASSETS = [
  '/',
  '/index.html',
  '/auth.html',
  '/app.html',
  '/reset-password.html',
  '/app.css',
  '/auth.css',
  '/app.js',
  '/auth.js',
  '/reset-password.js',
  '/firebase-config.js',
  '/manifest.json',
  '/lenslogo.png'
];

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(ASSETS).catch(error => {
          console.log('Cache addAll error:', error);
        });
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

// Enhanced Fetch event with better error handling
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and unsupported schemes
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // Skip chrome-extension, extension, and other unsupported schemes
  if (url.protocol === 'chrome-extension:' || 
      url.protocol === 'chrome:' ||
      url.protocol === 'moz-extension:' ||
      url.protocol === 'ms-browser-extension:' ||
      url.href.includes('extension://')) {
    return;
  }

  // Skip favicon.ico requests to avoid 404 errors
  if (url.pathname.endsWith('favicon.ico')) {
    event.respondWith(new Response('', { status: 204 }));
    return;
  }

  // Handle external resources (ImgBB, etc.) with CORS
  if (url.href.includes('imgbb.com') || 
      url.href.includes('api.imgbb.com')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Only cache successful responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone).catch(err => {
                console.log('Cache put error for external resource:', err);
              });
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

  // Don't cache other external requests aggressively
  if (url.href.includes('firebase') || 
      url.href.includes('googleapis') ||
      url.href.includes('gstatic.com') ||
      url.href.includes('cdn.jsdelivr.net') ||
      url.href.includes('cdnjs.cloudflare.com') ||
      url.href.includes('bootstrap') ||
      url.href.includes('fontawesome')) {
    // Network first for CDN resources
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // For HTML files, use network first strategy
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Only cache successful responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone).catch(err => {
                console.log('Cache put error for HTML:', err);
              });
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request) || caches.match('/index.html');
        })
    );
    return;
  }

  // For CSS, JS, and images - cache first strategy
  if (event.request.destination === 'style' || 
      event.request.destination === 'script' ||
      event.request.destination === 'image') {
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(event.request).then((response) => {
            // Only cache successful responses
            if (response.status === 200) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache).catch(err => {
                  console.log('Cache put error for asset:', err);
                });
              });
            }
            return response;
          }).catch(error => {
            console.log('Fetch failed for:', event.request.url, error);
            // Return a fallback for images
            if (event.request.destination === 'image') {
              return new Response('', { status: 404 });
            }
            throw error;
          });
        })
    );
    return;
  }

  // Default: network first for other requests
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Background sync for offline data
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Background sync triggered');
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Implement background sync logic here
  console.log('Performing background sync...');
}
[file content end]

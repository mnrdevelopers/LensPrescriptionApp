// service-worker.js - UPDATED VERSION WITH STALE-WHILE-REVALIDATE STRATEGY

const CACHE_NAME = 'lens-prescription-v6'; // Increment version to force update
const ASSETS = [
  '/',
  '/index.html',
  '/auth.html',
  '/app.html',
  '/inventory.html',
  '/products.html',
  '/reset-password.html',
  '/app.css',
  '/auth.css',
  '/app.js',
  '/auth.js',
  '/inventory.js',
  '/products.js',
  '/payment.js',
  '/reset-password.js',
  '/firebase-config.js',
  '/manifest.json'
  // Note: lenslogo.png and other non-text assets are handled by runtime caching
];

// -----------------------------------------------------
// Cache Strategies
// -----------------------------------------------------

/**
 * Cache First Strategy
 * @param {Request} request 
 */
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Try network if no cache
  const networkResponse = await fetch(request);
  if (networkResponse && networkResponse.status === 200) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
  }
  return networkResponse;
}

/**
 * Network First (for HTML/always fresh content)
 * @param {Request} request 
 */
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, responseClone);
            return networkResponse;
        }
        // Fallback to cache if network fails or response is bad (e.g., 500)
        return await caches.match(request);
    } catch (error) {
        // Network failure, serve from cache
        return await caches.match(request);
    }
}


/**
 * Stale While Revalidate (for APIs)
 * Immediately serves cached data, while fetching a fresh update from the network.
 * @param {Request} request 
 */
async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    
    // Check if the asset is in the cache
    const cachedResponsePromise = cache.match(request);
    
    // Try to get a fresh response from the network
    const networkFetchPromise = fetch(request).then(networkResponse => {
        // If fetch succeeds, update the cache
        if (networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch(error => {
        // Network failed. We rely on the cached response.
        console.warn(`SWR failed for ${request.url}:`, error);
        throw error;
    });

    // Return the cached response immediately if available, otherwise wait for the network response.
    return (await cachedResponsePromise) || networkFetchPromise;
}

// -----------------------------------------------------
// Core Service Worker Events
// -----------------------------------------------------

// Install event: Pre-cache the core shell assets
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

// Activate event: Clear old caches
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

// Fetch event: Apply routing strategies
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === location.origin;
  
  // 1. Skip non-GET requests (e.g., POST, PUT, DELETE) for safety
  if (event.request.method !== 'GET') {
      return;
  }

  // 2. Third-party APIs/Services (ImgBB, Netlify Functions - Stale While Revalidate)
  if (url.href.includes('api.imgbb.com') || url.pathname.includes('/.netlify/functions/')) {
      console.log('Service Worker: Applying SWR for API:', url.pathname);
      // SWR is best for APIs to ensure responsiveness while keeping data fresh.
      event.respondWith(staleWhileRevalidate(event.request));
      return;
  }

  // 3. Third-party CDNs/Scripts (Firebase, Bootstrap, FontAwesome - Cache First)
  // We generally don't want to mess with the caching of these, but this provides a fallback.
  if (url.href.includes('gstatic.com') || 
      url.href.includes('googleapis') ||
      url.href.includes('jsdelivr.net') ||
      url.href.includes('cdnjs.cloudflare.com')) {
      event.respondWith(cacheFirst(event.request));
      return;
  }
  
  // 4. Local HTML files (Network First, with cache fallback)
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  
  // 5. All other local assets (JS, CSS, Images, Manifest - Cache First)
  if (isSameOrigin) {
      event.respondWith(cacheFirst(event.request));
      return;
  }
});

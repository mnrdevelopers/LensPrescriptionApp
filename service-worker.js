// service-worker.js — LENS RX v26 — Full Offline PWA Support
const CACHE_NAME = 'lens-prescription-v26';
const CDN_CACHE  = 'lens-cdn-v26';

const BUILD_TIMESTAMP = '20260820-1800';

// ── LOCAL APP ASSETS (pre-cached at install for 100% offline access) ───────
const LOCAL_ASSETS = [
  '/',
  'index.html',
  'auth.html',
  'app.html',
  'patient.html',
  'payment.html',
  'privacy.html',
  'terms.html',
  'reset-password.html',
  'app.css',
  'auth.css',
  'app.js',
  'auth.js',
  'patient.js',
  'payment.js',
  'reset-password.js',
  'firebase-config.js',
  'manifest.json',
  'lenslogo.png',
  'developer.png'
];

// ── CDN DOMAINS (cache-first on fetch) ────────────────────────────────────
const CDN_DOMAINS = [
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'www.gstatic.com'   // Firebase SDKs
];

// URLs we NEVER cache (live payment processing and live Auth/RemoteConfig API calls)
const NEVER_CACHE = [
  'firebaseremoteconfig.googleapis.com',
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'checkout.razorpay.com',
  'api.razorpay.com',
  'lumberjack.razorpay.com'
];

// ── INSTALL ───────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing', CACHE_NAME);
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching local app shell');
      return Promise.allSettled(
        LOCAL_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] Pre-cache skip:', url, err))
        )
      );
    })
  );
});

// ── ACTIVATE ──────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating', CACHE_NAME);

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name !== CDN_CACHE)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll())
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

// ── FETCH ─────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. Skip live Firebase auth/payment endpoints
  if (NEVER_CACHE.some(domain => url.hostname.includes(domain))) {
    return;
  }

  // 2. CDN Resources — Cache-First with network fallback
  if (CDN_DOMAINS.some(domain => url.hostname === domain)) {
    event.respondWith(cdnCacheFirst(event.request));
    return;
  }

  // 3. HTML Documents — Network-First with cache fallback
  if (
    event.request.destination === 'document' ||
    event.request.headers.get('accept')?.includes('text/html')
  ) {
    event.respondWith(networkFirstHtml(event.request));
    return;
  }

  // 4. Local CSS / JS / Images — Stale-While-Revalidate
  if (
    event.request.destination === 'style' ||
    event.request.destination === 'script' ||
    event.request.destination === 'image' ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webp')
  ) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // 5. Everything else — Network with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return new Response('', { status: 404, statusText: 'Not Found' });
      })
  );
});

// ── STRATEGIES ────────────────────────────────────────────────────────────

/** Cache-First: return cached if available; else fetch, cache, and return */
async function cdnCacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CDN_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('/* Offline — CDN resource unavailable */', {
      status: 200,
      headers: { 'Content-Type': 'text/css' }
    });
  }
}

/** Network-First with cache fallback for HTML pages */
async function networkFirstHtml(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const fallback = await caches.match('index.html');
    if (fallback) return fallback;
    return new Response('<!DOCTYPE html><html><body><h2>Offline</h2><p>Please check your internet connection.</p></body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

/** Stale-While-Revalidate: return cache instantly; update cache in background */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    return cached;
  }

  const networkResponse = await fetchPromise;
  if (networkResponse) {
    return networkResponse;
  }

  return new Response('', {
    status: 404,
    statusText: 'Not Found'
  });
}

// ── MESSAGES ──────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();

  if (event.data?.type === 'CHECK_UPDATE') {
    event.ports[0]?.postMessage({
      version: CACHE_NAME,
      timestamp: BUILD_TIMESTAMP
    });
  }
});

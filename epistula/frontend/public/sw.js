/**
 * Service Worker for Epistula
 * Provides offline support and asset caching
 */

const CACHE_NAME = 'epistula-v1';
const CACHE_URLS = [
  // Only cache static assets that definitely exist
  // Don't cache dynamic routes to avoid errors
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache URLs one by one to avoid failures
      return Promise.allSettled(
        CACHE_URLS.map(url => 
          cache.add(url).catch(err => {
            console.warn('Failed to cache:', url, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API requests (always fetch fresh)
  if (event.request.url.includes('/api/')) {
    return;
  }

  // Skip chrome extensions and other non-http(s) requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        // Return cached version
        return response;
      }

      // Clone the request
      const fetchRequest = event.request.clone();

      return fetch(fetchRequest).then((response) => {
        // Check if valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        // Cache the new response
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache).catch(err => {
            console.warn('Failed to cache response:', event.request.url, err);
          });
        });

        return response;
      }).catch(error => {
        // Network request failed, try to return cached version
        console.warn('Fetch failed; returning offline page if available:', error);
        return caches.match(event.request);
      });
    })
  );
});

// Progressive Web App Service Worker for VTU WhatNow
const CACHE_NAME = 'vtuwhatnow-pwa-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Chrome strictly requires a fetch handler to show the "Install App" prompt.
// CRITICAL: NEVER intercept cross-origin API calls, Render backend calls, or non-static requests!
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  try {
    const url = new URL(event.request.url);

    // Bypass any cross-origin requests (e.g. backend onrender.com) and API endpoints
    if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
      return; // Hand over directly to native browser network stack
    }

    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // Always return a valid Response object, never undefined
        return new Response('Network offline', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' },
        });
      })
    );
  } catch {
    // If URL parsing fails, pass through to native network
  }
});

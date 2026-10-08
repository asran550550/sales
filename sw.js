const CACHE_NAME = 'rose-cosmetics-v2.5';
const ASSETS = [
  './',
  './index.html',
  './css/style.css?v=2.5',
  './js/db.js?v=2.5',
  './js/materials.js?v=2.5',
  './js/products.js?v=2.5',
  './js/pos.js?v=2.5',
  './js/invoices.js?v=2.5',
  './js/inventory.js?v=2.5',
  './js/settings.js?v=2.5',
  './js/app.js?v=2.5',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => {
        console.warn('Some assets could not be pre-cached:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Purging obsolete cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache backend API calls
  if (url.pathname.startsWith('/api')) {
    return;
  }

  // Network-First for HTML documents & navigation to always display newest layout
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || caches.match('./index.html') || caches.match('/');
          });
        })
    );
    return;
  }

  // Network-First for stylesheets and scripts to prevent stale styling bugs
  if (url.pathname.endsWith('.css') || url.pathname.endsWith('.js')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              const ct = cachedResponse.headers.get('content-type') || '';
              // Guard against bad cached HTML masquerading as CSS/JS
              if (ct.includes('text/html')) {
                return new Response('/* Cached asset invalid */', {
                  headers: { 'Content-Type': url.pathname.endsWith('.css') ? 'text/css' : 'application/javascript' }
                });
              }
              return cachedResponse;
            }
            return new Response('/* Offline asset unavailable */', { status: 503 });
          });
        })
    );
    return;
  }

  // Cache-First for static media assets (icons, fonts, images)
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      });
    }).catch(() => {
      return caches.match('./index.html') || caches.match('/');
    })
  );
});

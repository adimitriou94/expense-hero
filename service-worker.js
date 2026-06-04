/* CAPVO PWA service worker — dynamic dock fix release
   App-shell cache only. Supabase/Cloudflare API requests are never cached. */

const CACHE_NAME = 'capvo-app-shell-v1.0.1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/capvo-core.css',
  './css/capvo-components.css',
  './css/capvo-pages.css',
  './css/capvo-mobile.css',
  './js/config.js',
  './js/app/00-core-state.js',
  './js/app/01-ui-selection-toast.js',
  './js/app/02-supabase-data.js',
  './js/app/03-render-dashboard-transactions-income.js',
  './js/app/04-reports-archive.js',
  './js/app/05-income-pickers.js',
  './js/app/06-modals-nav-auth.js',
  './js/app/07-add-center.js',
  './js/app/08-auth-bootstrap.js',
  './js/cards.js',
  './js/sync.js',
  './js/advisor.js',
  './assets/capvo-mark.png',
  './assets/capvo-icon-180.png',
  './assets/capvo-icon-192.png',
  './assets/capvo-icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);

      return cached || network;
    })
  );
});

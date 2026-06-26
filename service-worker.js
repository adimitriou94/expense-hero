/* CAPVO PWA service worker — dynamic dock fix release
   App-shell cache only. Supabase/Cloudflare API requests are never cached. */

const CACHE_NAME = 'capvo-app-shell-v1.15.10';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/capvo-core.css',
  './css/capvo-components.css',
  './css/capvo-pages.css',
  './css/capvo-mobile.css',
  './js/app-version.js',
  // NOTE: config.js intentionally excluded from SW cache — loaded dynamically after activation
  './js/app/00a-supabase.js',
  './js/app/00b-state.js',
  './js/app/00c1-budget-cycle.js',
  './js/app/00c2-holiday-salary.js',
  './js/app/00c3-fixed-budget.js',
  './js/app/01-ui-selection-toast.js',
  './js/app/02a-data-fetch.js',
  './js/app/02b-data-save.js',
  './js/app/02c-wallet-settings.js',
  './js/app/03a-dashboard.js',
  './js/app/03b-transactions.js',
  './js/app/03c1-income-sources.js',
  './js/app/03c2-savings-goals.js',
  './js/app/04a-reports.js',
  './js/app/04b-archive.js',
  './js/app/05-income-pickers.js',
  './js/app/06a-modal-ui.js',
  './js/app/06b-save-actions.js',
  './js/app/06c-nav-auth.js',
  './js/app/06d1-misc-ui.js',
  './js/app/06d2a-onboarding-flow.js',
  './js/app/06d2b-onboarding-render.js',
  './js/app/06d3-finishing.js',
  './js/app/07a-add-center-core.js',
  './js/app/07b-add-center-txcomplete.js',
  './js/app/07c-add-center-v4v5.js',
  './js/app/08-auth-bootstrap.js',
  './js/app/09-wallet-financial-engine.js',
  './js/cards.js',
  './js/sync.js',
  './js/advisor.js',
  './assets/capvo-mark.png',
  './assets/capvo-icon-180.png',
  './assets/capvo-icon-192.png',
  './assets/capvo-icon-512.png',
  './assets/capvo-icon-1024.png',
  './assets/apple-touch-icon.png'
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

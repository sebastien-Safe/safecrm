// S@FE CRM — Service Worker PWA
// Version cache — incrémenter pour forcer la mise à jour
const CACHE_VERSION = 'safe-crm-v2';
const CACHE_STATIC  = 'safe-crm-static-v2';

// Assets à mettre en cache (shell applicatif)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/app.js',
  '/assets/style.css',
  '/assets/config.js',
  '/favicon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  // Fonts locales
  '/assets/fonts/plexsans-400.woff2',
  '/assets/fonts/sora-800.woff2',
];

// ── INSTALLATION ──
self.addEventListener('install', event => {
  console.log('[SW] Installation S@FE CRM PWA');
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })))
        .catch(err => console.warn('[SW] Certains assets non cachés:', err));
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATION ──
self.addEventListener('activate', event => {
  console.log('[SW] Activation S@FE CRM PWA');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC)
          .map(k => { console.log('[SW] Suppression ancien cache:', k); return caches.delete(k); })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH : Stratégie Network First pour l'API, Cache First pour les assets ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignorer les requêtes non-GET et les extensions navigateur
  if (event.request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // Supabase API → toujours réseau (données live)
  if (url.hostname.includes('supabase.co')) return;

  // Google Fonts → cache first
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cached =>
        cached || fetch(event.request).then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_STATIC).then(c => c.put(event.request, clone));
          return resp;
        })
      )
    );
    return;
  }

  // Assets statiques CRM → Cache First avec fallback réseau
  if (url.hostname === self.location.hostname) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(resp => {
          if (resp && resp.status === 200 && resp.type !== 'opaque') {
            const clone = resp.clone();
            caches.open(CACHE_STATIC).then(c => c.put(event.request, clone));
          }
          return resp;
        }).catch(() => {
          // Fallback hors-ligne : renvoyer index.html pour la navigation
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
    );
    return;
  }
});

// ── MESSAGE : forcer la mise à jour ──
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// sw.js — Service Worker BeautyBook
const CACHE_VERSION = 'v1.3.1';
const STATIC_CACHE  = `static-${CACHE_VERSION}`;

// Asset statici principali
const ASSETS = [
  // HTML
  '/index.html','/login.html','/signup.html','/forgot.html','/logout.html',
  '/calendario.html','/giorno.html','/nuovo-appuntamento.html',
  '/rubrica.html','/cliente.html','/statistiche.html','/settings.html',
  '/navbar.html','/reminder-settings.html','/trattamenti-settings.html',

  // Manifest & icone
  '/manifest.json',
  '/icons/iphone_icon_192.png',
  '/icons/iphone_icon_512.png',

  // CSS
  '/calendario.css','/giorno.css','/nuovo-appuntamento.css','/rubrica.css',
  '/cliente.css','/statistiche.css','/reminder-settings.css',
  '/navbar.css','/index.css','/settings.css','/trattamenti-settings.css','/style.css',

  // JS
  '/auth.js','/navbar.js','/swipe.js','/calendario.js','/giorno.js',
  '/nuovo-appuntamento.js','/rubrica.js','/cliente.js','/statistiche.js',
  '/reminder-core.js','/reminder-settings.js','/trattamenti-settings.js',

  // Icone trattamenti
  '/icones_trattamenti/makeup.png',
  '/icones_trattamenti/makeup_sposa.png',
  '/icones_trattamenti/microblading.png',
  '/icones_trattamenti/extension_ciglia.png',
  '/icones_trattamenti/laminazione_ciglia.png',
  '/icones_trattamenti/filo_arabo.png',
  '/icones_trattamenti/architettura_sopracciglia.png',
  '/icones_trattamenti/airbrush_sopracciglia.png',
  '/icones_trattamenti/laser.png',

  // Fallback
  '/icone_uniformate_colore/setting.png'
];

// Install → precache base
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate → pulizia vecchie cache
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== STATIC_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch handler
self.addEventListener('fetch', (e) => {
  const req = e.request;

  // 🔹 Ignora tutte le richieste che non sono GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 🔹 Ignora chiamate Firebase/gstatic
  if (url.origin.includes('firebaseio') || url.host.includes('gstatic.com')) return;

  // 🔹 HTML → network-first
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(STATIC_CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('/index.html')))
    );
    return;
  }

  // 🔹 Asset statici → cache-first + update in background
  e.respondWith(
    caches.match(req).then(cached => {
      const fetchPromise = fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// 🔄 Messaggi da auth.js
self.addEventListener("message", (event) => {
  if (event.data?.type === "PRECACHE_PAGES") {
    caches.open(STATIC_CACHE).then(c => {
      console.log("[SW] Refresh assets richiesto");
      return c.addAll(ASSETS);
    });
  }
});
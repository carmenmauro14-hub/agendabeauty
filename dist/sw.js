// sw.js — Service Worker BeautyBook
const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE  = `static-${CACHE_VERSION}`;

// Asset statici principali della tua app
const ASSETS = [
  // Pagine HTML
  '/index.html',
  '/login.html',
  '/signup.html',
  '/forgot.html',
  '/logout.html',
  '/calendario.html',
  '/giorno.html',
  '/nuovo-appuntamento.html',
  '/rubrica.html',
  '/cliente.html',
  '/statistiche.html',
  '/navbar.html',

  // Manifest & icone
  '/manifest.json',
  '/icons/iphone_icon_192.png',
  '/icons/iphone_icon_512.png',

  // CSS
  '/calendario.css',
  '/giorno.css',
  '/nuovo-appuntamento.css',
  '/rubrica.css',
  '/cliente.css',
  '/statistiche.css',
  '/reminder-settings.css',
  '/navbar.css',

  // JS
  '/auth.js',
  '/navbar.js',
  '/swipe.js',
  '/calendario.js',
  '/giorno.js',
  '/nuovo-appuntamento.js',
  '/rubrica.js',
  '/cliente.js',
  '/statistiche.js',
  '/reminder-core.js',
  '/trattamenti-settings.js',

  // Font Awesome (se usi kit locale, altrimenti viene da CDN)
  // '/fontawesome/css/all.min.css',
  // '/fontawesome/webfonts/fa-solid-900.woff2',

  // Cartella icone trattamenti (aggiungi quelle realmente usate)
  '/icones_trattamenti/makeup.png',
  '/icones_trattamenti/makeup_sposa.png',
  '/icones_trattamenti/microblading.png',
  '/icones_trattamenti/extension_ciglia.png',
  '/icones_trattamenti/laminazione_ciglia.png',
  '/icones_trattamenti/filo_arabo.png',
  '/icones_trattamenti/architettura_sopracciglia.png',
  '/icones_trattamenti/airbrush_sopracciglia.png',
  '/icones_trattamenti/laser.png',

  // Fallback icona
  '/icone_uniformate_colore/setting.png'
];

// install: precache statici
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// activate: pulizia cache vecchie
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== STATIC_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// fetch: network-first per HTML, cache-first per statici
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // lascia passare Firestore/Auth
  if (url.origin.includes('firebaseio') || url.host.includes('gstatic.com')) return;

  // HTML → network-first con fallback
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

  // Statici → cache-first
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        const copy = res.clone();
        if (req.method === 'GET' && res.ok && url.origin === location.origin) {
          caches.open(STATIC_CACHE).then(c => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
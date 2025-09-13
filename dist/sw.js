// sw.js — Service Worker BeautyBook (robusto)
const CACHE_VERSION = "v1.5.2";              // bump per forzare refresh
const STATIC_CACHE  = `static-${CACHE_VERSION}`;

const ASSETS = [
  // HTML
  "/index.html","/login.html","/signup.html","/forgot.html","/logout.html",
  "/calendario.html","/giorno.html","/nuovo-appuntamento.html",
  "/rubrica.html","/cliente.html","/statistiche.html","/settings.html",
  "/navbar.html","/reminder-settings.html","/trattamenti-settings.html",
  "/debug.html",
  // Manifest & icone
  "/manifest.json","/icons/iphone_icon_192.png","/icons/iphone_icon_512.png",
  // CSS
  "/calendario.css","/giorno.css","/nuovo-appuntamento.css","/rubrica.css",
  "/cliente.css","/statistiche.css","/reminder-settings.css","/navbar.css",
  "/index.css","/settings.css","/trattamenti-settings.css","/style.css",
  // JS
  "/auth.js","/navbar.js","/swipe.js","/calendario.js","/giorno.js",
  "/nuovo-appuntamento.js","/rubrica.js","/cliente.js","/statistiche.js",
  "/reminder-core.js","/reminder-settings.js","/trattamenti-settings.js",
  "/storage.js","/ui.js","/debug.js",
  // Icone trattamenti
  "/icones_trattamenti/makeup.png",
  "/icones_trattamenti/makeup_sposa.png",
  "/icones_trattamenti/microblading.png",
  "/icones_trattamenti/extension_ciglia.png",
  "/icones_trattamenti/laminazione_ciglia.png",
  "/icones_trattamenti/filo_arabo.png",
  "/icones_trattamenti/architettura_sopracciglia.png",
  "/icones_trattamenti/airbrush_sopracciglia.png",
  "/icones_trattamenti/laser.png",
  // Fallback
  "/icone_uniformate_colore/setting.png"
];

// Install → precache base (non fallisce se un asset manca)
self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(STATIC_CACHE);
    await Promise.allSettled(ASSETS.map(u => c.add(u)));
    await self.skipWaiting();
  })());
});

// Activate → pulizia vecchie cache
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== STATIC_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Fetch
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const host = url.hostname;

  // lascia passare SDK/asset esterni
  if (host.includes("firebaseio.com") || host.includes("gstatic.com") || host.includes("googleapis.com")) return;

  // HTML → cache-first con revalidate; debug.html cache-only
  const isHTML = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  if (isHTML) {
    if (url.pathname.endsWith("/debug.html")) {
      e.respondWith(caches.match(req).then(r => r || fetch(req)).catch(() => caches.match("/index.html")));
      return;
    }

    e.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(req);
      // aggiorna in background quando online
      e.waitUntil(fetch(req).then(res => cache.put(req, res.clone())).catch(() => {}));
      return cached || fetch(req).catch(() => caches.match("/index.html"));
    })());
    return;
  }

  // CSS/JS/immagini → stale-while-revalidate
  e.respondWith((async () => {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(req);
    const network = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return cached || network || new Response("", { status: 504 });
  })());
});

// Messaggi dalla pagina
self.addEventListener("message", (event) => {
  if (event.data?.type === "PRECACHE_PAGES") {
    event.waitUntil(caches.open(STATIC_CACHE).then(c => Promise.allSettled(ASSETS.map(u => c.add(u)))));
  }
});
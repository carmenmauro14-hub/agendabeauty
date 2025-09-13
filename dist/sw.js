// sw.js — Service Worker BeautyBook (con log extra)
const CACHE_VERSION = "v1.6.0"; // bump → forza refresh
const STATIC_CACHE  = `static-${CACHE_VERSION}`;

const ASSETS = [
  // HTML
  "/index.html","/login.html","/signup.html","/forgot.html","/logout.html",
  "/calendario.html","/giorno.html","/nuovo-appuntamento.html",
  "/rubrica.html","/cliente.html","/statistiche.html","/settings.html",
  "/navbar.html","/reminder-settings.html","/trattamenti-settings.html",
  "/debug.html",

  // Manifest & icone
  "/manifest.json",
  "/icons/iphone_icon_192.png",
  "/icons/iphone_icon_512.png",

  // CSS
  "/calendario.css","/giorno.css","/nuovo-appuntamento.css","/rubrica.css",
  "/cliente.css","/statistiche.css","/reminder-settings.css",
  "/navbar.css","/index.css","/settings.css","/trattamenti-settings.css","/style.css",

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

// Install → precache base
self.addEventListener("install", (e) => {
  console.log("[SW] Install: precache", CACHE_VERSION);
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate → pulizia vecchie cache
self.addEventListener("activate", (e) => {
  console.log("[SW] Activate: pulizia vecchie cache");
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch handler
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // ignora Firebase/gstatic
  if (url.origin.includes("firebaseio") || url.host.includes("gstatic.com")) return;

  // HTML → network-first, con eccezione per debug.html
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    if (url.pathname.endsWith("/debug.html")) {
      console.log("[SW] Serve debug.html offline");
      e.respondWith(caches.match(req).then(r => r) || fetch(req));
      return;
    }

    e.respondWith(
      fetch(req).then((res) => {
        console.log("[SW] Network HTML:", url.pathname);
        const copy = res.clone();
        caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => {
        console.warn("[SW] Offline HTML:", url.pathname);
        return caches.match(req).then((r) => r || caches.match("/index.html"));
      })
    );
    return;
  }

  // CSS/JS/immagini → cache-first
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        console.log("[SW] Cache hit:", url.pathname);
      } else {
        console.log("[SW] Cache miss:", url.pathname);
      }

      const fetchPromise = fetch(req).then((res) => {
        if (res.ok) {
          caches.open(STATIC_CACHE).then((c) => c.put(req, res.clone()));
          console.log("[SW] Aggiornato da rete:", url.pathname);
        }
        return res;
      }).catch(() => {
        console.warn("[SW] Offline serve cache:", url.pathname);
        return cached;
      });

      return cached || fetchPromise;
    })
  );
});

// Messaggi da app
self.addEventListener("message", (event) => {
  if (event.data?.type === "PRECACHE_PAGES") {
    console.log("[SW] Forzo refresh assets");
    caches.open(STATIC_CACHE).then((c) => c.addAll(ASSETS));
  }
});
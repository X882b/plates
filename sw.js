// Bump this string every time you change index.html, or phones keep the old copy.
const VERSION = "plates-v11";

const FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable.png"
];

// On install, pull everything into the cache and take over immediately.
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

// On activate, throw away caches from older versions.
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Serve from cache first so the app opens with no signal.
// Refresh the cached copy in the background when there is a connection.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(hit => {
      const live = fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || live;
    })
  );
});

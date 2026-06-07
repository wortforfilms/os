// Isolated service worker for the Aadhyatmik app.
// Scope: /apps/aadhyatmik/ — its own cache, never shared with other apps.
const CACHE = "maataa-aadhyatmik-v1";
const SCOPE = "/apps/aadhyatmik/";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", "./index.html", "./manifest.webmanifest", "./favicon.svg"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Drop only THIS app's stale caches; leave other apps' caches untouched (isolation).
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith("maataa-aadhyatmik-") && k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Only serve requests inside this app's isolated scope.
  if (!url.pathname.startsWith(SCOPE)) return;
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(event.request).then((hit) => hit || fetch(event.request).then((res) => {
        if (res.ok && event.request.method === "GET") cache.put(event.request, res.clone());
        return res;
      })),
    ),
  );
});

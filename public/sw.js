const CACHE_NAME = "boi-ech-webapp-v2";
const APP_SHELL = ["/", "/manifest.webmanifest", "/favicon.svg", "/icon-192.png", "/icon-512.png", "/thanh-toan-mb.jpeg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/bien-tap-noi-dung") || url.pathname.startsWith("/quan-ly-thiet-bi") || url.pathname.startsWith("/signin-") || url.pathname.startsWith("/signout-")) return;

  if (url.pathname.startsWith("/course-media/") || /\.(?:css|js|svg|png|jpe?g|webp|woff2?)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        return response;
      })),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/")).then((response) => response || new Response("Ứng dụng chưa được lưu để học offline.", { status: 503 })));
  }
});

const CACHE_NAME = "boi-ech-webapp-v5";
// This worker owns only boi-ech-webapp-vN caches. Never delete separate
// MediaPipe offline AI caches or caches belonging to other applications.
const LEGACY_APP_SHELL_CACHE = /^boi-ech-webapp-v\d+$/;
const APP_SHELL = ["/", "/manifest.webmanifest", "/favicon.svg", "/icon-192.png", "/icon-512.png", "/thanh-toan-mb.jpeg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => LEGACY_APP_SHELL_CACHE.test(key) && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/bien-tap-noi-dung") || url.pathname.startsWith("/quan-ly-thiet-bi") || url.pathname.startsWith("/signin-") || url.pathname.startsWith("/signout-")) return;

  // Versioned JS/CSS must never be served cache-first across releases.
  // A cached entry can belong to an old Worker build and point at removed
  // lazy chunks. Network-first online; offline fallback only on network error.
  if (/^\/assets\/[^/]+\.(?:js|css)$/i.test(url.pathname)) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const type = response.headers.get("content-type") || "";
        const valid = url.pathname.endsWith(".js")
          ? /javascript|ecmascript/i.test(type) : /text\/css/i.test(type);
        if (response.ok && valid) {
          event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone())));
        }
        // Never substitute cached JS for an online 404 or an HTML fallback.
        return response;
      } catch {
        return (await caches.match(request)) ||
          new Response("Không tải được mã ứng dụng khi ngoại tuyến.", {status: 503});
      }
    })());
    return;
  }

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

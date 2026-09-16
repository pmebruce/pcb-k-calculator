/* PCB offline shell. Replaced with a content-derived cache ID at build time. */
const CACHE = "__CACHE_NAME__";
const ASSETS = __PRECACHE_ASSETS__;
const ASSET_PATHS = new Set(ASSETS);
const APP_ROUTE_CACHE_KEYS = new Map(__APP_ROUTE_CACHE_KEYS__);
const APP_ROUTES = new Set(APP_ROUTE_CACHE_KEYS.keys());

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      await Promise.all(ASSETS.map(async (path) => {
        const response = await fetch(new Request(path, { cache: "reload", credentials: "same-origin", redirect: "error" }));
        if (!response.ok || response.redirected || response.type === "opaque") throw new Error("Offline asset unavailable");
        const contentType = response.headers.get("content-type") || "";
        const normalizedPath = path.replace(/\/$/, "") || "/";
        if (APP_ROUTES.has(normalizedPath) && (!contentType.includes("text/html") || !(await response.clone().text()).includes('id="board-settings"'))) throw new Error("Invalid app shell");
        if (path.endsWith(".js") && !/(javascript|ecmascript)/i.test(contentType)) throw new Error("Invalid script");
        if (path.endsWith(".css") && !contentType.includes("text/css")) throw new Error("Invalid stylesheet");
        await cache.put(path, response);
      }));
    } catch (error) { await caches.delete(CACHE); throw error; }
    // Updates wait until the user chooses to reload; first install activates normally.
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("pcb-shell-") && name !== CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const page = url.pathname.replace(/\/$/, "") || "/";
  const isHome = request.mode === "navigate" && APP_ROUTES.has(page);
  if (APP_ROUTES.has(page) && !isHome) return;
  if (!isHome && !ASSET_PATHS.has(url.pathname)) return;
  // Never intercept login routes or external traffic. Keep the current app shell
  // and its hashed chunks together until the update has been fully precached.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const response = await cache.match(isHome ? APP_ROUTE_CACHE_KEYS.get(page) : url.pathname);
    if (response) return response;
    return fetch(request);
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") { self.skipWaiting(); return; }
  if (event.data?.type === "CHECK_OFFLINE") {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      const cached = await Promise.all(ASSETS.map((path) => cache.match(path)));
      event.ports[0]?.postMessage({ type: "OFFLINE_READY", ready: cached.every(Boolean), routes: [...APP_ROUTES] });
    })());
  }
});

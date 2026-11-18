/* Agent Space service worker — installable web app + Web Push notifications (§12). Kept tiny: no caching of app data. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

/* Page loads always go to the network (never a stale app). Offline, show a small page instead of the browser's error. */
const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Agent Space</title>
<style>:root{color-scheme:light dark}body{margin:0;min-height:100dvh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#FAFAFA;color:#0A0A0A;text-align:center;padding:24px}
@media (prefers-color-scheme:dark){body{background:#0A0A0A;color:#FAFAFA}}h1{font-size:20px;margin:16px 0 6px}p{margin:0 0 20px;opacity:.7}
button{font:inherit;font-weight:700;border:0;border-radius:999px;padding:10px 20px;background:currentColor}button span{color:Canvas}</style></head>
<body><main><h1>You're offline</h1><p>Agent Space needs a connection. It will load once you're back online.</p><button onclick="location.reload()"><span>Try again</span></button></main>
<script>addEventListener("online",()=>location.reload())</script></body></html>`;

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })));
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Agent Space", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Agent Space";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // The app already shows in-app notifications when it's visible; only skip non-urgent pushes then.
      const visible = clients.some((c) => c.visibilityState === "visible");
      if (visible && !data.urgent) return undefined;
      return self.registration.showNotification(title, {
        body: data.body || "",
        tag: data.id || undefined,
        icon: "/icon-192.png",
        badge: "/favicon-32.png",
        data: { url: data.url || "/" },
        requireInteraction: !!data.urgent,
      });
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if (c.url.startsWith(self.location.origin) && "focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

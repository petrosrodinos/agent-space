/* Agent Space service worker — Web Push notifications (§12). Kept tiny: no caching of app data. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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
        icon: "/favicon.svg",
        badge: "/favicon.svg",
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

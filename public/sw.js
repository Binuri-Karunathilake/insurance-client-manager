// Service worker: shows the morning push notification and opens the app
// when it's tapped. Kept tiny on purpose; no offline caching yet.

self.addEventListener("push", (event) => {
  let data = { title: "Client Manager", body: "", url: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "morning-summary",
      renotify: true,
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const win of windows) {
        if (win.url.startsWith(self.location.origin)) {
          win.navigate(url);
          return win.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

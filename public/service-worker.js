self.addEventListener("push", function (event) {
  const options = {
    body: event.data.text(),
    icon: "/icon.png", // Add your icon path
    badge: "/badge.png", // Add your badge path
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
  };

  event.waitUntil(self.registration.showNotification("Office Chat", options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});

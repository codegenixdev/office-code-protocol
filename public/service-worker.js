self.addEventListener("push", function (event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: "/icon.png", // Add your icon path
      badge: "/badge.png", // Add your badge path
      timestamp: new Date(data.timestamp),
      vibrate: [100, 50, 100],
      data: {
        url: window.location.origin, // URL to open when notification is clicked
      },
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
  }
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});

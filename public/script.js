let notificationPermissionGranted = false;

// Function to request notification permission
async function requestNotificationPermission() {
  try {
    const permission = await Notification.requestPermission();
    notificationPermissionGranted = permission === "granted";
    if (notificationPermissionGranted) {
      console.log("Notification permission granted!");
      // Subscribe to push notifications
      subscribeUserToPush();
    } else {
      console.log("Notification permission denied");
    }
  } catch (error) {
    console.error("Error requesting notification permission:", error);
  }
}

// Function to subscribe to push notifications
async function subscribeUserToPush() {
  try {
    // Get the VAPID public key from server
    const response = await fetch("/vapidPublicKey");
    const vapidPublicKey = await response.json();

    // Get the service worker registration
    const registration = await navigator.serviceWorker.ready;

    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey.publicKey),
    });

    // Send the subscription to the server
    await fetch("/subscribe?userId=" + socket.id, {
      method: "POST",
      body: JSON.stringify(subscription),
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("Push notification subscription successful!");
  } catch (error) {
    console.error("Error subscribing to push notifications:", error);
  }
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Register service worker
async function registerServiceWorker() {
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.register(
        "/service-worker.js"
      );
      console.log("Service Worker registered:", registration);

      // Request notification permission after service worker is ready
      registration.addEventListener("activate", () => {
        requestNotificationPermission();
      });
    }
  } catch (error) {
    console.error("Service Worker registration failed:", error);
  }
}

// Call this when the page loads
document.addEventListener("DOMContentLoaded", () => {
  registerServiceWorker();
});

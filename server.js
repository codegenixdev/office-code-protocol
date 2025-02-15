const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const fs = require("fs");
const path = require("path");
const webpush = require("web-push");

// VAPID keys configuration
const vapidKeys = {
  publicKey:
    "BKEneeRPmxKgVQoBB-ILw3-hMT0tyktKHQBuES5HYNbE9PqMZ_EMIgtPs1-cSWgNInhhpLJhNCHIsBSq4Vk_iBE",
  privateKey: "CFWacf-5dtXnAXET4JdII9qwbTcmCsctBLqVuJNFDrI",
};

webpush.setVapidDetails(
  "mailto:czhablog@gmail.com", // Your email address
  vapidKeys.publicKey,
  vapidKeys.privateKey
);
// Configure static file serving
app.use(express.static("public"));
app.use(express.json());

app.get("/service-worker.js", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "service-worker.js"));
});

// File paths
const dataDir = path.join(__dirname, "data");
const messagesFile = path.join(dataDir, "messages.json");

// Ensure data directory and messages file exist
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}
if (!fs.existsSync(messagesFile)) {
  fs.writeFileSync(messagesFile, "[]");
}

// Store connected users and their push subscriptions
const users = new Map();
const pushSubscriptions = new Map();

// Serve VAPID public key
app.get("/vapidPublicKey", (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

// Handle push subscription
app.post("/subscribe", (req, res) => {
  const subscription = req.body;
  const userId = req.query.userId;

  pushSubscriptions.set(userId, subscription);
  res.status(201).json({});
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("A user connected");

  // Handle user joining
  socket.on("join", (username) => {
    users.set(socket.id, username);

    // Broadcast user joined message
    io.emit("userJoined", {
      username: username,
      timestamp: new Date().toISOString(),
    });

    // Send existing messages to new user
    try {
      const messages = JSON.parse(fs.readFileSync(messagesFile));
      socket.emit("loadMessages", messages);
    } catch (error) {
      console.error("Error loading messages:", error);
      socket.emit("loadMessages", []);
    }
  });

  // Handle push subscription
  socket.on("pushSubscription", (subscription) => {
    pushSubscriptions.set(socket.id, subscription);
    console.log(
      `Push subscription registered for user: ${users.get(socket.id)}`
    );
  });

  // Handle chat messages
  socket.on("chatMessage", async (message) => {
    const username = users.get(socket.id);
    if (!username) return;

    const messageData = {
      username,
      message,
      timestamp: new Date().toISOString(),
    };

    // Save message to file
    try {
      const messages = JSON.parse(fs.readFileSync(messagesFile));
      messages.push(messageData);
      fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2));
    } catch (error) {
      console.error("Error saving message:", error);
    }

    // Broadcast message to all connected users
    io.emit("message", messageData);

    // Send push notifications to all subscribed users except sender
    for (const [userId, subscription] of pushSubscriptions) {
      if (userId !== socket.id) {
        try {
          await webpush.sendNotification(
            subscription,
            JSON.stringify({
              title: "New Message from " + username,
              body: message,
              timestamp: messageData.timestamp,
            })
          );
        } catch (error) {
          console.error("Error sending push notification:", error);
          // Remove invalid subscriptions
          if (error.statusCode === 410) {
            pushSubscriptions.delete(userId);
          }
        }
      }
    }
  });

  // Handle user disconnection
  socket.on("disconnect", () => {
    const username = users.get(socket.id);
    if (username) {
      users.delete(socket.id);
      pushSubscriptions.delete(socket.id);

      // Broadcast user left message
      io.emit("userLeft", {
        username: username,
        timestamp: new Date().toISOString(),
      });
    }
    console.log("User disconnected:", username);
  });

  // Handle errors
  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// Periodic cleanup of disconnected subscriptions
setInterval(() => {
  for (const [userId, subscription] of pushSubscriptions) {
    if (!users.has(userId)) {
      pushSubscriptions.delete(userId);
    }
  }
}, 1000 * 60 * 60); // Run every hour

// Start server
const PORT = process.env.PORT || 3007;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  http.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  // Perform any necessary cleanup
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Perform any necessary cleanup
});

const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const fs = require("fs");
const path = require("path");

const messagesFile = path.join(__dirname, "data", "messages.json");

// Ensure messages.json exists
if (!fs.existsSync(path.join(__dirname, "data"))) {
  fs.mkdirSync(path.join(__dirname, "data"));
}
if (!fs.existsSync(messagesFile)) {
  fs.writeFileSync(messagesFile, "[]");
}

app.use(express.static("public"));

// Store connected users
let users = new Map();

io.on("connection", (socket) => {
  console.log("A user connected");

  // Handle user joining
  socket.on("join", (username) => {
    users.set(socket.id, username);
    io.emit("userJoined", username);

    // Send existing messages to new user
    const messages = JSON.parse(fs.readFileSync(messagesFile));
    socket.emit("loadMessages", messages);
  });

  // Handle chat messages
  socket.on("chatMessage", (message) => {
    const username = users.get(socket.id);
    const messageData = {
      username,
      message,
      timestamp: new Date().toISOString(),
    };

    // Save message to file
    const messages = JSON.parse(fs.readFileSync(messagesFile));
    messages.push(messageData);
    fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2));

    // Broadcast message
    io.emit("message", messageData);
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    const username = users.get(socket.id);
    users.delete(socket.id);
    io.emit("userLeft", username);
  });
});

const PORT = process.env.PORT || 3007;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

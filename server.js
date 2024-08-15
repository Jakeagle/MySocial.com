const express = require("express");
const app = express();

const bcrypt = require("bcrypt"); // For password hashing
const cors = require("cors");
const bodyParser = require("body-parser");

const port = process.env.PORT || 3000;

/*****************************************Socket.io***************************************************/

const server = require("http").createServer(app);
const io = require("socket.io")(server, {
  cors: {
    origin: "http://127.0.0.1:8080",
  },
});

io.on("connection", (socket) => {
  console.log("User connected: " + socket.id);

  socket.on("userConnected", async (username) => {
    socket.username = username; // Associate the username with the socket
    await client
      .db("MySocial")
      .collection("Profiles")
      .updateOne({ username }, { $set: { isBanned: false } }, { upsert: true });
    console.log(`Reset isBanned status for user: ${username}`);
  });

  socket.on("sendMessage", async (data) => {
    const { sender, recipient, message } = data;

    // Check if the sender is banned
    const senderProfile = await client
      .db("MySocial")
      .collection("Profiles")
      .findOne({ username: sender });

    if (senderProfile && senderProfile.isBanned) {
      socket.emit("error", {
        message: "You are banned for violating community guidelines.",
      });
      socket.disconnect(); // Forcibly disconnect the user
      return;
    }

    // Scan the message for banned keywords
    const bannedKeywords = ["Trump", "badword2", "misinformation"];
    const containsBannedKeyword = bannedKeywords.some((keyword) =>
      message.includes(keyword)
    );

    if (containsBannedKeyword) {
      await client
        .db("MySocial")
        .collection("Profiles")
        .updateOne(
          { username: sender },
          { $set: { isBanned: true } },
          { upsert: true }
        );
      socket.emit("error", {
        message: "You are banned for violating community guidelines.",
      });
      socket.disconnect(); // Forcibly disconnect the user
      return;
    }

    // Save the message to the database for the sender and recipient
    const messageObject = {
      sender,
      recipient,
      content: message,
      timestamp: new Date(),
    };

    await client
      .db("MySocial")
      .collection("Profiles")
      .updateOne({ username: sender }, { $push: { messages: messageObject } });

    await client
      .db("MySocial")
      .collection("Profiles")
      .updateOne(
        { username: recipient },
        { $push: { messages: messageObject } }
      );

    // Emit the message back to the sender (for local display)
    socket.emit("receiveMessage", { sender, message });

    // Send the message to the recipient only
    const recipientSocket = Array.from(io.sockets.sockets).find(
      ([, socket]) => socket.username === recipient
    )?.[1];

    if (recipientSocket) {
      recipientSocket.emit("receiveMessage", { sender, message });
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

/*****************************************MongoDB***************************************************/
const { MongoClient, ObjectId } = require("mongodb");

const uri =
  "mongodb+srv://JakobFerguson:XbdHM2FJsjg4ajiO@trinitycapitaltesting.1yr5eaa.mongodb.net/?retryWrites=true&w=majority";

const client = new MongoClient(uri);

async function main(client) {
  try {
    await client.connect();
    console.log("Connected, 20");
  } catch (e) {
    console.error(e);
  }
}

main(client).catch(console.error);

/*****************************************Main Page***************************************************/

app.use(express.static("public"));
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:8080"],
    credentials: true,
  })
);

// Handle login requests
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Find user by username
    const user = await client
      .db("MySocial")
      .collection("Profiles")
      .findOne({ username });

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid username or password" });
    }

    // Check if the user is banned
    if (user.isBanned) {
      return res
        .status(403)
        .json({
          success: false,
          message: "You are banned from this platform.",
        });
    }

    // Compare the provided password with the stored password
    if (password !== user.password) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid username or password" });
    }

    // If the password matches, send success response
    return res.status(200).json({ success: true, message: "Login successful" });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/contacts", async (req, res) => {
  try {
    const users = await client
      .db("MySocial")
      .collection("Profiles")
      .find()
      .toArray();
    res.status(200).json({ success: true, users });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/chatHistory", async (req, res) => {
  const { user, contact } = req.query;

  try {
    const userProfile = await client
      .db("MySocial")
      .collection("Profiles")
      .findOne({ username: user });

    const contactProfile = await client
      .db("MySocial")
      .collection("Profiles")
      .findOne({ username: contact });

    if (!userProfile || !contactProfile) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Combine messages where the sender is the user and recipient is the contact, or vice versa
    const chatHistory = userProfile.messages.filter(
      (msg) =>
        (msg.sender === user && msg.recipient === contact) ||
        (msg.sender === contact && msg.recipient === user)
    );

    res.status(200).json({ success: true, messages: chatHistory });
  } catch (error) {
    console.error("Error fetching chat history:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

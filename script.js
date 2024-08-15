const socket = io("http://localhost:3000"); // Adjust the URL as necessary
const loginDialog = document.getElementById("login-dialog");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const app = document.getElementById("app");

let selectedContact = null; // To track the selected contact

// Show the login dialog on page load
window.addEventListener("load", () => {
  loginDialog.showModal();
});

// Handle login form submission
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
    const response = await fetch("http://localhost:3000/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const result = await response.json();
    if (result.success) {
      loginDialog.close();
      document.querySelector(".container").style.display = "flex";
      socket.emit("userConnected", username);
      loadContacts(); // Load contacts when the user logs in
    } else {
      loginError.textContent = result.message;
      loginError.style.display = "block";
    }
  } catch (error) {
    console.error("Error:", error);
  }
});

// Handle sending messages
document.getElementById("send-button").addEventListener("click", () => {
  const messageInput = document.getElementById("message-input");
  const message = messageInput.value;
  const sender = document.getElementById("username").value;

  if (message && selectedContact) {
    socket.emit("sendMessage", { sender, recipient: selectedContact, message });
    messageInput.value = "";

    // Display the message in the sender's chat window as a sent message
    displayMessage("You", message, "sent");
  }
});

socket.on("receiveMessage", (data) => {
  const { sender, message } = data;

  // Only display the message if it's from the selected contact or if it's sent by the user
  if (sender === selectedContact || sender === "You") {
    displayMessage(sender, message, "received");
  }
});

socket.on("error", (data) => {
  alert(data.message);
  // You might want to also redirect the user or disable the interface
  loginDialog.showModal(); // Re-show the login dialog
  document.querySelector(".container").style.display = "none";
});

function displayMessage(sender, message, type) {
  const chatMessages = document.getElementById("chat-messages");
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${type}`;
  messageDiv.innerHTML = `<p>${sender}: ${message}</p>`;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to the bottom
}

// Load contacts and add click event listeners
async function loadContacts() {
  try {
    const response = await fetch("http://localhost:3000/contacts");
    const result = await response.json();
    if (result.success) {
      const contactsList = document.querySelector(".contacts-list");
      contactsList.innerHTML = ""; // Clear the existing contacts
      result.users.forEach((user) => {
        const li = document.createElement("li");
        li.textContent = user.username;
        li.addEventListener("click", () => {
          selectContact(user.username);
        });
        contactsList.appendChild(li);
      });
    } else {
      console.error("Failed to load contacts");
    }
  } catch (error) {
    console.error("Error loading contacts:", error);
  }
}

// Select a contact and update the chat header
async function selectContact(contactName) {
  selectedContact = contactName;
  const chatHeader = document.querySelector(".chat-header h2");
  chatHeader.textContent = `Chat with ${contactName}`;

  // Clear the current chat messages
  document.getElementById("chat-messages").innerHTML = "";

  // Fetch chat history with the selected contact
  try {
    const username = document.getElementById("username").value;
    const response = await fetch(
      `http://localhost:3000/chatHistory?user=${username}&contact=${contactName}`
    );
    const result = await response.json();

    if (result.success) {
      result.messages.forEach((msg) => {
        const type = msg.sender === username ? "sent" : "received";
        displayMessage(msg.sender, msg.content, type);
      });
    } else {
      console.error("Failed to load chat history");
    }
  } catch (error) {
    console.error("Error loading chat history:", error);
  }
}

const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const connectDB = require("./init/dataBase");

const uploadRoutes = require("./routes/uploadRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const alertRoutes = require("./routes/alertRoutes");

const app = express();
const server = http.createServer(app);

const wss = new WebSocket.Server({ server });

app.use(cors());                  // Allow cross-origin requests
app.use(express.json());          // Parse JSON request bodies
app.use(express.static(path.join(__dirname, "public")));// Serve static files (frontend)

app.use("/api/upload", uploadRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/alerts", alertRoutes);

// Health check route
app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Serve main frontend file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

connectDB(); // Connect to MongoDB

wss.on("connection", (ws) => {
  console.log("WebSocket client connected");

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      console.log("Received:", data);

      ws.send(JSON.stringify({ type: "echo", data }));
    } catch (err) {
      console.error("Error parsing message:", err);
    }
  });

  ws.on("close", () => {
    console.log("WebSocket client disconnected");
  });
});

app.locals.broadcast = (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

const PORT = 8080;
server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

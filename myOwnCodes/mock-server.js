const express = require("express");
const crypto = require("crypto");
const app = express();
const PORT = 4000;

app.use(express.json());

// In-memory "database"
let stocks = [
  { id: 1, symbol: "AAPL", price: 150.25, volume: 1000000 },
  { id: 2, symbol: "GOOGL", price: 2800.5, volume: 500000 },
  { id: 3, symbol: "MSFT", price: 310.75, volume: 750000 },
];

// In-memory "users database"
const users = [
  { id: 1, username: "testuser", password: "password123", role: "user" },
  { id: 2, username: "admin", password: "admin123", role: "admin" },
];

// In-memory token storage (in production, use Redis or database)
const tokens = new Map();

let requestCount = 0;
const RATE_LIMIT = 10; // requests per minute
const RATE_WINDOW = 60000; // 1 MINUTE

// Rate limiting middleware
const rateLimitMiddleware = (req, res, next) => {
  requestCount++;

  if (requestCount > RATE_LIMIT) {
    return res.status(429).json({
      error: "Rate limit exceeded",
      message: "Too many requests, Please try again alter",
    });
  }

  next();
};

// Reset rate limit counter every minute
setInterval(() => {
  requestCount = 0;
  console.log("Rate limit counter reset");
}, RATE_WINDOW);

// Simulate random errors
const randomErrorMiddleware = (re1, res, next) => {
  if (Math.random() < 0.1) {
    return res.status(500).json({ error: "Internal server error" });
  }
  next();
};

// Apply middleware
app.use(rateLimitMiddleware);
// Auth routes don't have random errors
app.use(/^(?!\/auth).*$/, randomErrorMiddleware);

// POST /auth/login - login with username/password
app.post("/auth/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const accessToken = generateToken();
  const refreshToken = generateToken();

  // Store tokens (expire in an hour)
  tokens.set(accessToken, {
    userId: user.id,
    username: user.username,
    role: user.role,
    expiresAt: Date.now() + 3600000,
  });

  tokens.set(refreshToken, {
    userId: user.id,
    type: "refresh",
    expiresAt: Date.now() + 86400000,
  });

  res.json({
    accessToken,
    refreshToken,
    expiresIn: 3600,
    user: {
      id: user.id,
      user: user.username,
      role: user.role,
    },
  });
});

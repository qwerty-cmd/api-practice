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
const RATE_WINDOW = 60000; // 1 minute

// Rate limiting middleware
const rateLimitMiddleware = (req, res, next) => {
  requestCount++;

  if (requestCount > RATE_LIMIT) {
    return res.status(429).json({
      error: "Rate limit exceeded",
      message: "Too many requests. Please try again later.",
    });
  }

  next();
};

// Reset rate limit counter every minute
setInterval(() => {
  requestCount = 0;
  console.log("Rate limit counter reset");
}, RATE_WINDOW);

// Simulate random errors (10% chance)
const randomErrorMiddleware = (req, res, next) => {
  if (Math.random() < 0.1) {
    return res.status(500).json({ error: "Internal server error" });
  }
  next();
};

// Apply middleware
app.use(rateLimitMiddleware);
// Auth routes don't have random errors
app.use(/^(?!\/auth).*$/, randomErrorMiddleware);

// =============================================
// AUTHENTICATION ENDPOINTS
// =============================================

// Generate random token
const generateToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

// POST /auth/login - Login with username/password
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

  // Store tokens (expires in 1 hour)
  tokens.set(accessToken, {
    userId: user.id,
    username: user.username,
    role: user.role,
    expiresAt: Date.now() + 3600000, // 1 hour
  });

  tokens.set(refreshToken, {
    userId: user.id,
    type: "refresh",
    expiresAt: Date.now() + 86400000, // 24 hours
  });

  res.json({
    accessToken,
    refreshToken,
    expiresIn: 3600,
    user: { id: user.id, username: user.username, role: user.role },
  });
});

// POST /auth/refresh - Refresh access token
app.post("/auth/refresh", (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: "Refresh token required" });
  }

  const tokenData = tokens.get(refreshToken);

  if (!tokenData || tokenData.type !== "refresh") {
    return res.status(401).json({ error: "Invalid refresh token" });
  }

  if (Date.now() > tokenData.expiresAt) {
    tokens.delete(refreshToken);
    return res.status(401).json({ error: "Refresh token expired" });
  }

  const user = users.find((u) => u.id === tokenData.userId);
  const newAccessToken = generateToken();

  tokens.set(newAccessToken, {
    userId: user.id,
    username: user.username,
    role: user.role,
    expiresAt: Date.now() + 3600000,
  });

  res.json({
    accessToken: newAccessToken,
    expiresIn: 3600,
  });
});

// POST /auth/logout - Logout (invalidate token)
app.post("/auth/logout", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (token) {
    tokens.delete(token);
  }

  res.json({ message: "Logged out successfully" });
});

// Authentication middleware
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  const tokenData = tokens.get(token);

  if (!tokenData) {
    return res.status(401).json({ error: "Invalid token" });
  }

  if (Date.now() > tokenData.expiresAt) {
    tokens.delete(token);
    return res.status(401).json({ error: "Token expired" });
  }

  req.user = {
    id: tokenData.userId,
    username: tokenData.username,
    role: tokenData.role,
  };

  next();
};

// Admin middleware
const adminMiddleware = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

// =============================================
// PROTECTED ENDPOINTS
// =============================================

// GET /auth/me - Get current user info (requires auth)
app.get("/auth/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// GET all stocks (now requires auth)
app.get("/api/stocks", authMiddleware, (req, res) => {
  res.json({ data: stocks, count: stocks.length });
});

// GET single stock
app.get("/api/stocks/:id", authMiddleware, (req, res) => {
  const stock = stocks.find((s) => s.id === parseInt(req.params.id));

  if (!stock) {
    return res.status(404).json({ error: "Stock not found" });
  }

  res.json(stock);
});

// POST new stock (admin only)
app.post("/api/stocks", authMiddleware, adminMiddleware, (req, res) => {
  const { symbol, price, volume } = req.body;

  if (!symbol || !price || !volume) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const newStock = {
    id: stocks.length + 1,
    symbol,
    price,
    volume,
  };

  stocks.push(newStock);
  res.status(201).json(newStock);
});

// PUT update stock (full replacement, admin only)
app.put("/api/stocks/:id", authMiddleware, adminMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const index = stocks.findIndex((s) => s.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Stock not found" });
  }

  const { symbol, price, volume } = req.body;
  stocks[index] = { id, symbol, price, volume };

  res.json(stocks[index]);
});

// PATCH update stock (partial update, admin only)
app.patch("/api/stocks/:id", authMiddleware, adminMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const stock = stocks.find((s) => s.id === id);

  if (!stock) {
    return res.status(404).json({ error: "Stock not found" });
  }

  Object.assign(stock, req.body);
  res.json(stock);
});

// DELETE stock (admin only)
app.delete("/api/stocks/:id", authMiddleware, adminMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const index = stocks.findIndex((s) => s.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Stock not found" });
  }

  stocks.splice(index, 1);
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Mock Stock API running on http://localhost:${PORT}`);
  console.log(`Rate limit: ${RATE_LIMIT} requests per minute`);
  console.log(`Random errors: 10% chance`);
  console.log("\nAuthentication:");
  console.log("  Test User - username: testuser, password: password123");
  console.log("  Admin     - username: admin, password: admin123");
  console.log("\nAuth Endpoints:");
  console.log("  POST   /auth/login");
  console.log("  POST   /auth/refresh");
  console.log("  POST   /auth/logout");
  console.log("  GET    /auth/me");
  console.log("\nStock Endpoints (require auth):");
  console.log("  GET    /api/stocks         (user or admin)");
  console.log("  GET    /api/stocks/:id     (user or admin)");
  console.log("  POST   /api/stocks         (admin only)");
  console.log("  PUT    /api/stocks/:id     (admin only)");
  console.log("  PATCH  /api/stocks/:id     (admin only)");
  console.log("  DELETE /api/stocks/:id     (admin only)");
});

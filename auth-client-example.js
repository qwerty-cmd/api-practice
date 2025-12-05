const axios = require("axios");

// Simple authenticated client for mock-server.js
class AuthClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.accessToken = null;
    this.refreshToken = null;
  }

  // Login
  async login(username, password) {
    try {
      const response = await axios.post(`${this.baseUrl}/auth/login`, {
        username,
        password,
      });

      this.accessToken = response.data.accessToken;
      this.refreshToken = response.data.refreshToken;

      console.log("✓ Login successful");
      console.log(`  User: ${response.data.user.username}`);
      console.log(`  Role: ${response.data.user.role}`);
      console.log(`  Token expires in: ${response.data.expiresIn}s\n`);

      return response.data;
    } catch (error) {
      console.error("✗ Login failed:", error.response?.data?.error);
      throw error;
    }
  }

  // Refresh token
  async refreshAccessToken() {
    try {
      const response = await axios.post(`${this.baseUrl}/auth/refresh`, {
        refreshToken: this.refreshToken,
      });

      this.accessToken = response.data.accessToken;
      console.log("✓ Token refreshed\n");

      return response.data;
    } catch (error) {
      console.error("✗ Token refresh failed:", error.response?.data?.error);
      this.accessToken = null;
      this.refreshToken = null;
      throw error;
    }
  }

  // Get current user info
  async getMe() {
    return this.get("/auth/me");
  }

  // Get all stocks
  async getStocks() {
    return this.get("/api/stocks");
  }

  // Get single stock
  async getStock(id) {
    return this.get(`/api/stocks/${id}`);
  }

  // Create stock (admin only)
  async createStock(stock) {
    return this.post("/api/stocks", stock);
  }

  // Update stock (admin only)
  async updateStock(id, stock) {
    return this.put(`/api/stocks/${id}`, stock);
  }

  // Patch stock (admin only)
  async patchStock(id, updates) {
    return this.patch(`/api/stocks/${id}`, updates);
  }

  // Delete stock (admin only)
  async deleteStock(id) {
    return this.delete(`/api/stocks/${id}`);
  }

  // Generic GET
  async get(endpoint) {
    return this.request("GET", endpoint);
  }

  // Generic POST
  async post(endpoint, data) {
    return this.request("POST", endpoint, data);
  }

  // Generic PUT
  async put(endpoint, data) {
    return this.request("PUT", endpoint, data);
  }

  // Generic PATCH
  async patch(endpoint, data) {
    return this.request("PATCH", endpoint, data);
  }

  // Generic DELETE
  async delete(endpoint) {
    return this.request("DELETE", endpoint);
  }

  // Make authenticated request
  async request(method, endpoint, data = null) {
    if (!this.accessToken) {
      throw new Error("Not authenticated. Please login first.");
    }

    try {
      const response = await axios({
        method,
        url: `${this.baseUrl}${endpoint}`,
        data,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      // If token expired, try to refresh
      if (error.response?.status === 401 && this.refreshToken) {
        console.log("Token expired, refreshing...");
        await this.refreshAccessToken();

        // Retry the request
        return this.request(method, endpoint, data);
      }

      throw error;
    }
  }

  // Logout
  async logout() {
    try {
      await axios.post(`${this.baseUrl}/auth/logout`, null, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      this.accessToken = null;
      this.refreshToken = null;

      console.log("✓ Logged out\n");
    } catch (error) {
      console.error("✗ Logout failed");
    }
  }
}

// ===========================================
// DEMO: Test authentication flow
// ===========================================

(async () => {
  console.log("=== AUTHENTICATION CLIENT DEMO ===\n");
  console.log("Make sure mock-server.js is running on port 4000!\n");

  const client = new AuthClient("http://localhost:4000");

  try {
    // 1. Login as regular user
    console.log("1. Login as regular user:");
    await client.login("testuser", "password123");

    // 2. Get current user info
    console.log("2. Get current user info:");
    const me = await client.getMe();
    console.log("  Current user:", me.user);
    console.log();

    // 3. Get all stocks
    console.log("3. Get all stocks:");
    const stocks = await client.getStocks();
    console.log(`  Found ${stocks.count} stocks:`, stocks.data);
    console.log();

    // 4. Get single stock
    console.log("4. Get single stock:");
    const stock = await client.getStock(1);
    console.log("  Stock:", stock);
    console.log();

    // 5. Try to create stock (should fail - user is not admin)
    console.log("5. Try to create stock as user (should fail):");
    try {
      await client.createStock({
        symbol: "TSLA",
        price: 250.5,
        volume: 1500000,
      });
    } catch (error) {
      console.log("  ✓ Expected error:", error.response?.data?.error);
    }
    console.log();

    // 6. Logout
    console.log("6. Logout:");
    await client.logout();

    // 7. Login as admin
    console.log("7. Login as admin:");
    await client.login("admin", "admin123");

    // 8. Create stock as admin (should succeed)
    console.log("8. Create stock as admin:");
    const newStock = await client.createStock({
      symbol: "TSLA",
      price: 250.5,
      volume: 1500000,
    });
    console.log("  ✓ Stock created:", newStock);
    console.log();

    // 9. Update stock
    console.log("9. Update stock:");
    const updated = await client.patchStock(newStock.id, { price: 255.75 });
    console.log("  ✓ Stock updated:", updated);
    console.log();

    // 10. Delete stock
    console.log("10. Delete stock:");
    await client.deleteStock(newStock.id);
    console.log("  ✓ Stock deleted");
    console.log();

    // 11. Logout
    console.log("11. Logout:");
    await client.logout();

    console.log("=== DEMO COMPLETE ===");
  } catch (error) {
    console.error("\n✗ Error:", error.message);
    if (error.code === "ECONNREFUSED") {
      console.error(
        "\nMake sure mock-server.js is running: node mock-server.js"
      );
    }
  }
})();

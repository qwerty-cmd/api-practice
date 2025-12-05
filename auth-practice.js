const axios = require("axios");
const crypto = require("crypto");

// ===========================================
// AUTHENTICATION TYPES
// ===========================================

// 1. BASIC AUTH
// Username:Password encoded in Base64
const basicAuthExample = async () => {
  const username = "user123";
  const password = "mypassword";

  // Method 1: Using axios built-in auth
  try {
    const response = await axios.get(
      "https://httpbin.org/basic-auth/user123/mypassword",
      {
        auth: {
          username: username,
          password: password,
        },
      }
    );
    console.log("Basic Auth Success:", response.data);
  } catch (error) {
    console.error("Basic Auth Failed:", error.response?.status);
  }

  // Method 2: Manual header
  const token = Buffer.from(`${username}:${password}`).toString("base64");
  try {
    const response = await axios.get(
      "https://httpbin.org/basic-auth/user123/mypassword",
      {
        headers: {
          Authorization: `Basic ${token}`,
        },
      }
    );
    console.log("Basic Auth (Manual) Success:", response.data);
  } catch (error) {
    console.error("Basic Auth (Manual) Failed:", error.response?.status);
  }
};

// 2. BEARER TOKEN (JWT)
// Most common for APIs
const bearerTokenExample = async (token) => {
  try {
    const response = await axios.get("https://httpbin.org/bearer", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log("Bearer Token Success:", response.data);
    return response.data;
  } catch (error) {
    console.error("Bearer Token Failed:", error.response?.status);
    throw error;
  }
};

// 3. API KEY
// Simple key-based authentication
const apiKeyExample = async (apiKey) => {
  // Method 1: In query params
  try {
    const response = await axios.get("https://api.example.com/data", {
      params: {
        api_key: apiKey,
      },
    });
    console.log("API Key (Query) Success");
  } catch (error) {
    console.error("API Key Failed");
  }

  // Method 2: In headers
  try {
    const response = await axios.get("https://api.example.com/data", {
      headers: {
        "X-API-Key": apiKey,
      },
    });
    console.log("API Key (Header) Success");
  } catch (error) {
    console.error("API Key Failed");
  }
};

// 4. OAUTH 2.0 Flow Simulation
class OAuth2Client {
  constructor(clientId, clientSecret, tokenUrl) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.tokenUrl = tokenUrl;
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
  }

  // Get access token
  async getAccessToken() {
    try {
      const response = await axios.post(this.tokenUrl, {
        grant_type: "client_credentials",
        client_id: this.clientId,
        client_secret: this.clientSecret,
      });

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      this.tokenExpiry = Date.now() + response.data.expires_in * 1000;

      console.log("Access token obtained");
      return this.accessToken;
    } catch (error) {
      console.error("Failed to get access token:", error.message);
      throw error;
    }
  }

  // Refresh token
  async refreshAccessToken() {
    try {
      const response = await axios.post(this.tokenUrl, {
        grant_type: "refresh_token",
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + response.data.expires_in * 1000;

      console.log("Access token refreshed");
      return this.accessToken;
    } catch (error) {
      console.error("Failed to refresh token:", error.message);
      throw error;
    }
  }

  // Check if token is expired
  isTokenExpired() {
    return !this.tokenExpiry || Date.now() >= this.tokenExpiry;
  }

  // Get valid token (refresh if needed)
  async getValidToken() {
    if (!this.accessToken || this.isTokenExpired()) {
      if (this.refreshToken) {
        await this.refreshAccessToken();
      } else {
        await this.getAccessToken();
      }
    }
    return this.accessToken;
  }

  // Make authenticated request
  async makeRequest(url, options = {}) {
    const token = await this.getValidToken();

    return axios({
      url,
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  }
}

// 5. SESSION-BASED AUTH
class SessionClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.sessionCookie = null;
  }

  // Login and get session cookie
  async login(username, password) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/login`,
        {
          username,
          password,
        },
        {
          withCredentials: true, // Important for cookies
        }
      );

      // Store session cookie
      this.sessionCookie = response.headers["set-cookie"];
      console.log("Login successful");
      return true;
    } catch (error) {
      console.error("Login failed:", error.message);
      return false;
    }
  }

  // Make authenticated request with session
  async makeRequest(endpoint, options = {}) {
    if (!this.sessionCookie) {
      throw new Error("Not authenticated. Please login first.");
    }

    return axios({
      url: `${this.baseUrl}${endpoint}`,
      ...options,
      headers: {
        ...options.headers,
        Cookie: this.sessionCookie,
      },
      withCredentials: true,
    });
  }

  // Logout
  async logout() {
    try {
      await this.makeRequest("/logout", { method: "POST" });
      this.sessionCookie = null;
      console.log("Logout successful");
    } catch (error) {
      console.error("Logout failed:", error.message);
    }
  }
}

// 6. HMAC SIGNATURE AUTH (AWS-style)
// Used by AWS, Stripe, etc.
const generateHMACSignature = (secret, message) => {
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
};

const hmacAuthExample = async (apiKey, apiSecret, endpoint, body = {}) => {
  const timestamp = Date.now().toString();
  const bodyString = JSON.stringify(body);

  // Create signature: timestamp + method + endpoint + body
  const message = `${timestamp}POST${endpoint}${bodyString}`;
  const signature = generateHMACSignature(apiSecret, message);

  try {
    const response = await axios.post(
      `https://api.example.com${endpoint}`,
      body,
      {
        headers: {
          "X-API-Key": apiKey,
          "X-Timestamp": timestamp,
          "X-Signature": signature,
        },
      }
    );
    console.log("HMAC Auth Success");
    return response.data;
  } catch (error) {
    console.error("HMAC Auth Failed");
  }
};

// 7. AUTH MIDDLEWARE (Interceptor)
// Automatically add auth to all requests
const createAuthInterceptor = (getToken) => {
  axios.interceptors.request.use(
    async (config) => {
      const token = await getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Handle 401 errors (token expired)
  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401) {
        console.log("Token expired, refreshing...");
        // Implement token refresh logic here
      }
      return Promise.reject(error);
    }
  );
};

// 8. AUTHENTICATED API CLIENT (Complete Example)
class AuthenticatedAPIClient {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.accessToken = null;
    this.refreshToken = null;
  }

  // Login with credentials
  async login(username, password) {
    try {
      const response = await axios.post(`${this.baseUrl}/auth/login`, {
        username,
        password,
      });

      this.accessToken = response.data.accessToken;
      this.refreshToken = response.data.refreshToken;

      console.log("✓ Login successful");
      return true;
    } catch (error) {
      console.error("✗ Login failed:", error.response?.data?.message);
      return false;
    }
  }

  // Refresh access token
  async refreshAccessToken() {
    try {
      const response = await axios.post(`${this.baseUrl}/auth/refresh`, {
        refreshToken: this.refreshToken,
      });

      this.accessToken = response.data.accessToken;
      console.log("✓ Token refreshed");
      return true;
    } catch (error) {
      console.error("✗ Token refresh failed");
      this.accessToken = null;
      this.refreshToken = null;
      return false;
    }
  }

  // Make authenticated GET request
  async get(endpoint) {
    return this.request("GET", endpoint);
  }

  // Make authenticated POST request
  async post(endpoint, data) {
    return this.request("POST", endpoint, data);
  }

  // Make authenticated PUT request
  async put(endpoint, data) {
    return this.request("PUT", endpoint, data);
  }

  // Make authenticated DELETE request
  async delete(endpoint) {
    return this.request("DELETE", endpoint);
  }

  // Generic request with auth
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
          "X-API-Key": this.apiKey,
        },
      });

      return response.data;
    } catch (error) {
      // If 401, try to refresh token
      if (error.response?.status === 401) {
        console.log("Token expired, attempting refresh...");
        const refreshed = await this.refreshAccessToken();

        if (refreshed) {
          // Retry original request
          return this.request(method, endpoint, data);
        }
      }

      throw error;
    }
  }

  // Logout
  logout() {
    this.accessToken = null;
    this.refreshToken = null;
    console.log("✓ Logged out");
  }
}

// ===========================================
// TESTING EXAMPLES
// ===========================================

(async () => {
  console.log("=== AUTHENTICATION PRACTICE ===\n");

  // Example 1: Basic Auth
  console.log("1. Basic Authentication:");
  await basicAuthExample();

  // Example 2: Bearer Token
  console.log("\n2. Bearer Token:");
  await bearerTokenExample("test-token-123");

  // Example 3: API Key
  console.log("\n3. API Key Authentication:");
  await apiKeyExample("my-api-key-123");

  // Example 4: OAuth2 Client
  console.log("\n4. OAuth2 Client:");
  // const oauth = new OAuth2Client("client-id", "client-secret", "https://oauth.example.com/token");
  // await oauth.getAccessToken();
  // await oauth.makeRequest("https://api.example.com/data");

  // Example 5: Session-based
  console.log("\n5. Session-based Authentication:");
  // const sessionClient = new SessionClient("http://localhost:4000");
  // await sessionClient.login("user", "password");
  // await sessionClient.makeRequest("/api/protected");
  // await sessionClient.logout();

  // Example 6: HMAC Signature
  console.log("\n6. HMAC Signature:");
  const signature = generateHMACSignature("secret-key", "test-message");
  console.log("Generated signature:", signature);

  // Example 7: Complete API Client
  console.log("\n7. Complete Authenticated API Client:");
  const client = new AuthenticatedAPIClient(
    "http://localhost:4000",
    "api-key-123"
  );

  // Simulate login
  // await client.login("testuser", "password123");

  // Make authenticated requests
  // const data = await client.get("/api/stocks");
  // await client.post("/api/stocks", { symbol: "AAPL", price: 150 });

  // Logout
  // client.logout();

  console.log("\n=== DONE ===");
})();

// ===========================================
// EXERCISES:
// ===========================================
// 1. Implement JWT token decoding
// 2. Add token expiry checking
// 3. Create a token storage mechanism (localStorage simulation)
// 4. Implement 2FA (two-factor authentication)
// 5. Add rate limiting per user
// 6. Create password hashing utility
// 7. Implement role-based access control (RBAC)
// 8. Add request signing for security

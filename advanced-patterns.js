const axios = require("axios");

// ===========================================
// 1. REQUEST/RESPONSE INTERCEPTORS
// ===========================================

// Global request/response middleware
const setupInterceptors = () => {
  // Request interceptor
  axios.interceptors.request.use(
    (config) => {
      // Add timestamp to all requests
      config.metadata = { startTime: Date.now() };
      console.log(`→ ${config.method.toUpperCase()} ${config.url}`);
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor
  axios.interceptors.response.use(
    (response) => {
      // Log response time
      const duration = Date.now() - response.config.metadata.startTime;
      console.log(`← ${response.status} (${duration}ms)`);
      return response;
    },
    (error) => {
      if (error.response) {
        console.log(`✗ ${error.response.status} ${error.response.statusText}`);
      }
      return Promise.reject(error);
    }
  );
};

// ===========================================
// 2. CIRCUIT BREAKER PATTERN
// ===========================================

class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failureCount = 0;
    this.threshold = threshold; // Number of failures before opening
    this.timeout = timeout; // Time to wait before trying again (ms)
    this.state = "CLOSED"; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }

  async execute(fn) {
    if (this.state === "OPEN") {
      if (Date.now() < this.nextAttempt) {
        throw new Error("Circuit breaker is OPEN");
      }
      // Try again (half-open state)
      this.state = "HALF_OPEN";
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = "CLOSED";
    console.log("✓ Circuit breaker: CLOSED");
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = "OPEN";
      this.nextAttempt = Date.now() + this.timeout;
      console.log(`✗ Circuit breaker: OPEN (retry after ${this.timeout}ms)`);
    }
  }

  getState() {
    return this.state;
  }
}

// Usage example
const circuitBreaker = new CircuitBreaker(3, 10000);

const fetchWithCircuitBreaker = async (url) => {
  return circuitBreaker.execute(async () => {
    const response = await axios.get(url);
    return response.data;
  });
};

// ===========================================
// 3. REQUEST TIMEOUT HANDLING
// ===========================================

const fetchWithTimeout = async (url, timeoutMs = 5000) => {
  try {
    const response = await axios.get(url, {
      timeout: timeoutMs,
    });
    return response.data;
  } catch (error) {
    if (error.code === "ECONNABORTED") {
      console.error(`✗ Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
};

// ===========================================
// 4. REQUEST CANCELLATION
// ===========================================

class CancellableRequest {
  constructor() {
    this.cancelTokenSource = null;
  }

  async fetch(url) {
    // Cancel previous request if exists
    if (this.cancelTokenSource) {
      this.cancelTokenSource.cancel("New request started");
    }

    // Create new cancel token
    this.cancelTokenSource = axios.CancelToken.source();

    try {
      const response = await axios.get(url, {
        cancelToken: this.cancelTokenSource.token,
      });
      return response.data;
    } catch (error) {
      if (axios.isCancel(error)) {
        console.log("Request cancelled:", error.message);
      } else {
        throw error;
      }
    }
  }

  cancel() {
    if (this.cancelTokenSource) {
      this.cancelTokenSource.cancel("User cancelled");
    }
  }
}

// Usage
const cancellableRequest = new CancellableRequest();
// cancellableRequest.cancel(); // Cancel anytime

// ===========================================
// 5. PAGINATION HELPER
// ===========================================

class PaginationHelper {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  // Fetch all pages automatically
  async fetchAllPages(endpoint, params = {}) {
    const allData = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        params: { ...params, page, limit: 100 },
      });

      allData.push(...response.data.data);

      // Check if more pages exist
      hasMore = response.data.data.length === 100;
      page++;

      console.log(`Fetched page ${page - 1} (${allData.length} total items)`);
    }

    return allData;
  }

  // Fetch pages with cursor-based pagination
  async fetchAllWithCursor(endpoint, params = {}) {
    const allData = [];
    let cursor = null;

    while (true) {
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        params: { ...params, cursor },
      });

      allData.push(...response.data.data);
      cursor = response.data.nextCursor;

      if (!cursor) break;
    }

    return allData;
  }
}

// ===========================================
// 6. REQUEST BATCHING
// ===========================================

class RequestBatcher {
  constructor(batchSize = 5, delayMs = 100) {
    this.batchSize = batchSize;
    this.delayMs = delayMs;
  }

  // Process requests in batches with delay
  async batchProcess(urls) {
    const results = [];

    for (let i = 0; i < urls.length; i += this.batchSize) {
      const batch = urls.slice(i, i + this.batchSize);

      console.log(`Processing batch ${i / this.batchSize + 1}...`);

      const batchResults = await Promise.all(
        batch.map(async (url) => {
          try {
            const response = await axios.get(url);
            return { success: true, data: response.data };
          } catch (error) {
            return { success: false, error: error.message };
          }
        })
      );

      results.push(...batchResults);

      // Wait before next batch
      if (i + this.batchSize < urls.length) {
        await this.delay(this.delayMs);
      }
    }

    return results;
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ===========================================
// 7. WEBHOOKS / SERVER-SENT EVENTS (SSE)
// ===========================================

// Simulate webhook endpoint handler
const webhookHandler = (req, res) => {
  const signature = req.headers["x-webhook-signature"];
  const payload = req.body;

  // Verify signature (HMAC)
  const crypto = require("crypto");
  const expectedSignature = crypto
    .createHmac("sha256", "webhook-secret")
    .update(JSON.stringify(payload))
    .digest("hex");

  if (signature !== expectedSignature) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  // Process webhook
  console.log("Webhook received:", payload);
  res.status(200).json({ received: true });
};

// ===========================================
// 8. GRAPHQL CLIENT
// ===========================================

class GraphQLClient {
  constructor(endpoint) {
    this.endpoint = endpoint;
  }

  async query(query, variables = {}) {
    try {
      const response = await axios.post(this.endpoint, {
        query,
        variables,
      });

      if (response.data.errors) {
        throw new Error(JSON.stringify(response.data.errors));
      }

      return response.data.data;
    } catch (error) {
      console.error("GraphQL Error:", error.message);
      throw error;
    }
  }
}

// Usage
// const client = new GraphQLClient("https://api.example.com/graphql");
// const data = await client.query(`
//   query GetUser($id: ID!) {
//     user(id: $id) {
//       name
//       email
//     }
//   }
// `, { id: "123" });

// ===========================================
// 9. FILE UPLOAD/DOWNLOAD
// ===========================================

const uploadFile = async (url, filePath) => {
  const FormData = require("form-data");
  const fs = require("fs");

  const form = new FormData();
  form.append("file", fs.createReadStream(filePath));

  try {
    const response = await axios.post(url, form, {
      headers: form.getHeaders(),
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        console.log(`Upload progress: ${percentCompleted}%`);
      },
    });

    console.log("✓ File uploaded:", response.data);
    return response.data;
  } catch (error) {
    console.error("✗ Upload failed:", error.message);
    throw error;
  }
};

const downloadFile = async (url, outputPath) => {
  const fs = require("fs");
  const writer = fs.createWriteStream(outputPath);

  try {
    const response = await axios.get(url, {
      responseType: "stream",
      onDownloadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        console.log(`Download progress: ${percentCompleted}%`);
      },
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        console.log("✓ File downloaded");
        resolve();
      });
      writer.on("error", reject);
    });
  } catch (error) {
    console.error("✗ Download failed:", error.message);
    throw error;
  }
};

// ===========================================
// 10. WEBSOCKET CLIENT
// ===========================================

// Note: Requires 'ws' package: npm install ws
const connectWebSocket = (url) => {
  const WebSocket = require("ws");
  const ws = new WebSocket(url);

  ws.on("open", () => {
    console.log("✓ WebSocket connected");
    ws.send(JSON.stringify({ type: "subscribe", channel: "stocks" }));
  });

  ws.on("message", (data) => {
    const message = JSON.parse(data);
    console.log("Received:", message);
  });

  ws.on("error", (error) => {
    console.error("✗ WebSocket error:", error.message);
  });

  ws.on("close", () => {
    console.log("WebSocket disconnected");
  });

  return ws;
};

// ===========================================
// 11. API VERSIONING
// ===========================================

class VersionedAPIClient {
  constructor(baseUrl, version = "v1") {
    this.baseUrl = baseUrl;
    this.version = version;
  }

  async get(endpoint) {
    // Method 1: Version in URL path
    const response = await axios.get(
      `${this.baseUrl}/${this.version}${endpoint}`
    );
    return response.data;
  }

  async getWithHeader(endpoint) {
    // Method 2: Version in header
    const response = await axios.get(`${this.baseUrl}${endpoint}`, {
      headers: {
        "API-Version": this.version,
      },
    });
    return response.data;
  }

  async getWithAcceptHeader(endpoint) {
    // Method 3: Version in Accept header
    const response = await axios.get(`${this.baseUrl}${endpoint}`, {
      headers: {
        Accept: `application/vnd.api.${this.version}+json`,
      },
    });
    return response.data;
  }
}

// ===========================================
// 12. RESPONSE COMPRESSION
// ===========================================

const fetchWithCompression = async (url) => {
  const response = await axios.get(url, {
    headers: {
      "Accept-Encoding": "gzip, deflate, br",
    },
    decompress: true, // Automatically decompress
  });

  return response.data;
};

// ===========================================
// 13. MONITORING & METRICS
// ===========================================

class APIMetrics {
  constructor() {
    this.requests = [];
  }

  recordRequest(url, method, status, duration) {
    this.requests.push({
      url,
      method,
      status,
      duration,
      timestamp: Date.now(),
    });
  }

  getStats() {
    const total = this.requests.length;
    const successful = this.requests.filter((r) => r.status < 400).length;
    const failed = total - successful;
    const avgDuration =
      this.requests.reduce((sum, r) => sum + r.duration, 0) / total;

    return {
      total,
      successful,
      failed,
      successRate: ((successful / total) * 100).toFixed(2) + "%",
      avgDuration: avgDuration.toFixed(2) + "ms",
    };
  }

  reset() {
    this.requests = [];
  }
}

const metrics = new APIMetrics();

// ===========================================
// TESTING EXAMPLES
// ===========================================

(async () => {
  console.log("=== ADVANCED API PATTERNS ===\n");

  // 1. Interceptors
  console.log("1. Request/Response Interceptors:");
  setupInterceptors();
  try {
    await axios.get("https://jsonplaceholder.typicode.com/posts/1");
  } catch (error) {
    console.error(error.message);
  }

  // 2. Circuit Breaker
  console.log("\n2. Circuit Breaker Pattern:");
  // Simulate multiple failures
  for (let i = 0; i < 5; i++) {
    try {
      await fetchWithCircuitBreaker("https://invalid-url-that-fails.com");
    } catch (error) {
      console.log(`  Attempt ${i + 1} failed`);
    }
  }

  // 3. Timeout
  console.log("\n3. Request Timeout:");
  try {
    await fetchWithTimeout("https://httpbin.org/delay/10", 2000);
  } catch (error) {
    console.log("  Timeout handled correctly");
  }

  // 4. Request Batching
  console.log("\n4. Request Batching:");
  const batcher = new RequestBatcher(3, 500);
  const urls = [
    "https://jsonplaceholder.typicode.com/posts/1",
    "https://jsonplaceholder.typicode.com/posts/2",
    "https://jsonplaceholder.typicode.com/posts/3",
    "https://jsonplaceholder.typicode.com/posts/4",
    "https://jsonplaceholder.typicode.com/posts/5",
  ];
  const results = await batcher.batchProcess(urls);
  console.log(
    `  Processed ${results.filter((r) => r.success).length}/${
      results.length
    } successfully`
  );

  console.log("\n=== DONE ===");
})();

// ===========================================
// EXERCISES:
// ===========================================
// 1. Implement request deduplication (ignore duplicate in-flight requests)
// 2. Add request prioritization (high/low priority queue)
// 3. Create health check endpoint polling
// 4. Implement long polling vs WebSocket comparison
// 5. Add request/response logging to file
// 6. Create API mock server with faker.js for testing
// 7. Implement conditional requests (If-Modified-Since, ETags)
// 8. Add request idempotency with unique request IDs

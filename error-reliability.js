const axios = require("axios");

// ===========================================
// ERROR HANDLING BEST PRACTICES
// ===========================================

// 1. Comprehensive Error Handler
const handleAPIError = (error) => {
  // Network error (no response from server)
  if (!error.response) {
    if (error.code === "ECONNABORTED") {
      return {
        type: "timeout",
        message: "Request timeout - server took too long to respond",
      };
    }
    if (error.code === "ENOTFOUND") {
      return {
        type: "network",
        message: "Network error - cannot reach server (DNS failure)",
      };
    }
    if (error.code === "ECONNREFUSED") {
      return {
        type: "network",
        message: "Connection refused - server is not running",
      };
    }
    return {
      type: "network",
      message: `Network error: ${error.message}`,
    };
  }

  // HTTP error response
  const { status, data } = error.response;

  if (status >= 400 && status < 500) {
    // Client errors
    return {
      type: "client",
      status,
      message: data?.message || data?.error || "Client error",
      details: data,
    };
  }

  if (status >= 500) {
    // Server errors
    return {
      type: "server",
      status,
      message: data?.message || "Server error",
      details: data,
    };
  }

  return {
    type: "unknown",
    status,
    message: "Unknown error",
    details: data,
  };
};

// 2. Retry with Exponential Backoff
class RetryHandler {
  constructor(maxRetries = 3, baseDelay = 1000) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
  }

  async execute(fn, retryable = (error) => true) {
    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Check if we should retry
        if (!retryable(error) || attempt === this.maxRetries) {
          break;
        }

        // Exponential backoff: 1s, 2s, 4s, 8s...
        const delay = this.baseDelay * Math.pow(2, attempt);
        console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Determine if error is retryable
const isRetryable = (error) => {
  // Retry on network errors
  if (!error.response) return true;

  const status = error.response.status;

  // Retry on server errors (5xx) and rate limiting (429)
  if (status === 429 || status >= 500) return true;

  // Don't retry on client errors (4xx)
  return false;
};

// 3. Custom Error Classes
class APIError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.data = data;
  }
}

class ValidationError extends APIError {
  constructor(errors) {
    super("Validation failed", 422, errors);
    this.name = "ValidationError";
    this.errors = errors;
  }
}

class AuthenticationError extends APIError {
  constructor(message = "Authentication required") {
    super(message, 401, null);
    this.name = "AuthenticationError";
  }
}

class RateLimitError extends APIError {
  constructor(retryAfter) {
    super("Rate limit exceeded", 429, null);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

// 4. Error Response Wrapper
const safeAPICall = async (fn) => {
  try {
    const result = await fn();
    return { success: true, data: result };
  } catch (error) {
    const errorInfo = handleAPIError(error);
    return { success: false, error: errorInfo };
  }
};

// Usage
const fetchUserSafely = async (userId) => {
  return safeAPICall(async () => {
    const response = await axios.get(`https://api.example.com/users/${userId}`);
    return response.data;
  });
};

// 5. Global Error Handler with Axios Interceptor
const setupGlobalErrorHandler = () => {
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      const errorInfo = handleAPIError(error);

      // Log error (could send to monitoring service)
      console.error("API Error:", errorInfo);

      // Handle specific errors globally
      if (errorInfo.status === 401) {
        // Redirect to login
        console.log("Redirecting to login...");
      }

      if (errorInfo.status === 429) {
        // Show rate limit message
        console.log("You're being rate limited");
      }

      // Throw custom error
      if (errorInfo.status === 422) {
        throw new ValidationError(errorInfo.details);
      }

      return Promise.reject(error);
    }
  );
};

// ===========================================
// REQUEST DEDUPLICATION
// ===========================================

class RequestDeduplicator {
  constructor() {
    this.pendingRequests = new Map();
  }

  // Generate unique key for request
  getKey(method, url, params) {
    return `${method}:${url}:${JSON.stringify(params || {})}`;
  }

  // Execute request with deduplication
  async execute(method, url, params = null) {
    const key = this.getKey(method, url, params);

    // If request is already in flight, return existing promise
    if (this.pendingRequests.has(key)) {
      console.log("✓ Reusing in-flight request:", key);
      return this.pendingRequests.get(key);
    }

    // Start new request
    const promise = axios({ method, url, params })
      .then((response) => {
        this.pendingRequests.delete(key);
        return response.data;
      })
      .catch((error) => {
        this.pendingRequests.delete(key);
        throw error;
      });

    this.pendingRequests.set(key, promise);
    return promise;
  }
}

// ===========================================
// IDEMPOTENCY (Preventing Duplicate Actions)
// ===========================================

class IdempotentClient {
  constructor() {
    this.processedRequests = new Set();
  }

  // Generate unique idempotency key
  generateKey() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async post(url, data, idempotencyKey = null) {
    // Generate key if not provided
    const key = idempotencyKey || this.generateKey();

    // Check if already processed
    if (this.processedRequests.has(key)) {
      throw new Error("Request already processed (duplicate)");
    }

    try {
      const response = await axios.post(url, data, {
        headers: {
          "Idempotency-Key": key,
        },
      });

      // Mark as processed
      this.processedRequests.add(key);

      return response.data;
    } catch (error) {
      // If error is 409 Conflict, request was already processed
      if (error.response?.status === 409) {
        console.log("Request already processed on server");
      }
      throw error;
    }
  }
}

// ===========================================
// HEALTH CHECK & MONITORING
// ===========================================

class APIHealthChecker {
  constructor(healthCheckUrl, interval = 30000) {
    this.healthCheckUrl = healthCheckUrl;
    this.interval = interval;
    this.isHealthy = true;
    this.intervalId = null;
  }

  async check() {
    try {
      const response = await axios.get(this.healthCheckUrl, {
        timeout: 5000,
      });

      this.isHealthy = response.status === 200;
      console.log(
        `Health check: ${this.isHealthy ? "✓ Healthy" : "✗ Unhealthy"}`
      );

      return this.isHealthy;
    } catch (error) {
      this.isHealthy = false;
      console.log("Health check: ✗ Failed");
      return false;
    }
  }

  start() {
    console.log("Starting health check monitoring...");
    this.intervalId = setInterval(() => this.check(), this.interval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      console.log("Health check monitoring stopped");
    }
  }
}

// ===========================================
// TESTING EXAMPLES
// ===========================================

(async () => {
  console.log("=== ERROR HANDLING & RELIABILITY PATTERNS ===\n");

  // 1. Comprehensive error handling
  console.log("1. Comprehensive Error Handling:");
  try {
    await axios.get("https://invalid-url-that-does-not-exist.com");
  } catch (error) {
    const errorInfo = handleAPIError(error);
    console.log("  Error type:", errorInfo.type);
    console.log("  Message:", errorInfo.message);
  }

  // 2. Retry with exponential backoff
  console.log("\n2. Retry with Exponential Backoff:");
  const retryHandler = new RetryHandler(3, 500);
  try {
    await retryHandler.execute(
      async () => {
        // Simulate failing request
        throw new Error("Server error");
      },
      (error) => true // Always retry
    );
  } catch (error) {
    console.log("  All retries exhausted");
  }

  // 3. Safe API call
  console.log("\n3. Safe API Call (no try/catch needed):");
  const result = await safeAPICall(async () => {
    const response = await axios.get(
      "https://jsonplaceholder.typicode.com/posts/1"
    );
    return response.data;
  });
  console.log("  Success:", result.success);
  console.log("  Data:", result.data?.title);

  // 4. Request deduplication
  console.log("\n4. Request Deduplication:");
  const deduplicator = new RequestDeduplicator();
  // Make 3 identical requests simultaneously
  const promises = [
    deduplicator.execute("GET", "https://jsonplaceholder.typicode.com/posts/1"),
    deduplicator.execute("GET", "https://jsonplaceholder.typicode.com/posts/1"),
    deduplicator.execute("GET", "https://jsonplaceholder.typicode.com/posts/1"),
  ];
  const results = await Promise.all(promises);
  console.log("  All requests completed (only 1 actual HTTP call made)");

  // 5. Health check
  console.log("\n5. Health Check:");
  const healthChecker = new APIHealthChecker(
    "https://jsonplaceholder.typicode.com/posts/1",
    10000
  );
  await healthChecker.check();

  console.log("\n=== DONE ===");
})();

// ===========================================
// ERROR HANDLING CHECKLIST
// ===========================================

/*
✅ Network errors (timeout, DNS, connection refused)
✅ HTTP status codes (4xx, 5xx)
✅ Retry logic with exponential backoff
✅ Retryable vs non-retryable errors
✅ Custom error classes
✅ Global error handlers
✅ Request deduplication
✅ Idempotency keys
✅ Health checks
✅ Error logging and monitoring
✅ Graceful degradation
✅ Fallback mechanisms
*/

// ===========================================
// EXERCISES:
// ===========================================
// 1. Add error tracking/monitoring (e.g., Sentry integration)
// 2. Implement fallback data when API fails
// 3. Create request queue that pauses on errors
// 4. Build error notification system
// 5. Add detailed error logging with timestamps
// 6. Implement circuit breaker with half-open state
// 7. Create error recovery strategies per error type
// 8. Build API degradation mode (use cached data when API fails)

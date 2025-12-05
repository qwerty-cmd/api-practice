const axios = require("axios");

// Get free API key from: https://www.alphavantage.co/support/#api-key
const API_KEY = "S7XE13S54SZJGG5D"; // Replace with your key
const BASE_URL = "https://www.alphavantage.co/query";

// ===========================================
// 1. SIMPLE GET REQUEST
// ===========================================
const getStockQuote = async (symbol) => {
  try {
    const response = await axios.get(BASE_URL, {
      params: {
        function: "GLOBAL_QUOTE",
        symbol: symbol,
        apikey: API_KEY,
      },
    });

    console.log(`Stock quote for ${symbol}:`, response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching stock:", error.message);
    throw error;
  }
};

// ===========================================
// 2. ERROR HANDLING - Retry Logic
// ===========================================
const getStockWithRetry = async (symbol, maxRetries = 3) => {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log(`Attempt ${attempt + 1} for ${symbol}...`);

      const response = await axios.get(BASE_URL, {
        params: {
          function: "GLOBAL_QUOTE",
          symbol: symbol,
          apikey: API_KEY,
        },
        timeout: 5000, // 5 second timeout
      });

      // Check for API rate limit message
      if (response.data.Note) {
        throw new Error("Rate limit exceeded");
      }

      return response.data;
    } catch (error) {
      attempt++;

      if (attempt >= maxRetries) {
        console.error(`Failed after ${maxRetries} attempts:`, error.message);
        throw error;
      }

      // Exponential backoff: wait 2^attempt seconds
      const waitTime = Math.pow(2, attempt) * 1000;
      console.log(`Waiting ${waitTime}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
};

// ===========================================
// 3. RATE LIMITING - Queue System
// ===========================================
class RateLimiter {
  constructor(maxRequests, timeWindow) {
    this.maxRequests = maxRequests; // e.g., 5
    this.timeWindow = timeWindow; // e.g., 60000ms (1 minute)
    this.queue = [];
    this.processing = false;
  }

  async execute(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const { fn, resolve, reject } = this.queue.shift();

    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      reject(error);
    }

    // Wait before processing next request
    const waitTime = this.timeWindow / this.maxRequests;
    setTimeout(() => {
      this.processing = false;
      this.processQueue();
    }, waitTime);
  }
}

// Usage:
const rateLimiter = new RateLimiter(5, 60000); // 5 requests per minute

const getRateLimitedStock = async (symbol) => {
  return rateLimiter.execute(async () => {
    console.log(`Fetching ${symbol} with rate limiting...`);
    const response = await axios.get(BASE_URL, {
      params: {
        function: "GLOBAL_QUOTE",
        symbol: symbol,
        apikey: API_KEY,
      },
    });
    return response.data;
  });
};

// ===========================================
// 4. CACHING - In-Memory Cache
// ===========================================
class APICache {
  constructor(ttl = 60000) {
    this.cache = new Map();
    this.ttl = ttl; // Time to live in milliseconds
  }

  get(key) {
    const item = this.cache.get(key);

    if (!item) return null;

    // Check if expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    console.log(`Cache HIT for ${key}`);
    return item.data;
  }

  set(key, data) {
    console.log(`Cache SET for ${key}`);
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.ttl,
    });
  }

  clear() {
    this.cache.clear();
  }
}

const cache = new APICache(300000); // 5 minute cache

const getCachedStock = async (symbol) => {
  // Check cache first
  const cached = cache.get(symbol);
  if (cached) {
    return cached;
  }

  // Fetch from API
  console.log(`Cache MISS for ${symbol} - fetching from API...`);
  const response = await axios.get(BASE_URL, {
    params: {
      function: "GLOBAL_QUOTE",
      symbol: symbol,
      apikey: API_KEY,
    },
  });

  // Store in cache
  cache.set(symbol, response.data);

  return response.data;
};

// ===========================================
// 5. COMBINING ALL: Rate Limiting + Caching + Error Handling
// ===========================================
class StockAPIClient {
  constructor(apiKey, maxRequests = 5, cacheTime = 300000) {
    this.apiKey = apiKey;
    this.cache = new APICache(cacheTime);
    this.rateLimiter = new RateLimiter(maxRequests, 60000);
  }

  async getStock(symbol, useCache = true) {
    // Check cache
    if (useCache) {
      const cached = this.cache.get(symbol);
      if (cached) return cached;
    }

    // Rate-limited API call with retry logic
    return this.rateLimiter.execute(async () => {
      return this.fetchWithRetry(symbol);
    });
  }

  async fetchWithRetry(symbol, maxRetries = 3) {
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const response = await axios.get(BASE_URL, {
          params: {
            function: "GLOBAL_QUOTE",
            symbol: symbol,
            apikey: this.apiKey,
          },
          timeout: 5000,
        });

        if (response.data.Note) {
          throw new Error("Rate limit exceeded");
        }

        // Cache the result
        this.cache.set(symbol, response.data);

        return response.data;
      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) throw error;

        const waitTime = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }
}

// ===========================================
// TESTING / EXAMPLES
// ===========================================
(async () => {
  console.log("=== API PRACTICE EXAMPLES ===\n");

  // Example 1: Simple GET
  console.log("1. Simple GET request:");
  // await getStockQuote("IBM");

  // Example 2: Error handling with retry
  console.log("\n2. GET with retry logic:");
  // await getStockWithRetry("AAPL");

  // Example 3: Rate limiting
  console.log("\n3. Rate-limited requests:");
  // const symbols = ["IBM", "AAPL", "GOOGL", "MSFT", "TSLA"];
  // const promises = symbols.map(symbol => getRateLimitedStock(symbol));
  // await Promise.all(promises);

  // Example 4: Caching
  console.log("\n4. Caching example:");
  // await getCachedStock("IBM"); // Cache MISS - fetches from API
  // await getCachedStock("IBM"); // Cache HIT - returns from cache

  // Example 5: Full client with everything
  console.log("\n5. Full API client:");
  const client = new StockAPIClient(API_KEY);

  // First call - cache miss, rate limited
  await client.getStock("IBM");

  // Second call - cache hit
  await client.getStock("IBM");

  // Multiple calls - rate limited
  const symbols = ["AAPL", "GOOGL", "MSFT"];
  for (const symbol of symbols) {
    await client.getStock(symbol);
  }

  console.log("\n=== DONE ===");
})();

// ===========================================
// EXERCISES TO TRY:
// ===========================================
// 1. Add POST/PUT/PATCH simulation with JSONPlaceholder API
// 2. Implement cache invalidation
// 3. Add request/response logging
// 4. Implement circuit breaker pattern
// 5. Add metrics tracking (success rate, avg response time)

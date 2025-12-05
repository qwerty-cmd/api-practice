require("dotenv").config({ quiet: true });
const axios = require("axios");

// Disable SSL verification for corporate networks (development only)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
process.removeAllListeners("warning");

const API_KEY = process.env.API_KEY;
const BASE_URL = process.env.BASE_URL;

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
    return response.data;
  } catch (error) {
    console.error("Error retrieving stock data: ", error.message);
    throw error;
  }
};

const getStockWithRetry = async (symbol, maxRetries = 3, delay = 2000) => {
  let attempt = 0;

  while (attempt < maxRetries) {
    console.log(`Attempt ${attempt + 1} for ${symbol}...`);

    try {
      const response = await axios.get(BASE_URL, {
        params: {
          function: "GLOBAL_QUOTE",
          symbol: symbol,
          apikey: API_KEY,
        },
        timeout: 5000,
      });
      attempt++;

      if (response.data.Note) {
        throw new Error("Rate limit exceeded");
      }

      return response.data;
    } catch (error) {
      attempt++;

      if (attempt >= maxRetries) {
        console.error(`Failed after ${maxRetries}, attempts: ${attempt}`);
      }

      // Implement exponential backoff
      console.log(`Waiting ${delay}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

class RateLimiter {
  constructor(maxRequests, timeWindow) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.queue = [];
    this.processing = false;
  }

  async enqueue(requestFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ requestFn, resolve, reject });
      this.processQueue();
    });
  }

  async waitAndRetry(waitTime) {
    return setTimeout(() => {
      this.processing = false;
      this.processQueue();
    }, waitTime);
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    const { requestFn, resolve, reject } = this.queue.shift();

    try {
      const result = await requestFn();
      resolve(result);
    } catch (error) {
      // Check if it's a rate limit error
      if (error.response?.status === 429) {
        this.queue.unshift({ requestFn, resolve, reject });

        const waitTime = 60000;
        this.waitAndRetry(waitTime);
        return;
      }
      reject(error);
    }

    const waitTime = this.timeWindow / this.maxRequests;
    this.waitAndRetry(waitTime);
  }
}

const rateLimiter = new RateLimiter(5, 60000); // 5 requests per minute

const getStockWithRateLimit = async (symbol) => {
  return rateLimiter.enqueue(async () => {
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

class APICache {
  constructor(ttl = 60000) {
    this.cache = new Map();
    this.ttl = ttl;
  }

  get(key) {
    const item = this.cache.get(key);

    if (!item) return null;

    // check if expired
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

const cache = new APICache(300000);

const getCachedStock = async (symbol) => {
  const cached = cache.get(symbol);
  if (cached) {
    return cached;
  }

  console.log(`Cache MISS for ${symbol}, fetching...`);
  const response = await axios.get(BASE_URL, {
    params: {
      function: "GLOBAL_QUOTE",
      symbol: symbol,
      apikey: API_KEY,
    },
  });

  cache.set(symbol, response.data);
  return response.data;
};

class StockAPIClient {
  constructor(apiKey, maxRequests = 5, cacheTime = 300000) {
    this.apiKey = apiKey;
    this.cache = new APICache(cacheTime);
    this.rateLimiter = new RateLimiter(maxRequests, 60000);
  }

  async getStock(symbol, useCache = true) {
    // check cache
    if (useCache) {
      const cached = this.cache.get(symbol);
      if (cached) return cached;
    }

    return this.rateLimiter.enqueue(async () => {
      return this.fetchWithRetry(symbol);
    });
  }

  async fetchWithRetry(symbol, maxRetries = 3, delay = 2000) {
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
        attempt++;
      } catch (error) {
        if (attempt >= maxRetries) {
          throw new Error(
            `Failed to fetch data for ${symbol} after ${maxRetries} attempts`
          );
        }
        const waitTime = delay * 2;
        console.log(`Waiting ${waitTime}ms before retry...`);
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
  await getStockQuote("IBM");

  // Example 2: Error handling with retry
  console.log("\n2. GET with retry logic:");
  await getStockWithRetry("AAPL");

  // Example 3: Rate limiting
  console.log("\n3. Rate-limited requests:");
  const rateLimitSymbols = ["IBM", "AAPL", "GOOGL", "MSFT", "TSLA"];
  const promises = rateLimitSymbols.map((symbol) =>
    getStockWithRateLimit(symbol)
  );
  await Promise.all(promises);

  // Example 4: Caching
  console.log("\n4. Caching example:");
  await getCachedStock("IBM"); // Cache MISS - fetches from API
  await getCachedStock("IBM"); // Cache HIT - returns from cache

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
const putStockData = async (symbol, req) => {
  try {
    const request = await axios.put(
      "https://jsonplaceholder.typicode.com/posts/1",
      {
        symbol: symbol,
        ...req,
      },
      {
        headers: {
          "Content-type": "application/json; charset=UTF-8",
        },
      }
    );
    console.log("PUT request successful:", request.data);
    return request.data;
  } catch (error) {
    console.error("Error in PUT request: ", error.message);
    throw error;
  }
};

const patchStockData = async (symbol, req) => {
  try {
    const request = await axios.patch(
      "https://jsonplaceholder.typicode.com/posts/1",
      {
        symbol: symbol,
        ...req,
      },
      {
        headers: {
          "Content-type": "application/json; charset=UTF-8",
        },
      }
    );
    console.log("PATCH request successful:", request.data);
    return request.data;
  } catch (error) {
    console.error("Error in PATCH request: ", error.message);
    throw error;
  }
};

const postStockData = async (symbol, req) => {
  try {
    const request = await axios.post(
      "https://jsonplaceholder.typicode.com/posts",
      {
        symbol: symbol,
        ...req,
      },
      {
        headers: {
          "Content-type": "application/json; charset=UTF-8",
        },
      }
    );
    console.log("POST request successful:", request.data);
    return request.data;
  } catch (error) {
    console.error("Error in POST request: ", error.message);
    throw error;
  }
};

// Test putStockData
const testPutStockData = async () => {
  console.log("\n=== Testing PUT Request ===");

  const result = await putStockData("AAPL", {
    price: 175.5,
    volume: 1000000,
    lastUpdated: new Date().toISOString(),
  });

  console.log("\n✅ PUT Request Result:");
  console.log(JSON.stringify(result, null, 2));
};

// Test patchStockData
const testPatchStockData = async () => {
  console.log("\n=== Testing PATCH Request ===");

  const result = await patchStockData("TSLA", {
    price: 242.84,
  });

  console.log("\n✅ PATCH Request Result:");
  console.log(JSON.stringify(result, null, 2));
};

// Test postStockData
const testPostStockData = async () => {
  console.log("\n=== Testing POST Request ===");

  const result = await postStockData("GOOGL", {
    price: 140.25,
    volume: 850000,
    exchange: "NASDAQ",
    lastUpdated: new Date().toISOString(),
  });

  console.log("\n✅ POST Request Result:");
  console.log(JSON.stringify(result, null, 2));
  console.log("📌 Note: POST creates new resource, returns with 'id' field");
};

// Run all tests
const runAllTests = async () => {
  await testPutStockData();
  await testPatchStockData();
  await testPostStockData();

  console.log("\n📝 Summary:");
  console.log("- PUT: Updates entire resource");
  console.log("- PATCH: Partial update (only changed fields)");
  console.log("- POST: Creates new resource");
  console.log("\n✅ All tests completed!");
};

// Uncomment to test:
// testPutStockData();
// testPatchStockData();
// testPostStockData();
runAllTests();

// 2. Implement cache invalidation
class APICacheWithInvalidation {
  constructor(ttl = 60000) {
    this.cache = new Map();
    this.ttl = ttl;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

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
  invalidate(key) {
    console.log(`Cache INVALIDATE for ${key}`);
    this.cache.delete(key);
  }

  clear() {
    console.log("Cache CLEAR all");
    this.cache.clear();
  }
}

// 3. Add request/response logging
// 4. Implement circuit breaker pattern
// 5. Add metrics tracking (success rate, avg response time)

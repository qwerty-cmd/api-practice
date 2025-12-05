const axios = require("axios");

// ===========================================
// HEADERS PRACTICE
// ===========================================

// 1. Common Request Headers
const commonHeaders = {
  // Content type
  "Content-Type": "application/json", // JSON payload
  // "Content-Type": "application/x-www-form-urlencoded", // Form data
  // "Content-Type": "multipart/form-data", // File upload

  // Authentication
  Authorization: "Bearer your-token-here",
  // "API-Key": "your-api-key",

  // Accept (what format you want back)
  Accept: "application/json",
  // Accept: "application/xml",
  // Accept: "text/html",

  // User Agent (identify your client)
  "User-Agent": "MyApp/1.0",

  // CORS
  Origin: "https://myapp.com",

  // Language
  "Accept-Language": "en-US,en;q=0.9",

  // Encoding
  "Accept-Encoding": "gzip, deflate, br",

  // Caching
  "Cache-Control": "no-cache",
  // "Cache-Control": "max-age=3600",

  // Custom headers (usually prefixed with X-)
  "X-Request-ID": "unique-request-id-123",
  "X-Client-Version": "1.0.0",
};

// 2. Conditional Requests (Caching)
const conditionalRequestExample = async () => {
  // First request
  const response1 = await axios.get("https://api.example.com/data");
  const etag = response1.headers.etag;
  const lastModified = response1.headers["last-modified"];

  console.log("ETag:", etag);
  console.log("Last-Modified:", lastModified);

  // Second request with conditional headers
  try {
    const response2 = await axios.get("https://api.example.com/data", {
      headers: {
        "If-None-Match": etag, // If ETag matches, returns 304
        "If-Modified-Since": lastModified, // If not modified, returns 304
      },
    });
    console.log("Data changed:", response2.data);
  } catch (error) {
    if (error.response?.status === 304) {
      console.log("✓ Data not modified, use cached version");
    }
  }
};

// 3. CORS Headers
const corsExample = {
  // Request headers
  Origin: "https://myapp.com",
  "Access-Control-Request-Method": "POST",
  "Access-Control-Request-Headers": "Content-Type, Authorization",

  // Response headers (server-side)
  "Access-Control-Allow-Origin": "*", // or specific origin
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400", // Preflight cache time
};

// 4. Pagination Headers
const paginationExample = async () => {
  const response = await axios.get("https://api.example.com/items", {
    params: { page: 1, limit: 10 },
  });

  // Read pagination info from headers
  const totalCount = response.headers["x-total-count"];
  const totalPages = response.headers["x-total-pages"];
  const currentPage = response.headers["x-current-page"];

  // Or from Link header (GitHub style)
  const linkHeader = response.headers.link;
  // Example: <https://api.github.com/repos?page=2>; rel="next"
  console.log("Total:", totalCount);
  console.log("Page:", currentPage, "of", totalPages);
};

// 5. Rate Limiting Headers
const rateLimitExample = async () => {
  const response = await axios.get("https://api.example.com/data");

  // Standard rate limit headers
  const limit = response.headers["x-ratelimit-limit"]; // Max requests
  const remaining = response.headers["x-ratelimit-remaining"]; // Remaining
  const reset = response.headers["x-ratelimit-reset"]; // Reset timestamp

  // Alternative: Retry-After header (for 429 responses)
  const retryAfter = response.headers["retry-after"]; // Seconds to wait

  console.log(`Rate limit: ${remaining}/${limit}`);
  console.log(`Resets at: ${new Date(reset * 1000)}`);
};

// ===========================================
// QUERY PARAMETERS PRACTICE
// ===========================================

// 1. Basic Query Params
const basicQueryParams = {
  // Filtering
  status: "active",
  category: "electronics",
  minPrice: 10,
  maxPrice: 100,

  // Searching
  q: "laptop", // Search query
  search: "macbook pro",

  // Sorting
  sort: "price", // Field to sort by
  order: "asc", // or "desc"
  sortBy: "created_at:desc",

  // Pagination
  page: 1,
  limit: 20,
  offset: 0,
  perPage: 50,

  // Fields selection (sparse fieldsets)
  fields: "id,name,price", // Only return these fields

  // Relationships/Include
  include: "author,comments", // Include related data

  // Date filtering
  startDate: "2024-01-01",
  endDate: "2024-12-31",
  createdAfter: "2024-01-01T00:00:00Z",

  // Boolean flags
  includeDeleted: false,
  isActive: true,
};

// 2. Complex Query Building
const buildComplexQuery = () => {
  const params = new URLSearchParams();

  // Add multiple values for same key
  params.append("tags", "javascript");
  params.append("tags", "nodejs");
  params.append("tags", "api");

  // Nested filters (depends on API)
  params.append("filter[status]", "active");
  params.append("filter[price][gte]", "10");
  params.append("filter[price][lte]", "100");

  // Arrays in different formats
  // Style 1: tags[]=javascript&tags[]=nodejs
  // Style 2: tags=javascript,nodejs
  // Style 3: tags=javascript&tags=nodejs

  console.log(params.toString());
  // Output: tags=javascript&tags=nodejs&tags=api&filter[status]=active...
};

// 3. Axios Query Params
const axiosQueryExample = async () => {
  // Method 1: params object (recommended)
  await axios.get("https://api.example.com/items", {
    params: {
      page: 1,
      limit: 10,
      sort: "name",
      filter: "active",
    },
  });

  // Method 2: URLSearchParams
  const params = new URLSearchParams({
    page: "1",
    limit: "10",
  });
  await axios.get("https://api.example.com/items", { params });

  // Method 3: Manual string
  await axios.get("https://api.example.com/items?page=1&limit=10");
};

// 4. Query String Encoding
const queryEncodingExample = () => {
  // Special characters need encoding
  const searchQuery = "hello world & special chars!";
  const encoded = encodeURIComponent(searchQuery);
  console.log(encoded);
  // Output: hello%20world%20%26%20special%20chars%21

  // URLSearchParams handles this automatically
  const params = new URLSearchParams({ q: searchQuery });
  console.log(params.toString());
  // Output: q=hello+world+%26+special+chars%21
};

// ===========================================
// STATUS CODES PRACTICE
// ===========================================

const handleStatusCodes = async (url) => {
  try {
    const response = await axios.get(url);

    switch (response.status) {
      // 2xx Success
      case 200: // OK - Request succeeded
        console.log("✓ Success:", response.data);
        break;
      case 201: // Created - Resource created
        console.log("✓ Resource created:", response.data);
        break;
      case 204: // No Content - Success but no data
        console.log("✓ Success (no content)");
        break;

      default:
        console.log("Success:", response.status);
    }
  } catch (error) {
    if (!error.response) {
      // Network error
      console.error("✗ Network error:", error.message);
      return;
    }

    const { status, data } = error.response;

    switch (status) {
      // 4xx Client Errors
      case 400: // Bad Request - Invalid input
        console.error("✗ Bad request:", data.message);
        break;
      case 401: // Unauthorized - Not authenticated
        console.error("✗ Not authenticated - login required");
        break;
      case 403: // Forbidden - Not authorized
        console.error("✗ Forbidden - insufficient permissions");
        break;
      case 404: // Not Found
        console.error("✗ Resource not found");
        break;
      case 409: // Conflict - Duplicate resource
        console.error("✗ Conflict:", data.message);
        break;
      case 422: // Unprocessable Entity - Validation error
        console.error("✗ Validation errors:", data.errors);
        break;
      case 429: // Too Many Requests - Rate limited
        const retryAfter = error.response.headers["retry-after"];
        console.error(`✗ Rate limited - retry after ${retryAfter}s`);
        break;

      // 5xx Server Errors
      case 500: // Internal Server Error
        console.error("✗ Server error");
        break;
      case 502: // Bad Gateway
        console.error("✗ Bad gateway");
        break;
      case 503: // Service Unavailable
        console.error("✗ Service unavailable");
        break;
      case 504: // Gateway Timeout
        console.error("✗ Gateway timeout");
        break;

      default:
        console.error("✗ Error:", status, data);
    }
  }
};

// ===========================================
// CONTENT NEGOTIATION
// ===========================================

// Request different response formats
const contentNegotiation = async () => {
  // Request JSON
  const jsonResponse = await axios.get("https://api.example.com/data", {
    headers: { Accept: "application/json" },
  });

  // Request XML
  const xmlResponse = await axios.get("https://api.example.com/data", {
    headers: { Accept: "application/xml" },
  });

  // Request CSV
  const csvResponse = await axios.get("https://api.example.com/data", {
    headers: { Accept: "text/csv" },
  });

  // Multiple acceptable formats (with quality values)
  const response = await axios.get("https://api.example.com/data", {
    headers: { Accept: "application/json, application/xml;q=0.9, */*;q=0.8" },
  });

  // Check what format was returned
  const contentType = response.headers["content-type"];
  console.log("Received format:", contentType);
};

// ===========================================
// TESTING EXAMPLES
// ===========================================

(async () => {
  console.log("=== HEADERS & QUERY PARAMS PRACTICE ===\n");

  // 1. Basic request with headers
  console.log("1. Request with custom headers:");
  try {
    const response = await axios.get(
      "https://jsonplaceholder.typicode.com/posts/1",
      {
        headers: {
          "User-Agent": "MyAPIClient/1.0",
          "X-Custom-Header": "test-value",
        },
      }
    );
    console.log("  Response headers:", {
      contentType: response.headers["content-type"],
      cacheControl: response.headers["cache-control"],
    });
  } catch (error) {
    console.error(error.message);
  }

  // 2. Query parameters
  console.log("\n2. Query parameters:");
  try {
    const response = await axios.get(
      "https://jsonplaceholder.typicode.com/posts",
      {
        params: {
          userId: 1,
          _limit: 5,
        },
      }
    );
    console.log(`  Fetched ${response.data.length} posts`);
  } catch (error) {
    console.error(error.message);
  }

  // 3. Complex query building
  console.log("\n3. Complex query building:");
  buildComplexQuery();

  // 4. Status code handling
  console.log("\n4. Status code handling:");
  await handleStatusCodes("https://jsonplaceholder.typicode.com/posts/999999");

  console.log("\n=== DONE ===");
})();

// ===========================================
// COMMON API QUERY PATTERNS
// ===========================================

// REST API Query Examples:

// Filtering:
// GET /api/products?category=electronics&status=active

// Sorting:
// GET /api/products?sort=price&order=desc
// GET /api/products?sort=-price (minus means descending)

// Pagination:
// GET /api/products?page=2&limit=20
// GET /api/products?offset=20&limit=20

// Searching:
// GET /api/products?q=laptop
// GET /api/products?search=macbook+pro

// Field Selection:
// GET /api/products?fields=id,name,price
// GET /api/products?fields[]=id&fields[]=name

// Including Relations:
// GET /api/posts?include=author,comments
// GET /api/posts?expand=user

// Date Ranges:
// GET /api/orders?start_date=2024-01-01&end_date=2024-12-31
// GET /api/orders?created_at[gte]=2024-01-01

// Multiple Values:
// GET /api/products?tags=electronics&tags=sale
// GET /api/products?tags=electronics,sale
// GET /api/products?tags[]=electronics&tags[]=sale

// ===========================================
// EXERCISES:
// ===========================================
// 1. Build a query string builder utility function
const queryStringBuilder = (params) => {
  // Use URLSearchParams for proper encoding
  const query = new URLSearchParams(params);

  // Convert query to string to test the final output
  return query.toString();
};

// Testing queryStringBuilder
console.log("\n=== Testing Query String Builder ===\n");

// Test 1: Basic parameters
console.log("Test 1: Basic parameters");
const test1 = { page: 1, limit: 10, sort: "name" };
console.log("Input:", test1);
console.log("Output:", queryStringBuilder(test1));
console.log("Expected: page=1&limit=10&sort=name\n");

// Test 2: Special characters (encoding test)
console.log("Test 2: Special characters");
const test2 = { q: "hello world", filter: "price>100" };
console.log("Input:", test2);
console.log("Output:", queryStringBuilder(test2));
console.log("Expected: Special chars should be encoded\n");

// Test 3: Boolean and number values
console.log("Test 3: Different data types");
const test3 = { active: true, count: 42, price: 99.99 };
console.log("Input:", test3);
console.log("Output:", queryStringBuilder(test3));
console.log("Expected: active=true&count=42&price=99.99\n");

// Test 4: Empty object
console.log("Test 4: Empty object");
const test4 = {};
console.log("Input:", test4);
console.log("Output:", queryStringBuilder(test4));
console.log("Expected: (empty string)\n");

// Test 5: Complex query with the full basicQueryParams
console.log("Test 5: Full basicQueryParams");
const params = basicQueryParams;
console.log("Output:", queryStringBuilder(params));
console.log("\n");

// 2. Create a header manager class
class HeaderManager {
  constructor() {
    // Initialise default headers
    this.defaultHeaders = {
      "Content-Type": "application/json",
      "User-Agent": "MyApp/1.0",
    };
    this.authToken = null;
  }

  // Set auth token
  setAuthToken(token) {
    this.authToken = token;
    if (token) {
      this.defaultHeaders["Authorization"] = `Bearer ${token}`;
    } else {
      delete this.defaultHeaders["Authorization"];
    }
  }

  // get headers for auth request
  getAuthHeaders() {
    return {
      ...this.defaultHeaders,
      Authorization: `Basic ${this.authToken}`,
    };
  }

  // get headers for public requests
  getPublicHeaders() {
    return { ...this.defaultHeaders };
  }

  // Add custom header
  addHeader(key, value) {
    this.defaultHeaders[key] = value;
  }

  // Remove header
  removeHeader(key) {
    delete this.defaultHeaders[key];
  }
}

// 3. Implement automatic retry on 503 with Retry-After header
const axiosRetryExample = async (url, maxRetries = 3) => {
  let attempts = 0;

  // As long as the attempts are less than or equal to the maxRetries
  while (attempts < maxRetries) {
    try {
      // Attempt making the request
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      // If a 503 is received, check for retry-after header
      if (error.response?.status === 503) {
        const retryAfter = error.response.headers["retry-after"];

        // Wait for the specified time before retrying
        const waitTime = (retryAfter ? parseInt(retryAfter) : 1) * 1000;
        console.log(
          `503 received. Retrying after ${waitTime / 1000} seconds...`
        );

        // Wait before next attempt
        await new Promise((res) => setTimeout(res, waitTime));
        attempts++;
      }
    }
  }
};
// 4. Parse Link header for pagination
const parseLinkHeader = (linkHeader) => {
  const links = {};
  if (!linkHeader) return links;
  const parts = linkHeader.split(",");
  parts.forEach((part) => {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) {
      const url = match[1];
      const rel = match[2];
      links[rel] = url;
    }
  });

  return links;
};

const response = await axios.get("https://api.example.com/items");
const linkHeader = response.headers.link;
const links = parseLinkHeader(linkHeader);
console.log("Parsed Links:", links);

// 5. Build a response cache using ETag/Last-Modified
class ResponseCache {
  constructor() {
    this.cache = new Map();
  }

  // Get cached response or make a request
  async get(url) {
    const cached = this.cache.get(url);
    const headers = {};

    // Add conditional headers if attached
    if (cached) {
      if (cached.etag) {
        headers["If-None-Match"] = cached.etag;
      }
      if (cached.lastModified) {
        headers["If-Modified-Since"] = cached.lastModified;
      }
    }
    try {
      // Make the request with conditional headers
      const response = await axios.get(url, { headers });

      // If 200, update cache
      if (response.status === 200) {
        this.cache.set(url, {
          data: response.data,
          etage: response.headers.etag,
          lastModified: response.headers["last-modified"],
        });
        return response.data;
      }
      // If something has changed, return the cached data and throw a new error
    } catch (error) {
      if (error.response?.status === 304 && cached) {
        return cached.data;
      }
      // Create error stack
      throw new Error(
        `Request failed: ${error.message}, ERROR STACK: ${error.stack}`
      );
    }
  }
}
// 6. Create a rate limit tracker from response headers
class RateLimitTrakcer {
  constructor() {
    this.limit = null;
    this.remaining = null;
    this.reset = null;
  }

  // Update tracker from response headers
  update(response) {
    this.limit = parseInt(response.headers["x-ratelimit-limit"]);
    this.remaining = parseInt(response.headers["x-ratelimit-remaining"]);
    this.reset = parseInt(response.headers["x-ratelimit-reset"]);
  }

  logStatus() {
    if (this.remaining !== null) {
      console.log("Rate Limit Status:");
      console.log(`  Limit: ${this.limit}`);
      console.log(`  Remaining: ${this.remaining}`);
      console.log(
        `  Resets at: ${new Date(this.reset * 1000).toLocaleTimeString()}`
      );
    }
  }

  // Check if we should wait
  shouldWait() {
    if (this.remaining === 0) {
      const now = Date.now();
      const waitTime = this.reset * 1000 - now;
      console.log(`Rate limit exceeded. Wait for ${waitTime / 1000}s`);
      return true;
    }
    return false;
  }

  getStatus() {
    return {
      limit: this.limit,
      remaining: this.remaining,
      reset: new Date(this.reset * 1000),
      percentageUsed: this.limit
        ? Math.round(((this.limit - this.remaining) / this.limit) * 100)
        : 0,
    };
  }
}

// 7. Handle different response formats (JSON, XML, CSV)
const handleDifferentFormats = async (url, format) => {
  const response = await axios.get(url, {
    headers: {
      Accept:
        format === "json"
          ? "application/json"
          : format === "xml"
          ? "application/xml"
          : format === "csv"
          ? "text/csv"
          : "application/json",
    },
  });

  switch (format) {
    case "json":
      return response.data;

    case "xml":
      const xml2js = require("xml2js");
      const parser = new xml2js.Parser();
      return await parser.parserStringPromise(response.data);

    case "csv":
      const parse = require("csv-parse/lib/sync");
      return parse(response.data, {
        columns: true,
        skip_empty_lines: true,
      });

    default:
      return response.data;
  }
};

// 8. Implement request signing with custom headers
const crypto = require("crypto");

const signRequest = (method, url, body, secretKey) => {
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString("hex");

  // Create string to sign
  const stringToSign = [
    method,
    url,
    timestamp,
    nonce,
    JSON.stringify(body),
  ].join("\n");

  // Create HMAC signature
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(stringToSign)
    .digest("hex");

  // Return custom headers
  return {
    "X-Timestamp": timestamp,
    "X-Nonce": nonce,
    "X-Signature": signature,
  };
};

// Usage
const headers = signRequest(
  "POST",
  "/api/trade",
  { symbol: "AAPL", qty: 10 },
  "my-secret-key"
);

await axios.post("/api/trade", { symbol: "AAPL", qty: 10 }, { headers });

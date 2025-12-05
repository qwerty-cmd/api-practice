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
// 2. Create a header manager class
// 3. Implement automatic retry on 503 with Retry-After header
// 4. Parse Link header for pagination
// 5. Build a response cache using ETag/Last-Modified
// 6. Create a rate limit tracker from response headers
// 7. Handle different response formats (JSON, XML, CSV)
// 8. Implement request signing with custom headers

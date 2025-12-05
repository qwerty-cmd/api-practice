require("dotenv").config({ quiet: true });
const axios = require("axios");

// Disable SSL verification for corporate networks (development only)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
process.removeAllListeners("warning");

// Using JSONPlaceholder - a free fake REST API for testing
const BASE_URL = "https://jsonplaceholder.typicode.com";

// ===========================================
// CREATE - POST Request
// ===========================================
const createStock = async (stockData) => {
  try {
    console.log("\n📝 Creating new stock entry...");

    const response = await axios.post(`${BASE_URL}/posts`, stockData, {
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
      },
    });

    console.log("✅ Stock created successfully!");
    console.log("Response:", response.data);
    console.log("Status:", response.status);

    return response.data;
  } catch (error) {
    console.error("❌ Error creating stock:", error.message);
    throw error;
  }
};

// ===========================================
// READ - GET Request (Single)
// ===========================================
const readStock = async (id) => {
  try {
    console.log(`\n📖 Reading stock with ID: ${id}...`);

    const response = await axios.get(`${BASE_URL}/posts/${id}`, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("✅ Stock retrieved successfully!");
    console.log("Response:", response.data);

    return response.data;
  } catch (error) {
    console.error("❌ Error reading stock:", error.message);
    throw error;
  }
};

// ===========================================
// READ - GET Request (All)
// ===========================================
const readAllStocks = async (limit = 5) => {
  try {
    console.log(`\n📚 Reading all stocks (limit: ${limit})...`);

    const response = await axios.get(`${BASE_URL}/posts`, {
      params: {
        _limit: limit,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log(`✅ Retrieved ${response.data.length} stocks!`);

    return response.data;
  } catch (error) {
    console.error("❌ Error reading stocks:", error.message);
    throw error;
  }
};

// ===========================================
// UPDATE - PUT Request (Full Update)
// ===========================================
const updateStock = async (id, stockData) => {
  try {
    console.log(`\n🔄 Updating stock with ID: ${id} (full update)...`);

    const response = await axios.put(`${BASE_URL}/posts/${id}`, stockData, {
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
      },
    });

    console.log("✅ Stock updated successfully!");
    console.log("Response:", response.data);

    return response.data;
  } catch (error) {
    console.error("❌ Error updating stock:", error.message);
    throw error;
  }
};

// ===========================================
// UPDATE - PATCH Request (Partial Update)
// ===========================================
const patchStock = async (id, partialData) => {
  try {
    console.log(`\n🔧 Patching stock with ID: ${id} (partial update)...`);

    const response = await axios.patch(`${BASE_URL}/posts/${id}`, partialData, {
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
      },
    });

    console.log("✅ Stock patched successfully!");
    console.log("Response:", response.data);

    return response.data;
  } catch (error) {
    console.error("❌ Error patching stock:", error.message);
    throw error;
  }
};

// ===========================================
// DELETE - DELETE Request
// ===========================================
const deleteStock = async (id) => {
  try {
    console.log(`\n🗑️  Deleting stock with ID: ${id}...`);

    const response = await axios.delete(`${BASE_URL}/posts/${id}`, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("✅ Stock deleted successfully!");
    console.log("Status:", response.status);

    return response.data;
  } catch (error) {
    console.error("❌ Error deleting stock:", error.message);
    throw error;
  }
};

// ===========================================
// CRUD WITH ERROR HANDLING & VALIDATION
// ===========================================
class StockCRUD {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  // Validate stock data
  validateStockData(data) {
    if (!data.symbol || typeof data.symbol !== "string") {
      throw new Error("Stock symbol is required and must be a string");
    }
    if (data.price && (typeof data.price !== "number" || data.price <= 0)) {
      throw new Error("Price must be a positive number");
    }
    return true;
  }

  // CREATE
  async create(stockData) {
    this.validateStockData(stockData);
    const response = await axios.post(`${this.baseUrl}/posts`, stockData);
    return response.data;
  }

  // READ (single)
  async read(id) {
    if (!id || id <= 0) {
      throw new Error("Valid ID is required");
    }
    const response = await axios.get(`${this.baseUrl}/posts/${id}`);
    return response.data;
  }

  // READ (all with pagination)
  async readAll(page = 1, limit = 10) {
    const response = await axios.get(`${this.baseUrl}/posts`, {
      params: {
        _page: page,
        _limit: limit,
      },
    });
    return {
      data: response.data,
      total: response.headers["x-total-count"],
      page,
      limit,
    };
  }

  // UPDATE (full)
  async update(id, stockData) {
    if (!id || id <= 0) {
      throw new Error("Valid ID is required");
    }
    this.validateStockData(stockData);
    const response = await axios.put(`${this.baseUrl}/posts/${id}`, stockData);
    return response.data;
  }

  // PATCH (partial)
  async patch(id, partialData) {
    if (!id || id <= 0) {
      throw new Error("Valid ID is required");
    }
    const response = await axios.patch(
      `${this.baseUrl}/posts/${id}`,
      partialData
    );
    return response.data;
  }

  // DELETE
  async delete(id) {
    if (!id || id <= 0) {
      throw new Error("Valid ID is required");
    }
    const response = await axios.delete(`${this.baseUrl}/posts/${id}`);
    return response.status === 200;
  }
}

// ===========================================
// TESTING EXAMPLES
// ===========================================
(async () => {
  console.log("=".repeat(50));
  console.log("       CRUD OPERATIONS DEMO");
  console.log("=".repeat(50));

  // Example 1: Basic CRUD Operations
  console.log("\n\n### BASIC CRUD OPERATIONS ###");

  // CREATE
  const newStock = await createStock({
    symbol: "AAPL",
    title: "Apple Inc.",
    price: 175.5,
    volume: 1000000,
    exchange: "NASDAQ",
  });

  // READ (single)
  await readStock(1);

  // READ (all)
  const stocks = await readAllStocks(3);
  console.log(`\nFirst stock symbol: ${stocks[0]?.title || "N/A"}`);

  // UPDATE (full)
  await updateStock(1, {
    symbol: "AAPL",
    title: "Apple Inc. - Updated",
    price: 180.0,
    volume: 1200000,
    exchange: "NASDAQ",
  });

  // PATCH (partial)
  await patchStock(1, {
    price: 182.5,
  });

  // DELETE
  await deleteStock(1);

  // Example 2: Using the StockCRUD Class
  console.log("\n\n### USING STOCK CRUD CLASS ###");

  const stockCRUD = new StockCRUD(BASE_URL);

  try {
    // CREATE with validation
    console.log("\n📝 Creating stock with class...");
    const created = await stockCRUD.create({
      symbol: "TSLA",
      title: "Tesla Inc.",
      price: 242.84,
      volume: 950000,
    });
    console.log("✅ Created:", created);

    // READ with pagination
    console.log("\n📚 Reading all stocks (paginated)...");
    const paginated = await stockCRUD.readAll(1, 5);
    console.log(`✅ Retrieved ${paginated.data.length} stocks`);

    // UPDATE
    console.log("\n🔄 Updating stock...");
    const updated = await stockCRUD.update(1, {
      symbol: "TSLA",
      title: "Tesla Inc. - Updated",
      price: 245.0,
    });
    console.log("✅ Updated:", updated);

    // PATCH
    console.log("\n🔧 Patching stock...");
    const patched = await stockCRUD.patch(1, { price: 247.5 });
    console.log("✅ Patched:", patched);

    // DELETE
    console.log("\n🗑️  Deleting stock...");
    const deleted = await stockCRUD.delete(1);
    console.log(`✅ Deleted: ${deleted}`);
  } catch (error) {
    console.error("❌ Error:", error.message);
  }

  console.log("\n" + "=".repeat(50));
  console.log("         DEMO COMPLETED");
  console.log("=".repeat(50));

  console.log("\n\n📝 CRUD Summary:");
  console.log("├─ CREATE (POST)   - Add new resource");
  console.log("├─ READ (GET)      - Retrieve resource(s)");
  console.log("├─ UPDATE (PUT)    - Replace entire resource");
  console.log("├─ PATCH           - Update specific fields");
  console.log("└─ DELETE          - Remove resource");

  console.log("\n💡 Key Differences:");
  console.log("• PUT replaces the entire resource");
  console.log("• PATCH updates only specified fields");
  console.log("• POST creates new resources");
  console.log("• GET retrieves without modification");
  console.log("• DELETE removes resources");
})();

// ===========================================
// PRACTICE EXERCISES:
// ===========================================
// 1. Add bulk create (create multiple stocks at once)
// 2. Add search/filter functionality
// 3. Implement soft delete (mark as deleted instead of removing)
// 4. Add transaction rollback on error
// 5. Implement optimistic locking (version control)

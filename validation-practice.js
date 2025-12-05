const axios = require("axios");

// ===========================================
// VALIDATION HELPERS
// ===========================================

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate stock symbol (1-5 uppercase letters)
const isValidStockSymbol = (symbol) => {
  const symbolRegex = /^[A-Z]{1,5}$/;
  return symbolRegex.test(symbol);
};

// Validate number is positive
const isPositiveNumber = (num) => {
  return typeof num === "number" && num > 0;
};

// Validate required fields exist
const hasRequiredFields = (obj, fields) => {
  return fields.every(
    (field) =>
      obj.hasOwnProperty(field) &&
      obj[field] !== null &&
      obj[field] !== undefined
  );
};

// Validate price range
const isValidPrice = (price, min = 0, max = 100000) => {
  return typeof price === "number" && price >= min && price <= max;
};

// Validate date format (YYYY-MM-DD)
const isValidDate = (dateString) => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;

  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

// ===========================================
// VALIDATION SCHEMAS (like Joi/Zod)
// ===========================================

class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

const stockSchema = {
  symbol: {
    required: true,
    type: "string",
    validate: (value) => {
      if (!isValidStockSymbol(value)) {
        throw new ValidationError(
          "Symbol must be 1-5 uppercase letters",
          "symbol"
        );
      }
    },
  },
  price: {
    required: true,
    type: "number",
    validate: (value) => {
      if (!isValidPrice(value)) {
        throw new ValidationError(
          "Price must be between 0 and 100000",
          "price"
        );
      }
    },
  },
  volume: {
    required: true,
    type: "number",
    validate: (value) => {
      if (!isPositiveNumber(value)) {
        throw new ValidationError("Volume must be a positive number", "volume");
      }
    },
  },
  date: {
    required: false,
    type: "string",
    validate: (value) => {
      if (value && !isValidDate(value)) {
        throw new ValidationError("Date must be in YYYY-MM-DD format", "date");
      }
    },
  },
};

const userSchema = {
  email: {
    required: true,
    type: "string",
    validate: (value) => {
      if (!isValidEmail(value)) {
        throw new ValidationError("Invalid email format", "email");
      }
    },
  },
  age: {
    required: false,
    type: "number",
    validate: (value) => {
      if (value !== undefined && (value < 0 || value > 150)) {
        throw new ValidationError("Age must be between 0 and 150", "age");
      }
    },
  },
  username: {
    required: true,
    type: "string",
    validate: (value) => {
      if (value.length < 3 || value.length > 20) {
        throw new ValidationError(
          "Username must be 3-20 characters",
          "username"
        );
      }
    },
  },
};

// Generic validator
const validate = (data, schema) => {
  const errors = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];

    // Check required
    if (rules.required && (value === undefined || value === null)) {
      errors.push({
        field,
        message: `${field} is required`,
      });
      continue;
    }

    // Skip validation if field is optional and not provided
    if (!rules.required && (value === undefined || value === null)) {
      continue;
    }

    // Check type
    if (rules.type && typeof value !== rules.type) {
      errors.push({
        field,
        message: `${field} must be of type ${rules.type}`,
      });
      continue;
    }

    // Run custom validation
    if (rules.validate) {
      try {
        rules.validate(value);
      } catch (error) {
        errors.push({
          field: error.field || field,
          message: error.message,
        });
      }
    }
  }

  if (errors.length > 0) {
    const error = new Error("Validation failed");
    error.errors = errors;
    throw error;
  }

  return true;
};

// ===========================================
// API CLIENT WITH VALIDATION
// ===========================================

const BASE_URL = "http://localhost:4000/api";

// Create stock with validation
const createStock = async (stockData) => {
  try {
    // VALIDATE BEFORE SENDING
    console.log("Validating stock data...");
    validate(stockData, stockSchema);
    console.log("✓ Validation passed");

    const response = await axios.post(`${BASE_URL}/stocks`, stockData);
    console.log("Stock created:", response.data);
    return response.data;
  } catch (error) {
    if (error.errors) {
      console.error("Validation errors:");
      error.errors.forEach((err) => {
        console.error(`  - ${err.field}: ${err.message}`);
      });
    } else {
      console.error("API Error:", error.message);
    }
    throw error;
  }
};

// Update stock with validation
const updateStock = async (id, updates) => {
  try {
    // Create a schema for partial updates (all fields optional)
    const partialSchema = {};
    for (const [field, rules] of Object.entries(stockSchema)) {
      partialSchema[field] = { ...rules, required: false };
    }

    console.log("Validating update data...");
    validate(updates, partialSchema);
    console.log("✓ Validation passed");

    const response = await axios.patch(`${BASE_URL}/stocks/${id}`, updates);
    console.log("Stock updated:", response.data);
    return response.data;
  } catch (error) {
    if (error.errors) {
      console.error("Validation errors:");
      error.errors.forEach((err) => {
        console.error(`  - ${err.field}: ${err.message}`);
      });
    } else {
      console.error("API Error:", error.message);
    }
    throw error;
  }
};

// Create user with validation
const createUser = async (userData) => {
  try {
    console.log("Validating user data...");
    validate(userData, userSchema);
    console.log("✓ Validation passed");

    // Simulate API call
    console.log("User data valid:", userData);
    return userData;
  } catch (error) {
    if (error.errors) {
      console.error("Validation errors:");
      error.errors.forEach((err) => {
        console.error(`  - ${err.field}: ${err.message}`);
      });
    }
    throw error;
  }
};

// ===========================================
// SANITIZATION (Clean input data)
// ===========================================

const sanitizeString = (str) => {
  if (typeof str !== "string") return str;

  // Remove leading/trailing whitespace
  str = str.trim();

  // Remove potentially dangerous characters
  str = str.replace(/[<>]/g, "");

  return str;
};

const sanitizeNumber = (num) => {
  const parsed = parseFloat(num);
  return isNaN(parsed) ? 0 : parsed;
};

const sanitizeStockData = (data) => {
  return {
    symbol: sanitizeString(data.symbol).toUpperCase(),
    price: sanitizeNumber(data.price),
    volume: sanitizeNumber(data.volume),
    date: data.date ? sanitizeString(data.date) : undefined,
  };
};

// ===========================================
// TESTING EXAMPLES
// ===========================================

(async () => {
  console.log("=== VALIDATION PRACTICE ===\n");

  // Example 1: Valid data
  console.log("1. Valid stock data:");
  try {
    await createStock({
      symbol: "AAPL",
      price: 150.25,
      volume: 1000000,
      date: "2024-01-15",
    });
  } catch (error) {
    // Will succeed
  }

  // Example 2: Invalid symbol
  console.log("\n2. Invalid symbol (lowercase):");
  try {
    await createStock({
      symbol: "aapl", // ❌ Must be uppercase
      price: 150.25,
      volume: 1000000,
    });
  } catch (error) {
    // Will fail validation
  }

  // Example 3: Missing required field
  console.log("\n3. Missing required field:");
  try {
    await createStock({
      symbol: "AAPL",
      // Missing price ❌
      volume: 1000000,
    });
  } catch (error) {
    // Will fail validation
  }

  // Example 4: Invalid price range
  console.log("\n4. Invalid price (negative):");
  try {
    await createStock({
      symbol: "AAPL",
      price: -50, // ❌ Must be positive
      volume: 1000000,
    });
  } catch (error) {
    // Will fail validation
  }

  // Example 5: Invalid type
  console.log("\n5. Invalid type (price as string):");
  try {
    await createStock({
      symbol: "AAPL",
      price: "150.25", // ❌ Must be number
      volume: 1000000,
    });
  } catch (error) {
    // Will fail validation
  }

  // Example 6: User validation
  console.log("\n6. Valid user:");
  try {
    await createUser({
      email: "user@example.com",
      username: "john_doe",
      age: 25,
    });
  } catch (error) {
    // Will succeed
  }

  // Example 7: Invalid email
  console.log("\n7. Invalid email:");
  try {
    await createUser({
      email: "invalid-email", // ❌ Invalid format
      username: "john_doe",
    });
  } catch (error) {
    // Will fail validation
  }

  // Example 8: Sanitization
  console.log("\n8. Sanitization example:");
  const dirtyData = {
    symbol: "  aapl  ", // Extra whitespace, lowercase
    price: "150.25", // String instead of number
    volume: "1000000",
  };
  console.log("Before sanitization:", dirtyData);
  const cleanData = sanitizeStockData(dirtyData);
  console.log("After sanitization:", cleanData);

  try {
    await createStock(cleanData);
    console.log("✓ Clean data passed validation");
  } catch (error) {
    // Should succeed now
  }

  // Example 9: Partial update validation
  console.log("\n9. Partial update (only price):");
  try {
    await updateStock(1, { price: 155.5 });
  } catch (error) {
    // Will succeed
  }

  // Example 10: Multiple validation errors
  console.log("\n10. Multiple validation errors:");
  try {
    await createStock({
      symbol: "toolong", // ❌ Too long
      price: -100, // ❌ Negative
      volume: "not a number", // ❌ Wrong type
    });
  } catch (error) {
    // Will show multiple errors
  }

  console.log("\n=== DONE ===");
})();

// ===========================================
// EXERCISES:
// ===========================================
// 1. Add validation for URL format
// 2. Add validation for phone numbers
// 3. Create a password strength validator
// 4. Add custom error messages
// 5. Create a validation chain (multiple validators)
// 6. Add async validation (check if username exists)
// 7. Create a sanitization pipeline
// 8. Add validation for array inputs

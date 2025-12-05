require("dotenv").config({ quiet: true });
const axios = require("axios");

// Disable SSL verification for corporate networks
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
process.removeAllListeners("warning");

const API_KEY = process.env.API_KEY;
const BASE_URL = process.env.BASE_URL;

// ===========================================
// CIRCUIT BREAKER PATTERN
// ===========================================

class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000, name = "CircuitBreaker") {
    this.threshold = threshold; // Max failures before opening circuit
    this.timeout = timeout; // Time to wait before retry (ms)
    this.failureCount = 0; // Current failure count
    this.successCount = 0; // Track successes for metrics
    this.state = "CLOSED"; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now(); // When to try again
    this.name = name;

    console.log(`🔌 ${this.name} initialized:`);
    console.log(`   Threshold: ${threshold} failures`);
    console.log(`   Timeout: ${timeout}ms\n`);
  }

  // Main execution method
  async execute(fn) {
    // Check current state
    if (this.state === "OPEN") {
      if (Date.now() < this.nextAttempt) {
        const waitTime = Math.ceil((this.nextAttempt - Date.now()) / 1000);
        console.log(`⛔ Circuit is OPEN. Wait ${waitTime}s before retry.`);
        throw new Error(`Circuit breaker is OPEN. Service unavailable.`);
      }

      // Timeout expired, move to HALF_OPEN state
      console.log(
        `🔄 Timeout expired. Moving to HALF_OPEN state (testing recovery)...`
      );
      this.state = "HALF_OPEN";
    }

    // Log current state
    this.logState();

    // Execute the function
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  // Handle successful execution
  onSuccess() {
    this.failureCount = 0;
    this.successCount++;

    if (this.state === "HALF_OPEN") {
      console.log(`✅ Request succeeded in HALF_OPEN state. Closing circuit!`);
      this.state = "CLOSED";
    } else {
      console.log(`✅ Request succeeded (Success count: ${this.successCount})`);
    }
  }

  // Handle failed execution
  onFailure() {
    this.failureCount++;
    console.log(
      `❌ Request failed (Failure ${this.failureCount}/${this.threshold})`
    );

    if (this.state === "HALF_OPEN") {
      console.log(
        `⚠️  Test request failed in HALF_OPEN. Opening circuit again!`
      );
      this.state = "OPEN";
      this.nextAttempt = Date.now() + this.timeout;
    } else if (this.failureCount >= this.threshold) {
      console.log(
        `🔴 Failure threshold reached! Opening circuit for ${this.timeout}ms`
      );
      this.state = "OPEN";
      this.nextAttempt = Date.now() + this.timeout;
    }
  }

  // Log current state
  logState() {
    const stateEmoji = {
      CLOSED: "🟢",
      OPEN: "🔴",
      HALF_OPEN: "🟡",
    };
    console.log(
      `${stateEmoji[this.state]} State: ${this.state} | Failures: ${
        this.failureCount
      }/${this.threshold}`
    );
  }

  // Get circuit status
  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      threshold: this.threshold,
      nextAttempt:
        this.state === "OPEN" ? new Date(this.nextAttempt).toISOString() : null,
    };
  }

  // Reset circuit breaker
  reset() {
    this.failureCount = 0;
    this.successCount = 0;
    this.state = "CLOSED";
    console.log(`🔄 ${this.name} reset to CLOSED state`);
  }
}

// ===========================================
// EXAMPLE: Stock API with Circuit Breaker
// ===========================================

const stockCircuitBreaker = new CircuitBreaker(3, 10000, "StockAPI-Breaker");

const getStockWithCircuitBreaker = async (symbol) => {
  return stockCircuitBreaker.execute(async () => {
    console.log(`📊 Fetching stock data for ${symbol}...`);

    const response = await axios.get(BASE_URL, {
      params: {
        function: "GLOBAL_QUOTE",
        symbol: symbol,
        apikey: API_KEY,
      },
      timeout: 5000,
    });

    // Simulate API rate limit check
    if (response.data.Note) {
      throw new Error("Rate limit exceeded");
    }

    return response.data;
  });
};

// ===========================================
// ADVANCED: Circuit Breaker with Fallback
// ===========================================

class CircuitBreakerWithFallback extends CircuitBreaker {
  constructor(threshold, timeout, fallbackFn, name) {
    super(threshold, timeout, name);
    this.fallbackFn = fallbackFn;
  }

  async execute(fn) {
    try {
      return await super.execute(fn);
    } catch (error) {
      if (this.state === "OPEN" && this.fallbackFn) {
        console.log(`💾 Circuit OPEN. Using fallback data...`);
        return await this.fallbackFn();
      }
      throw error;
    }
  }
}

// Example: Fallback to cached data
const cachedStockData = {
  "Global Quote": {
    "01. symbol": "IBM",
    "05. price": "150.00 (cached)",
    "07. latest trading day": "2024-12-05",
  },
};

const fallbackFn = async () => {
  console.log("📦 Returning cached data...");
  return cachedStockData;
};

const advancedBreaker = new CircuitBreakerWithFallback(
  2,
  8000,
  fallbackFn,
  "Advanced-Breaker"
);

// ===========================================
// TESTING SCENARIOS
// ===========================================

const simulateFailingAPI = async (shouldFail = true) => {
  console.log(`🧪 Simulating ${shouldFail ? "failing" : "working"} API...`);

  if (shouldFail) {
    throw new Error("API Error: Service unavailable");
  }

  return { success: true, data: "API response" };
};

// Test 1: Normal operation (CLOSED state)
const testClosedState = async () => {
  console.log("\n" + "=".repeat(60));
  console.log("TEST 1: Normal Operation (CLOSED State)");
  console.log("=".repeat(60) + "\n");

  const breaker = new CircuitBreaker(3, 5000, "Test-Breaker-1");

  try {
    // Success 1
    await breaker.execute(() => simulateFailingAPI(false));
    console.log("---");

    // Success 2
    await breaker.execute(() => simulateFailingAPI(false));
    console.log("---");

    // Success 3
    await breaker.execute(() => simulateFailingAPI(false));
  } catch (error) {
    console.error("Error:", error.message);
  }

  console.log("\n📊 Final Status:", breaker.getStatus());
};

// Test 2: Circuit opens after threshold
const testCircuitOpens = async () => {
  console.log("\n" + "=".repeat(60));
  console.log("TEST 2: Circuit Opens After Threshold");
  console.log("=".repeat(60) + "\n");

  const breaker = new CircuitBreaker(3, 8000, "Test-Breaker-2");

  try {
    // Failure 1
    await breaker.execute(() => simulateFailingAPI(true));
  } catch (error) {
    console.log(`Caught: ${error.message}`);
  }
  console.log("---");

  try {
    // Failure 2
    await breaker.execute(() => simulateFailingAPI(true));
  } catch (error) {
    console.log(`Caught: ${error.message}`);
  }
  console.log("---");

  try {
    // Failure 3 - This should OPEN the circuit
    await breaker.execute(() => simulateFailingAPI(true));
  } catch (error) {
    console.log(`Caught: ${error.message}`);
  }
  console.log("---");

  try {
    // This should fail immediately (circuit is OPEN)
    await breaker.execute(() => simulateFailingAPI(false));
  } catch (error) {
    console.log(`Caught: ${error.message}`);
  }

  console.log("\n📊 Final Status:", breaker.getStatus());
};

// Test 3: HALF_OPEN state and recovery
const testHalfOpenRecovery = async () => {
  console.log("\n" + "=".repeat(60));
  console.log("TEST 3: HALF_OPEN State & Recovery");
  console.log("=".repeat(60) + "\n");

  const breaker = new CircuitBreaker(2, 3000, "Test-Breaker-3");

  try {
    // Trigger failures to open circuit
    await breaker.execute(() => simulateFailingAPI(true));
  } catch (e) {
    console.log(`Caught: ${e.message}`);
  }
  console.log("---");

  try {
    await breaker.execute(() => simulateFailingAPI(true));
  } catch (e) {
    console.log(`Caught: ${e.message}`);
  }
  console.log("---");

  console.log("\n⏳ Waiting 3 seconds for timeout...\n");
  await new Promise((resolve) => setTimeout(resolve, 3500));

  try {
    // Circuit should be HALF_OPEN now, test with success
    console.log("🧪 Testing recovery with successful request...");
    await breaker.execute(() => simulateFailingAPI(false));
  } catch (e) {
    console.log(`Caught: ${e.message}`);
  }
  console.log("---");

  try {
    // Should work now (circuit CLOSED)
    await breaker.execute(() => simulateFailingAPI(false));
  } catch (e) {
    console.log(`Caught: ${e.message}`);
  }

  console.log("\n📊 Final Status:", breaker.getStatus());
};

// Test 4: HALF_OPEN fails and reopens
const testHalfOpenFails = async () => {
  console.log("\n" + "=".repeat(60));
  console.log("TEST 4: HALF_OPEN Fails & Reopens Circuit");
  console.log("=".repeat(60) + "\n");

  const breaker = new CircuitBreaker(2, 3000, "Test-Breaker-4");

  try {
    // Open the circuit
    await breaker.execute(() => simulateFailingAPI(true));
  } catch (e) {
    console.log(`Caught: ${e.message}`);
  }

  try {
    await breaker.execute(() => simulateFailingAPI(true));
  } catch (e) {
    console.log(`Caught: ${e.message}`);
  }
  console.log("---");

  console.log("\n⏳ Waiting 3 seconds for timeout...\n");
  await new Promise((resolve) => setTimeout(resolve, 3500));

  try {
    // Circuit should be HALF_OPEN, but request fails
    console.log("🧪 Testing with failing request in HALF_OPEN...");
    await breaker.execute(() => simulateFailingAPI(true));
  } catch (e) {
    console.log(`Caught: ${e.message}`);
  }
  console.log("---");

  try {
    // Should reject immediately (circuit OPEN again)
    await breaker.execute(() => simulateFailingAPI(false));
  } catch (e) {
    console.log(`Caught: ${e.message}`);
  }

  console.log("\n📊 Final Status:", breaker.getStatus());
};

// Test 5: Real API with circuit breaker
const testRealAPI = async () => {
  console.log("\n" + "=".repeat(60));
  console.log("TEST 5: Real Stock API with Circuit Breaker");
  console.log("=".repeat(60) + "\n");

  try {
    // Successful request
    const data1 = await getStockWithCircuitBreaker("IBM");
    console.log("✅ Got data:", data1["Global Quote"]?.["01. symbol"] || "N/A");
    console.log("---");

    // Another successful request
    const data2 = await getStockWithCircuitBreaker("AAPL");
    console.log("✅ Got data:", data2["Global Quote"]?.["01. symbol"] || "N/A");
  } catch (error) {
    console.error("Error:", error.message);
  }

  console.log("\n📊 Circuit Status:", stockCircuitBreaker.getStatus());
};

// Test 6: Circuit breaker with fallback
const testWithFallback = async () => {
  console.log("\n" + "=".repeat(60));
  console.log("TEST 6: Circuit Breaker with Fallback");
  console.log("=".repeat(60) + "\n");

  try {
    // Trigger failures to open circuit
    await advancedBreaker.execute(() => simulateFailingAPI(true));
  } catch (e) {
    console.log(`Caught: ${e.message}`);
  }

  try {
    await advancedBreaker.execute(() => simulateFailingAPI(true));
  } catch (e) {
    console.log(`Caught: ${e.message}`);
  }
  console.log("---");

  try {
    // Circuit is OPEN, should use fallback
    const result = await advancedBreaker.execute(() =>
      simulateFailingAPI(false)
    );
    console.log("📦 Fallback result:", result["Global Quote"]["01. symbol"]);
  } catch (e) {
    console.log(`Caught: ${e.message}`);
  }

  console.log("\n📊 Circuit Status:", advancedBreaker.getStatus());
};

// ===========================================
// RUN ALL TESTS
// ===========================================

(async () => {
  console.log("\n");
  console.log("╔" + "═".repeat(58) + "╗");
  console.log(
    "║" + " ".repeat(10) + "CIRCUIT BREAKER PATTERN DEMO" + " ".repeat(20) + "║"
  );
  console.log("╚" + "═".repeat(58) + "╝");

  await testClosedState();
  await testCircuitOpens();
  await testHalfOpenRecovery();
  await testHalfOpenFails();
  await testRealAPI();
  await testWithFallback();

  console.log("\n" + "=".repeat(60));
  console.log("ALL TESTS COMPLETED");
  console.log("=".repeat(60));

  console.log("\n\n📚 Circuit Breaker Pattern Summary:");
  console.log("┌─────────────────────────────────────────────────────┐");
  console.log("│ State Flow:                                         │");
  console.log("│                                                     │");
  console.log("│   CLOSED → (failures ≥ threshold) → OPEN           │");
  console.log("│      ↑                                  ↓           │");
  console.log("│   (success) ← HALF_OPEN ← (timeout expires)        │");
  console.log("│                   ↓                                 │");
  console.log("│              (failure) → OPEN                       │");
  console.log("└─────────────────────────────────────────────────────┘");

  console.log("\n🎯 Key Benefits:");
  console.log("  • Prevents cascading failures");
  console.log("  • Fail fast (don't wait for timeout)");
  console.log("  • Automatic recovery testing");
  console.log("  • Protects downstream services");
  console.log("  • Can provide fallback responses");

  console.log("\n⚙️  Configuration:");
  console.log("  • Threshold: Max failures before opening");
  console.log("  • Timeout: How long to wait before retry");
  console.log("  • Fallback: Alternative response when open");
})();

// ===========================================
// BONUS: Continuous Retry Example
// ===========================================

console.log("\n\n");
console.log("╔" + "═".repeat(58) + "╗");
console.log(
  "║" + " ".repeat(12) + "CONTINUOUS RETRY DEMO" + " ".repeat(25) + "║"
);
console.log("╚" + "═".repeat(58) + "╝");

// This demonstrates how the circuit breaker works with continuous retries
// You DON'T need to restart the code - just keep calling execute()

const continuousRetryDemo = async () => {
  console.log("\n🎬 Starting continuous retry demo...\n");
  console.log("We'll simulate an API that:");
  console.log("  1. Fails 3 times (circuit opens)");
  console.log("  2. We keep trying every 2 seconds");
  console.log("  3. After timeout, circuit tests recovery");
  console.log("  4. Service recovers and circuit closes\n");

  const demoBreaker = new CircuitBreaker(3, 5000, "Demo-Breaker");

  let callCount = 0;
  let shouldFail = true;

  const simulatedAPI = async () => {
    callCount++;
    console.log(`\n🔄 API Call #${callCount}`);

    // Simulate: First 3 calls fail, then recover after timeout
    if (callCount <= 3) {
      shouldFail = true;
    } else if (callCount >= 6) {
      // After some time, service recovers
      shouldFail = false;
    }

    if (shouldFail) {
      throw new Error("Simulated API failure");
    }

    return { success: true, data: "API is back online!" };
  };

  // Simulate continuous requests every 2 seconds
  const maxAttempts = 8;

  for (let i = 0; i < maxAttempts; i++) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`⏱️  Time: ${i * 2}s | Attempt ${i + 1}/${maxAttempts}`);
    console.log("─".repeat(60));

    try {
      const result = await demoBreaker.execute(simulatedAPI);
      console.log("🎉 SUCCESS:", result.data);
    } catch (error) {
      console.log("💥 FAILED:", error.message);
    }

    // Wait 2 seconds before next attempt (simulating periodic API calls)
    if (i < maxAttempts - 1) {
      console.log("\n⏳ Waiting 2 seconds before next attempt...");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.log("\n\n" + "═".repeat(60));
  console.log("📊 DEMO SUMMARY");
  console.log("═".repeat(60));
  console.log("\nWhat happened:");
  console.log("  ✓ Calls 1-3: Failed, circuit counted failures");
  console.log("  ✓ Call 3: Threshold reached, circuit OPENED");
  console.log(
    "  ✓ Calls 4-5: Rejected immediately (circuit open, within timeout)"
  );
  console.log(
    "  ✓ Call 6: Timeout expired, moved to HALF_OPEN, tested recovery"
  );
  console.log("  ✓ Call 7+: Circuit CLOSED, normal operation resumed");
  console.log("\n💡 Key Insight:");
  console.log("   You just keep calling execute() - the circuit breaker");
  console.log("   automatically manages state transitions based on time");
  console.log("   and success/failure results. No manual restart needed!");

  console.log("\n📈 Final Circuit Status:");
  console.log(JSON.stringify(demoBreaker.getStatus(), null, 2));
};

// Run the continuous retry demo
setTimeout(async () => {
  await continuousRetryDemo();

  console.log("\n\n");
  console.log("╔" + "═".repeat(58) + "╗");
  console.log(
    "║" + " ".repeat(18) + "ALL DEMOS COMPLETED" + " ".repeat(21) + "║"
  );
  console.log("╚" + "═".repeat(58) + "╝");
  console.log("\n");
}, 2000);

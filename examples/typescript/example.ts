/**
 * TypeScript Example for lea-lang
 *
 * This example demonstrates how to use the Lea language
 * programmatically from TypeScript/JavaScript.
 *
 * Run with: npx ts-node examples/typescript/example.ts
 */

// When using as an npm package, import from 'lea-lang':
// import { lea, leaAsync, createLea, RuntimeError } from 'lea-lang';

// For local development, import from the source:
import { lea, leaAsync, createLea, RuntimeError } from "../../src/api";

// ============================================================================
// 1. Basic Usage with Tagged Template Literal
// ============================================================================

console.log("=== 1. Basic Lea Expression ===");

// Simple arithmetic
const sum = lea`1 + 2 + 3`;
console.log("Sum:", sum); // 6

// Pipeline operations
const doubled = lea`[1, 2, 3] /> map((x) -> x * 2)`;
console.log("Doubled:", doubled); // [2, 4, 6]

// ============================================================================
// 2. JavaScript Value Interpolation
// ============================================================================

console.log("\n=== 2. JS Value Interpolation ===");

// Pass JavaScript arrays into Lea
const numbers = [1, 2, 3, 4, 5];
const filtered = lea`${numbers} /> filter((x) -> x > 2)`;
console.log("Filtered:", filtered); // [3, 4, 5]

// Pass multiple values
const threshold = 3;
const multiplier = 10;
const result = lea`
  ${numbers}
    /> filter((x) -> x > ${threshold})
    /> map((x) -> x * ${multiplier})
`;
console.log("Processed:", result); // [40, 50]

// Pass JavaScript objects (become Lea records)
const user = { name: "Alice", age: 30 };
const greeting = lea`"Hello, " ++ ${user}.name`;
console.log("Greeting:", greeting); // "Hello, Alice"

// ============================================================================
// 3. Passing JavaScript Functions
// ============================================================================

console.log("\n=== 3. JS Functions in Lea ===");

// Simple function
const double = (x: number) => x * 2;
const mapped = lea`[1, 2, 3] /> map(${double})`;
console.log("With JS double:", mapped); // [2, 4, 6]

// Function with multiple args
const add = (a: number, b: number) => a + b;
const summed = lea`${numbers} /> reduce(0, ${add})`;
console.log("Sum with JS reduce:", summed); // 15

// Combining JS and Lea functions
const isEven = (x: number) => x % 2 === 0;
const evenDoubled = lea`
  ${numbers}
    /> filter(${isEven})
    /> map((x) -> x * 2)
`;
console.log("Even numbers doubled:", evenDoubled); // [4, 8]

// ============================================================================
// 4. Using createLea for Reusable Contexts
// ============================================================================

console.log("\n=== 4. Reusable Context ===");

// Create a context with pre-defined bindings
const ctx = createLea({
  data: [10, 20, 30, 40, 50],
  threshold: 25,
  transform: (x: number) => x / 10,
});

// Run multiple operations with the same context
const above = ctx.run(`data /> filter((x) -> x > threshold)`);
console.log("Above threshold:", above); // [30, 40, 50]

const transformed = ctx.run(`data /> map(transform)`);
console.log("Transformed:", transformed); // [1, 2, 3, 4, 5]

// Update bindings dynamically
ctx.set("threshold", 35);
const newAbove = ctx.run(`data /> filter((x) -> x > threshold)`);
console.log("New above threshold:", newAbove); // [40, 50]

// Check current bindings
console.log("Current bindings:", ctx.bindings);

// ============================================================================
// 5. Complex Pipeline Example
// ============================================================================

console.log("\n=== 5. Complex Pipeline ===");

interface Product {
  name: string;
  price: number;
  category: string;
}

const products: Product[] = [
  { name: "Apple", price: 1.5, category: "fruit" },
  { name: "Banana", price: 0.75, category: "fruit" },
  { name: "Carrot", price: 0.5, category: "vegetable" },
  { name: "Broccoli", price: 2.0, category: "vegetable" },
  { name: "Orange", price: 1.25, category: "fruit" },
];

const expensiveFruits = lea`
  ${products}
    /> filter((p) -> p.category == "fruit")
    /> filter((p) -> p.price > 1)
    /> map((p) -> p.name)
`;
console.log("Expensive fruits:", expensiveFruits); // ["Apple", "Orange"]

// ============================================================================
// 6. Async Operations
// ============================================================================

console.log("\n=== 6. Async Operations ===");

async function asyncExample() {
  // Use leaAsync for code with await
  const delayed = await leaAsync`
    await delay(100)
    "Async complete!" /> print
  `;

  // Async with JS values
  const asyncResult = await leaAsync`
    let nums = ${[1, 2, 3]}
    await delay(50)
    nums /> map((x) -> x * 2)
  `;
  console.log("Async result:", asyncResult); // [2, 4, 6]

  // Using createLea with async
  const asyncCtx = createLea({ items: [1, 2, 3] });
  const asyncCtxResult = await asyncCtx.runAsync(`
    await delay(50)
    items /> map((x) -> x + 1)
  `);
  console.log("Async context result:", asyncCtxResult); // [2, 3, 4]
}

// ============================================================================
// 7. Error Handling
// ============================================================================

console.log("\n=== 7. Error Handling ===");

function errorHandlingExample() {
  // Catch runtime errors
  try {
    lea`undefinedVariable /> print`;
  } catch (error) {
    if (error instanceof RuntimeError) {
      console.log("Caught RuntimeError:", error.message);
    }
  }

  // Catch syntax errors during parsing
  try {
    lea`let x = `;
  } catch (error) {
    console.log("Caught parse error:", (error as Error).message);
  }

  // Safe wrapper function
  function safeLea<T>(code: string, fallback: T): T {
    try {
      return lea([code] as unknown as TemplateStringsArray) as T;
    } catch {
      return fallback;
    }
  }

  const safe = safeLea("1 + 2", 0);
  console.log("Safe result:", safe); // 3
}

errorHandlingExample();

// ============================================================================
// 8. Building a Data Processing Pipeline
// ============================================================================

console.log("\n=== 8. Data Processing Pipeline ===");

// Simulate a real-world data processing scenario
interface LogEntry {
  timestamp: number;
  level: string;
  message: string;
}

const logs: LogEntry[] = [
  { timestamp: 1000, level: "info", message: "Server started" },
  { timestamp: 1001, level: "error", message: "Connection failed" },
  { timestamp: 1002, level: "info", message: "Retry successful" },
  { timestamp: 1003, level: "error", message: "Timeout occurred" },
  { timestamp: 1004, level: "warn", message: "High memory usage" },
];

const errorMessages = lea`
  ${logs}
    /> filter((log) -> log.level == "error")
    /> map((log) -> log.message)
`;
console.log("Error messages:", errorMessages);
// ["Connection failed", "Timeout occurred"]

// Count by level using reduce
const isError = (log: LogEntry) => log.level === "error";
const errorCount = lea`${logs} /> filter(${isError}) /> length`;
console.log("Error count:", errorCount); // 2

// ============================================================================
// Run async examples
// ============================================================================

asyncExample().then(() => {
  console.log("\n=== All examples complete ===");
});

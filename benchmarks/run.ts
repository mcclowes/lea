/**
 * Lea Performance Benchmarks
 *
 * Tests key performance paths in the interpreter:
 * - Type checking (getKind)
 * - Environment operations
 * - Builtin functions (map, filter, reduce)
 * - Pipeline evaluation
 * - Function calls
 */

import { Lexer } from "../src/lexer";
import { Parser } from "../src/parser";
import { Interpreter } from "../src/interpreter";

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalMs: number;
  avgMs: number;
  opsPerSec: number;
}

function benchmark(name: string, fn: () => void, iterations: number = 1000): BenchmarkResult {
  // Warmup
  for (let i = 0; i < 10; i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const totalMs = performance.now() - start;
  const avgMs = totalMs / iterations;
  const opsPerSec = 1000 / avgMs;

  return { name, iterations, totalMs, avgMs, opsPerSec };
}

function runLea(code: string): void {
  const lexer = new Lexer(code);
  const tokens = lexer.scanTokens();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const interpreter = new Interpreter();
  interpreter.interpret(ast);
}

function formatResult(result: BenchmarkResult): string {
  return `${result.name.padEnd(40)} ${result.avgMs.toFixed(4).padStart(10)} ms/op  ${Math.round(result.opsPerSec).toLocaleString().padStart(10)} ops/sec`;
}

console.log("Lea Performance Benchmarks");
console.log("=".repeat(70));
console.log("");

const results: BenchmarkResult[] = [];

// Benchmark 1: Simple arithmetic
results.push(benchmark("Simple arithmetic", () => {
  runLea("1 + 2 * 3");
}, 5000));

// Benchmark 2: Variable binding
results.push(benchmark("Variable binding", () => {
  runLea(`
    let x = 1
    let y = 2
    let z = x + y
    z
  `);
}, 5000));

// Benchmark 3: Function definition and call
results.push(benchmark("Function call", () => {
  runLea(`
    let add = (a, b) -> a + b
    add(1, 2)
  `);
}, 5000));

// Benchmark 4: Pipeline evaluation
results.push(benchmark("Pipeline (5 stages)", () => {
  runLea(`
    let add1 = (x) -> x + 1
    let mul2 = (x) -> x * 2
    let add3 = (x) -> x + 3
    let mul4 = (x) -> x * 4
    let add5 = (x) -> x + 5
    1 /> add1 /> mul2 /> add3 /> mul4 /> add5
  `);
}, 5000));

// Benchmark 5: List creation
results.push(benchmark("List creation (100 items)", () => {
  runLea("range(100)");
}, 2000));

// Benchmark 6: Map operation
results.push(benchmark("Map (100 items)", () => {
  runLea("range(100) /> map((x) -> x * 2)");
}, 2000));

// Benchmark 7: Filter operation
results.push(benchmark("Filter (100 items)", () => {
  runLea("range(100) /> filter((x) -> x % 2 == 0)");
}, 2000));

// Benchmark 8: Reduce operation
results.push(benchmark("Reduce (100 items)", () => {
  runLea("range(100) /> reduce(0, (acc, x) -> acc + x)");
}, 2000));

// Benchmark 9: Chained operations
results.push(benchmark("Chained map/filter/reduce", () => {
  runLea(`
    range(100)
      /> map((x) -> x * 2)
      /> filter((x) -> x % 4 == 0)
      /> reduce(0, (acc, x) -> acc + x)
  `);
}, 1000));

// Benchmark 10: Nested function calls
results.push(benchmark("Nested function calls", () => {
  runLea(`
    let f = (x) -> x + 1
    let g = (x) -> f(f(f(x)))
    g(1)
  `);
}, 5000));

// Benchmark 11: Record creation and access
results.push(benchmark("Record operations", () => {
  runLea(`
    let r = { a: 1, b: 2, c: 3 }
    r.a + r.b + r.c
  `);
}, 5000));

// Benchmark 12: String operations
results.push(benchmark("String concatenation", () => {
  runLea(`
    "hello" ++ " " ++ "world"
  `);
}, 5000));

// Benchmark 13: Conditional evaluation
results.push(benchmark("Ternary conditions", () => {
  runLea(`
    let x = 5
    x > 3 ? x * 2 : x / 2
  `);
}, 5000));

// Benchmark 14: Large list map
results.push(benchmark("Map (1000 items)", () => {
  runLea("range(1000) /> map((x) -> x * 2)");
}, 500));

// Benchmark 15: Complex pipeline
results.push(benchmark("Complex pipeline (1000 items)", () => {
  runLea(`
    range(1000)
      /> map((x) -> x * 2)
      /> filter((x) -> x % 3 == 0)
      /> map((x) -> x + 1)
      /> reduce(0, (acc, x) -> acc + x)
  `);
}, 200));

console.log("");
console.log("Results:");
console.log("-".repeat(70));
for (const result of results) {
  console.log(formatResult(result));
}
console.log("-".repeat(70));

// Calculate total time
const totalTime = results.reduce((acc, r) => acc + r.totalMs, 0);
console.log(`\nTotal benchmark time: ${(totalTime / 1000).toFixed(2)}s`);

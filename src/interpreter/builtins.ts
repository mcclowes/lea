/**
 * Built-in functions for the Lea language
 *
 * This module contains all the built-in functions available in Lea.
 */

import * as fs from "fs/promises";
import * as path from "path";
import {
  LeaValue,
  LeaPromise,
  LeaRecord,
  LeaTuple,
  RuntimeError,
} from "./types";
import {
  asNumber,
  asList,
  asFunction,
  isTruthy,
  stringify,
  isLeaPromise,
  isRecord,
  unwrapPromise,
  wrapPromise,
  getKind,
} from "./helpers";

export type BuiltinFn = (args: LeaValue[]) => LeaValue | Promise<LeaValue>;

// Maximum string length for regex operations to mitigate ReDoS attacks
const MAX_REGEX_INPUT_LENGTH = 100_000;

/**
 * Validate regex input to mitigate ReDoS attacks.
 * Throws if the input string is too long.
 */
function validateRegexInput(str: string, operation: string): void {
  if (str.length > MAX_REGEX_INPUT_LENGTH) {
    throw new RuntimeError(
      `${operation}: input string too long (${str.length} chars, max ${MAX_REGEX_INPUT_LENGTH}). ` +
      `This limit exists to prevent regex denial-of-service attacks.`
    );
  }
}

export const builtins: Record<string, BuiltinFn> = {
  // Identity function - returns its argument unchanged (used by Pipeline.identity)
  __identity__: (args) => args[0] ?? null,

  print: (args) => {
    console.log(...args.map(stringify));
    return args[0] ?? null;
  },

  delay: (args) => {
    const ms = asNumber(args[0]);
    const value = args[1] ?? null;
    return {
      kind: "promise",
      promise: new Promise<LeaValue>((resolve) => setTimeout(() => resolve(value), ms)),
    } as LeaPromise;
  },

  sqrt: (args) => Math.sqrt(asNumber(args[0])),
  abs: (args) => Math.abs(asNumber(args[0])),
  floor: (args) => Math.floor(asNumber(args[0])),
  ceil: (args) => Math.ceil(asNumber(args[0])),
  round: (args) => Math.round(asNumber(args[0])),
  min: (args) => Math.min(...args.map(asNumber)),
  max: (args) => Math.max(...args.map(asNumber)),

  // Additional math functions
  pow: (args) => Math.pow(asNumber(args[0]), asNumber(args[1])),
  log: (args) => {
    const val = asNumber(args[0]);
    const base = args[1] !== undefined ? asNumber(args[1]) : Math.E;
    return Math.log(val) / Math.log(base);
  },
  log10: (args) => Math.log10(asNumber(args[0])),
  log2: (args) => Math.log2(asNumber(args[0])),
  exp: (args) => Math.exp(asNumber(args[0])),
  sin: (args) => Math.sin(asNumber(args[0])),
  cos: (args) => Math.cos(asNumber(args[0])),
  tan: (args) => Math.tan(asNumber(args[0])),
  asin: (args) => Math.asin(asNumber(args[0])),
  acos: (args) => Math.acos(asNumber(args[0])),
  atan: (args) => Math.atan(asNumber(args[0])),
  atan2: (args) => Math.atan2(asNumber(args[0]), asNumber(args[1])),
  sinh: (args) => Math.sinh(asNumber(args[0])),
  cosh: (args) => Math.cosh(asNumber(args[0])),
  tanh: (args) => Math.tanh(asNumber(args[0])),
  sign: (args) => Math.sign(asNumber(args[0])),
  trunc: (args) => Math.trunc(asNumber(args[0])),
  clamp: (args) => {
    const val = asNumber(args[0]);
    const min = asNumber(args[1]);
    const max = asNumber(args[2]);
    return Math.min(Math.max(val, min), max);
  },
  lerp: (args) => {
    const a = asNumber(args[0]);
    const b = asNumber(args[1]);
    const t = asNumber(args[2]);
    return a + (b - a) * t;
  },

  // Math constants (as functions for consistency)
  PI: () => Math.PI,
  E: () => Math.E,
  TAU: () => Math.PI * 2,
  INFINITY: () => Infinity,

  // ===== Bitwise Operations =====

  bitAnd: (args) => {
    const a = asNumber(args[0]);
    const b = asNumber(args[1]);
    return a & b;
  },

  bitOr: (args) => {
    const a = asNumber(args[0]);
    const b = asNumber(args[1]);
    return a | b;
  },

  bitXor: (args) => {
    const a = asNumber(args[0]);
    const b = asNumber(args[1]);
    return a ^ b;
  },

  bitNot: (args) => {
    const a = asNumber(args[0]);
    return ~a;
  },

  bitShiftLeft: (args) => {
    const a = asNumber(args[0]);
    const b = asNumber(args[1]);
    return a << b;
  },

  bitShiftRight: (args) => {
    const a = asNumber(args[0]);
    const b = asNumber(args[1]);
    return a >> b;
  },

  bitShiftRightUnsigned: (args) => {
    const a = asNumber(args[0]);
    const b = asNumber(args[1]);
    return a >>> b;
  },

  // ===== Statistics Builtins =====

  sum: (args) => {
    const list = asList(args[0]);
    return list.reduce((acc: number, val) => acc + asNumber(val), 0);
  },

  product: (args) => {
    const list = asList(args[0]);
    return list.reduce((acc: number, val) => acc * asNumber(val), 1);
  },

  mean: (args) => {
    const list = asList(args[0]);
    if (list.length === 0) throw new RuntimeError("mean requires a non-empty list");
    const sum = list.reduce((acc: number, val) => acc + asNumber(val), 0);
    return sum / list.length;
  },

  median: (args) => {
    const list = asList(args[0]);
    if (list.length === 0) throw new RuntimeError("median requires a non-empty list");
    const sorted = [...list].map(asNumber).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  },

  variance: (args) => {
    const list = asList(args[0]);
    const n = list.length;
    if (n === 0) throw new RuntimeError("variance requires a non-empty list");
    // Single pass for mean, then single pass for variance
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += asNumber(list[i]);
    }
    const mean = sum / n;
    let squaredSum = 0;
    for (let i = 0; i < n; i++) {
      const diff = asNumber(list[i]) - mean;
      squaredSum += diff * diff;
    }
    return squaredSum / n;
  },

  stdDev: (args) => {
    const list = asList(args[0]);
    const n = list.length;
    if (n === 0) throw new RuntimeError("stdDev requires a non-empty list");
    // Single pass for mean, then single pass for variance
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += asNumber(list[i]);
    }
    const mean = sum / n;
    let squaredSum = 0;
    for (let i = 0; i < n; i++) {
      const diff = asNumber(list[i]) - mean;
      squaredSum += diff * diff;
    }
    return Math.sqrt(squaredSum / n);
  },

  // ===== Number Theory Builtins =====

  gcd: (args) => {
    let a = Math.abs(asNumber(args[0]));
    let b = Math.abs(asNumber(args[1]));
    while (b !== 0) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a;
  },

  lcm: (args) => {
    const a = Math.abs(asNumber(args[0]));
    const b = Math.abs(asNumber(args[1]));
    if (a === 0 || b === 0) return 0;
    // Use the formula: lcm(a,b) = |a*b| / gcd(a,b)
    let gcdVal = a, temp = b;
    while (temp !== 0) {
      const t = temp;
      temp = gcdVal % temp;
      gcdVal = t;
    }
    return (a * b) / gcdVal;
  },

  isPrime: (args) => {
    const n = asNumber(args[0]);
    if (n < 2) return false;
    if (n === 2) return true;
    if (n % 2 === 0) return false;
    for (let i = 3; i <= Math.sqrt(n); i += 2) {
      if (n % i === 0) return false;
    }
    return true;
  },

  factorial: (args) => {
    const n = asNumber(args[0]);
    if (n < 0) throw new RuntimeError("factorial requires a non-negative integer");
    if (n === 0 || n === 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) {
      result *= i;
    }
    return result;
  },

  fibonacci: (args) => {
    const n = asNumber(args[0]);
    if (n < 0) throw new RuntimeError("fibonacci requires a non-negative integer");
    if (n === 0) return 0;
    if (n === 1) return 1;
    let a = 0, b = 1;
    for (let i = 2; i <= n; i++) {
      const temp = a + b;
      a = b;
      b = temp;
    }
    return b;
  },

  // Check if number is even
  isEven: (args) => {
    const n = asNumber(args[0]);
    return n % 2 === 0;
  },

  // Check if number is odd
  isOdd: (args) => {
    const n = asNumber(args[0]);
    return n % 2 !== 0;
  },

  // Modulo operation (handles negative numbers correctly)
  mod: (args) => {
    const a = asNumber(args[0]);
    const b = asNumber(args[1]);
    return ((a % b) + b) % b;
  },

  // Integer division
  divInt: (args) => {
    const a = asNumber(args[0]);
    const b = asNumber(args[1]);
    return Math.trunc(a / b);
  },

  // Random number builtins
  random: () => Math.random(),
  randomInt: (args) => {
    const min = args.length === 1 ? 0 : asNumber(args[0]);
    const max = asNumber(args.length === 1 ? args[0] : args[1]);
    return Math.floor(Math.random() * (max - min)) + min;
  },
  randomFloat: (args) => {
    const min = args.length === 1 ? 0 : asNumber(args[0]);
    const max = asNumber(args.length === 1 ? args[0] : args[1]);
    return Math.random() * (max - min) + min;
  },
  randomChoice: (args) => {
    const list = asList(args[0]);
    if (list.length === 0) throw new RuntimeError("randomChoice requires a non-empty list");
    const index = Math.floor(Math.random() * list.length);
    return list[index];
  },
  shuffle: (args) => {
    // Use slice for shallow copy instead of spread
    const list = asList(args[0]).slice();
    // Fisher-Yates shuffle
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = list[i];
      list[i] = list[j];
      list[j] = temp;
    }
    return list;
  },

  length: (args) => {
    const val = args[0];
    if (Array.isArray(val)) return val.length;
    if (typeof val === "string") return val.length;
    throw new RuntimeError("length requires a list or string");
  },

  head: (args) => {
    const list = asList(args[0]);
    if (list.length === 0) throw new RuntimeError("head of empty list");
    return list[0];
  },

  tail: (args) => {
    const list = asList(args[0]);
    return list.slice(1);
  },

  push: (args) => {
    const list = asList(args[0]);
    return [...list, args[1]];
  },

  concat: (args) => {
    const a = asList(args[0]);
    const b = asList(args[1]);
    // Use native concat which is optimized for array concatenation
    return a.concat(b);
  },

  reverse: (args) => {
    const list = asList(args[0]);
    // Use slice for shallow copy, then reverse in place
    return list.slice().reverse();
  },

  isEmpty: (args) => {
    const val = args[0];
    if (Array.isArray(val)) return val.length === 0;
    if (typeof val === "string") return val.length === 0;
    return val === null;
  },

  fst: (args) => {
    const val = args[0];
    if (getKind(val) === "tuple") {
      return (val as LeaTuple).elements[0];
    }
    if (Array.isArray(val)) return val[0];
    throw new RuntimeError("fst expects a tuple or list");
  },

  snd: (args) => {
    const val = args[0];
    if (getKind(val) === "tuple") {
      return (val as LeaTuple).elements[1];
    }
    if (Array.isArray(val)) return val[1];
    throw new RuntimeError("snd expects a tuple or list");
  },

  zip: (args) => {
    // zip([[1,2,3], [4,5,6]]) => [[1,4], [2,5], [3,6]]
    const lists = asList(args[0]).map(asList);
    if (lists.length === 0) return [];
    const minLen = Math.min(...lists.map(l => l.length));
    const result: LeaValue[][] = [];
    for (let i = 0; i < minLen; i++) {
      result.push(lists.map(l => l[i]));
    }
    return result;
  },

  range: (args) => {
    const start = args.length === 1 ? 0 : asNumber(args[0]);
    const end = asNumber(args.length === 1 ? args[0] : args[1]);
    const result: number[] = [];
    for (let i = start; i < end; i++) result.push(i);
    return result;
  },

  iterations: (args) => {
    const count = asNumber(args[0]);
    const result: number[] = [];
    for (let i = 0; i < count; i++) result.push(i);
    return result;
  },

  map: (args) => {
    const list = asList(args[0]);
    const fn = asFunction(args[1]);
    return list.map((item, index) => fn([item, index]));
  },

  filter: (args) => {
    const list = asList(args[0]);
    const fn = asFunction(args[1]);
    return list.filter((item, index) => isTruthy(fn([item, index])));
  },

  reduce: (args) => {
    const list = asList(args[0]);
    const initial = args[1];
    const fn = asFunction(args[2]);
    return list.reduce((acc, item, index) => fn([acc, item, index]), initial);
  },

  partition: (args) => {
    const list = asList(args[0]);
    const fn = asFunction(args[1]);
    const truthy: LeaValue[] = [];
    const falsy: LeaValue[] = [];
    for (const item of list) {
      if (isTruthy(fn([item]))) {
        truthy.push(item);
      } else {
        falsy.push(item);
      }
    }
    return [truthy, falsy];
  },

  // Find first element matching predicate
  find: (args) => {
    const list = asList(args[0]);
    const fn = asFunction(args[1]);
    for (let i = 0; i < list.length; i++) {
      if (isTruthy(fn([list[i], i]))) {
        return list[i];
      }
    }
    return null;
  },

  // Find index of first element matching predicate
  findIndex: (args) => {
    const list = asList(args[0]);
    const fn = asFunction(args[1]);
    for (let i = 0; i < list.length; i++) {
      if (isTruthy(fn([list[i], i]))) {
        return i;
      }
    }
    return -1;
  },

  // Check if any element matches predicate
  some: (args) => {
    const list = asList(args[0]);
    const fn = asFunction(args[1]);
    for (let i = 0; i < list.length; i++) {
      if (isTruthy(fn([list[i], i]))) {
        return true;
      }
    }
    return false;
  },

  // Check if all elements match predicate
  every: (args) => {
    const list = asList(args[0]);
    const fn = asFunction(args[1]);
    for (let i = 0; i < list.length; i++) {
      if (!isTruthy(fn([list[i], i]))) {
        return false;
      }
    }
    return true;
  },

  // Sort list with optional comparator function
  sort: (args) => {
    // Use slice for shallow copy instead of spread
    const list = asList(args[0]).slice();
    const comparator = args[1] !== undefined ? asFunction(args[1]) : null;

    if (comparator) {
      list.sort((a, b) => {
        const result = comparator([a, b]);
        if (typeof result !== "number") {
          throw new RuntimeError("sort comparator must return a number");
        }
        return result;
      });
    } else {
      // Default sort: numbers numerically, strings lexically
      list.sort((a, b) => {
        if (typeof a === "number" && typeof b === "number") {
          return a - b;
        }
        return String(a).localeCompare(String(b));
      });
    }
    return list;
  },

  // Group elements by key function
  groupBy: (args) => {
    const list = asList(args[0]);
    const fn = asFunction(args[1]);
    const groups = new Map<string, LeaValue[]>();

    for (let i = 0; i < list.length; i++) {
      const key = fn([list[i], i]);
      const keyStr = stringify(key);
      if (!groups.has(keyStr)) {
        groups.set(keyStr, []);
      }
      groups.get(keyStr)!.push(list[i]);
    }

    // Return as record
    const fields = new Map<string, LeaValue>();
    for (const [key, values] of groups) {
      fields.set(key, values);
    }
    return { kind: "record", fields } as LeaRecord;
  },

  // Flatten nested lists by one level (or specified depth)
  flatten: (args) => {
    const list = asList(args[0]);
    const depth = args[1] !== undefined ? asNumber(args[1]) : 1;

    const flattenRec = (arr: LeaValue[], d: number): LeaValue[] => {
      if (d <= 0) return arr;
      const result: LeaValue[] = [];
      for (const item of arr) {
        if (Array.isArray(item)) {
          result.push(...flattenRec(item, d - 1));
        } else {
          result.push(item);
        }
      }
      return result;
    };

    return flattenRec(list, depth);
  },

  // Map then flatten by one level
  flatMap: (args) => {
    const list = asList(args[0]);
    const fn = asFunction(args[1]);
    const result: LeaValue[] = [];

    for (let i = 0; i < list.length; i++) {
      const mapped = fn([list[i], i]);
      if (Array.isArray(mapped)) {
        result.push(...mapped);
      } else {
        result.push(mapped);
      }
    }
    return result;
  },

  // Get last element of list
  last: (args) => {
    const list = asList(args[0]);
    if (list.length === 0) throw new RuntimeError("last of empty list");
    return list[list.length - 1];
  },

  // Drop first n elements
  drop: (args) => {
    const list = asList(args[0]);
    const n = asNumber(args[1]);
    return list.slice(n);
  },

  // Take elements while predicate is true
  takeWhile: (args) => {
    const list = asList(args[0]);
    const fn = asFunction(args[1]);
    const result: LeaValue[] = [];
    for (let i = 0; i < list.length; i++) {
      if (!isTruthy(fn([list[i], i]))) break;
      result.push(list[i]);
    }
    return result;
  },

  // Drop elements while predicate is true
  dropWhile: (args) => {
    const list = asList(args[0]);
    const fn = asFunction(args[1]);
    let i = 0;
    while (i < list.length && isTruthy(fn([list[i], i]))) {
      i++;
    }
    return list.slice(i);
  },

  // Count elements matching predicate
  count: (args) => {
    const list = asList(args[0]);
    const fn = args[1] !== undefined ? asFunction(args[1]) : null;

    if (fn) {
      let count = 0;
      for (let i = 0; i < list.length; i++) {
        if (isTruthy(fn([list[i], i]))) count++;
      }
      return count;
    }
    return list.length;
  },

  // Insert element between each pair
  intersperse: (args) => {
    const list = asList(args[0]);
    const separator = args[1];
    if (list.length <= 1) return list;

    const result: LeaValue[] = [list[0]];
    for (let i = 1; i < list.length; i++) {
      result.push(separator, list[i]);
    }
    return result;
  },

  // Create list of pairs [index, element]
  enumerate: (args) => {
    const list = asList(args[0]);
    const start = args[1] !== undefined ? asNumber(args[1]) : 0;
    return list.map((item, i) => [start + i, item]);
  },

  // Transpose a matrix (list of lists)
  transpose: (args) => {
    const matrix = asList(args[0]).map(asList);
    if (matrix.length === 0) return [];
    const rows = matrix.length;
    const cols = Math.max(...matrix.map(r => r.length));

    const result: LeaValue[][] = [];
    for (let c = 0; c < cols; c++) {
      const row: LeaValue[] = [];
      for (let r = 0; r < rows; r++) {
        row.push(matrix[r][c] ?? null);
      }
      result.push(row);
    }
    return result;
  },

  toString: (args: LeaValue[]) => {
    const val = args[0];
    if (typeof val === "number") return String(val);
    if (typeof val === "string") return val;
    if (typeof val === "boolean") return String(val);
    if (val === null) return "null";
    return stringify(val);
  },

  take: (args: LeaValue[]) => {
    const list = asList(args[0]);
    const n = asNumber(args[1]);
    return list.slice(0, n);
  },

  at: (args: LeaValue[]) => {
    const list = asList(args[0]);
    const index = asNumber(args[1]);
    if (index < 0 || index >= list.length) {
      throw new RuntimeError(`Index ${index} out of bounds for list of length ${list.length}`);
    }
    return list[index];
  },

  // String manipulation builtins
  split: (args: LeaValue[]) => {
    const str = args[0];
    const delimiter = args[1];
    if (typeof str !== "string") {
      throw new RuntimeError("split requires a string as first argument");
    }
    if (typeof delimiter !== "string") {
      throw new RuntimeError("split requires a string delimiter");
    }
    return str.split(delimiter);
  },

  lines: (args: LeaValue[]) => {
    const str = args[0];
    if (typeof str !== "string") {
      throw new RuntimeError("lines requires a string");
    }
    return str.split("\n");
  },

  charAt: (args: LeaValue[]) => {
    const str = args[0];
    const index = asNumber(args[1]);
    if (typeof str !== "string") {
      throw new RuntimeError("charAt requires a string");
    }
    if (index < 0 || index >= str.length) {
      return "";
    }
    return str[index];
  },

  join: (args: LeaValue[]) => {
    const list = asList(args[0]);
    const delimiter = args[1] !== undefined ? String(args[1]) : "";
    return list.map((item) => String(item)).join(delimiter);
  },

  padEnd: (args: LeaValue[]) => {
    const str = args[0];
    const targetLength = asNumber(args[1]);
    const padChar = args[2] !== undefined ? String(args[2]) : " ";
    if (typeof str !== "string") {
      throw new RuntimeError("padEnd requires a string");
    }
    return str.padEnd(targetLength, padChar);
  },

  padStart: (args: LeaValue[]) => {
    const str = args[0];
    const targetLength = asNumber(args[1]);
    const padChar = args[2] !== undefined ? String(args[2]) : " ";
    if (typeof str !== "string") {
      throw new RuntimeError("padStart requires a string");
    }
    return str.padStart(targetLength, padChar);
  },

  trim: (args: LeaValue[]) => {
    const str = args[0];
    if (typeof str !== "string") {
      throw new RuntimeError("trim requires a string");
    }
    return str.trim();
  },

  trimEnd: (args: LeaValue[]) => {
    const str = args[0];
    if (typeof str !== "string") {
      throw new RuntimeError("trimEnd requires a string");
    }
    return str.trimEnd();
  },

  indexOf: (args: LeaValue[]) => {
    const str = args[0];
    const search = args[1];
    if (typeof str !== "string") {
      throw new RuntimeError("indexOf requires a string");
    }
    if (typeof search !== "string") {
      throw new RuntimeError("indexOf search term must be a string");
    }
    return str.indexOf(search);
  },

  includes: (args: LeaValue[]) => {
    const val = args[0];
    const search = args[1];
    if (typeof val === "string") {
      return val.includes(String(search));
    }
    if (Array.isArray(val)) {
      return val.some((item) => item === search);
    }
    throw new RuntimeError("includes requires a string or list");
  },

  repeat: (args: LeaValue[]) => {
    const str = args[0];
    const count = asNumber(args[1]);
    if (typeof str !== "string") {
      throw new RuntimeError("repeat requires a string");
    }
    return str.repeat(count);
  },

  slice: (args: LeaValue[]) => {
    const val = args[0];
    const start = asNumber(args[1]);
    const end = args[2] !== undefined ? asNumber(args[2]) : undefined;
    if (typeof val === "string") {
      return val.slice(start, end);
    }
    if (Array.isArray(val)) {
      return val.slice(start, end);
    }
    throw new RuntimeError("slice requires a string or list");
  },

  chars: (args: LeaValue[]) => {
    const str = args[0];
    if (typeof str !== "string") {
      throw new RuntimeError("chars requires a string");
    }
    return str.split("");
  },

  toUpperCase: (args: LeaValue[]) => {
    const str = args[0];
    if (typeof str !== "string") {
      throw new RuntimeError("toUpperCase requires a string");
    }
    return str.toUpperCase();
  },

  toLowerCase: (args: LeaValue[]) => {
    const str = args[0];
    if (typeof str !== "string") {
      throw new RuntimeError("toLowerCase requires a string");
    }
    return str.toLowerCase();
  },

  replace: (args: LeaValue[]) => {
    const str = args[0];
    const search = args[1];
    const replacement = args[2];
    if (typeof str !== "string") {
      throw new RuntimeError("replace requires a string as first argument");
    }
    if (typeof search !== "string") {
      throw new RuntimeError("replace requires a string search pattern");
    }
    if (typeof replacement !== "string") {
      throw new RuntimeError("replace requires a string replacement");
    }
    return str.split(search).join(replacement);
  },

  replaceFirst: (args: LeaValue[]) => {
    const str = args[0];
    const search = args[1];
    const replacement = args[2];
    if (typeof str !== "string") {
      throw new RuntimeError("replaceFirst requires a string as first argument");
    }
    if (typeof search !== "string") {
      throw new RuntimeError("replaceFirst requires a string search pattern");
    }
    if (typeof replacement !== "string") {
      throw new RuntimeError("replaceFirst requires a string replacement");
    }
    return str.replace(search, replacement);
  },

  startsWith: (args: LeaValue[]) => {
    const str = args[0];
    const prefix = args[1];
    if (typeof str !== "string") {
      throw new RuntimeError("startsWith requires a string as first argument");
    }
    if (typeof prefix !== "string") {
      throw new RuntimeError("startsWith requires a string prefix");
    }
    return str.startsWith(prefix);
  },

  endsWith: (args: LeaValue[]) => {
    const str = args[0];
    const suffix = args[1];
    if (typeof str !== "string") {
      throw new RuntimeError("endsWith requires a string as first argument");
    }
    if (typeof suffix !== "string") {
      throw new RuntimeError("endsWith requires a string suffix");
    }
    return str.endsWith(suffix);
  },

  // Trim whitespace from start
  trimStart: (args: LeaValue[]) => {
    const str = args[0];
    if (typeof str !== "string") {
      throw new RuntimeError("trimStart requires a string");
    }
    return str.trimStart();
  },

  // ===== Regex Builtins =====

  // Test if string matches pattern
  regexTest: (args: LeaValue[]) => {
    const str = args[0];
    const pattern = args[1];
    const flags = args[2];
    if (typeof str !== "string") {
      throw new RuntimeError("regexTest requires a string as first argument");
    }
    if (typeof pattern !== "string") {
      throw new RuntimeError("regexTest requires a string pattern");
    }
    validateRegexInput(str, "regexTest");
    const flagStr = flags !== undefined ? String(flags) : "";
    try {
      const regex = new RegExp(pattern, flagStr);
      return regex.test(str);
    } catch (e) {
      throw new RuntimeError(`Invalid regex pattern: ${pattern}`);
    }
  },

  // Match string against pattern, returns first match or null
  regexMatch: (args: LeaValue[]) => {
    const str = args[0];
    const pattern = args[1];
    const flags = args[2];
    if (typeof str !== "string") {
      throw new RuntimeError("regexMatch requires a string as first argument");
    }
    if (typeof pattern !== "string") {
      throw new RuntimeError("regexMatch requires a string pattern");
    }
    validateRegexInput(str, "regexMatch");
    const flagStr = flags !== undefined ? String(flags) : "";
    try {
      const regex = new RegExp(pattern, flagStr);
      const match = str.match(regex);
      if (!match) return null;

      // Return match info as record
      const fields = new Map<string, LeaValue>();
      fields.set("match", match[0]);
      fields.set("index", match.index ?? 0);
      fields.set("groups", match.slice(1));
      return { kind: "record", fields } as LeaRecord;
    } catch (e) {
      throw new RuntimeError(`Invalid regex pattern: ${pattern}`);
    }
  },

  // Find all matches in string
  regexMatchAll: (args: LeaValue[]) => {
    const str = args[0];
    const pattern = args[1];
    const flags = args[2];
    if (typeof str !== "string") {
      throw new RuntimeError("regexMatchAll requires a string as first argument");
    }
    if (typeof pattern !== "string") {
      throw new RuntimeError("regexMatchAll requires a string pattern");
    }
    validateRegexInput(str, "regexMatchAll");
    // Always add global flag for matchAll
    let flagStr = flags !== undefined ? String(flags) : "";
    if (!flagStr.includes("g")) flagStr += "g";

    try {
      const regex = new RegExp(pattern, flagStr);
      const matches = [...str.matchAll(regex)];
      return matches.map(match => {
        const fields = new Map<string, LeaValue>();
        fields.set("match", match[0]);
        fields.set("index", match.index ?? 0);
        fields.set("groups", match.slice(1));
        return { kind: "record", fields } as LeaRecord;
      });
    } catch (e) {
      throw new RuntimeError(`Invalid regex pattern: ${pattern}`);
    }
  },

  // Replace using regex pattern
  regexReplace: (args: LeaValue[]) => {
    const str = args[0];
    const pattern = args[1];
    const replacement = args[2];
    const flags = args[3];
    if (typeof str !== "string") {
      throw new RuntimeError("regexReplace requires a string as first argument");
    }
    if (typeof pattern !== "string") {
      throw new RuntimeError("regexReplace requires a string pattern");
    }
    if (typeof replacement !== "string") {
      throw new RuntimeError("regexReplace requires a string replacement");
    }
    validateRegexInput(str, "regexReplace");
    const flagStr = flags !== undefined ? String(flags) : "g";

    try {
      const regex = new RegExp(pattern, flagStr);
      return str.replace(regex, replacement);
    } catch (e) {
      throw new RuntimeError(`Invalid regex pattern: ${pattern}`);
    }
  },

  // Split string using regex pattern
  regexSplit: (args: LeaValue[]) => {
    const str = args[0];
    const pattern = args[1];
    const flags = args[2];
    if (typeof str !== "string") {
      throw new RuntimeError("regexSplit requires a string as first argument");
    }
    if (typeof pattern !== "string") {
      throw new RuntimeError("regexSplit requires a string pattern");
    }
    validateRegexInput(str, "regexSplit");
    const flagStr = flags !== undefined ? String(flags) : "";

    try {
      const regex = new RegExp(pattern, flagStr);
      return str.split(regex);
    } catch (e) {
      throw new RuntimeError(`Invalid regex pattern: ${pattern}`);
    }
  },

  // ===== Case Conversion Builtins =====

  // Convert to camelCase
  toCamelCase: (args: LeaValue[]) => {
    const str = args[0];
    if (typeof str !== "string") {
      throw new RuntimeError("toCamelCase requires a string");
    }
    return str
      .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
      .replace(/^[A-Z]/, c => c.toLowerCase());
  },

  // Convert to PascalCase
  toPascalCase: (args: LeaValue[]) => {
    const str = args[0];
    if (typeof str !== "string") {
      throw new RuntimeError("toPascalCase requires a string");
    }
    return str
      .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
      .replace(/^[a-z]/, c => c.toUpperCase());
  },

  // Convert to snake_case
  toSnakeCase: (args: LeaValue[]) => {
    const str = args[0];
    if (typeof str !== "string") {
      throw new RuntimeError("toSnakeCase requires a string");
    }
    return str
      .replace(/([a-z])([A-Z])/g, "$1_$2")
      .replace(/[-\s]+/g, "_")
      .toLowerCase();
  },

  // Convert to kebab-case
  toKebabCase: (args: LeaValue[]) => {
    const str = args[0];
    if (typeof str !== "string") {
      throw new RuntimeError("toKebabCase requires a string");
    }
    return str
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/[_\s]+/g, "-")
      .toLowerCase();
  },

  // Convert to CONSTANT_CASE
  toConstantCase: (args: LeaValue[]) => {
    const str = args[0];
    if (typeof str !== "string") {
      throw new RuntimeError("toConstantCase requires a string");
    }
    return str
      .replace(/([a-z])([A-Z])/g, "$1_$2")
      .replace(/[-\s]+/g, "_")
      .toUpperCase();
  },

  // Capitalize first letter
  capitalize: (args: LeaValue[]) => {
    const str = args[0];
    if (typeof str !== "string") {
      throw new RuntimeError("capitalize requires a string");
    }
    if (str.length === 0) return str;
    return str[0].toUpperCase() + str.slice(1);
  },

  // Capitalize first letter of each word
  titleCase: (args: LeaValue[]) => {
    const str = args[0];
    if (typeof str !== "string") {
      throw new RuntimeError("titleCase requires a string");
    }
    return str.replace(/\b\w/g, c => c.toUpperCase());
  },

  // ===== Encoding Builtins =====

  // Base64 encode
  base64Encode: (args: LeaValue[]) => {
    const str = args[0];
    if (typeof str !== "string") {
      throw new RuntimeError("base64Encode requires a string");
    }
    return Buffer.from(str, "utf-8").toString("base64");
  },

  // Base64 decode
  base64Decode: (args: LeaValue[]) => {
    const str = args[0];
    if (typeof str !== "string") {
      throw new RuntimeError("base64Decode requires a string");
    }
    try {
      return Buffer.from(str, "base64").toString("utf-8");
    } catch (e) {
      throw new RuntimeError(`Invalid base64 string: ${str}`);
    }
  },

  // URL encode
  urlEncode: (args: LeaValue[]) => {
    const str = args[0];
    if (typeof str !== "string") {
      throw new RuntimeError("urlEncode requires a string");
    }
    return encodeURIComponent(str);
  },

  // URL decode
  urlDecode: (args: LeaValue[]) => {
    const str = args[0];
    if (typeof str !== "string") {
      throw new RuntimeError("urlDecode requires a string");
    }
    try {
      return decodeURIComponent(str);
    } catch (e) {
      throw new RuntimeError(`Invalid URL-encoded string: ${str}`);
    }
  },

  // Hex encode
  hexEncode: (args: LeaValue[]) => {
    const str = args[0];
    if (typeof str !== "string") {
      throw new RuntimeError("hexEncode requires a string");
    }
    return Buffer.from(str, "utf-8").toString("hex");
  },

  // Hex decode
  hexDecode: (args: LeaValue[]) => {
    const str = args[0];
    if (typeof str !== "string") {
      throw new RuntimeError("hexDecode requires a string");
    }
    try {
      return Buffer.from(str, "hex").toString("utf-8");
    } catch (e) {
      throw new RuntimeError(`Invalid hex string: ${str}`);
    }
  },

  // Set-like operations on lists (for graph algorithms)
  listSet: (args: LeaValue[]) => {
    // Create a list with unique elements
    const list = asList(args[0]);
    const seen = new Set<string>();
    const result: LeaValue[] = [];
    for (const item of list) {
      const key = JSON.stringify(item);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }
    return result;
  },

  setAdd: (args: LeaValue[]) => {
    // Add element to list if not present (returns new list)
    const list = asList(args[0]);
    const item = args[1];
    const key = JSON.stringify(item);
    for (const existing of list) {
      if (JSON.stringify(existing) === key) {
        return list;
      }
    }
    return [...list, item];
  },

  setHas: (args: LeaValue[]) => {
    // Check if element is in list
    const list = asList(args[0]);
    const item = args[1];
    const key = JSON.stringify(item);
    for (const existing of list) {
      if (JSON.stringify(existing) === key) {
        return true;
      }
    }
    return false;
  },

  // ASCII diagram parsing
  breakPieces: (args: LeaValue[]) => {
    const shape = args[0];
    if (typeof shape !== "string") {
      throw new RuntimeError("breakPieces requires a string");
    }

    const lines = shape.split("\n");
    const height = lines.length;
    if (height === 0) return [];
    const width = Math.max(...lines.map((l) => l.length));

    // Pad lines to same width
    const grid = lines.map((l) => l.padEnd(width));

    const charAt = (r: number, c: number): string => {
      if (r < 0 || r >= height || c < 0 || c >= width) return " ";
      return grid[r][c] || " ";
    };

    const isBoxChar = (ch: string): boolean => {
      return ch === "+" || ch === "-" || ch === "|";
    };

    // Mark exterior using flood fill from edges
    const exterior: boolean[][] = Array.from({ length: height }, () =>
      Array(width).fill(false)
    );

    const stack: [number, number][] = [];

    // Add all edge cells that are not box characters
    for (let c = 0; c < width; c++) {
      if (!isBoxChar(charAt(0, c))) stack.push([0, c]);
      if (!isBoxChar(charAt(height - 1, c))) stack.push([height - 1, c]);
    }
    for (let r = 0; r < height; r++) {
      if (!isBoxChar(charAt(r, 0))) stack.push([r, 0]);
      if (!isBoxChar(charAt(r, width - 1))) stack.push([r, width - 1]);
    }

    while (stack.length > 0) {
      const [r, c] = stack.pop()!;
      if (r < 0 || r >= height || c < 0 || c >= width) continue;
      if (exterior[r][c]) continue;
      if (isBoxChar(charAt(r, c))) continue;
      exterior[r][c] = true;
      stack.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
    }

    // Find interior regions
    const visited: boolean[][] = Array.from({ length: height }, () =>
      Array(width).fill(false)
    );
    const regions: [number, number][][] = [];

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (!visited[r][c] && !exterior[r][c] && !isBoxChar(charAt(r, c))) {
          const cells: [number, number][] = [];
          const stack: [number, number][] = [[r, c]];
          while (stack.length > 0) {
            const [cr, cc] = stack.pop()!;
            if (cr < 0 || cr >= height || cc < 0 || cc >= width) continue;
            if (visited[cr][cc] || exterior[cr][cc]) continue;
            if (isBoxChar(charAt(cr, cc))) continue;
            visited[cr][cc] = true;
            cells.push([cr, cc]);
            stack.push([cr - 1, cc], [cr + 1, cc], [cr, cc - 1], [cr, cc + 1]);
          }
          if (cells.length > 0) {
            regions.push(cells);
          }
        }
      }
    }

    // Extract each region as a piece
    const pieces = regions.map((region) => {
      // Find boundary cells (box chars adjacent to interior)
      // First pass: direct boundary (edges adjacent to interior)
      const directBoundary = new Set<string>();
      for (const [r, c] of region) {
        for (const [dr, dc] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ] as const) {
          const nr = r + dr,
            nc = c + dc;
          if (isBoxChar(charAt(nr, nc))) {
            directBoundary.add(`${nr},${nc}`);
          }
        }
      }

      // Second pass: expand to include corners ('+' adjacent to edges)
      // Corners are '+' characters adjacent to the direct boundary
      const boundaryCells = new Set<string>(directBoundary);
      for (const key of directBoundary) {
        const [r, c] = key.split(",").map(Number);
        for (const [dr, dc] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ] as const) {
          const nr = r + dr,
            nc = c + dc;
          const ch = charAt(nr, nc);
          if (ch === "+") {
            boundaryCells.add(`${nr},${nc}`);
          }
        }
      }

      // Determine character for each boundary cell
      // A '+' becomes '+' only if it has both horizontal and vertical continuation
      const determineChar = (r: number, c: number): string => {
        const ch = charAt(r, c);
        if (ch !== "+") return ch;

        let hasHoriz = false;
        for (const dc of [-1, 1]) {
          const key = `${r},${c + dc}`;
          if (boundaryCells.has(key)) {
            const nch = charAt(r, c + dc);
            if (nch === "-" || nch === "+") {
              hasHoriz = true;
              break;
            }
          }
        }

        let hasVert = false;
        for (const dr of [-1, 1]) {
          const key = `${r + dr},${c}`;
          if (boundaryCells.has(key)) {
            const nch = charAt(r + dr, c);
            if (nch === "|" || nch === "+") {
              hasVert = true;
              break;
            }
          }
        }

        if (hasHoriz && hasVert) return "+";
        if (hasHoriz) return "-";
        if (hasVert) return "|";
        return "+";
      };

      // Find bounding box
      let minR = Infinity,
        maxR = -Infinity,
        minC = Infinity,
        maxC = -Infinity;
      for (const [r, c] of region) {
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }
      for (const key of boundaryCells) {
        const [r, c] = key.split(",").map(Number);
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }

      // Create interior set for quick lookup
      const interiorSet = new Set(region.map(([r, c]) => `${r},${c}`));

      // Create output
      const outLines: string[] = [];
      for (let r = minR; r <= maxR; r++) {
        let line = "";
        for (let c = minC; c <= maxC; c++) {
          const key = `${r},${c}`;
          if (boundaryCells.has(key)) {
            line += determineChar(r, c);
          } else if (interiorSet.has(key)) {
            line += " ";
          } else {
            line += " ";
          }
        }
        outLines.push(line.trimEnd());
      }

      return outLines.join("\n");
    });

    return pieces;
  },

  // Concurrency builtins
  parallel: async (args) => {
    const list = asList(args[0]);
    const fn = asFunction(args[1]);
    const options = args[2];

    let limit = Infinity;
    if (options && typeof options === "object" && "kind" in options && options.kind === "record") {
      const record = options as LeaRecord;
      const limitVal = record.fields.get("limit");
      if (limitVal !== undefined && typeof limitVal === "number") {
        limit = limitVal;
      }
    }

    // Execute with concurrency limit
    const results: LeaValue[] = [];
    const executing: Promise<void>[] = [];

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const index = i;
      const p = (async () => {
        const result = fn([item, index]);
        // If result is a promise, await it
        const unwrapped = await unwrapPromise(result);
        results[i] = unwrapped;
      })();

      executing.push(p);

      if (executing.length >= limit) {
        await Promise.race(executing);
        // Remove completed promises
        const completed = executing.filter(async (ep) => {
          try {
            await Promise.race([ep, Promise.resolve()]);
            return false;
          } catch {
            return false;
          }
        });
      }
    }

    await Promise.all(executing);
    return results;
  },

  race: async (args) => {
    const list = asList(args[0]);

    // Each element should be a function (thunk)
    const promises = list.map(async (item) => {
      const fn = asFunction(item);
      const result = fn([]);
      return unwrapPromise(result);
    });

    return Promise.race(promises);
  },

  // ===== JSON Builtins =====

  // Parse a JSON string into a Lea value
  parseJson: (args: LeaValue[]) => {
    const str = args[0];
    if (typeof str !== "string") {
      throw new RuntimeError("parseJson requires a string");
    }
    try {
      const json = JSON.parse(str);
      return convertJsonToLea(json);
    } catch (e) {
      throw new RuntimeError(`parseJson failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  },

  // Convert a Lea value to a JSON string
  toJson: (args: LeaValue[]) => {
    const val = args[0];
    const indent = args[1] !== undefined ? asNumber(args[1]) : undefined;
    try {
      const json = convertLeaToJson(val);
      return JSON.stringify(json, null, indent);
    } catch (e) {
      throw new RuntimeError(`toJson failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  },

  // Pretty-print a Lea value as JSON with 2-space indentation
  prettyJson: (args: LeaValue[]) => {
    const val = args[0];
    try {
      const json = convertLeaToJson(val);
      return JSON.stringify(json, null, 2);
    } catch (e) {
      throw new RuntimeError(`prettyJson failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  },

  // ===== Date/Time Builtins =====

  // Get current timestamp in milliseconds
  now: () => Date.now(),

  // Get current date/time as a record
  today: () => {
    const d = new Date();
    const fields = new Map<string, LeaValue>();
    fields.set("year", d.getFullYear());
    fields.set("month", d.getMonth() + 1);
    fields.set("day", d.getDate());
    fields.set("hour", d.getHours());
    fields.set("minute", d.getMinutes());
    fields.set("second", d.getSeconds());
    fields.set("millisecond", d.getMilliseconds());
    fields.set("dayOfWeek", d.getDay());
    fields.set("timestamp", d.getTime());
    return { kind: "record", fields } as LeaRecord;
  },

  // Create a date from components or timestamp
  date: (args: LeaValue[]) => {
    let d: Date;
    if (args.length === 0) {
      d = new Date();
    } else if (args.length === 1) {
      const val = args[0];
      if (typeof val === "number") {
        d = new Date(val);
      } else if (typeof val === "string") {
        d = new Date(val);
        if (isNaN(d.getTime())) {
          throw new RuntimeError(`Invalid date string: ${val}`);
        }
      } else {
        throw new RuntimeError("date requires a timestamp, date string, or year/month/day");
      }
    } else {
      // year, month, day [, hour, minute, second, ms]
      const year = asNumber(args[0]);
      const month = asNumber(args[1]) - 1; // JS months are 0-indexed
      const day = args[2] !== undefined ? asNumber(args[2]) : 1;
      const hour = args[3] !== undefined ? asNumber(args[3]) : 0;
      const minute = args[4] !== undefined ? asNumber(args[4]) : 0;
      const second = args[5] !== undefined ? asNumber(args[5]) : 0;
      const ms = args[6] !== undefined ? asNumber(args[6]) : 0;
      d = new Date(year, month, day, hour, minute, second, ms);
    }

    const fields = new Map<string, LeaValue>();
    fields.set("year", d.getFullYear());
    fields.set("month", d.getMonth() + 1);
    fields.set("day", d.getDate());
    fields.set("hour", d.getHours());
    fields.set("minute", d.getMinutes());
    fields.set("second", d.getSeconds());
    fields.set("millisecond", d.getMilliseconds());
    fields.set("dayOfWeek", d.getDay());
    fields.set("timestamp", d.getTime());
    return { kind: "record", fields } as LeaRecord;
  },

  // Format a date record or timestamp as a string
  formatDate: (args: LeaValue[]) => {
    const val = args[0];
    const format = args[1] !== undefined ? String(args[1]) : "ISO";

    let d: Date;
    if (typeof val === "number") {
      d = new Date(val);
    } else if (isRecord(val)) {
      const rec = val as LeaRecord;
      const ts = rec.fields.get("timestamp");
      if (typeof ts === "number") {
        d = new Date(ts);
      } else {
        throw new RuntimeError("formatDate requires a date record with timestamp field");
      }
    } else {
      throw new RuntimeError("formatDate requires a timestamp or date record");
    }

    if (format === "ISO") {
      return d.toISOString();
    } else if (format === "date") {
      return d.toDateString();
    } else if (format === "time") {
      return d.toTimeString();
    } else if (format === "locale") {
      return d.toLocaleString();
    } else if (format === "localeDate") {
      return d.toLocaleDateString();
    } else if (format === "localeTime") {
      return d.toLocaleTimeString();
    } else {
      // Custom format: YYYY, MM, DD, HH, mm, ss, ms
      return format
        .replace("YYYY", String(d.getFullYear()))
        .replace("MM", String(d.getMonth() + 1).padStart(2, "0"))
        .replace("DD", String(d.getDate()).padStart(2, "0"))
        .replace("HH", String(d.getHours()).padStart(2, "0"))
        .replace("mm", String(d.getMinutes()).padStart(2, "0"))
        .replace("ss", String(d.getSeconds()).padStart(2, "0"))
        .replace("ms", String(d.getMilliseconds()).padStart(3, "0"));
    }
  },

  // Parse a date string into a date record
  parseDate: (args: LeaValue[]) => {
    const str = args[0];
    if (typeof str !== "string") {
      throw new RuntimeError("parseDate requires a string");
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) {
      throw new RuntimeError(`Invalid date string: ${str}`);
    }

    const fields = new Map<string, LeaValue>();
    fields.set("year", d.getFullYear());
    fields.set("month", d.getMonth() + 1);
    fields.set("day", d.getDate());
    fields.set("hour", d.getHours());
    fields.set("minute", d.getMinutes());
    fields.set("second", d.getSeconds());
    fields.set("millisecond", d.getMilliseconds());
    fields.set("dayOfWeek", d.getDay());
    fields.set("timestamp", d.getTime());
    return { kind: "record", fields } as LeaRecord;
  },

  // Add time to a date
  addDays: (args: LeaValue[]) => {
    const val = args[0];
    const days = asNumber(args[1]);

    let timestamp: number;
    if (typeof val === "number") {
      timestamp = val;
    } else if (isRecord(val)) {
      const rec = val as LeaRecord;
      const ts = rec.fields.get("timestamp");
      if (typeof ts === "number") {
        timestamp = ts;
      } else {
        throw new RuntimeError("addDays requires a date record with timestamp field");
      }
    } else {
      throw new RuntimeError("addDays requires a timestamp or date record");
    }

    const d = new Date(timestamp + days * 24 * 60 * 60 * 1000);
    const fields = new Map<string, LeaValue>();
    fields.set("year", d.getFullYear());
    fields.set("month", d.getMonth() + 1);
    fields.set("day", d.getDate());
    fields.set("hour", d.getHours());
    fields.set("minute", d.getMinutes());
    fields.set("second", d.getSeconds());
    fields.set("millisecond", d.getMilliseconds());
    fields.set("dayOfWeek", d.getDay());
    fields.set("timestamp", d.getTime());
    return { kind: "record", fields } as LeaRecord;
  },

  addHours: (args: LeaValue[]) => {
    const val = args[0];
    const hours = asNumber(args[1]);

    let timestamp: number;
    if (typeof val === "number") {
      timestamp = val;
    } else if (isRecord(val)) {
      const rec = val as LeaRecord;
      const ts = rec.fields.get("timestamp");
      if (typeof ts === "number") {
        timestamp = ts;
      } else {
        throw new RuntimeError("addHours requires a date record with timestamp field");
      }
    } else {
      throw new RuntimeError("addHours requires a timestamp or date record");
    }

    const d = new Date(timestamp + hours * 60 * 60 * 1000);
    const fields = new Map<string, LeaValue>();
    fields.set("year", d.getFullYear());
    fields.set("month", d.getMonth() + 1);
    fields.set("day", d.getDate());
    fields.set("hour", d.getHours());
    fields.set("minute", d.getMinutes());
    fields.set("second", d.getSeconds());
    fields.set("millisecond", d.getMilliseconds());
    fields.set("dayOfWeek", d.getDay());
    fields.set("timestamp", d.getTime());
    return { kind: "record", fields } as LeaRecord;
  },

  addMinutes: (args: LeaValue[]) => {
    const val = args[0];
    const minutes = asNumber(args[1]);

    let timestamp: number;
    if (typeof val === "number") {
      timestamp = val;
    } else if (isRecord(val)) {
      const rec = val as LeaRecord;
      const ts = rec.fields.get("timestamp");
      if (typeof ts === "number") {
        timestamp = ts;
      } else {
        throw new RuntimeError("addMinutes requires a date record with timestamp field");
      }
    } else {
      throw new RuntimeError("addMinutes requires a timestamp or date record");
    }

    const d = new Date(timestamp + minutes * 60 * 1000);
    const fields = new Map<string, LeaValue>();
    fields.set("year", d.getFullYear());
    fields.set("month", d.getMonth() + 1);
    fields.set("day", d.getDate());
    fields.set("hour", d.getHours());
    fields.set("minute", d.getMinutes());
    fields.set("second", d.getSeconds());
    fields.set("millisecond", d.getMilliseconds());
    fields.set("dayOfWeek", d.getDay());
    fields.set("timestamp", d.getTime());
    return { kind: "record", fields } as LeaRecord;
  },

  // Difference between two dates in milliseconds
  diffDates: (args: LeaValue[]) => {
    const getTimestamp = (val: LeaValue): number => {
      if (typeof val === "number") return val;
      if (isRecord(val)) {
        const rec = val as LeaRecord;
        const ts = rec.fields.get("timestamp");
        if (typeof ts === "number") return ts;
      }
      throw new RuntimeError("diffDates requires timestamps or date records");
    };

    const ts1 = getTimestamp(args[0]);
    const ts2 = getTimestamp(args[1]);
    return ts1 - ts2;
  },

  // ===== I/O Builtins =====

  // File operations
  readFile: (args: LeaValue[]) => {
    const filePath = args[0];
    if (typeof filePath !== "string") {
      throw new RuntimeError("readFile requires a string path");
    }
    return wrapPromise(
      fs.readFile(filePath, "utf-8").catch((err) => {
        throw new RuntimeError(`readFile failed: ${err.message}`);
      })
    );
  },

  writeFile: (args: LeaValue[]) => {
    const filePath = args[0];
    const content = args[1];
    if (typeof filePath !== "string") {
      throw new RuntimeError("writeFile requires a string path");
    }
    if (typeof content !== "string") {
      throw new RuntimeError("writeFile requires string content");
    }
    return wrapPromise(
      fs.writeFile(filePath, content, "utf-8").then(() => true).catch((err) => {
        throw new RuntimeError(`writeFile failed: ${err.message}`);
      })
    );
  },

  appendFile: (args: LeaValue[]) => {
    const filePath = args[0];
    const content = args[1];
    if (typeof filePath !== "string") {
      throw new RuntimeError("appendFile requires a string path");
    }
    if (typeof content !== "string") {
      throw new RuntimeError("appendFile requires string content");
    }
    return wrapPromise(
      fs.appendFile(filePath, content, "utf-8").then(() => true).catch((err) => {
        throw new RuntimeError(`appendFile failed: ${err.message}`);
      })
    );
  },

  fileExists: (args: LeaValue[]) => {
    const filePath = args[0];
    if (typeof filePath !== "string") {
      throw new RuntimeError("fileExists requires a string path");
    }
    return wrapPromise(
      fs.access(filePath).then(() => true).catch(() => false)
    );
  },

  deleteFile: (args: LeaValue[]) => {
    const filePath = args[0];
    if (typeof filePath !== "string") {
      throw new RuntimeError("deleteFile requires a string path");
    }
    return wrapPromise(
      fs.unlink(filePath).then(() => true).catch((err) => {
        throw new RuntimeError(`deleteFile failed: ${err.message}`);
      })
    );
  },

  readDir: (args: LeaValue[]) => {
    const dirPath = args[0];
    if (typeof dirPath !== "string") {
      throw new RuntimeError("readDir requires a string path");
    }
    return wrapPromise(
      fs.readdir(dirPath).catch((err) => {
        throw new RuntimeError(`readDir failed: ${err.message}`);
      })
    );
  },

  // ===== Directory Operations =====

  mkdir: (args: LeaValue[]) => {
    const dirPath = args[0];
    const recursive = args[1] !== undefined ? isTruthy(args[1]) : true;
    if (typeof dirPath !== "string") {
      throw new RuntimeError("mkdir requires a string path");
    }
    return wrapPromise(
      fs.mkdir(dirPath, { recursive }).then(() => true).catch((err) => {
        throw new RuntimeError(`mkdir failed: ${err.message}`);
      })
    );
  },

  rmdir: (args: LeaValue[]) => {
    const dirPath = args[0];
    const recursive = args[1] !== undefined ? isTruthy(args[1]) : false;
    if (typeof dirPath !== "string") {
      throw new RuntimeError("rmdir requires a string path");
    }
    return wrapPromise(
      fs.rm(dirPath, { recursive, force: false }).then(() => true).catch((err) => {
        throw new RuntimeError(`rmdir failed: ${err.message}`);
      })
    );
  },

  copyFile: (args: LeaValue[]) => {
    const src = args[0];
    const dest = args[1];
    if (typeof src !== "string") {
      throw new RuntimeError("copyFile requires a string source path");
    }
    if (typeof dest !== "string") {
      throw new RuntimeError("copyFile requires a string destination path");
    }
    return wrapPromise(
      fs.copyFile(src, dest).then(() => true).catch((err) => {
        throw new RuntimeError(`copyFile failed: ${err.message}`);
      })
    );
  },

  renameFile: (args: LeaValue[]) => {
    const oldPath = args[0];
    const newPath = args[1];
    if (typeof oldPath !== "string") {
      throw new RuntimeError("renameFile requires a string old path");
    }
    if (typeof newPath !== "string") {
      throw new RuntimeError("renameFile requires a string new path");
    }
    return wrapPromise(
      fs.rename(oldPath, newPath).then(() => true).catch((err) => {
        throw new RuntimeError(`renameFile failed: ${err.message}`);
      })
    );
  },

  // ===== File Metadata =====

  fileStats: (args: LeaValue[]) => {
    const filePath = args[0];
    if (typeof filePath !== "string") {
      throw new RuntimeError("fileStats requires a string path");
    }
    return wrapPromise(
      fs.stat(filePath).then((stats) => {
        const fields = new Map<string, LeaValue>();
        fields.set("size", stats.size);
        fields.set("isFile", stats.isFile());
        fields.set("isDirectory", stats.isDirectory());
        fields.set("isSymlink", stats.isSymbolicLink());
        fields.set("createdAt", stats.birthtimeMs);
        fields.set("modifiedAt", stats.mtimeMs);
        fields.set("accessedAt", stats.atimeMs);
        fields.set("mode", stats.mode);
        return { kind: "record", fields } as LeaRecord;
      }).catch((err) => {
        throw new RuntimeError(`fileStats failed: ${err.message}`);
      })
    );
  },

  isFile: (args: LeaValue[]) => {
    const filePath = args[0];
    if (typeof filePath !== "string") {
      throw new RuntimeError("isFile requires a string path");
    }
    return wrapPromise(
      fs.stat(filePath).then((stats) => stats.isFile()).catch(() => false)
    );
  },

  isDirectory: (args: LeaValue[]) => {
    const filePath = args[0];
    if (typeof filePath !== "string") {
      throw new RuntimeError("isDirectory requires a string path");
    }
    return wrapPromise(
      fs.stat(filePath).then((stats) => stats.isDirectory()).catch(() => false)
    );
  },

  // ===== Path Utilities =====

  pathJoin: (args: LeaValue[]) => {
    const parts = args.map(arg => {
      if (typeof arg !== "string") {
        throw new RuntimeError("pathJoin requires string arguments");
      }
      return arg;
    });
    return path.join(...parts);
  },

  pathDirname: (args: LeaValue[]) => {
    const p = args[0];
    if (typeof p !== "string") {
      throw new RuntimeError("pathDirname requires a string path");
    }
    return path.dirname(p);
  },

  pathBasename: (args: LeaValue[]) => {
    const p = args[0];
    const ext = args[1];
    if (typeof p !== "string") {
      throw new RuntimeError("pathBasename requires a string path");
    }
    if (ext !== undefined && typeof ext !== "string") {
      throw new RuntimeError("pathBasename extension must be a string");
    }
    return ext ? path.basename(p, ext) : path.basename(p);
  },

  pathExtname: (args: LeaValue[]) => {
    const p = args[0];
    if (typeof p !== "string") {
      throw new RuntimeError("pathExtname requires a string path");
    }
    return path.extname(p);
  },

  pathResolve: (args: LeaValue[]) => {
    const parts = args.map(arg => {
      if (typeof arg !== "string") {
        throw new RuntimeError("pathResolve requires string arguments");
      }
      return arg;
    });
    return path.resolve(...parts);
  },

  pathRelative: (args: LeaValue[]) => {
    const from = args[0];
    const to = args[1];
    if (typeof from !== "string" || typeof to !== "string") {
      throw new RuntimeError("pathRelative requires two string paths");
    }
    return path.relative(from, to);
  },

  pathNormalize: (args: LeaValue[]) => {
    const p = args[0];
    if (typeof p !== "string") {
      throw new RuntimeError("pathNormalize requires a string path");
    }
    return path.normalize(p);
  },

  pathIsAbsolute: (args: LeaValue[]) => {
    const p = args[0];
    if (typeof p !== "string") {
      throw new RuntimeError("pathIsAbsolute requires a string path");
    }
    return path.isAbsolute(p);
  },

  pathParse: (args: LeaValue[]) => {
    const p = args[0];
    if (typeof p !== "string") {
      throw new RuntimeError("pathParse requires a string path");
    }
    const parsed = path.parse(p);
    const fields = new Map<string, LeaValue>();
    fields.set("root", parsed.root);
    fields.set("dir", parsed.dir);
    fields.set("base", parsed.base);
    fields.set("ext", parsed.ext);
    fields.set("name", parsed.name);
    return { kind: "record", fields } as LeaRecord;
  },

  // ===== Environment Variables =====

  getEnv: (args: LeaValue[]) => {
    const name = args[0];
    if (typeof name !== "string") {
      throw new RuntimeError("getEnv requires a string name");
    }
    return process.env[name] ?? null;
  },

  getEnvAll: () => {
    const fields = new Map<string, LeaValue>();
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        fields.set(key, value);
      }
    }
    return { kind: "record", fields } as LeaRecord;
  },

  // Get current working directory
  cwd: () => process.cwd(),

  // Get home directory
  homeDir: () => {
    return process.env.HOME || process.env.USERPROFILE || "";
  },

  // Get temp directory
  tmpDir: () => {
    return process.env.TMPDIR || process.env.TMP || process.env.TEMP || "/tmp";
  },

  // Get platform
  platform: () => process.platform,

  // HTTP operations
  fetch: (args: LeaValue[]) => {
    const url = args[0];
    const options = args[1];

    if (typeof url !== "string") {
      throw new RuntimeError("fetch requires a string URL");
    }

    // Build fetch options from Lea record
    const fetchOptions: RequestInit = {};

    if (options && isRecord(options)) {
      const record = options as LeaRecord;

      // Method
      const method = record.fields.get("method");
      if (method !== undefined) {
        if (typeof method !== "string") {
          throw new RuntimeError("fetch method must be a string");
        }
        fetchOptions.method = method;
      }

      // Headers
      const headers = record.fields.get("headers");
      if (headers !== undefined) {
        if (!isRecord(headers)) {
          throw new RuntimeError("fetch headers must be a record");
        }
        const headerObj: Record<string, string> = {};
        for (const [key, value] of (headers as LeaRecord).fields) {
          headerObj[key] = String(value);
        }
        fetchOptions.headers = headerObj;
      }

      // Body
      const body = record.fields.get("body");
      if (body !== undefined) {
        if (typeof body === "string") {
          fetchOptions.body = body;
        } else if (isRecord(body)) {
          // JSON-encode record bodies
          const obj: Record<string, LeaValue> = {};
          for (const [key, value] of (body as LeaRecord).fields) {
            obj[key] = value;
          }
          fetchOptions.body = JSON.stringify(obj);
        } else {
          fetchOptions.body = stringify(body);
        }
      }
    }

    return wrapPromise(
      (async () => {
        try {
          const response = await globalThis.fetch(url, fetchOptions);
          const contentType = response.headers.get("content-type") || "";

          // Build response record
          const fields = new Map<string, LeaValue>();
          fields.set("status", response.status);
          fields.set("ok", response.ok);
          fields.set("statusText", response.statusText);

          // Parse body based on content type
          if (contentType.includes("application/json")) {
            try {
              const json = await response.json();
              fields.set("body", convertJsonToLea(json));
            } catch {
              fields.set("body", await response.text());
            }
          } else {
            fields.set("body", await response.text());
          }

          // Headers as record
          const headerFields = new Map<string, LeaValue>();
          response.headers.forEach((value, key) => {
            headerFields.set(key, value);
          });
          fields.set("headers", { kind: "record", fields: headerFields } as LeaRecord);

          return { kind: "record", fields } as LeaRecord;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          throw new RuntimeError(`fetch failed: ${message}`);
        }
      })()
    );
  },
};

// Helper to convert JSON values to Lea values
function convertJsonToLea(json: unknown): LeaValue {
  if (json === null) return null;
  if (typeof json === "number") return json;
  if (typeof json === "string") return json;
  if (typeof json === "boolean") return json;
  if (Array.isArray(json)) {
    return json.map(convertJsonToLea);
  }
  if (typeof json === "object") {
    const fields = new Map<string, LeaValue>();
    for (const [key, value] of Object.entries(json as Record<string, unknown>)) {
      fields.set(key, convertJsonToLea(value));
    }
    return { kind: "record", fields } as LeaRecord;
  }
  return null;
}

// Helper to convert Lea values to JSON-compatible values
function convertLeaToJson(value: LeaValue): unknown {
  if (value === null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.map(convertLeaToJson);
  }
  if (value && typeof value === "object" && "kind" in value) {
    if (value.kind === "record") {
      const rec = value as LeaRecord;
      const obj: Record<string, unknown> = {};
      for (const [key, val] of rec.fields) {
        obj[key] = convertLeaToJson(val);
      }
      return obj;
    }
    if (value.kind === "tuple") {
      const tuple = value as LeaTuple;
      return tuple.elements.map(convertLeaToJson);
    }
    // Functions, pipelines, etc. cannot be serialized to JSON
    throw new RuntimeError(`Cannot convert ${value.kind} to JSON`);
  }
  return null;
}

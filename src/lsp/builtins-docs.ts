/**
 * Documentation for Lea built-in functions
 *
 * This module provides documentation for all built-in functions
 * to support hover information and autocomplete.
 */

import { BuiltinDoc } from "./types";

/**
 * Documentation for all Lea built-in functions
 */
export const BUILTIN_DOCS: Record<string, BuiltinDoc> = {
  // Output
  print: {
    name: "print",
    signature: "print(value, ...values) -> value",
    description: "Prints values to console and returns the first argument for chaining.",
    params: [
      { name: "value", type: "any", description: "The value to print and return" },
      { name: "...values", type: "any", description: "Additional values to print" },
    ],
    returns: { type: "any", description: "Returns the first argument" },
    examples: [
      '42 /> print  -- prints 42 and returns 42',
      '"Hello" /> print /> length  -- prints "Hello" then returns 5',
    ],
  },

  // Math functions
  sqrt: {
    name: "sqrt",
    signature: "sqrt(number) -> Number",
    description: "Returns the square root of a number.",
    params: [{ name: "number", type: "Number", description: "The number to get the square root of" }],
    returns: { type: "Number", description: "The square root" },
    examples: ["16 /> sqrt  -- 4", "2 /> sqrt   -- 1.414..."],
  },
  abs: {
    name: "abs",
    signature: "abs(number) -> Number",
    description: "Returns the absolute value of a number.",
    params: [{ name: "number", type: "Number", description: "The input number" }],
    returns: { type: "Number", description: "The absolute value" },
    examples: ["-5 /> abs  -- 5", "5 /> abs   -- 5"],
  },
  floor: {
    name: "floor",
    signature: "floor(number) -> Int",
    description: "Rounds a number down to the nearest integer.",
    params: [{ name: "number", type: "Number", description: "The number to floor" }],
    returns: { type: "Int", description: "The floored integer" },
    examples: ["3.7 /> floor  -- 3", "-3.7 /> floor -- -4"],
  },
  ceil: {
    name: "ceil",
    signature: "ceil(number) -> Int",
    description: "Rounds a number up to the nearest integer.",
    params: [{ name: "number", type: "Number", description: "The number to ceil" }],
    returns: { type: "Int", description: "The ceiled integer" },
    examples: ["3.2 /> ceil  -- 4", "-3.2 /> ceil -- -3"],
  },
  round: {
    name: "round",
    signature: "round(number) -> Int",
    description: "Rounds a number to the nearest integer.",
    params: [{ name: "number", type: "Number", description: "The number to round" }],
    returns: { type: "Int", description: "The rounded integer" },
    examples: ["3.5 /> round  -- 4", "3.4 /> round  -- 3"],
  },
  min: {
    name: "min",
    signature: "min(a, b, ...rest) -> Number",
    description: "Returns the minimum of the given numbers.",
    params: [
      { name: "a", type: "Number", description: "First number" },
      { name: "b", type: "Number", description: "Second number" },
      { name: "...rest", type: "Number", description: "Additional numbers" },
    ],
    returns: { type: "Number", description: "The minimum value" },
    examples: ["min(3, 1, 4)  -- 1", "5 /> min(3)   -- 3"],
  },
  max: {
    name: "max",
    signature: "max(a, b, ...rest) -> Number",
    description: "Returns the maximum of the given numbers.",
    params: [
      { name: "a", type: "Number", description: "First number" },
      { name: "b", type: "Number", description: "Second number" },
      { name: "...rest", type: "Number", description: "Additional numbers" },
    ],
    returns: { type: "Number", description: "The maximum value" },
    examples: ["max(3, 1, 4)  -- 4", "5 /> max(3)   -- 5"],
  },

  // Random functions
  random: {
    name: "random",
    signature: "random() -> Number",
    description: "Returns a random float in [0, 1).",
    params: [],
    returns: { type: "Number", description: "A random number between 0 (inclusive) and 1 (exclusive)" },
    examples: ["random()  -- 0.7342..."],
  },
  randomInt: {
    name: "randomInt",
    signature: "randomInt(max) -> Int | randomInt(min, max) -> Int",
    description: "Returns a random integer. With one arg: [0, max). With two args: [min, max).",
    params: [
      { name: "min", type: "Int", description: "Minimum value (inclusive), defaults to 0" },
      { name: "max", type: "Int", description: "Maximum value (exclusive)" },
    ],
    returns: { type: "Int", description: "A random integer" },
    examples: ["randomInt(10)     -- 0-9", "randomInt(5, 10)  -- 5-9"],
  },
  randomFloat: {
    name: "randomFloat",
    signature: "randomFloat(max) -> Number | randomFloat(min, max) -> Number",
    description: "Returns a random float. With one arg: [0, max). With two args: [min, max).",
    params: [
      { name: "min", type: "Number", description: "Minimum value (inclusive), defaults to 0" },
      { name: "max", type: "Number", description: "Maximum value (exclusive)" },
    ],
    returns: { type: "Number", description: "A random float" },
    examples: ["randomFloat(10.0)       -- 0.0-9.999...", "randomFloat(5.0, 10.0)  -- 5.0-9.999..."],
  },
  randomChoice: {
    name: "randomChoice",
    signature: "randomChoice(list) -> any",
    description: "Returns a random element from a list.",
    params: [{ name: "list", type: "[any]", description: "The list to choose from" }],
    returns: { type: "any", description: "A random element from the list" },
    examples: ['randomChoice([1, 2, 3])         -- 1, 2, or 3', 'randomChoice(["a", "b", "c"])  -- "a", "b", or "c"'],
  },
  shuffle: {
    name: "shuffle",
    signature: "shuffle(list) -> [any]",
    description: "Returns a shuffled copy of the list (Fisher-Yates algorithm).",
    params: [{ name: "list", type: "[any]", description: "The list to shuffle" }],
    returns: { type: "[any]", description: "A new shuffled list" },
    examples: ["[1, 2, 3, 4, 5] /> shuffle  -- [3, 1, 5, 2, 4] (random order)"],
  },

  // List functions
  length: {
    name: "length",
    signature: "length(list | string) -> Int",
    description: "Returns the length of a list or string.",
    params: [{ name: "list | string", type: "[any] | String", description: "The list or string to measure" }],
    returns: { type: "Int", description: "The length" },
    examples: ["[1, 2, 3] /> length   -- 3", '"hello" /> length    -- 5'],
  },
  head: {
    name: "head",
    signature: "head(list) -> any",
    description: "Returns the first element of a list. Throws if list is empty.",
    params: [{ name: "list", type: "[any]", description: "The list" }],
    returns: { type: "any", description: "The first element" },
    examples: ["[1, 2, 3] /> head  -- 1"],
  },
  tail: {
    name: "tail",
    signature: "tail(list) -> [any]",
    description: "Returns all elements except the first.",
    params: [{ name: "list", type: "[any]", description: "The list" }],
    returns: { type: "[any]", description: "The list without its first element" },
    examples: ["[1, 2, 3] /> tail  -- [2, 3]"],
  },
  push: {
    name: "push",
    signature: "push(list, item) -> [any]",
    description: "Returns a new list with the item appended.",
    params: [
      { name: "list", type: "[any]", description: "The original list" },
      { name: "item", type: "any", description: "The item to append" },
    ],
    returns: { type: "[any]", description: "A new list with the item added" },
    examples: ["[1, 2] /> push(3)  -- [1, 2, 3]"],
  },
  concat: {
    name: "concat",
    signature: "concat(list1, list2) -> [any]",
    description: "Concatenates two lists.",
    params: [
      { name: "list1", type: "[any]", description: "First list" },
      { name: "list2", type: "[any]", description: "Second list" },
    ],
    returns: { type: "[any]", description: "The concatenated list" },
    examples: ["[1, 2] /> concat([3, 4])  -- [1, 2, 3, 4]"],
  },
  reverse: {
    name: "reverse",
    signature: "reverse(list) -> [any]",
    description: "Returns a reversed copy of the list.",
    params: [{ name: "list", type: "[any]", description: "The list to reverse" }],
    returns: { type: "[any]", description: "A new reversed list" },
    examples: ["[1, 2, 3] /> reverse  -- [3, 2, 1]"],
  },
  isEmpty: {
    name: "isEmpty",
    signature: "isEmpty(list | string) -> Bool",
    description: "Checks if a list or string is empty.",
    params: [{ name: "list | string", type: "[any] | String", description: "The value to check" }],
    returns: { type: "Bool", description: "True if empty" },
    examples: ["[] /> isEmpty      -- true", '[1] /> isEmpty     -- false', '"" /> isEmpty      -- true'],
  },
  fst: {
    name: "fst",
    signature: "fst(tuple | list) -> any",
    description: "Returns the first element of a tuple or list.",
    params: [{ name: "tuple | list", type: "Tuple | [any]", description: "The tuple or list" }],
    returns: { type: "any", description: "The first element" },
    examples: ["(1, 2) /> fst     -- 1", "[1, 2, 3] /> fst  -- 1"],
  },
  snd: {
    name: "snd",
    signature: "snd(tuple | list) -> any",
    description: "Returns the second element of a tuple or list.",
    params: [{ name: "tuple | list", type: "Tuple | [any]", description: "The tuple or list" }],
    returns: { type: "any", description: "The second element" },
    examples: ["(1, 2) /> snd     -- 2", "[1, 2, 3] /> snd  -- 2"],
  },
  zip: {
    name: "zip",
    signature: "zip(lists) -> [[any]]",
    description: "Zips multiple lists into a list of tuples.",
    params: [{ name: "lists", type: "[[any]]", description: "A list of lists to zip" }],
    returns: { type: "[[any]]", description: "List of zipped elements" },
    examples: ["zip([[1, 2], [3, 4]])  -- [[1, 3], [2, 4]]"],
  },
  range: {
    name: "range",
    signature: "range(end) -> [Int] | range(start, end) -> [Int]",
    description: "Creates a list of integers from start (default 0) to end (exclusive).",
    params: [
      { name: "start", type: "Int", description: "Starting value (default 0)" },
      { name: "end", type: "Int", description: "Ending value (exclusive)" },
    ],
    returns: { type: "[Int]", description: "List of integers" },
    examples: ["range(5)     -- [0, 1, 2, 3, 4]", "range(2, 5)  -- [2, 3, 4]"],
  },
  iterations: {
    name: "iterations",
    signature: "iterations(count) -> [Int]",
    description: "Creates a list of integers from 0 to count-1.",
    params: [{ name: "count", type: "Int", description: "Number of iterations" }],
    returns: { type: "[Int]", description: "List of integers" },
    examples: ["iterations(3)  -- [0, 1, 2]"],
  },
  take: {
    name: "take",
    signature: "take(list, n) -> [any]",
    description: "Returns the first n elements of a list.",
    params: [
      { name: "list", type: "[any]", description: "The list" },
      { name: "n", type: "Int", description: "Number of elements to take" },
    ],
    returns: { type: "[any]", description: "The first n elements" },
    examples: ["[1, 2, 3, 4, 5] /> take(3)  -- [1, 2, 3]"],
  },
  at: {
    name: "at",
    signature: "at(list, index) -> any",
    description: "Returns the element at the given index. Throws if out of bounds.",
    params: [
      { name: "list", type: "[any]", description: "The list" },
      { name: "index", type: "Int", description: "The index (0-based)" },
    ],
    returns: { type: "any", description: "The element at the index" },
    examples: ["[10, 20, 30] /> at(1)  -- 20"],
  },

  // Higher-order functions
  map: {
    name: "map",
    signature: "map(list, fn) -> [any]",
    description: "Applies a function to each element of a list. Callback receives (element, index).",
    params: [
      { name: "list", type: "[any]", description: "The list to map over" },
      { name: "fn", type: "(any, Int) -> any", description: "The transformation function" },
    ],
    returns: { type: "[any]", description: "A new list with transformed elements" },
    examples: [
      "[1, 2, 3] /> map((x) -> x * 2)      -- [2, 4, 6]",
      '["a", "b"] /> map((x, i) -> `{i}:{x}`)  -- ["0:a", "1:b"]',
    ],
  },
  filter: {
    name: "filter",
    signature: "filter(list, predicate) -> [any]",
    description: "Keeps elements that satisfy the predicate. Callback receives (element, index).",
    params: [
      { name: "list", type: "[any]", description: "The list to filter" },
      { name: "predicate", type: "(any, Int) -> Bool", description: "The filter function" },
    ],
    returns: { type: "[any]", description: "A new filtered list" },
    examples: [
      "[1, 2, 3, 4] /> filter((x) -> x > 2)  -- [3, 4]",
      "[10, 20, 30] /> filter((_, i) -> i < 2)  -- [10, 20]",
    ],
  },
  reduce: {
    name: "reduce",
    signature: "reduce(list, initial, fn) -> any",
    description: "Reduces a list to a single value. Callback receives (accumulator, element, index).",
    params: [
      { name: "list", type: "[any]", description: "The list to reduce" },
      { name: "initial", type: "any", description: "The initial accumulator value" },
      { name: "fn", type: "(any, any, Int) -> any", description: "The reducer function" },
    ],
    returns: { type: "any", description: "The final accumulated value" },
    examples: [
      "[1, 2, 3] /> reduce(0, (acc, x) -> acc + x)  -- 6",
      '["a", "b"] /> reduce("", (acc, x, i) -> acc ++ `{i}:{x} `)  -- "0:a 1:b "',
    ],
  },
  partition: {
    name: "partition",
    signature: "partition(list, predicate) -> [[any], [any]]",
    description: "Splits a list into two: elements matching predicate and those that don't.",
    params: [
      { name: "list", type: "[any]", description: "The list to partition" },
      { name: "predicate", type: "(any) -> Bool", description: "The partition function" },
    ],
    returns: { type: "[[any], [any]]", description: "[matching, non-matching] lists" },
    examples: ["[1, 2, 3, 4] /> partition((x) -> x > 2)  -- [[3, 4], [1, 2]]"],
  },

  // String functions
  toString: {
    name: "toString",
    signature: "toString(value) -> String",
    description: "Converts a value to its string representation.",
    params: [{ name: "value", type: "any", description: "The value to convert" }],
    returns: { type: "String", description: "String representation" },
    examples: ["42 /> toString     -- \"42\"", "[1, 2] /> toString -- \"[1, 2]\""],
  },
  split: {
    name: "split",
    signature: "split(string, delimiter) -> [String]",
    description: "Splits a string by the delimiter.",
    params: [
      { name: "string", type: "String", description: "The string to split" },
      { name: "delimiter", type: "String", description: "The delimiter" },
    ],
    returns: { type: "[String]", description: "List of substrings" },
    examples: ['"a,b,c" /> split(",")  -- ["a", "b", "c"]'],
  },
  lines: {
    name: "lines",
    signature: "lines(string) -> [String]",
    description: "Splits a string by newlines.",
    params: [{ name: "string", type: "String", description: "The string to split" }],
    returns: { type: "[String]", description: "List of lines" },
    examples: ['"a\\nb\\nc" /> lines  -- ["a", "b", "c"]'],
  },
  charAt: {
    name: "charAt",
    signature: "charAt(string, index) -> String",
    description: "Returns the character at the given index.",
    params: [
      { name: "string", type: "String", description: "The string" },
      { name: "index", type: "Int", description: "The index" },
    ],
    returns: { type: "String", description: "The character (empty string if out of bounds)" },
    examples: ['"hello" /> charAt(1)  -- "e"'],
  },
  join: {
    name: "join",
    signature: "join(list, delimiter?) -> String",
    description: "Joins a list into a string with an optional delimiter.",
    params: [
      { name: "list", type: "[any]", description: "The list to join" },
      { name: "delimiter", type: "String", description: "The delimiter (default: empty string)" },
    ],
    returns: { type: "String", description: "The joined string" },
    examples: ['["a", "b", "c"] /> join(",")  -- "a,b,c"', '[1, 2, 3] /> join()           -- "123"'],
  },
  padEnd: {
    name: "padEnd",
    signature: "padEnd(string, length, char?) -> String",
    description: "Pads the string at the end to reach the target length.",
    params: [
      { name: "string", type: "String", description: "The string to pad" },
      { name: "length", type: "Int", description: "Target length" },
      { name: "char", type: "String", description: "Pad character (default: space)" },
    ],
    returns: { type: "String", description: "The padded string" },
    examples: ['"hi" /> padEnd(5)        -- "hi   "', '"hi" /> padEnd(5, ".")   -- "hi..."'],
  },
  padStart: {
    name: "padStart",
    signature: "padStart(string, length, char?) -> String",
    description: "Pads the string at the start to reach the target length.",
    params: [
      { name: "string", type: "String", description: "The string to pad" },
      { name: "length", type: "Int", description: "Target length" },
      { name: "char", type: "String", description: "Pad character (default: space)" },
    ],
    returns: { type: "String", description: "The padded string" },
    examples: ['"5" /> padStart(3, "0")  -- "005"'],
  },
  trim: {
    name: "trim",
    signature: "trim(string) -> String",
    description: "Removes whitespace from both ends of a string.",
    params: [{ name: "string", type: "String", description: "The string to trim" }],
    returns: { type: "String", description: "The trimmed string" },
    examples: ['"  hello  " /> trim  -- "hello"'],
  },
  trimEnd: {
    name: "trimEnd",
    signature: "trimEnd(string) -> String",
    description: "Removes whitespace from the end of a string.",
    params: [{ name: "string", type: "String", description: "The string to trim" }],
    returns: { type: "String", description: "The trimmed string" },
    examples: ['"hello  " /> trimEnd  -- "hello"'],
  },
  indexOf: {
    name: "indexOf",
    signature: "indexOf(string, search) -> Int",
    description: "Returns the index of the first occurrence of search, or -1 if not found.",
    params: [
      { name: "string", type: "String", description: "The string to search in" },
      { name: "search", type: "String", description: "The substring to find" },
    ],
    returns: { type: "Int", description: "The index or -1" },
    examples: ['"hello" /> indexOf("ll")  -- 2', '"hello" /> indexOf("x")   -- -1'],
  },
  includes: {
    name: "includes",
    signature: "includes(string | list, search) -> Bool",
    description: "Checks if a string contains a substring or a list contains an element.",
    params: [
      { name: "string | list", type: "String | [any]", description: "The value to search in" },
      { name: "search", type: "any", description: "The value to find" },
    ],
    returns: { type: "Bool", description: "True if found" },
    examples: ['"hello" /> includes("ell")  -- true', "[1, 2, 3] /> includes(2)    -- true"],
  },
  repeat: {
    name: "repeat",
    signature: "repeat(string, count) -> String",
    description: "Repeats a string n times.",
    params: [
      { name: "string", type: "String", description: "The string to repeat" },
      { name: "count", type: "Int", description: "Number of repetitions" },
    ],
    returns: { type: "String", description: "The repeated string" },
    examples: ['"ab" /> repeat(3)  -- "ababab"'],
  },
  slice: {
    name: "slice",
    signature: "slice(string | list, start, end?) -> String | [any]",
    description: "Extracts a portion of a string or list.",
    params: [
      { name: "string | list", type: "String | [any]", description: "The value to slice" },
      { name: "start", type: "Int", description: "Start index" },
      { name: "end", type: "Int", description: "End index (exclusive, optional)" },
    ],
    returns: { type: "String | [any]", description: "The sliced portion" },
    examples: ['"hello" /> slice(1, 4)     -- "ell"', "[1, 2, 3, 4] /> slice(1, 3) -- [2, 3]"],
  },
  chars: {
    name: "chars",
    signature: "chars(string) -> [String]",
    description: "Splits a string into a list of characters.",
    params: [{ name: "string", type: "String", description: "The string to split" }],
    returns: { type: "[String]", description: "List of characters" },
    examples: ['"abc" /> chars  -- ["a", "b", "c"]'],
  },

  // Set operations
  listSet: {
    name: "listSet",
    signature: "listSet(list) -> [any]",
    description: "Creates a list with unique elements (removes duplicates).",
    params: [{ name: "list", type: "[any]", description: "The list to deduplicate" }],
    returns: { type: "[any]", description: "List with unique elements" },
    examples: ["[1, 2, 2, 3, 1] /> listSet  -- [1, 2, 3]"],
  },
  setAdd: {
    name: "setAdd",
    signature: "setAdd(list, item) -> [any]",
    description: "Adds an item to a list if not already present.",
    params: [
      { name: "list", type: "[any]", description: "The list" },
      { name: "item", type: "any", description: "The item to add" },
    ],
    returns: { type: "[any]", description: "New list with item added (if unique)" },
    examples: ["[1, 2] /> setAdd(3)  -- [1, 2, 3]", "[1, 2] /> setAdd(2)  -- [1, 2]"],
  },
  setHas: {
    name: "setHas",
    signature: "setHas(list, item) -> Bool",
    description: "Checks if an item exists in a list.",
    params: [
      { name: "list", type: "[any]", description: "The list" },
      { name: "item", type: "any", description: "The item to check" },
    ],
    returns: { type: "Bool", description: "True if item exists" },
    examples: ["[1, 2, 3] /> setHas(2)  -- true", "[1, 2, 3] /> setHas(5)  -- false"],
  },

  // Async functions
  delay: {
    name: "delay",
    signature: "delay(ms, value?) -> Promise",
    description: "Returns a promise that resolves after ms milliseconds with the optional value.",
    params: [
      { name: "ms", type: "Int", description: "Milliseconds to wait" },
      { name: "value", type: "any", description: "Value to resolve with (optional)" },
    ],
    returns: { type: "Promise", description: "A promise that resolves after the delay" },
    examples: ["await delay(1000)  -- waits 1 second", 'await delay(500, "done")  -- waits 500ms, returns "done"'],
  },
  parallel: {
    name: "parallel",
    signature: "parallel(list, fn, options?) -> Promise<[any]>",
    description: "Executes a function on each list element concurrently. Callback receives (element, index).",
    params: [
      { name: "list", type: "[any]", description: "The list to process" },
      { name: "fn", type: "(any, Int) -> any", description: "The async function to apply" },
      { name: "options", type: "{ limit?: Int }", description: "Optional concurrency limit" },
    ],
    returns: { type: "Promise<[any]>", description: "Promise resolving to results" },
    examples: [
      "await parallel([1, 2, 3], (x) -> delay(100, x * 2))  -- [2, 4, 6]",
      "await parallel(urls, fetch, { limit: 5 })  -- max 5 concurrent requests",
    ],
  },
  race: {
    name: "race",
    signature: "race(thunks) -> Promise",
    description: "Returns the result of the first promise to resolve.",
    params: [{ name: "thunks", type: "[() -> Promise]", description: "List of functions returning promises" }],
    returns: { type: "Promise", description: "The first resolved value" },
    examples: ["await race([() -> delay(100, 1), () -> delay(50, 2)])  -- 2"],
  },
  then: {
    name: "then",
    signature: "then(promise, fn) -> Promise",
    description: "Chains a transformation on a promise.",
    params: [
      { name: "promise", type: "Promise", description: "The promise to chain" },
      { name: "fn", type: "(any) -> any", description: "The transformation function" },
    ],
    returns: { type: "Promise", description: "A new promise with the transformed value" },
    examples: ["delay(100, 5) /> then((x) -> x * 2)  -- Promise resolving to 10"],
  },

  // I/O functions
  readFile: {
    name: "readFile",
    signature: "readFile(path) -> Promise<String>",
    description: "Reads a file asynchronously and returns its contents as a string.",
    params: [{ name: "path", type: "String", description: "The file path" }],
    returns: { type: "Promise<String>", description: "The file contents" },
    examples: ['let content = await readFile("./data.txt")'],
  },
  writeFile: {
    name: "writeFile",
    signature: "writeFile(path, content) -> Promise<Bool>",
    description: "Writes content to a file asynchronously.",
    params: [
      { name: "path", type: "String", description: "The file path" },
      { name: "content", type: "String", description: "The content to write" },
    ],
    returns: { type: "Promise<Bool>", description: "True on success" },
    examples: ['await writeFile("./output.txt", "Hello!")'],
  },
  appendFile: {
    name: "appendFile",
    signature: "appendFile(path, content) -> Promise<Bool>",
    description: "Appends content to a file asynchronously.",
    params: [
      { name: "path", type: "String", description: "The file path" },
      { name: "content", type: "String", description: "The content to append" },
    ],
    returns: { type: "Promise<Bool>", description: "True on success" },
    examples: ['await appendFile("./log.txt", "New line\\n")'],
  },
  fileExists: {
    name: "fileExists",
    signature: "fileExists(path) -> Promise<Bool>",
    description: "Checks if a file exists asynchronously.",
    params: [{ name: "path", type: "String", description: "The file path" }],
    returns: { type: "Promise<Bool>", description: "True if file exists" },
    examples: ['let exists = await fileExists("./config.json")'],
  },
  deleteFile: {
    name: "deleteFile",
    signature: "deleteFile(path) -> Promise<Bool>",
    description: "Deletes a file asynchronously.",
    params: [{ name: "path", type: "String", description: "The file path" }],
    returns: { type: "Promise<Bool>", description: "True on success" },
    examples: ['await deleteFile("./temp.txt")'],
  },
  readDir: {
    name: "readDir",
    signature: "readDir(path) -> Promise<[String]>",
    description: "Reads a directory and returns a list of filenames.",
    params: [{ name: "path", type: "String", description: "The directory path" }],
    returns: { type: "Promise<[String]>", description: "List of filenames" },
    examples: ['let files = await readDir("./src")'],
  },
  fetch: {
    name: "fetch",
    signature: "fetch(url, options?) -> Promise<Response>",
    description: "Makes an HTTP request asynchronously.",
    params: [
      { name: "url", type: "String", description: "The URL to fetch" },
      { name: "options", type: "{ method?: String, headers?: Record, body?: any }", description: "Request options" },
    ],
    returns: { type: "Promise<Response>", description: "Response with status, ok, body, headers" },
    examples: [
      'let response = await fetch("https://api.example.com/data")',
      'let response = await fetch("https://api.example.com/data", { method: "POST", body: { name: "Max" } })',
    ],
  },

  // ASCII diagram
  breakPieces: {
    name: "breakPieces",
    signature: "breakPieces(shape) -> [String]",
    description: "Parses an ASCII diagram into minimal closed pieces.",
    params: [{ name: "shape", type: "String", description: "ASCII art diagram" }],
    returns: { type: "[String]", description: "List of individual pieces" },
    examples: ["breakPieces(\"+--+\\n|  |\\n+--+\")"],
  },
};

/**
 * Get all builtin function names
 */
export function getBuiltinNames(): string[] {
  return Object.keys(BUILTIN_DOCS);
}

/**
 * Get documentation for a builtin function
 */
export function getBuiltinDoc(name: string): BuiltinDoc | undefined {
  return BUILTIN_DOCS[name];
}

/**
 * Check if a name is a builtin function
 */
export function isBuiltin(name: string): boolean {
  return name in BUILTIN_DOCS || name === "__identity__";
}

---
sidebar_position: 1
---

# Lea for JavaScript Developers

If you know JavaScript, you already know more Lea than you think! This guide maps JavaScript concepts to their Lea equivalents.

## Quick Reference

| JavaScript | Lea |
|------------|-----|
| `const x = 5` | `let x = 5` |
| `let y = 5` | `maybe y = 5` |
| `x => x * 2` | `(x) -> x * 2` |
| `[1,2,3].map(x => x * 2)` | `[1,2,3] /> map((x) -> x * 2)` |
| `console.log(x)` | `x /> print` |
| `// comment` | `-- comment` |
| `{ name: "Alice" }` | `{ name: "Alice" }` |
| `obj.property` | `obj.property` |
| `await fetch(url)` | `await fetch(url)` |

## Variables

```javascript
// JavaScript
const name = "Alice";      // immutable binding
let counter = 0;           // mutable binding
counter = 1;               // reassignment
```

```lea
-- Lea
let name = "Alice"         -- immutable binding
maybe counter = 0          -- mutable binding
counter = 1                -- reassignment
```

Note: Lea uses `let` for immutable (like JS `const`) and `maybe` for mutable (like JS `let`).

## Functions

```javascript
// JavaScript
const double = x => x * 2;
const add = (a, b) => a + b;
const greet = (name = "World") => `Hello ${name}!`;
```

```lea
-- Lea
let double = (x) -> x * 2
let add = (a, b) -> a + b
let greet = (name = "World") -> `Hello {name}!`
```

Key differences:
- Arrow syntax: `->` instead of `=>`
- Template strings use `{expr}` instead of `${expr}`
- Parentheses always required around parameters

### Multi-line Functions

```javascript
// JavaScript
const process = (x) => {
  const y = x * 2;
  const z = y + 1;
  return z;
};
```

```lea
-- Lea (indentation-based)
let process = (x) ->
  let y = x * 2
  let z = y + 1
  z

-- Or with explicit return
let process = (x) ->
  let y = x * 2
  y > 100 ? return 100 : 0
  y + 1
```

## The Pipe Operator

This is the biggest paradigm shift! Instead of nested function calls or method chaining, Lea uses pipes:

```javascript
// JavaScript - nested calls
console.log(Math.sqrt(Math.abs(-16)));

// JavaScript - method chaining (where available)
[-16].map(Math.abs).map(Math.sqrt).forEach(console.log);
```

```lea
-- Lea - pipes (read left to right)
-16 /> abs /> sqrt /> print
```

### Passing Arguments Through Pipes

```javascript
// JavaScript
const add = (a, b) => a + b;
add(5, 3);  // 8
```

```lea
-- Lea - piped value becomes first argument
5 /> add(3)    -- becomes add(5, 3) = 8

-- Or use 'input' placeholder for different position
5 /> add(3, input)    -- becomes add(3, 5) = 8
```

## Array Methods

```javascript
// JavaScript
const nums = [1, 2, 3, 4, 5];
nums.map(x => x * 2);           // [2, 4, 6, 8, 10]
nums.filter(x => x > 2);        // [3, 4, 5]
nums.reduce((acc, x) => acc + x, 0);  // 15
```

```lea
-- Lea (same operations, piped)
let nums = [1, 2, 3, 4, 5]
nums /> map((x) -> x * 2)                  -- [2, 4, 6, 8, 10]
nums /> filter((x) -> x > 2)               -- [3, 4, 5]
nums /> reduce(0, (acc, x) -> acc + x)     -- 15
```

Note: In Lea's `reduce`, the initial value comes first!

### Chaining Operations

```javascript
// JavaScript
[1, 2, 3, 4, 5]
  .filter(x => x > 2)
  .map(x => x * 2)
  .reduce((acc, x) => acc + x, 0);
```

```lea
-- Lea
[1, 2, 3, 4, 5]
  /> filter((x) -> x > 2)
  /> map((x) -> x * 2)
  /> reduce(0, (acc, x) -> acc + x)
```

### Index Access in Callbacks

```javascript
// JavaScript
['a', 'b', 'c'].map((x, i) => `${i}: ${x}`);
// ['0: a', '1: b', '2: c']
```

```lea
-- Lea
["a", "b", "c"] /> map((x, i) -> `{i}: {x}`)
-- ["0: a", "1: b", "2: c"]
```

## Objects (Records)

```javascript
// JavaScript
const user = { name: "Alice", age: 30 };
user.name;  // "Alice"

// Destructuring
const { name, age } = user;

// Spread
const updated = { ...user, age: 31 };
```

```lea
-- Lea (nearly identical!)
let user = { name: "Alice", age: 30 }
user.name  -- "Alice"

-- Destructuring
let { name, age } = user

-- Spread
let updated = { ...user, age: 31 }
```

## Conditionals

```javascript
// JavaScript ternary
const result = x > 0 ? "positive" : "non-positive";

// JavaScript if/else (statement, not expression)
let result;
if (x > 0) {
  result = "positive";
} else {
  result = "non-positive";
}
```

```lea
-- Lea (ternary only - everything is an expression)
let result = x > 0 ? "positive" : "non-positive"

-- Pattern matching for complex cases
let result = match x
  | if input > 0 -> "positive"
  | if input < 0 -> "negative"
  | "zero"
```

## Async/Await

```javascript
// JavaScript
async function fetchData(url) {
  const response = await fetch(url);
  return response.json();
}

const data = await fetchData("https://api.example.com");
```

```lea
-- Lea
let fetchData = (url) -> fetch(url) #async
let data = await fetchData("https://api.example.com")
```

### Promise.all Equivalent

```javascript
// JavaScript
const results = await Promise.all([
  fetch(url1),
  fetch(url2),
  fetch(url3)
]);
```

```lea
-- Lea
let results = [url1, url2, url3] /> parallel((url) -> fetch(url))
```

## Spread Operator

```javascript
// JavaScript
const a = [1, 2];
const b = [3, 4];
const combined = [...a, ...b];  // [1, 2, 3, 4]
```

```lea
-- Lea (identical!)
let a = [1, 2]
let b = [3, 4]
let combined = [...a, ...b]  -- [1, 2, 3, 4]
```

## String Operations

```javascript
// JavaScript
const greeting = `Hello ${name}!`;
const combined = "Hello" + " " + "World";
```

```lea
-- Lea
let greeting = `Hello {name}!`           -- template string
let combined = "Hello" ++ " " ++ "World" -- ++ for concat
```

Note: Lea uses `++` for string concatenation, not `+`.

## Decorators

Lea has built-in decorators (JavaScript has proposed decorators, but Lea's are simpler):

```javascript
// JavaScript (proposed/experimental)
@memoize
function fib(n) {
  return n <= 1 ? n : fib(n - 1) + fib(n - 2);
}
```

```lea
-- Lea (trailing decorators)
let fib = (n) -> n <= 1 ? n : fib(n - 1) + fib(n - 2) #memo
```

Available decorators:
- `#log` - log inputs/outputs
- `#memo` - memoization
- `#time` - timing
- `#retry(n)` - retry on failure
- `#validate` - runtime type checking

## Type Annotations

```javascript
// TypeScript
function add(a: number, b: number): number {
  return a + b;
}
```

```lea
-- Lea (trailing type syntax)
let add = (a, b) -> a + b :: (Int, Int) :> Int
```

## What Lea Doesn't Have

- `class` - use records and functions
- `this` - use closures or context system
- `for`/`while` loops - use `map`, `filter`, `reduce`, recursion
- `null`/`undefined` distinction - just `null`
- `===` vs `==` - just `==`
- Semicolons - not needed
- `var` - doesn't exist

## Lea-Specific Features

### Parallel Pipes

```lea
-- Fan out to multiple functions, fan in to combine
10 \> addOne \> double /> combine
-- Runs addOne(10) and double(10) concurrently
```

### First-Class Pipelines

```lea
-- Store a pipeline as a value
let process = /> filter((x) -> x > 0) /> map((x) -> x * 2)

-- Apply it
[1, -2, 3] /> process  -- [2, 6]
```

### Reversible Functions

```lea
-- Define forward and reverse
let double = (x) -> x * 2
and double = (x) <- x / 2

5 /> double   -- 10 (forward)
10 </ double  -- 5  (reverse)
```

### Context System (like React Context)

```lea
context Logger = { log: (msg) -> print(msg) }

let greet = (name) ->
  @Logger
  Logger.log("Hello " ++ name)
```

## Migration Tips

1. **Think in pipes**: Instead of `f(g(h(x)))`, write `x /> h /> g /> f`
2. **Everything is an expression**: No statements, everything returns a value
3. **Immutable by default**: Use `let` for most things, `maybe` only when needed
4. **Use pattern matching**: Instead of if/else chains, use `match`
5. **Leverage decorators**: `#memo`, `#log`, `#time` are your friends

Happy coding!

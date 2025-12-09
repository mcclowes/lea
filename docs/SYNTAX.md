# Lea Syntax Guide

A comprehensive guide to Lea's syntax.

## Comments

```lea
-- Single line comment
```

## Bindings

```lea
let x = 10              -- Immutable binding
maybe counter = 0       -- Mutable binding
counter = 5             -- Reassign mutable binding
```

## Primitive Types

```lea
42                      -- Number (Int)
3.14                    -- Number (Float)
"hello"                 -- String
true                    -- Boolean
false                   -- Boolean
```

## Strings

### Concatenation

The `++` operator concatenates strings with automatic type coercion:

```lea
"Hello" ++ " World"     -- "Hello World"
"The answer is " ++ 42  -- "The answer is 42"
"Done: " ++ true        -- "Done: true"
```

### Template Strings

Use backticks with `{expr}` for interpolation:

```lea
let name = "World"
`Hello {name}!`         -- "Hello World!"
`Sum: {10 + 20}`        -- "Sum: 30"
`Items: {[1, 2, 3]}`    -- "Items: [1, 2, 3]"
```

## Lists

```lea
[1, 2, 3]
["a", "b", "c"]
[[1, 2], [3, 4]]        -- Nested lists

-- Multi-line (trailing commas allowed)
let items = [
  1,
  2,
  3,
]
```

## Tuples

Fixed-size immutable collections:

```lea
let point = (10, 20)
let pair = (1, "hello")     -- Mixed types allowed
fst(point)                  -- 10
snd(point)                  -- 20
```

## Records

```lea
let user = { name: "Max", age: 99 }
user.name                   -- "Max"

-- Multi-line (trailing commas allowed)
let config = {
  host: "localhost",
  port: 8080,
}
```

## Destructuring

### Record Destructuring

```lea
let user = { name: "Alice", age: 99 }
let { name, age } = user    -- Extracts name and age
```

### Tuple/List Destructuring

```lea
let point = (10, 20)
let (x, y) = point          -- x=10, y=20

let (first, second) = [1, 2, 3]  -- Works with lists too
```

## Spread Operator

### In Lists

```lea
let a = [1, 2, 3]
let b = [4, 5, 6]
let combined = [...a, ...b]     -- [1, 2, 3, 4, 5, 6]
```

### In Records

```lea
let base = { x: 1, y: 2 }
let extended = { ...base, z: 3 }    -- { x: 1, y: 2, z: 3 }
let updated = { ...base, y: 20 }    -- { x: 1, y: 20 }
```

## Functions

### Basic Syntax

```lea
let double = (x) -> x * 2
let add = (a, b) -> a + b
```

### Multi-Statement Bodies

```lea
let process = (x) ->
  let y = x * 2
  let z = y + 1
  z
```

### Default Parameters

```lea
let greet = (name, greeting = "Hello") -> greeting ++ " " ++ name
greet("World")              -- "Hello World"
greet("World", "Hi")        -- "Hi World"
```

### Ignored Parameters

```lea
let ignoreSecond = (x, _) -> x
```

### Type Annotations

```lea
-- Single parameter
let double = (x) -> x * 2 :: Int :> Int

-- Multiple parameters
let add = (a, b) -> a + b :: (Int, Int) :> Int

-- Multi-line functions
let greet = (name) -> :: String :> String
  "Hello " ++ name

-- Optional types
let maybe = (x) -> x :: ?Int :> ?Int

-- List types
let sumList = (nums) -> reduce(nums, 0, (acc, x) -> acc + x) :: [Int] :> Int
```

### Runtime Type Validation

Use `#validate` decorator for explicit validation:

```lea
let safe = (x) -> x * 2 :: Int :> Int #validate
```

### Strict Mode

Enable automatic type validation for all typed functions with `#strict` pragma or CLI flag:

```lea
#strict

-- All typed functions are now validated at runtime
let add = (a, b) -> a + b :: (Int, Int) :> Int
add(5, 10)        -- OK
add("a", "b")     -- Error: Argument 'a' expected Int, got string
```

Or use the CLI flag:

```bash
npm run lea file.lea --strict
npm run repl -- --strict
```

### Function Overloading

Use `and` to add overloads:

```lea
let add = (a, b) -> a + b :: (Int, Int) :> Int
and add = (a, b) -> a ++ b :: (String, String) :> String

add(1, 2)           -- 3 (Int version)
add("a", "b")       -- "ab" (String version)
```

### Early Return

```lea
let clamp = (x) ->
  let doubled = x * 2
  doubled > 100 ? <- 100 : 0
  doubled + 1
```

## Operators

### Arithmetic

```lea
a + b       -- Addition
a - b       -- Subtraction
a * b       -- Multiplication
a / b       -- Division
a % b       -- Modulo
```

### Comparison

```lea
a == b      -- Equal
a != b      -- Not equal
a < b       -- Less than
a > b       -- Greater than
a <= b      -- Less than or equal
a >= b      -- Greater than or equal
```

### Ternary

```lea
condition ? trueValue : falseValue

-- Multi-line
x > 100
  ? "big"
  : "small"
```

## Pattern Matching

```lea
let describe = (x) -> match x
  | 0 -> "zero"                 -- Match literal
  | 1 -> "one"
  | if _ < 0 -> "negative"      -- Guard with _ as matched value
  | if _ > 100 -> "big"
  | "default"                   -- Default case

-- Using _ in result body
let double = (x) -> match x
  | if _ > 0 -> _ * 2
  | 0
```

## Pipes

### Basic Pipe `/>

```lea
16 /> sqrt                  -- sqrt(16) = 4
5 /> add(3)                 -- add(5, 3) - value becomes first arg
5 /> add(3, _)              -- add(3, 5) - placeholder controls position
```

### Pipe Chains

```lea
[1, 2, 3, 4, 5]
  /> filter((x) -> x > 2)
  /> map((x) -> x * x)
  /> reduce(0, (acc, x) -> acc + x)
```

### Spread Pipe `/>>>`

Maps over each element:

```lea
[1, 2, 3] />>>double                    -- [2, 4, 6]
[1, 2, 3] />>>(x, i) -> x + i           -- [1, 3, 5] (with index)
["a", "b"] />>>(x, i) -> `{i}: {x}`     -- ["0: a", "1: b"]
```

### Parallel Pipe `\>`

See [CONCURRENCY.md](./CONCURRENCY.md) for details.

```lea
value
  \> (x) -> x + 1
  \> (x) -> x * 2
  /> (a, b) -> a + b
```

### Reverse Pipe `</`

For reversible functions:

```lea
let double = (x) -> x * 2
and double = (x) <- x / 2

5 /> double     -- 10 (forward)
10 </ double    -- 5 (reverse)
```

## Pipelines (First-Class)

See [PIPELINES.md](./PIPELINES.md) for details.

```lea
let processNumbers = /> double /> addOne
5 /> processNumbers
```

## Decorators

Applied after function body:

```lea
let logged = (x) -> x * 2 #log #memo #time
let retryable = (x) -> riskyOp(x) #retry(3)
```

See [BUILTINS.md](./BUILTINS.md#decorators) for all available decorators.

## Context System

Dependency injection:

```lea
-- Define with default
context Logger = { log: (msg) -> print("[DEFAULT] " ++ msg) }

-- Override in scope
provide Logger { log: (msg) -> print("[PROD] " ++ msg) }

-- Attach to function
let greet = (name) ->
  @Logger
  Logger.log("Hello " ++ name)
```

## Codeblocks

Collapsible regions (for IDE support):

```lea
{-- Section name --}
let x = 10
let y = 20
{/--}
```

## Async/Await

See [CONCURRENCY.md](./CONCURRENCY.md) for details.

```lea
let fetchData = () -> delay(100) #async
await fetchData() /> print
```

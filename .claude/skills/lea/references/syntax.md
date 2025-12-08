# Lea Syntax Reference

## Comments

```lea
-- This is a comment
```

## Bindings

```lea
let x = 10              -- Immutable
maybe counter = 0       -- Mutable
```

## Functions

```lea
let double = (x) -> x * 2
let add = (a, b) -> a + b
let typed = (x: Int): Int -> x + 1

-- With decorators (trailing, after body)
let logged = (x) -> x * 2 #log #memo #time
let retryable = (x) -> riskyOp(x) #retry(3)

-- Multi-statement bodies (indentation-based)
let process = (x) ->
  let y = x * 2
  let z = y + 1
  z

-- Multi-statement bodies (brace-delimited)
let process2 = (x) -> {
  let y = x * 2
  let z = y + 1
  z
}

-- Type annotations (trailing :: syntax)
let double = (x) -> x * 2 :: Int :> Int
let add = (a, b) -> a + b :: (Int, Int) :> Int

-- Function overloading (same name, different type signatures)
let add = (a, b) -> a + b :: (Int, Int) :> Int
let add = (a, b) -> a ++ b :: (String, String) :> String
add(1, 2)         -- calls Int version: 3
add("a", "b")     -- calls String version: "ab"
```

## Records

```lea
let user = { name: "Max", age: 30 }
user.name /> print           -- "Max"
user.age /> print            -- 30

-- Multi-line records (trailing commas allowed)
let config = {
  host: "localhost",
  port: 8080,
}

-- Nested records
let data = { user: { name: "Max" }, count: 1 }
data.user.name /> print      -- "Max"
```

## Context System

```lea
-- Define context with default value
context Logger = { log: (msg) -> print("[DEFAULT] " ++ msg) }

-- Override context value
provide Logger { log: (msg) -> print("[PROD] " ++ msg) }

-- Use context via @attachment
let greet = (name) ->
  @Logger
  Logger.log("Hello " ++ name)

"World" /> greet  -- prints "[PROD] Hello World"
```

## Async/Await

```lea
-- delay returns a promise
let fetchData = () -> delay(100) #async

-- await unwraps promises
await fetchData() /> print
```

## Pipes

```lea
16 /> sqrt              -- sqrt(16) = 4
5 /> add(3)             -- add(5, 3) - value becomes first arg
5 /> add(3, _)          -- add(3, 5) - placeholder controls position
```

## Spread Pipe

```lea
-- Maps a function over each element of a list
[1, 2, 3] />> double        -- [2, 4, 6]
[1, 2, 3] />> add(10)       -- [11, 12, 13]
[1, 2, 3] />> print         -- prints 1, 2, 3 (returns [1, 2, 3])

-- Works with parallel results
5 \> addOne \> double />> print  -- prints each result individually

-- Works with pipelines
let process = /> double /> addOne
[1, 2, 3] />> process       -- [3, 5, 7]
```

## Lists

```lea
[1, 2, 3] /> map((x) -> x * 2)
[1, 2, 3] /> filter((x) -> x > 1)
[1, 2, 3] /> reduce(0, (acc, x) -> acc + x)

-- Additional list operations
[3, 1, 2] /> reverse        -- [2, 1, 3]
[[1, 2], [3, 4]] /> zip     -- [[1, 3], [2, 4]]
[] /> isEmpty               -- true
[1] /> isEmpty              -- false

-- Multi-line lists (trailing commas allowed)
let items = [
  10,
  20,
  30,
]
```

## Strings

```lea
"Hello" ++ " World"               -- Concatenation
"The answer is " ++ 42            -- Automatic type coercion: "The answer is 42"
"Done: " ++ true                  -- "Done: true"
(100 ++ 200)                      -- "100200" (numbers coerced to strings)
("List: " ++ [1, 2, 3])           -- "List: [1, 2, 3]"
```

Note: The `++` operator automatically converts non-strings to strings.

## Template Strings

```lea
let name = "World"
`Hello {name}!`                   -- "Hello World!"
`Sum: {10 + 20}`                  -- "Sum: 30"
`Items: {[1, 2, 3]}`              -- "Items: [1, 2, 3]"
`User: {user.name}`               -- Access properties in interpolation
`Result: {10 /> double}`          -- Pipe expressions in interpolation
```

Template strings use backticks and `{expr}` for interpolation. Any expression can be embedded and will be automatically converted to a string.

## Codeblocks

```lea
-- Codeblocks group related code with <> and </>
<> -- Section label (optional)
let x = 10
let y = 20
</>

-- Nested codeblocks are allowed
<> -- Outer
<> -- Inner
let z = 30
</>
</>
```

## Ternary Expressions

```lea
-- Single line
let result = condition ? "yes" : "no"

-- Multi-line ternary
let result = condition
  ? "yes"
  : "no"

-- Nested multi-line
let grade = score > 90
  ? "A"
  : score > 80
    ? "B"
    : "C"
```

## Comparison Operators

```lea
x == y    -- Equal
x != y    -- Not equal
x < y     -- Less than
x > y     -- Greater than
x <= y    -- Less than or equal
x >= y    -- Greater than or equal
```

## Pattern Matching

```lea
-- Basic pattern matching against literal values
let describe = (x) -> match x
  | 0 -> "zero"
  | 1 -> "one"
  | 2 -> "two"
  | "other"                       -- default case (no pattern)

-- Guard patterns with _ as matched value
let classify = (x) -> match x
  | if _ < 0 -> "negative"
  | if _ == 0 -> "zero"
  | if _ > 0 -> "positive"
  | "unknown"

-- Using _ in the result body
let doubleIfPositive = (x) -> match x
  | if _ > 0 -> _ * 2
  | 0

-- Match in pipelines
5 /> classify /> print            -- "positive"

-- FizzBuzz example
let fizzbuzz = (n) -> match n
  | if _ % 15 == 0 -> "fizzbuzz"
  | if _ % 3 == 0 -> "fizz"
  | if _ % 5 == 0 -> "buzz"
  | n
```

## Pipelines as First-Class Values

```lea
-- Define a reusable pipeline (starts with />)
let processNumbers = /> double /> addOne
5 /> processNumbers                   -- applies pipeline to 5

-- Pipeline properties
processNumbers.length                 -- 2 (number of stages)
processNumbers.stages                 -- ["double", "addOne"]
processNumbers.visualize()            -- prints ASCII diagram

-- Pipeline composition
let pipeA = /> filter((x) -> x > 0)
let pipeB = /> map((x) -> x * 2)
let combined = /> pipeA /> pipeB      -- compose pipelines

-- Pipeline decorators
let debugPipeline = /> double /> addOne #debug
let profiledPipeline = /> double /> addOne #profile
5 /> debugPipeline                    -- shows step-by-step execution

-- Pipeline algebra
5 /> Pipeline.identity                -- 5 (passes through unchanged)
5 /> Pipeline.empty                   -- 5 (no stages)
pipeA.equals(pipeB)                   -- false (structural comparison)
pipeA.isEmpty()                       -- false
pipeA.first                           -- first stage as function
pipeA.last                            -- last stage as function
pipeA.at(0)                           -- get stage at index
pipeA.prepend(fn)                     -- add stage at start
pipeA.append(fn)                      -- add stage at end
pipeA.reverse()                       -- reverse stage order
pipeA.slice(0, 2)                     -- extract sub-pipeline
pipeA.without(pipeB)                  -- remove stages in pipeB
pipeA.intersection(pipeB)             -- keep only common stages
pipeA.union(pipeB)                    -- combine (deduplicated)
pipeA.concat(pipeB)                   -- concatenate (preserves duplicates)
Pipeline.from([fn1, fn2])             -- create from function list
```

## Reversible Functions

```lea
-- Define forward with -> and reverse with <-
let double = (x) -> x * 2
let double = (x) <- x / 2             -- adds reverse definition

-- Apply forward or reverse
5 /> double                           -- 10 (forward: 5 * 2)
10 </ double                          -- 5  (reverse: 10 / 2)

-- Roundtrip preserves value
5 /> double </ double                 -- 5
```

## Bidirectional Pipelines

```lea
-- Define with </> at start
let transform = </> double </> addTen

-- Forward: apply stages left-to-right using forward functions
5 /> transform                        -- 20 (5 -> 10 -> 20)

-- Reverse: apply stages right-to-left using reverse functions
20 </ transform                       -- 5 (20 -> 10 -> 5)

-- All stages should be reversible functions for reverse to work
```

## Token Types

```
NUMBER, STRING, TEMPLATE_STRING (`...{expr}...`), IDENTIFIER
LET, MAYBE, TRUE, FALSE, AWAIT, CONTEXT, PROVIDE, MATCH, IF
PIPE (/>), SPREAD_PIPE (/>>), PARALLEL_PIPE (\>), ARROW (->), RETURN (<-)
REVERSE_PIPE (</), BIDIRECTIONAL_PIPE (</>), PIPE_CHAR (|)
PLUS, MINUS, STAR, SLASH, PERCENT, CONCAT (++)
EQ (=), EQEQ (==), NEQ (!=), LT, GT, LTE, GTE
DOUBLE_COLON (::), COLON_GT (:>)
LPAREN, RPAREN, LBRACKET, RBRACKET, LBRACE, RBRACE
COMMA, COLON, DOT (.), UNDERSCORE (_), HASH (#), AT (@), QUESTION (?)
CODEBLOCK_OPEN (<>), CODEBLOCK_CLOSE (</>)
NEWLINE, EOF
```

## Parser Precedence (low to high)

1. Ternary (`? :`)
2. Equality (`==`, `!=`)
3. Comparison (`<`, `>`, `<=`, `>=`)
4. Term (`+`, `-`, `++`)
5. Factor (`*`, `/`, `%`)
6. Pipe (`/>`, `/>>`, `\>`, `</`)
7. Unary (`-`)
8. Call (function calls, indexing)
9. Primary (literals, identifiers, grouping, functions)

Note: Pipe operators bind tighter than arithmetic, so `a /> b ++ c` parses as `(a /> b) ++ c`.

# Lea Syntax Reference

## Comments

```lea
-- This is a comment
```

## Bindings

```lea
let x = 10              -- Immutable
let mut counter = 0     -- Mutable
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
```

## Records

```lea
let user = { name: "Max", age: 30 }
user.name /> print           -- "Max"
user.age /> print            -- 30

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

## Lists

```lea
[1, 2, 3] /> map((x) -> x * 2)
[1, 2, 3] /> filter((x) -> x > 1)
[1, 2, 3] /> reduce(0, (acc, x) -> acc + x)
```

## Strings

```lea
"Hello" ++ " World"     -- Concatenation
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

## Token Types

```
NUMBER, STRING, IDENTIFIER
LET, MUT, TRUE, FALSE, AWAIT, CONTEXT, PROVIDE
PIPE (/>), ARROW (->)
PLUS, MINUS, STAR, SLASH, PERCENT, CONCAT (++)
EQ (=), EQEQ (==), NEQ (!=), LT, GT, LTE, GTE
LPAREN, RPAREN, LBRACKET, RBRACKET, LBRACE, RBRACE
COMMA, COLON, DOT (.), UNDERSCORE (_), HASH (#), AT (@)
NEWLINE, EOF
```

## Parser Precedence (low to high)

1. Pipe (`/>`)
2. Equality (`==`, `!=`)
3. Comparison (`<`, `>`, `<=`, `>=`)
4. Term (`+`, `-`, `++`)
5. Factor (`*`, `/`, `%`)
6. Unary (`-`)
7. Call (function calls, indexing)
8. Primary (literals, identifiers, grouping, functions)

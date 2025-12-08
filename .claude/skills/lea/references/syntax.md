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
"Hello" ++ " World"     -- Concatenation
```

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

## Token Types

```
NUMBER, STRING, IDENTIFIER
LET, MUT, TRUE, FALSE, AWAIT, CONTEXT, PROVIDE
PIPE (/>), ARROW (->)
PLUS, MINUS, STAR, SLASH, PERCENT, CONCAT (++)
EQ (=), EQEQ (==), NEQ (!=), LT, GT, LTE, GTE
LPAREN, RPAREN, LBRACKET, RBRACKET, LBRACE, RBRACE
COMMA, COLON, DOT (.), UNDERSCORE (_), HASH (#), AT (@)
CODEBLOCK_OPEN (<>), CODEBLOCK_CLOSE (</>)
NEWLINE, EOF
```

## Parser Precedence (low to high)

1. Ternary (`? :`)
2. Equality (`==`, `!=`)
3. Comparison (`<`, `>`, `<=`, `>=`)
4. Term (`+`, `-`, `++`)
5. Factor (`*`, `/`, `%`)
6. Pipe (`/>`, `\>`)
7. Unary (`-`)
8. Call (function calls, indexing)
9. Primary (literals, identifiers, grouping, functions)

Note: Pipe operators bind tighter than arithmetic, so `a /> b ++ c` parses as `(a /> b) ++ c`.

---
sidebar_position: 1
slug: /
---

# Introduction

Lea is a pipe-oriented functional programming language with a tree-walk interpreter written in TypeScript.

```lea
let numbers = [1, 2, 3, 4, 5]

let sumOfSquares = numbers
  /> filter((x) -> x > 2)
  /> map((x) -> x * x)
  /> reduce(0, (acc, x) -> acc + x)

sumOfSquares /> print  -- 50
```

## Features

Lea provides the following features:

- **Pipes** — Left-to-right data flow with the `/>` operator
- **Functions** — First-class functions with optional type annotations
- **Decorators** — Composable function modifiers (`#log`, `#memo`, `#retry(3)`)
- **Records** — Object literals with member access
- **Contexts** — Dependency injection system
- **Async/await** — Promise-based asynchronous execution

## Quick start

```bash
# Clone and install
git clone https://github.com/mcclowes/lea.git
cd lea
npm install

# Run a file
npm run lea example.lea

# Interactive REPL
npm run repl
```

Or use npx without installing:

```bash
npx lea-lang hello.lea
```

## Syntax overview

### Bindings

```lea
let x = 10              -- Immutable
maybe counter = 0       -- Mutable
```

### Functions

```lea
let double = (x) -> x * 2
let add = (a, b) -> a + b

-- Type annotations (trailing :: syntax)
let typed = (x) -> x * 2 :: Int :> Int

-- Multi-statement bodies
let process = (x) ->
  let y = x * 2
  let z = y + 1
  z
```

### Pipes

```lea
16 /> sqrt              -- sqrt(16) = 4
5 /> add(3)             -- add(5, 3) - value becomes first arg
5 /> add(3, _)          -- add(3, 5) - placeholder controls position

-- Chain operations
[1, 2, 3, 4, 5]
  /> filter((x) -> x > 2)
  /> map((x) -> x * x)
  /> print
```

### Records

```lea
let user = { name: "Max", age: 99 }
user.name /> print      -- "Max"

let nested = { data: { value: 42 } }
nested.data.value /> print
```

### Decorators

Apply modifiers after the function body:

```lea
let logged = (x) -> x * 2 #log
let cached = (x) -> expensiveOp(x) #memo
let resilient = (x) -> riskyOp(x) #retry(3) #timeout(1000)
```

Lea provides the following built-in decorators:

| Decorator | Description |
|-----------|-------------|
| `#log` | Log inputs and outputs |
| `#memo` | Cache results |
| `#time` | Log execution time |
| `#retry(n)` | Retry on failure |
| `#timeout(ms)` | Fail if time limit exceeded |
| `#validate` | Runtime type checking |
| `#pure` | Warn on side effects |
| `#async` | Mark as async |
| `#trace` | Deep call logging |

### Context system

Use contexts for dependency injection:

```lea
-- Define context with default
context Logger = { log: (msg) -> print("[DEFAULT] " ++ msg) }

-- Override in scope
provide Logger { log: (msg) -> print("[PROD] " ++ msg) }

-- Attach to function
let greet = (name) ->
  @Logger
  Logger.log("Hello " ++ name)

"World" /> greet  -- "[PROD] Hello World"
```

### Async/Await

```lea
let fetchData = () -> delay(100) #async
await fetchData() /> print
```

## Architecture

```
Source -> Lexer -> Tokens -> Parser -> AST -> Interpreter -> Result
```

- `src/lexer.ts` - Tokenization
- `src/parser.ts` - Recursive descent parser
- `src/ast.ts` - AST node definitions
- `src/interpreter.ts` - Tree-walk interpreter
- `src/repl.ts` - Interactive REPL

## License

MIT

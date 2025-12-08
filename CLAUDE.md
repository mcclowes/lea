# Lea

Tree-walk interpreter in TypeScript for a pipe-oriented functional language.

## Development Guidelines

After modifying or adding functionality, always update:
1. **Documentation** — `CLAUDE.md` and skill reference docs
2. **Examples** — Add/update files in `examples/`
3. **Tests** — Add/update files in `tests/`

## Syntax

```
-- Comments

-- Immutable binding
let x = 10

-- Mutable binding
let mut counter = 0

-- Pipes (value flows into first argument)
16 /> sqrt
5 /> add(3)          -- becomes add(5, 3)
5 /> add(3, _)       -- placeholder: becomes add(3, 5)

-- Functions (no fn keyword)
let double = (x) -> x * 2
let add = (a, b) -> a + b
let typed = (x: Int): Int -> x + 1

-- Decorators (trailing, after function body)
let logged = (x) -> x * 2 #log #memo #time
let retryable = (x) -> riskyOp(x) #retry(3)

-- Multi-statement function bodies (indentation or braces)
let process = (x) ->
  let y = x * 2
  let z = y + 1
  z

-- Early return (<-)
let clamp = (x) ->
  let doubled = x * 2
  doubled > 100 ? <- 100 : 0
  doubled + 1

-- Records and member access
let user = { name: "Max", age: 30 }
user.name /> print

-- Context system (dependency injection)
context Logger = { log: (msg) -> print("[DEFAULT] " ++ msg) }
provide Logger { log: (msg) -> print("[PROD] " ++ msg) }
let greet = (name) ->
  @Logger
  Logger.log("Hello " ++ name)

-- Async/await
let fetchData = () -> delay(100) #async
await fetchData() /> print

-- Lists
[1, 2, 3] /> map((x) -> x * 2)
[1, 2, 3] /> filter((x) -> x > 1)
[1, 2, 3] /> reduce(0, (acc, x) -> acc + x)

-- String concat
"Hello" ++ " World"

-- Comparison
x == y, x != y, x < y, x > y, x <= y, x >= y
```

## Architecture

```
Source → Lexer → Tokens → Parser → AST → Interpreter → Result
```

### Files

- `src/token.ts` — TokenType enum, Token interface, KEYWORDS map
- `src/lexer.ts` — Lexer class, scanTokens()
- `src/ast.ts` — AST node types (Expr, Stmt, Program), helper constructors
- `src/parser.ts` — Recursive descent parser
- `src/interpreter.ts` — Tree-walk interpreter, Environment class
- `src/repl.ts` — Interactive REPL
- `src/index.ts` — File runner entry point

## Token Types

```
NUMBER, STRING, IDENTIFIER
LET, MUT, TRUE, FALSE, AWAIT, CONTEXT, PROVIDE
PIPE (/>), ARROW (->), RETURN (<-)
PLUS, MINUS, STAR, SLASH, PERCENT, CONCAT (++)
EQ (=), EQEQ (==), NEQ (!=), LT, GT, LTE, GTE
LPAREN, RPAREN, LBRACKET, RBRACKET, LBRACE, RBRACE
COMMA, COLON, DOT (.), UNDERSCORE (_), HASH (#), AT (@)
NEWLINE, EOF
```

## AST Nodes

**Expressions:**
- NumberLiteral, StringLiteral, BooleanLiteral, Identifier
- BinaryExpr, UnaryExpr, PipeExpr, CallExpr
- FunctionExpr (params, attachments, body, decorators)
- ListExpr, IndexExpr, PlaceholderExpr
- RecordExpr, MemberExpr, AwaitExpr
- BlockBody (multi-statement function body)
- ReturnExpr (early return with <-)

**Statements:**
- LetStmt (name, mutable, value)
- ExprStmt (expression)
- ContextDefStmt (name, defaultValue)
- ProvideStmt (contextName, value)

## Parser Precedence (low to high)

1. Pipe (`/>`)
2. Equality (`==`, `!=`)
3. Comparison (`<`, `>`, `<=`, `>=`)
4. Term (`+`, `-`, `++`)
5. Factor (`*`, `/`, `%`)
6. Unary (`-`)
7. Call (function calls, indexing)
8. Primary (literals, identifiers, grouping, functions)

## Interpreter Details

**Environment:** Lexical scoping with parent chain.

**Pipe evaluation:**
- If right side is CallExpr with placeholder `_` in args, substitute piped value there
- Otherwise prepend piped value as first argument
- If right side is just Identifier, call it with piped value as single arg

**Decorators:**
- `#log` — logs inputs/outputs
- `#memo` — caches results by JSON-stringified args
- `#time` — logs execution time
- `#retry(n)` — retry on failure up to n times
- `#timeout(ms)` — fail if exceeds time (async only)
- `#validate` — runtime type checking and null checks
- `#pure` — warn if side effects detected
- `#async` — mark function as async (returns promise)
- `#trace` — deep logging with call depth

**Builtins:**
- `print` (returns first arg for chaining)
- `sqrt`, `abs`, `floor`, `ceil`, `round`, `min`, `max`
- `length`, `head`, `tail`, `push`, `concat`
- `map`, `filter`, `reduce`, `range`, `iterations`
- `delay(ms, value)` — returns promise that resolves after ms
- `parallel(list, fn, opts?)` — concurrent map with optional `{ limit: n }`
- `race(fns)` — returns first promise to resolve
- `then(promise, fn)` — chain promise transformations

**Parallel Pipe Operator:**
```
value \> fn1 \> fn2 /> combine
```
Fan-out to run branches concurrently, fan-in to combine results.

**Context System:**
- `context Name = expr` — define context with default value
- `provide Name expr` — override context value
- `@Name` — attach context to function (inject into scope)

## Usage

```bash
npm run repl              # Interactive REPL
npm run run file.lea      # Run a file
```

## Example Program

```
let numbers = [1, 2, 3, 4, 5]

let sumOfSquares = numbers
  /> filter((x) -> x > 2)
  /> map((x) -> x * x)
  /> reduce(0, (acc, x) -> acc + x)

sumOfSquares /> print
```

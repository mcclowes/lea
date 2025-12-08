# Lea

Tree-walk interpreter in TypeScript for a pipe-oriented functional language.

## Development Guidelines

After modifying or adding functionality, always update:
1. **Documentation** — `CLAUDE.md` and skill reference docs
2. **Examples** — Add/update files in `examples/`
3. **Tests** — Add/update files in `tests/`
4. **Syntax highlighting** - Update the syntax highlighting vscode extension to support this functionality appropriately

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

-- Type annotations (trailing :: syntax)
-- Single-line: body :: Type :> ReturnType
let double = (x) -> x * 2 :: Int :> Int
-- Multiple params: body :: (Type, Type) :> ReturnType
let add = (a, b) -> a + b :: (Int, Int) :> Int
-- Multiline: type signature after arrow
let greet = (name) -> :: String :> String
  "Hello " ++ name
-- Use #validate for runtime type checking
let safe = (x) -> x * 2 :: Int :> Int #validate
-- Supported types: Int, String, Bool, List, Function, Tuple
-- Optional types with ?: ?Int allows null
-- Tuple types: (Int, String) :> (Int, String)
-- Underscore for ignored params
let ignoreSecond = (x, _) -> x

-- Tuples (immutable fixed-size collections)
let point = (10, 20)
let pair = (1, "hello")       -- mixed types allowed
(x, y) /> print               -- prints: (10, 20)

-- Default parameters
let greet = (name, greeting = "Hello") -> greeting ++ " " ++ name
greet("World")                -- uses default: "Hello World"
greet("World", "Hi")          -- overrides: "Hi World"

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

-- Multi-line records and lists (trailing commas allowed)
let config = {
  host: "localhost",
  port: 8080,
}
let items = [
  1,
  2,
  3,
]

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

-- Codeblocks (collapsible regions)
<> -- Section name
let x = 10
let y = 20
<>
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
- `src/visualization/` — Flow visualization tools
  - `flowGraph.ts` — Graph data structures for flow representation
  - `astAnalyzer.ts` — AST to flow graph conversion
  - `tracer.ts` — Runtime execution tracing
  - `renderer/` — HTML/SVG rendering
  - `cli.ts` — CLI entry point for visualization

## Token Types

```
NUMBER, STRING, IDENTIFIER
LET, MUT, TRUE, FALSE, AWAIT, CONTEXT, PROVIDE
PIPE (/>), PARALLEL_PIPE (\>), ARROW (->), RETURN (<-)
PLUS, MINUS, STAR, SLASH, PERCENT, CONCAT (++)
EQ (=), EQEQ (==), NEQ (!=), LT, GT, LTE, GTE
DOUBLE_COLON (::), COLON_GT (:>)
LPAREN, RPAREN, LBRACKET, RBRACKET, LBRACE, RBRACE
COMMA, COLON, DOT (.), UNDERSCORE (_), HASH (#), AT (@), QUESTION (?)
CODEBLOCK (<>)
NEWLINE, EOF
```

## AST Nodes

**Expressions:**
- NumberLiteral, StringLiteral, BooleanLiteral, Identifier
- BinaryExpr, UnaryExpr, PipeExpr, CallExpr
- FunctionExpr (params, attachments, body, decorators, typeSignature?)
- ListExpr, IndexExpr, PlaceholderExpr, TupleExpr
- RecordExpr, MemberExpr, AwaitExpr
- BlockBody (multi-statement function body)
- ReturnExpr (early return with <-)

**Statements:**
- LetStmt (name, mutable, value)
- ExprStmt (expression)
- ContextDefStmt (name, defaultValue)
- ProvideStmt (contextName, value)
- CodeblockStmt (label, statements)

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
npm run lea file.lea      # Run a file
npm run visualize file.lea  # Generate flow visualization
```

## Visualization

The `npm run visualize` command generates an interactive HTML visualization of data flow through Lea programs.

```bash
# Basic usage - generates file.html
npm run visualize -- file.lea

# With options
npm run visualize -- file.lea --summary        # Print analysis summary
npm run visualize -- file.lea --trace          # Include runtime values
npm run visualize -- file.lea --theme dark     # Dark color theme
npm run visualize -- file.lea -o output.html   # Custom output path
npm run visualize -- file.lea -f json          # Output as JSON
npm run visualize -- file.lea -f svg           # Output as SVG only
```

**Visualization Features:**
- **Node types**: Data sources, transforms, branches, merges, bindings
- **Edge types**: Pipes, parallel branches, function arguments
- **Interactive**: Pan, zoom, hover for details, click to inspect
- **Analysis**: Counts pipelines, parallel branches, async operations
- **Themes**: Light and dark color schemes
- **Export**: HTML (interactive), SVG (static), JSON (data)

## Example Program

```
let numbers = [1, 2, 3, 4, 5]

let sumOfSquares = numbers
  /> filter((x) -> x > 2)
  /> map((x) -> x * x)
  /> reduce(0, (acc, x) -> acc + x)

sumOfSquares /> print
```

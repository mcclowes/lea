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
maybe counter = 0

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

-- Parallel pipes (fan-out/fan-in)
5 \> (x) -> x + 1 \> (x) -> x * 2 /> (a, b) -> a + b

-- Nested pipes in parallel branches (indentation-based)
value
  \> head
  \> tail
    /> transform
  /> combine

-- Codeblocks (collapsible regions)
<> -- Section name
let x = 10
let y = 20
</>
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
- `src/visualizer.ts` — AST to Mermaid flowchart generator
- `src/visualize.ts` — CLI for pipeline visualization
- `src/repl.ts` — Interactive REPL
- `src/index.ts` — File runner entry point

## Token Types

```
NUMBER, STRING, IDENTIFIER
LET, MAYBE, TRUE, FALSE, AWAIT, CONTEXT, PROVIDE
PIPE (/>), PARALLEL_PIPE (\>), ARROW (->), RETURN (<-)
PLUS, MINUS, STAR, SLASH, PERCENT, CONCAT (++)
EQ (=), EQEQ (==), NEQ (!=), LT, GT, LTE, GTE
DOUBLE_COLON (::), COLON_GT (:>)
LPAREN, RPAREN, LBRACKET, RBRACKET, LBRACE, RBRACE
COMMA, COLON, DOT (.), UNDERSCORE (_), HASH (#), AT (@), QUESTION (?)
CODEBLOCK_OPEN (<>), CODEBLOCK_CLOSE (</>)
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
- `length`, `head`, `tail`, `push`, `concat`, `reverse`, `zip`, `isEmpty`
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

Branches can contain nested pipes (must be more indented):
```
value
  \> head
  \> tail
    /> transform
    /> process
  /> combine
```

**Context System:**
- `context Name = expr` — define context with default value
- `provide Name expr` — override context value
- `@Name` — attach context to function (inject into scope)

## Usage

```bash
npm run repl              # Interactive REPL
npm run lea file.lea      # Run a file
npm run visualize -- file.lea           # Output Mermaid flowchart
npm run visualize -- file.lea --html    # Output HTML with embedded diagram
npm run visualize -- file.lea --html -o flow.html  # Save to file
npm run visualize -- file.lea --tb      # Top-to-bottom layout
```

## Visualization

Generate Mermaid flowcharts showing data flow through pipe chains:

```bash
npm run visualize -- examples/09-pipeline.lea --html -o flow.html
```

**Features:**
- Visualizes pipe chains as connected flowchart nodes
- Shows parallel pipe fan-out/fan-in patterns with diamond nodes
- Groups named bindings into subgraphs
- Outputs Mermaid markdown or self-contained HTML

**Node Shapes:**
- Stadium `([...])` — data values
- Parallelogram `[/...\/]` — operations/functions
- Diamond `{...}` — fan-out/fan-in branching
- Subroutine `[[...]]` — await/return

**Options:**
- `--html` — Output HTML with embedded Mermaid.js
- `--tb` — Top-to-bottom layout (default: left-to-right)
- `-o <file>` — Write to file instead of stdout
- `--expand` — Expand function bodies as subgraphs

## Example Program

```
let numbers = [1, 2, 3, 4, 5]

let sumOfSquares = numbers
  /> filter((x) -> x > 2)
  /> map((x) -> x * x)
  /> reduce(0, (acc, x) -> acc + x)

sumOfSquares /> print
```

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
-- Supported types: Int, String, Bool, List, Function, Tuple, Pipeline
-- Optional types with ?: ?Int allows null
-- Tuple types: (Int, String) :> (Int, String)
-- Underscore for ignored params
let ignoreSecond = (x, _) -> x

-- Function overloading (multiple definitions with same name)
-- Resolution based on argument types at runtime
let add = (a, b) -> a + b :: (Int, Int) :> Int
let add = (a, b) -> a ++ b :: (String, String) :> String
add(1, 2)         -- calls Int version: 3
add("a", "b")     -- calls String version: "ab"

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
let user = { name: "Max", age: 99 }
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

-- String concatenation (with automatic type coercion)
"Hello" ++ " World"
"The answer is " ++ 42       -- "The answer is 42"
"Done: " ++ true             -- "Done: true"
(100 ++ 200)                 -- "100200" (numbers coerced)

-- Template strings (backtick syntax with interpolation)
let name = "World"
`Hello {name}!`              -- "Hello World!"
`Sum: {10 + 20}`             -- "Sum: 30"
`Items: {[1, 2, 3]}`         -- "Items: [1, 2, 3]"

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

-- Pipelines as first-class values
-- Define a reusable pipeline (starts with />)
let processNumbers = /> double /> addOne
5 /> processNumbers         -- applies pipeline to 5

-- Pipeline properties
processNumbers.length       -- 2 (number of stages)
processNumbers.stages       -- ["double", "addOne"]
processNumbers.visualize()  -- prints ASCII diagram

-- Pipeline composition
let pipeA = /> filter((x) -> x > 0)
let pipeB = /> map((x) -> x * 2)
let combined = /> pipeA /> pipeB  -- compose pipelines

-- Pipeline decorators (trailing, after pipeline definition)
let debugPipeline = /> double /> addOne #debug
let profiledPipeline = /> double /> addOne #profile
let loggedPipeline = /> double /> addOne #log
5 /> debugPipeline   -- shows step-by-step execution
5 /> profiledPipeline  -- shows timing for each stage

-- Reversible functions (bidirectional transforms)
-- Define forward with -> and reverse with <-
let double = (x) -> x * 2
let double = (x) <- x / 2         -- adds reverse definition

-- Apply forward or reverse
5 /> double                        -- 10 (forward: 5 * 2)
10 </ double                       -- 5  (reverse: 10 / 2)

-- Roundtrip preserves value
5 /> double </ double              -- 5

-- Bidirectional pipelines (starts with </>)
let transform = </> double </> addTen
5 /> transform                     -- 20 (forward: 5 -> 10 -> 20)
20 </ transform                    -- 5  (reverse: 20 -> 10 -> 5)
-- Pipeline algebra
5 /> Pipeline.identity             -- 5 (passes through unchanged)
5 /> Pipeline.empty                -- 5 (no stages = unchanged)
pipeA.equals(pipeB)                -- false (structural comparison)
pipeA.isEmpty()                    -- false
pipeA.first                        -- first stage as function
pipeA.last                         -- last stage as function
pipeA.at(0)                        -- get stage at index
pipeA.prepend(fn)                  -- add stage at start
pipeA.append(fn)                   -- add stage at end
pipeA.reverse()                    -- reverse stage order
pipeA.slice(0, 2)                  -- extract sub-pipeline
pipeA.without(pipeB)               -- remove stages in pipeB
pipeA.intersection(pipeB)          -- keep only common stages
pipeA.union(pipeB)                 -- combine (deduplicated)
pipeA.concat(pipeB)                -- concatenate (preserves duplicates)
Pipeline.from([fn1, fn2])          -- create from function list
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
NUMBER, STRING, TEMPLATE_STRING (`...{expr}...`), IDENTIFIER
LET, MAYBE, TRUE, FALSE, AWAIT, CONTEXT, PROVIDE
PIPE (/>), PARALLEL_PIPE (\>), ARROW (->), RETURN (<-)
REVERSE_PIPE (</), BIDIRECTIONAL_PIPE (</>)
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
- NumberLiteral, StringLiteral, TemplateStringExpr, BooleanLiteral, Identifier
- BinaryExpr, UnaryExpr, PipeExpr, CallExpr
- FunctionExpr (params, attachments, body, decorators, typeSignature?, isReverse?)
- ListExpr, IndexExpr, PlaceholderExpr, TupleExpr
- RecordExpr, MemberExpr, AwaitExpr
- BlockBody (multi-statement function body)
- ReturnExpr (early return with <-)
- PipelineLiteral (stages: list of expressions, decorators)
- ReversePipeExpr (left: value, right: pipeline/function)
- BidirectionalPipelineLiteral (stages: list of expressions, decorators)

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
6. Pipe (`/>`, `\>`, `</`)
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

**Decorators (Functions):**
- `#log` — logs inputs/outputs
- `#memo` — caches results by JSON-stringified args
- `#time` — logs execution time
- `#retry(n)` — retry on failure up to n times
- `#timeout(ms)` — fail if exceeds time (async only)
- `#validate` — runtime type checking and null checks
- `#pure` — warn if side effects detected
- `#async` — mark function as async (returns promise)
- `#trace` — deep logging with call depth

**Decorators (Pipelines):**
- `#log` — logs pipeline input/output
- `#memo` — caches pipeline results by input
- `#time` — logs total pipeline execution time
- `#tap` — inspect output without modifying (default: console.log)
- `#tap("fnName")` — call named function with output as side effect
- `#debug` — detailed stage-by-stage execution logging
- `#profile` — timing breakdown for each stage with percentages
- `#trace` — nested call tracing with indentation

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

**Function Overloading:**
- Define multiple functions with the same name but different type signatures
- Functions must have type annotations (`::`) to participate in overloading
- Resolution is based on argument types at call time
- More specific type matches are preferred over generic ones
- Arity (number of arguments) is checked first, then types
- Error if no overload matches or if call is ambiguous

**Pipelines (First-Class):**
- Define with `/>` at start: `let p = /> fn1 /> fn2`
- Apply by piping: `value /> p`
- Properties:
  - `.length` — number of stages
  - `.stages` — list of stage names
  - `.visualize()` — prints ASCII diagram of pipeline flow
  - `.first` / `.last` — get first/last stage as callable function
  - `.isEmpty()` — check if pipeline has no stages
  - `.equals(other)` — structural equality comparison
- Compose pipelines: `let combined = /> pipeA /> pipeB`
- Pipelines capture their closure (lexical scope)
- Decorators can be attached: `let p = /> fn1 /> fn2 #debug #profile`

**Reversible Functions:**
- Define forward with `(x) -> expr` and reverse with `(x) <- expr`
- When both are defined on same name, creates a `LeaReversibleFunction`
- Forward: `value /> fn` calls the forward transformation
- Reverse: `value </ fn` calls the reverse transformation
- Reversible functions act like regular functions in forward pipes
- Similar to overloading but for direction rather than types

**Bidirectional Pipelines:**
- Define with `</>` at start: `let p = </> fn1 </> fn2`
- Forward: `value /> p` applies stages left-to-right using forward functions
- Reverse: `value </ p` applies stages right-to-left using reverse functions
- All stages should be reversible functions for reverse to work
- Bidirectional pipelines capture their closure (lexical scope)
- Useful for encoding/decoding, serialization, unit conversions

**Pipeline Algebra:**
- `Pipeline.identity` — no-op pipeline, passes values through unchanged
- `Pipeline.empty` — pipeline with zero stages
- `Pipeline.from(list)` — create pipeline from list of functions
- Stage access:
  - `.at(index)` — get stage at index as callable function
- Manipulation (returns new pipeline):
  - `.prepend(fn)` — add stage at start
  - `.append(fn)` — add stage at end
  - `.reverse()` — reverse stage order
  - `.slice(start, end?)` — extract sub-pipeline
- Set operations (returns new pipeline):
  - `.without(other)` — remove stages appearing in other pipeline
  - `.intersection(other)` — keep only stages common to both
  - `.union(other)` — combine all stages (deduplicated)
  - `.difference(other)` — stages in this but not in other (alias for without)
  - `.concat(other)` — concatenate pipelines (preserves duplicates)

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

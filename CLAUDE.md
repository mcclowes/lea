# Lea

Tree-walk interpreter in TypeScript for a pipe-oriented functional language.

## Development Guidelines

After modifying or adding functionality, always update:
1. **Documentation** — `CLAUDE.md` and skill reference docs
2. **Examples** — Add/update files in `examples/`
3. **Tests** — Add/update unit tests in `__tests__/` and integration tests in `tests/`
4. **Syntax highlighting** - Update the syntax highlighting vscode extension to support this functionality appropriately

## Syntax

```
-- Comments

-- Immutable binding
let x = 10

-- Mutable binding
maybe counter = 0

-- Reassign mutable binding
counter = 10

-- Pipes (value flows into first argument)
16 /> sqrt
5 /> add(3)          -- becomes add(5, 3)
5 /> add(3, input)   -- placeholder: becomes add(3, 5)

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
-- Use #validate for runtime type checking (explicit)
let safe = (x) -> x * 2 :: Int :> Int #validate
-- Use #strict pragma for auto-validation of all typed functions
#strict  -- at top of file enables strict mode
-- Or use --strict CLI flag: npm run lea file.lea --strict
-- Supported types: Int, String, Bool, List, Function, Tuple, Pipeline
-- Optional types with ?: ?Int allows null
-- Tuple types: (Int, String) :> (Int, String)
-- List types: [Int], [String], [[Int]] for nested lists
let sumList = (nums) -> reduce(nums, 0, (acc, x) -> acc + x) :: [Int] :> Int
-- Underscore for ignored params
let ignoreSecond = (x, _) -> x

-- Function overloading (use 'and' to extend with additional overloads)
-- Resolution based on argument types at runtime
let add = (a, b) -> a + b :: (Int, Int) :> Int
and add = (a, b) -> a ++ b :: (String, String) :> String
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

-- Type coercion decorators
let parseNum = (x) -> x * 2 #coerce(Int)   -- coerce input: "42" becomes 42
"21" /> parseNum                            -- 42

let extract = (x) -> x #tease(Int)          -- best-effort: extract number
"42px" /> extract                           -- 42
"Price: $99" /> extract                     -- 99

let stringify = (x) -> x #stringify         -- convert output to string
[1, 2] /> stringify                         -- "[1, 2]"

let parseInput = (x) -> x #parse            -- parse JSON or numbers from string
"[1, 2, 3]" /> parseInput                   -- [1, 2, 3]

-- Multi-statement function bodies (indentation or braces)
let process = (x) ->
  let y = x * 2
  let z = y + 1
  z

-- Early return (return keyword)
let clamp = (x) ->
  let doubled = x * 2
  doubled > 100 ? return 100 : 0
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

-- Destructuring (records and tuples/lists)
let user = { name: "Alice", age: 99 }
let { name, age } = user           -- extracts name and age
let point = (10, 20)
let (x, y) = point                 -- extracts x=10, y=20
let (first, second) = [1, 2, 3]    -- also works with lists

-- Spread operator (for records and lists)
let a = [1, 2, 3]
let b = [4, 5, 6]
let combined = [...a, ...b]        -- [1, 2, 3, 4, 5, 6]
let base = { x: 1, y: 2 }
let extended = { ...base, z: 3 }   -- { x: 1, y: 2, z: 3 }
let updated = { ...base, y: 20 }   -- { x: 1, y: 20 } (override)

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

-- Array index access (callbacks receive index as optional second argument)
["a", "b", "c"] /> map((x, i) -> `{i}: {x}`)       -- ["0: a", "1: b", "2: c"]
[10, 20, 30, 40] /> filter((_, i) -> i < 2)        -- [10, 20] (first 2 elements)
["a", "b"] /> reduce("", (acc, x, i) -> acc ++ `{i}:{x} `)  -- "0:a 1:b "

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

-- Pattern matching
let describe = (x) -> match x
  | 0 -> "zero"                  -- pattern match against literal
  | 1 -> "one"
  | if input < 0 -> "negative"   -- guard with 'input' as matched value
  | if input > 100 -> "big"      -- multiple guards allowed
  | "default"                    -- default case (no pattern/guard)

5 /> describe /> print           -- "default"
-3 /> describe /> print          -- "negative"

-- Using input in result body
let double = (x) -> match x
  | if input > 0 -> input * 2    -- input available in body too
  | 0

-- Parallel pipes (fan-out/fan-in)
5 \> (x) -> x + 1 \> (x) -> x * 2 /> (a, b) -> a + b

-- Nested pipes in parallel branches (indentation-based)
value
  \> head
  \> tail
    /> transform
  /> combine

-- Spread pipe (map over elements)
-- Applies function/pipeline to each element of a list
-- Callback receives (element, index) like map/filter/reduce
[1, 2, 3] />>>double              -- [2, 4, 6]
[1, 2, 3] />>>add(10)             -- [11, 12, 13]
[1, 2, 3] />>>print               -- prints "1 0", "2 1", "3 2" (element and index)

-- Spread pipe with index access
["a", "b", "c"] />>>(x, i) -> `{i}: {x}`  -- ["0: a", "1: b", "2: c"]
[10, 20, 30] />>>(x, i) -> x + i          -- [10, 21, 32]

-- Spread pipe with parallel results
5 \> addOne \> double />>>print   -- prints each branch result individually

-- Spread pipe with pipelines
let process = /> double /> addOne
[1, 2, 3] />>>process             -- [3, 5, 7]

-- Codeblocks (collapsible regions)
{-- Section name --}
let x = 10
let y = 20
{/--}

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
-- Define forward with -> and use 'and' to add reverse with <-
let double = (x) -> x * 2
and double = (x) <- x / 2         -- adds reverse definition

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

-- Reactive pipelines (auto-recomputing on source changes)
-- Use @> to create a reactive binding from a mutable source
maybe source = [1, 2, 3]
let reactive = source @> map(double) /> sum
reactive.value         -- 12 (lazy: computed on first .value access)

source = [1, 2, 3, 4]  -- mutation marks reactive as dirty
reactive.value         -- 20 (recomputed because source changed)
reactive.value         -- 20 (cached - not recomputed)

-- Auto-unwrap in expressions (use parentheses due to pipe precedence)
(reactive + 10) /> print  -- 30

-- Static sources (primitives) optimize away the reactive
let x = 5
let r = x @> double    -- r is just 10, not a reactive wrapper

-- Arrays/objects with let create reactives (mutable by reference)
let arr = [1, 2, 3]
let r2 = arr @> sum    -- r2 is a reactive
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
- `src/visualizer.ts` — AST to Mermaid flowchart generator
- `src/visualize.ts` — CLI entry point for visualization
- `src/formatter.ts` — Prettier-like code formatter
- `src/format.ts` — CLI entry point for formatting

## Token Types

```
NUMBER, STRING, TEMPLATE_STRING (`...{expr}...`), IDENTIFIER
LET, AND, MAYBE, TRUE, FALSE, AWAIT, CONTEXT, PROVIDE, MATCH, IF, RETURN, INPUT
PIPE (/>), SPREAD_PIPE (/>>>), PARALLEL_PIPE (\>), ARROW (->), REVERSE_ARROW (<-)
REVERSE_PIPE (</), BIDIRECTIONAL_PIPE (</>), REACTIVE_PIPE (@>), PIPE_CHAR (|)
PLUS, MINUS, STAR, SLASH, PERCENT, CONCAT (++)
EQ (=), EQEQ (==), NEQ (!=), LT, GT, LTE, GTE
DOUBLE_COLON (::), COLON_GT (:>)
LPAREN, RPAREN, LBRACKET, RBRACKET, LBRACE, RBRACE
COMMA, COLON, DOT (.), SPREAD (...), UNDERSCORE (_), HASH (#), AT (@), QUESTION (?)
CODEBLOCK_OPEN ({-- --}), CODEBLOCK_CLOSE ({/--})
NEWLINE, EOF
```

## AST Nodes

**Expressions:**
- NumberLiteral, StringLiteral, TemplateStringExpr, BooleanLiteral, Identifier
- BinaryExpr, UnaryExpr, PipeExpr, SpreadPipeExpr, CallExpr
- FunctionExpr (params, attachments, body, decorators, typeSignature?, isReverse?)
- ListExpr, IndexExpr, PlaceholderExpr, TupleExpr
- RecordExpr, MemberExpr, AwaitExpr
- BlockBody (multi-statement function body)
- ReturnExpr (early return with return keyword)
- PipelineLiteral (stages: list of expressions, decorators)
- ReversePipeExpr (left: value, right: pipeline/function)
- BidirectionalPipelineLiteral (stages: list of expressions, decorators)
- MatchExpr (value: expr, cases: MatchCase[])
- MatchCase (pattern: expr|null, guard: expr|null, body: expr)
- ReactivePipeExpr (source: expr, sourceName: string, stages: list of pipeline stages)

**Statements:**
- LetStmt (name, mutable, value)
- AndStmt (name, value) — extends existing function with overload or reverse
- AssignStmt (name, value) — reassign a mutable (maybe) variable
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
6. Pipe (`/>`, `/>>>`, `\>`, `</`)
7. Unary (`-`)
8. Call (function calls, indexing)
9. Primary (literals, identifiers, grouping, functions)

Note: Pipe operators bind tighter than arithmetic, so `a /> b ++ c` parses as `(a /> b) ++ c`.

## Interpreter Details

**Environment:** Lexical scoping with parent chain.

**Pipe evaluation:**
- If right side is CallExpr with placeholder `input` in args, substitute piped value there
- Otherwise prepend piped value as first argument
- If right side is just Identifier, call it with piped value as single arg

**Decorators (Functions):**
- `#log` — logs inputs/outputs
- `#log_verbose` — detailed logging with parameters, types, timing, and return values
- `#memo` — caches results by JSON-stringified args
- `#time` — logs execution time
- `#retry(n)` — retry on failure up to n times
- `#timeout(ms)` — fail if exceeds time (async only)
- `#validate` — runtime type checking and null checks
- `#pure` — warn if side effects detected
- `#async` — mark function as async (returns promise)
- `#trace` — deep logging with call depth
- `#coerce(Type)` — coerce inputs to type (Int, String, Bool, List)
- `#parse` — auto-parse string inputs as JSON or numbers
- `#stringify` — convert output to string representation
- `#tease(Type)` — best-effort coercion of output (extracts numbers from strings, etc.)

**Decorators (Pipelines):**
- `#log` — logs pipeline input/output
- `#log_verbose` — detailed stage-by-stage logging with inputs, outputs, and timing for each stage
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
- `map(list, fn)` — transform each element; callback receives `(element, index)`
- `filter(list, fn)` — keep elements matching predicate; callback receives `(element, index)`
- `reduce(list, initial, fn)` — fold into single value; callback receives `(acc, element, index)`
- `partition`
- `range`, `iterations`
- `fst`, `snd` — first/second element of tuple or list
- `take(list, n)`, `at(list, index)` — list access
- `toString` — convert value to string
- `delay(ms, value)` — returns promise that resolves after ms
- `parallel(list, fn, opts?)` — concurrent map with optional `{ limit: n }`; callback receives `(element, index)`
- `race(fns)` — returns first promise to resolve
- `then(promise, fn)` — chain promise transformations

**Random Builtins:**
- `random()` — random float in [0, 1)
- `randomInt(max)` or `randomInt(min, max)` — random integer in [0, max) or [min, max)
- `randomFloat(max)` or `randomFloat(min, max)` — random float in [0, max) or [min, max)
- `randomChoice(list)` — random element from list
- `shuffle(list)` — return shuffled copy of list (Fisher-Yates)

**String Builtins:**
- `split(str, delimiter)` — split string into list
- `lines(str)` — split string by newlines
- `charAt(str, index)` — get character at index
- `join(list, delimiter?)` — join list into string
- `padEnd(str, len, char?)`, `padStart(str, len, char?)` — pad string
- `trim(str)`, `trimEnd(str)` — remove whitespace
- `indexOf(str, search)` — find index of substring
- `includes(str/list, item)` — check if contains item
- `repeat(str, count)` — repeat string n times
- `slice(str/list, start, end?)` — extract substring/sublist
- `chars(str)` — split string into character list

**Set Operations (on lists):**
- `listSet(list)` — create list with unique elements
- `setAdd(list, item)` — add if not present (returns new list)
- `setHas(list, item)` — check if item exists in list

**ASCII Diagram Parser:**
- `breakPieces(shape)` — parse ASCII diagram into minimal closed pieces

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

**Spread Pipe Operator:**
```
list />>>fn
```
Maps a function or pipeline over each element of a list or parallel result.
Callback receives `(element, index)` as arguments, similar to map/filter/reduce.

- `[1, 2, 3] />>>double` returns `[2, 4, 6]` (maps double over each element)
- `[1, 2, 3] />>>(x, i) -> x + i` returns `[1, 3, 5]` (element + index)
- `["a", "b"] />>>(x, i) -> \`{i}: {x}\`` returns `["0: a", "1: b"]`
- `parallelResult />>>print` applies print to each branch result individually
- If the left side is not a list or parallel result, throws a RuntimeError
- Returns an array of results from applying the function to each element
- Async-aware: if any result is a promise, returns a promise that resolves to all results

**Context System:**
- `context Name = expr` — define context with default value
- `provide Name expr` — override context value
- `@Name` — attach context to function (inject into scope)

**Function Overloading:**
- Use `and` to add additional overloads to an existing function
- Functions must have type annotations (`::`) to participate in overloading
- Resolution is based on argument types at call time
- More specific type matches are preferred over generic ones
- Arity (number of arguments) is checked first, then types
- Error if no overload matches or if call is ambiguous

**Pattern Matching:**
- `match expr` starts a match expression, followed by cases
- `| pattern -> body` — match against a literal value
- `| if guard -> body` — guard condition with `input` bound to matched value
- `| body` — default case (no pattern or guard, always matches)
- Cases are evaluated in order; first match wins
- `input` in guards refers to the matched value and can be used in the body
- Throws error if no case matches

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
- Define forward with `(x) -> expr`, then use `and` to add reverse with `(x) <- expr`
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

**Reactive Pipelines:**
- Create with `@>`: `let r = source @> fn1 /> fn2`
- Only the first pipe uses `@>`, rest are normal `/>`
- Source must be an identifier (variable name to track)
- Lazy evaluation: computes on `.value` access, not on creation
- Dirty tracking: source mutation marks reactive as dirty
- Caching: subsequent `.value` accesses return cached result if clean
- Auto-unwrap: reactives unwrap automatically in binary operations
- Static optimization: primitive sources compute immediately (no reactive wrapper)
- Properties:
  - `.value` — get current computed value (recomputes if dirty)

## Usage

```bash
npm run repl              # Interactive REPL
npm run repl -- --strict  # REPL with strict type checking
npm run lea file.lea      # Run a file
npm run lea file.lea --strict  # Run with strict type checking
npm run visualize -- file.lea           # Output Mermaid markdown
npm run visualize -- file.lea --html    # Output HTML with diagram
npm run visualize -- file.lea -o out.html  # Write to file
npm run visualize -- file.lea --tb      # Top-to-bottom layout
npm run format -- file.lea              # Print formatted code to stdout
npm run format -- file.lea -w           # Format file in place
npm run format -- dir/ -w               # Format all .lea files in directory
npm run format -- file.lea --check      # Check if file is formatted
```

## Testing

```bash
npm test                  # Run all unit tests (Jest)
npm run test:unit         # Run unit tests (alias for npm test)
npm run test:integration  # Run integration tests (.lea files in tests/)
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Run tests with coverage report
```

### Test Structure

- `__tests__/lexer.test.ts` — Lexer unit tests (tokenization)
- `__tests__/parser.test.ts` — Parser unit tests (AST generation)
- `__tests__/interpreter.test.ts` — Interpreter unit tests (evaluation)
- `tests/*.lea` — Integration tests (full Lea programs)

## Formatting

The formatter provides Prettier-like code formatting for Lea source files.

### CLI Options

```bash
-w, --write           Format file(s) in place
--check               Check if file(s) are formatted (exit with error if not)
--indent <n>          Number of spaces for indentation (default: 2)
--print-width <n>     Maximum line width (default: 80)
--no-trailing-commas  Don't use trailing commas in multi-line lists/records
-h, --help            Show help message
```

### Formatting Rules

- **Indentation**: 2 spaces (configurable)
- **Line width**: 80 characters (configurable)
- **Trailing commas**: Added in multi-line lists and records
- **Pipe chains**: Broken into multiple lines when exceeding print width
- **Parentheses**: Automatically added where needed for operator precedence
- **Records/Lists**: Multi-line when exceeding print width

### Example

```bash
# Format a single file
npm run format -- examples/01-basics.lea -w

# Check formatting in CI
npm run format -- src/ --check

# Format with custom settings
npm run format -- file.lea --indent 4 --print-width 100
```

## Visualization

The visualizer generates Mermaid flowchart diagrams from Lea source code, showing data flow through pipe chains.

### Features

- **Pipe chain visualization** — Shows data flowing through operations
- **Parallel pipe fan-out/fan-in** — Diamond nodes show branching
- **Named binding subgraphs** — Groups related pipe chains
- **Multiple output formats** — Mermaid markdown or self-contained HTML

### Node Types (Color-coded)

- **Purple (stadium)** — Data values (numbers, strings, lists)
- **Blue (parallelogram)** — Operations (functions, calls)
- **Orange (diamond)** — Fan-out/Fan-in (parallel pipes)
- **Green (subroutine)** — Await/Return
- **Yellow (diamond)** — Conditionals

### CLI Options

```bash
--html, -h          Output HTML with embedded Mermaid diagram
-o, --output FILE   Write output to FILE instead of stdout
--tb, --top-bottom  Use top-to-bottom layout (default: left-to-right)
--lr, --left-right  Use left-to-right layout (default)
--types             Show type annotations in diagram
--no-decorators     Hide decorators in diagram
--help              Show help message
```

### Example

```bash
# Generate and view a flow diagram
npm run visualize -- examples/09-pipeline.lea --html -o flow.html
open flow.html
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

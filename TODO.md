# Lea TODO

## Active Tasks

- [X] Leveraging Lea functionality within TypeScript?
  - Added `lea` tagged template literal for embedding Lea in TypeScript
  - Supports JS value and function interpolation via `${...}`
  - Added `createLea()` for context-based execution with bindings
- [X] Ambiguity with ignored and templated params? - `let ignoreSecond = (x, _) -> x`
- [X] Explicit Pipeline Types
- [X] I think we should prefer/encourage />>> over map (less verbose) - remember this, and also update examples/documentation
  - Fixed parser to allow `/>>>` to chain naturally without parentheses
  - Updated examples/03-lists.lea to use `/>>>`
- [X] Bug in syntax highlighting - :: [Int] /> [Int]   - the second [Int] doesn't show in the same colour as a type def
  - Regex pattern tested and matches correctly; VS Code extension version 0.2.3 ready for republishing
- [X] Create a changelog and ensure Claude keeps it up to date
  - Added CHANGELOG.md with full project history
- [X] Allow pipelines to begin with />>> ?
  - Pipelines can now start with `/>>>` for spread operations: `/>>> double /> sum`

## Feature Ideas

### ~~`if-then-else` Syntax~~ ✅

Implemented `if-then-else` as syntactic sugar for ternary expressions:
```lea
let fibonacci = (n) ->
  if n <= 1 then n
  else fibonacci(n - 1) + fibonacci(n - 2)
```
Desugars to `n <= 1 ? n : fibonacci(n - 1) + fibonacci(n - 2)`

### `\\\>` Parallel Spread Syntax

Explore a combined parallel-spread operator for mapping over parallel branches:
```lea
5 \\\> double \\\> addOne  -- parallel branches that each produce a value
```

### Refinement Types

Types with predicates (like Liquid Haskell, F*):
```lea
let clamp = (x) -> x :: Int where x > 0 && x < 100 :> Int
```

### Canvas Visualization

Visual/graphical pipeline visualization (beyond ASCII `.visualize()`). Mermaid?

### Structured Concurrency (`concurrent` blocks)

Run all awaits in parallel with a clean syntax:

```lea
let userData = concurrent
  let user = await fetchUser(id)
  let posts = await fetchPosts(id)
  let friends = await fetchFriends(id)
in
  { user: user, posts: posts, friends: friends }
```

### Channels (CSP-Style)

For complex coordination patterns:

```lea
let ch = channel()

let producer = () ->
  range(1, 10) /> each((x) -> ch /> send(x))
  ch /> close
#async

let consumer = () ->
  ch /> receive /> each((x) -> x /> print)
#async

[producer, consumer] /> parallel
```

### `#spawn` Decorator

Fire-and-forget execution:

```lea
let logEvent = (event) ->
  sendToAnalytics(event)
#spawn

-- Returns immediately, doesn't block
logEvent({ type: "click" })
```

### `#parallel` Decorator

Automatic parallelization of map operations within a function:

```lea
let processItems = (items) ->
  items /> map((x) -> expensiveTransform(x))
#parallel

-- With concurrency limit
let processItems = (items) ->
  items /> map((x) -> expensiveTransform(x))
#parallel(4)
```

---

## Future Pipe Operators

### Unfold/Generate Pipe `/<>`

Expands a seed value into a list (opposite of reduce):

```lea
1 /<> ((x) -> x > 100 ? null : x * 2)    -- [1, 2, 4, 8, 16, 32, 64]

-- Collatz sequence
7 /<> ((x) -> match x
  | 1 -> null
  | if _ % 2 == 0 -> x / 2
  | x * 3 + 1
)
```

### Gate Pipe `/?>`

Short-circuit pipeline on predicate failure:

```lea
value /?> isValid /> process              -- null if invalid
value /?> isPositive : 0 /> double        -- 0 if not positive
```

### Scan Pipe `/~>`

Reduce that emits all intermediate values:

```lea
[1, 2, 3, 4] /~> 0, (acc, x) -> acc + x   -- [1, 3, 6, 10]
```

### Until Pipe `/*>`

Iterate until condition met:

```lea
1 /*> (x) -> x * 2, (x) -> x > 100        -- 128
```

### Window Pipe `/[n]>`

Sliding window operations:

```lea
[1, 2, 3, 4, 5] /[3]> (x, i, window) -> avg(window)
```

Alternative: `window(n)` builtin that creates overlapping windows.

---

# Module System Implementation

## Design Decisions

- **Export syntax**: `#export` decorator on let bindings
- **Import syntax**: `let { a, b } = use "./path"` (destructuring required)
- **No namespace imports**: No `let math = use "./math"` for now (can add later)
- **Resolution**: Relative paths only, resolved from the importing file's location
- **Implicit extension**: `use "./math"` resolves to `./math.lea`
- **Named exports only**: No default exports
- **Re-exports allowed**: `let { foo } = use "./a" #export`
- **No `as` syntax**: Rename by rebinding manually
- **Pipelines**: Export/import like any value (closures preserved)
- **Decorators**: Can decorate imported values

## Implementation Checklist

### Phase 1: Core Infrastructure
- [x] Add `USE` token to lexer (`use` keyword)
- [x] Add `UseExpr` AST node
- [x] Update parser to handle `use` expressions
- [x] Add `#export` decorator support in interpreter
- [x] Implement path resolution (relative to importing file)
- [x] Add module cache (avoid re-evaluating same file)
- [x] Circular dependency detection
- [x] Module exports as LeaRecord
- [x] Module-scoped environments
- [x] Export registry via `#export` decorator check
- [x] Import linking via destructuring
- [x] File not found errors
- [x] Circular import errors
- [x] Clear error messages with file paths
- [x] Integration tests for import/export (tests/modules/)
- [x] Update CLAUDE.md with module syntax
- [x] Add examples in `examples/modules/`
- [x] Update VS Code syntax highlighting
- [x] **CRITICAL: Context system across modules** - How should `context` and `provide` work across module boundaries? Options:
- [x] Implement ternary statements
- [x] Custom decorators
- [x] Linting for IDEs/VSCode
- [x] String interpolation / coercion
- [x] Early return
- [x] Additional syntax highlighting
- [x] Codeblocks (`{-- --} {/--}`)
- [x] Collapsing codeblocks in IDE
- [x] Multi-line ternary
- [x] First-class citizen: Pipeline
- [x] Autoformatting (Prettier-style)
- [x] Improve Pipeline.visualize() for parallelisation
- [x] Multi-line records and arrays
- [x] #log_verbose decorator
- [x] Partitions (partition builtin)
- [x] List types syntax (`[Int]`)
- [x] Spread pipe `/>>>` for array/value disambiguation
- [x] Pattern matching
- [x] Record destructuring + spread operator
- [x] Split interpreter into smaller files
- [x] Expand or remove the /docs dir
- [x] Bump syntax highlighting package & publish (v0.2.1)
- [x] Codeblocks - sticky positioning in IDE (like markdown headers)
- [x] Review syntax highlighting against all of the more recent language additions
- [x] Enforce types by default? Or just warn (with #validate to throw)?
- [x] Replace big comments with codeblocks throughout example files
- [x] Make codeblocks appear the same colours as comments in syntax highlighting
- [x] \`\`\`lea syntax highlighting in markdown
- [x] Replace <- early return with `return` keyword
- [x] Review documentation
  - Fixed SYNTAX.md: pattern matching uses `input` not `_` for matched value

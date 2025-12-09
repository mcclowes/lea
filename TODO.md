# Lea TODO

## Active Tasks

- [ ] Leveraging Lea functionality within TypeScript?
- [X] Ambiguity with ignored and templated params? - `let ignoreSecond = (x, _) -> x`
- [ ] Explicit Pipeline Types

## Feature Ideas

### Explicit Pipeline Types

```lea
let pipe = /> double /> reverse :: [Int]            -- input type only
let pipe = /> double /> reverse :: [Int] /> [Int]   -- input and output
let pipe = :: [Int] /> [Int]                        -- multi-line pipelines
  /> double
  /> reverse
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

## Done

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
  - Implemented #strict pragma and --strict CLI flag for opt-in strict type checking
- [x] Replace big comments with codeblocks throughout example files
- [x] Make codeblocks appear the same colours as comments in syntax highlighting
- [x] \`\`\`lea syntax highlighting in markdown
- [x] Replace <- early return with `return` keyword

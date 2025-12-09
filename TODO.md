# Lea TODO

## Active Tasks

- [ ] Expand or remove the /docs dir
- [ ] Bump syntax highlighting package & publish
- [ ] Codeblocks - sticky positioning in IDE (like markdown headers)
- [ ] Review syntax highlighting against all of the more recent language additions

## Feature Ideas

### Explicit Pipeline Types

```lea
let pipe = /> double /> reverse :: [Int]            -- input type only
let pipe = /> double /> reverse :: [Int] /> [Int]   -- input and output
```

### Refinement Types

Types with predicates (like Liquid Haskell, F*):
```lea
let clamp = (x) -> x :: Int where x > 0 && x < 100 :> Int
```

### Canvas Visualization

Visual/graphical pipeline visualization (beyond ASCII `.visualize()`).

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

# todo

- [ ] Clean up this file
- [ ] Expand or remove the /docs dir
- [ ] Codeblocks - can we get these to position: sticky to the top of the IDE as we scroll? I've seen this behaviour with markdown files and headers
- [ ] Bump syntax highlighting package & publish
- [ ] Refinement Types (Liquid Haskell, F*) — Types with predicates. Not just int, but int where x > 0 && x < 100. The compiler proves your code satisfies the constraints.
- [x] Improve Pipeline.visualize() function to show parallelisation
- [ ] Canvas visualisation of our 'pipeline's
- [x] Multi-line records and arrays in parser
- [x] Implement #log_verbose to log input, output, and all variable assignment, or the values passed between pipeline stages
- [x] Partitions (partition builtin added)
- [ ] Explicit types for pipelines
- [x] List types syntax - ❌ List , ✅ [Int]
- [x] Array vs value handling - resolve ambiguity (spread pipe />> added)
- [x] Pattern matching
- [x] Record improvements (destructuring + spread operator added)
- [x] Split the interpreter up into smaller files
- [x] code blocks - changed from `<> </>` to `{-- --} {/--}` to avoid user confusion with bidirectional pipes

## Partitions

```
-- Split pipeline
let [evens, odds] = /> partition((x) -> x % 2 == 0)
```

equivalent to
```
-- Split pipeline
let [evens, odds] =
  \> filter((x) -> x % 2 == 0)
  \> filter((x) -> x % 2 != 0)
```

## Explicit pipeline types

- If you define the types for stages, then the pipelines types is all implicit (or rather, explicitly defined by its constituent parts)
- If you dont, then it makes sense to define types at the pipeline level

```lea
let pipe = /> double /> reverse :: [Int] -- defined the input only
```

```lea
let pipe = /> double /> reverse :: [Int] /> [Int] -- defined the input and pipeline output
```

## Pattern matching

Pattern Matching - Would complement the functional style

```lea
let describe = (x) -> match x
  | 0 -> "zero"
  | if _ < 0 -> "negative"
  | "positive"

5 /> describe /> print -- print "positive"
```

## Record improvements

Destructuring - For records and tuples

let { name, age } = user
let (x, y) = point

Spread Operator - For records and lists

let updated = { ...user, age: 31 }
let combined = [...list1, ...list2]

## ~~Autoformatting - prettier style~~ ✅ DONE

Formatter - Auto-format Lea code (like Prettier)

Implemented! See `src/formatter.ts` and `npm run format`.

## Array vs value handling - resolve ambiguity

```lea
let foo =
  \> (x) -> x + 1
  \> (x) -> x * 2
  /> print

10 /> foo -- prints [11, 20]
```

### New token - />>>

```lea
let foo =
  \> (x) -> x + 1
  \> (x) -> x * 2
  />>>print

10 /> foo -- prints 11 and then 20
```

Equivalent to:
```lea
let foo =
  \> (x) -> x + 1
  \> (x) -> x * 2
  /> map((x) -> print(x))

10 /> foo -- prints 11 and then 20
```

On inputs...
```lea
let foo =
  \> (x) -> x + 1
  \> (x) -> x * 2
  /> print

[10, 10, 10] /> foo -- Should fail as [10, 10, 10] + 1 makes no sense
```

Whereas
```lea
let foo =
  \> (x) -> x + 1
  \> (x) -> x * 2
  /> print

[10, 10, 10] />>>foo -- prints [11, 20] three times
```

```lea
let foo =
  /> double
  /> min(4, 5, 6)
  /> print

[1, 2, 3] />>>foo -- would print 1, then 2, then 3, after comparing [1,4,5,6], [2,4,5,6], etc.
```

Equivalent
```lea
let foo =
  />>>double
  />>>min(4, 5, 6)
  /> print

[1, 2, 3] /> foo
```

Equivalent
```lea
let foo =
  />>>double
  />>>min(..._, 4, 5, 6) -- spread placeholder (this syntax is horrible though)
  /> print

[1, 2, 3] />>>foo -- would print 1
```

## Other pipe variants

### Unfold/Generate pipe (`/<>`)

Generates a sequence from a seed value by repeatedly applying a function until it returns null. The opposite of reduce — instead of collapsing a list into a value, it expands a value into a list.

```lea
-- Generate powers of 2 up to 100
1 /<> ((x) -> x > 100 ? null : x * 2)    -- [1, 2, 4, 8, 16, 32, 64]

-- Generate Fibonacci-like sequence
(1, 1) /<> ((pair) ->
  let (a, b) = pair
  a > 50 ? null : (b, a + b)
) /> map(fst)                             -- [1, 1, 2, 3, 5, 8, 13, 21, 34]

-- Collatz sequence
7 /<> ((x) -> match x
  | 1 -> null
  | if _ % 2 == 0 -> x / 2
  | x * 3 + 1
)                                         -- [7, 22, 11, 34, 17, 52, 26, 13, 40, 20, 10, 5, 16, 8, 4, 2, 1]
```

Use cases:
- Generating sequences (range, fibonacci, geometric series)
- Iterative algorithms that produce intermediate states
- Parsing/tokenizing (consume input until exhausted)
- Tree/graph traversal producing node lists

### Gate pipe (`/?>`)

Conditionally continues a pipeline based on a predicate. If the predicate returns false, the pipeline short-circuits and returns null (or a specified default). Acts as a guard/filter within a pipeline.

```lea
-- Only process valid inputs
value /?> isValid /> process              -- returns null if isValid(value) is false

-- With default value
value /?> isPositive : 0 /> double        -- returns 0 if not positive

-- Chain multiple gates
data
  /?> isNotNull
  /?> isValidFormat
  /> parse
  /?> hasRequiredFields
  /> save
```

Use cases:
- Input validation within pipelines
- Early exit without exceptions
- Filtering in pipeline chains
- Guard clauses expressed as data flow

Comparison with existing patterns:
```lea
-- Current approach (verbose)
value /> ((x) -> isValid(x) ? process(x) : null)

-- With gate pipe (cleaner)
value /?> isValid /> process
```

---

Not sure what they'll do yet...
### Scan Pipe `/~>` — Reduce that emits intermediates

Like reduce but returns all intermediate accumulator values. Useful for running totals, state machines, animations.

```lea
[1, 2, 3, 4] /~> 0, (acc, x) -> acc + x
-- yields [1, 3, 6, 10] (running totals)

-- Compare to reduce which only returns final value:
[1, 2, 3, 4] /> reduce(0, (acc, x) -> acc + x)
-- yields 10

-- Use cases:
balances /~> 0, (acc, tx) -> acc + tx.amount   -- running balance history
signals /~> initState, transition               -- state machine trace
```

### Until Pipe `/*>` — Iterate until condition

Repeatedly applies a function until a predicate is satisfied. Returns the final value.

```lea
1 /*> (x) -> x * 2, (x) -> x > 100
-- yields 128 (keeps doubling until > 100)

guess /*> refine, converged         -- iterate until convergence
seed /*> nextRandom, (x) -> x < 0.1 -- generate until threshold

-- Newton's method example:
1.0 /*> (x) -> x - (x*x - 2)/(2*x), (x) -> abs(x*x - 2) < 0.0001
-- yields ~1.4142 (sqrt of 2)
```

### Other ideas (unexplored)

|>
+>
*>
>>>

## Windows

E.g. for a gaussian blur

### Window Pipe Operator /[n]>

where n is the width of the window (not the radius)
First value is our input, second value is index, third is window.

```lea
-- Window of size 3 (center + 1 on each side)
[1, 2, 3, 4, 5] /[3]> (x, i, window) -> avg(window)
-- window at position 2 would be [1, 2, 3]

-- Gaussian blur with weights
let width = 5
pixels /[width]> (x, i, w) -> gaussianWeight(w)
```

### Weighting

Weighted access: For a more sophisticated Gaussian blur, users will need positional info within window.

/[5]> (x, i, window) -> weightedAvg(window, gaussianKernel)

### Boundaries

By default, 
Padding with value undefined? or null? [[undefined,1,2], [1,2,3], ...]

Optionally,
Padding with value: [[0,1,2], [1,2,3], ...]

Option 3: Window Builtin (Composable)
-- Creates list of overlapping windows
[1, 2, 3, 4, 5] /> window(3) /> map((w) -> avg(w))
-- window(3) produces: [[1,2], [1,2,3], [2,3,4], [3,4,5], [4,5]]

-- Or centered with padding:
[1, 2, 3, 4, 5] /> windowCentered(3, 0) />> avg
-- produces windows: [[0,1,2], [1,2,3], [2,3,4], [3,4,5], [4,5,0]]



---

## Done

- [x] Implement ternary statements
- [x] Custom decorators
- [x] Linting for IDEs/VSCode
- [x] String interpolation / coercion (currently `++` only works with strings)
- [x] Early return
- [x] Additional syntax highlighting - \> operator, @Logger (orange colour?), #validate (a darker blue), the implicit or explicit return statement of a function
- [x] Codeblocks
- [x] Collapsing codeblocks (implicit, e.g. functions, and explicit) in the IDE, syntax highlighting (brown)
- [X] Multi-line ternary
- [x] First-class citizen: Pipeline
- [x] Autoformatting (Prettier-style formatter)

# todo

- [ ] Refinement Types (Liquid Haskell, F*) — Types with predicates. Not just int, but int where x > 0 && x < 100. The compiler proves your code satisfies the constraints.
- [x] Improve Pipeline.visualize() function to show parallelisation
- [ ] Canvas visualisation of our 'pipeline's
- [x] Multi-line records and arrays in parser
- [x] Implement #log_verbose to log input, output, and all variable assignment, or the values passed between pipeline stages
- [ ] Partitions
- [ ] Explicit types for pipelines
- [ ] List types syntax - ❌ List , ✅ [Int]
- [ ] Array vs value handling - resolve ambiguity
- [x] Pattern matching
- [ ] Record improvements
- [x] Split the interpreter up into smaller files

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

## Autoformatting - prettier style

Formatter - Auto-format Lea code (like Prettier)

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
|>
+>
*>
>>>

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

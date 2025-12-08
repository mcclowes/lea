# todo

- [ ] Refinement Types (Liquid Haskell, F*) — Types with predicates. Not just int, but int where x > 0 && x < 100. The compiler proves your code satisfies the constraints.
- [ ] Improve Pipeline.visualize() function to show parallelisation
- [ ] Canvas visualisation of our 'pipeline's
- [ ] Multi-line records and arrays in parser
- [ ] Implement #log-verbose to log input, output, and all variable assignment, or the values passed between pipeline stages
- [ ] Partitions
- [ ] Explicit types for pipelines
- [ ] List types syntax - ❌ List , ✅ [Int]
- [ ] Array vs value handling - resolve ambiguity
- [ ] Pattern matching
- [ ] Record improvements
- [ ] Split the interpreter up into smaller files

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

### New token - />>

```lea
let foo =
  \> (x) -> x + 1
  \> (x) -> x * 2
  />> print

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

[10, 10, 10] />> foo -- prints [11, 20] three times
```

```lea
let foo =
  /> double
  /> min(4, 5, 6)
  /> print

[1, 2, 3] />> foo -- would print 1, then 2, then 3, after comparing [1,4,5,6], [2,4,5,6], etc.
```

Equivalent
```lea
let foo =
  />> double
  />> min(4, 5, 6)
  /> print

[1, 2, 3] /> foo
```

Equivalent
```lea
let foo =
  />> double
  />> min(..._, 4, 5, 6) -- spread placeholder (this syntax is horrible though)
  /> print

[1, 2, 3] />> foo -- would print 1
```

## Other pipe variants

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

- [x] Implement ternary statements
- [x] Custom decorators
- [x] Linting for IDEs/VSCode
- [ ] Refinement Types (Liquid Haskell, F*) — Types with predicates. Not just int, but int where x > 0 && x < 100. The compiler proves your code satisfies the constraints.
- [ ] Canvas visualisation of our 'pipeline's
- [ ] String interpolation / coercion (currently `++` only works with strings)
- [ ] Multi-line records and arrays in parser
- [x] Early return
- [x] Additional syntax highlighting - \> operator, @Logger (orange colour?), #validate (a darker blue), the implicit or explicit return statement of a function
- [x] Codeblocks
- [x] Collapsing codeblocks (implicit, e.g. functions, and explicit) in the IDE, syntax highlighting (brown)
- [ ] Implement #log-verbose to log input, output, and all variable assignment
- [ ] Multi-line ternary
- [ ] First-class citizen: Pipeline
- [ ] Partitions

## Ternary (done)

```lea
let isEven = (x) -> x % 2 == 0 ? true : false
isEven(2) /> print  -- true
isEven(3) /> print  -- false
```

## Custom decorators (done)

```lea
decorator bump = (fn) -> (x) -> fn(x) + 1

let double = (x) -> x * 2 #bump
double(5) /> print  -- 11
```

## Simple iterating

If you want to do something 6 times...

```lea
let foo = (x) -> for(6)
  /> map
```

## Early return (done)

```lea
let clamp = (x) ->
  let doubled = x * 2
  doubled > 100 ? <- 100 : 0
  doubled + 1

clamp(10) /> print   -- 21 (no early return)
clamp(60) /> print   -- 100 (early return triggered)
```

## Codeblocks

```lea
<> -- Clamping logic

let clamp = (x) ->
  let doubled = x * 2
  doubled > 100 ? <- 100 : 0
  doubled + 1

clamp(10) /> print   -- 21 (no early return)
clamp(60) /> print   -- 100 (early return triggered)
<>
```

## Pipeline

Before:
```lea
-- Filter out zero components and format each
let buildParts = (components) ->
  components
    /> filter((c) -> fst(c) > 0)
    /> map((c) -> formatComponent(fst(c), snd(c)))
  
buildParts([a, b, c])
```

After:
```lea
-- Filter out zero components and format each
let buildParts = 
  /> filter((c) -> fst(c) > 0)
  /> map((c) -> formatComponent(fst(c), snd(c)))

[a, b, c] /> buildParts
```

Inbuilt pipeline functionality:
```lea
let p = /> filter(even) /> map(double) /> take(5)

p.stages        -- [filter, map, take]
p.length        -- 3
p.visualize()   -- prints ASCII diagram

-- Add stages dynamically
let extended = p /> sort
```

Pipelines can always compose.

```lea
let foo = /> reverse /> reverse
let bar = /> reverse /> reverse
let baz = /> foo /> bar
```

-- todo: define how types and pipes work together

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
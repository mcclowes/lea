- [x] Implement ternary statements
- [x] Custom decorators
- [x] Linting for IDEs/VSCode
- [ ] Refinement Types (Liquid Haskell, F*) — Types with predicates. Not just int, but int where x > 0 && x < 100. The compiler proves your code satisfies the constraints.
- [ ] Canvas visualisation of our 'pipeline's
- [ ] Refine for, while, do approaches
- [ ] String interpolation / coercion (currently `++` only works with strings)
- [ ] Multi-line records and arrays in parser

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

## Iterating

If you want to do something 6 times...

```lea
let foo = (x) -> for(6)
  /> map
```
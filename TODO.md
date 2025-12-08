- [ ] Implement turnery statements
- [ ] Linting for IDEs/VSCode
- [ ] Custom decorators (see below)
- [ ] Refinement Types (Liquid Haskell, F*) — Types with predicates. Not just int, but int where x > 0 && x < 100. The compiler proves your code satisfies the constraints.

## turnery

```lea
let isOdd = (x) -> x % 2 == 0 ? true : false

isOdd(1) # log -- expect false
isOdd(2) # log -- expect true
```

## Custom decorators

```lea
decorator bump = (x) -> x + 1

let foo = (x) -> x #bump
```
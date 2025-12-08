---
name: lea
# prettier-ignore
description: Use when writing or modifying Lea code - pipe-oriented functional language with tree-walk interpreter
---

# Lea Language

## Quick Start

```lea
let numbers = [1, 2, 3, 4, 5]

let result = numbers
  /> filter((x) -> x > 2)
  /> map((x) -> x * x)
  /> reduce(0, (acc, x) -> acc + x)

result /> print
```

## Core Principles

- **Pipes**: `value /> fn` passes value as first arg; use `_` placeholder to control position
- **Functions**: `let double = (x) -> x * 2` (no fn keyword)
- **Decorators**: Trailing `#log #memo #time` after function body
- **Bindings**: `let x = 10` immutable, `let mut x = 0` mutable

## Builtins

- Math: `sqrt`, `abs`, `floor`, `ceil`, `round`, `min`, `max`
- Lists: `length`, `head`, `tail`, `push`, `concat`, `map`, `filter`, `reduce`, `range`
- IO: `print` (returns first arg for chaining)

## Running

```bash
npm run repl    # Interactive REPL
npm run run x.lea   # Run a file
```

## Reference Files

- [references/syntax.md](references/syntax.md) - Full syntax reference
- [references/architecture.md](references/architecture.md) - Interpreter internals

# lea-lang

A pipe-oriented functional programming language, embeddable in TypeScript.

## Installation

```bash
npm install lea-lang
```

## Quick Start

```typescript
import { lea } from 'lea-lang';

// Simple pipe chain
const result = lea`
  [1, 2, 3, 4, 5]
    /> filter((x) -> x > 2)
    /> map((x) -> x * x)
    /> reduce(0, (acc, x) -> acc + x)
`;
// result = 50
```

## JavaScript Interop

Interpolate JS values and functions directly into Lea code:

```typescript
import { lea } from 'lea-lang';

// Interpolate values
const data = [1, 2, 3, 4, 5];
const threshold = 2;

const filtered = lea`${data} /> filter((x) -> x > ${threshold})`;
// [3, 4, 5]

// Interpolate functions
const double = (x: number) => x * 2;
const doubled = lea`${data} /> map(${double})`;
// [2, 4, 6, 8, 10]

// Records work too
const user = { name: "Max", age: 99 };
const name = lea`${user}.name`;
// "Max"
```

## Async Support

Use `leaAsync` for code with `await`:

```typescript
import { leaAsync } from 'lea-lang';

const result = await leaAsync`
  await delay(100)
  "done"
`;
```

## Execution Context

Use `createLea` for reusable contexts with pre-defined bindings:

```typescript
import { createLea } from 'lea-lang';

const ctx = createLea({
  data: [10, 20, 30],
  multiplier: 2,
  transform: (x: number) => x * 10,
});

ctx.run(`data /> map((x) -> x * multiplier)`);
// [20, 40, 60]

ctx.run(`data /> map(transform)`);
// [100, 200, 300]

// Async support
await ctx.runAsync(`await delay(100)`);
```

## Lea Syntax Highlights

```lea
-- Pipes: value flows left to right
5 /> double /> print

-- Functions
let double = (x) -> x * 2

-- Spread pipe: map over lists concisely
[1, 2, 3] />>> (x) -> x * 2
-- [2, 4, 6]

-- Filter and reduce
[1, 2, 3, 4, 5]
  /> filter((x) -> x > 2)
  /> reduce(0, (acc, x) -> acc + x)

-- Records
let user = { name: "Max", age: 99 }
user.name /> print

-- Pattern matching
let describe = (x) -> match x
  | 0 -> "zero"
  | if input > 100 -> "big"
  | "other"
```

## API Reference

### `lea`

Tagged template literal for synchronous Lea execution.

```typescript
function lea(strings: TemplateStringsArray, ...values: unknown[]): unknown
```

### `leaAsync`

Tagged template literal for async Lea execution (supports `await`).

```typescript
function leaAsync(strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown>
```

### `createLea`

Create a reusable execution context with bindings.

```typescript
function createLea(bindings?: Record<string, unknown>): {
  run(source: string): unknown;
  runAsync(source: string): Promise<unknown>;
  set(name: string, value: unknown): void;
  bindings: Record<string, unknown>;
}
```

## Links

- [GitHub Repository](https://github.com/mcclowes/lea)
- [Full Language Documentation](https://github.com/mcclowes/lea/blob/main/CLAUDE.md)
- [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=mcclowes.lea-language)

## License

MIT

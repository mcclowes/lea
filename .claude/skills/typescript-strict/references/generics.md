# Advanced Generic Patterns

## Constrained Generics

```typescript
// Ensure T has a specific property
function getLength<T extends { length: number }>(item: T): number {
  return item.length;
}

// Multiple constraints
function merge<T extends object, U extends object>(a: T, b: U): T & U {
  return { ...a, ...b };
}
```

## Generic AST Visitors

```typescript
type Visitor<T> = {
  [K in Expr["type"]]?: (node: Extract<Expr, { type: K }>) => T;
};

function visit<T>(expr: Expr, visitor: Visitor<T>): T | undefined {
  const handler = visitor[expr.type];
  return handler?.(expr as any);
}

// Usage
const result = visit(expr, {
  NumberLiteral: (n) => n.value,
  BinaryExpr: (b) => `${b.op} expression`,
});
```

## Mapped Types

```typescript
// Make all properties optional
type Partial<T> = { [K in keyof T]?: T[K] };

// Make all properties required
type Required<T> = { [K in keyof T]-?: T[K] };

// Make all properties readonly
type Readonly<T> = { readonly [K in keyof T]: T[K] };
```

## Conditional Types

```typescript
// Extract return type
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

// Unwrap Promise
type Awaited<T> = T extends Promise<infer U> ? Awaited<U> : T;

// Extract specific node type
type ExtractNode<T, Type extends string> = T extends { type: Type } ? T : never;
```

## Template Literal Types

```typescript
type EventName<T extends string> = `on${Capitalize<T>}`;
type ClickEvent = EventName<"click">; // "onClick"

// Token type names
type TokenName = `TOKEN_${Uppercase<string>}`;
```

## Variadic Tuple Types

```typescript
// Spread in tuples
type Concat<T extends unknown[], U extends unknown[]> = [...T, ...U];

// Function parameter manipulation
type Parameters<T extends (...args: any[]) => any> = T extends (...args: infer P) => any ? P : never;
```

# Type Guards and Narrowing

## User-Defined Type Guards

```typescript
// Basic type guard
function isString(value: unknown): value is string {
  return typeof value === "string";
}

// AST node type guard
function isNumberLiteral(expr: Expr): expr is NumberLiteral {
  return expr.type === "NumberLiteral";
}

// Array type guard
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}
```

## Discriminated Unions

```typescript
type Expr =
  | { type: "NumberLiteral"; value: number }
  | { type: "StringLiteral"; value: string }
  | { type: "BinaryExpr"; op: string; left: Expr; right: Expr };

function evaluate(expr: Expr): number | string {
  switch (expr.type) {
    case "NumberLiteral":
      return expr.value; // TypeScript knows this is number
    case "StringLiteral":
      return expr.value; // TypeScript knows this is string
    case "BinaryExpr":
      // TypeScript knows left, right, op exist
      return evaluate(expr.left);
  }
}
```

## Assertion Functions

```typescript
function assertIsNumber(value: unknown): asserts value is number {
  if (typeof value !== "number") {
    throw new Error(`Expected number, got ${typeof value}`);
  }
}

// Usage
function double(value: unknown): number {
  assertIsNumber(value);
  return value * 2; // TypeScript knows value is number
}
```

## in Operator Narrowing

```typescript
interface Dog { bark(): void }
interface Cat { meow(): void }

function speak(animal: Dog | Cat) {
  if ("bark" in animal) {
    animal.bark(); // Dog
  } else {
    animal.meow(); // Cat
  }
}
```

## instanceof Narrowing

```typescript
class ParseError extends Error {
  constructor(public line: number, message: string) {
    super(message);
  }
}

function handleError(error: unknown) {
  if (error instanceof ParseError) {
    console.log(`Line ${error.line}: ${error.message}`);
  }
}
```

## Truthiness Narrowing

```typescript
function printValue(value: string | null | undefined) {
  if (value) {
    console.log(value.toUpperCase()); // string
  }
}
```

## Control Flow Analysis

```typescript
function process(value: string | number) {
  if (typeof value === "string") {
    return value.toUpperCase();
  }
  // TypeScript knows value is number here
  return value.toFixed(2);
}
```

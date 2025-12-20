# Builtin Function Design

## Builtin Registry

```typescript
type BuiltinFn = (args: Value[], env: Environment) => Value;

interface BuiltinDef {
  name: string;
  arity: number | { min: number; max: number };
  fn: BuiltinFn;
  description: string;
  signature: string;
}

const BUILTINS: Map<string, BuiltinDef> = new Map();

function defineBuiltin(def: BuiltinDef): void {
  BUILTINS.set(def.name, def);
}
```

## Core Builtins

### Math

```typescript
defineBuiltin({
  name: "abs",
  arity: 1,
  fn: ([x]) => Math.abs(asNumber(x)),
  description: "Returns the absolute value",
  signature: "abs(x: Number) -> Number",
});

defineBuiltin({
  name: "min",
  arity: { min: 1, max: Infinity },
  fn: (args) => Math.min(...args.map(asNumber)),
  description: "Returns the minimum value",
  signature: "min(...numbers: Number) -> Number",
});

defineBuiltin({
  name: "max",
  arity: { min: 1, max: Infinity },
  fn: (args) => Math.max(...args.map(asNumber)),
  description: "Returns the maximum value",
  signature: "max(...numbers: Number) -> Number",
});
```

### Lists

```typescript
defineBuiltin({
  name: "length",
  arity: 1,
  fn: ([list]) => asList(list).length,
  description: "Returns the length of a list",
  signature: "length(list: List) -> Number",
});

defineBuiltin({
  name: "map",
  arity: 2,
  fn: ([list, fn], env) => {
    return asList(list).map((item, index) => {
      return callFunction(fn, [item, index], env);
    });
  },
  description: "Transforms each element",
  signature: "map(list: List, fn: (item, index) -> T) -> List<T>",
});

defineBuiltin({
  name: "filter",
  arity: 2,
  fn: ([list, fn], env) => {
    return asList(list).filter((item, index) => {
      return isTruthy(callFunction(fn, [item, index], env));
    });
  },
  description: "Filters elements by predicate",
  signature: "filter(list: List, fn: (item, index) -> Boolean) -> List",
});

defineBuiltin({
  name: "reduce",
  arity: 3,
  fn: ([list, initial, fn], env) => {
    return asList(list).reduce((acc, item, index) => {
      return callFunction(fn, [acc, item, index], env);
    }, initial);
  },
  description: "Reduces list to a single value",
  signature: "reduce(list: List, initial: T, fn: (acc, item, index) -> T) -> T",
});
```

### IO

```typescript
defineBuiltin({
  name: "print",
  arity: 1,
  fn: ([value]) => {
    console.log(stringify(value));
    return value; // Return for chaining
  },
  description: "Prints a value and returns it",
  signature: "print(value: Any) -> Any",
});
```

### Type Checking

```typescript
defineBuiltin({
  name: "type",
  arity: 1,
  fn: ([value]) => {
    if (value === null) return "null";
    if (Array.isArray(value)) return "List";
    if (typeof value === "object") return "Record";
    return capitalize(typeof value);
  },
  description: "Returns the type of a value",
  signature: "type(value: Any) -> String",
});

defineBuiltin({
  name: "isNumber",
  arity: 1,
  fn: ([value]) => typeof value === "number",
  description: "Checks if value is a number",
  signature: "isNumber(value: Any) -> Boolean",
});
```

## Helper Functions

```typescript
function asNumber(value: Value): number {
  if (typeof value !== "number") {
    throw new TypeError(`Expected Number, got ${typeOf(value)}`);
  }
  return value;
}

function asList(value: Value): Value[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`Expected List, got ${typeOf(value)}`);
  }
  return value;
}

function asFunction(value: Value): FunctionValue {
  if (typeof value !== "function" && !isFunctionValue(value)) {
    throw new TypeError(`Expected Function, got ${typeOf(value)}`);
  }
  return value;
}

function isTruthy(value: Value): boolean {
  if (value === false || value === null || value === undefined) return false;
  if (value === 0) return false;
  if (value === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}
```

## Variadic Arguments

```typescript
function checkArity(name: string, args: Value[], arity: number | { min: number; max: number }): void {
  if (typeof arity === "number") {
    if (args.length !== arity) {
      throw new RuntimeError(`${name} expects ${arity} arguments, got ${args.length}`);
    }
  } else {
    if (args.length < arity.min) {
      throw new RuntimeError(`${name} expects at least ${arity.min} arguments, got ${args.length}`);
    }
    if (args.length > arity.max) {
      throw new RuntimeError(`${name} expects at most ${arity.max} arguments, got ${args.length}`);
    }
  }
}
```

# Mocking Strategies

## Basic Mocking

```typescript
// Mock a module
jest.mock("../src/utils");

// Mock with implementation
jest.mock("../src/api", () => ({
  fetchData: jest.fn().mockResolvedValue({ data: "test" }),
}));
```

## Mocking Functions

```typescript
// Create a mock function
const mockFn = jest.fn();

// With return value
const mockAdd = jest.fn().mockReturnValue(5);

// With implementation
const mockCalculate = jest.fn((a, b) => a + b);

// Different returns per call
const mockSequence = jest.fn()
  .mockReturnValueOnce(1)
  .mockReturnValueOnce(2)
  .mockReturnValue(3);
```

## Mocking Builtins for Interpreter

```typescript
describe("print builtin", () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("prints to console", () => {
    run('"hello" /> print');
    expect(consoleSpy).toHaveBeenCalledWith("hello");
  });
});
```

## Mocking Timers

```typescript
describe("delay builtin", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("delays execution", async () => {
    const promise = run("delay(1000)");
    jest.advanceTimersByTime(1000);
    await expect(promise).resolves.toBeUndefined();
  });
});
```

## Mocking Modules

```typescript
// __mocks__/fs.ts
export const readFileSync = jest.fn();
export const writeFileSync = jest.fn();

// In test
jest.mock("fs");
import { readFileSync } from "fs";

it("reads file", () => {
  (readFileSync as jest.Mock).mockReturnValue("content");
  // ...
});
```

## Spying on Methods

```typescript
const interpreter = new Interpreter();
const evaluateSpy = jest.spyOn(interpreter, "evaluate");

interpreter.run("2 + 3");

expect(evaluateSpy).toHaveBeenCalled();
expect(evaluateSpy).toHaveBeenCalledWith(expect.objectContaining({
  type: "BinaryExpr",
}));
```

## Clearing and Resetting

```typescript
beforeEach(() => {
  jest.clearAllMocks();  // Clear call history
  // or
  jest.resetAllMocks();  // Clear history + reset implementations
  // or
  jest.restoreAllMocks(); // Restore original implementations
});
```

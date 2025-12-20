# Async Test Patterns

## Basic Async Tests

```typescript
// Using async/await
it("resolves async value", async () => {
  const result = await run("await delay(10)");
  expect(result).toBeDefined();
});

// Using promises
it("resolves async value", () => {
  return run("await delay(10)").then((result) => {
    expect(result).toBeDefined();
  });
});
```

## Testing Rejections

```typescript
// Expect rejection
it("rejects on error", async () => {
  await expect(run("await reject()")).rejects.toThrow("error");
});

// Using try/catch
it("catches error", async () => {
  try {
    await run("await reject()");
    fail("Expected error");
  } catch (error) {
    expect(error.message).toContain("error");
  }
});
```

## Testing Parallel Operations

```typescript
it("runs operations in parallel", async () => {
  const start = Date.now();

  await run(`
    let a = delay(100) #async
    let b = delay(100) #async
    [await a, await b]
  `);

  const elapsed = Date.now() - start;
  expect(elapsed).toBeLessThan(150); // Should be ~100ms, not 200ms
});
```

## Fake Timers with Async

```typescript
it("handles delayed operations", async () => {
  jest.useFakeTimers();

  const promise = run("await delay(5000)");

  // Fast-forward time
  jest.advanceTimersByTime(5000);

  // Wait for promise to resolve
  await promise;

  jest.useRealTimers();
});
```

## Testing Event Streams

```typescript
it("collects events", async () => {
  const events: string[] = [];

  const result = await run(`
    [1, 2, 3]
      /> map((x) -> { emit("item"); x })
  `, {
    onEmit: (event) => events.push(event),
  });

  expect(events).toEqual(["item", "item", "item"]);
});
```

## Timeout Handling

```typescript
// Set custom timeout for slow tests
it("handles long operation", async () => {
  const result = await run("heavyComputation()");
  expect(result).toBeDefined();
}, 10000); // 10 second timeout

// Global timeout
jest.setTimeout(10000);
```

## Concurrent Tests

```typescript
describe("concurrent tests", () => {
  it.concurrent("test 1", async () => {
    await run("delay(100)");
  });

  it.concurrent("test 2", async () => {
    await run("delay(100)");
  });

  // These run in parallel
});
```

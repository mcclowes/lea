# Concurrency & Parallelization in Lea

This document describes the design for concurrency and parallelization features in Lea.

## Design Philosophy

Lea's concurrency model embraces:

1. **Functional purity** — Parallelism is safe because of immutability by default
2. **Pipe composition** — Async flows compose naturally with pipes
3. **Explicit over implicit** — Clear markers for concurrent operations
4. **Declarative parallelism** — Describe *what* can be parallel, not *how*

## Core Features

### 1. True Async/Await

Functions marked with `#async` can use `await` internally:

```lea
let fetchUser = (id) ->
  let response = await fetch("/users/" ++ id)
  parseJson(response)
#async

let user = await fetchUser("123")
user.name /> print
```

### 2. Parallel Pipe Operator `\>`

The `\>` operator "fans out" a value to multiple parallel computations. Consecutive `\>` operations execute concurrently:

```lea
let result = input
  \> (x) -> expensiveOp1(x)
  \> (x) -> expensiveOp2(x)
  \> (x) -> expensiveOp3(x)
-- Returns [result1, result2, result3] after all complete
```

#### Fan-Out / Fan-In Pattern

The parallel pipe combines elegantly with the regular pipe for fan-in:

```lea
let result = input
  \> (x) -> x + 1
  \> (x) -> x * 2
  /> (a, b) -> a + b + 3

-- Execution:
-- 1. input fans out to both parallel operations
-- 2. (x + 1) and (x * 2) execute concurrently
-- 3. Results [a, b] feed into /> as arguments
-- 4. Returns (input + 1) + (input * 2) + 3
```

#### Visual Model

```
        ┌─── \> f(x) ───┐
input ──┼─── \> g(x) ───┼─── /> combine(a, b, c) ─── result
        └─── \> h(x) ───┘
         (parallel)         (sequential)
```

### 3. Promise-Aware Pipes

The standard pipe `/>` automatically awaits promises on the left side:

```lea
fetchUser("123")
  /> (user) -> user.name    -- auto-awaits fetchUser result
  /> print
```

This means async operations compose seamlessly in pipe chains.

### 4. `parallel` Builtin

For parallel mapping over collections:

```lea
let urls = ["url1", "url2", "url3"]

-- Process all URLs concurrently
let results = urls /> parallel(fetch)

-- With concurrency limit
let results = urls /> parallel(fetch, { limit: 3 })
```

### 5. `race` Builtin

Returns the first result to complete:

```lea
let fastest = [
  () -> fetchFromServer1(),
  () -> fetchFromServer2()
] /> race
```

### 6. `#parallel` Decorator

Automatic parallelization of map operations within a function:

```lea
let processItems = (items) ->
  items /> map((x) -> expensiveTransform(x))
#parallel

-- With concurrency limit
let processItems = (items) ->
  items /> map((x) -> expensiveTransform(x))
#parallel(4)
```

### 7. Structured Concurrency

The `concurrent` block runs all awaits in parallel:

```lea
let userData = concurrent
  let user = await fetchUser(id)
  let posts = await fetchPosts(id)
  let friends = await fetchFriends(id)
in
  { user: user, posts: posts, friends: friends }
```

All three fetches execute concurrently; the block completes when all finish.

### 8. Channels (CSP-Style)

For complex coordination patterns:

```lea
let ch = channel()

let producer = () ->
  range(1, 10) /> each((x) -> ch /> send(x))
  ch /> close
#async

let consumer = () ->
  ch /> receive /> each((x) -> x /> print)
#async

[producer, consumer] /> parallel
```

### 9. `#spawn` Decorator

Fire-and-forget execution:

```lea
let logEvent = (event) ->
  sendToAnalytics(event)
#spawn

-- Returns immediately, doesn't block
logEvent({ type: "click" })
```

## Token Types

New tokens for concurrency:

| Token | Symbol | Purpose |
|-------|--------|---------|
| `PARALLEL_PIPE` | `\>` | Parallel fan-out operator |
| `CONCURRENT` | `concurrent` | Structured concurrency block |
| `IN` | `in` | Concurrent block result expression |
| `CHANNEL` | `channel` | Channel constructor keyword |

## AST Nodes

### ParallelPipeExpr

```typescript
interface ParallelPipeExpr {
  kind: "ParallelPipeExpr";
  input: Expr;
  branches: Expr[];  // Functions to execute in parallel
}
```

### ConcurrentExpr

```typescript
interface ConcurrentExpr {
  kind: "ConcurrentExpr";
  bindings: { name: string; value: Expr }[];
  body: Expr;
}
```

## Syntax Summary

| Feature | Syntax | Purpose |
|---------|--------|---------|
| Async function | `fn #async` | Mark function as async |
| Await | `await expr` | Wait for promise |
| Parallel pipe | `x \> f \> g` | Fan-out to parallel ops |
| Fan-in | `x \> f \> g /> combine` | Parallel then combine |
| Parallel map | `list /> parallel(fn)` | Map with concurrency |
| Race | `[f, g] /> race` | First to complete wins |
| Concurrent block | `concurrent ... in ...` | Structured concurrency |
| Channel | `channel()`, `send`, `receive` | CSP communication |
| Spawn | `fn #spawn` | Fire-and-forget |

## Examples

### Parallel Data Fetching

```lea
let loadDashboard = (userId) ->
  userId
    \> fetchUserProfile
    \> fetchUserPosts
    \> fetchUserNotifications
    /> (profile, posts, notifications) -> {
      profile: profile,
      posts: posts,
      notifications: notifications
    }
#async
```

### Concurrent API Calls with Limit

```lea
let fetchAllUsers = (ids) ->
  ids /> parallel(fetchUser, { limit: 5 })
#async

await fetchAllUsers(["1", "2", "3", "4", "5"])
  /> filter((u) -> u.active)
  /> map((u) -> u.name)
  /> print
```

### Racing Multiple Sources

```lea
let fetchWithFallback = (id) ->
  [
    () -> fetchFromPrimary(id),
    () -> delay(1000) /> then((_) -> fetchFromBackup(id))
  ] /> race
#async
```

### Producer-Consumer Pipeline

```lea
let processStream = (inputChannel, outputChannel) ->
  inputChannel
    /> receive
    /> map(transform)
    /> each((x) -> outputChannel /> send(x))
#async
```

## Implementation Priority

1. **Fix `await` in function bodies** — Core requirement
2. **Promise-aware pipes** — Auto-await in pipe chains
3. **Parallel pipe `\>`** — Primary parallelism primitive
4. **`parallel` builtin** — Parallel map over collections
5. **`race` builtin** — Common pattern
6. **`#parallel` decorator** — Convenience for map
7. **`concurrent` blocks** — Structured concurrency
8. **Channels** — Advanced coordination

## Implementation Notes

### Interpreter Changes Required

1. **Async context tracking** — Interpreter must track when in async context
2. **Promise propagation** — Return `LeaPromise` values up the call stack
3. **Auto-await in pipes** — `/>` should await left-side promises
4. **Parallel execution** — Use `Promise.all` for `\>` branches
5. **Race semantics** — Use `Promise.race` for race builtin

### Parser Changes Required

1. **New token `\>`** — Lexer must recognize backslash-greater-than
2. **Parallel pipe parsing** — Collect consecutive `\>` operations
3. **Concurrent block** — New expression form with bindings

### Runtime Considerations

- Parallel operations use JavaScript's event loop for I/O concurrency
- True CPU parallelism could use Worker threads for `#parallel` decorator
- Channels implemented as async iterators internally

# Concurrency in Lea

Lea provides concurrency primitives that embrace functional purity and pipe composition.

## Core Concepts

1. **Functional purity** — Parallelism is safe because of immutability by default
2. **Pipe composition** — Async flows compose naturally with pipes
3. **Explicit over implicit** — Clear markers for concurrent operations

## Async/Await

Functions marked with `#async` return promises and can use `await`:

```lea
let fetchData = () -> delay(100) #async

await fetchData() /> print
```

The standard pipe `/>` automatically awaits promises on the left side, so async operations compose seamlessly:

```lea
fetchUser("123")
  /> (user) -> user.name    -- auto-awaits fetchUser result
  /> print
```

## Parallel Pipe Operator `\>`

The `\>` operator fans out a value to multiple parallel computations. Consecutive `\>` operations execute concurrently:

```lea
let result = input
  \> (x) -> expensiveOp1(x)
  \> (x) -> expensiveOp2(x)
  \> (x) -> expensiveOp3(x)
-- Returns [result1, result2, result3] after all complete
```

### Fan-Out / Fan-In Pattern

Combine parallel pipes with regular pipes for fan-in:

```lea
let result = input
  \> (x) -> x + 1
  \> (x) -> x * 2
  /> (a, b) -> a + b

-- Execution:
-- 1. input fans out to both parallel operations
-- 2. (x + 1) and (x * 2) execute concurrently
-- 3. Results [a, b] feed into /> as arguments
```

Visual model:

```
        ┌─── \> f(x) ───┐
input ──┼─── \> g(x) ───┼─── /> combine(a, b, c) ─── result
        └─── \> h(x) ───┘
         (parallel)         (sequential)
```

### Nested Pipes in Parallel Branches

Branches can contain nested pipes (must be more indented):

```lea
value
  \> head
  \> tail
    /> transform
    /> process
  /> combine
```

## `parallel` Builtin

For parallel mapping over collections:

```lea
let urls = ["url1", "url2", "url3"]

-- Process all URLs concurrently
let results = urls /> parallel(fetch)

-- With concurrency limit
let results = urls /> parallel(fetch, { limit: 3 })
```

The callback receives `(element, index)` like other collection functions.

## `race` Builtin

Returns the first result to complete:

```lea
let fastest = [
  () -> fetchFromServer1(),
  () -> fetchFromServer2()
] /> race
```

## `then` Builtin

Chain promise transformations:

```lea
fetchUser("123")
  /> then((user) -> fetchPosts(user.id))
  /> then((posts) -> posts.length)
  /> print
```

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

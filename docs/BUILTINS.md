# Built-in Functions & Decorators

## Math Functions

| Function | Description | Example |
|----------|-------------|---------|
| `sqrt(x)` | Square root | `sqrt(16)` → `4` |
| `abs(x)` | Absolute value | `abs(-5)` → `5` |
| `floor(x)` | Round down | `floor(3.7)` → `3` |
| `ceil(x)` | Round up | `ceil(3.2)` → `4` |
| `round(x)` | Round to nearest | `round(3.5)` → `4` |
| `min(a, b)` | Minimum value | `min(3, 7)` → `3` |
| `max(a, b)` | Maximum value | `max(3, 7)` → `7` |

## Random Functions

| Function | Description | Example |
|----------|-------------|---------|
| `random()` | Random float in [0, 1) | `random()` → `0.742...` |
| `randomInt(max)` | Random int in [0, max) | `randomInt(10)` → `7` |
| `randomInt(min, max)` | Random int in [min, max) | `randomInt(5, 10)` → `8` |
| `randomFloat(max)` | Random float in [0, max) | `randomFloat(10)` → `7.3...` |
| `randomFloat(min, max)` | Random float in [min, max) | `randomFloat(5, 10)` → `8.2...` |
| `randomChoice(list)` | Random element from list | `randomChoice([1,2,3])` → `2` |
| `shuffle(list)` | Shuffled copy (Fisher-Yates) | `shuffle([1,2,3])` → `[3,1,2]` |

## List Functions

| Function | Description | Example |
|----------|-------------|---------|
| `length(list)` | Number of elements | `length([1,2,3])` → `3` |
| `head(list)` | First element | `head([1,2,3])` → `1` |
| `tail(list)` | All except first | `tail([1,2,3])` → `[2,3]` |
| `push(list, item)` | Append item | `push([1,2], 3)` → `[1,2,3]` |
| `concat(a, b)` | Join two lists | `concat([1,2], [3,4])` → `[1,2,3,4]` |
| `reverse(list)` | Reverse order | `reverse([1,2,3])` → `[3,2,1]` |
| `zip(a, b)` | Pair elements | `zip([1,2], ["a","b"])` → `[[1,"a"],[2,"b"]]` |
| `isEmpty(list)` | Check if empty | `isEmpty([])` → `true` |
| `range(start, end)` | Generate range | `range(1, 4)` → `[1,2,3]` |
| `take(list, n)` | First n elements | `take([1,2,3,4], 2)` → `[1,2]` |
| `at(list, index)` | Element at index | `at([1,2,3], 1)` → `2` |
| `partition(list, fn)` | Split by predicate | `partition([1,2,3], (x) -> x > 1)` → `[[2,3], [1]]` |
| `iterations(n, fn)` | Apply fn n times | `iterations(3, (x) -> x * 2)(1)` → `8` |

### Higher-Order List Functions

All callbacks receive `(element, index)`:

```lea
[1, 2, 3] /> map((x) -> x * 2)              -- [2, 4, 6]
[1, 2, 3] /> map((x, i) -> `{i}: {x}`)      -- ["0: 1", "1: 2", "2: 3"]

[1, 2, 3, 4] /> filter((x) -> x > 2)        -- [3, 4]
[1, 2, 3, 4] /> filter((_, i) -> i < 2)     -- [1, 2]

[1, 2, 3] /> reduce(0, (acc, x) -> acc + x)           -- 6
[1, 2, 3] /> reduce("", (acc, x, i) -> acc ++ `{i}`)  -- "012"
```

## Tuple Functions

| Function | Description | Example |
|----------|-------------|---------|
| `fst(tuple)` | First element | `fst((1, 2))` → `1` |
| `snd(tuple)` | Second element | `snd((1, 2))` → `2` |

## String Functions

| Function | Description | Example |
|----------|-------------|---------|
| `split(str, delim)` | Split string | `split("a,b,c", ",")` → `["a","b","c"]` |
| `lines(str)` | Split by newlines | `lines("a\nb")` → `["a","b"]` |
| `charAt(str, i)` | Character at index | `charAt("hello", 1)` → `"e"` |
| `join(list, delim?)` | Join to string | `join(["a","b"], "-")` → `"a-b"` |
| `padEnd(str, len, char?)` | Pad end | `padEnd("hi", 5)` → `"hi   "` |
| `padStart(str, len, char?)` | Pad start | `padStart("hi", 5)` → `"   hi"` |
| `trim(str)` | Remove whitespace | `trim("  hi  ")` → `"hi"` |
| `trimEnd(str)` | Remove trailing ws | `trimEnd("hi  ")` → `"hi"` |
| `indexOf(str, search)` | Find index | `indexOf("hello", "l")` → `2` |
| `includes(str, item)` | Contains substring | `includes("hello", "ell")` → `true` |
| `repeat(str, n)` | Repeat string | `repeat("ab", 3)` → `ababab"` |
| `slice(str, start, end?)` | Extract substring | `slice("hello", 1, 3)` → `"el"` |
| `chars(str)` | Split to chars | `chars("hi")` → `["h","i"]` |
| `toString(value)` | Convert to string | `toString(42)` → `"42"` |

## Set Operations (on Lists)

| Function | Description | Example |
|----------|-------------|---------|
| `listSet(list)` | Unique elements | `listSet([1,1,2])` → `[1,2]` |
| `setAdd(list, item)` | Add if not present | `setAdd([1,2], 3)` → `[1,2,3]` |
| `setHas(list, item)` | Check membership | `setHas([1,2], 2)` → `true` |

## I/O Functions

| Function | Description | Example |
|----------|-------------|---------|
| `print(value)` | Print and return value | `print("hi")` → prints "hi", returns "hi" |

## Async Functions

| Function | Description | Example |
|----------|-------------|---------|
| `delay(ms, value?)` | Resolve after delay | `delay(100)` |
| `parallel(list, fn, opts?)` | Concurrent map | `parallel(urls, fetch, { limit: 3 })` |
| `race(fns)` | First to complete | `race([fn1, fn2])` |
| `then(promise, fn)` | Chain transformation | `then(promise, (x) -> x * 2)` |

## Special Functions

| Function | Description | Example |
|----------|-------------|---------|
| `breakPieces(shape)` | Parse ASCII diagram into minimal closed pieces | `breakPieces(asciiShape)` |

---

## Decorators

### Function Decorators

| Decorator | Description | Example |
|-----------|-------------|---------|
| `#log` | Log inputs/outputs | `(x) -> x * 2 #log` |
| `#log_verbose` | Detailed logging with timing | `(x) -> x * 2 #log_verbose` |
| `#memo` | Cache results | `(x) -> expensive(x) #memo` |
| `#time` | Log execution time | `(x) -> slow(x) #time` |
| `#retry(n)` | Retry on failure | `(x) -> risky(x) #retry(3)` |
| `#timeout(ms)` | Fail if exceeds time | `(x) -> slow(x) #timeout(1000)` |
| `#validate` | Runtime type checking | `(x) -> x :: Int :> Int #validate` |
| `#pure` | Warn if side effects | `(x) -> x * 2 #pure` |
| `#async` | Mark as async | `() -> delay(100) #async` |
| `#trace` | Deep call logging | `(x) -> recurse(x) #trace` |

### Type Coercion Decorators

| Decorator | Description | Example |
|-----------|-------------|---------|
| `#coerce(Type)` | Coerce input to type | `(x) -> x * 2 #coerce(Int)` |
| `#parse` | Parse string as JSON/number | `(x) -> x #parse` |
| `#stringify` | Convert output to string | `(x) -> x #stringify` |
| `#tease(Type)` | Best-effort extraction | `(x) -> x #tease(Int)` extracts `42` from `"42px"` |

### Pipeline Decorators

| Decorator | Description | Example |
|-----------|-------------|---------|
| `#log` | Log pipeline input/output | `/> fn1 /> fn2 #log` |
| `#log_verbose` | Stage-by-stage logging | `/> fn1 /> fn2 #log_verbose` |
| `#memo` | Cache pipeline results | `/> fn1 /> fn2 #memo` |
| `#time` | Log total execution time | `/> fn1 /> fn2 #time` |
| `#tap` | Inspect without modifying | `/> fn1 /> fn2 #tap` |
| `#tap("fn")` | Call named function | `/> fn1 /> fn2 #tap("debug")` |
| `#debug` | Stage-by-stage execution log | `/> fn1 /> fn2 #debug` |
| `#profile` | Timing breakdown per stage | `/> fn1 /> fn2 #profile` |
| `#trace` | Nested call tracing | `/> fn1 /> fn2 #trace` |

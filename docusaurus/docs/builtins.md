---
sidebar_position: 6
---

# Built-in Functions & Decorators

## Math Functions

### Basic Math

| Function | Description | Example |
|----------|-------------|---------|
| `sqrt(x)` | Square root | `sqrt(16)` -> `4` |
| `abs(x)` | Absolute value | `abs(-5)` -> `5` |
| `floor(x)` | Round down | `floor(3.7)` -> `3` |
| `ceil(x)` | Round up | `ceil(3.2)` -> `4` |
| `round(x)` | Round to nearest | `round(3.5)` -> `4` |
| `trunc(x)` | Truncate decimal | `trunc(3.9)` -> `3` |
| `sign(x)` | Sign of number | `sign(-5)` -> `-1` |
| `min(a, b, ...)` | Minimum value | `min(3, 7, 1)` -> `1` |
| `max(a, b, ...)` | Maximum value | `max(3, 7, 1)` -> `7` |
| `clamp(x, min, max)` | Clamp to range | `clamp(15, 0, 10)` -> `10` |
| `lerp(a, b, t)` | Linear interpolation | `lerp(0, 10, 0.5)` -> `5` |

### Powers & Logarithms

| Function | Description | Example |
|----------|-------------|---------|
| `pow(base, exp)` | Power | `pow(2, 3)` -> `8` |
| `exp(x)` | e^x | `exp(1)` -> `2.718...` |
| `log(x)` | Natural log | `log(E())` -> `1` |
| `log(x, base)` | Log with base | `log(8, 2)` -> `3` |
| `log10(x)` | Log base 10 | `log10(100)` -> `2` |
| `log2(x)` | Log base 2 | `log2(8)` -> `3` |

### Trigonometry

| Function | Description | Example |
|----------|-------------|---------|
| `sin(x)` | Sine (radians) | `sin(PI() / 2)` -> `1` |
| `cos(x)` | Cosine (radians) | `cos(0)` -> `1` |
| `tan(x)` | Tangent (radians) | `tan(0)` -> `0` |
| `asin(x)` | Arc sine | `asin(1)` -> `1.57...` |
| `acos(x)` | Arc cosine | `acos(1)` -> `0` |
| `atan(x)` | Arc tangent | `atan(1)` -> `0.785...` |
| `atan2(y, x)` | Arc tangent of y/x | `atan2(1, 1)` -> `0.785...` |
| `sinh(x)` | Hyperbolic sine | `sinh(0)` -> `0` |
| `cosh(x)` | Hyperbolic cosine | `cosh(0)` -> `1` |
| `tanh(x)` | Hyperbolic tangent | `tanh(0)` -> `0` |

### Constants

| Function | Description | Value |
|----------|-------------|-------|
| `PI()` | Pi constant | `3.14159...` |
| `E()` | Euler's number | `2.71828...` |
| `TAU()` | Tau (2*PI) | `6.28318...` |
| `INFINITY()` | Positive infinity | `Infinity` |

## Random Functions

| Function | Description | Example |
|----------|-------------|---------|
| `random()` | Random float in [0, 1) | `random()` -> `0.742...` |
| `randomInt(max)` | Random int in [0, max) | `randomInt(10)` -> `7` |
| `randomInt(min, max)` | Random int in [min, max) | `randomInt(5, 10)` -> `8` |
| `randomFloat(max)` | Random float in [0, max) | `randomFloat(10)` -> `7.3...` |
| `randomFloat(min, max)` | Random float in [min, max) | `randomFloat(5, 10)` -> `8.2...` |
| `randomChoice(list)` | Random element from list | `randomChoice([1,2,3])` -> `2` |
| `shuffle(list)` | Shuffled copy (Fisher-Yates) | `shuffle([1,2,3])` -> `[3,1,2]` |

## List Functions

| Function | Description | Example |
|----------|-------------|---------|
| `length(list)` | Number of elements | `length([1,2,3])` -> `3` |
| `head(list)` | First element | `head([1,2,3])` -> `1` |
| `tail(list)` | All except first | `tail([1,2,3])` -> `[2,3]` |
| `push(list, item)` | Append item | `push([1,2], 3)` -> `[1,2,3]` |
| `concat(a, b)` | Join two lists | `concat([1,2], [3,4])` -> `[1,2,3,4]` |
| `reverse(list)` | Reverse order | `reverse([1,2,3])` -> `[3,2,1]` |
| `zip(a, b)` | Pair elements | `zip([1,2], ["a","b"])` -> `[[1,"a"],[2,"b"]]` |
| `isEmpty(list)` | Check if empty | `isEmpty([])` -> `true` |
| `range(start, end)` | Generate range | `range(1, 4)` -> `[1,2,3]` |
| `take(list, n)` | First n elements | `take([1,2,3,4], 2)` -> `[1,2]` |
| `at(list, index)` | Element at index | `at([1,2,3], 1)` -> `2` |
| `partition(list, fn)` | Split by predicate | `partition([1,2,3], (x) -> x > 1)` -> `[[2,3], [1]]` |
| `iterations(n, fn)` | Apply fn n times | `iterations(3, (x) -> x * 2)(1)` -> `8` |

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
| `fst(tuple)` | First element | `fst((1, 2))` -> `1` |
| `snd(tuple)` | Second element | `snd((1, 2))` -> `2` |

## String Functions

| Function | Description | Example |
|----------|-------------|---------|
| `split(str, delim)` | Split string | `split("a,b,c", ",")` -> `["a","b","c"]` |
| `lines(str)` | Split by newlines | `lines("a\nb")` -> `["a","b"]` |
| `charAt(str, i)` | Character at index | `charAt("hello", 1)` -> `"e"` |
| `chars(str)` | Split to chars | `chars("hi")` -> `["h","i"]` |
| `join(list, delim?)` | Join to string | `join(["a","b"], "-")` -> `"a-b"` |
| `toUpperCase(str)` | Convert to uppercase | `toUpperCase("hello")` -> `"HELLO"` |
| `toLowerCase(str)` | Convert to lowercase | `toLowerCase("HELLO")` -> `"hello"` |
| `replace(str, search, repl)` | Replace all occurrences | `replace("aXbXc", "X", "-")` -> `"a-b-c"` |
| `replaceFirst(str, search, repl)` | Replace first occurrence | `replaceFirst("aXbXc", "X", "-")` -> `"a-bXc"` |
| `startsWith(str, prefix)` | Check prefix | `startsWith("hello", "he")` -> `true` |
| `endsWith(str, suffix)` | Check suffix | `endsWith("hello", "lo")` -> `true` |
| `padEnd(str, len, char?)` | Pad end | `padEnd("hi", 5)` -> `"hi   "` |
| `padStart(str, len, char?)` | Pad start | `padStart("hi", 5)` -> `"   hi"` |
| `trim(str)` | Remove whitespace | `trim("  hi  ")` -> `"hi"` |
| `trimEnd(str)` | Remove trailing ws | `trimEnd("hi  ")` -> `"hi"` |
| `indexOf(str, search)` | Find index | `indexOf("hello", "l")` -> `2` |
| `includes(str, item)` | Contains substring | `includes("hello", "ell")` -> `true` |
| `repeat(str, n)` | Repeat string | `repeat("ab", 3)` -> `"ababab"` |
| `slice(str, start, end?)` | Extract substring | `slice("hello", 1, 3)` -> `"el"` |
| `toString(value)` | Convert to string | `toString(42)` -> `"42"` |

## Set Operations (on Lists)

| Function | Description | Example |
|----------|-------------|---------|
| `listSet(list)` | Unique elements | `listSet([1,1,2])` -> `[1,2]` |
| `setAdd(list, item)` | Add if not present | `setAdd([1,2], 3)` -> `[1,2,3]` |
| `setHas(list, item)` | Check membership | `setHas([1,2], 2)` -> `true` |

## JSON Functions

| Function | Description | Example |
|----------|-------------|---------|
| `parseJson(str)` | Parse JSON string | `parseJson('{"a":1}')` -> `{a: 1}` |
| `toJson(value)` | Convert to JSON string | `toJson({a: 1})` -> `'{"a":1}'` |
| `toJson(value, indent)` | Convert with indentation | `toJson({a: 1}, 2)` |
| `prettyJson(value)` | Pretty-print (2 spaces) | `prettyJson({a: 1})` |

```lea
-- Parse JSON
let data = parseJson('{"name": "Alice", "scores": [90, 85]}')
data.name /> print        -- "Alice"
data.scores /> head       -- 90

-- Convert to JSON
let user = { name: "Bob", age: 30 }
user /> toJson /> print   -- '{"name":"Bob","age":30}'
user /> prettyJson /> print
-- {
--   "name": "Bob",
--   "age": 30
-- }
```

## Date/Time Functions

| Function | Description | Example |
|----------|-------------|---------|
| `now()` | Current timestamp (ms) | `now()` -> `1702500000000` |
| `today()` | Current date record | `today()` -> `{year: 2024, ...}` |
| `date(timestamp)` | Date from timestamp | `date(1702500000000)` |
| `date(str)` | Parse date string | `date("2024-01-15")` |
| `date(y, m, d, ...)` | Create from components | `date(2024, 1, 15)` |
| `formatDate(d, fmt?)` | Format as string | `formatDate(d, "YYYY-MM-DD")` |
| `parseDate(str)` | Parse date string | `parseDate("2024-01-15")` |
| `addDays(d, n)` | Add days | `addDays(d, 7)` |
| `addHours(d, n)` | Add hours | `addHours(d, 2)` |
| `addMinutes(d, n)` | Add minutes | `addMinutes(d, 30)` |
| `diffDates(d1, d2)` | Difference in ms | `diffDates(d1, d2)` |

### Date Record Fields

Date functions return records with these fields:

```lea
let d = today()
d.year        -- 2024
d.month       -- 1-12
d.day         -- 1-31
d.hour        -- 0-23
d.minute      -- 0-59
d.second      -- 0-59
d.millisecond -- 0-999
d.dayOfWeek   -- 0 (Sun) - 6 (Sat)
d.timestamp   -- Unix timestamp in ms
```

### Format Strings

| Format | Description | Example Output |
|--------|-------------|----------------|
| `"ISO"` | ISO 8601 (default) | `"2024-01-15T10:30:00.000Z"` |
| `"date"` | Date string | `"Mon Jan 15 2024"` |
| `"time"` | Time string | `"10:30:00 GMT+0000"` |
| `"locale"` | Locale string | `"1/15/2024, 10:30:00 AM"` |
| `"YYYY-MM-DD"` | Custom format | `"2024-01-15"` |
| `"HH:mm:ss"` | Custom time | `"10:30:00"` |

```lea
-- Date arithmetic
let start = date(2024, 1, 15)
let end = start /> addDays(30)
let diff = diffDates(end, start) / (24 * 60 * 60 * 1000)  -- 30 days

-- Formatting
now() /> formatDate("YYYY-MM-DD") /> print  -- "2024-12-10"
today() /> formatDate("locale") /> print
```

## I/O Functions

| Function | Description | Example |
|----------|-------------|---------|
| `print(value)` | Print and return value | `print("hi")` -> prints "hi", returns "hi" |

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

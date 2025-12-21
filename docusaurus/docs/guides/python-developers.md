---
sidebar_position: 2
---
# Lea for Python Developers

If you know Python, you'll find Lea familiar yet refreshingly different. This guide maps Python concepts to Lea.

## Quick Reference

| Python | Lea |
|--------|-----|
| `x = 5` | `let x = 5` (immutable) or `maybe x = 5` (mutable) |
| `lambda x: x * 2` | `(x) -> x * 2` |
| `list(map(lambda x: x * 2, items))` | `items /> map((x) -> x * 2)` |
| `print(x)` | `x /> print` |
| `# comment` | `-- comment` |
| `{"name": "Alice"}` | `{ name: "Alice" }` |
| `obj["key"]` or `obj.attr` | `obj.key` |
| `await fetch(url)` | `await fetch(url)` |
| `f"Hello {name}"` | `` `Hello {name}` `` |

## Variables

```python
# Python
name = "Alice"      # mutable by default
counter = 0
counter = 1         # reassignment OK
```

```
-- Lea
let name = "Alice"     -- immutable (preferred)
maybe counter = 0      -- mutable when needed
counter = 1            -- reassignment OK
```

Key difference: Lea defaults to immutable. Use `maybe` only when you need to reassign.

## Functions

```python
# Python
def double(x):
    return x * 2

add = lambda a, b: a + b

def greet(name="World"):
    return f"Hello {name}!"
```

```
-- Lea
let double = (x) -> x * 2

let add = (a, b) -> a + b

let greet = (name = "World") -> `Hello {name}!`
```

### Multi-line Functions

```python
# Python
def process(x):
    y = x * 2
    z = y + 1
    return z
```

```
-- Lea (indentation-based, like Python!)
let process = (x) ->
  let y = x * 2
  let z = y + 1
  z                    -- last expression is returned
```

No `return` needed for the final expression - it's automatically returned!

### Early Return

```
-- Lea (explicit return for early exit)
let clamp = (x) ->
  let doubled = x * 2
  doubled > 100 ? return 100 : 0
  doubled + 1
```

## The Pipe Operator

This is the key concept! Instead of nested function calls, Lea uses pipes:

```python
# Python - nested calls
print(math.sqrt(abs(-16)))

# Python - intermediate variables
x = -16
x = abs(x)
x = math.sqrt(x)
print(x)
```

```
-- Lea - pipes (read left to right, like a shell pipeline)
-16 /> abs /> sqrt /> print
```

Think of it like Unix pipes: `echo -16 | abs | sqrt | print`

### Passing Arguments Through Pipes

```python
# Python
def add(a, b):
    return a + b
add(5, 3)  # 8
```

```
-- Lea - piped value becomes first argument
5 /> add(3)    -- becomes add(5, 3) = 8

-- Or use 'input' placeholder
5 /> add(3, input)    -- becomes add(3, 5) = 8
```

## List Operations

Python's list comprehensions and functional tools map directly to Lea:

```python
# Python - list comprehension
nums = [1, 2, 3, 4, 5]
[x * 2 for x in nums]           # [2, 4, 6, 8, 10]
[x for x in nums if x > 2]      # [3, 4, 5]

# Python - functional
list(map(lambda x: x * 2, nums))
list(filter(lambda x: x > 2, nums))
from functools import reduce
reduce(lambda acc, x: acc + x, nums, 0)
```

```
-- Lea (piped operations)
let nums = [1, 2, 3, 4, 5]
nums /> map((x) -> x * 2)                  -- [2, 4, 6, 8, 10]
nums /> filter((x) -> x > 2)               -- [3, 4, 5]
nums /> reduce(0, (acc, x) -> acc + x)     -- 15
```

Note: Lea's `reduce` takes the initial value first, not last!

### Chaining Operations

```python
# Python
result = [1, 2, 3, 4, 5]
result = [x for x in result if x > 2]
result = [x * 2 for x in result]
total = sum(result)
```

```
-- Lea (clean pipeline)
[1, 2, 3, 4, 5]
  /> filter((x) -> x > 2)
  /> map((x) -> x * 2)
  /> reduce(0, (acc, x) -> acc + x)
```

### Enumerate Equivalent

```python
# Python
for i, x in enumerate(['a', 'b', 'c']):
    print(f"{i}: {x}")
```

```
-- Lea (index is second argument in callbacks)
["a", "b", "c"] /> map((x, i) -> `{i}: {x}`) /> print
-- ["0: a", "1: b", "2: c"]
```

## Dictionaries (Records)

```python
# Python
user = {"name": "Alice", "age": 30}
user["name"]  # "Alice"

# Destructuring (Python 3.10+)
match user:
    case {"name": name, "age": age}:
        print(name)
```

```
-- Lea
let user = { name: "Alice", age: 30 }
user.name  -- "Alice"

-- Destructuring
let { name, age } = user
name /> print
```

### Spread/Merge

```python
# Python
user = {"name": "Alice", "age": 30}
updated = {**user, "age": 31}
```

```
-- Lea (identical spread syntax!)
let user = { name: "Alice", age: 30 }
let updated = { ...user, age: 31 }
```

## Tuples

```python
# Python
point = (10, 20)
x, y = point  # unpacking
```

```
-- Lea
let point = (10, 20)
let (x, y) = point  -- destructuring
```

## Conditionals

```python
# Python - ternary
result = "positive" if x > 0 else "non-positive"

# Python - if/elif/else
if x > 0:
    result = "positive"
elif x < 0:
    result = "negative"
else:
    result = "zero"
```

```
-- Lea (ternary)
let result = x > 0 ? "positive" : "non-positive"

-- Lea (pattern matching for complex cases)
let result = match x
  | if input > 0 -> "positive"
  | if input < 0 -> "negative"
  | "zero"
```

## Pattern Matching

Python 3.10+ has pattern matching, and Lea's is similar:

```python
# Python 3.10+
match value:
    case 0:
        result = "zero"
    case 1:
        result = "one"
    case x if x < 0:
        result = "negative"
    case _:
        result = "other"
```

```
-- Lea
let result = match value
  | 0 -> "zero"
  | 1 -> "one"
  | if input < 0 -> "negative"
  | "other"
```

## Async/Await

```python
# Python
async def fetch_data(url):
    response = await aiohttp.get(url)
    return await response.json()

data = await fetch_data("https://api.example.com")
```

```
-- Lea
let fetchData = (url) -> fetch(url) #async
let data = await fetchData("https://api.example.com")
```

### asyncio.gather Equivalent

```python
# Python
results = await asyncio.gather(
    fetch(url1),
    fetch(url2),
    fetch(url3)
)
```

```
-- Lea
let results = [url1, url2, url3] /> parallel((url) -> fetch(url))
```

## String Formatting

```python
# Python f-strings
name = "World"
count = 42
message = f"Hello {name}! Count: {count}"
```

```
-- Lea template strings (backticks with {})
let name = "World"
let count = 42
let message = `Hello {name}! Count: {count}`
```

### String Concatenation

```python
# Python
result = "Hello" + " " + "World"
```

```
-- Lea (use ++ for concatenation)
let result = "Hello" ++ " " ++ "World"
```

Note: Lea uses `++` for string concatenation, which also auto-coerces types:
```
"Answer: " ++ 42  -- "Answer: 42"
```

## Decorators

Python decorators map nicely to Lea's trailing decorators:

```python
# Python
from functools import lru_cache

@lru_cache
def fib(n):
    return n if n <= 1 else fib(n - 1) + fib(n - 2)
```

```
-- Lea (trailing decorator syntax)
let fib = (n) -> n <= 1 ? n : fib(n - 1) + fib(n - 2) #memo
```

Available decorators:
- `#log` - log inputs/outputs
- `#memo` - memoization (like `@lru_cache`)
- `#time` - timing
- `#retry(n)` - retry on failure
- `#validate` - runtime type checking
- `#async` - mark as async

## Type Hints

```python
# Python
def add(a: int, b: int) -> int:
    return a + b
```

```
-- Lea (trailing type syntax)
let add = (a, b) -> a + b :: (Int, Int) :> Int
```

## List Operations Reference

| Python | Lea |
|--------|-----|
| `len(lst)` | `length(lst)` or `lst /> length` |
| `lst[0]` | `head(lst)` or `at(lst, 0)` |
| `lst[1:]` | `tail(lst)` |
| `lst[:n]` | `take(lst, n)` |
| `lst + [x]` | `push(lst, x)` |
| `lst1 + lst2` | `concat(lst1, lst2)` |
| `lst[::-1]` | `reverse(lst)` |
| `range(1, 5)` | `range(1, 5)` -- [1, 2, 3, 4] |
| `zip(a, b)` | `zip(a, b)` |

## What Lea Doesn't Have

- `class` - use records and functions
- `for`/`while` loops - use `map`, `filter`, `reduce`, recursion
- `None` - use `null`
- `try`/`except` - use `#retry` decorator or pattern matching
- Indentation for blocks - only for multi-line function bodies
- `import` - not yet implemented
- List slicing syntax `[1:3]` - use `slice(lst, 1, 3)`

## Lea-Specific Features

### Parallel Pipes

```
-- Fan out to multiple functions, combine results
10 \> addOne \> double /> combine
-- Runs addOne(10) and double(10) concurrently
```

### First-Class Pipelines

```
-- Store a pipeline as a value (like a partial application)
let process = /> filter((x) -> x > 0) /> map((x) -> x * 2)

-- Apply it
[1, -2, 3] /> process  -- [2, 6]
```

### Reversible Functions

```
-- Define forward and reverse transformations
let double = (x) -> x * 2
and double = (x) <- x / 2

5 /> double   -- 10 (forward)
10 </ double  -- 5  (reverse)
```

### Context System (Dependency Injection)

```
-- Like a simpler version of dependency injection
context Logger = { log: (msg) -> print(msg) }

let greet = (name) ->
  @Logger
  Logger.log("Hello " ++ name)
```

## Pythonic to Leatic

| Pythonic Pattern | Leatic Pattern |
|------------------|----------------|
| List comprehension | `list /> map /> filter` |
| `for` loop | `map` or `reduce` |
| `while` loop | Recursion with base case |
| `with` statement | Context system |
| Decorators `@` | Trailing `#` decorators |
| `*args, **kwargs` | Spread operator |

## Migration Tips

1. **Think in pipelines**: Instead of `result = f(g(h(x)))`, write `x /> h /> g /> f`
2. **Embrace immutability**: Use `let` by default, `maybe` only when needed
3. **No loops**: Use `map`, `filter`, `reduce` - they're more composable
4. **Pattern matching**: Use `match` instead of if/elif chains
5. **Trailing decorators**: Put `#memo`, `#log` after the function body

## Example: Python to Lea

```python
# Python
def process_users(users):
    active = [u for u in users if u["active"]]
    adults = [u for u in active if u["age"] >= 18]
    names = [u["name"] for u in adults]
    return ", ".join(names)

users = [
    {"name": "Alice", "age": 25, "active": True},
    {"name": "Bob", "age": 17, "active": True},
    {"name": "Charlie", "age": 35, "active": False},
]
print(process_users(users))
```

```
-- Lea
let processUsers = (users) ->
  users
    /> filter((u) -> u.active)
    /> filter((u) -> u.age >= 18)
    /> map((u) -> u.name)
    /> join(", ")

let users = [
  { name: "Alice", age: 25, active: true },
  { name: "Bob", age: 17, active: true },
  { name: "Charlie", age: 35, active: false },
]
users /> processUsers /> print
```

Happy coding!

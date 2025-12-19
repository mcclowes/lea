---
sidebar_position: 10
---

# FAQ & Common Pitfalls

## Frequently Asked Questions

### General

**Q: What is Lea?**
A: Lea is a pipe-oriented functional programming language. It emphasizes data transformation pipelines, immutability by default, and a clean, expressive syntax.

**Q: What can I build with Lea?**
A: Lea is great for data processing, scripting, and learning functional programming concepts. It has built-in support for async operations, file I/O, and HTTP requests.

**Q: Is Lea production-ready?**
A: Lea is currently a learning/experimental language. It's excellent for prototyping and education but may not be suitable for production systems yet.

---

### Syntax

**Q: Why can't I use `+` for string concatenation?**
A: Lea uses `++` for string concatenation:
```lea
"Hello" ++ " World"  -- Correct
"Hello" + " World"   -- Error!
```
This keeps `+` strictly for arithmetic, making code clearer.

**Q: Why doesn't my template string work with `${}`?**
A: Lea uses single braces for interpolation:
```lea
`Hello {name}`       -- Correct
`Hello ${name}`      -- Error!
```

**Q: Do I need semicolons?**
A: No! Lea doesn't use semicolons at all:
```lea
let x = 10           -- Correct
let x = 10;          -- Error!
```

**Q: What's the difference between `let` and `maybe`?**
A: `let` creates immutable bindings, `maybe` creates mutable ones:
```lea
let x = 10
x = 20               -- Error! Cannot reassign

maybe y = 10
y = 20               -- OK
```

---

### Pipes

**Q: Why isn't my piped value being used correctly?**
A: By default, the piped value becomes the **first** argument:
```lea
5 /> add(3)          -- becomes add(5, 3)
```
Use `input` placeholder for different positions:
```lea
5 /> add(3, input)   -- becomes add(3, 5)
```

**Q: Why does `a /> b + c` not work as expected?**
A: Pipes bind tighter than arithmetic! The expression parses as `(a /> b) + c`:
```lea
5 /> double + 1      -- (5 /> double) + 1 = 10 + 1 = 11

-- If you want double(5 + 1):
(5 + 1) /> double    -- 12
-- Or:
5 /> add(1) /> double  -- 12
```

**Q: What's the difference between `/>`, `\>`, and `/>>>`?**
```lea
x /> f               -- Forward pipe: f(x)
x \> f \> g /> h     -- Parallel pipe: h(f(x), g(x))
[1,2,3] />>>f        -- Spread pipe: map f over list
x </ f               -- Reverse pipe: calls reverse of f
```

---

### Functions

**Q: How do I write multi-line functions?**
A: Use indentation (no braces needed):
```lea
let process = (x) ->
  let y = x * 2
  let z = y + 1
  z                  -- Last expression is returned
```

**Q: Do I need `return`?**
A: The last expression is automatically returned. Use `return` only for early exit:
```lea
let clamp = (x) ->
  x > 100 ? return 100 : 0
  x < 0 ? return 0 : 0
  x
```

**Q: How do type annotations work?**
A: They come after the function body with `::`:
```lea
let add = (a, b) -> a + b :: (Int, Int) :> Int
```

---

### Lists

**Q: Why is `reduce` different from JavaScript?**
A: Lea's `reduce` takes the initial value **first**:
```lea
-- Lea
[1,2,3] /> reduce(0, (acc, x) -> acc + x)

-- JavaScript
[1,2,3].reduce((acc, x) => acc + x, 0)
```

**Q: How do I access list indices in callbacks?**
A: The index is passed as the second argument:
```lea
["a", "b", "c"] /> map((x, i) -> `{i}: {x}`)
-- ["0: a", "1: b", "2: c"]
```

**Q: How do I slice a list?**
A: Use the `slice` function:
```lea
slice([1,2,3,4,5], 1, 3)  -- [2, 3]
take([1,2,3,4,5], 2)      -- [1, 2]
```

---

### Async

**Q: How do I make a function async?**
A: Add the `#async` decorator:
```lea
let fetchData = (url) -> fetch(url) #async
let data = await fetchData("https://api.example.com")
```

**Q: How do I run multiple async operations in parallel?**
A: Use `parallel`:
```lea
let urls = ["url1", "url2", "url3"]
let results = urls /> parallel((url) -> fetch(url))

-- With concurrency limit:
let results = urls /> parallel((url) -> fetch(url), { limit: 2 })
```

---

### Decorators

**Q: What decorators are available?**
A: Here are the main ones:
- `#log` - Log inputs/outputs
- `#memo` - Memoize results
- `#time` - Log execution time
- `#retry(n)` - Retry on failure
- `#validate` - Runtime type checking
- `#async` - Mark as async
- `#coerce(Type)` - Coerce inputs

**Q: How do I use multiple decorators?**
A: Chain them after the function body:
```lea
let expensive = (x) -> compute(x) #log #memo #time
```

---

### Pattern Matching

**Q: What is `input` in match expressions?**
A: `input` refers to the matched value in guards and bodies:
```lea
let describe = (x) -> match x
  | if input < 0 -> "negative"
  | if input > 0 -> "positive"
  | "zero"
```

**Q: How do I have a default case?**
A: Just provide a body without a pattern or guard:
```lea
match x
  | 0 -> "zero"
  | 1 -> "one"
  | "default"        -- Catches everything else
```

---

## Common Pitfalls

### 1. String Concatenation

**Wrong:**
```lea
"Hello" + " World"
```

**Right:**
```lea
"Hello" ++ " World"
```

### 2. Pipe Precedence

**Wrong:** (if you expect `double(5 + 1)`)
```lea
5 + 1 /> double      -- Parses as 5 + (1 /> double)
```

**Right:**
```lea
(5 + 1) /> double    -- 12
```

### 3. Reduce Initial Value

**Wrong:**
```lea
[1,2,3] /> reduce((acc, x) -> acc + x, 0)
```

**Right:**
```lea
[1,2,3] /> reduce(0, (acc, x) -> acc + x)
```

### 4. Mutable vs Immutable

**Wrong:**
```lea
let counter = 0
counter = counter + 1    -- Error!
```

**Right:**
```lea
maybe counter = 0
counter = counter + 1    -- OK
```

### 5. Template String Interpolation

**Wrong:**
```lea
`Hello ${name}`
```

**Right:**
```lea
`Hello {name}`
```

### 6. Arrow Syntax

**Wrong:**
```lea
let f = (x) => x * 2
```

**Right:**
```lea
let f = (x) -> x * 2
```

### 7. Comments

**Wrong:**
```lea
// this is a comment
```

**Right:**
```lea
-- this is a comment
```

### 8. Missing Parentheses in Function Definitions

**Wrong:**
```lea
let f = x -> x * 2
```

**Right:**
```lea
let f = (x) -> x * 2
```

### 9. Calling Functions Without Arguments

**Wrong:** (if f takes no arguments)
```lea
f
```

**Right:**
```lea
f()
```

### 10. Spread Pipe on Non-List

**Wrong:**
```lea
5 />>>double         -- Error: 5 is not a list
```

**Right:**
```lea
[5] />>>double       -- [10]
-- Or just:
5 /> double          -- 10
```

---

## Troubleshooting

### "Undefined variable"
- Check spelling
- Ensure the variable is defined before use
- Remember: Lea is case-sensitive

### "Cannot reassign immutable variable"
- Change `let` to `maybe` if you need to reassign

### "Right side of pipe must be a function or call"
- Make sure you're piping to a function, not a value
- Wrong: `5 /> 10`
- Right: `5 /> sqrt`

### "No matching case in match expression"
- Add a default case to your match expression

### "Expected -> but got =>"
- Use `->` for Lea functions, not `=>`

---

## Getting Help

- **REPL Help**: Type `.help` in the REPL
- **Topic Help**: `.help pipes`, `.help functions`, etc.
- **Interactive Tutorial**: `.tutorial` in the REPL
- **Examples**: `.examples` shows runnable code snippets

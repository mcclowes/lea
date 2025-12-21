# Lea cheat sheet

## Basics

```
-- Comments start with --

let x = 10              -- immutable binding
maybe y = 20            -- mutable binding
y = 30                  -- reassign mutable
```

## Types

```
10                      -- Int
3.14                    -- Float
"hello"                 -- String
`Hello {name}`          -- Template String
true, false             -- Bool
null                    -- Null
[1, 2, 3]               -- List
(1, "a")                -- Tuple
{ name: "Max" }         -- Record
```

## Operators

```
+ - * / %               -- arithmetic
== != < > <= >=         -- comparison
++                      -- string concat (coerces types)
? :                     -- ternary
if ... then ... else    -- if-then-else (sugar for ternary)
```

## Pipes

```
x /> f                  -- forward pipe: f(x)
x /> f(a)               -- with args: f(x, a)
x /> f(a, input)        -- placeholder: f(a, x)
x \> f \> g /> h        -- parallel: h(f(x), g(x))
x </ f                  -- reverse pipe
[1,2,3] />>>f           -- spread pipe: map f over list
```

## Functions

```
let f = (x) -> x * 2                    -- single param
let f = (a, b) -> a + b                 -- multi param
let f = (x = 10) -> x * 2               -- default param
let f = (x, _) -> x                     -- ignore param

-- Multi-line
let f = (x) ->
  let y = x * 2
  y + 1

-- Type annotations
let f = (x) -> x * 2 :: Int :> Int
let f = (a, b) -> a + b :: (Int, Int) :> Int

-- Decorators
let f = (x) -> x #log #memo #time

-- Reversible
let f = (x) -> x * 2
and f = (x) <- x / 2

-- Overloading
let f = (a, b) -> a + b :: (Int, Int) :> Int
and f = (a, b) -> a ++ b :: (String, String) :> String
```

## Decorators

| Decorator | Effect |
|-----------|--------|
| `#log` | Log inputs/outputs |
| `#memo` | Memoize results |
| `#time` | Log execution time |
| `#retry(n)` | Retry n times |
| `#validate` | Runtime type check |
| `#async` | Async function |
| `#coerce(Type)` | Coerce inputs |
| `#parse` | Parse JSON/numbers |
| `#stringify` | Convert to string |

## Lists

```
let lst = [1, 2, 3]
length(lst)             -- 3
head(lst)               -- 1
tail(lst)               -- [2, 3]
at(lst, 1)              -- 2
take(lst, 2)            -- [1, 2]
push(lst, 4)            -- [1, 2, 3, 4]
concat(a, b)            -- join lists
reverse(lst)            -- [3, 2, 1]
range(1, 5)             -- [1, 2, 3, 4]
[...a, ...b]            -- spread
```

## List transformations

```
lst /> map((x) -> x * 2)
lst /> filter((x) -> x > 2)
lst /> reduce(0, (acc, x) -> acc + x)

-- With index
lst /> map((x, i) -> `{i}: {x}`)
lst /> filter((x, i) -> i < 2)
```

## Records

```
let r = { name: "Max", age: 99 }
r.name                  -- "Max"
let { name, age } = r   -- destructure
{ ...r, age: 100 }      -- spread with override
```

## Tuples

```
let t = (10, 20)
let (x, y) = t          -- destructure
fst(t)                  -- 10
snd(t)                  -- 20
```

## Strings

```
"a" ++ "b"              -- "ab" (concat)
`Hello {name}`          -- template
split(s, ",")           -- to list
join(lst, ",")          -- to string
length(s)               -- char count
trim(s)                 -- remove whitespace
chars(s)                -- ["h","i"]
```

## Pattern matching

```
match x
  | 0 -> "zero"
  | 1 -> "one"
  | if input < 0 -> "negative"
  | "default"
```

## Pipelines (first-class)

```
let p = /> f /> g       -- define pipeline
x /> p                  -- apply
p.length                -- stage count
p.stages                -- ["f", "g"]
p.visualize()           -- ASCII diagram

-- Algebra
Pipeline.identity
Pipeline.empty
p.prepend(f)
p.append(f)
p.reverse()
p.slice(0, 2)
p.concat(p2)
```

## Bidirectional pipelines

```
let p = </> f </> g
x /> p                  -- forward
x </ p                  -- reverse
```

## Reactive

```
maybe src = [1, 2, 3]
let r = src @> map(f) /> reduce(0, add)
r.value                 -- compute/cache
src = [1, 2, 3, 4]      -- marks dirty
r.value                 -- recompute
```

## Context system

```
context Logger = { log: print }
provide Logger { log: (m) -> print("[LOG] " ++ m) }

let f = (x) ->
  @Logger
  Logger.log(x)
```

## Async

```
let f = () -> delay(100) #async
await f()

await delay(100, "done")
parallel(lst, fn)
parallel(lst, fn, { limit: 2 })
race([promise1, promise2])
p /> then((x) -> x * 2)
```

## I/O

```
await readFile("path")
await writeFile("path", "content")
await appendFile("path", "more")
await fileExists("path")
await deleteFile("path")
await readDir("path")
await fetch(url)
await fetch(url, { method: "POST", body: data })
```

## Random

```
random()                -- [0, 1)
randomInt(10)           -- [0, 10)
randomInt(5, 10)        -- [5, 10)
randomFloat(10)         -- [0, 10)
randomChoice(lst)       -- random element
shuffle(lst)            -- shuffled copy
```

## Math

```
sqrt(x)  abs(x)  floor(x)  ceil(x)  round(x)
min(a, b)  max(a, b)
```

## REPL commands

```
.help [topic]           -- help
.examples               -- show examples
.example <n>            -- run example
.type <expr>            -- show type
.bindings               -- list bindings
.multiline              -- toggle multi-line
.tutorial               -- interactive tutorial
.clear                  -- clear screen
.reset                  -- reset state
.exit                   -- quit
```

## CLI

```bash
npm run repl                    # REPL
npm run repl -- --strict        # strict mode
npm run repl -- --tutorial      # start tutorial
npm run lea file.lea            # run file
npm run lea file.lea --strict   # strict mode
npm run format -- file.lea -w   # format
npm run visualize -- file.lea   # flowchart
```

# Getting Started with Lea

Welcome to Lea, a pipe-oriented functional programming language! This guide will help you go from zero to writing your first Lea programs.

## Installation

```bash
# Clone the repository
git clone https://github.com/mcclowes/lea.git
cd lea

# Install dependencies
npm install

# Verify installation
npm run lea examples/01-basics.lea
```

## Your First Lea Program

Create a file called `hello.lea`:

```
-- This is a comment
"Hello, World!" /> print
```

Run it:

```bash
npm run lea hello.lea
```

Congratulations! You've written your first Lea program.

## The REPL

Lea includes an interactive REPL (Read-Eval-Print Loop) for experimenting:

```bash
npm run repl
```

You'll see:

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║   ██╗     ███████╗ █████╗                                                     ║
║   ██║     ██╔════╝██╔══██╗    Pipe-oriented functional language               ║
║   ██║     █████╗  ███████║    Type .help for commands                         ║
║   ██║     ██╔══╝  ██╔══██║    Type .tutorial for interactive guide            ║
║   ███████╗███████╗██║  ██║                                                    ║
║   ╚══════╝╚══════╝╚═╝  ╚═╝                                                    ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

lea>
```

### Interactive Tutorial

The best way to learn Lea is through the built-in tutorial:

```
lea> .tutorial
```

This will guide you through the basics step by step.

### REPL Commands

| Command | Description |
|---------|-------------|
| `.help` | Show main help |
| `.help <topic>` | Help on: pipes, functions, lists, decorators, types, async, patterns, contexts, pipelines |
| `.examples` | Show example snippets |
| `.example <n>` | Run example number n |
| `.type <expr>` | Show the type of an expression |
| `.bindings` | List current variable bindings |
| `.multiline` | Toggle multi-line input mode |
| `.clear` | Clear the screen |
| `.reset` | Reset interpreter state |
| `.exit` | Exit the REPL |

## Core Concepts

### 1. Variables and Bindings

```
-- Immutable binding (cannot be changed)
let name = "Alice"
let age = 30

-- Mutable binding (can be reassigned)
maybe counter = 0
counter = 1    -- OK
```

### 2. The Pipe Operator

The pipe operator `/>` is the heart of Lea. It passes a value as the first argument to the next function:

```
-- Instead of: print(sqrt(16))
-- Write:
16 /> sqrt /> print    -- Output: 4
```

This reads naturally: "Take 16, get its square root, then print it."

### 3. Functions

Functions use arrow syntax:

```
-- Single parameter
let double = (x) -> x * 2

-- Multiple parameters
let add = (a, b) -> a + b

-- Using functions with pipes
5 /> double /> print      -- Output: 10
5 /> add(3) /> print      -- Output: 8
```

### 4. Lists and Transformations

```
let numbers = [1, 2, 3, 4, 5]

-- Map: transform each element
numbers /> map((x) -> x * 2)     -- [2, 4, 6, 8, 10]

-- Filter: keep matching elements
numbers /> filter((x) -> x > 2)   -- [3, 4, 5]

-- Reduce: combine into single value
numbers /> reduce(0, (acc, x) -> acc + x)  -- 15
```

### 5. Records (Objects)

```
let user = {
  name: "Alice",
  age: 30,
  email: "alice@example.com"
}

user.name /> print    -- Output: Alice

-- Destructuring
let { name, age } = user
name /> print         -- Output: Alice
```

## Building Your First Real Program

Let's build a simple data processing pipeline:

```
-- sample-data.lea

-- Define some data
let users = [
  { name: "Alice", age: 25, active: true },
  { name: "Bob", age: 17, active: true },
  { name: "Charlie", age: 35, active: false },
  { name: "Diana", age: 28, active: true }
]

-- Create a processing pipeline
let processUsers = (users) ->
  users
    /> filter((u) -> u.active)           -- Only active users
    /> filter((u) -> u.age >= 18)        -- Adults only
    /> map((u) -> u.name)                -- Extract names
    /> join(", ")                        -- Join into string

-- Run it
users /> processUsers /> print
-- Output: Alice, Diana
```

## Next Steps

1. **Explore the examples**: `examples/` directory has progressive examples
2. **Read the docs**: `docs/` has detailed documentation on each feature
3. **Try the REPL**: Use `.examples` to see runnable code snippets
4. **Check the cheat sheet**: `docs/CHEATSHEET.md` for quick reference

### Learning Path

| Level | Topics | Examples |
|-------|--------|----------|
| Beginner | Bindings, pipes, functions, lists | 01-03 |
| Intermediate | Records, decorators, contexts | 04-06 |
| Advanced | Async, pipelines, pattern matching | 07-16 |
| Expert | Reactives, reversibles, complex examples | 17-20, complex/ |

## Common Patterns

### Pipeline Composition

```
-- Define reusable pipelines
let normalize = /> trim /> toLowerCase
let validate = /> filter((x) -> length(x) > 0)

-- Compose them
let processInput = /> normalize /> validate
["  Hello  ", "", "WORLD"] /> processInput
-- ["hello", "world"]
```

### Error Handling with Decorators

```
-- Retry failed operations
let fetchData = (url) -> fetch(url) #retry(3)

-- Memoize expensive computations
let fib = (n) -> n <= 1 ? n : fib(n-1) + fib(n-2) #memo
```

### Async Operations

```
-- Sequential async
let data = await readFile("config.json")
data /> print

-- Parallel async
let urls = ["url1", "url2", "url3"]
urls /> parallel((url) -> fetch(url)) /> print
```

## Getting Help

- **REPL Help**: Type `.help` in the REPL
- **Topic Help**: `.help pipes`, `.help functions`, etc.
- **Examples**: `.examples` shows runnable snippets
- **Tutorial**: `.tutorial` for interactive learning
- **Documentation**: See `docs/` directory

## VS Code Support

Install the Lea VS Code extension for syntax highlighting:

```bash
cd vscode-lea
npm install
npm run package
# Install the generated .vsix file
```

Happy coding with Lea!

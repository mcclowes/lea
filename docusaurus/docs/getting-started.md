---
sidebar_position: 2
---

# Getting Started

This guide helps you install Lea and write your first program.

## Installation

### Quick start with npx

Run Lea files directly without installing:

```bash
npx lea-lang hello.lea
```

### Global installation

If you use Lea frequently, install it globally:

```bash
npm install -g lea-lang

# Now you can use 'lea' directly
lea hello.lea
lea --repl
lea --help
```

### Install from source

To contribute or modify Lea:

```bash
# Clone the repository
git clone https://github.com/mcclowes/lea.git
cd lea

# Install dependencies
npm install

# Verify installation
npm run lea examples/01-basics.lea
```

## Your first Lea program

To create and run your first program:

1. Create a file called `hello.lea`:

   ```lea
   -- This is a comment
   "Hello, World!" /> print
   ```

2. Run the file:

   ```bash
   npx lea-lang hello.lea
   ```

   Or if you installed globally:

   ```bash
   lea hello.lea
   ```

## The REPL

Lea includes an interactive REPL (Read-Eval-Print Loop) for experimenting. Start it with:

```bash
# Via global install
lea --repl

# Or from source
npm run repl
```

You'll see:

```
+===============================================================================+
|                                                                               |
|   ██╗     ███████╗ █████╗                                                     |
|   ██║     ██╔════╝██╔══██╗    Pipe-oriented functional language               |
|   ██║     █████╗  ███████║    Type .help for commands                         |
|   ██║     ██╔══╝  ██╔══██║    Type .tutorial for interactive guide            |
|   ███████╗███████╗██║  ██║                                                    |
|   ╚══════╝╚══════╝╚═╝  ╚═╝                                                    |
|                                                                               |
+===============================================================================+

lea>
```

### Interactive tutorial

To learn Lea interactively, start the built-in tutorial:

```
lea> .tutorial
```

### REPL commands

The REPL supports the following commands:

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

## Core concepts

### Variables and bindings

```lea
-- Immutable binding (cannot be changed)
let name = "Alice"
let age = 30

-- Mutable binding (can be reassigned)
maybe counter = 0
counter = 1    -- OK
```

### The pipe operator

The pipe operator `/>` passes a value as the first argument to a function:

```lea
-- Instead of: print(sqrt(16))
-- Write:
16 /> sqrt /> print    -- Output: 4
```

### Functions

Functions use arrow syntax:

```lea
-- Single parameter
let double = (x) -> x * 2

-- Multiple parameters
let add = (a, b) -> a + b

-- Using functions with pipes
5 /> double /> print      -- Output: 10
5 /> add(3) /> print      -- Output: 8
```

### Lists and transformations

```lea
let numbers = [1, 2, 3, 4, 5]

-- Map: transform each element
numbers /> map((x) -> x * 2)     -- [2, 4, 6, 8, 10]

-- Filter: keep matching elements
numbers /> filter((x) -> x > 2)   -- [3, 4, 5]

-- Reduce: combine into single value
numbers /> reduce(0, (acc, x) -> acc + x)  -- 15
```

### Records

```lea
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

## Build a data processing pipeline

This example shows a complete data processing pipeline:

```lea
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

## Next steps

To continue learning Lea:

- Explore the `examples/` directory for progressive examples
- Use `.examples` in the REPL to see runnable code snippets
- Check the [Cheat Sheet](./cheatsheet.md) for quick reference

### Learning path

| Level | Topics | Examples |
|-------|--------|----------|
| Beginner | Bindings, pipes, functions, lists | 01-03 |
| Intermediate | Records, decorators, contexts | 04-06 |
| Advanced | Async, pipelines, pattern matching | 07-16 |
| Expert | Reactives, reversibles, complex examples | 17-20, complex/ |

## Common patterns

### Pipeline composition

```lea
-- Define reusable pipelines
let normalize = /> trim /> toLowerCase
let validate = /> filter((x) -> length(x) > 0)

-- Compose them
let processInput = /> normalize /> validate
["  Hello  ", "", "WORLD"] /> processInput
-- ["hello", "world"]
```

### Error handling with decorators

```lea
-- Retry failed operations
let fetchData = (url) -> fetch(url) #retry(3)

-- Memoize expensive computations
let fib = (n) -> n <= 1 ? n : fib(n-1) + fib(n-2) #memo
```

### Async operations

```lea
-- Sequential async
let data = await readFile("config.json")
data /> print

-- Parallel async
let urls = ["url1", "url2", "url3"]
urls /> parallel((url) -> fetch(url)) /> print
```

## Get help

For help while using Lea:

- Type `.help` in the REPL for command reference
- Type `.help pipes` or `.help functions` for topic-specific help
- Type `.examples` to see runnable code snippets
- Type `.tutorial` to start the interactive tutorial

## VS Code support

To install syntax highlighting for VS Code:

1. Navigate to the extension directory:
   ```bash
   cd vscode-lea
   ```

2. Build the extension:
   ```bash
   npm install
   npm run package
   ```

3. Install the generated `.vsix` file in VS Code.

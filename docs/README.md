# Lea documentation

Welcome to the Lea documentation! Lea is a pipe-oriented functional programming language.

## Getting started

| Document | Description |
|----------|-------------|
| [Getting Started](GETTING-STARTED.md) | Installation, first program, REPL basics |
| [Cheat Sheet](CHEATSHEET.md) | Quick reference for syntax and builtins |
| [FAQ](FAQ.md) | Common questions and troubleshooting |

## Language guides

| Document | Description |
|----------|-------------|
| [For JavaScript Developers](LEA-FOR-JAVASCRIPT-DEVELOPERS.md) | Lea concepts mapped to JavaScript |
| [For Python Developers](LEA-FOR-PYTHON-DEVELOPERS.md) | Lea concepts mapped to Python |

## Reference

| Document | Description |
|----------|-------------|
| [Syntax](SYNTAX.md) | Complete syntax reference |
| [Builtins](BUILTINS.md) | Built-in functions |
| [Pipelines](PIPELINES.md) | First-class pipelines and composition |
| [Concurrency](CONCURRENCY.md) | Async/await and parallel execution |

## Quick start

```bash
# Start the REPL
npm run repl

# Run the interactive tutorial
npm run repl -- --tutorial

# Initialize a new project
npm run lea:init

# Run a file
npm run lea myfile.lea
```

## REPL commands

```
.help              Show main help
.help <topic>      Topic-specific help
.examples          Show example snippets
.tutorial          Start interactive tutorial
.type <expr>       Show expression type
```

## Learning path

1. **Beginners**: Start with [Getting Started](GETTING-STARTED.md) or `.tutorial` in the REPL
2. **JS/Python developers**: Read the [JavaScript](LEA-FOR-JAVASCRIPT-DEVELOPERS.md) or [Python](LEA-FOR-PYTHON-DEVELOPERS.md) guides
3. **Quick reference**: Keep the [Cheat Sheet](CHEATSHEET.md) handy
4. **Deep dive**: Explore [Syntax](SYNTAX.md), [Builtins](BUILTINS.md), and [Pipelines](PIPELINES.md)

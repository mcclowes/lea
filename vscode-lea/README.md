# Lea Language Support for VSCode

Syntax highlighting for the Lea programming language.

## Features

- Syntax highlighting for `.lea` files
- Comment toggling with `--`
- Auto-closing brackets and quotes
- Indentation support for function bodies

## Highlighted Elements

- **Keywords**: `let`, `mut`, `await`, `context`, `provide`, `decorator`
- **Operators**: `/>` (pipe), `->` (arrow), `++` (concat), comparisons
- **Decorators**: `#log`, `#memo`, `#time`, `#retry`, `#async`, etc.
- **Attachments**: `@Context`
- **Builtins**: `print`, `map`, `filter`, `reduce`, `sqrt`, etc.
- **Literals**: strings, numbers, `true`, `false`

## Installation

### From Source (Development)

1. Copy the `vscode-lea` folder to your VSCode extensions directory:
   - **macOS**: `~/.vscode/extensions/`
   - **Windows**: `%USERPROFILE%\.vscode\extensions\`
   - **Linux**: `~/.vscode/extensions/`

2. Restart VSCode

3. Open a `.lea` file to see syntax highlighting

### Alternative: Symlink (for development)

```bash
ln -s /path/to/lea/vscode-lea ~/.vscode/extensions/lea-language
```

## Example

```lea
-- This is a comment
let numbers = [1, 2, 3, 4, 5]

let result = numbers
  /> filter((x) -> x > 2)
  /> map((x) -> x * x)
  /> reduce(0, (acc, x) -> acc + x)

result /> print

-- Function with decorators
let logged = (x) -> x * 2 #log #memo

-- Context system
context Logger = { log: (msg) -> print(msg) }

let greet = (name) ->
  @Logger
  Logger.log("Hello " ++ name)
```

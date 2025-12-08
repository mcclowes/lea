# Lea Architecture

## Pipeline

```
Source → Lexer → Tokens → Parser → AST → Interpreter → Result
```

## Key Files

- `src/token.ts` — TokenType enum, Token interface, KEYWORDS map
- `src/lexer.ts` — Lexer class, scanTokens()
- `src/ast.ts` — AST node types (Expr, Stmt, Program), helper constructors
- `src/parser.ts` — Recursive descent parser
- `src/interpreter.ts` — Tree-walk interpreter, Environment class
- `src/repl.ts` — Interactive REPL
- `src/index.ts` — File runner entry point
- `src/visualization/` — Flow visualization tools
  - `flowGraph.ts` — Graph data structures
  - `astAnalyzer.ts` — AST to flow graph conversion
  - `tracer.ts` — Runtime execution tracing
  - `renderer/` — HTML/SVG rendering
  - `cli.ts` — CLI for visualization

## AST Nodes

### Expressions

- `NumberLiteral` - Numeric values
- `StringLiteral` - String values
- `BooleanLiteral` - true/false
- `Identifier` - Variable references
- `BinaryExpr` - Binary operations (+, -, *, /, etc.)
- `UnaryExpr` - Unary operations (-)
- `PipeExpr` - Pipe operations (/>)
- `CallExpr` - Function calls
- `FunctionExpr` - Function definitions (params, attachments, body, decorators)
- `ListExpr` - List literals
- `IndexExpr` - List indexing
- `PlaceholderExpr` - Placeholder (_) in pipe arguments
- `RecordExpr` - Record literals { key: value }
- `MemberExpr` - Member access (record.field)
- `AwaitExpr` - Await expression for promises
- `BlockBody` - Multi-statement function body

### Statements

- `LetStmt` - Variable binding (name, mutable, value)
- `ExprStmt` - Expression as statement
- `ContextDefStmt` - Context definition (name, defaultValue)
- `ProvideStmt` - Context override (contextName, value)

## Interpreter Details

### Environment

Lexical scoping with parent chain for nested scopes.

### Pipe Evaluation

1. If right side is CallExpr with placeholder `_` in args, substitute piped value there
2. Otherwise prepend piped value as first argument
3. If right side is just Identifier, call it with piped value as single arg

### Decorators

- `#log` — Logs function inputs/outputs
- `#memo` — Caches results by JSON-stringified args
- `#time` — Logs execution time
- `#retry(n)` — Retry on failure up to n times
- `#timeout(ms)` — Fail if exceeds time (async only)
- `#validate` — Runtime type checking and null checks
- `#pure` — Warn if side effects detected
- `#async` — Mark function as async (returns promise)
- `#trace` — Deep logging with call depth

### Builtins

**Math:** `sqrt`, `abs`, `floor`, `ceil`, `round`, `min`, `max`

**Lists:** `length`, `head`, `tail`, `push`, `concat`, `map`, `filter`, `reduce`, `range`

**IO:** `print` (returns first arg for chaining)

**Async:** `delay(ms)` — Promise that resolves after ms

### Context System

- `context Name = expr` — Define context with default value
- `provide Name expr` — Override context value in scope
- `@Name` in function body — Attach context, injects into local scope

## Visualization

The visualization system converts Lea programs into interactive flow diagrams.

### Pipeline

```
Source → Lexer → Parser → AST → Analyzer → FlowGraph → Renderer → HTML/SVG
```

### Flow Graph

- **Nodes**: Data, Transform, Branch, Merge, Binding, Condition, Await, Decorator
- **Edges**: Pipe, Parallel, Argument, Binding, Condition, Merge

### Usage

```bash
npm run visualize -- file.lea              # Generate HTML
npm run visualize -- file.lea --summary    # Print analysis
npm run visualize -- file.lea --trace      # Include runtime values
npm run visualize -- file.lea --theme dark # Dark theme
npm run visualize -- file.lea -f json      # JSON output
npm run visualize -- file.lea -f svg       # SVG output
```

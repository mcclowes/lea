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
- `FunctionExpr` - Function definitions (params, body, decorators)
- `ListExpr` - List literals
- `IndexExpr` - List indexing
- `PlaceholderExpr` - Placeholder (_) in pipe arguments

### Statements

- `LetStmt` - Variable binding (name, mutable, value)
- `ExprStmt` - Expression as statement

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

### Builtins

**Math:** `sqrt`, `abs`, `floor`, `ceil`, `round`, `min`, `max`

**Lists:** `length`, `head`, `tail`, `push`, `concat`, `map`, `filter`, `reduce`, `range`

**IO:** `print` (returns first arg for chaining)

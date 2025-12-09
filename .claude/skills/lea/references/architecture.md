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
- `TemplateStringExpr` - Template strings with interpolation
- `BooleanLiteral` - true/false
- `Identifier` - Variable references
- `BinaryExpr` - Binary operations (+, -, *, /, etc.)
- `UnaryExpr` - Unary operations (-)
- `PipeExpr` - Pipe operations (/>)
- `SpreadPipeExpr` - Spread pipe (/>>>)
- `CallExpr` - Function calls
- `FunctionExpr` - Function definitions (params, attachments, body, decorators, typeSignature?, isReverse?)
- `ListExpr` - List literals
- `IndexExpr` - List indexing
- `PlaceholderExpr` - Placeholder (`input` keyword) in pipe arguments
- `TupleExpr` - Tuple literals
- `RecordExpr` - Record literals { key: value }
- `MemberExpr` - Member access (record.field)
- `AwaitExpr` - Await expression for promises
- `BlockBody` - Multi-statement function body
- `ReturnExpr` - Early return with `return` keyword
- `PipelineLiteral` - First-class pipeline (stages, decorators)
- `ReversePipeExpr` - Reverse pipe (</)
- `BidirectionalPipelineLiteral` - Bidirectional pipeline (</>)
- `MatchExpr` - Pattern matching expression
- `MatchCase` - Individual match case (pattern, guard, body)
- `ReactivePipeExpr` - Reactive pipeline (@>)

### Statements

- `LetStmt` - Variable binding (name, mutable, value)
- `AndStmt` - Extends function with overload or reverse
- `AssignStmt` - Reassign a mutable (maybe) variable
- `ExprStmt` - Expression as statement
- `ContextDefStmt` - Context definition (name, defaultValue)
- `ProvideStmt` - Context override (contextName, value)
- `CodeblockStmt` - Collapsible code region (label, statements)

## Interpreter Details

### Environment

Lexical scoping with parent chain for nested scopes.

### Pipe Evaluation

1. If right side is CallExpr with placeholder `input` in args, substitute piped value there
2. Otherwise prepend piped value as first argument
3. If right side is just Identifier, call it with piped value as single arg

### Decorators (Functions)

- `#log` — Logs function inputs/outputs
- `#log_verbose` — Detailed logging with parameters, types, timing
- `#memo` — Caches results by JSON-stringified args
- `#time` — Logs execution time
- `#retry(n)` — Retry on failure up to n times
- `#timeout(ms)` — Fail if exceeds time (async only)
- `#validate` — Runtime type checking and null checks
- `#pure` — Warn if side effects detected
- `#async` — Mark function as async (returns promise)
- `#trace` — Deep logging with call depth
- `#coerce(Type)` — Coerce inputs to type (Int, String, Bool, List)
- `#parse` — Auto-parse string inputs as JSON or numbers
- `#stringify` — Convert output to string representation
- `#tease(Type)` — Best-effort coercion of output

### Decorators (Pipelines)

- `#log` — Logs pipeline input/output
- `#log_verbose` — Detailed stage-by-stage logging
- `#memo` — Caches pipeline results by input
- `#time` — Logs total pipeline execution time
- `#debug` — Detailed stage-by-stage execution logging
- `#profile` — Timing breakdown for each stage with percentages
- `#tap` / `#tap("fnName")` — Inspect output without modifying

### Builtins

**Math:** `sqrt`, `abs`, `floor`, `ceil`, `round`, `min`, `max`

**Lists:** `length`, `head`, `tail`, `push`, `concat`, `reverse`, `zip`, `isEmpty`, `fst`, `snd`, `take`, `at`, `partition`
- `map(list, fn)` — transform each element; callback receives `(element, index)`
- `filter(list, fn)` — keep elements matching predicate; callback receives `(element, index)`
- `reduce(list, initial, fn)` — fold into single value; callback receives `(acc, element, index)`

**IO:** `print` (returns first arg for chaining), `toString`

**Async:** `delay(ms)`, `parallel(list, fn, opts?)`, `race(fns)`, `then(promise, fn)`

**Random:** `random()`, `randomInt(max)`, `randomFloat(max)`, `randomChoice(list)`, `shuffle(list)`

**Strings:** `split`, `lines`, `join`, `charAt`, `padEnd`, `padStart`, `trim`, `trimEnd`, `indexOf`, `includes`, `repeat`, `slice`, `chars`

**Sets (on lists):** `listSet`, `setAdd`, `setHas`

### Context System

- `context Name = expr` — Define context with default value
- `provide Name expr` — Override context value in scope
- `@Name` in function body — Attach context, injects into local scope

# Lea

Tree-walk interpreter in TypeScript for a pipe-oriented functional language.

## Syntax

```
-- Comments

-- Immutable binding
let x = 10

-- Mutable binding
let mut counter = 0

-- Pipes (value flows into first argument)
16 /> sqrt
5 /> add(3)          -- becomes add(5, 3)
5 /> add(3, _)       -- placeholder: becomes add(3, 5)

-- Functions (no fn keyword)
let double = (x) -> x * 2
let add = (a, b) -> a + b
let typed = (x: Int): Int -> x + 1

-- Decorators (trailing, after function body)
let logged = (x) -> x * 2 #log #memo #time

-- Lists
[1, 2, 3] /> map((x) -> x * 2)
[1, 2, 3] /> filter((x) -> x > 1)
[1, 2, 3] /> reduce(0, (acc, x) -> acc + x)

-- String concat
"Hello" ++ " World"

-- Comparison
x == y, x != y, x < y, x > y, x <= y, x >= y
```

## Architecture

```
Source → Lexer → Tokens → Parser → AST → Interpreter → Result
```

### Files

- `src/token.ts` — TokenType enum, Token interface, KEYWORDS map
- `src/lexer.ts` — Lexer class, scanTokens()
- `src/ast.ts` — AST node types (Expr, Stmt, Program), helper constructors
- `src/parser.ts` — Recursive descent parser
- `src/interpreter.ts` — Tree-walk interpreter, Environment class
- `src/repl.ts` — Interactive REPL
- `src/index.ts` — File runner entry point

## Token Types

```
NUMBER, STRING, IDENTIFIER
LET, MUT, TRUE, FALSE
PIPE (/>), ARROW (->)
PLUS, MINUS, STAR, SLASH, PERCENT, CONCAT (++)
EQ (=), EQEQ (==), NEQ (!=), LT, GT, LTE, GTE
LPAREN, RPAREN, LBRACKET, RBRACKET, LBRACE, RBRACE
COMMA, COLON, UNDERSCORE (_), HASH (#), AT (@)
NEWLINE, EOF
```

## AST Nodes

**Expressions:**
- NumberLiteral, StringLiteral, BooleanLiteral, Identifier
- BinaryExpr, UnaryExpr, PipeExpr, CallExpr
- FunctionExpr (params, body, decorators)
- ListExpr, IndexExpr, PlaceholderExpr

**Statements:**
- LetStmt (name, mutable, value)
- ExprStmt (expression)

## Parser Precedence (low to high)

1. Pipe (`/>`)
2. Equality (`==`, `!=`)
3. Comparison (`<`, `>`, `<=`, `>=`)
4. Term (`+`, `-`, `++`)
5. Factor (`*`, `/`, `%`)
6. Unary (`-`)
7. Call (function calls, indexing)
8. Primary (literals, identifiers, grouping, functions)

## Interpreter Details

**Environment:** Lexical scoping with parent chain.

**Pipe evaluation:**
- If right side is CallExpr with placeholder `_` in args, substitute piped value there
- Otherwise prepend piped value as first argument
- If right side is just Identifier, call it with piped value as single arg

**Decorators:**
- `#log` — logs inputs/outputs
- `#memo` — caches results by JSON-stringified args
- `#time` — logs execution time

**Builtins:**
- `print` (returns first arg for chaining)
- `sqrt`, `abs`, `floor`, `ceil`, `round`, `min`, `max`
- `length`, `head`, `tail`, `push`, `concat`
- `map`, `filter`, `reduce`, `range`

## Usage

```bash
npm run repl              # Interactive REPL
npm run run file.lea      # Run a file
```

## Example Program

```
let numbers = [1, 2, 3, 4, 5]

let sumOfSquares = numbers
  /> filter((x) -> x > 2)
  /> map((x) -> x * x)
  /> reduce(0, (acc, x) -> acc + x)

sumOfSquares /> print
```

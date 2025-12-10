# Lea

Tree-walk interpreter in TypeScript for a pipe-oriented functional language.

## Development Guidelines

After modifying or adding functionality, always update:
1. **Tests** — Unit tests in `__tests__/`, integration tests in `tests/`
2. **Examples** — Files in `examples/`
3. **Syntax highlighting** — VSCode extension in `vscode-lea/`
4. **Documentation** — Relevant files in `docs/`

## Documentation

- `docs/SYNTAX.md` — Full syntax reference
- `docs/BUILTINS.md` — All built-in functions
- `docs/PIPELINES.md` — First-class pipelines
- `docs/CHEATSHEET.md` — Quick reference

## Architecture

```
Source → Lexer → Tokens → Parser → AST → Interpreter → Result
```

### Key Files

- `src/lexer.ts` — Tokenization (TokenType enum, KEYWORDS map)
- `src/parser.ts` — Recursive descent parser
- `src/ast.ts` — AST node types (Expr, Stmt, Program)
- `src/interpreter.ts` — Tree-walk interpreter, Environment class
- `src/lsp/` — Language Server Protocol implementation

## Token Types

```
NUMBER, STRING, TEMPLATE_STRING, IDENTIFIER
LET, AND, MAYBE, TRUE, FALSE, AWAIT, CONTEXT, PROVIDE, MATCH, IF, RETURN, INPUT, USE
PIPE (/>), SPREAD_PIPE (/>>>), PARALLEL_PIPE (\>), ARROW (->), REVERSE_ARROW (<-)
REVERSE_PIPE (</), BIDIRECTIONAL_PIPE (</>), REACTIVE_PIPE (@>), PIPE_CHAR (|)
PLUS, MINUS, STAR, SLASH, PERCENT, CONCAT (++)
EQ, EQEQ, NEQ, LT, GT, LTE, GTE, DOUBLE_COLON (::), COLON_GT (:>)
LPAREN, RPAREN, LBRACKET, RBRACKET, LBRACE, RBRACE
COMMA, COLON, DOT, SPREAD (...), UNDERSCORE, HASH, AT, QUESTION
NEWLINE, EOF
```

## AST Nodes

**Expressions:** NumberLiteral, StringLiteral, TemplateStringExpr, BooleanLiteral, Identifier, BinaryExpr, UnaryExpr, PipeExpr, SpreadPipeExpr, CallExpr, FunctionExpr, ListExpr, IndexExpr, TupleExpr, RecordExpr, MemberExpr, AwaitExpr, BlockBody, ReturnExpr, PipelineLiteral, ReversePipeExpr, UseExpr, BidirectionalPipelineLiteral, MatchExpr, ReactivePipeExpr

**Statements:** LetStmt, AndStmt, AssignStmt, ExprStmt, ContextDefStmt, ProvideStmt, CodeblockStmt

## Parser Precedence (low to high)

1. Ternary (`? :`)
2. Equality (`==`, `!=`)
3. Comparison (`<`, `>`, `<=`, `>=`)
4. Term (`+`, `-`, `++`)
5. Factor (`*`, `/`, `%`)
6. Pipe (`/>`, `/>>>`, `\>`, `</`)
7. Unary (`-`)
8. Call
9. Primary

## Usage

```bash
npm run lea file.lea      # Run file
npm run repl              # Interactive REPL
npm test                  # Unit tests
npm run test:integration  # Integration tests
npm run visualize -- file.lea           # Output Mermaid markdown
npm run visualize -- file.lea --html    # Output HTML with diagram
```

# Error Handling Patterns

## Error Types

```typescript
// Base error class
class LeaError extends Error {
  constructor(
    message: string,
    public line: number,
    public column: number,
    public source?: string
  ) {
    super(message);
    this.name = "LeaError";
  }

  format(): string {
    return `${this.name} at line ${this.line}, column ${this.column}: ${this.message}`;
  }
}

// Specific error types
class LexerError extends LeaError {
  name = "LexerError";
}

class ParseError extends LeaError {
  name = "ParseError";
}

class RuntimeError extends LeaError {
  name = "RuntimeError";
}

class TypeError extends LeaError {
  name = "TypeError";
}
```

## Lexer Error Handling

```typescript
class Lexer {
  private error(message: string): never {
    throw new LexerError(message, this.line, this.column, this.source);
  }

  private string(): Token {
    const start = this.pos;
    this.advance(); // Opening quote

    while (!this.isAtEnd() && this.peek() !== '"') {
      if (this.peek() === "\n") {
        this.error("Unterminated string");
      }
      if (this.peek() === "\\") {
        this.advance();
        if (this.isAtEnd()) {
          this.error("Unterminated escape sequence");
        }
      }
      this.advance();
    }

    if (this.isAtEnd()) {
      this.error("Unterminated string");
    }

    this.advance(); // Closing quote
    return this.makeToken(TokenType.STRING);
  }
}
```

## Parser Error Recovery

```typescript
class Parser {
  private errors: ParseError[] = [];

  parse(): { program: Program; errors: ParseError[] } {
    const statements: Stmt[] = [];

    while (!this.isAtEnd()) {
      try {
        statements.push(this.statement());
      } catch (error) {
        if (error instanceof ParseError) {
          this.errors.push(error);
          this.synchronize();
        } else {
          throw error;
        }
      }
    }

    return { program: { type: "Program", body: statements }, errors: this.errors };
  }

  private synchronize(): void {
    this.advance();

    while (!this.isAtEnd()) {
      // Sync at statement boundaries
      if (this.previous().type === TokenType.NEWLINE) return;

      switch (this.peek().type) {
        case TokenType.LET:
        case TokenType.IF:
        case TokenType.RETURN:
        case TokenType.CONTEXT:
          return;
      }

      this.advance();
    }
  }

  private error(message: string): never {
    const token = this.peek();
    throw new ParseError(message, token.line, token.column);
  }

  private expect(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    this.error(message);
  }
}
```

## Runtime Error Handling

```typescript
class Interpreter {
  evaluate(expr: Expr): Value {
    try {
      return this.evaluateExpr(expr);
    } catch (error) {
      if (error instanceof RuntimeError) {
        throw error;
      }
      // Wrap unexpected errors
      throw new RuntimeError(
        `Internal error: ${error.message}`,
        expr.line,
        expr.column
      );
    }
  }

  private checkType(value: Value, expected: string, line: number): void {
    const actual = typeof value;
    if (actual !== expected) {
      throw new TypeError(
        `Expected ${expected}, got ${actual}`,
        line,
        0
      );
    }
  }

  private callFunction(fn: Function, args: Value[], line: number): Value {
    if (args.length !== fn.arity) {
      throw new RuntimeError(
        `Expected ${fn.arity} arguments, got ${args.length}`,
        line,
        0
      );
    }
    return fn.call(args);
  }
}
```

## User-Friendly Messages

```typescript
function formatError(error: LeaError, source: string): string {
  const lines = source.split("\n");
  const line = lines[error.line - 1] || "";
  const pointer = " ".repeat(error.column - 1) + "^";

  return `
${error.name}: ${error.message}

  ${error.line} | ${line}
    | ${pointer}
`.trim();
}
```

## Error Codes

```typescript
enum ErrorCode {
  // Lexer errors (1xxx)
  UNTERMINATED_STRING = 1001,
  INVALID_CHARACTER = 1002,
  INVALID_NUMBER = 1003,

  // Parser errors (2xxx)
  UNEXPECTED_TOKEN = 2001,
  MISSING_EXPRESSION = 2002,
  MISSING_CLOSING_PAREN = 2003,

  // Runtime errors (3xxx)
  UNDEFINED_VARIABLE = 3001,
  TYPE_MISMATCH = 3002,
  DIVISION_BY_ZERO = 3003,
}
```

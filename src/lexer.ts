import { Token, TokenType, KEYWORDS, createToken } from "./token";

export class LexerError extends Error {
  constructor(message: string, public line: number, public column: number) {
    super(`[${line}:${column}] ${message}`);
    this.name = "LexerError";
  }
}

export class Lexer {
  private source: string;
  private tokens: Token[] = [];
  private start = 0;
  private current = 0;
  private line = 1;
  private column = 1;
  private lineStart = 0;

  constructor(source: string) {
    this.source = source;
  }

  scanTokens(): Token[] {
    while (!this.isAtEnd()) {
      this.start = this.current;
      this.scanToken();
    }

    this.tokens.push(createToken(TokenType.EOF, "", null, this.line, this.column));
    return this.tokens;
  }

  private scanToken(): void {
    const c = this.advance();

    switch (c) {
      case "(": this.addToken(TokenType.LPAREN); break;
      case ")": this.addToken(TokenType.RPAREN); break;
      case "[": this.addToken(TokenType.LBRACKET); break;
      case "]": this.addToken(TokenType.RBRACKET); break;
      case "{": this.addToken(TokenType.LBRACE); break;
      case "}": this.addToken(TokenType.RBRACE); break;
      case ",": this.addToken(TokenType.COMMA); break;
      case "|": this.addToken(TokenType.PIPE_CHAR); break;
      case ":":
        if (this.match(":")) {
          this.addToken(TokenType.DOUBLE_COLON);
        } else if (this.match(">")) {
          this.addToken(TokenType.COLON_GT);
        } else {
          this.addToken(TokenType.COLON);
        }
        break;
      case ".": this.addToken(TokenType.DOT); break;
      case "#": this.addToken(TokenType.HASH); break;
      case "@":
        if (this.match(">")) {
          this.addToken(TokenType.REACTIVE_PIPE);
        } else {
          this.addToken(TokenType.AT);
        }
        break;
      case "?": this.addToken(TokenType.QUESTION); break;
      case "*": this.addToken(TokenType.STAR); break;
      case "%": this.addToken(TokenType.PERCENT); break;
      case "\\":
        if (this.match(">")) {
          this.addToken(TokenType.PARALLEL_PIPE);
        } else {
          throw new LexerError(`Unexpected character '\\'`, this.line, this.column - 1);
        }
        break;
      case "_":
        if (this.isAlphaNumeric(this.peek())) {
          this.identifier();
        } else {
          this.addToken(TokenType.UNDERSCORE);
        }
        break;

      case "+":
        this.addToken(this.match("+") ? TokenType.CONCAT : TokenType.PLUS);
        break;

      case "-":
        if (this.match("-")) {
          this.comment();
        } else if (this.match(">")) {
          this.addToken(TokenType.ARROW);
        } else {
          this.addToken(TokenType.MINUS);
        }
        break;


      case "/":
        if (this.match(">")) {
          // Check for />> (spread pipe) vs /> (regular pipe)
          if (this.match(">")) {
            this.addToken(TokenType.SPREAD_PIPE);
          } else {
            this.addToken(TokenType.PIPE);
          }
        } else {
          this.addToken(TokenType.SLASH);
        }
        break;

      case "=":
        this.addToken(this.match("=") ? TokenType.EQEQ : TokenType.EQ);
        break;

      case "!":
        if (this.match("=")) {
          this.addToken(TokenType.NEQ);
        } else {
          throw new LexerError(`Unexpected character '!'`, this.line, this.column - 1);
        }
        break;

      case "<":
        if (this.match("/")) {
          // Could be </> (codeblock close / bidirectional pipe) or </ (reverse pipe)
          if (this.match(">")) {
            // </> - Use BIDIRECTIONAL_PIPE for expression context
            // The parser will distinguish between codeblock close and bidirectional pipe
            this.addToken(TokenType.BIDIRECTIONAL_PIPE);
          } else {
            // </ - Reverse pipe operator
            this.addToken(TokenType.REVERSE_PIPE);
          }
        } else if (this.match(">")) {
          // Codeblock open <> - capture optional label on same line
          this.codeblockOpen();
        } else if (this.match("-")) {
          this.addToken(TokenType.RETURN);
        } else if (this.match("=")) {
          this.addToken(TokenType.LTE);
        } else {
          this.addToken(TokenType.LT);
        }
        break;

      case ">":
        this.addToken(this.match("=") ? TokenType.GTE : TokenType.GT);
        break;

      case " ":
      case "\r":
      case "\t":
        break;

      case "\n":
        this.addToken(TokenType.NEWLINE);
        this.line++;
        this.lineStart = this.current;
        this.column = 1;
        break;

      case '"':
        this.string();
        break;

      case '`':
        this.templateString();
        break;

      default:
        if (this.isDigit(c)) {
          this.number();
        } else if (this.isAlpha(c)) {
          this.identifier();
        } else {
          throw new LexerError(`Unexpected character '${c}'`, this.line, this.column - 1);
        }
    }
  }

  private comment(): void {
    while (this.peek() !== "\n" && !this.isAtEnd()) {
      this.advance();
    }
  }

  private codeblockOpen(): void {
    // Skip whitespace after <>
    while (this.peek() === " " || this.peek() === "\t") {
      this.advance();
    }

    // Check for optional label (rest of line after <> and whitespace)
    let label = "";
    if (this.peek() !== "\n" && !this.isAtEnd() && this.peek() !== "-") {
      const labelStart = this.current;
      while (this.peek() !== "\n" && !this.isAtEnd()) {
        this.advance();
      }
      label = this.source.slice(labelStart, this.current).trim();
    } else if (this.peek() === "-" && this.peekNext() === "-") {
      // It's a comment, skip to capture label from comment
      this.advance(); // -
      this.advance(); // -
      // Skip whitespace after --
      while (this.peek() === " " || this.peek() === "\t") {
        this.advance();
      }
      const labelStart = this.current;
      while (this.peek() !== "\n" && !this.isAtEnd()) {
        this.advance();
      }
      label = this.source.slice(labelStart, this.current).trim();
    }

    this.addToken(TokenType.CODEBLOCK_OPEN, label || null);
  }

  private string(): void {
    const startLine = this.line;
    const startColumn = this.column - 1;

    while (this.peek() !== '"' && !this.isAtEnd()) {
      if (this.peek() === "\n") {
        this.line++;
        this.column = 1;
      }
      this.advance();
    }

    if (this.isAtEnd()) {
      throw new LexerError("Unterminated string", startLine, startColumn);
    }

    this.advance(); // closing "

    const value = this.source.slice(this.start + 1, this.current - 1);
    this.addToken(TokenType.STRING, value);
  }

  // Template string: `hello {name}, you are {age} years old`
  // Stores parts as array: ["hello ", "name", ", you are ", "age", " years old"]
  // Even indices are string literals, odd indices are expression source code
  private templateString(): void {
    const startLine = this.line;
    const startColumn = this.column - 1;
    const parts: string[] = [];
    let currentPart = "";

    while (this.peek() !== '`' && !this.isAtEnd()) {
      if (this.peek() === "\n") {
        this.line++;
        this.column = 1;
        currentPart += this.advance();
      } else if (this.peek() === '{') {
        // Start of interpolation
        parts.push(currentPart);
        currentPart = "";
        this.advance(); // consume {

        // Read the expression until matching }
        let braceDepth = 1;
        let exprSource = "";
        while (braceDepth > 0 && !this.isAtEnd()) {
          const c = this.peek();
          if (c === '{') {
            braceDepth++;
            exprSource += this.advance();
          } else if (c === '}') {
            braceDepth--;
            if (braceDepth > 0) {
              exprSource += this.advance();
            } else {
              this.advance(); // consume closing }
            }
          } else if (c === "\n") {
            this.line++;
            this.column = 1;
            exprSource += this.advance();
          } else {
            exprSource += this.advance();
          }
        }

        if (braceDepth > 0) {
          throw new LexerError("Unterminated interpolation in template string", startLine, startColumn);
        }

        parts.push(exprSource.trim());
      } else {
        currentPart += this.advance();
      }
    }

    if (this.isAtEnd()) {
      throw new LexerError("Unterminated template string", startLine, startColumn);
    }

    this.advance(); // closing `
    parts.push(currentPart); // Add final string part

    this.addToken(TokenType.TEMPLATE_STRING, parts);
  }

  private number(): void {
    while (this.isDigit(this.peek())) {
      this.advance();
    }

    if (this.peek() === "." && this.isDigit(this.peekNext())) {
      this.advance(); // consume .
      while (this.isDigit(this.peek())) {
        this.advance();
      }
    }

    const value = parseFloat(this.source.slice(this.start, this.current));
    this.addToken(TokenType.NUMBER, value);
  }

  private identifier(): void {
    while (this.isAlphaNumeric(this.peek())) {
      this.advance();
    }

    const text = this.source.slice(this.start, this.current);
    const type = KEYWORDS[text] ?? TokenType.IDENTIFIER;
    this.addToken(type);
  }

  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }

  private advance(): string {
    this.column++;
    return this.source[this.current++];
  }

  private peek(): string {
    if (this.isAtEnd()) return "\0";
    return this.source[this.current];
  }

  private peekNext(): string {
    if (this.current + 1 >= this.source.length) return "\0";
    return this.source[this.current + 1];
  }

  private match(expected: string): boolean {
    if (this.isAtEnd()) return false;
    if (this.source[this.current] !== expected) return false;
    this.current++;
    this.column++;
    return true;
  }

  private addToken(type: TokenType, literal: unknown = null): void {
    const lexeme = this.source.slice(this.start, this.current);
    const col = this.start - this.lineStart + 1;
    this.tokens.push(createToken(type, lexeme, literal, this.line, col));
  }

  private isDigit(c: string): boolean {
    return c >= "0" && c <= "9";
  }

  private isAlpha(c: string): boolean {
    return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
  }

  private isAlphaNumeric(c: string): boolean {
    return this.isAlpha(c) || this.isDigit(c);
  }
}

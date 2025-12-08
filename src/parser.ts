import { Token, TokenType } from "./token";
import {
  Expr,
  Stmt,
  Program,
  FunctionParam,
  Decorator,
  LetStmt,
  BlockBody,
  RecordField,
  numberLiteral,
  stringLiteral,
  booleanLiteral,
  identifier,
  binaryExpr,
  unaryExpr,
  pipeExpr,
  callExpr,
  functionExpr,
  listExpr,
  indexExpr,
  placeholderExpr,
  awaitExpr,
  recordExpr,
  memberExpr,
  blockBody,
  contextDefStmt,
  provideStmt,
  letStmt,
  exprStmt,
  program,
} from "./ast";

export class ParseError extends Error {
  constructor(message: string, public token: Token) {
    super(`[${token.line}:${token.column}] ${message}`);
    this.name = "ParseError";
  }
}

export class Parser {
  private tokens: Token[];
  private current = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): Program {
    const statements: Stmt[] = [];

    this.skipNewlines();
    while (!this.isAtEnd()) {
      statements.push(this.statement());
      this.skipNewlines();
    }

    return program(statements);
  }

  private statement(): Stmt {
    if (this.check(TokenType.LET)) {
      return this.letStatement();
    }
    if (this.check(TokenType.CONTEXT)) {
      return this.contextStatement();
    }
    if (this.check(TokenType.PROVIDE)) {
      return this.provideStatement();
    }
    return exprStmt(this.expression());
  }

  private contextStatement(): Stmt {
    this.consume(TokenType.CONTEXT, "Expected 'context'");
    const name = this.consume(TokenType.IDENTIFIER, "Expected context name").lexeme;
    this.consume(TokenType.EQ, "Expected '=' after context name");
    const defaultValue = this.expression();
    return contextDefStmt(name, defaultValue);
  }

  private provideStatement(): Stmt {
    this.consume(TokenType.PROVIDE, "Expected 'provide'");
    const contextName = this.consume(TokenType.IDENTIFIER, "Expected context name").lexeme;
    const value = this.expression();
    return provideStmt(contextName, value);
  }

  private letStatement(): LetStmt {
    this.consume(TokenType.LET, "Expected 'let'");

    const mutable = this.match(TokenType.MUT);
    const name = this.consume(TokenType.IDENTIFIER, "Expected variable name").lexeme;

    this.consume(TokenType.EQ, "Expected '=' after variable name");
    const value = this.expression();

    return letStmt(name, mutable, value);
  }

  // Precedence (low to high): pipe, equality, comparison, term, factor, unary, call, primary
  private expression(): Expr {
    return this.pipe();
  }

  private pipe(): Expr {
    let expr = this.equality();

    while (true) {
      this.skipNewlines();
      if (!this.match(TokenType.PIPE)) break;
      this.skipNewlines();
      const right = this.equality();
      expr = pipeExpr(expr, right);
    }

    return expr;
  }

  private equality(): Expr {
    let expr = this.comparison();

    while (this.match(TokenType.EQEQ, TokenType.NEQ)) {
      const operator = this.previous();
      const right = this.comparison();
      expr = binaryExpr(operator, expr, right);
    }

    return expr;
  }

  private comparison(): Expr {
    let expr = this.term();

    while (this.match(TokenType.LT, TokenType.GT, TokenType.LTE, TokenType.GTE)) {
      const operator = this.previous();
      const right = this.term();
      expr = binaryExpr(operator, expr, right);
    }

    return expr;
  }

  private term(): Expr {
    let expr = this.factor();

    while (this.match(TokenType.PLUS, TokenType.MINUS, TokenType.CONCAT)) {
      const operator = this.previous();
      const right = this.factor();
      expr = binaryExpr(operator, expr, right);
    }

    return expr;
  }

  private factor(): Expr {
    let expr = this.unary();

    while (this.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT)) {
      const operator = this.previous();
      const right = this.unary();
      expr = binaryExpr(operator, expr, right);
    }

    return expr;
  }

  private unary(): Expr {
    if (this.match(TokenType.MINUS)) {
      const operator = this.previous();
      const operand = this.unary();
      return unaryExpr(operator, operand);
    }

    if (this.match(TokenType.AWAIT)) {
      const operand = this.unary();
      return awaitExpr(operand);
    }

    return this.call();
  }

  private call(): Expr {
    let expr = this.primary();

    while (true) {
      if (this.match(TokenType.LPAREN)) {
        expr = this.finishCall(expr);
      } else if (this.match(TokenType.LBRACKET)) {
        const index = this.expression();
        this.consume(TokenType.RBRACKET, "Expected ']' after index");
        expr = indexExpr(expr, index);
      } else if (this.match(TokenType.DOT)) {
        const member = this.consume(TokenType.IDENTIFIER, "Expected property name after '.'").lexeme;
        expr = memberExpr(expr, member);
      } else {
        break;
      }
    }

    return expr;
  }

  private finishCall(callee: Expr): Expr {
    const args: Expr[] = [];

    if (!this.check(TokenType.RPAREN)) {
      do {
        args.push(this.expression());
      } while (this.match(TokenType.COMMA));
    }

    this.consume(TokenType.RPAREN, "Expected ')' after arguments");
    return callExpr(callee, args);
  }

  private primary(): Expr {
    if (this.match(TokenType.NUMBER)) {
      return numberLiteral(this.previous().literal as number);
    }

    if (this.match(TokenType.STRING)) {
      return stringLiteral(this.previous().literal as string);
    }

    if (this.match(TokenType.TRUE)) {
      return booleanLiteral(true);
    }

    if (this.match(TokenType.FALSE)) {
      return booleanLiteral(false);
    }

    if (this.match(TokenType.UNDERSCORE)) {
      return placeholderExpr();
    }

    if (this.match(TokenType.IDENTIFIER)) {
      return identifier(this.previous().lexeme);
    }

    if (this.match(TokenType.LBRACKET)) {
      return this.list();
    }

    if (this.match(TokenType.LBRACE)) {
      return this.record();
    }

    if (this.match(TokenType.LPAREN)) {
      return this.groupingOrFunction();
    }

    throw new ParseError(`Unexpected token '${this.peek().lexeme}'`, this.peek());
  }

  private record(): Expr {
    const fields: RecordField[] = [];

    this.skipNewlines();
    if (!this.check(TokenType.RBRACE)) {
      do {
        this.skipNewlines();
        const key = this.consume(TokenType.IDENTIFIER, "Expected field name").lexeme;
        this.consume(TokenType.COLON, "Expected ':' after field name");
        const value = this.expression();
        fields.push({ key, value });
        this.skipNewlines();
      } while (this.match(TokenType.COMMA));
    }
    this.skipNewlines();
    this.consume(TokenType.RBRACE, "Expected '}' after record fields");
    return recordExpr(fields);
  }

  private list(): Expr {
    const elements: Expr[] = [];

    if (!this.check(TokenType.RBRACKET)) {
      do {
        elements.push(this.expression());
      } while (this.match(TokenType.COMMA));
    }

    this.consume(TokenType.RBRACKET, "Expected ']' after list elements");
    return listExpr(elements);
  }

  private groupingOrFunction(): Expr {
    // Could be: (expr), (), (params) -> body
    const startPos = this.current;

    // Check for empty params: () ->
    if (this.check(TokenType.RPAREN)) {
      this.advance(); // consume )
      if (this.match(TokenType.ARROW)) {
        const { attachments, body } = this.parseFunctionBody();
        const decorators = this.parseDecorators();
        return functionExpr([], body, undefined, decorators, attachments);
      }
      // Empty parens not followed by arrow - error
      throw new ParseError("Empty parentheses", this.peek());
    }

    // Try to parse as function parameters
    if (this.looksLikeFunctionParams()) {
      const params = this.parseFunctionParams();
      this.consume(TokenType.RPAREN, "Expected ')' after parameters");

      let returnType: string | undefined;
      if (this.match(TokenType.COLON)) {
        returnType = this.consume(TokenType.IDENTIFIER, "Expected return type").lexeme;
      }

      this.consume(TokenType.ARROW, "Expected '->' after function parameters");
      const { attachments, body } = this.parseFunctionBody();
      const decorators = this.parseDecorators();

      return functionExpr(params, body, returnType, decorators, attachments);
    }

    // Otherwise it's a grouping expression
    const expr = this.expression();
    this.consume(TokenType.RPAREN, "Expected ')' after expression");
    return expr;
  }

  private parseFunctionBody(): { attachments: string[]; body: Expr | BlockBody } {
    const arrowLine = this.previous().line;

    // Check for brace-delimited block: -> { ... }
    if (this.check(TokenType.LBRACE)) {
      this.advance(); // consume {
      return this.parseBlockBody();
    }

    // Check for newline after arrow (indentation-based block)
    if (this.check(TokenType.NEWLINE)) {
      this.advance(); // consume newline
      return this.parseIndentedBody();
    }

    // Single expression on same line
    const body = this.expression();
    return { attachments: [], body };
  }

  private parseBlockBody(): { attachments: string[]; body: BlockBody } {
    const attachments: string[] = [];
    const statements: Stmt[] = [];

    this.skipNewlines();

    // Parse @attachments at the start
    while (this.check(TokenType.AT)) {
      this.advance(); // consume @
      const name = this.consume(TokenType.IDENTIFIER, "Expected context name after '@'").lexeme;
      attachments.push(name);
      this.skipNewlines();
    }

    // Parse statements until we hit } or a final expression
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      this.skipNewlines();
      if (this.check(TokenType.RBRACE)) break;

      // Check if this is a statement (let, context, provide) or expression
      if (this.check(TokenType.LET) || this.check(TokenType.CONTEXT) || this.check(TokenType.PROVIDE)) {
        statements.push(this.statement());
      } else {
        // Could be final expression or expression statement
        const expr = this.expression();
        this.skipNewlines();

        // If next is }, this was the final expression
        if (this.check(TokenType.RBRACE)) {
          this.consume(TokenType.RBRACE, "Expected '}'");
          return { attachments, body: blockBody(statements, expr) };
        }

        // Otherwise it was an expression statement, continue
        statements.push(exprStmt(expr));
      }
      this.skipNewlines();
    }

    // If we got here with no final expression, error
    this.consume(TokenType.RBRACE, "Expected '}' after block");
    throw new ParseError("Block must end with an expression", this.previous());
  }

  private parseIndentedBody(): { attachments: string[]; body: Expr | BlockBody } {
    const attachments: string[] = [];
    const statements: Stmt[] = [];

    // Skip to first non-empty line and get its indentation
    while (this.check(TokenType.NEWLINE)) {
      this.advance();
    }

    // Record the indentation level of the body
    const bodyIndent = this.peek().column;

    // Parse @attachments at the start
    while (this.check(TokenType.AT)) {
      this.advance(); // consume @
      const name = this.consume(TokenType.IDENTIFIER, "Expected context name after '@'").lexeme;
      attachments.push(name);
      this.skipNewlines();
    }

    // Parse statements/expressions until we dedent
    while (!this.isAtEnd()) {
      // Skip empty lines
      while (this.check(TokenType.NEWLINE)) {
        this.advance();
      }
      if (this.isAtEnd()) break;

      // Check if we've dedented back to column 1 or less than body indent
      const currentToken = this.peek();
      if (currentToken.column < bodyIndent) {
        break;
      }

      // Decorators (#) signal end of body - they come after the function
      if (currentToken.type === TokenType.HASH) {
        break;
      }

      // Check for comments (lines starting with --)
      if (currentToken.type === TokenType.MINUS) {
        // Could be a comment, let it parse and continue
      }

      if (this.check(TokenType.LET) || this.check(TokenType.CONTEXT) || this.check(TokenType.PROVIDE)) {
        statements.push(this.statement());
      } else {
        const expr = this.expression();

        // Check if this is the last expression (next line dedented or EOF)
        const savedPos = this.current;
        this.skipNewlines();

        if (this.isAtEnd()) {
          return { attachments, body: blockBody(statements, expr) };
        }

        // Check if next meaningful token is dedented
        const nextToken = this.peek();
        if (nextToken.column < bodyIndent) {
          this.current = savedPos;
          return { attachments, body: blockBody(statements, expr) };
        }

        // Not done yet, this was an expression statement
        this.current = savedPos;
        statements.push(exprStmt(expr));
      }
    }

    // If we have statements but no final expression, the last statement's expression is the result
    if (statements.length > 0) {
      const lastStmt = statements.pop()!;
      if (lastStmt.kind === "ExprStmt") {
        return { attachments, body: blockBody(statements, lastStmt.expression) };
      }
      // Put it back and error
      statements.push(lastStmt);
    }

    throw new ParseError("Block must end with an expression", this.previous());
  }

  private peekPreviousNewlineColumn(): number {
    // Helper to check indentation - look back for last newline
    for (let i = this.current - 1; i >= 0; i--) {
      if (this.tokens[i].type === TokenType.NEWLINE) {
        return this.tokens[i + 1]?.column ?? 1;
      }
    }
    return 1;
  }

  private looksLikeFunctionParams(): boolean {
    // Look ahead to determine if this is a function definition
    // Function params: identifier followed by , or : or )
    // Then ) followed by -> or : identifier ->
    const saved = this.current;
    let parenDepth = 1;

    while (parenDepth > 0 && !this.isAtEnd()) {
      if (this.check(TokenType.LPAREN)) parenDepth++;
      if (this.check(TokenType.RPAREN)) parenDepth--;
      if (parenDepth > 0) this.advance();
    }

    if (this.check(TokenType.RPAREN)) {
      this.advance(); // consume the )
      // Check for optional return type
      if (this.check(TokenType.COLON)) {
        this.advance(); // consume :
        if (this.check(TokenType.IDENTIFIER)) {
          this.advance(); // consume type
        }
      }
      const isFunction = this.check(TokenType.ARROW);
      this.current = saved;
      return isFunction;
    }

    this.current = saved;
    return false;
  }

  private parseFunctionParams(): FunctionParam[] {
    const params: FunctionParam[] = [];

    do {
      const name = this.consume(TokenType.IDENTIFIER, "Expected parameter name").lexeme;
      let typeAnnotation: string | undefined;

      if (this.match(TokenType.COLON)) {
        typeAnnotation = this.consume(TokenType.IDENTIFIER, "Expected type").lexeme;
      }

      params.push({ name, typeAnnotation });
    } while (this.match(TokenType.COMMA));

    return params;
  }

  private parseDecorators(): Decorator[] {
    const decorators: Decorator[] = [];

    // Allow decorators on following lines
    this.skipNewlines();

    while (this.match(TokenType.HASH)) {
      const name = this.consume(TokenType.IDENTIFIER, "Expected decorator name").lexeme;
      const args: (number | string | boolean)[] = [];

      // Parse optional arguments: #retry(3) or #timeout(1000)
      if (this.match(TokenType.LPAREN)) {
        if (!this.check(TokenType.RPAREN)) {
          do {
            if (this.match(TokenType.NUMBER)) {
              args.push(this.previous().literal as number);
            } else if (this.match(TokenType.STRING)) {
              args.push(this.previous().literal as string);
            } else if (this.match(TokenType.TRUE)) {
              args.push(true);
            } else if (this.match(TokenType.FALSE)) {
              args.push(false);
            } else {
              throw new ParseError("Expected literal in decorator argument", this.peek());
            }
          } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, "Expected ')' after decorator arguments");
      }

      decorators.push({ name, args });
      // Allow next decorator on a new line
      this.skipNewlines();
    }

    return decorators;
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new ParseError(message, this.peek());
  }

  private skipNewlines(): void {
    while (this.match(TokenType.NEWLINE)) {
      // skip
    }
  }
}

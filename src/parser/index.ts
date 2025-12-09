/**
 * Parser for the Lea language
 *
 * This module exports the Parser class which transforms tokens into an AST.
 * The parsing logic is split into several modules:
 * - types.ts: ParserContext interface and utility functions
 * - statements.ts: Statement parsing (let, context, provide, etc.)
 * - expressions.ts: Expression parsing with precedence handling
 * - primaries.ts: Primary expressions (literals, records, lists, pipelines)
 * - functions.ts: Function-related parsing (params, body, types)
 */

import { Token, TokenType } from "../token";
import { Stmt, Program, program } from "../ast";
import { createParserContext, ParseError } from "./types";
import { parseStatement } from "./statements";
import { parseExpression } from "./expressions";

// Re-export ParseError for consumers
export { ParseError } from "./types";

/**
 * Parser class - transforms tokens into an AST
 */
export class Parser {
  private ctx;

  constructor(tokens: Token[]) {
    this.ctx = createParserContext(tokens);
  }

  /**
   * Parse the token stream into a program AST
   */
  parse(): Program {
    const statements: Stmt[] = [];
    let strict = false;

    this.ctx.skipNewlines();

    // Check for #strict pragma at the beginning of the file
    if (this.ctx.check(TokenType.HASH)) {
      const savedPos = this.ctx.current;
      this.ctx.advance(); // consume #
      if (this.ctx.check(TokenType.IDENTIFIER) && this.ctx.peek().lexeme === "strict") {
        this.ctx.advance(); // consume "strict"
        strict = true;
        this.ctx.skipNewlines();
      } else {
        // Not #strict, restore position
        this.ctx.setCurrent(savedPos);
      }
    }

    while (!this.ctx.isAtEnd()) {
      statements.push(parseStatement(this.ctx));
      this.ctx.skipNewlines();
    }

    return program(statements, strict);
  }

  /**
   * Parse a single expression (used for embedded expressions in template strings)
   */
  expression() {
    return parseExpression(this.ctx);
  }
}

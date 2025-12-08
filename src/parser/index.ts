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

import { Token } from "../token";
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

    this.ctx.skipNewlines();
    while (!this.ctx.isAtEnd()) {
      statements.push(parseStatement(this.ctx));
      this.ctx.skipNewlines();
    }

    return program(statements);
  }

  /**
   * Parse a single expression (used for embedded expressions in template strings)
   */
  expression() {
    return parseExpression(this.ctx);
  }
}

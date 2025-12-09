import { TokenType } from "../token";
import {
  Stmt,
  LetStmt,
  DestructurePattern,
  AndStmt,
  Decorator,
  letStmt,
  andStmt,
  exprStmt,
  contextDefStmt,
  provideStmt,
  decoratorDefStmt,
  codeblockStmt,
  assignStmt,
} from "../ast";
import { ParserContext } from "./types";
import { parseExpression } from "./expressions";
import { parseDecorators } from "./primaries";

/**
 * Parse a statement
 */
export function parseStatement(ctx: ParserContext): Stmt {
  if (ctx.check(TokenType.LET)) {
    return parseLetStatement(ctx, false);
  }
  if (ctx.check(TokenType.AND)) {
    return parseAndStatement(ctx);
  }
  if (ctx.check(TokenType.MAYBE)) {
    return parseLetStatement(ctx, true);
  }
  if (ctx.check(TokenType.CONTEXT)) {
    return parseContextStatement(ctx);
  }
  if (ctx.check(TokenType.PROVIDE)) {
    return parseProvideStatement(ctx);
  }
  if (ctx.check(TokenType.DECORATOR)) {
    return parseDecoratorDefStatement(ctx);
  }
  if (ctx.check(TokenType.CODEBLOCK_OPEN)) {
    return parseCodeblockStatement(ctx);
  }

  // Check for assignment statement: identifier = expression
  // We need to look ahead to see if it's IDENTIFIER followed by EQ (not EQEQ)
  if (ctx.check(TokenType.IDENTIFIER)) {
    const savedPos = ctx.current;
    ctx.advance(); // consume identifier
    if (ctx.check(TokenType.EQ)) {
      ctx.setCurrent(savedPos); // restore
      return parseAssignStatement(ctx);
    }
    ctx.setCurrent(savedPos); // restore - not an assignment
  }

  return exprStmt(parseExpression(ctx));
}

/**
 * Parse a let/maybe statement
 * Supports:
 *   let name = value
 *   let { field1, field2 } = record
 *   let (x, y) = tuple
 */
export function parseLetStatement(ctx: ParserContext, mutable: boolean): LetStmt {
  // Consume either 'let' or 'maybe' keyword
  if (ctx.check(TokenType.LET)) {
    ctx.advance();
  } else if (ctx.check(TokenType.MAYBE)) {
    ctx.advance();
  }

  // Check for destructuring pattern
  let pattern: DestructurePattern | undefined;
  let name: string;

  if (ctx.check(TokenType.LBRACE)) {
    // Record destructuring: let { field1, field2 } = value
    ctx.advance(); // consume {
    const fields: string[] = [];
    if (!ctx.check(TokenType.RBRACE)) {
      do {
        const fieldName = ctx.consume(TokenType.IDENTIFIER, "Expected field name").lexeme;
        fields.push(fieldName);
      } while (ctx.match(TokenType.COMMA));
    }
    ctx.consume(TokenType.RBRACE, "Expected '}' after destructuring pattern");
    pattern = { kind: "RecordPattern", fields };
    name = "__destructure__"; // Placeholder name for destructured bindings
  } else if (ctx.check(TokenType.LPAREN)) {
    // Tuple destructuring: let (x, y) = value
    ctx.advance(); // consume (
    const names: string[] = [];
    if (!ctx.check(TokenType.RPAREN)) {
      do {
        const varName = ctx.consume(TokenType.IDENTIFIER, "Expected variable name").lexeme;
        names.push(varName);
      } while (ctx.match(TokenType.COMMA));
    }
    ctx.consume(TokenType.RPAREN, "Expected ')' after destructuring pattern");
    pattern = { kind: "TuplePattern", names };
    name = "__destructure__"; // Placeholder name for destructured bindings
  } else {
    // Regular binding: let name = value
    name = ctx.consume(TokenType.IDENTIFIER, "Expected variable name").lexeme;
  }

  ctx.consume(TokenType.EQ, "Expected '=' after variable name or pattern");
  // Skip newlines after = to allow pipeline literals on the next line:
  // let foo =
  //   /> map((x) -> x + 1)
  ctx.skipNewlines();
  const value = parseExpression(ctx);

  // Parse optional trailing decorators for the let statement (e.g., #export)
  // Note: This is in addition to any decorators on the value expression itself
  const savedPos = ctx.current;
  const decorators = parseDecorators(ctx);
  if (decorators.length === 0) {
    ctx.setCurrent(savedPos);
  }

  return letStmt(name, mutable, value, pattern, decorators.length > 0 ? decorators : undefined);
}

/**
 * Parse an assignment statement: name = value
 * Used for reassigning mutable (maybe) variables
 */
export function parseAssignStatement(ctx: ParserContext): Stmt {
  const name = ctx.consume(TokenType.IDENTIFIER, "Expected variable name").lexeme;
  ctx.consume(TokenType.EQ, "Expected '=' after variable name");
  ctx.skipNewlines();
  const value = parseExpression(ctx);
  return assignStmt(name, value);
}

/**
 * Parse an and statement - extends an existing function (overload or reverse)
 */
export function parseAndStatement(ctx: ParserContext): AndStmt {
  ctx.consume(TokenType.AND, "Expected 'and'");

  const name = ctx.consume(TokenType.IDENTIFIER, "Expected variable name").lexeme;

  ctx.consume(TokenType.EQ, "Expected '=' after variable name");
  ctx.skipNewlines();
  const value = parseExpression(ctx);

  return andStmt(name, value);
}

/**
 * Parse a context definition statement
 */
export function parseContextStatement(ctx: ParserContext): Stmt {
  ctx.consume(TokenType.CONTEXT, "Expected 'context'");
  const name = ctx.consume(TokenType.IDENTIFIER, "Expected context name").lexeme;
  ctx.consume(TokenType.EQ, "Expected '=' after context name");
  const defaultValue = parseExpression(ctx);
  return contextDefStmt(name, defaultValue);
}

/**
 * Parse a provide statement
 */
export function parseProvideStatement(ctx: ParserContext): Stmt {
  ctx.consume(TokenType.PROVIDE, "Expected 'provide'");
  const contextName = ctx.consume(TokenType.IDENTIFIER, "Expected context name").lexeme;
  const value = parseExpression(ctx);
  return provideStmt(contextName, value);
}

/**
 * Parse a decorator definition statement
 */
export function parseDecoratorDefStatement(ctx: ParserContext): Stmt {
  ctx.consume(TokenType.DECORATOR, "Expected 'decorator'");
  const name = ctx.consume(TokenType.IDENTIFIER, "Expected decorator name").lexeme;
  ctx.consume(TokenType.EQ, "Expected '=' after decorator name");
  const transformer = parseExpression(ctx);
  return decoratorDefStmt(name, transformer);
}

/**
 * Parse a codeblock statement
 */
export function parseCodeblockStatement(ctx: ParserContext): Stmt {
  const openToken = ctx.consume(TokenType.CODEBLOCK_OPEN, "Expected '{-- --}'");
  const label = openToken.literal as string | null;

  ctx.skipNewlines();

  // Parse statements until we hit a closing {/--} or EOF
  const statements: Stmt[] = [];
  while (!ctx.check(TokenType.CODEBLOCK_CLOSE) && !ctx.isAtEnd()) {
    statements.push(parseStatement(ctx));
    ctx.skipNewlines();
  }

  // Consume closing {/--}
  ctx.consume(TokenType.CODEBLOCK_CLOSE, "Expected '{/--}' to close codeblock");

  return codeblockStmt(label, statements);
}

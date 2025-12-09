import { TokenType } from "../token";
import {
  Stmt,
  LetStmt,
  AndStmt,
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
 */
export function parseLetStatement(ctx: ParserContext, mutable: boolean): LetStmt {
  // Consume either 'let' or 'maybe' keyword
  if (ctx.check(TokenType.LET)) {
    ctx.advance();
  } else if (ctx.check(TokenType.MAYBE)) {
    ctx.advance();
  }

  const name = ctx.consume(TokenType.IDENTIFIER, "Expected variable name").lexeme;

  ctx.consume(TokenType.EQ, "Expected '=' after variable name");
  // Skip newlines after = to allow pipeline literals on the next line:
  // let foo =
  //   /> map((x) -> x + 1)
  ctx.skipNewlines();
  const value = parseExpression(ctx);

  return letStmt(name, mutable, value);
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
  const openToken = ctx.consume(TokenType.CODEBLOCK_OPEN, "Expected '<>'");
  const label = openToken.literal as string | null;

  ctx.skipNewlines();

  // Parse statements until we hit a closing </> or EOF
  // Note: </> now produces BIDIRECTIONAL_PIPE token (used for both codeblock close and bidirectional pipelines)
  const statements: Stmt[] = [];
  while (!ctx.check(TokenType.BIDIRECTIONAL_PIPE) && !ctx.isAtEnd()) {
    statements.push(parseStatement(ctx));
    ctx.skipNewlines();
  }

  // Consume closing </> (BIDIRECTIONAL_PIPE token)
  ctx.consume(TokenType.BIDIRECTIONAL_PIPE, "Expected '</>' to close codeblock");

  return codeblockStmt(label, statements);
}

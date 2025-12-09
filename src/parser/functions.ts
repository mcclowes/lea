import { TokenType } from "../token";
import {
  Expr,
  Stmt,
  FunctionParam,
  Decorator,
  TypeSignature,
  BlockBody,
  functionExpr,
  tupleExpr,
  exprStmt,
  blockBody,
} from "../ast";
import { ParserContext, ParseError } from "./types";
import { parseExpression, parseTernary, parseTernaryNoParallelPipe, parseTernaryNoPipes } from "./expressions";
import { parseStatement } from "./statements";
import { parseDecorators } from "./primaries";

/**
 * Parse a grouping expression, function, or tuple
 * Could be: (expr), (), (params) -> body, (params) <- body (reverse), or (expr, expr, ...) tuple
 */
export function parseGroupingOrFunction(ctx: ParserContext): Expr {
  const startPos = ctx.current;

  // Check for empty params: () -> or () <-
  if (ctx.check(TokenType.RPAREN)) {
    ctx.advance(); // consume )
    // Check for forward function: () ->
    if (ctx.match(TokenType.ARROW)) {
      const { attachments, body, typeSignature } = parseFunctionBody(ctx);
      const decorators = parseDecorators(ctx);
      return functionExpr([], body, undefined, decorators, attachments, typeSignature, false);
    }
    // Check for reverse function: () <-
    if (ctx.match(TokenType.RETURN)) {
      const { attachments, body, typeSignature } = parseFunctionBody(ctx);
      const decorators = parseDecorators(ctx);
      return functionExpr([], body, undefined, decorators, attachments, typeSignature, true);
    }
    // Empty parens () could be empty tuple
    return tupleExpr([]);
  }

  // Try to parse as function parameters
  if (looksLikeFunctionParams(ctx)) {
    const params = parseFunctionParams(ctx);
    ctx.consume(TokenType.RPAREN, "Expected ')' after parameters");

    let returnType: string | undefined;
    if (ctx.match(TokenType.COLON)) {
      returnType = ctx.consume(TokenType.IDENTIFIER, "Expected return type").lexeme;
    }

    // Check for forward function: (params) ->
    if (ctx.match(TokenType.ARROW)) {
      const { attachments, body, typeSignature } = parseFunctionBody(ctx);
      const decorators = parseDecorators(ctx);
      return functionExpr(params, body, returnType, decorators, attachments, typeSignature, false);
    }

    // Check for reverse function: (params) <-
    if (ctx.match(TokenType.RETURN)) {
      const { attachments, body, typeSignature } = parseFunctionBody(ctx);
      const decorators = parseDecorators(ctx);
      return functionExpr(params, body, returnType, decorators, attachments, typeSignature, true);
    }

    throw new ParseError("Expected '->' or '<-' after function parameters", ctx.peek());
  }

  // Parse first expression
  const firstExpr = parseExpression(ctx);

  // Check for tuple: (expr, expr, ...)
  if (ctx.match(TokenType.COMMA)) {
    const elements: Expr[] = [firstExpr];
    do {
      elements.push(parseExpression(ctx));
    } while (ctx.match(TokenType.COMMA));
    ctx.consume(TokenType.RPAREN, "Expected ')' after tuple elements");
    return tupleExpr(elements);
  }

  // Otherwise it's a grouping expression
  ctx.consume(TokenType.RPAREN, "Expected ')' after expression");
  return firstExpr;
}

/**
 * Look ahead to determine if this is a function definition
 */
export function looksLikeFunctionParams(ctx: ParserContext): boolean {
  // Function params: identifier followed by , or : or )
  // Then ) followed by -> or <- or : identifier -> or : identifier <-
  const saved = ctx.current;
  let parenDepth = 1;

  while (parenDepth > 0 && !ctx.isAtEnd()) {
    if (ctx.check(TokenType.LPAREN)) parenDepth++;
    if (ctx.check(TokenType.RPAREN)) parenDepth--;
    if (parenDepth > 0) ctx.advance();
  }

  if (ctx.check(TokenType.RPAREN)) {
    ctx.advance(); // consume the )
    // Check for optional return type
    if (ctx.check(TokenType.COLON)) {
      ctx.advance(); // consume :
      if (ctx.check(TokenType.IDENTIFIER)) {
        ctx.advance(); // consume type
      }
    }
    // Check for either forward (->) or reverse (<-) function arrow
    const isFunction = ctx.check(TokenType.ARROW) || ctx.check(TokenType.RETURN);
    ctx.setCurrent(saved);
    return isFunction;
  }

  ctx.setCurrent(saved);
  return false;
}

/**
 * Parse function parameters
 */
export function parseFunctionParams(ctx: ParserContext): FunctionParam[] {
  const params: FunctionParam[] = [];

  do {
    // Allow underscore as parameter name (for ignored/unused params)
    let name: string;
    if (ctx.match(TokenType.UNDERSCORE)) {
      name = "_";
    } else {
      name = ctx.consume(TokenType.IDENTIFIER, "Expected parameter name").lexeme;
    }
    let typeAnnotation: string | undefined;
    let defaultValue: Expr | undefined;

    // Check for type annotation (old style: x: Int)
    if (ctx.match(TokenType.COLON)) {
      typeAnnotation = ctx.consume(TokenType.IDENTIFIER, "Expected type").lexeme;
    }

    // Check for default value: x = 10
    if (ctx.match(TokenType.EQ)) {
      defaultValue = parseTernary(ctx); // Use ternary to avoid consuming pipes
    }

    params.push({ name, typeAnnotation, defaultValue });
  } while (ctx.match(TokenType.COMMA));

  return params;
}

/**
 * Parse a function body
 */
export function parseFunctionBody(ctx: ParserContext): { attachments: string[]; body: Expr | BlockBody; typeSignature?: TypeSignature } {
  const arrowLine = ctx.previous().line;

  // Check for type signature immediately after arrow: -> :: Int :> Int
  let typeSignature: TypeSignature | undefined;
  if (ctx.check(TokenType.DOUBLE_COLON)) {
    typeSignature = parseTypeSignature(ctx);
  }

  // Check for brace-delimited block: -> { ... } or -> :: Type :> Type { ... }
  if (ctx.check(TokenType.LBRACE)) {
    ctx.advance(); // consume {
    const result = parseBlockBody(ctx);
    return { ...result, typeSignature };
  }

  // Check for newline after arrow (indentation-based block)
  if (ctx.check(TokenType.NEWLINE)) {
    ctx.advance(); // consume newline
    const result = parseIndentedBody(ctx);
    return { ...result, typeSignature };
  }

  // Single expression on same line.
  // If we're inside a parallel pipe branch, don't consume ANY pipes (regular or parallel)
  // since those pipes belong to the outer parallel expression.
  // Otherwise, allow regular pipes but not parallel pipes.
  const body = ctx.inParallelPipeBranch ? parseTernaryNoPipes(ctx) : parseTernaryNoParallelPipe(ctx);

  // For single-line, type signature comes after body
  if (!typeSignature && ctx.check(TokenType.DOUBLE_COLON)) {
    typeSignature = parseTypeSignature(ctx);
  }

  return { attachments: [], body, typeSignature };
}

/**
 * Parse a brace-delimited block body
 */
export function parseBlockBody(ctx: ParserContext): { attachments: string[]; body: BlockBody } {
  const attachments: string[] = [];
  const statements: Stmt[] = [];

  ctx.skipNewlines();

  // Parse @attachments at the start
  while (ctx.check(TokenType.AT)) {
    ctx.advance(); // consume @
    const name = ctx.consume(TokenType.IDENTIFIER, "Expected context name after '@'").lexeme;
    attachments.push(name);
    ctx.skipNewlines();
  }

  // Parse statements until we hit } or a final expression
  while (!ctx.check(TokenType.RBRACE) && !ctx.isAtEnd()) {
    ctx.skipNewlines();
    if (ctx.check(TokenType.RBRACE)) break;

    // Check if this is a statement (let, maybe, context, provide) or expression
    if (ctx.check(TokenType.LET) || ctx.check(TokenType.MAYBE) || ctx.check(TokenType.CONTEXT) || ctx.check(TokenType.PROVIDE)) {
      statements.push(parseStatement(ctx));
    } else {
      // Could be final expression or expression statement
      const expr = parseExpression(ctx);
      ctx.skipNewlines();

      // If next is }, this was the final expression
      if (ctx.check(TokenType.RBRACE)) {
        ctx.consume(TokenType.RBRACE, "Expected '}'");
        return { attachments, body: blockBody(statements, expr) };
      }

      // Otherwise it was an expression statement, continue
      statements.push(exprStmt(expr));
    }
    ctx.skipNewlines();
  }

  // If we got here with no final expression, error
  ctx.consume(TokenType.RBRACE, "Expected '}' after block");
  throw new ParseError("Block must end with an expression", ctx.previous());
}

/**
 * Parse an indentation-based block body
 */
export function parseIndentedBody(ctx: ParserContext): { attachments: string[]; body: Expr | BlockBody } {
  const attachments: string[] = [];
  const statements: Stmt[] = [];

  // Skip to first non-empty line and get its indentation
  while (ctx.check(TokenType.NEWLINE)) {
    ctx.advance();
  }

  // Record the indentation level of the body
  const bodyIndent = ctx.peek().column;

  // Parse @attachments at the start
  while (ctx.check(TokenType.AT)) {
    ctx.advance(); // consume @
    const name = ctx.consume(TokenType.IDENTIFIER, "Expected context name after '@'").lexeme;
    attachments.push(name);
    ctx.skipNewlines();
  }

  // Parse statements/expressions until we dedent
  while (!ctx.isAtEnd()) {
    // Skip empty lines
    while (ctx.check(TokenType.NEWLINE)) {
      ctx.advance();
    }
    if (ctx.isAtEnd()) break;

    // Check if we've dedented back to column 1 or less than body indent
    const currentToken = ctx.peek();
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

    if (ctx.check(TokenType.LET) || ctx.check(TokenType.MAYBE) || ctx.check(TokenType.CONTEXT) || ctx.check(TokenType.PROVIDE)) {
      statements.push(parseStatement(ctx));
    } else {
      const expr = parseExpression(ctx);

      // Check if this is the last expression (next line dedented or EOF)
      const savedPos = ctx.current;
      ctx.skipNewlines();

      if (ctx.isAtEnd()) {
        return { attachments, body: blockBody(statements, expr) };
      }

      // Check if next meaningful token is dedented
      const nextToken = ctx.peek();
      if (nextToken.column < bodyIndent) {
        ctx.setCurrent(savedPos);
        return { attachments, body: blockBody(statements, expr) };
      }

      // Not done yet, this was an expression statement
      ctx.setCurrent(savedPos);
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

  throw new ParseError("Block must end with an expression", ctx.previous());
}

/**
 * Parse a single type annotation
 */
export function parseTypeAnnotation(ctx: ParserContext): string | { tuple: string[]; optional?: boolean } | { list: string; optional?: boolean } {
  const optional = ctx.match(TokenType.QUESTION);

  if (ctx.match(TokenType.LPAREN)) {
    // Tuple type: (Int, String, ...)
    const types: string[] = [];
    if (!ctx.check(TokenType.RPAREN)) {
      do {
        types.push(ctx.consume(TokenType.IDENTIFIER, "Expected type name").lexeme);
      } while (ctx.match(TokenType.COMMA));
    }
    ctx.consume(TokenType.RPAREN, "Expected ')' after tuple types");
    return { tuple: types, optional };
  }

  if (ctx.match(TokenType.LBRACKET)) {
    // List type: [Int], [String], [[Int]] (nested), etc.
    // Recursively parse the inner type (could be simple type or another list)
    const innerType = parseTypeAnnotation(ctx);
    ctx.consume(TokenType.RBRACKET, "Expected ']' after list element type");
    // For simple types, just use the string; for complex types, stringify
    const elementType = typeof innerType === "string" ? innerType : JSON.stringify(innerType);
    return { list: elementType, optional };
  }

  // Simple type
  const typeName = ctx.consume(TokenType.IDENTIFIER, "Expected type name").lexeme;
  return optional ? `?${typeName}` : typeName;
}

/**
 * Parse trailing type signature: :: (Type, Type) :> ReturnType
 */
export function parseTypeSignature(ctx: ParserContext): TypeSignature | undefined {
  if (!ctx.match(TokenType.DOUBLE_COLON)) {
    return undefined;
  }

  const paramTypes: (string | { tuple: string[]; optional?: boolean } | { list: string; optional?: boolean })[] = [];

  // Parse parameter types - can be single type or (Type, Type, ...)
  if (ctx.match(TokenType.LPAREN)) {
    // Multiple parameter types
    if (!ctx.check(TokenType.RPAREN)) {
      do {
        paramTypes.push(parseTypeAnnotation(ctx));
      } while (ctx.match(TokenType.COMMA));
    }
    ctx.consume(TokenType.RPAREN, "Expected ')' after parameter types");
  } else {
    // Single parameter type (could be ?Type, (Tuple), or [List])
    paramTypes.push(parseTypeAnnotation(ctx));
  }

  // Parse optional return type with :>
  let returnType: string | { tuple: string[] } | { list: string } | undefined;
  if (ctx.match(TokenType.COLON_GT)) {
    returnType = parseTypeAnnotation(ctx);
  }

  return { paramTypes, returnType };
}

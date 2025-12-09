import { TokenType } from "../token";
import {
  Expr,
  AnyPipelineStage,
  binaryExpr,
  pipeExpr,
  spreadPipeExpr,
  parallelPipeExpr,
  reversePipeExpr,
  ternaryExpr,
  unaryExpr,
  awaitExpr,
  returnExpr,
  callExpr,
  indexExpr,
  memberExpr,
  reactivePipeExpr,
} from "../ast";
import { ParserContext } from "./types";
import { parsePrimary, parseStageExpr } from "./primaries";

// ============================================
// Main Expression Parsing (Full Precedence Chain)
// ============================================

/**
 * Parse an expression (entry point)
 * Precedence (low to high): ternary, equality, comparison, term, factor, pipe, unary, call, primary
 */
export function parseExpression(ctx: ParserContext): Expr {
  return parseTernary(ctx);
}

/**
 * Parse a ternary expression: condition ? then : else
 */
export function parseTernary(ctx: ParserContext): Expr {
  let expr = parseEquality(ctx);

  // Check for ? potentially on next line
  const savedPos = ctx.current;
  ctx.skipNewlines();

  if (ctx.match(TokenType.QUESTION)) {
    ctx.skipNewlines();
    const thenBranch = parseTernary(ctx);
    ctx.skipNewlines();
    ctx.consume(TokenType.COLON, "Expected ':' in ternary expression");
    ctx.skipNewlines();
    const elseBranch = parseTernary(ctx);
    expr = ternaryExpr(expr, thenBranch, elseBranch);
  } else {
    // No ternary, restore position
    ctx.setCurrent(savedPos);
  }

  return expr;
}

/**
 * Parse equality: == !=
 */
export function parseEquality(ctx: ParserContext): Expr {
  let expr = parseComparison(ctx);

  while (ctx.match(TokenType.EQEQ, TokenType.NEQ)) {
    const operator = ctx.previous();
    const right = parseComparison(ctx);
    expr = binaryExpr(operator, expr, right);
  }

  return expr;
}

/**
 * Parse comparison: < > <= >=
 */
export function parseComparison(ctx: ParserContext): Expr {
  let expr = parseTerm(ctx);

  while (ctx.match(TokenType.LT, TokenType.GT, TokenType.LTE, TokenType.GTE)) {
    const operator = ctx.previous();
    const right = parseTerm(ctx);
    expr = binaryExpr(operator, expr, right);
  }

  return expr;
}

/**
 * Parse term: + - ++
 */
export function parseTerm(ctx: ParserContext): Expr {
  let expr = parseFactor(ctx);

  while (ctx.match(TokenType.PLUS, TokenType.MINUS, TokenType.CONCAT)) {
    const operator = ctx.previous();
    const right = parseFactor(ctx);
    expr = binaryExpr(operator, expr, right);
  }

  return expr;
}

/**
 * Parse factor: * / %
 */
export function parseFactor(ctx: ParserContext): Expr {
  let expr = parsePipeTerm(ctx);

  while (ctx.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT)) {
    const operator = ctx.previous();
    const right = parsePipeTerm(ctx);
    expr = binaryExpr(operator, expr, right);
  }

  return expr;
}

/**
 * Parse pipe term: /> />>> \> </ @>
 * Pipe operators bind tighter than arithmetic, so `a /> b + c` means `(a /> b) + c`
 */
export function parsePipeTerm(ctx: ParserContext): Expr {
  let expr = parseUnary(ctx);

  // Check for reactive pipe @> (only valid at the start of a pipe chain)
  // Syntax: source @> fn1 /> fn2 /> fn3
  const reactiveSavedPos = ctx.current;
  ctx.skipNewlines();
  if (ctx.match(TokenType.REACTIVE_PIPE)) {
    // The left side must be an identifier for tracking
    if (expr.kind !== "Identifier") {
      // Restore and continue with normal parsing
      ctx.setCurrent(reactiveSavedPos);
    } else {
      const sourceName = expr.name;
      const stages: AnyPipelineStage[] = [];

      // Parse the first stage after @>
      ctx.skipNewlines();
      const firstStage = parseStageExpr(ctx);
      stages.push({ expr: firstStage });

      // Continue collecting /> stages
      while (true) {
        const savedPos = ctx.current;
        ctx.skipNewlines();

        if (ctx.match(TokenType.PIPE)) {
          ctx.skipNewlines();
          const stageExpr = parseStageExpr(ctx);
          stages.push({ expr: stageExpr });
          continue;
        }

        // Check for spread pipe />> within reactive chain
        if (ctx.match(TokenType.SPREAD_PIPE)) {
          ctx.skipNewlines();
          const stageExpr = parseStageExpr(ctx);
          // For spread pipe, we wrap it specially - but for now treat as regular stage
          // The interpreter will handle spread semantics
          stages.push({ expr: stageExpr });
          continue;
        }

        ctx.setCurrent(savedPos);
        break;
      }

      return reactivePipeExpr(expr, sourceName, stages);
    }
  } else {
    ctx.setCurrent(reactiveSavedPos);
  }

  while (true) {
    const savedPos = ctx.current;
    ctx.skipNewlines();

    // Check for parallel pipe \>
    if (ctx.check(TokenType.PARALLEL_PIPE)) {
      const pipeColumn = ctx.peek().column;
      ctx.advance(); // consume \>
      ctx.skipNewlines();
      // Parse branch with potential nested pipes (indented more than \>)
      const branches: Expr[] = [parsePipeBranchTight(ctx, pipeColumn)];

      // Collect all consecutive \> branches at same or greater column
      while (true) {
        ctx.skipNewlines();
        if (!ctx.check(TokenType.PARALLEL_PIPE)) break;
        if (ctx.peek().column < pipeColumn) break; // Less indented = belongs to outer
        ctx.advance();
        ctx.skipNewlines();
        branches.push(parsePipeBranchTight(ctx, pipeColumn));
      }

      expr = parallelPipeExpr(expr, branches);
      continue;
    }

    // Check for reverse pipe </
    // Syntax: pipeline </ value (applies value through pipeline in reverse)
    if (ctx.match(TokenType.REVERSE_PIPE)) {
      ctx.skipNewlines();
      const right = parseUnary(ctx);
      expr = reversePipeExpr(expr, right);
      continue;
    }

    // Check for spread pipe />>>
    // Syntax: list />>> fn (maps fn over each element of list)
    if (ctx.match(TokenType.SPREAD_PIPE)) {
      ctx.skipNewlines();
      const right = parseUnary(ctx);
      expr = spreadPipeExpr(expr, right);
      continue;
    }

    // Check for regular pipe />
    if (!ctx.match(TokenType.PIPE)) {
      ctx.setCurrent(savedPos);
      break;
    }
    ctx.skipNewlines();
    const right = parseUnary(ctx);
    expr = pipeExpr(expr, right);
  }

  return expr;
}

/**
 * Parse a branch within a parallel pipe at the tight precedence level
 */
export function parsePipeBranchTight(ctx: ParserContext, branchColumn: number): Expr {
  const branchLine = ctx.previous().line;

  // Set flag so function bodies inside branches don't consume pipes
  const wasInParallelPipeBranch = ctx.inParallelPipeBranch;
  ctx.setInParallelPipeBranch(true);
  let expr = parseUnary(ctx);
  ctx.setInParallelPipeBranch(wasInParallelPipeBranch);

  // Continue parsing /> pipes that are on a new line AND more indented than the \> branch
  while (true) {
    const savedPos = ctx.current;
    ctx.skipNewlines();

    // Check if next token is a pipe that's more indented than the branch
    if (ctx.check(TokenType.PIPE)) {
      const pipeCol = ctx.peek().column;
      const pipeLine = ctx.peek().line;
      // Only consume if:
      // 1. On a new line (not same line as the \>)
      // 2. More indented than the \> that started this branch
      if (pipeLine > branchLine && pipeCol > branchColumn) {
        ctx.advance(); // consume />
        ctx.skipNewlines();
        ctx.setInParallelPipeBranch(true);
        const right = parseUnary(ctx);
        ctx.setInParallelPipeBranch(wasInParallelPipeBranch);
        expr = pipeExpr(expr, right);
        continue;
      }
    }

    // Not a continuation of this branch, restore and stop
    ctx.setCurrent(savedPos);
    break;
  }

  return expr;
}

/**
 * Parse unary: - await <-
 */
export function parseUnary(ctx: ParserContext): Expr {
  if (ctx.match(TokenType.MINUS)) {
    const operator = ctx.previous();
    const operand = parseUnary(ctx);
    return unaryExpr(operator, operand);
  }

  if (ctx.match(TokenType.AWAIT)) {
    const operand = parseUnary(ctx);
    return awaitExpr(operand);
  }

  if (ctx.match(TokenType.RETURN)) {
    const value = parseExpression(ctx);
    return returnExpr(value);
  }

  return parseCall(ctx);
}

/**
 * Parse call expressions, indexing, and member access
 */
export function parseCall(ctx: ParserContext): Expr {
  let expr = parsePrimary(ctx);
  let lastLine = ctx.previous().line;

  while (true) {
    if (ctx.match(TokenType.LPAREN)) {
      expr = finishCall(ctx, expr);
      lastLine = ctx.previous().line;
    } else if (ctx.check(TokenType.LBRACKET)) {
      // Only treat [ as indexing if it's on the same line as the expression
      // This prevents `expr\n[1,2,3]` from being parsed as `expr[1,2,3]`
      if (ctx.peek().line !== lastLine) {
        break;
      }
      ctx.advance(); // consume [
      const index = parseExpression(ctx);
      ctx.consume(TokenType.RBRACKET, "Expected ']' after index");
      expr = indexExpr(expr, index);
      lastLine = ctx.previous().line;
    } else if (ctx.match(TokenType.DOT)) {
      const member = ctx.consume(TokenType.IDENTIFIER, "Expected property name after '.'").lexeme;
      expr = memberExpr(expr, member);
      lastLine = ctx.previous().line;
    } else {
      break;
    }
  }

  return expr;
}

/**
 * Finish parsing a call expression (after the opening paren)
 */
export function finishCall(ctx: ParserContext, callee: Expr): Expr {
  const args: Expr[] = [];

  if (!ctx.check(TokenType.RPAREN)) {
    do {
      args.push(parseExpression(ctx));
    } while (ctx.match(TokenType.COMMA));
  }

  ctx.consume(TokenType.RPAREN, "Expected ')' after arguments");
  return callExpr(callee, args);
}

// ============================================
// NoParallelPipe Variants
// Used for single-line function bodies so that parallel pipes belong to outer expression
// ============================================

/**
 * Parse ternary without consuming parallel pipes
 */
export function parseTernaryNoParallelPipe(ctx: ParserContext): Expr {
  let expr = parseEqualityNoParallelPipe(ctx);

  const savedPos = ctx.current;
  ctx.skipNewlines();

  if (ctx.match(TokenType.QUESTION)) {
    ctx.skipNewlines();
    const thenBranch = parseTernaryNoParallelPipe(ctx);
    ctx.skipNewlines();
    ctx.consume(TokenType.COLON, "Expected ':' in ternary expression");
    ctx.skipNewlines();
    const elseBranch = parseTernaryNoParallelPipe(ctx);
    expr = ternaryExpr(expr, thenBranch, elseBranch);
  } else {
    ctx.setCurrent(savedPos);
  }

  return expr;
}

export function parseEqualityNoParallelPipe(ctx: ParserContext): Expr {
  let expr = parseComparisonNoParallelPipe(ctx);

  while (ctx.match(TokenType.EQEQ, TokenType.NEQ)) {
    const operator = ctx.previous();
    const right = parseComparisonNoParallelPipe(ctx);
    expr = binaryExpr(operator, expr, right);
  }

  return expr;
}

export function parseComparisonNoParallelPipe(ctx: ParserContext): Expr {
  let expr = parseTermNoParallelPipe(ctx);

  while (ctx.match(TokenType.LT, TokenType.GT, TokenType.LTE, TokenType.GTE)) {
    const operator = ctx.previous();
    const right = parseTermNoParallelPipe(ctx);
    expr = binaryExpr(operator, expr, right);
  }

  return expr;
}

export function parseTermNoParallelPipe(ctx: ParserContext): Expr {
  let expr = parseFactorNoParallelPipe(ctx);

  while (ctx.match(TokenType.PLUS, TokenType.MINUS, TokenType.CONCAT)) {
    const operator = ctx.previous();
    const right = parseFactorNoParallelPipe(ctx);
    expr = binaryExpr(operator, expr, right);
  }

  return expr;
}

/**
 * For single-line function bodies, don't consume parallel pipes (\>)
 * but DO allow regular pipes (/>)
 */
export function parseFactorNoParallelPipe(ctx: ParserContext): Expr {
  let expr = parsePipeTermNoParallel(ctx);

  while (ctx.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT)) {
    const operator = ctx.previous();
    const right = parsePipeTermNoParallel(ctx);
    expr = binaryExpr(operator, expr, right);
  }

  return expr;
}

/**
 * Only handles regular pipes (/>), not parallel pipes (\>)
 */
export function parsePipeTermNoParallel(ctx: ParserContext): Expr {
  let expr = parseUnary(ctx);

  while (true) {
    const savedPos = ctx.current;
    ctx.skipNewlines();

    // Only check for regular pipe />, NOT parallel pipe \>
    if (!ctx.match(TokenType.PIPE)) {
      ctx.setCurrent(savedPos);
      break;
    }
    ctx.skipNewlines();
    const right = parseUnary(ctx);
    expr = pipeExpr(expr, right);
  }

  return expr;
}

// ============================================
// NoPipes Variants
// Used for function bodies inside parallel pipe branches
// ============================================

/**
 * Parse ternary without consuming any pipes
 */
export function parseTernaryNoPipes(ctx: ParserContext): Expr {
  let expr = parseEqualityNoPipes(ctx);

  const savedPos = ctx.current;
  ctx.skipNewlines();

  if (ctx.match(TokenType.QUESTION)) {
    ctx.skipNewlines();
    const thenBranch = parseTernaryNoPipes(ctx);
    ctx.skipNewlines();
    ctx.consume(TokenType.COLON, "Expected ':' in ternary expression");
    ctx.skipNewlines();
    const elseBranch = parseTernaryNoPipes(ctx);
    expr = ternaryExpr(expr, thenBranch, elseBranch);
  } else {
    ctx.setCurrent(savedPos);
  }

  return expr;
}

export function parseEqualityNoPipes(ctx: ParserContext): Expr {
  let expr = parseComparisonNoPipes(ctx);

  while (ctx.match(TokenType.EQEQ, TokenType.NEQ)) {
    const operator = ctx.previous();
    const right = parseComparisonNoPipes(ctx);
    expr = binaryExpr(operator, expr, right);
  }

  return expr;
}

export function parseComparisonNoPipes(ctx: ParserContext): Expr {
  let expr = parseTermNoPipes(ctx);

  while (ctx.match(TokenType.LT, TokenType.GT, TokenType.LTE, TokenType.GTE)) {
    const operator = ctx.previous();
    const right = parseTermNoPipes(ctx);
    expr = binaryExpr(operator, expr, right);
  }

  return expr;
}

export function parseTermNoPipes(ctx: ParserContext): Expr {
  let expr = parseFactorNoPipes(ctx);

  while (ctx.match(TokenType.PLUS, TokenType.MINUS, TokenType.CONCAT)) {
    const operator = ctx.previous();
    const right = parseFactorNoPipes(ctx);
    expr = binaryExpr(operator, expr, right);
  }

  return expr;
}

export function parseFactorNoPipes(ctx: ParserContext): Expr {
  let expr = parseUnary(ctx);

  while (ctx.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT)) {
    const operator = ctx.previous();
    const right = parseUnary(ctx);
    expr = binaryExpr(operator, expr, right);
  }

  return expr;
}

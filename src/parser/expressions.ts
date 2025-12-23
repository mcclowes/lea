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
 *
 * This function respects the context flags:
 * - ctx.allowParallelPipes: if false, won't consume \> operators
 * - ctx.allowRegularPipes: if false, won't consume /> or />>> operators
 */
export function parsePipeTerm(ctx: ParserContext): Expr {
  let expr = parseUnary(ctx);

  // Check for reactive pipe @> (only valid at the start of a pipe chain)
  // Syntax: source @> fn1 /> fn2 /> fn3
  // Reactive pipes are only parsed when regular pipes are allowed
  if (ctx.allowRegularPipes) {
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
  }

  while (true) {
    const savedPos = ctx.current;
    ctx.skipNewlines();

    // Check for parallel pipe \> - only if allowed
    if (ctx.allowParallelPipes && ctx.check(TokenType.PARALLEL_PIPE)) {
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
    // Reverse pipes are allowed when regular pipes are allowed
    if (ctx.allowRegularPipes && ctx.match(TokenType.REVERSE_PIPE)) {
      ctx.skipNewlines();
      const right = parseUnary(ctx);
      expr = reversePipeExpr(expr, right);
      continue;
    }

    // Check for spread pipe />>> - only if regular pipes are allowed
    // Syntax: list />>> fn (maps fn over each element of list)
    if (ctx.allowRegularPipes && ctx.match(TokenType.SPREAD_PIPE)) {
      ctx.skipNewlines();
      const wasInPipeOperand = ctx.inPipeOperand;
      ctx.setInPipeOperand(true);
      const right = parseUnary(ctx);
      ctx.setInPipeOperand(wasInPipeOperand);
      expr = spreadPipeExpr(expr, right);
      continue;
    }

    // Check for regular pipe /> - only if allowed
    if (!ctx.allowRegularPipes) {
      ctx.setCurrent(savedPos);
      break;
    }
    if (!ctx.match(TokenType.PIPE)) {
      ctx.setCurrent(savedPos);
      break;
    }
    ctx.skipNewlines();
    const wasInPipeOperand = ctx.inPipeOperand;
    ctx.setInPipeOperand(true);
    const right = parseUnary(ctx);
    ctx.setInPipeOperand(wasInPipeOperand);
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

  // Reset pipe operand flag when parsing call arguments
  // Arguments inside parentheses are a new expression context
  const wasInPipeOperand = ctx.inPipeOperand;
  ctx.setInPipeOperand(false);

  if (!ctx.check(TokenType.RPAREN)) {
    do {
      args.push(parseExpression(ctx));
    } while (ctx.match(TokenType.COMMA));
  }

  ctx.consume(TokenType.RPAREN, "Expected ')' after arguments");
  ctx.setInPipeOperand(wasInPipeOperand);
  return callExpr(callee, args);
}

// NOTE: The NoParallelPipe and NoPipes variant functions have been removed.
// Pipe parsing is now controlled by the context flags:
// - ctx.allowParallelPipes: if false, won't consume \> operators
// - ctx.allowRegularPipes: if false, won't consume /> or />>> operators
// See parsePipeTerm() and parseFunctionBody() for usage.

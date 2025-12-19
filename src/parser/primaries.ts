import { TokenType } from "../token";
import {
  Expr,
  RecordField,
  RecordFieldOrSpread,
  ListElementOrSpread,
  PipelineStage,
  AnyPipelineStage,
  ParallelPipelineStage,
  SpreadPipelineStage,
  PipelineTypeSignature,
  MatchCase,
  numberLiteral,
  stringLiteral,
  templateStringExpr,
  booleanLiteral,
  identifier,
  placeholderExpr,
  listExpr,
  recordExpr,
  tupleExpr,
  pipelineLiteral,
  bidirectionalPipelineLiteral,
  indexExpr,
  memberExpr,
  matchExpr,
  useExpr,
} from "../ast";
import { ParserContext, ParseError } from "./types";
import { parseExpression, parseUnary, finishCall, parseEquality } from "./expressions";
import { parseGroupingOrFunction, parsePipelineTypeSignature } from "./functions";
import { Lexer } from "../lexer";
import { Token } from "../token";

/** Interface for Parser constructor used in template string parsing */
interface ParserConstructor {
  new (tokens: Token[]): { expression(): Expr };
}

// Cached Parser import to avoid repeated dynamic require() calls
// Uses dynamic require to avoid circular dependency with parser/index.ts
let _Parser: ParserConstructor | null = null;
function getParser(): ParserConstructor {
  if (_Parser === null) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _Parser = require("./index").Parser;
  }
  return _Parser!;
}

/**
 * Parse a primary expression (highest precedence)
 */
export function parsePrimary(ctx: ParserContext): Expr {
  if (ctx.match(TokenType.NUMBER)) {
    return numberLiteral(ctx.previous().literal as number);
  }

  if (ctx.match(TokenType.STRING)) {
    return stringLiteral(ctx.previous().literal as string);
  }

  if (ctx.match(TokenType.TEMPLATE_STRING)) {
    return parseTemplateString(ctx);
  }

  if (ctx.match(TokenType.TRUE)) {
    return booleanLiteral(true);
  }

  if (ctx.match(TokenType.FALSE)) {
    return booleanLiteral(false);
  }

  // 'input' keyword is the placeholder for piped values and matched values
  if (ctx.match(TokenType.INPUT)) {
    return placeholderExpr();
  }

  if (ctx.match(TokenType.IDENTIFIER)) {
    return identifier(ctx.previous().lexeme);
  }

  if (ctx.match(TokenType.LBRACKET)) {
    return parseList(ctx);
  }

  if (ctx.match(TokenType.LBRACE)) {
    return parseRecord(ctx);
  }

  if (ctx.match(TokenType.LPAREN)) {
    return parseGroupingOrFunction(ctx);
  }

  // Pipeline literal: /> fn1 /> fn2 /> fn3
  // A pipeline starts with /> and creates a reusable chain of transformations
  if (ctx.match(TokenType.PIPE)) {
    return parsePipelineLiteral(ctx, false);
  }

  // Pipeline literal starting with spread: />>> fn /> fn2
  // A pipeline can also start with />>> for spread operations
  if (ctx.match(TokenType.SPREAD_PIPE)) {
    return parsePipelineLiteral(ctx, true);
  }

  // Bidirectional pipeline literal: </> fn1 </> fn2 </> fn3
  // A bidirectional pipeline can be applied forward or in reverse
  if (ctx.match(TokenType.BIDIRECTIONAL_PIPE)) {
    return parseBidirectionalPipelineLiteral(ctx);
  }

  // Match expression: match value
  //   | pattern -> result
  //   | if guard -> result
  //   | default
  if (ctx.match(TokenType.MATCH)) {
    return parseMatch(ctx);
  }

  // Use expression: use "./path" or use "./path.lea"
  // Returns a record containing all exported values from the module
  if (ctx.match(TokenType.USE)) {
    return parseUse(ctx);
  }

  throw new ParseError(`Unexpected token '${ctx.peek().lexeme}'`, ctx.peek());
}

/**
 * Parse a template string: `hello {name}, you are {age} years old`
 * The lexer stores parts as strings where even indices are literals and odd indices are expressions
 */
export function parseTemplateString(ctx: ParserContext): Expr {
  const rawParts = ctx.previous().literal as string[];
  const parts: (string | Expr)[] = [];

  for (let i = 0; i < rawParts.length; i++) {
    if (i % 2 === 0) {
      // Even indices are string literals
      parts.push(rawParts[i]);
    } else {
      // Odd indices are expression source code - parse them
      const exprSource = rawParts[i];
      if (exprSource.length > 0) {
        // Create a new lexer and parser for the embedded expression
        const lexer = new Lexer(exprSource);
        const tokens = lexer.scanTokens();
        // Use the cached Parser class to parse the embedded expression
        const Parser = getParser();
        const parser = new Parser(tokens);
        const expr = parser.expression();
        parts.push(expr);
      } else {
        // Empty interpolation like `{}` - treat as empty string
        parts.push("");
      }
    }
  }

  return templateStringExpr(parts);
}

/**
 * Parse a list literal: [1, 2, 3] or [...list1, 4, ...list2]
 */
export function parseList(ctx: ParserContext): Expr {
  const elements: ListElementOrSpread[] = [];

  ctx.skipNewlines();
  if (!ctx.check(TokenType.RBRACKET)) {
    do {
      ctx.skipNewlines();
      // Check for trailing comma (empty element before ])
      if (ctx.check(TokenType.RBRACKET)) break;
      // Check for spread operator
      if (ctx.match(TokenType.SPREAD)) {
        const value = parseExpression(ctx);
        elements.push({ spread: true, value });
      } else {
        const value = parseExpression(ctx);
        elements.push({ value });
      }
      ctx.skipNewlines();
    } while (ctx.match(TokenType.COMMA));
  }
  ctx.skipNewlines();
  ctx.consume(TokenType.RBRACKET, "Expected ']' after list elements");
  return listExpr(elements);
}

/**
 * Parse a record literal: { name: "Max", age: 99 } or { ...record, field: value }
 */
export function parseRecord(ctx: ParserContext): Expr {
  const fields: RecordFieldOrSpread[] = [];

  ctx.skipNewlines();
  if (!ctx.check(TokenType.RBRACE)) {
    do {
      ctx.skipNewlines();
      // Check for trailing comma (empty field before })
      if (ctx.check(TokenType.RBRACE)) break;
      // Check for spread operator
      if (ctx.match(TokenType.SPREAD)) {
        const value = parseExpression(ctx);
        fields.push({ spread: true, value });
      } else {
        const key = ctx.consume(TokenType.IDENTIFIER, "Expected field name").lexeme;
        ctx.consume(TokenType.COLON, "Expected ':' after field name");
        const value = parseExpression(ctx);
        fields.push({ key, value });
      }
      ctx.skipNewlines();
    } while (ctx.match(TokenType.COMMA));
  }
  ctx.skipNewlines();
  ctx.consume(TokenType.RBRACE, "Expected '}' after record fields");
  return recordExpr(fields);
}

/**
 * Parse a pipeline literal: /> fn1 /> fn2 /> fn3
 * Can include parallel stages: /> fn1 \> branch1 \> branch2 /> combiner
 * Can start with spread pipe: />>> fn1 /> fn2
 *
 * Parallel branches can contain nested pipes (indentation-based):
 *   \> head
 *   \> tail
 *     /> transform
 *   /> combine
 */
export function parsePipelineLiteral(ctx: ParserContext, firstIsSpread: boolean = false): Expr {
  const stages: AnyPipelineStage[] = [];

  // Set inPipeOperand flag so function bodies don't consume pipes
  const wasInPipeOperand = ctx.inPipeOperand;
  ctx.setInPipeOperand(true);

  // Parse the first stage (already consumed the initial /> or />>>)
  ctx.skipNewlines();
  let stageExpr = parseStageExpr(ctx);
  if (firstIsSpread) {
    stages.push({ isSpread: true, expr: stageExpr } as SpreadPipelineStage);
  } else {
    stages.push({ expr: stageExpr });
  }

  // Continue parsing more stages
  while (true) {
    const savedPos = ctx.current;
    ctx.skipNewlines();

    // Check for parallel pipe \> - start collecting parallel branches
    if (ctx.match(TokenType.PARALLEL_PIPE)) {
      const parallelPipeToken = ctx.previous();
      const parallelPipeColumn = parallelPipeToken.column;
      const parallelPipeLine = parallelPipeToken.line;
      const branches: Expr[] = [];

      // Parse first parallel branch (may include nested indented pipes)
      ctx.skipNewlines();
      branches.push(parseParallelBranch(ctx, parallelPipeColumn, parallelPipeLine));

      // Continue collecting branches while we see more \> at the same column (or same line)
      while (true) {
        const branchSavedPos = ctx.current;
        ctx.skipNewlines();

        // Check if we have another \> - same column for multi-line, or same line for single-line
        if (ctx.check(TokenType.PARALLEL_PIPE)) {
          const nextPipe = ctx.peek();
          const sameLine = nextPipe.line === parallelPipeLine;
          const sameColumn = nextPipe.column === parallelPipeColumn;

          if (sameLine || sameColumn) {
            ctx.advance(); // consume \>
            ctx.skipNewlines();
            branches.push(parseParallelBranch(ctx, parallelPipeColumn, parallelPipeLine));
            continue;
          }
        }
        ctx.setCurrent(branchSavedPos);
        break;
      }

      // Add the parallel stage
      stages.push({ isParallel: true, branches } as ParallelPipelineStage);
      continue;
    }

    // Check for regular pipe />
    if (ctx.match(TokenType.PIPE)) {
      ctx.skipNewlines();
      stageExpr = parseStageExpr(ctx);
      stages.push({ expr: stageExpr });
      continue;
    }

    // Check for spread pipe />>> - maps function over each element
    if (ctx.match(TokenType.SPREAD_PIPE)) {
      ctx.skipNewlines();
      stageExpr = parseStageExpr(ctx);
      stages.push({ isSpread: true, expr: stageExpr } as SpreadPipelineStage);
      continue;
    }

    // No more pipes, restore position and break
    ctx.setCurrent(savedPos);
    break;
  }

  // Restore inPipeOperand flag
  ctx.setInPipeOperand(wasInPipeOperand);

  // Parse optional type signature: :: [Int] or :: [Int] /> [Int]
  let typeSignature: PipelineTypeSignature | undefined;
  const savedPosForType = ctx.current;
  ctx.skipNewlines();
  if (ctx.check(TokenType.DOUBLE_COLON)) {
    typeSignature = parsePipelineTypeSignature(ctx);
  } else {
    ctx.setCurrent(savedPosForType);
  }

  // Parse trailing decorators for the pipeline
  const savedPosForDecorators = ctx.current;
  const decorators = parseDecorators(ctx);
  if (decorators.length === 0) {
    ctx.setCurrent(savedPosForDecorators);
  }
  return pipelineLiteral(stages, decorators, typeSignature);
}

/**
 * Parse a single parallel branch, which may contain nested indented pipes
 *
 * Example:
 *   \> filter((x) -> x < 20)
 *     /> map((x) -> x * 7)
 *
 * The first expression is "filter((x) -> x < 20)"
 * The nested "/> map((x) -> x * 7)" is part of this branch (more indented)
 */
function parseParallelBranch(ctx: ParserContext, parallelPipeColumn: number, parallelPipeLine: number): Expr {
  // Parse the first expression in the branch
  let branchExpr = parseStageExpr(ctx);

  // Collect any nested pipes that are MORE indented than the \>
  // Only applies to multi-line code - on same line, don't consume subsequent pipes
  const nestedStages: AnyPipelineStage[] = [];

  while (true) {
    const savedPos = ctx.current;
    ctx.skipNewlines();

    // Check if we have a /> that is more indented than the \>
    if (ctx.check(TokenType.PIPE)) {
      const pipeToken = ctx.peek();

      // Only consume if it's on a different line AND more indented (nested within this branch)
      // On the same line, don't consume - let the outer pipeline parser handle it
      if (pipeToken.line !== parallelPipeLine && pipeToken.column > parallelPipeColumn) {
        ctx.advance(); // consume />
        ctx.skipNewlines();
        const stageExpr = parseStageExpr(ctx);
        nestedStages.push({ expr: stageExpr });
        continue;
      }
    }

    // Check if we have a />>> that is more indented than the \>
    if (ctx.check(TokenType.SPREAD_PIPE)) {
      const pipeToken = ctx.peek();

      // Only consume if it's on a different line AND more indented (nested within this branch)
      if (pipeToken.line !== parallelPipeLine && pipeToken.column > parallelPipeColumn) {
        ctx.advance(); // consume />>>
        ctx.skipNewlines();
        const stageExpr = parseStageExpr(ctx);
        nestedStages.push({ isSpread: true, expr: stageExpr } as SpreadPipelineStage);
        continue;
      }
    }

    // Not a nested pipe, restore and break
    ctx.setCurrent(savedPos);
    break;
  }

  // If we have nested stages, wrap the branch in a pipeline literal
  if (nestedStages.length > 0) {
    // The branch becomes a pipeline with the initial expr as first stage
    const allStages: AnyPipelineStage[] = [{ expr: branchExpr }, ...nestedStages];
    return pipelineLiteral(allStages, []);
  }

  // No nested pipes, just return the expression
  return branchExpr;
}

/**
 * Helper to parse a single stage expression with call/index/member access
 */
export function parseStageExpr(ctx: ParserContext): Expr {
  let stageExpr = parseUnary(ctx);

  // Handle call expressions, indexing, and member access after the stage
  while (true) {
    if (ctx.match(TokenType.LPAREN)) {
      stageExpr = finishCall(ctx, stageExpr);
    } else if (ctx.match(TokenType.LBRACKET)) {
      const index = parseExpression(ctx);
      ctx.consume(TokenType.RBRACKET, "Expected ']' after index");
      stageExpr = indexExpr(stageExpr, index);
    } else if (ctx.match(TokenType.DOT)) {
      const member = ctx.consume(TokenType.IDENTIFIER, "Expected property name after '.'").lexeme;
      stageExpr = memberExpr(stageExpr, member);
    } else {
      break;
    }
  }
  return stageExpr;
}

/**
 * Parse a bidirectional pipeline literal: </> fn1 </> fn2 </> fn3
 */
export function parseBidirectionalPipelineLiteral(ctx: ParserContext): Expr {
  const stages: PipelineStage[] = [];

  // Parse the first stage (already consumed the initial </>)
  ctx.skipNewlines();
  let stageExpr = parseUnary(ctx); // Parse the expression after </>

  // Handle call expressions after the stage
  while (true) {
    if (ctx.match(TokenType.LPAREN)) {
      stageExpr = finishCall(ctx, stageExpr);
    } else if (ctx.match(TokenType.LBRACKET)) {
      const index = parseExpression(ctx);
      ctx.consume(TokenType.RBRACKET, "Expected ']' after index");
      stageExpr = indexExpr(stageExpr, index);
    } else if (ctx.match(TokenType.DOT)) {
      const member = ctx.consume(TokenType.IDENTIFIER, "Expected property name after '.'").lexeme;
      stageExpr = memberExpr(stageExpr, member);
    } else {
      break;
    }
  }

  stages.push({ expr: stageExpr });

  // Continue parsing more stages if there are more </> operators
  while (true) {
    const savedPos = ctx.current;
    ctx.skipNewlines();

    if (!ctx.match(TokenType.BIDIRECTIONAL_PIPE)) {
      ctx.setCurrent(savedPos);
      break;
    }

    ctx.skipNewlines();
    let nextStageExpr = parseUnary(ctx);

    // Handle call expressions after the stage
    while (true) {
      if (ctx.match(TokenType.LPAREN)) {
        nextStageExpr = finishCall(ctx, nextStageExpr);
      } else if (ctx.match(TokenType.LBRACKET)) {
        const index = parseExpression(ctx);
        ctx.consume(TokenType.RBRACKET, "Expected ']' after index");
        nextStageExpr = indexExpr(nextStageExpr, index);
      } else if (ctx.match(TokenType.DOT)) {
        const member = ctx.consume(TokenType.IDENTIFIER, "Expected property name after '.'").lexeme;
        nextStageExpr = memberExpr(nextStageExpr, member);
      } else {
        break;
      }
    }

    stages.push({ expr: nextStageExpr });
  }

  // Parse optional type signature: :: [Int] or :: [Int] /> [Int]
  let typeSignature: PipelineTypeSignature | undefined;
  const savedPosForType = ctx.current;
  ctx.skipNewlines();
  if (ctx.check(TokenType.DOUBLE_COLON)) {
    typeSignature = parsePipelineTypeSignature(ctx);
  } else {
    ctx.setCurrent(savedPosForType);
  }

  // Parse trailing decorators for the pipeline
  const savedPosForDecorators = ctx.current;
  const decorators = parseDecorators(ctx);
  if (decorators.length === 0) {
    ctx.setCurrent(savedPosForDecorators);
  }
  return bidirectionalPipelineLiteral(stages, decorators, typeSignature);
}

/**
 * Parse decorators: #log #memo #time #retry(3)
 */
export function parseDecorators(ctx: ParserContext): { name: string; args: (number | string | boolean)[] }[] {
  const decorators: { name: string; args: (number | string | boolean)[] }[] = [];

  // Allow decorators on following lines
  ctx.skipNewlines();

  while (ctx.match(TokenType.HASH)) {
    const name = ctx.consume(TokenType.IDENTIFIER, "Expected decorator name").lexeme;
    const args: (number | string | boolean)[] = [];

    // Parse optional arguments: #retry(3) or #timeout(1000) or #coerce(Int)
    if (ctx.match(TokenType.LPAREN)) {
      if (!ctx.check(TokenType.RPAREN)) {
        do {
          if (ctx.match(TokenType.NUMBER)) {
            args.push(ctx.previous().literal as number);
          } else if (ctx.match(TokenType.STRING)) {
            args.push(ctx.previous().literal as string);
          } else if (ctx.match(TokenType.TRUE)) {
            args.push(true);
          } else if (ctx.match(TokenType.FALSE)) {
            args.push(false);
          } else if (ctx.match(TokenType.IDENTIFIER)) {
            // Allow identifiers (e.g., type names like Int, String, Bool)
            args.push(ctx.previous().lexeme);
          } else {
            throw new ParseError("Expected literal or identifier in decorator argument", ctx.peek());
          }
        } while (ctx.match(TokenType.COMMA));
      }
      ctx.consume(TokenType.RPAREN, "Expected ')' after decorator arguments");
    }

    decorators.push({ name, args });
    // Allow next decorator on a new line, but save position first
    const beforeSkip = ctx.current;
    ctx.skipNewlines();
    // If no more decorators, restore position to not consume trailing newlines
    if (!ctx.check(TokenType.HASH)) {
      ctx.setCurrent(beforeSkip);
      break;
    }
  }

  return decorators;
}

/**
 * Parse a match expression: match value
 *   | pattern -> result
 *   | if guard -> result
 *   | default
 */
export function parseMatch(ctx: ParserContext): Expr {
  // Parse the value being matched
  const value = parseEquality(ctx);
  const cases: MatchCase[] = [];

  // Skip newlines before cases
  ctx.skipNewlines();

  // Parse cases while we see |
  while (ctx.check(TokenType.PIPE_CHAR)) {
    ctx.advance(); // consume |
    ctx.skipNewlines();

    let pattern: Expr | null = null;
    let guard: Expr | null = null;
    let body: Expr;

    // Check if this is a guard case: | if condition -> result
    if (ctx.check(TokenType.IF)) {
      ctx.advance(); // consume if
      ctx.skipNewlines();
      // Parse the guard condition (which may use _ as placeholder for the matched value)
      guard = parseEquality(ctx);
      ctx.skipNewlines();
      ctx.consume(TokenType.ARROW, "Expected '->' after guard condition");
      ctx.skipNewlines();
      body = parseExpression(ctx);
    } else {
      // Try to parse a pattern
      // Save position to check if this is a default case (no arrow)
      const savedPos = ctx.current;
      const possiblePattern = parseExpression(ctx);

      // Check if there's an arrow after the pattern
      const beforeArrow = ctx.current;
      ctx.skipNewlines();

      if (ctx.check(TokenType.ARROW)) {
        // This is a pattern case: | pattern -> result
        ctx.advance(); // consume ->
        ctx.skipNewlines();
        pattern = possiblePattern;
        body = parseExpression(ctx);
      } else {
        // No arrow - this is a default case: | result
        // Restore position and re-parse as the body (in case skipNewlines moved us)
        ctx.setCurrent(savedPos);
        body = parseExpression(ctx);
        pattern = null;
      }
    }

    cases.push({ pattern, guard, body });

    // Skip newlines before potentially more cases
    ctx.skipNewlines();
  }

  if (cases.length === 0) {
    throw new ParseError("Match expression must have at least one case", ctx.peek());
  }

  return matchExpr(value, cases);
}

/**
 * Parse a use expression: use "./path" or use "./path.lea"
 * Returns a UseExpr node with the module path
 */
export function parseUse(ctx: ParserContext): Expr {
  // Expect a string literal for the path
  const pathToken = ctx.consume(TokenType.STRING, "Expected module path string after 'use'");
  const path = pathToken.literal as string;

  return useExpr(path);
}

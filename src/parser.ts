import { Token, TokenType } from "./token";
import {
  Expr,
  Stmt,
  Program,
  FunctionParam,
  Decorator,
  TypeSignature,
  LetStmt,
  BlockBody,
  RecordField,
  PipelineStage,
  ParallelPipelineStage,
  AnyPipelineStage,
  numberLiteral,
  stringLiteral,
  templateStringExpr,
  booleanLiteral,
  identifier,
  binaryExpr,
  unaryExpr,
  pipeExpr,
  parallelPipeExpr,
  callExpr,
  functionExpr,
  listExpr,
  indexExpr,
  placeholderExpr,
  awaitExpr,
  recordExpr,
  memberExpr,
  ternaryExpr,
  returnExpr,
  tupleExpr,
  blockBody,
  contextDefStmt,
  provideStmt,
  decoratorDefStmt,
  codeblockStmt,
  letStmt,
  exprStmt,
  program,
  pipelineLiteral,
  reversePipeExpr,
  bidirectionalPipelineLiteral,
} from "./ast";
import { Lexer } from "./lexer";

export class ParseError extends Error {
  constructor(message: string, public token: Token) {
    super(`[${token.line}:${token.column}] ${message}`);
    this.name = "ParseError";
  }
}

export class Parser {
  private tokens: Token[];
  private current = 0;
  private inParallelPipeBranch = false;  // Track if we're inside a parallel pipe branch

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
      return this.letStatement(false);
    }
    if (this.check(TokenType.MAYBE)) {
      return this.letStatement(true);
    }
    if (this.check(TokenType.CONTEXT)) {
      return this.contextStatement();
    }
    if (this.check(TokenType.PROVIDE)) {
      return this.provideStatement();
    }
    if (this.check(TokenType.DECORATOR)) {
      return this.decoratorDefStatement();
    }
    if (this.check(TokenType.CODEBLOCK_OPEN)) {
      return this.codeblockStatement();
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

  private decoratorDefStatement(): Stmt {
    this.consume(TokenType.DECORATOR, "Expected 'decorator'");
    const name = this.consume(TokenType.IDENTIFIER, "Expected decorator name").lexeme;
    this.consume(TokenType.EQ, "Expected '=' after decorator name");
    const transformer = this.expression();
    return decoratorDefStmt(name, transformer);
  }

  private codeblockStatement(): Stmt {
    const openToken = this.consume(TokenType.CODEBLOCK_OPEN, "Expected '<>'");
    const label = openToken.literal as string | null;

    this.skipNewlines();

    // Parse statements until we hit a closing </> or EOF
    // Note: </> now produces BIDIRECTIONAL_PIPE token (used for both codeblock close and bidirectional pipelines)
    const statements: Stmt[] = [];
    while (!this.check(TokenType.BIDIRECTIONAL_PIPE) && !this.isAtEnd()) {
      statements.push(this.statement());
      this.skipNewlines();
    }

    // Consume closing </> (BIDIRECTIONAL_PIPE token)
    this.consume(TokenType.BIDIRECTIONAL_PIPE, "Expected '</>' to close codeblock");

    return codeblockStmt(label, statements);
  }

  private letStatement(mutable: boolean): LetStmt {
    // Consume either 'let' or 'maybe' keyword
    if (this.check(TokenType.LET)) {
      this.advance();
    } else if (this.check(TokenType.MAYBE)) {
      this.advance();
    }

    const name = this.consume(TokenType.IDENTIFIER, "Expected variable name").lexeme;

    this.consume(TokenType.EQ, "Expected '=' after variable name");
    // Skip newlines after = to allow pipeline literals on the next line:
    // let foo =
    //   /> map((x) -> x + 1)
    this.skipNewlines();
    const value = this.expression();

    return letStmt(name, mutable, value);
  }

  // Precedence (low to high): ternary, equality, comparison, term, factor, pipe, unary, call, primary
  private expression(): Expr {
    return this.ternary();
  }

  // Variant that doesn't consume parallel pipes (\>) - used for single-line function bodies
  // so that `5 \> (x) -> x + 1 \> (x) -> x * 2` parses the functions as separate branches
  private ternaryNoParallelPipe(): Expr {
    let expr = this.equalityNoParallelPipe();

    const savedPos = this.current;
    this.skipNewlines();

    if (this.match(TokenType.QUESTION)) {
      this.skipNewlines();
      const thenBranch = this.ternaryNoParallelPipe();
      this.skipNewlines();
      this.consume(TokenType.COLON, "Expected ':' in ternary expression");
      this.skipNewlines();
      const elseBranch = this.ternaryNoParallelPipe();
      expr = ternaryExpr(expr, thenBranch, elseBranch);
    } else {
      this.current = savedPos;
    }

    return expr;
  }

  private equalityNoParallelPipe(): Expr {
    let expr = this.comparisonNoParallelPipe();

    while (this.match(TokenType.EQEQ, TokenType.NEQ)) {
      const operator = this.previous();
      const right = this.comparisonNoParallelPipe();
      expr = binaryExpr(operator, expr, right);
    }

    return expr;
  }

  private comparisonNoParallelPipe(): Expr {
    let expr = this.termNoParallelPipe();

    while (this.match(TokenType.LT, TokenType.GT, TokenType.LTE, TokenType.GTE)) {
      const operator = this.previous();
      const right = this.termNoParallelPipe();
      expr = binaryExpr(operator, expr, right);
    }

    return expr;
  }

  private termNoParallelPipe(): Expr {
    let expr = this.factorNoParallelPipe();

    while (this.match(TokenType.PLUS, TokenType.MINUS, TokenType.CONCAT)) {
      const operator = this.previous();
      const right = this.factorNoParallelPipe();
      expr = binaryExpr(operator, expr, right);
    }

    return expr;
  }

  // For single-line function bodies, don't consume parallel pipes (\>)
  // but DO allow regular pipes (/>)
  // This ensures `5 \> (x) -> x + 1 \> (x) -> x * 2` parses functions as separate branches
  // while `(f, x) -> x /> f /> f` correctly includes pipes in the function body
  private factorNoParallelPipe(): Expr {
    let expr = this.pipeTermNoParallel();

    while (this.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT)) {
      const operator = this.previous();
      const right = this.pipeTermNoParallel();
      expr = binaryExpr(operator, expr, right);
    }

    return expr;
  }

  // Only handles regular pipes (/>), not parallel pipes (\>)
  private pipeTermNoParallel(): Expr {
    let expr = this.unary();

    while (true) {
      const savedPos = this.current;
      this.skipNewlines();

      // Only check for regular pipe />, NOT parallel pipe \>
      if (!this.match(TokenType.PIPE)) {
        this.current = savedPos;
        break;
      }
      this.skipNewlines();
      const right = this.unary();
      expr = pipeExpr(expr, right);
    }

    return expr;
  }

  // Variant that doesn't consume any pipes at all - used for function bodies inside parallel pipe branches
  private ternaryNoPipes(): Expr {
    let expr = this.equalityNoPipes();

    const savedPos = this.current;
    this.skipNewlines();

    if (this.match(TokenType.QUESTION)) {
      this.skipNewlines();
      const thenBranch = this.ternaryNoPipes();
      this.skipNewlines();
      this.consume(TokenType.COLON, "Expected ':' in ternary expression");
      this.skipNewlines();
      const elseBranch = this.ternaryNoPipes();
      expr = ternaryExpr(expr, thenBranch, elseBranch);
    } else {
      this.current = savedPos;
    }

    return expr;
  }

  private equalityNoPipes(): Expr {
    let expr = this.comparisonNoPipes();

    while (this.match(TokenType.EQEQ, TokenType.NEQ)) {
      const operator = this.previous();
      const right = this.comparisonNoPipes();
      expr = binaryExpr(operator, expr, right);
    }

    return expr;
  }

  private comparisonNoPipes(): Expr {
    let expr = this.termNoPipes();

    while (this.match(TokenType.LT, TokenType.GT, TokenType.LTE, TokenType.GTE)) {
      const operator = this.previous();
      const right = this.termNoPipes();
      expr = binaryExpr(operator, expr, right);
    }

    return expr;
  }

  private termNoPipes(): Expr {
    let expr = this.factorNoPipes();

    while (this.match(TokenType.PLUS, TokenType.MINUS, TokenType.CONCAT)) {
      const operator = this.previous();
      const right = this.factorNoPipes();
      expr = binaryExpr(operator, expr, right);
    }

    return expr;
  }

  private factorNoPipes(): Expr {
    let expr = this.unary();

    while (this.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT)) {
      const operator = this.previous();
      const right = this.unary();
      expr = binaryExpr(operator, expr, right);
    }

    return expr;
  }

  private ternary(): Expr {
    let expr = this.equality();

    // Check for ? potentially on next line
    const savedPos = this.current;
    this.skipNewlines();

    if (this.match(TokenType.QUESTION)) {
      this.skipNewlines();
      const thenBranch = this.ternary();
      this.skipNewlines();
      this.consume(TokenType.COLON, "Expected ':' in ternary expression");
      this.skipNewlines();
      const elseBranch = this.ternary();
      expr = ternaryExpr(expr, thenBranch, elseBranch);
    } else {
      // No ternary, restore position
      this.current = savedPos;
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
    let expr = this.pipeTerm();

    while (this.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT)) {
      const operator = this.previous();
      const right = this.pipeTerm();
      expr = binaryExpr(operator, expr, right);
    }

    return expr;
  }

  // Pipe operators bind tighter than arithmetic, so `a /> b + c` means `(a /> b) + c`
  private pipeTerm(): Expr {
    let expr = this.unary();

    while (true) {
      const savedPos = this.current;
      this.skipNewlines();

      // Check for parallel pipe \>
      if (this.check(TokenType.PARALLEL_PIPE)) {
        const pipeColumn = this.peek().column;
        this.advance(); // consume \>
        this.skipNewlines();
        // Parse branch with potential nested pipes (indented more than \>)
        const branches: Expr[] = [this.parsePipeBranchTight(pipeColumn)];

        // Collect all consecutive \> branches at same or greater column
        while (true) {
          this.skipNewlines();
          if (!this.check(TokenType.PARALLEL_PIPE)) break;
          if (this.peek().column < pipeColumn) break; // Less indented = belongs to outer
          this.advance();
          this.skipNewlines();
          branches.push(this.parsePipeBranchTight(pipeColumn));
        }

        expr = parallelPipeExpr(expr, branches);
        continue;
      }

      // Check for reverse pipe </
      // Syntax: pipeline </ value (applies value through pipeline in reverse)
      if (this.match(TokenType.REVERSE_PIPE)) {
        this.skipNewlines();
        const right = this.unary();
        expr = reversePipeExpr(expr, right);
        continue;
      }

      // Check for regular pipe />
      if (!this.match(TokenType.PIPE)) {
        this.current = savedPos;
        break;
      }
      this.skipNewlines();
      const right = this.unary();
      expr = pipeExpr(expr, right);
    }

    return expr;
  }

  // Parse a branch within a parallel pipe at the tight precedence level
  private parsePipeBranchTight(branchColumn: number): Expr {
    const branchLine = this.previous().line;

    // Set flag so function bodies inside branches don't consume pipes
    const wasInParallelPipeBranch = this.inParallelPipeBranch;
    this.inParallelPipeBranch = true;
    let expr = this.unary();
    this.inParallelPipeBranch = wasInParallelPipeBranch;

    // Continue parsing /> pipes that are on a new line AND more indented than the \> branch
    while (true) {
      const savedPos = this.current;
      this.skipNewlines();

      // Check if next token is a pipe that's more indented than the branch
      if (this.check(TokenType.PIPE)) {
        const pipeCol = this.peek().column;
        const pipeLine = this.peek().line;
        // Only consume if:
        // 1. On a new line (not same line as the \>)
        // 2. More indented than the \> that started this branch
        if (pipeLine > branchLine && pipeCol > branchColumn) {
          this.advance(); // consume />
          this.skipNewlines();
          this.inParallelPipeBranch = true;
          const right = this.unary();
          this.inParallelPipeBranch = wasInParallelPipeBranch;
          expr = pipeExpr(expr, right);
          continue;
        }
      }

      // Not a continuation of this branch, restore and stop
      this.current = savedPos;
      break;
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

    if (this.match(TokenType.RETURN)) {
      const value = this.expression();
      return returnExpr(value);
    }

    return this.call();
  }

  private call(): Expr {
    let expr = this.primary();
    let lastLine = this.previous().line;

    while (true) {
      if (this.match(TokenType.LPAREN)) {
        expr = this.finishCall(expr);
        lastLine = this.previous().line;
      } else if (this.check(TokenType.LBRACKET)) {
        // Only treat [ as indexing if it's on the same line as the expression
        // This prevents `expr\n[1,2,3]` from being parsed as `expr[1,2,3]`
        if (this.peek().line !== lastLine) {
          break;
        }
        this.advance(); // consume [
        const index = this.expression();
        this.consume(TokenType.RBRACKET, "Expected ']' after index");
        expr = indexExpr(expr, index);
        lastLine = this.previous().line;
      } else if (this.match(TokenType.DOT)) {
        const member = this.consume(TokenType.IDENTIFIER, "Expected property name after '.'").lexeme;
        expr = memberExpr(expr, member);
        lastLine = this.previous().line;
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

    if (this.match(TokenType.TEMPLATE_STRING)) {
      return this.templateString();
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

    // Pipeline literal: /> fn1 /> fn2 /> fn3
    // A pipeline starts with /> and creates a reusable chain of transformations
    if (this.match(TokenType.PIPE)) {
      return this.pipelineLiteral();
    }

    // Bidirectional pipeline literal: </> fn1 </> fn2 </> fn3
    // A bidirectional pipeline can be applied forward or in reverse
    if (this.match(TokenType.BIDIRECTIONAL_PIPE)) {
      return this.bidirectionalPipelineLiteral();
    }

    throw new ParseError(`Unexpected token '${this.peek().lexeme}'`, this.peek());
  }

  // Parse a template string: `hello {name}, you are {age} years old`
  // The lexer stores parts as strings where even indices are literals and odd indices are expressions
  private templateString(): Expr {
    const rawParts = this.previous().literal as string[];
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
  
  // Parse a pipeline literal: /> fn1 /> fn2 /> fn3
  // Can include parallel stages: /> fn1 \> branch1 \> branch2 /> combiner
  // Returns a PipelineLiteral with a list of stages
  private pipelineLiteral(): Expr {
    const stages: AnyPipelineStage[] = [];

    // Parse the first stage (already consumed the initial />)
    this.skipNewlines();
    let stageExpr = this.parseStageExpr();
    stages.push({ expr: stageExpr });

    // Continue parsing more stages
    while (true) {
      const savedPos = this.current;
      this.skipNewlines();

      // Check for parallel pipe \> - start collecting parallel branches
      if (this.match(TokenType.PARALLEL_PIPE)) {
        const branches: Expr[] = [];

        // Parse first parallel branch
        this.skipNewlines();
        branches.push(this.parseStageExpr());

        // Continue collecting branches while we see more \>
        while (true) {
          const branchSavedPos = this.current;
          this.skipNewlines();

          if (this.match(TokenType.PARALLEL_PIPE)) {
            this.skipNewlines();
            branches.push(this.parseStageExpr());
          } else {
            this.current = branchSavedPos;
            break;
          }
        }

        // Add the parallel stage
        stages.push({ isParallel: true, branches } as ParallelPipelineStage);
        continue;
      }

      // Check for regular pipe />
      if (this.match(TokenType.PIPE)) {
        this.skipNewlines();
        stageExpr = this.parseStageExpr();
        stages.push({ expr: stageExpr });
        continue;
      }

      // No more pipes, restore position and break
      this.current = savedPos;
      break;
    }

    // Parse trailing decorators for the pipeline
    const savedPosForDecorators = this.current;
    const decorators = this.parseDecorators();
    if (decorators.length === 0) {
      this.current = savedPosForDecorators;
    }
    return pipelineLiteral(stages, decorators);
  }

  // Helper to parse a single stage expression with call/index/member access
  private parseStageExpr(): Expr {
    let stageExpr = this.unary();

    // Handle call expressions, indexing, and member access after the stage
    while (true) {
      if (this.match(TokenType.LPAREN)) {
        stageExpr = this.finishCall(stageExpr);
      } else if (this.match(TokenType.LBRACKET)) {
        const index = this.expression();
        this.consume(TokenType.RBRACKET, "Expected ']' after index");
        stageExpr = { kind: "IndexExpr" as const, object: stageExpr, index };
      } else if (this.match(TokenType.DOT)) {
        const member = this.consume(TokenType.IDENTIFIER, "Expected property name after '.'").lexeme;
        stageExpr = { kind: "MemberExpr" as const, object: stageExpr, member };
      } else {
        break;
      }
    }
    return stageExpr;
  }

  // Parse a bidirectional pipeline literal: </> fn1 </> fn2 </> fn3
  // Returns a BidirectionalPipelineLiteral with a list of stages
  private bidirectionalPipelineLiteral(): Expr {
    const stages: PipelineStage[] = [];

    // Parse the first stage (already consumed the initial </>)
    this.skipNewlines();
    let stageExpr = this.unary();  // Parse the expression after </>

    // Handle call expressions after the stage
    while (true) {
      if (this.match(TokenType.LPAREN)) {
        stageExpr = this.finishCall(stageExpr);
      } else if (this.match(TokenType.LBRACKET)) {
        const index = this.expression();
        this.consume(TokenType.RBRACKET, "Expected ']' after index");
        stageExpr = { kind: "IndexExpr" as const, object: stageExpr, index };
      } else if (this.match(TokenType.DOT)) {
        const member = this.consume(TokenType.IDENTIFIER, "Expected property name after '.'").lexeme;
        stageExpr = { kind: "MemberExpr" as const, object: stageExpr, member };
      } else {
        break;
      }
    }

    stages.push({ expr: stageExpr });

    // Continue parsing more stages if there are more </> operators
    while (true) {
      const savedPos = this.current;
      this.skipNewlines();

      if (!this.match(TokenType.BIDIRECTIONAL_PIPE)) {
        this.current = savedPos;
        break;
      }

      this.skipNewlines();
      let nextStageExpr = this.unary();

      // Handle call expressions after the stage
      while (true) {
        if (this.match(TokenType.LPAREN)) {
          nextStageExpr = this.finishCall(nextStageExpr);
        } else if (this.match(TokenType.LBRACKET)) {
          const index = this.expression();
          this.consume(TokenType.RBRACKET, "Expected ']' after index");
          nextStageExpr = { kind: "IndexExpr" as const, object: nextStageExpr, index };
        } else if (this.match(TokenType.DOT)) {
          const member = this.consume(TokenType.IDENTIFIER, "Expected property name after '.'").lexeme;
          nextStageExpr = { kind: "MemberExpr" as const, object: nextStageExpr, member };
        } else {
          break;
        }
      }

      stages.push({ expr: nextStageExpr });
    }

    // Parse trailing decorators for the pipeline
    // Save position in case there are no decorators (to avoid consuming newlines)
    const savedPosForDecorators = this.current;
    const decorators = this.parseDecorators();
    if (decorators.length === 0) {
      this.current = savedPosForDecorators;
    }
    return bidirectionalPipelineLiteral(stages, decorators);
  }

  private record(): Expr {
    const fields: RecordField[] = [];

    this.skipNewlines();
    if (!this.check(TokenType.RBRACE)) {
      do {
        this.skipNewlines();
        // Check for trailing comma (empty field before })
        if (this.check(TokenType.RBRACE)) break;
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

    this.skipNewlines();
    if (!this.check(TokenType.RBRACKET)) {
      do {
        this.skipNewlines();
        // Check for trailing comma (empty element before ])
        if (this.check(TokenType.RBRACKET)) break;
        elements.push(this.expression());
        this.skipNewlines();
      } while (this.match(TokenType.COMMA));
    }
    this.skipNewlines();
    this.consume(TokenType.RBRACKET, "Expected ']' after list elements");
    return listExpr(elements);
  }

  private groupingOrFunction(): Expr {
    // Could be: (expr), (), (params) -> body, (params) <- body (reverse), or (expr, expr, ...) tuple
    const startPos = this.current;

    // Check for empty params: () -> or () <-
    if (this.check(TokenType.RPAREN)) {
      this.advance(); // consume )
      // Check for forward function: () ->
      if (this.match(TokenType.ARROW)) {
        const { attachments, body, typeSignature } = this.parseFunctionBody();
        const decorators = this.parseDecorators();
        return functionExpr([], body, undefined, decorators, attachments, typeSignature, false);
      }
      // Check for reverse function: () <-
      if (this.match(TokenType.RETURN)) {
        const { attachments, body, typeSignature } = this.parseFunctionBody();
        const decorators = this.parseDecorators();
        return functionExpr([], body, undefined, decorators, attachments, typeSignature, true);
      }
      // Empty parens () could be empty tuple
      return tupleExpr([]);
    }

    // Try to parse as function parameters
    if (this.looksLikeFunctionParams()) {
      const params = this.parseFunctionParams();
      this.consume(TokenType.RPAREN, "Expected ')' after parameters");

      let returnType: string | undefined;
      if (this.match(TokenType.COLON)) {
        returnType = this.consume(TokenType.IDENTIFIER, "Expected return type").lexeme;
      }

      // Check for forward function: (params) ->
      if (this.match(TokenType.ARROW)) {
        const { attachments, body, typeSignature } = this.parseFunctionBody();
        const decorators = this.parseDecorators();
        return functionExpr(params, body, returnType, decorators, attachments, typeSignature, false);
      }

      // Check for reverse function: (params) <-
      if (this.match(TokenType.RETURN)) {
        const { attachments, body, typeSignature } = this.parseFunctionBody();
        const decorators = this.parseDecorators();
        return functionExpr(params, body, returnType, decorators, attachments, typeSignature, true);
      }

      throw new ParseError("Expected '->' or '<-' after function parameters", this.peek());
    }

    // Parse first expression
    const firstExpr = this.expression();

    // Check for tuple: (expr, expr, ...)
    if (this.match(TokenType.COMMA)) {
      const elements: Expr[] = [firstExpr];
      do {
        elements.push(this.expression());
      } while (this.match(TokenType.COMMA));
      this.consume(TokenType.RPAREN, "Expected ')' after tuple elements");
      return tupleExpr(elements);
    }

    // Otherwise it's a grouping expression
    this.consume(TokenType.RPAREN, "Expected ')' after expression");
    return firstExpr;
  }

  // Parse a single type annotation, which can be:
  // - Simple type: Int, String, etc.
  // - Optional type: ?Int
  // - Tuple type: (Int, String)
  private parseTypeAnnotation(): string | { tuple: string[]; optional?: boolean } {
    const optional = this.match(TokenType.QUESTION);

    if (this.match(TokenType.LPAREN)) {
      // Tuple type: (Int, String, ...)
      const types: string[] = [];
      if (!this.check(TokenType.RPAREN)) {
        do {
          types.push(this.consume(TokenType.IDENTIFIER, "Expected type name").lexeme);
        } while (this.match(TokenType.COMMA));
      }
      this.consume(TokenType.RPAREN, "Expected ')' after tuple types");
      return { tuple: types, optional };
    }

    // Simple type
    const typeName = this.consume(TokenType.IDENTIFIER, "Expected type name").lexeme;
    return optional ? `?${typeName}` : typeName;
  }

  // Parse trailing type signature: :: (Type, Type) :> ReturnType
  private parseTypeSignature(): TypeSignature | undefined {
    if (!this.match(TokenType.DOUBLE_COLON)) {
      return undefined;
    }

    const paramTypes: (string | { tuple: string[]; optional?: boolean })[] = [];

    // Parse parameter types - can be single type or (Type, Type, ...)
    if (this.match(TokenType.LPAREN)) {
      // Multiple parameter types
      if (!this.check(TokenType.RPAREN)) {
        do {
          paramTypes.push(this.parseTypeAnnotation());
        } while (this.match(TokenType.COMMA));
      }
      this.consume(TokenType.RPAREN, "Expected ')' after parameter types");
    } else {
      // Single parameter type (could be ?Type or (Tuple))
      paramTypes.push(this.parseTypeAnnotation());
    }

    // Parse optional return type with :>
    let returnType: string | { tuple: string[] } | undefined;
    if (this.match(TokenType.COLON_GT)) {
      returnType = this.parseTypeAnnotation();
    }

    return { paramTypes, returnType };
  }

  private parseFunctionBody(): { attachments: string[]; body: Expr | BlockBody; typeSignature?: TypeSignature } {
    const arrowLine = this.previous().line;

    // Check for type signature immediately after arrow: -> :: Int :> Int
    let typeSignature: TypeSignature | undefined;
    if (this.check(TokenType.DOUBLE_COLON)) {
      typeSignature = this.parseTypeSignature();
    }

    // Check for brace-delimited block: -> { ... } or -> :: Type :> Type { ... }
    if (this.check(TokenType.LBRACE)) {
      this.advance(); // consume {
      const result = this.parseBlockBody();
      return { ...result, typeSignature };
    }

    // Check for newline after arrow (indentation-based block)
    if (this.check(TokenType.NEWLINE)) {
      this.advance(); // consume newline
      const result = this.parseIndentedBody();
      return { ...result, typeSignature };
    }

    // Single expression on same line.
    // If we're inside a parallel pipe branch, don't consume ANY pipes (regular or parallel)
    // since those pipes belong to the outer parallel expression.
    // Otherwise, allow regular pipes but not parallel pipes.
    const body = this.inParallelPipeBranch ? this.ternaryNoPipes() : this.ternaryNoParallelPipe();

    // For single-line, type signature comes after body
    if (!typeSignature && this.check(TokenType.DOUBLE_COLON)) {
      typeSignature = this.parseTypeSignature();
    }

    return { attachments: [], body, typeSignature };
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

      // Check if this is a statement (let, maybe, context, provide) or expression
      if (this.check(TokenType.LET) || this.check(TokenType.MAYBE) || this.check(TokenType.CONTEXT) || this.check(TokenType.PROVIDE)) {
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

      if (this.check(TokenType.LET) || this.check(TokenType.MAYBE) || this.check(TokenType.CONTEXT) || this.check(TokenType.PROVIDE)) {
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
    // Then ) followed by -> or <- or : identifier -> or : identifier <-
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
      // Check for either forward (->) or reverse (<-) function arrow
      const isFunction = this.check(TokenType.ARROW) || this.check(TokenType.RETURN);
      this.current = saved;
      return isFunction;
    }

    this.current = saved;
    return false;
  }

  private parseFunctionParams(): FunctionParam[] {
    const params: FunctionParam[] = [];

    do {
      // Allow underscore as parameter name (for ignored/unused params)
      let name: string;
      if (this.match(TokenType.UNDERSCORE)) {
        name = "_";
      } else {
        name = this.consume(TokenType.IDENTIFIER, "Expected parameter name").lexeme;
      }
      let typeAnnotation: string | undefined;
      let defaultValue: Expr | undefined;

      // Check for type annotation (old style: x: Int)
      if (this.match(TokenType.COLON)) {
        typeAnnotation = this.consume(TokenType.IDENTIFIER, "Expected type").lexeme;
      }

      // Check for default value: x = 10
      if (this.match(TokenType.EQ)) {
        defaultValue = this.ternary(); // Use ternary to avoid consuming pipes
      }

      params.push({ name, typeAnnotation, defaultValue });
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
      // Allow next decorator on a new line, but save position first
      const beforeSkip = this.current;
      this.skipNewlines();
      // If no more decorators, restore position to not consume trailing newlines
      if (!this.check(TokenType.HASH)) {
        this.current = beforeSkip;
        break;
      }
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

/**
 * Lea Code Formatter
 *
 * Formats Lea source code in a consistent, Prettier-like style.
 * Takes an AST and outputs formatted source code.
 */

import {
  Expr,
  Stmt,
  Program,
  NumberLiteral,
  StringLiteral,
  TemplateStringExpr,
  BooleanLiteral,
  Identifier,
  BinaryExpr,
  UnaryExpr,
  PipeExpr,
  SpreadPipeExpr,
  ParallelPipeExpr,
  CallExpr,
  FunctionExpr,
  ListExpr,
  IndexExpr,
  PlaceholderExpr,
  AwaitExpr,
  RecordExpr,
  MemberExpr,
  TernaryExpr,
  ReturnExpr,
  TupleExpr,
  PipelineLiteral,
  ReversePipeExpr,
  BidirectionalPipelineLiteral,
  MatchExpr,
  ReactivePipeExpr,
  UseExpr,
  BlockBody,
  LetStmt,
  AndStmt,
  AssignStmt,
  ExprStmt,
  ContextDefStmt,
  ProvideStmt,
  DecoratorDefStmt,
  CodeblockStmt,
  FunctionParam,
  Decorator,
  TypeSignature,
  RecordField,
  RecordFieldOrSpread,
  ListElementOrSpread,
  MatchCase,
  AnyPipelineStage,
} from "./ast";
import { TokenType } from "./token";

export interface FormatterOptions {
  /** Number of spaces for indentation (default: 2) */
  indentSize: number;
  /** Maximum line width before breaking (default: 80) */
  printWidth: number;
  /** Use trailing commas in multi-line collections (default: true) */
  trailingCommas: boolean;
  /** Break pipe chains onto multiple lines (default: true) */
  breakPipeChains: boolean;
  /** Minimum pipe chain length to break onto multiple lines (default: 3) */
  pipeChainBreakThreshold: number;
}

const defaultOptions: FormatterOptions = {
  indentSize: 2,
  printWidth: 80,
  trailingCommas: true,
  breakPipeChains: true,
  pipeChainBreakThreshold: 3,
};

/**
 * Context for formatting, passed through recursive calls
 */
interface FormatContext {
  options: FormatterOptions;
  indentLevel: number;
}

/**
 * Main formatter class
 */
export class Formatter {
  private options: FormatterOptions;

  constructor(options: Partial<FormatterOptions> = {}) {
    this.options = { ...defaultOptions, ...options };
  }

  /**
   * Format a complete program
   */
  format(program: Program): string {
    const ctx: FormatContext = {
      options: this.options,
      indentLevel: 0,
    };

    const lines: string[] = [];
    let lastStmtKind: string | null = null;

    for (const stmt of program.statements) {
      // Add blank line between different statement types or before let statements
      // following expression statements (for visual grouping)
      if (lastStmtKind !== null) {
        const needsBlankLine =
          (stmt.kind === "LetStmt" && lastStmtKind === "ExprStmt") ||
          (stmt.kind === "ContextDefStmt") ||
          (stmt.kind === "ProvideStmt" && lastStmtKind !== "ProvideStmt") ||
          (stmt.kind === "CodeblockStmt");

        if (needsBlankLine) {
          lines.push("");
        }
      }

      lines.push(this.formatStmt(stmt, ctx));
      lastStmtKind = stmt.kind;
    }

    return lines.join("\n") + "\n";
  }

  /**
   * Format a single statement
   */
  private formatStmt(stmt: Stmt, ctx: FormatContext): string {
    switch (stmt.kind) {
      case "LetStmt":
        return this.formatLetStmt(stmt, ctx);
      case "AndStmt":
        return this.formatAndStmt(stmt, ctx);
      case "ExprStmt":
        return this.formatExprStmt(stmt, ctx);
      case "ContextDefStmt":
        return this.formatContextDefStmt(stmt, ctx);
      case "ProvideStmt":
        return this.formatProvideStmt(stmt, ctx);
      case "DecoratorDefStmt":
        return this.formatDecoratorDefStmt(stmt, ctx);
      case "CodeblockStmt":
        return this.formatCodeblockStmt(stmt, ctx);
      case "AssignStmt":
        return this.formatAssignStmt(stmt, ctx);
      default:
        throw new Error(`Unknown statement kind: ${(stmt as Stmt).kind}`);
    }
  }

  private formatLetStmt(stmt: LetStmt, ctx: FormatContext): string {
    const indent = this.indent(ctx);
    const keyword = stmt.mutable ? "maybe" : "let";
    const value = this.formatExpr(stmt.value, ctx);
    return `${indent}${keyword} ${stmt.name} = ${value}`;
  }

  private formatAndStmt(stmt: AndStmt, ctx: FormatContext): string {
    const indent = this.indent(ctx);
    const value = this.formatExpr(stmt.value, ctx);
    return `${indent}and ${stmt.name} = ${value}`;
  }

  private formatExprStmt(stmt: ExprStmt, ctx: FormatContext): string {
    const indent = this.indent(ctx);
    return `${indent}${this.formatExpr(stmt.expression, ctx)}`;
  }

  private formatContextDefStmt(stmt: ContextDefStmt, ctx: FormatContext): string {
    const indent = this.indent(ctx);
    const value = this.formatExpr(stmt.defaultValue, ctx);
    return `${indent}context ${stmt.name} = ${value}`;
  }

  private formatProvideStmt(stmt: ProvideStmt, ctx: FormatContext): string {
    const indent = this.indent(ctx);
    const value = this.formatExpr(stmt.value, ctx);
    return `${indent}provide ${stmt.contextName} ${value}`;
  }

  private formatDecoratorDefStmt(stmt: DecoratorDefStmt, ctx: FormatContext): string {
    const indent = this.indent(ctx);
    const value = this.formatExpr(stmt.transformer, ctx);
    return `${indent}decorator ${stmt.name} = ${value}`;
  }

  private formatCodeblockStmt(stmt: CodeblockStmt, ctx: FormatContext): string {
    const indent = this.indent(ctx);
    const innerCtx = this.increaseIndent(ctx);

    const label = stmt.label ? ` -- ${stmt.label}` : "";
    const lines: string[] = [];

    lines.push(`${indent}<>${label}`);

    for (const s of stmt.statements) {
      lines.push(this.formatStmt(s, innerCtx));
    }

    lines.push(`${indent}</>`);

    return lines.join("\n");
  }

  private formatAssignStmt(stmt: AssignStmt, ctx: FormatContext): string {
    const indent = this.indent(ctx);
    const value = this.formatExpr(stmt.value, ctx);
    return `${indent}${stmt.name} = ${value}`;
  }

  /**
   * Format an expression
   */
  private formatExpr(expr: Expr, ctx: FormatContext): string {
    switch (expr.kind) {
      case "NumberLiteral":
        return this.formatNumberLiteral(expr);
      case "StringLiteral":
        return this.formatStringLiteral(expr);
      case "TemplateStringExpr":
        return this.formatTemplateString(expr, ctx);
      case "BooleanLiteral":
        return this.formatBooleanLiteral(expr);
      case "Identifier":
        return this.formatIdentifier(expr);
      case "BinaryExpr":
        return this.formatBinaryExpr(expr, ctx);
      case "UnaryExpr":
        return this.formatUnaryExpr(expr, ctx);
      case "PipeExpr":
        return this.formatPipeExpr(expr, ctx);
      case "SpreadPipeExpr":
        return this.formatSpreadPipeExpr(expr, ctx);
      case "ParallelPipeExpr":
        return this.formatParallelPipeExpr(expr, ctx);
      case "CallExpr":
        return this.formatCallExpr(expr, ctx);
      case "FunctionExpr":
        return this.formatFunctionExpr(expr, ctx);
      case "ListExpr":
        return this.formatListExpr(expr, ctx);
      case "IndexExpr":
        return this.formatIndexExpr(expr, ctx);
      case "PlaceholderExpr":
        return "input";
      case "AwaitExpr":
        return this.formatAwaitExpr(expr, ctx);
      case "RecordExpr":
        return this.formatRecordExpr(expr, ctx);
      case "MemberExpr":
        return this.formatMemberExpr(expr, ctx);
      case "TernaryExpr":
        return this.formatTernaryExpr(expr, ctx);
      case "ReturnExpr":
        return this.formatReturnExpr(expr, ctx);
      case "TupleExpr":
        return this.formatTupleExpr(expr, ctx);
      case "PipelineLiteral":
        return this.formatPipelineLiteral(expr, ctx);
      case "ReversePipeExpr":
        return this.formatReversePipeExpr(expr, ctx);
      case "BidirectionalPipelineLiteral":
        return this.formatBidirectionalPipelineLiteral(expr, ctx);
      case "MatchExpr":
        return this.formatMatchExpr(expr, ctx);
      case "UseExpr":
        return this.formatUseExpr(expr, ctx);
      case "ReactivePipeExpr":
        return this.formatReactivePipeExpr(expr, ctx);
      default:
        throw new Error(`Unknown expression kind: ${(expr as Expr).kind}`);
    }
  }

  private formatNumberLiteral(expr: NumberLiteral): string {
    return String(expr.value);
  }

  private formatStringLiteral(expr: StringLiteral): string {
    // Escape special characters and wrap in quotes
    const escaped = expr.value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\t/g, "\\t");
    return `"${escaped}"`;
  }

  private formatTemplateString(expr: TemplateStringExpr, ctx: FormatContext): string {
    let result = "`";
    for (const part of expr.parts) {
      if (typeof part === "string") {
        result += part;
      } else {
        result += `{${this.formatExpr(part, ctx)}}`;
      }
    }
    result += "`";
    return result;
  }

  private formatBooleanLiteral(expr: BooleanLiteral): string {
    return expr.value ? "true" : "false";
  }

  private formatIdentifier(expr: Identifier): string {
    return expr.name;
  }

  private formatBinaryExpr(expr: BinaryExpr, ctx: FormatContext): string {
    const left = this.formatExprWithParens(expr.left, expr, "left", ctx);
    const right = this.formatExprWithParens(expr.right, expr, "right", ctx);
    const op = this.tokenToOperator(expr.operator.type);
    return `${left} ${op} ${right}`;
  }

  /**
   * Check if an expression needs parentheses based on context
   */
  private needsParens(child: Expr, parent: Expr, position: "left" | "right"): boolean {
    // Binary expressions may need parens based on precedence
    if (child.kind === "BinaryExpr" && parent.kind === "BinaryExpr") {
      const childPrec = this.getOperatorPrecedence((child as BinaryExpr).operator.type);
      const parentPrec = this.getOperatorPrecedence((parent as BinaryExpr).operator.type);

      // Need parens if child has lower precedence
      if (childPrec < parentPrec) return true;

      // For right-associative or same precedence on right side
      if (childPrec === parentPrec && position === "right") return true;
    }

    // Ternary expressions in binary context need parens
    if (child.kind === "TernaryExpr" && parent.kind === "BinaryExpr") {
      return true;
    }

    return false;
  }

  private formatExprWithParens(
    child: Expr,
    parent: Expr,
    position: "left" | "right",
    ctx: FormatContext
  ): string {
    const formatted = this.formatExpr(child, ctx);
    if (this.needsParens(child, parent, position)) {
      return `(${formatted})`;
    }
    return formatted;
  }

  private getOperatorPrecedence(type: TokenType): number {
    switch (type) {
      case TokenType.EQEQ:
      case TokenType.NEQ:
        return 1;
      case TokenType.LT:
      case TokenType.GT:
      case TokenType.LTE:
      case TokenType.GTE:
        return 2;
      case TokenType.PLUS:
      case TokenType.MINUS:
      case TokenType.CONCAT:
        return 3;
      case TokenType.STAR:
      case TokenType.SLASH:
      case TokenType.PERCENT:
        return 4;
      default:
        return 0;
    }
  }

  private formatUnaryExpr(expr: UnaryExpr, ctx: FormatContext): string {
    const operand = this.formatExpr(expr.operand, ctx);
    const op = this.tokenToOperator(expr.operator.type);
    return `${op}${operand}`;
  }

  /**
   * Format a pipe expression, potentially breaking into multiple lines
   */
  private formatPipeExpr(expr: PipeExpr, ctx: FormatContext): string {
    // Flatten the pipe chain
    const chain = this.flattenPipeChain(expr);

    // Format each element, adding parens to first element if needed (binary exprs need parens before pipe)
    const formattedChain = chain.map((e, i) => {
      const formatted = this.formatExpr(e, ctx);
      // First element: binary expressions need parentheses since pipes bind tighter
      if (i === 0 && this.needsParensBeforePipe(e)) {
        return `(${formatted})`;
      }
      return formatted;
    });

    // Check if any element contains newlines (e.g., parallel pipes, multi-line functions)
    const hasMultiLineElement = formattedChain.some(s => s.includes("\n"));

    // Try formatting on a single line first (only if no multi-line elements)
    if (!hasMultiLineElement) {
      const singleLine = formattedChain.join(" /> ");

      // Only break if line exceeds print width AND chain has enough stages
      const shouldBreak =
        ctx.options.breakPipeChains &&
        singleLine.length > ctx.options.printWidth &&
        chain.length >= ctx.options.pipeChainBreakThreshold;

      if (!shouldBreak) {
        return singleLine;
      }
    }

    // Format as multi-line
    const innerIndent = this.indent(this.increaseIndent(ctx));
    const lines: string[] = [];

    lines.push(formattedChain[0]);
    for (let i = 1; i < formattedChain.length; i++) {
      lines.push(`${innerIndent}/> ${formattedChain[i]}`);
    }

    return lines.join("\n");
  }

  /**
   * Check if an expression needs parentheses when used as the left side of a pipe
   * (pipes bind tighter than binary operators)
   */
  private needsParensBeforePipe(expr: Expr): boolean {
    return expr.kind === "BinaryExpr" || expr.kind === "TernaryExpr";
  }

  private flattenPipeChain(expr: PipeExpr): Expr[] {
    const chain: Expr[] = [];
    let current: Expr = expr;

    while (current.kind === "PipeExpr") {
      chain.unshift((current as PipeExpr).right);
      current = (current as PipeExpr).left;
    }
    chain.unshift(current);

    return chain;
  }

  private formatSpreadPipeExpr(expr: SpreadPipeExpr, ctx: FormatContext): string {
    const left = this.formatExpr(expr.left, ctx);
    const right = this.formatExpr(expr.right, ctx);
    return `${left} />>>${right}`;
  }

  private formatParallelPipeExpr(expr: ParallelPipeExpr, ctx: FormatContext): string {
    const input = this.formatExpr(expr.input, ctx);
    const innerCtx = this.increaseIndent(ctx);
    const innerIndent = this.indent(innerCtx);

    // Check if branches contain nested pipes
    const hasNestedPipes = expr.branches.some(b =>
      b.kind === "PipeExpr" || b.kind === "ParallelPipeExpr"
    );

    // Format each branch
    const formattedBranches: string[] = [];
    for (const branch of expr.branches) {
      if (branch.kind === "PipeExpr") {
        // Format nested pipe chain with further indentation
        const pipeChain = this.flattenPipeChain(branch as PipeExpr);
        const branchLines: string[] = [];
        branchLines.push(`\\> ${this.formatExpr(pipeChain[0], ctx)}`);
        const nestedIndent = this.indent(this.increaseIndent(innerCtx));
        for (let i = 1; i < pipeChain.length; i++) {
          branchLines.push(`${nestedIndent}/> ${this.formatExpr(pipeChain[i], ctx)}`);
        }
        formattedBranches.push(branchLines.join("\n"));
      } else {
        formattedBranches.push(`\\> ${this.formatExpr(branch, ctx)}`);
      }
    }

    // Multi-line format for parallel pipes
    const lines: string[] = [];
    lines.push(input);
    for (const branch of formattedBranches) {
      if (branch.includes("\n")) {
        lines.push(`${innerIndent}${branch}`);
      } else {
        lines.push(`${innerIndent}${branch}`);
      }
    }

    return lines.join("\n");
  }

  private formatCallExpr(expr: CallExpr, ctx: FormatContext): string {
    const callee = this.formatExpr(expr.callee, ctx);
    const args = expr.args.map(a => this.formatExpr(a, ctx)).join(", ");
    return `${callee}(${args})`;
  }

  private formatFunctionExpr(expr: FunctionExpr, ctx: FormatContext): string {
    const parts: string[] = [];

    // Format parameters
    const params = expr.params.map(p => this.formatParam(p, ctx)).join(", ");
    parts.push(`(${params})`);

    // Arrow (forward or reverse)
    const arrow = expr.isReverse ? " <- " : " -> ";

    // Check if body needs multi-line format or if we have attachments
    const needsMultiLine = expr.body.kind === "BlockBody" || expr.attachments.length > 0;

    if (needsMultiLine) {
      const innerCtx = this.increaseIndent(ctx);
      const innerIndent = this.indent(innerCtx);

      // Check if we should use type signature on arrow line (multi-line)
      if (expr.typeSignature) {
        parts.push(`${arrow}:: ${this.formatTypeSignature(expr.typeSignature)}`);
      } else {
        parts.push(arrow.trimEnd());
      }

      const lines: string[] = [parts.join("")];

      // Format attachments (@Context) at the start of the body
      for (const att of expr.attachments) {
        lines.push(`${innerIndent}@${att}`);
      }

      if (expr.body.kind === "BlockBody") {
        // Multi-line block body
        const block = expr.body as BlockBody;

        for (const stmt of block.statements) {
          lines.push(this.formatStmt(stmt, innerCtx));
        }
        lines.push(`${innerIndent}${this.formatExpr(block.result, innerCtx)}`);
      } else {
        // Single expression body but we have attachments
        lines.push(`${innerIndent}${this.formatExpr(expr.body, innerCtx)}`);
      }

      // Add decorators
      if (expr.decorators.length > 0) {
        const lastLineIdx = lines.length - 1;
        lines[lastLineIdx] += " " + expr.decorators.map(d => this.formatDecorator(d)).join(" ");
      }

      return lines.join("\n");
    }

    // Single-line body (must be an Expr, not BlockBody since needsMultiLine would be true)
    const body = this.formatExpr(expr.body as Expr, ctx);
    parts.push(arrow);
    parts.push(body);

    // Type signature
    if (expr.typeSignature) {
      parts.push(` :: ${this.formatTypeSignature(expr.typeSignature)}`);
    }

    // Decorators
    if (expr.decorators.length > 0) {
      parts.push(" " + expr.decorators.map(d => this.formatDecorator(d)).join(" "));
    }

    return parts.join("");
  }

  private formatParam(param: FunctionParam, ctx: FormatContext): string {
    let result = param.name;
    if (param.defaultValue) {
      result += ` = ${this.formatExpr(param.defaultValue, ctx)}`;
    }
    return result;
  }

  private formatTypeSignature(sig: TypeSignature): string {
    const paramTypes = sig.paramTypes.map(t => {
      if (typeof t === "string") {
        return t;
      } else if ("tuple" in t) {
        const tuple = t.tuple.join(", ");
        return t.optional ? `?(${tuple})` : `(${tuple})`;
      }
      return String(t);
    });

    let result: string;
    if (paramTypes.length === 1) {
      result = paramTypes[0];
    } else {
      result = `(${paramTypes.join(", ")})`;
    }

    if (sig.returnType) {
      let returnType: string;
      if (typeof sig.returnType === "string") {
        returnType = sig.returnType;
      } else if ("tuple" in sig.returnType) {
        returnType = `(${sig.returnType.tuple.join(", ")})`;
      } else {
        returnType = `[${sig.returnType.list}]`;
      }
      result += ` :> ${returnType}`;
    }

    return result;
  }

  private formatDecorator(dec: Decorator): string {
    if (dec.args.length === 0) {
      return `#${dec.name}`;
    }
    const args = dec.args.map(a => {
      if (typeof a === "string") return `"${a}"`;
      return String(a);
    }).join(", ");
    return `#${dec.name}(${args})`;
  }

  private formatListElement(el: ListElementOrSpread, ctx: FormatContext): string {
    if (el.spread) {
      return `...${this.formatExpr(el.value, ctx)}`;
    }
    return this.formatExpr(el.value, ctx);
  }

  private formatListExpr(expr: ListExpr, ctx: FormatContext): string {
    if (expr.elements.length === 0) {
      return "[]";
    }

    // Try single-line first
    const elements = expr.elements.map(e => this.formatListElement(e, ctx));
    const singleLine = `[${elements.join(", ")}]`;

    if (singleLine.length <= ctx.options.printWidth) {
      return singleLine;
    }

    // Multi-line format
    const innerCtx = this.increaseIndent(ctx);
    const innerIndent = this.indent(innerCtx);
    const indent = this.indent(ctx);

    const lines: string[] = ["["];
    for (let i = 0; i < expr.elements.length; i++) {
      const trailing = ctx.options.trailingCommas || i < expr.elements.length - 1 ? "," : "";
      lines.push(`${innerIndent}${this.formatListElement(expr.elements[i], innerCtx)}${trailing}`);
    }
    lines.push(`${indent}]`);

    return lines.join("\n");
  }

  private formatIndexExpr(expr: IndexExpr, ctx: FormatContext): string {
    const object = this.formatExpr(expr.object, ctx);
    const index = this.formatExpr(expr.index, ctx);
    return `${object}[${index}]`;
  }

  private formatAwaitExpr(expr: AwaitExpr, ctx: FormatContext): string {
    const operand = this.formatExpr(expr.operand, ctx);
    return `await ${operand}`;
  }

  private formatRecordExpr(expr: RecordExpr, ctx: FormatContext): string {
    if (expr.fields.length === 0) {
      return "{}";
    }

    // Try single-line first
    const fields = expr.fields.map(f => this.formatRecordField(f, ctx));
    const singleLine = `{ ${fields.join(", ")} }`;

    if (singleLine.length <= ctx.options.printWidth) {
      return singleLine;
    }

    // Multi-line format
    const innerCtx = this.increaseIndent(ctx);
    const innerIndent = this.indent(innerCtx);
    const indent = this.indent(ctx);

    const lines: string[] = ["{"];
    for (let i = 0; i < expr.fields.length; i++) {
      const trailing = ctx.options.trailingCommas || i < expr.fields.length - 1 ? "," : "";
      lines.push(`${innerIndent}${this.formatRecordField(expr.fields[i], innerCtx)}${trailing}`);
    }
    lines.push(`${indent}}`);

    return lines.join("\n");
  }

  private formatRecordField(field: RecordFieldOrSpread, ctx: FormatContext): string {
    if (field.spread) {
      return `...${this.formatExpr(field.value, ctx)}`;
    }
    return `${field.key}: ${this.formatExpr(field.value, ctx)}`;
  }

  private formatMemberExpr(expr: MemberExpr, ctx: FormatContext): string {
    const object = this.formatExpr(expr.object, ctx);
    return `${object}.${expr.member}`;
  }

  private formatTernaryExpr(expr: TernaryExpr, ctx: FormatContext): string {
    const condition = this.formatExpr(expr.condition, ctx);
    const thenBranch = this.formatExpr(expr.thenBranch, ctx);
    const elseBranch = this.formatExpr(expr.elseBranch, ctx);

    const singleLine = `${condition} ? ${thenBranch} : ${elseBranch}`;

    if (singleLine.length <= ctx.options.printWidth) {
      return singleLine;
    }

    // Multi-line ternary
    const innerIndent = this.indent(this.increaseIndent(ctx));
    return `${condition}\n${innerIndent}? ${thenBranch}\n${innerIndent}: ${elseBranch}`;
  }

  private formatReturnExpr(expr: ReturnExpr, ctx: FormatContext): string {
    const value = this.formatExpr(expr.value, ctx);
    return `return ${value}`;
  }

  private formatTupleExpr(expr: TupleExpr, ctx: FormatContext): string {
    const elements = expr.elements.map(e => this.formatExpr(e, ctx)).join(", ");
    return `(${elements})`;
  }

  private formatPipelineLiteral(expr: PipelineLiteral, ctx: FormatContext): string {
    const stages = expr.stages.map(s => this.formatPipelineStage(s, ctx)).join(" ");
    const decorators = expr.decorators.length > 0
      ? " " + expr.decorators.map(d => this.formatDecorator(d)).join(" ")
      : "";
    return `${stages}${decorators}`;
  }

  private formatPipelineStage(stage: AnyPipelineStage, ctx: FormatContext): string {
    if (stage.isParallel) {
      // Parallel stage
      const branches = stage.branches.map(b => `\\> ${this.formatExpr(b, ctx)}`);
      return branches.join(" ");
    } else {
      return `/> ${this.formatExpr(stage.expr, ctx)}`;
    }
  }

  private formatReversePipeExpr(expr: ReversePipeExpr, ctx: FormatContext): string {
    const left = this.formatExpr(expr.left, ctx);
    const right = this.formatExpr(expr.right, ctx);
    return `${left} </ ${right}`;
  }

  private formatBidirectionalPipelineLiteral(expr: BidirectionalPipelineLiteral, ctx: FormatContext): string {
    const stages = expr.stages.map(s => `</> ${this.formatExpr(s.expr, ctx)}`).join(" ");
    const decorators = expr.decorators.length > 0
      ? " " + expr.decorators.map(d => this.formatDecorator(d)).join(" ")
      : "";
    return `${stages}${decorators}`;
  }

  private formatMatchExpr(expr: MatchExpr, ctx: FormatContext): string {
    const value = this.formatExpr(expr.value, ctx);
    const innerCtx = this.increaseIndent(ctx);
    const innerIndent = this.indent(innerCtx);

    const lines: string[] = [`match ${value}`];

    for (const c of expr.cases) {
      lines.push(`${innerIndent}${this.formatMatchCase(c, innerCtx)}`);
    }

    return lines.join("\n");
  }

  private formatMatchCase(matchCase: MatchCase, ctx: FormatContext): string {
    const body = this.formatExpr(matchCase.body, ctx);

    if (matchCase.pattern) {
      // Pattern case: | pattern -> body
      const pattern = this.formatExpr(matchCase.pattern, ctx);
      return `| ${pattern} -> ${body}`;
    } else if (matchCase.guard) {
      // Guard case: | if guard -> body
      const guard = this.formatExpr(matchCase.guard, ctx);
      return `| if ${guard} -> ${body}`;
    } else {
      // Default case: | body
      return `| ${body}`;
    }
  }

  private formatUseExpr(expr: UseExpr, ctx: FormatContext): string {
    return `use "${expr.path}"`;
  }

  private formatReactivePipeExpr(expr: ReactivePipeExpr, ctx: FormatContext): string {
    const source = this.formatExpr(expr.source, ctx);
    const stages = expr.stages.map(s => this.formatPipelineStage(s, ctx)).join(" ");
    // Replace first /> with @> for the reactive pipe syntax
    const formattedStages = stages.replace(/^\/> /, "");
    return `${source} @> ${formattedStages}`;
  }

  /**
   * Convert a TokenType to its string operator representation
   */
  private tokenToOperator(type: TokenType): string {
    switch (type) {
      case TokenType.PLUS: return "+";
      case TokenType.MINUS: return "-";
      case TokenType.STAR: return "*";
      case TokenType.SLASH: return "/";
      case TokenType.PERCENT: return "%";
      case TokenType.CONCAT: return "++";
      case TokenType.EQEQ: return "==";
      case TokenType.NEQ: return "!=";
      case TokenType.LT: return "<";
      case TokenType.GT: return ">";
      case TokenType.LTE: return "<=";
      case TokenType.GTE: return ">=";
      default: return "";
    }
  }

  /**
   * Generate indentation string for current level
   */
  private indent(ctx: FormatContext): string {
    return " ".repeat(ctx.indentLevel * ctx.options.indentSize);
  }

  /**
   * Create a new context with increased indentation
   */
  private increaseIndent(ctx: FormatContext): FormatContext {
    return {
      ...ctx,
      indentLevel: ctx.indentLevel + 1,
    };
  }
}

/**
 * Format Lea source code
 *
 * @param program - The parsed AST program
 * @param options - Formatting options
 * @returns Formatted source code
 */
export function format(program: Program, options: Partial<FormatterOptions> = {}): string {
  const formatter = new Formatter(options);
  return formatter.format(program);
}

/**
 * Document Analyzer for Lea Language Server
 *
 * This module analyzes Lea source files to extract symbols, references,
 * and diagnostic information for IDE features.
 */

import { Lexer } from "../lexer";
import { Parser } from "../parser";
import { Token, TokenType } from "../token";
import {
  Program,
  Stmt,
  Expr,
  LetStmt,
  AndStmt,
  ExprStmt,
  ContextDefStmt,
  ProvideStmt,
  CodeblockStmt,
  AssignStmt,
  FunctionExpr,
  CallExpr,
  Identifier,
  PipeExpr,
  SpreadPipeExpr,
  ParallelPipeExpr,
  BinaryExpr,
  UnaryExpr,
  ListExpr,
  RecordExpr,
  MemberExpr,
  IndexExpr,
  TernaryExpr,
  MatchExpr,
  AwaitExpr,
  ReturnExpr,
  PipelineLiteral,
  BidirectionalPipelineLiteral,
  ReactivePipeExpr,
  UseExpr,
  BlockBody,
  TemplateStringExpr,
} from "../ast";
import { LexerError } from "../lexer";
import { ParseError } from "../parser/types";
import { RuntimeError } from "../interpreter/types";
import {
  DocumentAnalysis,
  LeaSymbol,
  SymbolKind,
  SourceLocation,
  SymbolReference,
  Scope,
  ImportInfo,
  DiagnosticError,
  FunctionParam,
} from "./types";
import { isBuiltin, getBuiltinNames } from "./builtins-docs";

/**
 * Analyzes a Lea document and extracts symbols, references, and diagnostics
 */
export class DocumentAnalyzer {
  private uri: string;
  private version: number;
  private source: string;
  private tokens: Token[] = [];
  private symbols: Map<string, LeaSymbol> = new Map();
  private references: SymbolReference[] = [];
  private scopes: Scope[] = [];
  private errors: DiagnosticError[] = [];
  private imports: ImportInfo[] = [];
  private currentScope: Scope | null = null;
  private tokenIndex: Map<string, Token[]> = new Map(); // name -> tokens at that position

  constructor(uri: string, source: string, version: number = 0) {
    this.uri = uri;
    this.source = source;
    this.version = version;
  }

  /**
   * Analyze the document and return analysis results
   */
  analyze(): DocumentAnalysis {
    // Reset state
    this.symbols.clear();
    this.references = [];
    this.scopes = [];
    this.errors = [];
    this.imports = [];
    this.tokenIndex.clear();

    // Register builtins as symbols
    this.registerBuiltins();

    try {
      // Tokenize
      const lexer = new Lexer(this.source);
      this.tokens = lexer.scanTokens();

      // Build token index for position lookups
      this.buildTokenIndex();

      // Parse
      const parser = new Parser(this.tokens);
      const program = parser.parse();

      // Create global scope
      this.currentScope = {
        start: { line: 0, column: 0 },
        end: { line: this.getLineCount(), column: 0 },
        symbols: new Map(),
      };
      this.scopes.push(this.currentScope);

      // Analyze AST
      this.analyzeProgram(program);
    } catch (error) {
      if (error instanceof LexerError) {
        this.errors.push({
          message: error.message,
          location: {
            line: error.line - 1, // Convert to 0-indexed
            column: error.column - 1,
          },
          severity: "error",
          code: "lexer-error",
        });
      } else if (error instanceof ParseError) {
        this.errors.push({
          message: error.message,
          location: {
            line: (error.token?.line ?? 1) - 1,
            column: (error.token?.column ?? 1) - 1,
          },
          severity: "error",
          code: "parse-error",
        });
      } else {
        // Unknown error
        this.errors.push({
          message: String(error),
          location: { line: 0, column: 0 },
          severity: "error",
          code: "unknown-error",
        });
      }
    }

    return {
      uri: this.uri,
      version: this.version,
      symbols: this.symbols,
      references: this.references,
      scopes: this.scopes,
      errors: this.errors,
      imports: this.imports,
    };
  }

  /**
   * Get the line count of the source
   */
  private getLineCount(): number {
    return this.source.split("\n").length;
  }

  /**
   * Build an index of tokens by their lexeme for quick lookup
   */
  private buildTokenIndex(): void {
    for (const token of this.tokens) {
      if (token.type === TokenType.IDENTIFIER) {
        const existing = this.tokenIndex.get(token.lexeme) || [];
        existing.push(token);
        this.tokenIndex.set(token.lexeme, existing);
      }
    }
  }

  /**
   * Register built-in functions as symbols
   */
  private registerBuiltins(): void {
    for (const name of getBuiltinNames()) {
      this.symbols.set(name, {
        name,
        kind: SymbolKind.Builtin,
        location: { line: 0, column: 0 },
      });
    }

    // Add Pipeline namespace
    this.symbols.set("Pipeline", {
      name: "Pipeline",
      kind: SymbolKind.Module,
      location: { line: 0, column: 0 },
      documentation: "Pipeline utilities and static methods",
    });
  }

  /**
   * Analyze the program AST
   */
  private analyzeProgram(program: Program): void {
    for (const stmt of program.statements) {
      this.analyzeStatement(stmt);
    }
  }

  /**
   * Analyze a statement
   */
  private analyzeStatement(stmt: Stmt): void {
    switch (stmt.kind) {
      case "LetStmt":
        this.analyzeLetStatement(stmt);
        break;
      case "AndStmt":
        this.analyzeAndStatement(stmt);
        break;
      case "ExprStmt":
        this.analyzeExpression(stmt.expression);
        break;
      case "ContextDefStmt":
        this.analyzeContextDef(stmt);
        break;
      case "ProvideStmt":
        this.analyzeProvide(stmt);
        break;
      case "CodeblockStmt":
        this.analyzeCodeblock(stmt);
        break;
      case "AssignStmt":
        this.analyzeAssignment(stmt);
        break;
    }
  }

  /**
   * Analyze a let statement
   */
  private analyzeLetStatement(stmt: LetStmt): void {
    // Get location from the first token with this name
    const location = this.findTokenLocation(stmt.name) || { line: 0, column: 0 };

    // Determine the symbol kind
    let kind: SymbolKind = SymbolKind.Variable;
    let params: FunctionParam[] | undefined;
    let typeStr: string | undefined;

    if (stmt.value.kind === "FunctionExpr") {
      kind = SymbolKind.Function;
      const fn = stmt.value as FunctionExpr;
      params = fn.params.map((p) => ({
        name: p.name,
        type: p.typeAnnotation,
        defaultValue: p.defaultValue ? this.exprToString(p.defaultValue) : undefined,
      }));
      if (fn.typeSignature) {
        typeStr = this.typeSignatureToString(fn.typeSignature);
      }
    } else if (stmt.value.kind === "PipelineLiteral" || stmt.value.kind === "BidirectionalPipelineLiteral") {
      kind = SymbolKind.Pipeline;
    }

    // Handle destructuring patterns
    if (stmt.pattern) {
      if (stmt.pattern.kind === "RecordPattern") {
        for (const fieldName of stmt.pattern.fields) {
          const fieldLocation = this.findTokenLocation(fieldName) || location;
          const symbol: LeaSymbol = {
            name: fieldName,
            kind: SymbolKind.Variable,
            location: fieldLocation,
            mutable: stmt.mutable,
            definitionLocation: fieldLocation,
          };
          this.addSymbol(symbol);
        }
      } else if (stmt.pattern.kind === "TuplePattern") {
        for (const name of stmt.pattern.names) {
          const nameLocation = this.findTokenLocation(name) || location;
          const symbol: LeaSymbol = {
            name,
            kind: SymbolKind.Variable,
            location: nameLocation,
            mutable: stmt.mutable,
            definitionLocation: nameLocation,
          };
          this.addSymbol(symbol);
        }
      }
    } else {
      // Regular let binding
      const symbol: LeaSymbol = {
        name: stmt.name,
        kind,
        location,
        mutable: stmt.mutable,
        params,
        type: typeStr,
        decorators: stmt.decorators,
        exported: stmt.decorators?.some((d) => d.name === "export"),
        definitionLocation: location,
      };

      if (stmt.value.kind === "FunctionExpr") {
        const fn = stmt.value as FunctionExpr;
        symbol.typeSignature = fn.typeSignature;
      }

      this.addSymbol(symbol);
    }

    // Analyze the value expression
    this.analyzeExpression(stmt.value);
  }

  /**
   * Analyze an and statement (function overload or reverse)
   */
  private analyzeAndStatement(stmt: AndStmt): void {
    // Add a reference to the existing function
    const location = this.findTokenLocation(stmt.name) || { line: 0, column: 0 };
    this.addReference(stmt.name, location, false);

    // Analyze the value
    this.analyzeExpression(stmt.value);
  }

  /**
   * Analyze a context definition
   */
  private analyzeContextDef(stmt: ContextDefStmt): void {
    const location = this.findTokenLocation(stmt.name) || { line: 0, column: 0 };
    const symbol: LeaSymbol = {
      name: stmt.name,
      kind: SymbolKind.Context,
      location,
      definitionLocation: location,
    };
    this.addSymbol(symbol);
    this.analyzeExpression(stmt.defaultValue);
  }

  /**
   * Analyze a provide statement
   */
  private analyzeProvide(stmt: ProvideStmt): void {
    const location = this.findTokenLocation(stmt.contextName) || { line: 0, column: 0 };
    this.addReference(stmt.contextName, location, false);
    this.analyzeExpression(stmt.value);
  }

  /**
   * Analyze a codeblock statement
   */
  private analyzeCodeblock(stmt: CodeblockStmt): void {
    for (const innerStmt of stmt.statements) {
      this.analyzeStatement(innerStmt);
    }
  }

  /**
   * Analyze an assignment statement
   */
  private analyzeAssignment(stmt: AssignStmt): void {
    const location = this.findTokenLocation(stmt.name) || { line: 0, column: 0 };
    this.addReference(stmt.name, location, false);

    // Check if the variable is mutable
    const symbol = this.symbols.get(stmt.name);
    if (symbol && !symbol.mutable && symbol.kind !== SymbolKind.Builtin) {
      this.errors.push({
        message: `Cannot reassign immutable variable '${stmt.name}'. Use 'maybe' to declare mutable variables.`,
        location,
        severity: "error",
        code: "immutable-reassign",
      });
    }

    this.analyzeExpression(stmt.value);
  }

  /**
   * Analyze an expression
   */
  private analyzeExpression(expr: Expr): void {
    switch (expr.kind) {
      case "Identifier":
        this.analyzeIdentifier(expr);
        break;
      case "FunctionExpr":
        this.analyzeFunctionExpr(expr);
        break;
      case "CallExpr":
        this.analyzeCallExpr(expr);
        break;
      case "PipeExpr":
        this.analyzePipeExpr(expr);
        break;
      case "SpreadPipeExpr":
        this.analyzeSpreadPipeExpr(expr);
        break;
      case "ParallelPipeExpr":
        this.analyzeParallelPipeExpr(expr);
        break;
      case "BinaryExpr":
        this.analyzeBinaryExpr(expr);
        break;
      case "UnaryExpr":
        this.analyzeUnaryExpr(expr);
        break;
      case "ListExpr":
        this.analyzeListExpr(expr);
        break;
      case "RecordExpr":
        this.analyzeRecordExpr(expr);
        break;
      case "MemberExpr":
        this.analyzeMemberExpr(expr);
        break;
      case "IndexExpr":
        this.analyzeIndexExpr(expr);
        break;
      case "TernaryExpr":
        this.analyzeTernaryExpr(expr);
        break;
      case "MatchExpr":
        this.analyzeMatchExpr(expr);
        break;
      case "AwaitExpr":
        this.analyzeAwaitExpr(expr);
        break;
      case "ReturnExpr":
        this.analyzeReturnExpr(expr);
        break;
      case "PipelineLiteral":
        this.analyzePipelineLiteral(expr);
        break;
      case "BidirectionalPipelineLiteral":
        this.analyzeBidirectionalPipelineLiteral(expr);
        break;
      case "ReactivePipeExpr":
        this.analyzeReactivePipeExpr(expr);
        break;
      case "UseExpr":
        this.analyzeUseExpr(expr);
        break;
      case "TemplateStringExpr":
        this.analyzeTemplateStringExpr(expr);
        break;
      case "ReversePipeExpr":
        this.analyzeExpression(expr.left);
        this.analyzeExpression(expr.right);
        break;
      case "TupleExpr":
        for (const element of expr.elements) {
          this.analyzeExpression(element);
        }
        break;
    }
  }

  /**
   * Analyze an identifier
   */
  private analyzeIdentifier(expr: Identifier): void {
    const location = this.findTokenLocation(expr.name) || { line: 0, column: 0 };

    // Check if it's a known symbol
    const symbol = this.symbols.get(expr.name);
    if (symbol) {
      this.addReference(expr.name, location, false, symbol.definitionLocation);
    } else if (!["input", "true", "false", "null"].includes(expr.name)) {
      // Unknown identifier - might be an error, but could also be forward reference
      this.addReference(expr.name, location, false);
    }
  }

  /**
   * Analyze a function expression
   */
  private analyzeFunctionExpr(expr: FunctionExpr): void {
    // Create a new scope for the function
    const parentScope = this.currentScope;
    const fnScope: Scope = {
      start: { line: 0, column: 0 }, // Would need proper location tracking
      end: { line: 0, column: 0 },
      parent: parentScope ?? undefined,
      symbols: new Map(),
    };
    this.scopes.push(fnScope);
    this.currentScope = fnScope;

    // Add parameters as symbols in the function scope
    for (const param of expr.params) {
      if (param.name !== "_") {
        const paramSymbol: LeaSymbol = {
          name: param.name,
          kind: SymbolKind.Parameter,
          location: { line: 0, column: 0 },
          type: param.typeAnnotation,
        };
        fnScope.symbols.set(param.name, paramSymbol);
      }

      // Analyze default value if present
      if (param.defaultValue) {
        this.analyzeExpression(param.defaultValue);
      }
    }

    // Add attachments as context references
    for (const attachment of expr.attachments) {
      this.addReference(attachment, { line: 0, column: 0 }, false);
    }

    // Analyze the body
    if (expr.body.kind === "BlockBody") {
      const block = expr.body as BlockBody;
      for (const stmt of block.statements) {
        this.analyzeStatement(stmt);
      }
      this.analyzeExpression(block.result);
    } else {
      this.analyzeExpression(expr.body as Expr);
    }

    // Restore parent scope
    this.currentScope = parentScope;
  }

  /**
   * Analyze a call expression
   */
  private analyzeCallExpr(expr: CallExpr): void {
    this.analyzeExpression(expr.callee);
    for (const arg of expr.args) {
      this.analyzeExpression(arg);
    }
  }

  /**
   * Analyze a pipe expression
   */
  private analyzePipeExpr(expr: PipeExpr): void {
    this.analyzeExpression(expr.left);
    this.analyzeExpression(expr.right);
  }

  /**
   * Analyze a spread pipe expression
   */
  private analyzeSpreadPipeExpr(expr: SpreadPipeExpr): void {
    this.analyzeExpression(expr.left);
    this.analyzeExpression(expr.right);
  }

  /**
   * Analyze a parallel pipe expression
   */
  private analyzeParallelPipeExpr(expr: ParallelPipeExpr): void {
    this.analyzeExpression(expr.input);
    for (const branch of expr.branches) {
      this.analyzeExpression(branch);
    }
  }

  /**
   * Analyze a binary expression
   */
  private analyzeBinaryExpr(expr: BinaryExpr): void {
    this.analyzeExpression(expr.left);
    this.analyzeExpression(expr.right);
  }

  /**
   * Analyze a unary expression
   */
  private analyzeUnaryExpr(expr: UnaryExpr): void {
    this.analyzeExpression(expr.operand);
  }

  /**
   * Analyze a list expression
   */
  private analyzeListExpr(expr: ListExpr): void {
    for (const element of expr.elements) {
      this.analyzeExpression(element.value);
    }
  }

  /**
   * Analyze a record expression
   */
  private analyzeRecordExpr(expr: RecordExpr): void {
    for (const field of expr.fields) {
      this.analyzeExpression(field.value);
    }
  }

  /**
   * Analyze a member expression
   */
  private analyzeMemberExpr(expr: MemberExpr): void {
    this.analyzeExpression(expr.object);
  }

  /**
   * Analyze an index expression
   */
  private analyzeIndexExpr(expr: IndexExpr): void {
    this.analyzeExpression(expr.object);
    this.analyzeExpression(expr.index);
  }

  /**
   * Analyze a ternary expression
   */
  private analyzeTernaryExpr(expr: TernaryExpr): void {
    this.analyzeExpression(expr.condition);
    this.analyzeExpression(expr.thenBranch);
    this.analyzeExpression(expr.elseBranch);
  }

  /**
   * Analyze a match expression
   */
  private analyzeMatchExpr(expr: MatchExpr): void {
    this.analyzeExpression(expr.value);
    for (const matchCase of expr.cases) {
      if (matchCase.pattern) {
        this.analyzeExpression(matchCase.pattern);
      }
      if (matchCase.guard) {
        this.analyzeExpression(matchCase.guard);
      }
      this.analyzeExpression(matchCase.body);
    }
  }

  /**
   * Analyze an await expression
   */
  private analyzeAwaitExpr(expr: AwaitExpr): void {
    this.analyzeExpression(expr.operand);
  }

  /**
   * Analyze a return expression
   */
  private analyzeReturnExpr(expr: ReturnExpr): void {
    this.analyzeExpression(expr.value);
  }

  /**
   * Analyze a pipeline literal
   */
  private analyzePipelineLiteral(expr: PipelineLiteral): void {
    for (const stage of expr.stages) {
      if (stage.isParallel) {
        for (const branch of stage.branches) {
          this.analyzeExpression(branch);
        }
      } else {
        this.analyzeExpression(stage.expr);
      }
    }
  }

  /**
   * Analyze a bidirectional pipeline literal
   */
  private analyzeBidirectionalPipelineLiteral(expr: BidirectionalPipelineLiteral): void {
    for (const stage of expr.stages) {
      this.analyzeExpression(stage.expr);
    }
  }

  /**
   * Analyze a reactive pipe expression
   */
  private analyzeReactivePipeExpr(expr: ReactivePipeExpr): void {
    this.analyzeExpression(expr.source);
    for (const stage of expr.stages) {
      if (stage.isParallel) {
        for (const branch of stage.branches) {
          this.analyzeExpression(branch);
        }
      } else {
        this.analyzeExpression(stage.expr);
      }
    }
  }

  /**
   * Analyze a use expression (import)
   */
  private analyzeUseExpr(expr: UseExpr): void {
    const location = { line: 0, column: 0 }; // Would need proper location
    this.imports.push({
      path: expr.path,
      location,
      importedNames: [],
      isReexport: false,
    });
  }

  /**
   * Analyze a template string expression
   */
  private analyzeTemplateStringExpr(expr: TemplateStringExpr): void {
    for (const part of expr.parts) {
      if (typeof part !== "string") {
        this.analyzeExpression(part);
      }
    }
  }

  /**
   * Add a symbol to the symbol table
   */
  private addSymbol(symbol: LeaSymbol): void {
    // Check for duplicate definitions (excluding builtins)
    const existing = this.symbols.get(symbol.name);
    if (existing && existing.kind !== SymbolKind.Builtin) {
      // Allow overloads via 'and' keyword, but warn on direct redefinition
      // For now, just update the symbol
    }
    this.symbols.set(symbol.name, symbol);

    // Also add to current scope
    if (this.currentScope) {
      this.currentScope.symbols.set(symbol.name, symbol);
    }
  }

  /**
   * Add a reference to a symbol
   */
  private addReference(
    name: string,
    location: SourceLocation,
    isDefinition: boolean,
    definitionLocation?: SourceLocation
  ): void {
    this.references.push({
      name,
      location,
      isDefinition,
      definitionLocation,
    });
  }

  /**
   * Find the location of a token by its lexeme
   */
  private findTokenLocation(name: string): SourceLocation | null {
    const tokens = this.tokenIndex.get(name);
    if (tokens && tokens.length > 0) {
      const token = tokens[0];
      return {
        line: token.line - 1, // Convert to 0-indexed
        column: token.column - 1,
      };
    }
    return null;
  }

  /**
   * Convert an expression to a string representation (for display)
   */
  private exprToString(expr: Expr): string {
    switch (expr.kind) {
      case "NumberLiteral":
        return String(expr.value);
      case "StringLiteral":
        return `"${expr.value}"`;
      case "BooleanLiteral":
        return String(expr.value);
      case "Identifier":
        return expr.name;
      default:
        return "<expr>";
    }
  }

  /**
   * Convert a type signature to a string representation
   */
  private typeSignatureToString(sig: {
    paramTypes: (string | { tuple: string[]; optional?: boolean } | { list: string; optional?: boolean })[];
    returnType?: string | { tuple: string[] } | { list: string };
  }): string {
    const params = sig.paramTypes
      .map((p) => {
        if (typeof p === "string") return p;
        if ("tuple" in p) return `(${p.tuple.join(", ")})`;
        if ("list" in p) return `[${p.list}]`;
        return "any";
      })
      .join(", ");

    const ret = sig.returnType
      ? typeof sig.returnType === "string"
        ? sig.returnType
        : "tuple" in sig.returnType
          ? `(${sig.returnType.tuple.join(", ")})`
          : `[${sig.returnType.list}]`
      : "any";

    return `(${params}) -> ${ret}`;
  }

  /**
   * Get the symbol at a specific position
   */
  getSymbolAtPosition(line: number, column: number): LeaSymbol | null {
    // Find the token at this position
    for (const token of this.tokens) {
      if (
        token.line - 1 === line &&
        token.column - 1 <= column &&
        token.column - 1 + token.lexeme.length > column
      ) {
        if (token.type === TokenType.IDENTIFIER) {
          return this.symbols.get(token.lexeme) || null;
        }
      }
    }
    return null;
  }

  /**
   * Get the token at a specific position
   */
  getTokenAtPosition(line: number, column: number): Token | null {
    for (const token of this.tokens) {
      if (
        token.line - 1 === line &&
        token.column - 1 <= column &&
        token.column - 1 + token.lexeme.length > column
      ) {
        return token;
      }
    }
    return null;
  }

  /**
   * Get all symbols in scope at a position
   */
  getSymbolsInScope(line: number, column: number): LeaSymbol[] {
    const result: LeaSymbol[] = [];

    // Add all global symbols (including builtins)
    for (const symbol of this.symbols.values()) {
      result.push(symbol);
    }

    // Add symbols from enclosing scopes
    for (const scope of this.scopes) {
      for (const symbol of scope.symbols.values()) {
        if (!result.find((s) => s.name === symbol.name)) {
          result.push(symbol);
        }
      }
    }

    return result;
  }
}

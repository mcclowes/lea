/**
 * Completion Provider for Lea Language Server
 *
 * Provides autocomplete suggestions for Lea code.
 */

import { TokenType, KEYWORDS } from "../token";
import { DocumentAnalyzer } from "./analyzer";
import {
  LeaCompletionItem,
  CompletionItemKind,
  LeaSymbol,
  SymbolKind,
} from "./types";
import { BUILTIN_DOCS, getBuiltinNames, getBuiltinDoc } from "./builtins-docs";

/**
 * Lea keywords with descriptions
 */
const KEYWORD_INFO: Record<string, { description: string; insertText?: string }> = {
  let: { description: "Declare an immutable binding", insertText: "let $1 = $0" },
  maybe: { description: "Declare a mutable binding", insertText: "maybe $1 = $0" },
  and: { description: "Add function overload or reverse definition" },
  true: { description: "Boolean true value" },
  false: { description: "Boolean false value" },
  await: { description: "Await an async operation", insertText: "await $0" },
  context: { description: "Define a context for dependency injection", insertText: "context $1 = $0" },
  provide: { description: "Provide a context value", insertText: "provide $1 $0" },
  match: { description: "Pattern matching expression", insertText: "match $1\n  | $0" },
  if: { description: "Guard condition in pattern matching" },
  return: { description: "Early return from a function", insertText: "return $0" },
  input: { description: "Placeholder for the matched value in pattern matching" },
  use: { description: "Import a module", insertText: 'use "./$0"' },
};

/**
 * Common decorators with descriptions
 */
const DECORATOR_INFO: Record<string, { description: string; hasArgs?: boolean }> = {
  log: { description: "Log function inputs and outputs" },
  log_verbose: { description: "Detailed logging with parameters, types, timing, and return values" },
  memo: { description: "Memoize function results" },
  time: { description: "Log execution time" },
  retry: { description: "Retry on failure up to n times", hasArgs: true },
  timeout: { description: "Fail if execution exceeds time (async only)", hasArgs: true },
  validate: { description: "Runtime type checking and null checks" },
  pure: { description: "Warn if side effects detected" },
  async: { description: "Mark function as async" },
  trace: { description: "Deep logging with call depth" },
  coerce: { description: "Coerce inputs to specified type", hasArgs: true },
  parse: { description: "Auto-parse string inputs as JSON or numbers" },
  stringify: { description: "Convert output to string representation" },
  tease: { description: "Best-effort coercion of output", hasArgs: true },
  export: { description: "Export this binding from the module" },
  debug: { description: "Detailed stage-by-stage execution logging (pipelines)" },
  profile: { description: "Timing breakdown for each stage (pipelines)" },
  tap: { description: "Inspect output without modifying (pipelines)", hasArgs: true },
  strict: { description: "Enable strict type checking for the file" },
};

/**
 * Pipeline properties and methods
 */
const PIPELINE_PROPERTIES: Record<string, { description: string; type: string }> = {
  length: { description: "Number of stages in the pipeline", type: "Int" },
  stages: { description: "List of stage names", type: "[String]" },
  first: { description: "First stage as a callable function", type: "Function" },
  last: { description: "Last stage as a callable function", type: "Function" },
};

const PIPELINE_METHODS: Record<string, { description: string; signature: string }> = {
  visualize: { description: "Print ASCII diagram of the pipeline", signature: "() -> void" },
  isEmpty: { description: "Check if pipeline has no stages", signature: "() -> Bool" },
  equals: { description: "Structural equality comparison", signature: "(other: Pipeline) -> Bool" },
  at: { description: "Get stage at index as callable function", signature: "(index: Int) -> Function" },
  prepend: { description: "Add stage at start", signature: "(fn: Function) -> Pipeline" },
  append: { description: "Add stage at end", signature: "(fn: Function) -> Pipeline" },
  reverse: { description: "Reverse stage order", signature: "() -> Pipeline" },
  slice: { description: "Extract sub-pipeline", signature: "(start: Int, end?: Int) -> Pipeline" },
  without: { description: "Remove stages appearing in other pipeline", signature: "(other: Pipeline) -> Pipeline" },
  intersection: { description: "Keep only stages common to both", signature: "(other: Pipeline) -> Pipeline" },
  union: { description: "Combine all stages (deduplicated)", signature: "(other: Pipeline) -> Pipeline" },
  difference: { description: "Stages in this but not in other", signature: "(other: Pipeline) -> Pipeline" },
  concat: { description: "Concatenate pipelines (preserves duplicates)", signature: "(other: Pipeline) -> Pipeline" },
};

/**
 * Pipeline static methods
 */
const PIPELINE_STATIC: Record<string, { description: string; signature: string }> = {
  identity: { description: "No-op pipeline, passes values through unchanged", signature: "Pipeline" },
  empty: { description: "Pipeline with zero stages", signature: "Pipeline" },
  from: { description: "Create pipeline from list of functions", signature: "(fns: [Function]) -> Pipeline" },
};

/**
 * Provides completion items for Lea code
 */
export class CompletionProvider {
  /**
   * Get completion items at a position in the document
   */
  getCompletions(
    analyzer: DocumentAnalyzer,
    line: number,
    column: number,
    triggerCharacter?: string
  ): LeaCompletionItem[] {
    const items: LeaCompletionItem[] = [];

    // Handle specific trigger characters
    if (triggerCharacter === "#") {
      return this.getDecoratorCompletions();
    }

    if (triggerCharacter === ".") {
      return this.getMemberCompletions(analyzer, line, column);
    }

    if (triggerCharacter === "@") {
      return this.getContextCompletions(analyzer);
    }

    // Get general completions
    items.push(...this.getKeywordCompletions());
    items.push(...this.getBuiltinCompletions());
    items.push(...this.getUserDefinedCompletions(analyzer, line, column));
    items.push(...this.getSnippetCompletions());

    return items;
  }

  /**
   * Get keyword completions
   */
  private getKeywordCompletions(): LeaCompletionItem[] {
    const items: LeaCompletionItem[] = [];

    for (const [keyword, info] of Object.entries(KEYWORD_INFO)) {
      items.push({
        label: keyword,
        kind: CompletionItemKind.Keyword,
        detail: "keyword",
        documentation: info.description,
        insertText: info.insertText,
        sortText: `1_${keyword}`,
      });
    }

    return items;
  }

  /**
   * Get decorator completions (triggered by #)
   */
  private getDecoratorCompletions(): LeaCompletionItem[] {
    const items: LeaCompletionItem[] = [];

    for (const [name, info] of Object.entries(DECORATOR_INFO)) {
      items.push({
        label: name,
        kind: CompletionItemKind.Decorator,
        detail: "decorator",
        documentation: info.description,
        insertText: info.hasArgs ? `${name}($1)` : name,
        sortText: `0_${name}`,
      });
    }

    return items;
  }

  /**
   * Get builtin function completions
   */
  private getBuiltinCompletions(): LeaCompletionItem[] {
    const items: LeaCompletionItem[] = [];

    for (const name of getBuiltinNames()) {
      const doc = getBuiltinDoc(name);
      if (!doc) continue;

      items.push({
        label: name,
        kind: CompletionItemKind.Builtin,
        detail: doc.signature,
        documentation: this.formatBuiltinDoc(doc),
        insertText: this.getBuiltinInsertText(name, doc),
        sortText: `2_${name}`,
      });
    }

    // Add Pipeline static methods
    items.push({
      label: "Pipeline",
      kind: CompletionItemKind.Module,
      detail: "Pipeline utilities",
      documentation: "Pipeline namespace with static methods like `Pipeline.identity`, `Pipeline.from`, etc.",
      sortText: "2_Pipeline",
    });

    return items;
  }

  /**
   * Get user-defined symbol completions
   */
  private getUserDefinedCompletions(
    analyzer: DocumentAnalyzer,
    line: number,
    column: number
  ): LeaCompletionItem[] {
    const items: LeaCompletionItem[] = [];
    const analysis = analyzer.analyze();

    for (const [name, symbol] of analysis.symbols) {
      // Skip builtins (already added)
      if (symbol.kind === SymbolKind.Builtin) continue;

      const item = this.symbolToCompletionItem(symbol);
      if (item) {
        items.push(item);
      }
    }

    return items;
  }

  /**
   * Get member completions (triggered by .)
   */
  private getMemberCompletions(
    analyzer: DocumentAnalyzer,
    line: number,
    column: number
  ): LeaCompletionItem[] {
    const items: LeaCompletionItem[] = [];

    // Check if we're accessing Pipeline static methods
    const token = analyzer.getTokenAtPosition(line, column - 2);
    if (token && token.lexeme === "Pipeline") {
      for (const [name, info] of Object.entries(PIPELINE_STATIC)) {
        items.push({
          label: name,
          kind: CompletionItemKind.Property,
          detail: info.signature,
          documentation: info.description,
          sortText: `0_${name}`,
        });
      }
      return items;
    }

    // Check if the object is a pipeline (has pipeline type)
    const symbol = analyzer.getSymbolAtPosition(line, column - 2);
    if (symbol && symbol.kind === SymbolKind.Pipeline) {
      // Add pipeline properties
      for (const [name, info] of Object.entries(PIPELINE_PROPERTIES)) {
        items.push({
          label: name,
          kind: CompletionItemKind.Property,
          detail: info.type,
          documentation: info.description,
          sortText: `0_${name}`,
        });
      }

      // Add pipeline methods
      for (const [name, info] of Object.entries(PIPELINE_METHODS)) {
        items.push({
          label: name,
          kind: CompletionItemKind.Function,
          detail: info.signature,
          documentation: info.description,
          insertText: `${name}($1)`,
          sortText: `1_${name}`,
        });
      }
    }

    // For records, we'd need type information which requires more analysis
    // For now, just return empty if we don't recognize the type

    return items;
  }

  /**
   * Get context completions (triggered by @)
   */
  private getContextCompletions(analyzer: DocumentAnalyzer): LeaCompletionItem[] {
    const items: LeaCompletionItem[] = [];
    const analysis = analyzer.analyze();

    for (const [name, symbol] of analysis.symbols) {
      if (symbol.kind === SymbolKind.Context) {
        items.push({
          label: name,
          kind: CompletionItemKind.Variable,
          detail: "context",
          documentation: `Context: ${name}`,
          sortText: `0_${name}`,
        });
      }
    }

    return items;
  }

  /**
   * Get snippet completions
   */
  private getSnippetCompletions(): LeaCompletionItem[] {
    return [
      {
        label: "fn",
        kind: CompletionItemKind.Snippet,
        detail: "Function definition",
        documentation: "Create a new function",
        insertText: "let $1 = ($2) -> $0",
        sortText: "3_fn",
      },
      {
        label: "fntyped",
        kind: CompletionItemKind.Snippet,
        detail: "Typed function definition",
        documentation: "Create a new function with type annotations",
        insertText: "let $1 = ($2) -> $3 :: $4 :> $0",
        sortText: "3_fntyped",
      },
      {
        label: "pipe",
        kind: CompletionItemKind.Snippet,
        detail: "Pipeline definition",
        documentation: "Create a new pipeline",
        insertText: "let $1 = /> $0",
        sortText: "3_pipe",
      },
      {
        label: "match",
        kind: CompletionItemKind.Snippet,
        detail: "Match expression",
        documentation: "Create a match expression",
        insertText: "match $1\n  | $2 -> $3\n  | $0",
        sortText: "3_match",
      },
      {
        label: "async",
        kind: CompletionItemKind.Snippet,
        detail: "Async function",
        documentation: "Create an async function",
        insertText: "let $1 = ($2) -> $3 #async",
        sortText: "3_async",
      },
      {
        label: "ctx",
        kind: CompletionItemKind.Snippet,
        detail: "Context definition",
        documentation: "Define a context for dependency injection",
        insertText: "context $1 = $0",
        sortText: "3_ctx",
      },
      {
        label: "import",
        kind: CompletionItemKind.Snippet,
        detail: "Module import",
        documentation: "Import from a module",
        insertText: 'let { $1 } = use "./$0"',
        sortText: "3_import",
      },
    ];
  }

  /**
   * Convert a symbol to a completion item
   */
  private symbolToCompletionItem(symbol: LeaSymbol): LeaCompletionItem | null {
    let kind: CompletionItemKind;
    let detail: string;
    let insertText: string | undefined;

    switch (symbol.kind) {
      case SymbolKind.Function:
        kind = CompletionItemKind.Function;
        detail = symbol.type || "function";
        if (symbol.params && symbol.params.length > 0) {
          insertText = `${symbol.name}($1)`;
        }
        break;
      case SymbolKind.Variable:
        kind = CompletionItemKind.Variable;
        detail = symbol.mutable ? "maybe" : "let";
        break;
      case SymbolKind.Parameter:
        kind = CompletionItemKind.Variable;
        detail = "parameter";
        break;
      case SymbolKind.Context:
        kind = CompletionItemKind.Variable;
        detail = "context";
        break;
      case SymbolKind.Pipeline:
        kind = CompletionItemKind.Function;
        detail = "pipeline";
        break;
      default:
        return null;
    }

    return {
      label: symbol.name,
      kind,
      detail,
      documentation: symbol.documentation,
      insertText,
      sortText: `4_${symbol.name}`,
    };
  }

  /**
   * Format builtin documentation for display
   */
  private formatBuiltinDoc(doc: {
    description: string;
    params: { name: string; type: string; description: string }[];
    returns: { type: string; description: string };
    examples?: string[];
  }): string {
    let md = doc.description + "\n\n";

    if (doc.params.length > 0) {
      md += "**Parameters:**\n";
      for (const param of doc.params) {
        md += `- \`${param.name}\` (${param.type}): ${param.description}\n`;
      }
      md += "\n";
    }

    md += `**Returns:** ${doc.returns.type} - ${doc.returns.description}\n`;

    if (doc.examples && doc.examples.length > 0) {
      md += "\n**Examples:**\n```lea\n";
      md += doc.examples.join("\n");
      md += "\n```";
    }

    return md;
  }

  /**
   * Get insert text for a builtin function
   */
  private getBuiltinInsertText(name: string, doc: { params: { name: string }[] }): string | undefined {
    if (doc.params.length === 0) {
      return `${name}()`;
    }
    return `${name}($1)`;
  }
}

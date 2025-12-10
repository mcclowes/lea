/**
 * Hover Provider for Lea Language Server
 *
 * Provides hover information for Lea code elements.
 */

import { Token, TokenType, KEYWORDS } from "../token";
import { DocumentAnalyzer } from "./analyzer";
import { HoverInfo, LeaSymbol, SymbolKind, SourceLocation } from "./types";
import { BUILTIN_DOCS, getBuiltinDoc, isBuiltin } from "./builtins-docs";

/**
 * Documentation for Lea keywords
 */
const KEYWORD_DOCS: Record<string, string> = {
  let: `**let** - Immutable Binding

Declares a new immutable variable that cannot be reassigned.

\`\`\`lea
let x = 10
let double = (n) -> n * 2
\`\`\``,

  maybe: `**maybe** - Mutable Binding

Declares a mutable variable that can be reassigned.

\`\`\`lea
maybe counter = 0
counter = counter + 1
\`\`\``,

  and: `**and** - Function Extension

Adds an overload or reverse definition to an existing function.

\`\`\`lea
-- Overloading
let add = (a, b) -> a + b :: (Int, Int) :> Int
and add = (a, b) -> a ++ b :: (String, String) :> String

-- Reversible function
let double = (x) -> x * 2
and double = (x) <- x / 2
\`\`\``,

  true: `**true** - Boolean True

Boolean literal representing true.`,

  false: `**false** - Boolean False

Boolean literal representing false.`,

  await: `**await** - Await Promise

Waits for a promise to resolve and returns its value.

\`\`\`lea
let result = await fetch("https://api.example.com")
await delay(1000)
\`\`\``,

  context: `**context** - Context Definition

Defines a context with a default value for dependency injection.

\`\`\`lea
context Logger = { log: (msg) -> print("[DEFAULT] " ++ msg) }
\`\`\``,

  provide: `**provide** - Context Override

Provides a value to override a context's default.

\`\`\`lea
provide Logger { log: (msg) -> print("[PROD] " ++ msg) }
\`\`\``,

  match: `**match** - Pattern Matching

Matches a value against patterns and guards.

\`\`\`lea
let describe = (x) -> match x
  | 0 -> "zero"
  | 1 -> "one"
  | if input < 0 -> "negative"
  | "positive"
\`\`\``,

  if: `**if** - Guard Condition

Used in match expressions to add guard conditions.

\`\`\`lea
match x
  | if input > 100 -> "big"
  | if input < 0 -> "negative"
  | "normal"
\`\`\``,

  return: `**return** - Early Return

Returns early from a function with a value.

\`\`\`lea
let clamp = (x) ->
  x > 100 ? return 100 : 0
  x < 0 ? return 0 : 0
  x
\`\`\``,

  input: `**input** - Matched Value

References the matched value in pattern matching.

\`\`\`lea
match x
  | if input > 0 -> input * 2  -- input is x
  | 0
\`\`\``,

  use: `**use** - Module Import

Imports exports from another Lea module.

\`\`\`lea
let { double, add } = use "./math"
let { helper } = use "./utils/helper"
\`\`\``,
};

/**
 * Documentation for operators
 */
const OPERATOR_DOCS: Record<string, string> = {
  "/>": `**/>** - Pipe Operator

Pipes a value into a function as the first argument.

\`\`\`lea
5 /> double        -- double(5)
5 /> add(3)        -- add(5, 3)
5 /> add(3, input) -- add(3, 5)
\`\`\``,

  "/>>>": `**/>>>** - Spread Pipe Operator

Maps a function over each element of a list.

\`\`\`lea
[1, 2, 3] />>> double         -- [2, 4, 6]
[1, 2, 3] />>> (x, i) -> x + i -- [1, 3, 5]
\`\`\``,

  "\\>": `**\\>** - Parallel Pipe Operator

Fans out to run branches concurrently.

\`\`\`lea
5 \\> addOne \\> double /> combine
\`\`\``,

  "</": `**</** - Reverse Pipe Operator

Applies a value through a function/pipeline in reverse.

\`\`\`lea
10 </ double  -- 5 (using reverse: x / 2)
\`\`\``,

  "</>": `**</>** - Bidirectional Pipeline Start

Starts a bidirectional pipeline definition.

\`\`\`lea
let transform = </> double </> addTen
5 /> transform   -- forward
20 </ transform  -- reverse
\`\`\``,

  "@>": `**@>** - Reactive Pipe Operator

Creates a reactive binding that recomputes when source changes.

\`\`\`lea
maybe source = [1, 2, 3]
let reactive = source @> map(double) /> sum
reactive.value  -- 12
\`\`\``,

  "->": `**->** - Arrow (Function Definition)

Defines a function's body.

\`\`\`lea
let double = (x) -> x * 2
\`\`\``,

  "<-": `**<-** - Reverse Arrow

Defines a reverse function body.

\`\`\`lea
and double = (x) <- x / 2
\`\`\``,

  "++": `**++** - Concatenation

Concatenates strings (with automatic type coercion).

\`\`\`lea
"Hello" ++ " World"  -- "Hello World"
"Count: " ++ 42      -- "Count: 42"
\`\`\``,

  "::": `**::** - Type Annotation Start

Begins a type annotation.

\`\`\`lea
let double = (x) -> x * 2 :: Int :> Int
let add = (a, b) -> a + b :: (Int, Int) :> Int
\`\`\``,

  ":>": `**:>** - Return Type Separator

Separates parameter types from return type.

\`\`\`lea
:: Int :> Int           -- Int -> Int
:: (Int, Int) :> Int    -- (Int, Int) -> Int
\`\`\``,
};

/**
 * Provides hover information for Lea code
 */
export class HoverProvider {
  /**
   * Get hover information at a position
   */
  getHover(
    analyzer: DocumentAnalyzer,
    line: number,
    column: number
  ): HoverInfo | null {
    const analysis = analyzer.analyze();
    const token = analyzer.getTokenAtPosition(line, column);

    if (!token) {
      return null;
    }

    // Check for keywords
    if (token.type in TokenType && KEYWORD_DOCS[token.lexeme]) {
      return {
        contents: KEYWORD_DOCS[token.lexeme],
        range: this.tokenToRange(token),
      };
    }

    // Check for operators
    const operatorDoc = OPERATOR_DOCS[token.lexeme];
    if (operatorDoc) {
      return {
        contents: operatorDoc,
        range: this.tokenToRange(token),
      };
    }

    // Check for identifiers (symbols)
    if (token.type === TokenType.IDENTIFIER) {
      // Check if it's a builtin
      if (isBuiltin(token.lexeme)) {
        const doc = getBuiltinDoc(token.lexeme);
        if (doc) {
          return {
            contents: this.formatBuiltinHover(doc),
            range: this.tokenToRange(token),
          };
        }
      }

      // Check if it's a user-defined symbol
      const symbol = analysis.symbols.get(token.lexeme);
      if (symbol) {
        return {
          contents: this.formatSymbolHover(symbol),
          range: this.tokenToRange(token),
        };
      }

      // Check for Pipeline static
      if (token.lexeme === "Pipeline") {
        return {
          contents: this.formatPipelineNamespaceHover(),
          range: this.tokenToRange(token),
        };
      }
    }

    // Check for numbers
    if (token.type === TokenType.NUMBER) {
      return {
        contents: `**Number literal**\n\nValue: \`${token.lexeme}\``,
        range: this.tokenToRange(token),
      };
    }

    // Check for strings
    if (token.type === TokenType.STRING) {
      return {
        contents: `**String literal**\n\nValue: \`${token.lexeme}\``,
        range: this.tokenToRange(token),
      };
    }

    // Check for template strings
    if (token.type === TokenType.TEMPLATE_STRING) {
      return {
        contents: `**Template string**\n\nSupports interpolation with \`{expr}\``,
        range: this.tokenToRange(token),
      };
    }

    // Check for decorators (after #)
    if (token.type === TokenType.HASH) {
      return {
        contents: `**Decorator**\n\nDecorators modify function/pipeline behavior.\n\nCommon decorators: \`#log\`, \`#memo\`, \`#time\`, \`#async\`, \`#validate\``,
        range: this.tokenToRange(token),
      };
    }

    return null;
  }

  /**
   * Convert a token to a source location range
   */
  private tokenToRange(token: Token): SourceLocation {
    return {
      line: token.line - 1,
      column: token.column - 1,
      endLine: token.line - 1,
      endColumn: token.column - 1 + token.lexeme.length,
    };
  }

  /**
   * Format builtin function hover documentation
   */
  private formatBuiltinHover(doc: {
    name: string;
    signature: string;
    description: string;
    params: { name: string; type: string; description: string }[];
    returns: { type: string; description: string };
    examples?: string[];
  }): string {
    let md = `**${doc.name}** (builtin)\n\n`;
    md += "```lea\n" + doc.signature + "\n```\n\n";
    md += doc.description + "\n\n";

    if (doc.params.length > 0) {
      md += "**Parameters:**\n";
      for (const param of doc.params) {
        md += `- \`${param.name}\` *(${param.type})*: ${param.description}\n`;
      }
      md += "\n";
    }

    md += `**Returns:** *${doc.returns.type}* - ${doc.returns.description}\n`;

    if (doc.examples && doc.examples.length > 0) {
      md += "\n**Examples:**\n```lea\n";
      md += doc.examples.join("\n");
      md += "\n```";
    }

    return md;
  }

  /**
   * Format user-defined symbol hover documentation
   */
  private formatSymbolHover(symbol: LeaSymbol): string {
    let md = `**${symbol.name}**`;

    // Add kind
    switch (symbol.kind) {
      case SymbolKind.Function:
        md += " (function)";
        break;
      case SymbolKind.Variable:
        md += symbol.mutable ? " (mutable)" : " (immutable)";
        break;
      case SymbolKind.Parameter:
        md += " (parameter)";
        break;
      case SymbolKind.Context:
        md += " (context)";
        break;
      case SymbolKind.Pipeline:
        md += " (pipeline)";
        break;
      case SymbolKind.Builtin:
        md += " (builtin)";
        break;
    }

    md += "\n\n";

    // Add type signature if available
    if (symbol.type) {
      md += "```lea\n" + symbol.type + "\n```\n\n";
    } else if (symbol.typeSignature) {
      const sig = this.formatTypeSignature(symbol.typeSignature);
      md += "```lea\n" + sig + "\n```\n\n";
    }

    // Add parameter info for functions
    if (symbol.params && symbol.params.length > 0) {
      md += "**Parameters:**\n";
      for (const param of symbol.params) {
        md += `- \`${param.name}\``;
        if (param.type) {
          md += ` *(${param.type})*`;
        }
        if (param.defaultValue) {
          md += ` = ${param.defaultValue}`;
        }
        md += "\n";
      }
      md += "\n";
    }

    // Add decorators if present
    if (symbol.decorators && symbol.decorators.length > 0) {
      md += "**Decorators:** ";
      md += symbol.decorators.map((d) => `\`#${d.name}\``).join(", ");
      md += "\n\n";
    }

    // Add exported status
    if (symbol.exported) {
      md += "*Exported from module*\n";
    }

    // Add documentation if available
    if (symbol.documentation) {
      md += symbol.documentation;
    }

    return md;
  }

  /**
   * Format a type signature for display
   */
  private formatTypeSignature(sig: {
    paramTypes: (string | { tuple: string[]; optional?: boolean } | { list: string; optional?: boolean })[];
    returnType?: string | { tuple: string[] } | { list: string };
  }): string {
    const formatType = (t: string | { tuple: string[]; optional?: boolean } | { list: string; optional?: boolean }): string => {
      if (typeof t === "string") return t;
      if ("tuple" in t) return `(${t.tuple.join(", ")})`;
      if ("list" in t) return `[${t.list}]`;
      return "any";
    };

    const params = sig.paramTypes.map(formatType).join(", ");
    const ret = sig.returnType ? formatType(sig.returnType) : "any";

    return `(${params}) -> ${ret}`;
  }

  /**
   * Format Pipeline namespace hover
   */
  private formatPipelineNamespaceHover(): string {
    return `**Pipeline** (namespace)

Pipeline utilities and static methods.

**Static Properties:**
- \`Pipeline.identity\` - No-op pipeline
- \`Pipeline.empty\` - Empty pipeline

**Static Methods:**
- \`Pipeline.from(fns)\` - Create from function list

**Instance Properties:**
- \`.length\` - Number of stages
- \`.stages\` - List of stage names
- \`.first\` / \`.last\` - First/last stage

**Instance Methods:**
- \`.visualize()\` - Print ASCII diagram
- \`.isEmpty()\` - Check if empty
- \`.equals(other)\` - Structural equality
- \`.at(i)\` - Get stage at index
- \`.prepend(fn)\` / \`.append(fn)\` - Add stages
- \`.reverse()\` - Reverse order
- \`.slice(start, end?)\` - Extract sub-pipeline
- \`.without(other)\` - Remove stages
- \`.intersection(other)\` - Common stages
- \`.union(other)\` - Combine stages
- \`.concat(other)\` - Concatenate`;
  }
}

/**
 * Error formatting and suggestions for Lea
 *
 * This module provides user-friendly error messages with:
 * - Contextual suggestions
 * - "Did you mean?" hints
 * - Common mistake detection
 * - Help references
 */

// Known keywords and builtins for "did you mean?" suggestions
const KEYWORDS = [
  "let", "maybe", "and", "true", "false", "await", "context", "provide",
  "match", "if", "return", "input", "null", "decorator", "use",
];

const BUILTINS = [
  // Core
  "print", "toString",
  // Math - basic
  "sqrt", "abs", "floor", "ceil", "round", "min", "max",
  // Math - advanced
  "pow", "log", "log10", "log2", "exp",
  "sin", "cos", "tan", "asin", "acos", "atan", "atan2",
  "sinh", "cosh", "tanh", "sign", "trunc", "clamp", "lerp",
  // Math constants
  "PI", "E", "TAU", "INFINITY",
  // Random
  "random", "randomInt", "randomFloat", "randomChoice", "shuffle",
  // Lists
  "length", "head", "tail", "push", "concat", "reverse", "zip", "isEmpty",
  "map", "filter", "reduce", "partition", "range", "iterations",
  "fst", "snd", "take", "at",
  // Strings
  "split", "lines", "charAt", "join", "padEnd", "padStart", "trim", "trimEnd",
  "indexOf", "includes", "repeat", "slice", "chars",
  "toUpperCase", "toLowerCase", "replace", "replaceFirst", "startsWith", "endsWith",
  // Sets
  "listSet", "setAdd", "setHas",
  // JSON
  "parseJson", "toJson", "prettyJson",
  // Date/Time
  "now", "today", "date", "formatDate", "parseDate",
  "addDays", "addHours", "addMinutes", "diffDates",
  // Async
  "delay", "parallel", "race", "then",
  // I/O
  "readFile", "writeFile", "appendFile", "fileExists", "deleteFile", "readDir", "fetch",
];

const ALL_NAMES = [...KEYWORDS, ...BUILTINS];

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Find similar names for "did you mean?" suggestions
 */
function findSimilar(name: string, candidates: string[], maxDistance = 2): string[] {
  const similar: Array<{ name: string; distance: number }> = [];

  for (const candidate of candidates) {
    const distance = levenshteinDistance(name.toLowerCase(), candidate.toLowerCase());
    if (distance <= maxDistance && distance > 0) {
      similar.push({ name: candidate, distance });
    }
  }

  return similar
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3)
    .map((s) => s.name);
}

/**
 * Common error patterns and their suggestions
 */
interface ErrorPattern {
  pattern: RegExp;
  getSuggestion: (match: RegExpMatchArray) => string;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  // Undefined variable
  {
    pattern: /Undefined variable '(\w+)'/,
    getSuggestion: (match) => {
      const name = match[1];
      const similar = findSimilar(name, ALL_NAMES);
      if (similar.length > 0) {
        return `Did you mean: ${similar.join(", ")}?`;
      }
      return "Make sure the variable is defined with 'let' or 'maybe' before using it.";
    },
  },

  // Cannot reassign immutable
  {
    pattern: /Cannot reassign immutable variable '(\w+)'/,
    getSuggestion: () =>
      "Use 'maybe' instead of 'let' to create a mutable variable:\n  maybe x = 10\n  x = 20  -- OK",
  },

  // String concatenation with +
  {
    pattern: /Cannot use binary operator '\+' on types String and/,
    getSuggestion: () =>
      "Use '++' for string concatenation:\n  \"Hello\" ++ \" World\"  -- \"Hello World\"",
  },

  // Wrong argument count
  {
    pattern: /Expected (\d+) arguments? but got (\d+)/,
    getSuggestion: (match) => {
      const expected = parseInt(match[1]);
      const got = parseInt(match[2]);
      if (got < expected) {
        return "Check that you're passing all required arguments.";
      }
      return "Check that you're not passing extra arguments.";
    },
  },

  // Type mismatch
  {
    pattern: /Expected (Int|String|Bool|List|Function) but got (Int|String|Bool|List|Function)/,
    getSuggestion: (match) => {
      const expected = match[1];
      const got = match[2];
      if (expected === "Int" && got === "String") {
        return "Try using #coerce(Int) decorator or toString() to convert types.";
      }
      if (expected === "String" && got === "Int") {
        return "Numbers are auto-coerced in string context. Use '++' to concatenate.";
      }
      return `The function expects ${expected} but received ${got}.`;
    },
  },

  // Right side of pipe must be function
  {
    pattern: /Right side of pipe must be a function or call/,
    getSuggestion: () =>
      "The right side of /> must be a function or function call:\n  5 /> sqrt       -- OK (function)\n  5 /> add(3)     -- OK (call)\n  5 /> 10         -- ERROR (not a function)",
  },

  // Cannot use and without function
  {
    pattern: /'and' can only be used with function definitions/,
    getSuggestion: () =>
      "'and' extends an existing function with an overload or reverse:\n  let add = (a, b) -> a + b :: (Int, Int) :> Int\n  and add = (a, b) -> a ++ b :: (String, String) :> String",
  },

  // Spread on non-list
  {
    pattern: /Cannot spread non-list value/,
    getSuggestion: () =>
      "The spread operator (...) only works on lists:\n  [...[1, 2], ...[3, 4]]  -- [1, 2, 3, 4]",
  },

  // Spread pipe on non-list
  {
    pattern: /Spread pipe \/>>> requires a list or parallel result/,
    getSuggestion: () =>
      "The spread pipe />>> maps over lists:\n  [1, 2, 3] />>>double  -- [2, 4, 6]\n  For single values, use regular pipe: x /> double",
  },

  // No matching pattern
  {
    pattern: /No matching case in match expression/,
    getSuggestion: () =>
      "Add a default case at the end of your match:\n  match x\n    | 0 -> \"zero\"\n    | \"default\"  -- catches everything else",
  },

  // Context not defined
  {
    pattern: /Context '(\w+)' is not defined/,
    getSuggestion: (match) =>
      `Define the context first:\n  context ${match[1]} = { ... }\n\nThen provide a value if needed:\n  provide ${match[1]} { ... }`,
  },

  // Cannot destructure
  {
    pattern: /Cannot destructure non-record value/,
    getSuggestion: () =>
      "Record destructuring requires a record:\n  let { name, age } = { name: \"Alice\", age: 30 }",
  },

  // Unterminated string
  {
    pattern: /Unterminated string/,
    getSuggestion: () =>
      "Make sure to close your string with a matching quote:\n  \"hello\"  -- OK\n  'hello'  -- OK",
  },

  // Unexpected character
  {
    pattern: /Unexpected character '(.+)'/,
    getSuggestion: (match) => {
      const char = match[1];
      if (char === ";") {
        return "Lea doesn't use semicolons. Just remove it!";
      }
      if (char === "$") {
        return "Template strings use {} not ${}:\n  `Hello {name}`  -- not `Hello ${name}`";
      }
      return `The character '${char}' is not valid Lea syntax.`;
    },
  },

  // Arrow function syntax
  {
    pattern: /Expected '->'/,
    getSuggestion: () =>
      "Function definitions use -> not =>:\n  let f = (x) -> x * 2",
  },

  // JSON parsing errors
  {
    pattern: /parseJson failed/,
    getSuggestion: () =>
      "Make sure the string is valid JSON:\n  parseJson('{\"name\": \"Alice\"}')\n  parseJson('[1, 2, 3]')",
  },

  // Date parsing errors
  {
    pattern: /Invalid date string/,
    getSuggestion: () =>
      "Use a valid date format:\n  parseDate(\"2024-01-15\")          -- ISO date\n  parseDate(\"2024-01-15T10:30:00\")  -- ISO datetime\n  date(2024, 1, 15)                 -- year, month, day",
  },

  // Module import errors
  {
    pattern: /Cannot find module '(.+)'/,
    getSuggestion: (match) =>
      `Check that the file exists at: ${match[1]}.lea\n\nModule imports use relative paths:\n  let { fn } = use \"./utils\"     -- imports from ./utils.lea\n  let { fn } = use \"../lib/math\"  -- relative parent path`,
  },

  // Index out of bounds
  {
    pattern: /Index (\d+) out of bounds for list of length (\d+)/,
    getSuggestion: (match) => {
      const index = parseInt(match[1]);
      const length = parseInt(match[2]);
      return `The list has ${length} elements (indices 0-${length - 1}), but you tried to access index ${index}.\n\nUse 'at' or check bounds first:\n  list /> at(0)           -- first element\n  list /> at(length - 1)  -- last element`;
    },
  },

  // Empty list operations
  {
    pattern: /head of empty list/,
    getSuggestion: () =>
      "Cannot get head of an empty list. Check if the list is empty first:\n  list /> isEmpty ? null : head(list)",
  },

  // Type errors for string functions
  {
    pattern: /(toUpperCase|toLowerCase|replace|startsWith|endsWith|trim|split|chars) requires a string/,
    getSuggestion: (match) =>
      `'${match[1]}' only works on strings. Convert to string first if needed:\n  value /> toString /> ${match[1]}`,
  },

  // Type errors for math functions
  {
    pattern: /Expected a number/,
    getSuggestion: () =>
      "Math functions require numbers. Use #coerce(Int) or convert:\n  \"42\" /> toString /> parseJson  -- if it's a number string",
  },

  // Circular reference in JSON
  {
    pattern: /Cannot convert (function|pipeline|reversible_function) to JSON/,
    getSuggestion: () =>
      "Functions and pipelines cannot be serialized to JSON.\nOnly use toJson with records, lists, strings, numbers, and booleans.",
  },

  // Missing decorator argument
  {
    pattern: /Decorator '(\w+)' requires an argument/,
    getSuggestion: (match) =>
      `The #${match[1]} decorator needs an argument:\n  #${match[1]}(value)`,
  },

  // Unknown decorator warning
  {
    pattern: /Unknown decorator '(\w+)'/,
    getSuggestion: (match) => {
      const decorators = ["log", "log_verbose", "memo", "time", "retry", "validate", "async", "trace",
        "coerce", "parse", "stringify", "tease", "debug", "profile", "tap", "parallel", "batch", "prefetch", "autoparallel", "export", "pure", "timeout"];
      const similar = findSimilar(match[1], decorators);
      if (similar.length > 0) {
        return `Unknown decorator '#${match[1]}'. Did you mean: ${similar.map(s => "#" + s).join(", ")}?`;
      }
      return `Unknown decorator '#${match[1]}'. Built-in decorators include:\n  #log #memo #time #retry(n) #validate #async #trace\n  #coerce(Type) #parse #stringify #debug #profile`;
    },
  },
];

/**
 * Format an error message with helpful suggestions
 */
export function formatError(error: Error, sourceCode?: string): string {
  const message = error.message;
  const lines: string[] = [];

  // Header with error type
  const errorType = error.name || "Error";
  lines.push(`\x1b[31m${errorType}:\x1b[0m ${message}`);

  // If error has location information, show context from source code
  if ("location" in error && error.location && sourceCode) {
    const loc = error.location as { line: number; column: number; file?: string };
    const sourceLines = sourceCode.split("\n");
    const lineIndex = loc.line - 1;

    lines.push("");
    if (loc.file) {
      lines.push(`\x1b[90m  --> ${loc.file}:${loc.line}:${loc.column}\x1b[0m`);
    } else {
      lines.push(`\x1b[90m  --> line ${loc.line}, column ${loc.column}\x1b[0m`);
    }
    lines.push("\x1b[90m   |\x1b[0m");

    // Show a few lines of context around the error
    const startLine = Math.max(0, lineIndex - 2);
    const endLine = Math.min(sourceLines.length - 1, lineIndex + 2);
    const maxLineNumWidth = String(endLine + 1).length;

    for (let i = startLine; i <= endLine; i++) {
      const lineNum = String(i + 1).padStart(maxLineNumWidth, " ");
      const lineContent = sourceLines[i] || "";

      if (i === lineIndex) {
        // Error line - highlight it
        lines.push(`\x1b[31m${lineNum} |\x1b[0m ${lineContent}`);

        // Add caret pointing to the column on the error line
        if (loc.column > 0) {
          const padding = " ".repeat(maxLineNumWidth + 2);
          const caretPad = " ".repeat(Math.max(0, loc.column - 1));
          // Try to underline the problematic token (estimate 1-10 chars)
          const underline = "^".repeat(Math.min(10, Math.max(1, lineContent.length - loc.column + 1)));
          lines.push(`${padding}\x1b[31m${caretPad}${underline}\x1b[0m`);
        }
      } else {
        // Context line
        lines.push(`\x1b[90m${lineNum} |\x1b[0m ${lineContent}`);
      }
    }
    lines.push("\x1b[90m   |\x1b[0m");
  }

  // Try to match error patterns
  for (const { pattern, getSuggestion } of ERROR_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      lines.push("");
      lines.push("\x1b[36mSuggestion:\x1b[0m");
      const suggestion = getSuggestion(match);
      lines.push(suggestion.split("\n").map(l => "  " + l).join("\n"));
      break;
    }
  }

  // Add help reference for common topics
  const helpTopic = getRelevantHelpTopic(message);
  if (helpTopic) {
    lines.push("");
    lines.push(`\x1b[90mFor more info: .help ${helpTopic}\x1b[0m`);
  }

  return lines.join("\n");
}

/**
 * Format error without ANSI colors (for non-TTY output)
 */
export function formatErrorPlain(error: Error, sourceCode?: string): string {
  return formatError(error, sourceCode).replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Get relevant help topic for an error message
 */
function getRelevantHelpTopic(message: string): string | null {
  if (message.includes("pipe") || message.includes("/>") || message.includes("\\>")) {
    return "pipes";
  }
  if (message.includes("function") || message.includes("->") || message.includes("decorator")) {
    return "functions";
  }
  if (message.includes("list") || message.includes("map") || message.includes("filter")) {
    return "lists";
  }
  if (message.includes("type") || message.includes("Int") || message.includes("String")) {
    return "types";
  }
  if (message.includes("async") || message.includes("await") || message.includes("promise")) {
    return "async";
  }
  if (message.includes("match") || message.includes("pattern") || message.includes("guard")) {
    return "patterns";
  }
  if (message.includes("context") || message.includes("provide")) {
    return "contexts";
  }
  if (message.includes("pipeline") || message.includes("Pipeline")) {
    return "pipelines";
  }
  return null;
}

/**
 * Common pitfalls with explanations
 */
export const COMMON_PITFALLS = [
  {
    title: "String concatenation uses ++, not +",
    wrong: `"Hello" + " World"`,
    correct: `"Hello" ++ " World"`,
    explanation: "The + operator is for arithmetic. Use ++ for string concatenation.",
  },
  {
    title: "Pipe binds tighter than arithmetic",
    wrong: `5 /> double + 1  -- parses as (5 /> double) + 1`,
    correct: `5 /> double /> add(1)  -- or use parentheses`,
    explanation: "Pipes have higher precedence than +/-. Use parentheses or chain pipes.",
  },
  {
    title: "reduce takes initial value first",
    wrong: `[1,2,3] /> reduce((acc, x) -> acc + x, 0)`,
    correct: `[1,2,3] /> reduce(0, (acc, x) -> acc + x)`,
    explanation: "Unlike JavaScript, Lea's reduce takes the initial value as the first argument.",
  },
  {
    title: "let is immutable, maybe is mutable",
    wrong: `let x = 10\nx = 20  -- Error!`,
    correct: `maybe x = 10\nx = 20  -- OK`,
    explanation: "Use 'maybe' for variables you need to reassign.",
  },
  {
    title: "Template strings use {} not ${}",
    wrong: `\`Hello \${name}\``,
    correct: `\`Hello {name}\``,
    explanation: "Lea template strings use single braces for interpolation.",
  },
  {
    title: "Functions use -> not =>",
    wrong: `let f = (x) => x * 2`,
    correct: `let f = (x) -> x * 2`,
    explanation: "Lea uses -> for arrow functions, not =>.",
  },
  {
    title: "No semicolons needed",
    wrong: `let x = 10;`,
    correct: `let x = 10`,
    explanation: "Lea doesn't use semicolons. Just remove them!",
  },
  {
    title: "Comments use -- not //",
    wrong: `// this is a comment`,
    correct: `-- this is a comment`,
    explanation: "Lea uses -- for comments, not //.",
  },
];

export { findSimilar, ALL_NAMES };

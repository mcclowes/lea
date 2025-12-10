/**
 * Lea Syntax Definitions
 *
 * Exports syntax highlighting configurations for use in editors like Monaco.
 * These are derived from the VS Code extension's TextMate grammar.
 */

import { KEYWORDS as TOKEN_KEYWORDS } from "./token";

// Re-export keywords from token.ts
export const KEYWORDS = Object.keys(TOKEN_KEYWORDS);

// Builtin function names (from interpreter/builtins.ts)
export const BUILTINS = [
  // Core
  "print",
  "delay",
  // Math
  "sqrt",
  "abs",
  "floor",
  "ceil",
  "round",
  "min",
  "max",
  "pow",
  "log",
  "log10",
  "log2",
  "exp",
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "atan2",
  "sinh",
  "cosh",
  "tanh",
  "sign",
  "trunc",
  "clamp",
  "lerp",
  // Math constants
  "PI",
  "E",
  "TAU",
  "INFINITY",
  // Random
  "random",
  "randomInt",
  "randomFloat",
  "randomChoice",
  "shuffle",
  // Lists
  "length",
  "head",
  "tail",
  "push",
  "concat",
  "reverse",
  "isEmpty",
  "fst",
  "snd",
  "zip",
  "range",
  "take",
  "slice",
  "at",
  "map",
  "filter",
  "reduce",
  "partition",
  "listSet",
  // Sets
  "setAdd",
  "setHas",
  // Strings
  "toString",
  "toUpperCase",
  "toLowerCase",
  "trim",
  "trimEnd",
  "padStart",
  "padEnd",
  "split",
  "join",
  "replace",
  "replaceFirst",
  "includes",
  "startsWith",
  "endsWith",
  "indexOf",
  "charAt",
  "chars",
  "lines",
  "repeat",
  // JSON
  "toJson",
  "parseJson",
  "prettyJson",
  // Dates
  "now",
  "today",
  "date",
  "parseDate",
  "formatDate",
  "addDays",
  "addHours",
  "addMinutes",
  "diffDates",
  // File system
  "readFile",
  "writeFile",
  "appendFile",
  "deleteFile",
  "fileExists",
  "readDir",
  // Async/concurrency
  "then",
  "parallel",
  "race",
  "fetch",
  // Pipeline utilities
  "iterations",
  "breakPieces",
];

// Built-in decorators
export const DECORATORS = [
  "log",
  "log_verbose",
  "memo",
  "time",
  "retry",
  "timeout",
  "pure",
  "async",
  "trace",
  "tap",
  "debug",
  "profile",
  "coerce",
  "parse",
  "stringify",
  "tease",
  "parallel",
  "batch",
  "prefetch",
  "autoparallel",
  "validate",
  "export",
];

// Type names
export const TYPES = [
  "Int",
  "String",
  "Bool",
  "List",
  "Record",
  "Function",
  "Tuple",
  "Pipeline",
];

/**
 * TextMate grammar for Lea syntax highlighting
 * Compatible with VS Code, Monaco (via monaco-textmate), and other TextMate-based editors
 */
export const tmLanguage = {
  $schema:
    "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
  name: "Lea",
  scopeName: "source.lea",
  patterns: [
    { include: "#comments" },
    { include: "#codeblocks" },
    { include: "#type-annotations" },
    { include: "#strings" },
    { include: "#numbers" },
    { include: "#keywords" },
    { include: "#decorators" },
    { include: "#attachments" },
    { include: "#operators" },
    { include: "#functions" },
    { include: "#constants" },
    { include: "#identifiers" },
  ],
  repository: {
    comments: {
      patterns: [
        {
          name: "comment.line.double-dash.lea",
          match: "--.*$",
        },
      ],
    },
    codeblocks: {
      patterns: [
        {
          comment: "Codeblock open {-- label --} - same color as comments",
          name: "comment.block.codeblock.lea",
          match: "\\{--\\s*(.*)\\s*--\\}",
          captures: {
            "0": { name: "comment.block.codeblock.lea" },
            "1": { name: "comment.block.codeblock.label.lea" },
          },
        },
        {
          comment: "Codeblock close {/--} - same color as comments",
          name: "comment.block.codeblock.lea",
          match: "\\{/--\\}",
        },
      ],
    },
    "type-annotations": {
      patterns: [
        {
          comment: "Pipeline type annotation :: Type /> Type - for pipelines",
          name: "comment.block.type-annotation.lea",
          match:
            "::\\s*(?:\\?)?(?:\\([^)]*\\)|\\[[^\\]]*\\]|[A-Z][a-zA-Z0-9]*)\\s*/>\\s*(?:\\?)?(?:\\([^)]*\\)|\\[[^\\]]*\\]|[A-Z][a-zA-Z0-9]*)",
        },
        {
          comment:
            "Trailing type annotation :: (Type, Type) :> ReturnType or :: Type :> (Type, Type) or :: [Type] :> [Type] - styled subtly like comments",
          name: "comment.block.type-annotation.lea",
          match:
            "::\\s*(?:\\?)?(?:\\([^)]*\\)|\\[[^\\]]*\\]|[A-Z][a-zA-Z0-9]*)(?:\\s*:>\\s*(?:\\?)?(?:\\([^)]*\\)|\\[[^\\]]*\\]|[A-Z][a-zA-Z0-9]*))?",
        },
      ],
    },
    strings: {
      patterns: [
        {
          name: "string.quoted.double.lea",
          begin: '"',
          end: '"',
          patterns: [
            {
              name: "constant.character.escape.lea",
              match: "\\\\.",
            },
          ],
        },
        {
          comment: "Template string with interpolation",
          name: "string.template.lea",
          begin: "`",
          end: "`",
          patterns: [
            {
              comment: "Interpolation expression",
              name: "meta.interpolation.lea",
              begin: "\\{",
              end: "\\}",
              beginCaptures: {
                "0": { name: "punctuation.definition.interpolation.begin.lea" },
              },
              endCaptures: {
                "0": { name: "punctuation.definition.interpolation.end.lea" },
              },
              patterns: [
                { include: "#comments" },
                { include: "#strings" },
                { include: "#numbers" },
                { include: "#keywords" },
                { include: "#operators" },
                { include: "#functions" },
                { include: "#constants" },
                { include: "#identifiers" },
              ],
            },
          ],
        },
      ],
    },
    numbers: {
      patterns: [
        {
          name: "constant.numeric.float.lea",
          match: "\\b\\d+\\.\\d+\\b",
        },
        {
          name: "constant.numeric.integer.lea",
          match: "\\b\\d+\\b",
        },
      ],
    },
    keywords: {
      patterns: [
        {
          name: "keyword.control.lea",
          match:
            "\\b(let|and|maybe|await|context|provide|decorator|match|if|return|input|use)\\b",
        },
        {
          name: "storage.type.lea",
          match: "\\b(Int|String|Bool|List|Record|Function|Tuple|Pipeline)\\b",
        },
      ],
    },
    decorators: {
      patterns: [
        {
          comment: "Type-checking decorator - darker blue",
          name: "support.type.decorator.validate.lea",
          match: "#validate\\b",
        },
        {
          comment: "Export decorator for module system",
          name: "keyword.other.export.lea",
          match: "#export\\b",
        },
        {
          comment: "Built-in decorators - standard decorator color",
          name: "entity.name.function.decorator.builtin.lea",
          match:
            "#(log|log_verbose|memo|time|retry|timeout|pure|async|trace|tap|debug|profile|coerce|parse|stringify|tease|parallel|batch|prefetch|autoparallel)\\b",
        },
        {
          comment: "Custom decorators",
          name: "entity.name.function.decorator.custom.lea",
          match: "#[a-zA-Z_][a-zA-Z0-9_]*",
        },
      ],
    },
    attachments: {
      patterns: [
        {
          comment: "Context attachments - orange/warning color",
          name: "variable.parameter.attachment.lea",
          match: "@[A-Z][a-zA-Z0-9_]*",
        },
        {
          comment: "Other attachments",
          name: "entity.name.tag.attachment.lea",
          match: "@[a-zA-Z_][a-zA-Z0-9_]*",
        },
      ],
    },
    operators: {
      patterns: [
        {
          comment:
            "Reactive pipe operator - creates auto-recomputing reactive binding",
          name: "keyword.operator.pipe.lea",
          match: "@>",
        },
        {
          comment: "Bidirectional pipe operator - for reversible pipelines",
          name: "keyword.operator.pipe.lea",
          match: "</>",
        },
        {
          comment:
            "Reverse pipe operator - applies value through function/pipeline in reverse",
          name: "keyword.operator.pipe.lea",
          match: "</",
        },
        {
          comment: "Spread pipe operator - maps function over list elements",
          name: "keyword.operator.pipe.lea",
          match: "/>>>",
        },
        {
          name: "keyword.operator.pipe.lea",
          match: "/>",
        },
        {
          comment: "Parallel pipe operator - fan-out for concurrent execution",
          name: "keyword.operator.pipe.lea",
          match: "\\\\>",
        },
        {
          comment: "Function arrow - standard keyword color",
          name: "keyword.operator.arrow.lea",
          match: "->",
        },
        {
          comment: "Reverse function arrow - for (x) <- expr definitions",
          name: "keyword.operator.reverse-arrow.lea",
          match: "<-",
        },
        {
          name: "keyword.operator.type-return.lea",
          match: ":>",
        },
        {
          name: "keyword.operator.type-annotation.lea",
          match: "::",
        },
        {
          name: "keyword.operator.concat.lea",
          match: "\\+\\+",
        },
        {
          name: "keyword.operator.comparison.lea",
          match: "==|!=|<=|>=|<|>",
        },
        {
          name: "keyword.operator.ternary.lea",
          match: "\\?|:",
        },
        {
          name: "keyword.operator.arithmetic.lea",
          match: "[+\\-*/%]",
        },
        {
          name: "keyword.operator.assignment.lea",
          match: "=",
        },
        {
          comment: "Pattern match case separator",
          name: "keyword.operator.match-case.lea",
          match: "\\|",
        },
        {
          comment: "Spread operator for lists and records",
          name: "keyword.operator.spread.lea",
          match: "\\.\\.\\.",
        },
      ],
    },
    functions: {
      patterns: [
        {
          name: "support.function.builtin.lea",
          match: `\\b(${BUILTINS.join("|")})\\b`,
        },
      ],
    },
    constants: {
      patterns: [
        {
          name: "constant.language.boolean.lea",
          match: "\\b(true|false)\\b",
        },
        {
          comment: "Underscore as ignored parameter in function definitions",
          name: "variable.language.ignored.lea",
          match: "\\b_\\b",
        },
        {
          comment: "Global objects like Pipeline",
          name: "support.class.global.lea",
          match: "\\bPipeline\\b",
        },
      ],
    },
    identifiers: {
      patterns: [
        {
          name: "variable.other.lea",
          match: "\\b[a-zA-Z_][a-zA-Z0-9_]*\\b",
        },
      ],
    },
  },
};

/**
 * Language configuration for editor features
 * (brackets, comments, auto-closing pairs, etc.)
 */
export const languageConfiguration = {
  comments: {
    lineComment: "--",
  },
  brackets: [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
  ] as [string, string][],
  autoClosingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: '"', close: '"', notIn: ["string"] },
    { open: "`", close: "`", notIn: ["string"] },
  ],
  surroundingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: '"', close: '"' },
    { open: "`", close: "`" },
  ],
  folding: {
    markers: {
      start: "^\\s*\\{--.*--\\}",
      end: "^\\s*\\{/--\\}",
    },
  },
  indentationRules: {
    increaseIndentPattern: "->\\s*$",
    decreaseIndentPattern: "^\\s*$",
  },
};

/**
 * Monaco Editor compatible Monarch tokenizer
 * Use this with monaco.languages.setMonarchTokensProvider()
 */
export const monarchTokensProvider = {
  keywords: KEYWORDS,
  builtins: BUILTINS,
  typeKeywords: TYPES,
  booleans: ["true", "false"],

  operators: [
    "/>>>",
    "</>",
    "/>",
    "</",
    "\\>",
    "@>",
    "->",
    "<-",
    ":>",
    "::",
    "++",
    "...",
    "==",
    "!=",
    "<=",
    ">=",
    "<",
    ">",
    "+",
    "-",
    "*",
    "/",
    "%",
    "?",
    "|",
    "=",
  ],

  symbols: /[=><!~?:&|+\-*/^%\\@.]+/,

  tokenizer: {
    root: [
      // Comments
      [/--.*$/, "comment"],

      // Decorators (#name or #name(args))
      [/#[a-zA-Z_]\w*(\([^)]*\))?/, "annotation"],

      // Context attachments (@Name)
      [/@[a-zA-Z_]\w*/, "tag"],

      // Pipe operators (order matters - longer first)
      [/\/>>>/, "keyword.operator.pipe"],
      [/<\/>/, "keyword.operator.pipe"],
      [/\/>/, "keyword.operator.pipe"],
      [/<\//, "keyword.operator.pipe"],
      [/\\>/, "keyword.operator.pipe"],
      [/@>/, "keyword.operator.pipe"],

      // Arrow operators
      [/<-/, "keyword.operator.arrow"],
      [/->/, "keyword.operator.arrow"],

      // Type operators
      [/::/, "keyword.operator.type"],
      [/:>/, "keyword.operator.type"],

      // Spread operator
      [/\.\.\./, "keyword.operator"],

      // Concat operator
      [/\+\+/, "keyword.operator"],

      // Identifiers and keywords
      [
        /[a-zA-Z_]\w*/,
        {
          cases: {
            "@keywords": "keyword",
            "@typeKeywords": "type",
            "@booleans": "constant.language",
            "@builtins": "support.function",
            "@default": "identifier",
          },
        },
      ],

      // Strings
      [/"([^"\\]|\\.)*$/, "string.invalid"],
      [/"/, { token: "string.quote", bracket: "@open", next: "@string" }],

      // Template strings
      [/`/, { token: "string", bracket: "@open", next: "@template" }],

      // Numbers
      [/\d*\.\d+([eE][+-]?\d+)?/, "number.float"],
      [/\d+/, "number"],

      // Brackets
      [/[{}()\[\]]/, "@brackets"],

      // Remaining operators
      [
        /@symbols/,
        {
          cases: {
            "@operators": "keyword.operator",
            "@default": "",
          },
        },
      ],

      // Whitespace
      [/\s+/, "white"],
    ],

    string: [
      [/[^\\"]+/, "string"],
      [/\\./, "string.escape"],
      [/"/, { token: "string.quote", bracket: "@close", next: "@pop" }],
    ],

    template: [
      [/\{/, { token: "delimiter.bracket", next: "@templateExpr" }],
      [/[^`{\\]+/, "string"],
      [/\\./, "string.escape"],
      [/`/, { token: "string", bracket: "@close", next: "@pop" }],
    ],

    templateExpr: [
      [/\}/, { token: "delimiter.bracket", next: "@pop" }],
      // Include main tokenizer rules for expressions
      [/--.*$/, "comment"],
      [
        /[a-zA-Z_]\w*/,
        {
          cases: {
            "@keywords": "keyword",
            "@builtins": "support.function",
            "@default": "identifier",
          },
        },
      ],
      [/\d+/, "number"],
      [/./, ""],
    ],
  },
};

/**
 * VS Code style snippets for code completion
 */
export const snippets = {
  "Let Binding": {
    prefix: "let",
    body: ["let ${1:name} = ${2:value}"],
    description: "Create an immutable binding",
  },
  "Maybe Binding": {
    prefix: "maybe",
    body: ["maybe ${1:name} = ${2:value}"],
    description: "Create a mutable binding",
  },
  Function: {
    prefix: "fn",
    body: ["let ${1:name} = (${2:params}) -> ${3:body}"],
    description: "Create a function",
  },
  "Arrow Function": {
    prefix: "->",
    body: ["(${1:x}) -> ${2:body}"],
    description: "Anonymous arrow function",
  },
  Pipe: {
    prefix: "/>",
    body: ["/> ${1:function}"],
    description: "Pipe operator",
  },
  "Pipe Chain": {
    prefix: "pipec",
    body: ["${1:value}", "  /> ${2:fn1}", "  /> ${3:fn2}", "  /> ${4:fn3}"],
    description: "Chained pipe operations",
  },
  Map: {
    prefix: "map",
    body: ["/> map((${1:x}) -> ${2:body})"],
    description: "Map over a list",
  },
  Filter: {
    prefix: "filter",
    body: ["/> filter((${1:x}) -> ${2:condition})"],
    description: "Filter a list",
  },
  Reduce: {
    prefix: "reduce",
    body: ["/> reduce(${1:initial}, (${2:acc}, ${3:x}) -> ${4:body})"],
    description: "Reduce a list",
  },
  "Pattern Match": {
    prefix: "match",
    body: [
      "match ${1:value}",
      "  | ${2:pattern} -> ${3:result}",
      "  | ${4:default}",
    ],
    description: "Pattern matching expression",
  },
  Print: {
    prefix: "print",
    body: ["${1:value} /> print"],
    description: "Print a value",
  },
  Range: {
    prefix: "range",
    body: ["range(${1:1}, ${2:10})"],
    description: "Create a range of numbers",
  },
  "Spread Pipe": {
    prefix: "/>>>",
    body: ["/>>>${1:fn}"],
    description: "Spread pipe operator - map over list",
  },
  "Template String": {
    prefix: "tpl",
    body: ["`${1:text} {${2:expr}}`"],
    description: "Template string with interpolation",
  },
};

export enum TokenType {
  // Literals
  NUMBER = "NUMBER",
  STRING = "STRING",
  TEMPLATE_STRING = "TEMPLATE_STRING",  // `hello {name}`
  IDENTIFIER = "IDENTIFIER",

  // Keywords
  LET = "LET",
  MAYBE = "MAYBE",
  TRUE = "TRUE",
  FALSE = "FALSE",
  AWAIT = "AWAIT",
  CONTEXT = "CONTEXT",
  PROVIDE = "PROVIDE",
  DECORATOR = "DECORATOR",

  // Operators
  PIPE = "PIPE",           // />
  PARALLEL_PIPE = "PARALLEL_PIPE", // \>
  ARROW = "ARROW",         // ->
  RETURN = "RETURN",       // <-
  PLUS = "PLUS",           // +
  MINUS = "MINUS",         // -
  STAR = "STAR",           // *
  SLASH = "SLASH",         // /
  PERCENT = "PERCENT",     // %
  CONCAT = "CONCAT",       // ++

  // Comparison
  EQ = "EQ",               // =
  EQEQ = "EQEQ",           // ==
  NEQ = "NEQ",             // !=
  LT = "LT",               // <
  GT = "GT",               // >
  LTE = "LTE",             // <=
  GTE = "GTE",             // >=

  // Ternary
  QUESTION = "QUESTION",   // ?

  // Type annotations
  DOUBLE_COLON = "DOUBLE_COLON",   // ::
  COLON_GT = "COLON_GT",           // :>

  // Delimiters
  LPAREN = "LPAREN",       // (
  RPAREN = "RPAREN",       // )
  LBRACKET = "LBRACKET",   // [
  RBRACKET = "RBRACKET",   // ]
  LBRACE = "LBRACE",       // {
  RBRACE = "RBRACE",       // }
  COMMA = "COMMA",         // ,
  COLON = "COLON",         // :
  DOT = "DOT",             // .
  UNDERSCORE = "UNDERSCORE", // _
  HASH = "HASH",           // #
  AT = "AT",               // @

  // Codeblocks
  CODEBLOCK_OPEN = "CODEBLOCK_OPEN",   // <>
  CODEBLOCK_CLOSE = "CODEBLOCK_CLOSE", // </>

  // Reversible functions and bidirectional pipelines
  BIDIRECTIONAL_PIPE = "BIDIRECTIONAL_PIPE", // </>
  REVERSE_PIPE = "REVERSE_PIPE",             // </
  REVERSE_ARROW = "REVERSE_ARROW",           // <- (in function context)

  // Special
  NEWLINE = "NEWLINE",
  EOF = "EOF",
}

export interface Token {
  type: TokenType;
  lexeme: string;
  literal: unknown;
  line: number;
  column: number;
}

export const KEYWORDS: Record<string, TokenType> = Object.create(null, {
  let: { value: TokenType.LET, enumerable: true },
  maybe: { value: TokenType.MAYBE, enumerable: true },
  true: { value: TokenType.TRUE, enumerable: true },
  false: { value: TokenType.FALSE, enumerable: true },
  await: { value: TokenType.AWAIT, enumerable: true },
  context: { value: TokenType.CONTEXT, enumerable: true },
  provide: { value: TokenType.PROVIDE, enumerable: true },
  decorator: { value: TokenType.DECORATOR, enumerable: true },
});

export const createToken = (
  type: TokenType,
  lexeme: string,
  literal: unknown,
  line: number,
  column: number
): Token => ({ type, lexeme, literal, line, column });

export enum TokenType {
  // Literals
  NUMBER = "NUMBER",
  STRING = "STRING",
  TEMPLATE_STRING = "TEMPLATE_STRING",  // `hello {name}`
  IDENTIFIER = "IDENTIFIER",

  // Keywords
  LET = "LET",
  AND = "AND",
  MAYBE = "MAYBE",
  TRUE = "TRUE",
  FALSE = "FALSE",
  AWAIT = "AWAIT",
  CONTEXT = "CONTEXT",
  PROVIDE = "PROVIDE",
  DECORATOR = "DECORATOR",
  MATCH = "MATCH",
  IF = "IF",
  RETURN = "RETURN",       // return keyword for early return
  INPUT = "INPUT",         // input keyword for placeholder/matched value
  USE = "USE",             // use keyword for module imports

  // Operators
  PIPE = "PIPE",           // />
  SPREAD_PIPE = "SPREAD_PIPE", // />>>
  PARALLEL_PIPE = "PARALLEL_PIPE", // \>
  ARROW = "ARROW",         // ->
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
  SPREAD = "SPREAD",       // ...
  UNDERSCORE = "UNDERSCORE", // _
  HASH = "HASH",           // #
  AT = "AT",               // @
  PIPE_CHAR = "PIPE_CHAR", // | (for pattern matching)

  // Codeblocks
  CODEBLOCK_OPEN = "CODEBLOCK_OPEN",   // <>
  CODEBLOCK_CLOSE = "CODEBLOCK_CLOSE", // </>

  // Reversible functions and bidirectional pipelines
  BIDIRECTIONAL_PIPE = "BIDIRECTIONAL_PIPE", // </>
  REVERSE_PIPE = "REVERSE_PIPE",             // </
  REVERSE_ARROW = "REVERSE_ARROW",           // <- (in function context)

  // Reactive pipelines
  REACTIVE_PIPE = "REACTIVE_PIPE",           // @>

  // Special
  NEWLINE = "NEWLINE",
  EOF = "EOF",
}

/** The literal value of a token:
 *  - number for NUMBER tokens
 *  - string for STRING tokens
 *  - string[] for TEMPLATE_STRING tokens (array of string parts between interpolations)
 *  - null for non-literal tokens
 */
export type TokenLiteral = number | string | string[] | null;

export interface Token {
  type: TokenType;
  lexeme: string;
  literal: TokenLiteral;
  line: number;
  column: number;
}

export const KEYWORDS: Record<string, TokenType> = Object.create(null, {
  let: { value: TokenType.LET, enumerable: true },
  and: { value: TokenType.AND, enumerable: true },
  maybe: { value: TokenType.MAYBE, enumerable: true },
  true: { value: TokenType.TRUE, enumerable: true },
  false: { value: TokenType.FALSE, enumerable: true },
  await: { value: TokenType.AWAIT, enumerable: true },
  context: { value: TokenType.CONTEXT, enumerable: true },
  provide: { value: TokenType.PROVIDE, enumerable: true },
  decorator: { value: TokenType.DECORATOR, enumerable: true },
  match: { value: TokenType.MATCH, enumerable: true },
  if: { value: TokenType.IF, enumerable: true },
  return: { value: TokenType.RETURN, enumerable: true },
  input: { value: TokenType.INPUT, enumerable: true },
  use: { value: TokenType.USE, enumerable: true },
});

export const createToken = (
  type: TokenType,
  lexeme: string,
  literal: TokenLiteral,
  line: number,
  column: number
): Token => ({ type, lexeme, literal, line, column });

export enum TokenType {
  // Literals
  NUMBER = "NUMBER",
  STRING = "STRING",
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
  CODEBLOCK = "CODEBLOCK",   // <>

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

export const KEYWORDS: Record<string, TokenType> = {
  let: TokenType.LET,
  maybe: TokenType.MAYBE,
  true: TokenType.TRUE,
  false: TokenType.FALSE,
  await: TokenType.AWAIT,
  context: TokenType.CONTEXT,
  provide: TokenType.PROVIDE,
  decorator: TokenType.DECORATOR,
};

export const createToken = (
  type: TokenType,
  lexeme: string,
  literal: unknown,
  line: number,
  column: number
): Token => ({ type, lexeme, literal, line, column });

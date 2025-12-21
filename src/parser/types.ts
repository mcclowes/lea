import { Token, TokenType } from "../token";
import { ParseError } from "../error-types";
export { ParseError } from "../error-types";

/**
 * Parser context containing state and utility methods.
 * Passed to all parsing functions to allow them to share state.
 */
export interface ParserContext {
  // State
  tokens: Token[];
  current: number;
  inParallelPipeBranch: boolean;
  inPipeOperand: boolean;

  // State mutators
  setCurrent(pos: number): void;
  setInParallelPipeBranch(value: boolean): void;
  setInPipeOperand(value: boolean): void;

  // Utility methods
  match(...types: TokenType[]): boolean;
  check(type: TokenType): boolean;
  advance(): Token;
  isAtEnd(): boolean;
  peek(): Token;
  previous(): Token;
  consume(type: TokenType, message: string): Token;
  skipNewlines(): void;
}

/**
 * Create a parser context from tokens
 */
export function createParserContext(tokens: Token[]): ParserContext {
  let current = 0;
  let inParallelPipeBranch = false;
  let inPipeOperand = false;

  const ctx: ParserContext = {
    get tokens() { return tokens; },
    get current() { return current; },
    get inParallelPipeBranch() { return inParallelPipeBranch; },
    get inPipeOperand() { return inPipeOperand; },

    setCurrent(pos: number) { current = pos; },
    setInParallelPipeBranch(value: boolean) { inParallelPipeBranch = value; },
    setInPipeOperand(value: boolean) { inPipeOperand = value; },

    match(...types: TokenType[]): boolean {
      for (const type of types) {
        if (ctx.check(type)) {
          ctx.advance();
          return true;
        }
      }
      return false;
    },

    check(type: TokenType): boolean {
      if (ctx.isAtEnd()) return false;
      return ctx.peek().type === type;
    },

    advance(): Token {
      if (!ctx.isAtEnd()) current++;
      return ctx.previous();
    },

    isAtEnd(): boolean {
      return ctx.peek().type === TokenType.EOF;
    },

    peek(): Token {
      return tokens[current];
    },

    previous(): Token {
      return tokens[current - 1];
    },

    consume(type: TokenType, message: string): Token {
      if (ctx.check(type)) return ctx.advance();
      throw new ParseError(message, ctx.peek());
    },

    skipNewlines(): void {
      while (ctx.match(TokenType.NEWLINE)) {
        // skip
      }
    },
  };

  return ctx;
}


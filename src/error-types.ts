/**
 * Centralized error types for the Lea language
 *
 * This module defines all error classes used throughout the Lea interpreter.
 * Having them in one place ensures consistent error handling and makes it
 * easier to add new error types or modify error behavior.
 */

import { Token } from "./token";

/**
 * Source location information for error reporting
 */
export interface SourceLocation {
  line: number;
  column: number;
  file?: string;
}

/**
 * Error thrown during lexical analysis (tokenization)
 */
export class LexerError extends Error {
  constructor(
    message: string,
    public line: number,
    public column: number
  ) {
    super(`[${line}:${column}] ${message}`);
    this.name = "LexerError";
  }
}

/**
 * Error thrown during parsing
 */
export class ParseError extends Error {
  constructor(
    message: string,
    public token: Token
  ) {
    super(`[${token.line}:${token.column}] ${message}`);
    this.name = "ParseError";
  }
}

/**
 * Error thrown during interpretation (runtime)
 */
export class RuntimeError extends Error {
  location?: SourceLocation;

  constructor(message: string, location?: SourceLocation) {
    const locationPrefix = location
      ? `[${location.file ? location.file + ":" : ""}${location.line}:${location.column}] `
      : "";
    super(`${locationPrefix}${message}`);
    this.name = "RuntimeError";
    this.location = location;
  }
}

/**
 * Used for early return - not a real error, just control flow
 * This is an internal mechanism to implement return statements
 * Note: value is typed as any to avoid circular dependency with LeaValue
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class ReturnValue extends Error {
  constructor(public value: any) {
    super("Return");
    this.name = "ReturnValue";
  }
}

/**
 * Shared test helpers for Lea unit tests
 *
 * Consolidates common test utilities used across lexer, parser,
 * interpreter, and other test files.
 */

import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { Interpreter, LeaValue } from '../src/interpreter';
import { Token } from '../src/token';
import { Program, Expr, Stmt } from '../src/ast';

// ============================================================================
// Lexer Helpers
// ============================================================================

/**
 * Tokenize source code and return all tokens
 */
export function tokenize(source: string): Token[] {
  const lexer = new Lexer(source);
  return lexer.scanTokens();
}

/**
 * Tokenize source code and return just the token types
 */
export function getTokenTypes(source: string): string[] {
  return tokenize(source).map((t) => t.type);
}

// ============================================================================
// Parser Helpers
// ============================================================================

/**
 * Parse source code and return the Program AST
 */
export function parse(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.scanTokens();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Parse source code and return the first expression
 */
export function parseExpr(source: string): Expr {
  const program = parse(source);
  const stmt = program.statements[0];
  if (stmt.kind === 'ExprStmt') {
    return stmt.expression;
  }
  throw new Error('Expected ExprStmt');
}

/**
 * Parse source code and return the first statement
 */
export function parseStmt(source: string): Stmt {
  const program = parse(source);
  return program.statements[0];
}

// ============================================================================
// Interpreter Helpers
// ============================================================================

/**
 * Evaluate source code synchronously and return the result
 */
export function evaluate(source: string, strictMode = false): LeaValue {
  const lexer = new Lexer(source);
  const tokens = lexer.scanTokens();
  const parser = new Parser(tokens);
  const program = parser.parse();
  const interpreter = new Interpreter(strictMode || program.strict);
  return interpreter.interpret(program);
}

/**
 * Evaluate source code asynchronously and return the result
 */
export async function evaluateAsync(source: string, strictMode = false): Promise<LeaValue> {
  const lexer = new Lexer(source);
  const tokens = lexer.scanTokens();
  const parser = new Parser(tokens);
  const program = parser.parse();
  const interpreter = new Interpreter(strictMode || program.strict);
  return interpreter.interpretAsync(program);
}

// ============================================================================
// Execution Pipeline Helpers
// ============================================================================

/**
 * Create an interpreter instance with the given source code ready to run
 * Useful for testing interpreter internals
 */
export function createTestInterpreter(source: string, strictMode = false) {
  const lexer = new Lexer(source);
  const tokens = lexer.scanTokens();
  const parser = new Parser(tokens);
  const program = parser.parse();
  const interpreter = new Interpreter(strictMode || program.strict);
  return { interpreter, program, tokens };
}

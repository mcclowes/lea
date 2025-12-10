/**
 * Interpreter context interface
 *
 * This module defines the InterpreterContext interface that provides access
 * to interpreter state and methods. It's passed to helper functions to allow
 * them to access interpreter functionality without tight coupling.
 */

import { Expr, Stmt, Decorator, CallExpr, FunctionExpr, BlockBody } from "../ast";
import {
  LeaValue,
  LeaFunction,
  LeaReversibleFunction,
  LeaPipeline,
  LeaBidirectionalPipeline,
  Environment,
} from "./types";

/**
 * Context object passed to interpreter helper functions.
 * Provides access to interpreter state and methods.
 */
export interface InterpreterContext {
  // State
  globals: Environment;
  memoCache: Map<string, Map<string, LeaValue>>;
  traceDepth: number;
  contextRegistry: Map<string, { default: LeaValue; current: LeaValue }>;
  customDecorators: Map<string, LeaFunction>;

  // State mutators
  setTraceDepth(depth: number): void;

  // Core evaluation methods (sync - primary for most code paths)
  evaluateExpr(expr: Expr, env: Environment): LeaValue;
  executeStmt(stmt: Stmt, env: Environment): LeaValue;

  // Core evaluation methods (async - for code with promises/await)
  evaluateExprAsync(expr: Expr, env: Environment): Promise<LeaValue>;
  executeStmtAsync(stmt: Stmt, env: Environment): Promise<LeaValue>;

  // Function methods
  createFunction(expr: FunctionExpr, env: Environment): LeaFunction;
  callFunction(fn: LeaFunction, args: LeaValue[]): LeaValue;
  callFunctionAsync(fn: LeaFunction, args: LeaValue[]): Promise<LeaValue>;

  // Pipe methods (sync and async)
  evaluatePipeWithValue(pipedValue: LeaValue, right: Expr, env: Environment, spreadIndex?: number): LeaValue;
  evaluatePipeWithValueAsync(pipedValue: LeaValue, right: Expr, env: Environment): Promise<LeaValue>;

  // Spread pipe methods (sync and async)
  evaluateSpreadPipeWithValue(leftValue: LeaValue, right: Expr, env: Environment): LeaValue;
  evaluateSpreadPipeWithValueAsync(leftValue: LeaValue, right: Expr, env: Environment): Promise<LeaValue>;

  // Pipeline methods (sync and async)
  applyPipeline(pipeline: LeaPipeline, args: LeaValue[]): LeaValue;
  applyPipelineAsync(pipeline: LeaPipeline, args: LeaValue[]): Promise<LeaValue>;

  // Call methods
  evaluateCall(expr: CallExpr, env: Environment, pipedValue?: LeaValue, spreadIndex?: number): LeaValue;
  evaluateCallAsync(expr: CallExpr, env: Environment, pipedValue?: LeaValue): Promise<LeaValue>;

  // Overload resolution
  resolveOverload(overloads: (LeaFunction | LeaReversibleFunction)[], args: LeaValue[]): LeaFunction | LeaReversibleFunction;

  // Type helpers
  getLeaType(val: LeaValue): string;
  matchesType(val: LeaValue, expectedType: string | { tuple: string[]; optional?: boolean } | { list: string; optional?: boolean }): boolean;
  formatType(t: string | { tuple: string[]; optional?: boolean } | { list: string; optional?: boolean }): string;

  // Pipeline helpers
  describeAnyStage(stage: { expr?: Expr; isParallel?: boolean; isSpread?: boolean; branches?: Expr[] }): string;
}

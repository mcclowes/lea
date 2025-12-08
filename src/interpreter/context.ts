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

  // Core evaluation methods
  evaluateExpr(expr: Expr, env: Environment): LeaValue;
  evaluateExprAsync(expr: Expr, env: Environment): Promise<LeaValue>;
  executeStmt(stmt: Stmt, env: Environment): LeaValue;
  executeStmtAsync(stmt: Stmt, env: Environment): Promise<LeaValue>;

  // Function methods
  createFunction(expr: FunctionExpr, env: Environment): LeaFunction;
  callFunction(fn: LeaFunction, args: LeaValue[]): LeaValue;
  callFunctionAsync(fn: LeaFunction, args: LeaValue[]): Promise<LeaValue>;

  // Pipe methods
  evaluatePipeWithValue(pipedValue: LeaValue, right: Expr, env: Environment): LeaValue;
  evaluatePipeWithValueAsync(pipedValue: LeaValue, right: Expr, env: Environment): Promise<LeaValue>;

  // Pipeline methods
  applyPipeline(pipeline: LeaPipeline, args: LeaValue[]): LeaValue;
  applyPipelineAsync(pipeline: LeaPipeline, args: LeaValue[]): Promise<LeaValue>;

  // Call methods
  evaluateCall(expr: CallExpr, env: Environment, pipedValue?: LeaValue): LeaValue;
  evaluateCallAsync(expr: CallExpr, env: Environment, pipedValue?: LeaValue): Promise<LeaValue>;

  // Overload resolution
  resolveOverload(overloads: LeaFunction[], args: LeaValue[]): LeaFunction;

  // Type helpers
  getLeaType(val: LeaValue): string;
  matchesType(val: LeaValue, expectedType: string | { tuple: string[]; optional?: boolean }): boolean;
  formatType(t: string | { tuple: string[]; optional?: boolean }): string;

  // Pipeline helpers
  describeAnyStage(stage: { expr?: Expr; isParallel?: boolean; branches?: Expr[] }): string;
}

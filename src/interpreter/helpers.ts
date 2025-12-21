/**
 * Helper functions for the Lea interpreter
 *
 * This module contains type guards, coercion functions, and utility functions
 * used throughout the interpreter.
 */

import { Expr, AnyPipelineStage, ParallelPipelineStage, SpreadPipelineStage } from "../ast";
import {
  LeaValue,
  LeaFunction,
  LeaBuiltin,
  LeaPromise,
  LeaParallelResult,
  LeaTuple,
  LeaOverloadSet,
  LeaPipeline,
  LeaBidirectionalPipeline,
  LeaReversibleFunction,
  LeaReactiveValue,
  LeaRecord,
  RuntimeError,
  Environment,
  LeaKind,
} from "./types";
import type { InterpreterContext } from "./context";

/**
 * Fast kind extraction - avoids repeated null/typeof/in checks.
 * Returns the kind string if val is a Lea object, or null otherwise.
 * This is the hot path for type checking.
 */
export function getKind(val: LeaValue): LeaKind | null {
  // Fast path: primitives and null
  if (val === null || typeof val !== "object") return null;
  // Fast path: arrays (most common non-primitive)
  if (Array.isArray(val)) return null;
  // Object with kind property
  return (val as { kind: LeaKind }).kind;
}

// Type guard for LeaPromise
export function isLeaPromise(val: LeaValue): val is LeaPromise {
  return getKind(val) === "promise";
}

// Type guard for LeaParallelResult
export function isParallelResult(val: LeaValue): val is LeaParallelResult {
  return getKind(val) === "parallel_result";
}

// Type guard for parallel pipeline stages
export function isParallelStage(stage: AnyPipelineStage): stage is ParallelPipelineStage {
  return stage.isParallel === true;
}

// Type guard for spread pipeline stages
export function isSpreadStage(stage: AnyPipelineStage): stage is SpreadPipelineStage {
  return stage.isSpread === true;
}

// Get the expr from a regular (non-parallel) stage
export function getStageExpr(stage: AnyPipelineStage): Expr {
  if (isParallelStage(stage)) {
    throw new RuntimeError("Cannot get expr from parallel stage");
  }
  return stage.expr;
}

// Type guard for LeaOverloadSet
export function isOverloadSet(val: LeaValue): val is LeaOverloadSet {
  return getKind(val) === "overload_set";
}

// Type guard for LeaPipeline
export function isPipeline(val: LeaValue): val is LeaPipeline {
  return getKind(val) === "pipeline";
}

// Type guard for LeaBidirectionalPipeline
export function isBidirectionalPipeline(val: LeaValue): val is LeaBidirectionalPipeline {
  return getKind(val) === "bidirectional_pipeline";
}

// Type guard for LeaReversibleFunction
export function isReversibleFunction(val: LeaValue): val is LeaReversibleFunction {
  return getKind(val) === "reversible_function";
}

// Type guard for LeaFunction
export function isLeaFunction(val: LeaValue): val is LeaFunction {
  return getKind(val) === "function";
}

// Type guard for LeaBuiltin
export function isLeaBuiltin(val: LeaValue): val is LeaBuiltin {
  return getKind(val) === "builtin";
}

// Type guard for LeaTuple
export function isLeaTuple(val: LeaValue): val is LeaTuple {
  return getKind(val) === "tuple";
}

// Type guard for LeaReactiveValue
export function isReactiveValue(val: LeaValue): val is LeaReactiveValue {
  return getKind(val) === "reactive";
}

// Type guard for LeaRecord
export function isRecord(val: LeaValue): val is LeaRecord {
  return getKind(val) === "record";
}

// Convenience aliases
export const isFunction = isLeaFunction;
export const isBuiltin = isLeaBuiltin;
export const isTuple = isLeaTuple;

// Unwrap a LeaPromise to its underlying value
export async function unwrapPromise(val: LeaValue): Promise<LeaValue> {
  if (isLeaPromise(val)) {
    return val.promise;
  }
  return val;
}

// Wrap a Promise in a LeaPromise
export function wrapPromise(promise: Promise<LeaValue>): LeaPromise {
  return { kind: "promise", promise };
}

// Coerce value to number or throw
export function asNumber(val: LeaValue): number {
  if (typeof val !== "number") throw new RuntimeError(`Expected number, got ${typeof val}`);
  return val;
}

// Coerce value to list or throw
export function asList(val: LeaValue): LeaValue[] {
  if (!Array.isArray(val)) throw new RuntimeError(`Expected list, got ${typeof val}`);
  return val;
}

// Cached Interpreter class and singleton instance for asFunction
// Uses dynamic require to avoid circular dependency
let _InterpreterClass: (new () => InterpreterContext) | null = null;
let _interpreterInstance: InterpreterContext | null = null;

function getInterpreter(): InterpreterContext {
  if (_interpreterInstance === null) {
    if (_InterpreterClass === null) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      _InterpreterClass = require("./index").Interpreter;
    }
    _interpreterInstance = new _InterpreterClass!();
  }
  return _interpreterInstance;
}

// Coerce value to callable function
// Uses getKind for fast type dispatch
export function asFunction(val: LeaValue): (args: LeaValue[]) => LeaValue {
  const kind = getKind(val);

  if (kind === "function") {
    const fn = val as LeaFunction;
    return (args: LeaValue[]) => {
      const env = new Environment(fn.closure);
      const params = fn.params;
      for (let i = 0; i < params.length; i++) {
        const param = params[i];
        if (param.name !== "_") {
          env.define(param.name, args[i] ?? null, false);
        }
      }
      // Note: This is a simplified version - the real implementation uses the Interpreter
      // This is primarily used by builtin functions like map/filter/reduce
      // Use cached interpreter instance to avoid repeated construction
      const interp = getInterpreter();
      if (fn.body.kind === "BlockBody") {
        for (const stmt of fn.body.statements) {
          interp.executeStmt(stmt, env);
        }
        return interp.evaluateExpr(fn.body.result, env);
      }
      return interp.evaluateExpr(fn.body, env);
    };
  }

  if (kind === "builtin") {
    const builtin = val as LeaBuiltin;
    return (args: LeaValue[]) => {
      const result = builtin.fn(args);
      // Handle async builtins
      if (result instanceof Promise) {
        return wrapPromise(result);
      }
      return result;
    };
  }

  throw new RuntimeError("Expected function");
}

// Check if a value is truthy
export function isTruthy(val: LeaValue): boolean {
  if (val === null) return false;
  if (typeof val === "boolean") return val;
  return true;
}

// Convert value to string for display
// Uses switch for faster dispatch on kind
export function stringify(val: LeaValue): string {
  if (val === null) return "null";
  if (Array.isArray(val)) return `[${val.map(stringify).join(", ")}]`;

  const kind = getKind(val);
  if (kind === null) return String(val);

  switch (kind) {
    case "promise":
      return "<promise>";
    case "parallel_result":
      return `[${(val as LeaParallelResult).values.map(stringify).join(", ")}]`;
    case "tuple":
      return `(${(val as LeaTuple).elements.map(stringify).join(", ")})`;
    case "record": {
      const entries = Array.from((val as LeaRecord).fields.entries())
        .map(([k, v]) => `${k}: ${stringify(v)}`)
        .join(", ");
      return `{ ${entries} }`;
    }
    case "pipeline":
      return `<pipeline[${(val as LeaPipeline).stages.length}]>`;
    case "bidirectional_pipeline":
      return `<bidirectional_pipeline[${(val as LeaBidirectionalPipeline).stages.length}]>`;
    case "reversible_function":
      return "<reversible_function>";
    case "reactive":
      return `<reactive[${(val as LeaReactiveValue).sourceName}]>`;
    default:
      return "<function>";
  }
}

// Convert a LeaValue to a string for concatenation with ++
// Similar to stringify but designed for user-facing string coercion
export function coerceToString(val: LeaValue): string {
  if (val === null) return "null";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return String(val);
  if (Array.isArray(val)) return `[${val.map(coerceToString).join(", ")}]`;

  const kind = getKind(val);
  if (kind === null) return String(val);

  switch (kind) {
    case "promise":
      return "<promise>";
    case "parallel_result":
      return `[${(val as LeaParallelResult).values.map(coerceToString).join(", ")}]`;
    case "tuple":
      return `(${(val as LeaTuple).elements.map(coerceToString).join(", ")})`;
    case "record": {
      const entries = Array.from((val as LeaRecord).fields.entries())
        .map(([k, v]) => `${k}: ${coerceToString(v)}`)
        .join(", ");
      return `{ ${entries} }`;
    }
    default:
      return "<function>";
  }
}

// Get the Lea type name for a value
// Uses switch for faster dispatch on kind
export function getLeaType(val: LeaValue): string {
  if (val === null) return "null";
  if (typeof val === "number") return "int";
  if (typeof val === "string") return "string";
  if (typeof val === "boolean") return "bool";
  if (Array.isArray(val)) return "list";

  const kind = getKind(val);
  switch (kind) {
    case "function":
    case "builtin":
    case "reversible_function":
      return "function";
    case "tuple":
      return "tuple";
    case "pipeline":
    case "bidirectional_pipeline":
      return "pipeline";
    case "reactive":
      return "reactive";
    default:
      return "unknown";
  }
}

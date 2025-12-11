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
} from "./types";

// Type guard for LeaPromise
export function isLeaPromise(val: LeaValue): val is LeaPromise {
  return val !== null && typeof val === "object" && "kind" in val && val.kind === "promise";
}

// Type guard for LeaParallelResult
export function isParallelResult(val: LeaValue): val is LeaParallelResult {
  return val !== null && typeof val === "object" && "kind" in val && val.kind === "parallel_result";
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
  return val !== null && typeof val === "object" && "kind" in val && val.kind === "overload_set";
}

// Type guard for LeaPipeline
export function isPipeline(val: LeaValue): val is LeaPipeline {
  return val !== null && typeof val === "object" && "kind" in val && val.kind === "pipeline";
}

// Type guard for LeaBidirectionalPipeline
export function isBidirectionalPipeline(val: LeaValue): val is LeaBidirectionalPipeline {
  return val !== null && typeof val === "object" && "kind" in val && val.kind === "bidirectional_pipeline";
}

// Type guard for LeaReversibleFunction
export function isReversibleFunction(val: LeaValue): val is LeaReversibleFunction {
  return val !== null && typeof val === "object" && "kind" in val && val.kind === "reversible_function";
}

// Type guard for LeaFunction
export function isLeaFunction(val: LeaValue): val is LeaFunction {
  return val !== null && typeof val === "object" && "kind" in val && val.kind === "function";
}

// Type guard for LeaBuiltin
export function isLeaBuiltin(val: LeaValue): val is LeaBuiltin {
  return val !== null && typeof val === "object" && "kind" in val && val.kind === "builtin";
}

// Type guard for LeaTuple
export function isLeaTuple(val: LeaValue): val is LeaTuple {
  return val !== null && typeof val === "object" && "kind" in val && val.kind === "tuple";
}

// Type guard for LeaReactiveValue
export function isReactiveValue(val: LeaValue): val is LeaReactiveValue {
  return val !== null && typeof val === "object" && "kind" in val && val.kind === "reactive";
}

// Type guard for LeaRecord
export function isRecord(val: LeaValue): val is LeaRecord {
  return val !== null && typeof val === "object" && "kind" in val && val.kind === "record";
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
let _Interpreter: any = null;
let _interpreterInstance: any = null;

function getInterpreter(): any {
  if (_interpreterInstance === null) {
    if (_Interpreter === null) {
      _Interpreter = require("./index").Interpreter;
    }
    _interpreterInstance = new _Interpreter();
  }
  return _interpreterInstance;
}

// Coerce value to callable function
export function asFunction(val: LeaValue): (args: LeaValue[]) => LeaValue {
  if (val && typeof val === "object" && "kind" in val && val.kind === "function") {
    const fn = val as LeaFunction;
    return (args: LeaValue[]) => {
      const env = new Environment(fn.closure);
      fn.params.forEach((param, i) => {
        if (param.name === "_") return; // Skip ignored parameters
        env.define(param.name, args[i] ?? null, false);
      });
      // Note: This is a simplified version - the real implementation uses the Interpreter
      // This is primarily used by builtin functions like map/filter/reduce
      // Use cached interpreter instance to avoid repeated construction
      const interp = getInterpreter();
      if (fn.body.kind === "BlockBody") {
        for (const stmt of fn.body.statements) {
          interp["executeStmt"](stmt, env);
        }
        return interp.evaluateExpr(fn.body.result, env);
      }
      return interp.evaluateExpr(fn.body, env);
    };
  }
  if (val && typeof val === "object" && "kind" in val && val.kind === "builtin") {
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
export function stringify(val: LeaValue): string {
  if (val === null) return "null";
  if (Array.isArray(val)) return `[${val.map(stringify).join(", ")}]`;
  if (typeof val === "object" && "kind" in val) {
    if (val.kind === "promise") return "<promise>";
    if (val.kind === "parallel_result") return `[${val.values.map(stringify).join(", ")}]`;
    if (val.kind === "tuple") return `(${val.elements.map(stringify).join(", ")})`;
    if (val.kind === "record") {
      const entries = Array.from(val.fields.entries())
        .map(([k, v]) => `${k}: ${stringify(v)}`)
        .join(", ");
      return `{ ${entries} }`;
    }
    if (val.kind === "pipeline") {
      return `<pipeline[${val.stages.length}]>`;
    }
    if (val.kind === "bidirectional_pipeline") {
      return `<bidirectional_pipeline[${val.stages.length}]>`;
    }
    if (val.kind === "reversible_function") {
      return "<reversible_function>";
    }
    if (val.kind === "reactive") {
      return `<reactive[${val.sourceName}]>`;
    }
    return "<function>";
  }
  return String(val);
}

// Convert a LeaValue to a string for concatenation with ++
// Similar to stringify but designed for user-facing string coercion
export function coerceToString(val: LeaValue): string {
  if (val === null) return "null";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return String(val);
  if (Array.isArray(val)) return `[${val.map(coerceToString).join(", ")}]`;
  if (typeof val === "object" && "kind" in val) {
    if (val.kind === "promise") return "<promise>";
    if (val.kind === "parallel_result") return `[${val.values.map(coerceToString).join(", ")}]`;
    if (val.kind === "tuple") return `(${val.elements.map(coerceToString).join(", ")})`;
    if (val.kind === "record") {
      const entries = Array.from(val.fields.entries())
        .map(([k, v]) => `${k}: ${coerceToString(v)}`)
        .join(", ");
      return `{ ${entries} }`;
    }
    return "<function>";
  }
  return String(val);
}

// Get the Lea type name for a value
export function getLeaType(val: LeaValue): string {
  if (val === null) return "null";
  if (typeof val === "number") return "int";
  if (typeof val === "string") return "string";
  if (typeof val === "boolean") return "bool";
  if (Array.isArray(val)) return "list";
  if (typeof val === "object" && "kind" in val) {
    if (val.kind === "function") return "function";
    if (val.kind === "builtin") return "function";
    if (val.kind === "reversible_function") return "function";
    if (val.kind === "tuple") return "tuple";
    if (val.kind === "pipeline") return "pipeline";
    if (val.kind === "bidirectional_pipeline") return "pipeline";
    if (val.kind === "reactive") return "reactive";
  }
  return "unknown";
}

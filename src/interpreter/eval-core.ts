/**
 * Shared evaluation core for the Lea interpreter
 *
 * This module contains pure functions that can be shared between
 * synchronous and asynchronous evaluation paths. These functions
 * contain no async/await and do not depend on interpreter state.
 */

import { TokenType } from "../token";
import { FunctionParam } from "../ast";
import {
  LeaValue,
  LeaFunction,
  LeaRecord,
  LeaTuple,
  RuntimeError,
  Environment,
} from "./types";
import { asNumber, coerceToString } from "./helpers";

/**
 * Evaluate a binary operation on two values.
 * This is a pure function - no side effects, no async.
 *
 * Note: Reactive value unwrapping must be done by the caller before
 * calling this function, as it requires interpreter context.
 */
export function evaluateBinaryOp(
  op: TokenType,
  left: LeaValue,
  right: LeaValue,
  isEqualFn: (a: LeaValue, b: LeaValue) => boolean
): LeaValue {
  switch (op) {
    case TokenType.PLUS:
      return asNumber(left) + asNumber(right);
    case TokenType.MINUS:
      return asNumber(left) - asNumber(right);
    case TokenType.STAR:
      return asNumber(left) * asNumber(right);
    case TokenType.SLASH: {
      const rightNum = asNumber(right);
      if (rightNum === 0) {
        throw new RuntimeError("Division by zero");
      }
      return asNumber(left) / rightNum;
    }
    case TokenType.PERCENT: {
      const rightNum = asNumber(right);
      if (rightNum === 0) {
        throw new RuntimeError("Modulo by zero");
      }
      return asNumber(left) % rightNum;
    }
    case TokenType.CONCAT:
      return coerceToString(left) + coerceToString(right);
    case TokenType.EQEQ:
      return isEqualFn(left, right);
    case TokenType.NEQ:
      return !isEqualFn(left, right);
    case TokenType.LT:
      return asNumber(left) < asNumber(right);
    case TokenType.GT:
      return asNumber(left) > asNumber(right);
    case TokenType.LTE:
      return asNumber(left) <= asNumber(right);
    case TokenType.GTE:
      return asNumber(left) >= asNumber(right);
    default:
      throw new RuntimeError(`Unknown binary operator`);
  }
}

/**
 * Deep equality comparison for Lea values.
 * This is recursive and handles arrays.
 */
export function isEqual(a: LeaValue, b: LeaValue): boolean {
  // Fast path: reference equality handles primitives and same-object cases
  if (a === b) return true;
  // Null checks after reference equality (if both null, caught above)
  if (a === null || b === null) return false;
  // Array comparison
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isEqual(a[i], b[i])) return false;
    }
    return true;
  }
  // Tuple comparison
  if (
    a !== null && typeof a === "object" && "kind" in a && a.kind === "tuple" &&
    b !== null && typeof b === "object" && "kind" in b && b.kind === "tuple"
  ) {
    const tupleA = a as LeaTuple;
    const tupleB = b as LeaTuple;
    if (tupleA.elements.length !== tupleB.elements.length) return false;
    for (let i = 0; i < tupleA.elements.length; i++) {
      if (!isEqual(tupleA.elements[i], tupleB.elements[i])) return false;
    }
    return true;
  }
  // Record comparison
  if (
    a !== null && typeof a === "object" && "kind" in a && a.kind === "record" &&
    b !== null && typeof b === "object" && "kind" in b && b.kind === "record"
  ) {
    const recordA = a as LeaRecord;
    const recordB = b as LeaRecord;
    if (recordA.fields.size !== recordB.fields.size) return false;
    for (const [key, value] of recordA.fields) {
      if (!recordB.fields.has(key)) return false;
      if (!isEqual(value, recordB.fields.get(key)!)) return false;
    }
    return true;
  }
  // Different types or non-equal primitives
  return false;
}

/**
 * Build an environment for a function call by binding parameters.
 * This is a pure function that creates the local scope.
 *
 * @param fn The function being called
 * @param args The arguments passed to the function
 * @param evaluateDefault A callback to evaluate default parameter values
 * @returns The new environment with parameters bound
 */
export function buildFunctionEnv(
  fn: LeaFunction,
  args: LeaValue[],
  evaluateDefault: (defaultValue: NonNullable<FunctionParam["defaultValue"]>) => LeaValue
): Environment {
  const localEnv = new Environment(fn.closure);

  // Bind parameters, using default values if argument not provided
  // Skip parameters named '_' (ignored/discarded parameters)
  fn.params.forEach((param, i) => {
    if (param.name === "_") return; // Skip ignored parameters
    let value = args[i];
    if ((value === undefined || value === null) && param.defaultValue) {
      value = evaluateDefault(param.defaultValue);
    }
    localEnv.define(param.name, value ?? null, false);
  });

  return localEnv;
}

/**
 * Handle record destructuring pattern.
 * Extracts fields from a record and defines them in the environment.
 */
export function destructureRecord(
  value: LeaValue,
  fields: string[],
  env: Environment,
  mutable: boolean
): void {
  if (!value || typeof value !== "object" || !("kind" in value) || value.kind !== "record") {
    throw new RuntimeError("Cannot destructure non-record value with record pattern");
  }
  const record = value as LeaRecord;
  for (const field of fields) {
    if (!record.fields.has(field)) {
      throw new RuntimeError(`Record does not have field '${field}'`);
    }
    env.define(field, record.fields.get(field)!, mutable);
  }
}

/**
 * Handle tuple/list destructuring pattern.
 * Extracts elements from a tuple or list and defines them in the environment.
 */
export function destructureTuple(
  value: LeaValue,
  names: string[],
  env: Environment,
  mutable: boolean
): void {
  if (value && typeof value === "object" && "kind" in value && value.kind === "tuple") {
    const tuple = value as LeaTuple;
    if (tuple.elements.length < names.length) {
      throw new RuntimeError(
        `Tuple has ${tuple.elements.length} elements but pattern expects ${names.length}`
      );
    }
    for (let i = 0; i < names.length; i++) {
      env.define(names[i], tuple.elements[i], mutable);
    }
  } else if (Array.isArray(value)) {
    if (value.length < names.length) {
      throw new RuntimeError(
        `List has ${value.length} elements but pattern expects ${names.length}`
      );
    }
    for (let i = 0; i < names.length; i++) {
      env.define(names[i], value[i], mutable);
    }
  } else {
    throw new RuntimeError("Cannot destructure non-tuple/non-list value with tuple pattern");
  }
}

/**
 * Check if a pattern matches a value (for match expressions).
 * Returns true if the value matches the pattern.
 */
export function patternMatches(
  pattern: { kind: string; name?: string; value?: number | string | boolean },
  value: LeaValue
): boolean {
  switch (pattern.kind) {
    case "WildcardPattern":
      return true;
    case "IdentifierPattern":
      // Identifier patterns always match (they bind the value)
      return true;
    case "LiteralPattern":
      return value === pattern.value;
    default:
      return false;
  }
}

/**
 * Bind pattern variables to the matched value.
 * Call this after patternMatches returns true.
 */
export function bindPattern(
  pattern: { kind: string; name?: string },
  value: LeaValue,
  env: Environment
): void {
  if (pattern.kind === "IdentifierPattern" && pattern.name) {
    env.define(pattern.name, value, false);
  }
  // Wildcard patterns don't bind anything
  // Literal patterns don't bind anything
}

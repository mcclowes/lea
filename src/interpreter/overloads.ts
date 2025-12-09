/**
 * Overload resolution for the Lea interpreter
 *
 * This module contains functions for resolving function overloads
 * and type matching.
 */

import {
  LeaValue,
  LeaFunction,
  LeaTuple,
  RuntimeError,
} from "./types";
import { getLeaType } from "./helpers";

/**
 * Check if a value matches an expected type annotation
 */
export function matchesType(
  val: LeaValue,
  expectedType: string | { tuple: string[]; optional?: boolean } | { list: string; optional?: boolean }
): boolean {
  // Handle optional types - if optional and value is null, it's valid
  if (typeof expectedType === "object" && expectedType.optional && val === null) {
    return true;
  }

  // Handle optional string types like "?Int"
  if (typeof expectedType === "string" && expectedType.startsWith("?")) {
    if (val === null) return true;
    expectedType = expectedType.slice(1); // Remove the ?
  }

  // Handle tuple types
  if (typeof expectedType === "object" && "tuple" in expectedType) {
    if (typeof val !== "object" || val === null || !("kind" in val) || val.kind !== "tuple") {
      return false;
    }
    const tuple = val as LeaTuple;
    if (tuple.elements.length !== expectedType.tuple.length) {
      return false;
    }
    return expectedType.tuple.every((t, i) => matchesType(tuple.elements[i], t));
  }

  // Handle list types like { list: "Int" }
  if (typeof expectedType === "object" && "list" in expectedType) {
    if (!Array.isArray(val)) {
      return false;
    }
    const elementType = expectedType.list;
    // All elements must match the expected element type
    return val.every((element) => matchesType(element, elementType));
  }

  // Simple type comparison
  const actualType = getLeaType(val);
  return actualType === expectedType.toLowerCase();
}

/**
 * Format a type annotation for error messages
 */
export function formatType(t: string | { tuple: string[]; optional?: boolean } | { list: string; optional?: boolean }): string {
  if (typeof t === "string") return t;
  if ("list" in t) {
    const listStr = `[${t.list}]`;
    return t.optional ? `?${listStr}` : listStr;
  }
  const tupleStr = `(${t.tuple.join(", ")})`;
  return t.optional ? `?${tupleStr}` : tupleStr;
}

/**
 * Score how well a function matches the given arguments
 * Returns -1 if no match, higher positive score = better match
 */
export function scoreOverloadMatch(fn: LeaFunction, args: LeaValue[]): number {
  const paramCount = fn.params.length;
  const requiredParams = fn.params.filter((p) => !p.defaultValue).length;

  // Check arity - args must be between required and total params
  if (args.length < requiredParams || args.length > paramCount) {
    return -1;
  }

  // If no type signature, this is a fallback overload (lowest priority)
  if (!fn.typeSignature || fn.typeSignature.paramTypes.length === 0) {
    // Return 0 for functions without type signatures - they match any types
    // but with lowest priority
    return 0;
  }

  // Score based on type matching
  let score = 1; // Base score for having type annotations
  const paramTypes = fn.typeSignature.paramTypes;

  for (let i = 0; i < args.length; i++) {
    const expectedType = paramTypes[i];
    const arg = args[i];

    if (expectedType === undefined) {
      // More args than typed params - still ok if function accepts them
      continue;
    }

    if (!matchesType(arg, expectedType)) {
      return -1; // Type mismatch
    }

    // Exact type match gets bonus points
    score += 10;
  }

  return score;
}

/**
 * Resolve the best matching overload from an overload set
 */
export function resolveOverload(overloads: LeaFunction[], args: LeaValue[]): LeaFunction {
  const candidates: { fn: LeaFunction; score: number }[] = [];

  for (const fn of overloads) {
    const score = scoreOverloadMatch(fn, args);
    if (score >= 0) {
      candidates.push({ fn, score });
    }
  }

  if (candidates.length === 0) {
    // No matching overload found - generate helpful error message
    const argTypes = args.map((a) => getLeaType(a)).join(", ");
    const availableSignatures = overloads
      .map((fn) => {
        if (fn.typeSignature) {
          const paramTypes = fn.typeSignature.paramTypes.map((t) => formatType(t)).join(", ");
          const returnType = fn.typeSignature.returnType ? formatType(fn.typeSignature.returnType) : "?";
          return `  (${paramTypes}) :> ${returnType}`;
        }
        return `  (${fn.params.map((p) => p.name).join(", ")})`;
      })
      .join("\n");
    throw new RuntimeError(
      `No matching overload for arguments (${argTypes}).\nAvailable overloads:\n${availableSignatures}`
    );
  }

  // Sort by score (higher is better - more specific match)
  candidates.sort((a, b) => b.score - a.score);

  // Check for ambiguity - if top two have same score, it's ambiguous
  if (candidates.length > 1 && candidates[0].score === candidates[1].score) {
    const argTypes = args.map((a) => getLeaType(a)).join(", ");
    throw new RuntimeError(
      `Ambiguous overload call for arguments (${argTypes}) - multiple overloads match equally well`
    );
  }

  return candidates[0].fn;
}

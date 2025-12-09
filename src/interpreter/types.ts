/**
 * Interpreter types for the Lea language
 *
 * This module contains all the core value types used by the interpreter,
 * as well as error classes and the Environment class for lexical scoping.
 */

import {
  Expr,
  FunctionParam,
  Decorator,
  BlockBody,
  TypeSignature,
  PipelineTypeSignature,
  AnyPipelineStage,
} from "../ast";

export interface LeaFunction {
  kind: "function";
  params: FunctionParam[];
  attachments: string[];
  body: Expr | BlockBody;
  closure: Environment;
  decorators: Decorator[];
  returnType?: string;  // Old style (deprecated)
  typeSignature?: TypeSignature;  // New :: (types) :> ReturnType style
  isReverse?: boolean;  // True if this is a reverse function definition
}

export interface LeaRecord {
  kind: "record";
  fields: Map<string, LeaValue>;
}

export interface LeaBuiltin {
  kind: "builtin";
  fn: (args: LeaValue[]) => LeaValue | Promise<LeaValue>;
}

export interface LeaPromise {
  kind: "promise";
  promise: Promise<LeaValue>;
}

// Special marker for results from parallel pipes, which should be spread when piped
export interface LeaParallelResult {
  kind: "parallel_result";
  values: LeaValue[];
}

export interface LeaTuple {
  kind: "tuple";
  elements: LeaValue[];
}

export interface LeaOverloadSet {
  kind: "overload_set";
  overloads: (LeaFunction | LeaReversibleFunction)[];
}

// A pipeline is a first-class value representing a composable chain of transformations
export interface LeaPipeline {
  kind: "pipeline";
  stages: AnyPipelineStage[];  // Each stage: regular expr or parallel branches
  closure: Environment;        // Captured environment for evaluating the stages
  decorators: Decorator[];     // Decorators applied to the pipeline
  memoCache?: Map<string, LeaValue>;  // Optional cache for #memo decorator
  typeSignature?: PipelineTypeSignature;  // Optional input/output type signature
}

// A bidirectional pipeline that can be applied in either direction
export interface LeaBidirectionalPipeline {
  kind: "bidirectional_pipeline";
  stages: { expr: Expr }[];  // Each stage holds an AST expression to apply
  closure: Environment;       // Captured environment for evaluating the stages
  decorators: Decorator[];    // Decorators applied to the pipeline
  typeSignature?: PipelineTypeSignature;  // Optional input/output type signature
}

// A reversible function that has both forward and reverse implementations
export interface LeaReversibleFunction {
  kind: "reversible_function";
  forward: LeaFunction;  // The forward transformation
  reverse: LeaFunction;  // The reverse transformation
}

// A reactive value that re-evaluates when its source changes
// Uses lazy evaluation - only recomputes on .value access when dirty
export interface LeaReactiveValue {
  kind: "reactive";
  sourceName: string;           // Name of the source variable being tracked
  stages: AnyPipelineStage[];   // Pipeline stages to apply
  closure: Environment;         // Captured environment for evaluating stages
  cachedValue: LeaValue | null; // Cached result from last evaluation
  dirty: boolean;               // True if source has changed since last eval
}

export type LeaValue =
  | number
  | string
  | boolean
  | LeaValue[]
  | LeaFunction
  | LeaBuiltin
  | LeaPromise
  | LeaRecord
  | LeaParallelResult
  | LeaTuple
  | LeaOverloadSet
  | LeaPipeline
  | LeaBidirectionalPipeline
  | LeaReversibleFunction
  | LeaReactiveValue
  | null;

export class RuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeError";
  }
}

// Used for early return - not a real error, just control flow
export class ReturnValue extends Error {
  constructor(public value: LeaValue) {
    super("Return");
    this.name = "ReturnValue";
  }
}

export class Environment {
  private values = new Map<string, { value: LeaValue; mutable: boolean }>();
  private parent: Environment | null;
  // Track reactive values that depend on each source variable
  private reactivesBySource = new Map<string, Set<LeaReactiveValue>>();

  constructor(parent: Environment | null = null) {
    this.parent = parent;
  }

  // Register a reactive value as depending on a source variable
  registerReactive(sourceName: string, reactive: LeaReactiveValue): void {
    if (!this.reactivesBySource.has(sourceName)) {
      this.reactivesBySource.set(sourceName, new Set());
    }
    this.reactivesBySource.get(sourceName)!.add(reactive);
    // Also register in parent if variable is defined there
    if (this.parent && !this.values.has(sourceName)) {
      this.parent.registerReactive(sourceName, reactive);
    }
  }

  // Mark all reactive values depending on a source as dirty
  private markReactivesDirty(name: string): void {
    const reactives = this.reactivesBySource.get(name);
    if (reactives) {
      for (const reactive of reactives) {
        reactive.dirty = true;
      }
    }
    // Also check parent scopes
    if (this.parent) {
      this.parent.markReactivesDirty(name);
    }
  }

  define(name: string, value: LeaValue, mutable: boolean): void {
    this.values.set(name, { value, mutable });
  }

  // Add a function overload - creates or extends an overload set
  addOverload(name: string, fn: LeaFunction): void {
    const existing = this.values.get(name);

    if (existing === undefined) {
      // First definition with this name - create an overload set
      const overloadSet: LeaOverloadSet = {
        kind: "overload_set",
        overloads: [fn],
      };
      this.values.set(name, { value: overloadSet, mutable: false });
    } else if (
      existing.value !== null &&
      typeof existing.value === "object" &&
      "kind" in existing.value &&
      existing.value.kind === "overload_set"
    ) {
      // Already an overload set - add to it
      (existing.value as LeaOverloadSet).overloads.push(fn);
    } else if (
      existing.value !== null &&
      typeof existing.value === "object" &&
      "kind" in existing.value &&
      existing.value.kind === "function"
    ) {
      // Convert existing single function to an overload set
      const existingFn = existing.value as LeaFunction;
      const overloadSet: LeaOverloadSet = {
        kind: "overload_set",
        overloads: [existingFn, fn],
      };
      this.values.set(name, { value: overloadSet, mutable: false });
    } else if (
      existing.value !== null &&
      typeof existing.value === "object" &&
      "kind" in existing.value &&
      existing.value.kind === "reversible_function"
    ) {
      // Convert existing reversible function to an overload set
      const existingFn = existing.value as LeaReversibleFunction;
      const overloadSet: LeaOverloadSet = {
        kind: "overload_set",
        overloads: [existingFn, fn],
      };
      this.values.set(name, { value: overloadSet, mutable: false });
    } else {
      throw new RuntimeError(`Cannot overload '${name}' - existing binding is not a function`);
    }
  }

  // Check if a name exists in this scope (not parent)
  hasInCurrentScope(name: string): boolean {
    return this.values.has(name);
  }

  // Add a reverse function to an existing forward function, creating a reversible function
  addReverse(name: string, reverse: LeaFunction): void {
    const existing = this.values.get(name);

    if (existing === undefined) {
      throw new RuntimeError(`Cannot add reverse to '${name}' - no forward function defined`);
    }

    if (
      existing.value !== null &&
      typeof existing.value === "object" &&
      "kind" in existing.value &&
      existing.value.kind === "function"
    ) {
      // Convert existing single function to a reversible function
      const forward = existing.value as LeaFunction;
      const reversibleFn: LeaReversibleFunction = {
        kind: "reversible_function",
        forward,
        reverse,
      };
      this.values.set(name, { value: reversibleFn, mutable: false });
    } else if (
      existing.value !== null &&
      typeof existing.value === "object" &&
      "kind" in existing.value &&
      existing.value.kind === "reversible_function"
    ) {
      // Already a reversible function - update the reverse
      (existing.value as LeaReversibleFunction).reverse = reverse;
    } else if (
      existing.value !== null &&
      typeof existing.value === "object" &&
      "kind" in existing.value &&
      existing.value.kind === "overload_set"
    ) {
      // Overload set - find the matching overload and make it reversible
      const overloadSet = existing.value as LeaOverloadSet;
      // Find an overload with matching type signature to make reversible
      // The reverse function's type signature should match one of the overloads
      const reverseTypes = reverse.typeSignature;

      let foundMatch = false;
      for (let i = 0; i < overloadSet.overloads.length; i++) {
        const overload = overloadSet.overloads[i];
        // Get the forward function from the overload (could be LeaFunction or LeaReversibleFunction)
        const forwardFn = overload.kind === "reversible_function"
          ? (overload as LeaReversibleFunction).forward
          : overload as LeaFunction;

        // Check if type signatures match (if both have them)
        if (reverseTypes && forwardFn.typeSignature) {
          const forwardTypes = forwardFn.typeSignature;
          // Compare param types and return types
          const paramsMatch = JSON.stringify(reverseTypes.paramTypes) === JSON.stringify(forwardTypes.paramTypes);
          const returnMatch = JSON.stringify(reverseTypes.returnType) === JSON.stringify(forwardTypes.returnType);

          if (paramsMatch && returnMatch) {
            // Found matching overload - convert to reversible
            if (overload.kind === "reversible_function") {
              // Already reversible - update the reverse
              (overload as LeaReversibleFunction).reverse = reverse;
            } else {
              // Convert to reversible
              overloadSet.overloads[i] = {
                kind: "reversible_function",
                forward: forwardFn,
                reverse,
              };
            }
            foundMatch = true;
            break;
          }
        }
      }

      if (!foundMatch) {
        // No matching type signature found - add reverse to the last overload
        // This handles the case where no type signatures are specified
        const lastIdx = overloadSet.overloads.length - 1;
        const lastOverload = overloadSet.overloads[lastIdx];

        if (lastOverload.kind === "reversible_function") {
          (lastOverload as LeaReversibleFunction).reverse = reverse;
        } else {
          overloadSet.overloads[lastIdx] = {
            kind: "reversible_function",
            forward: lastOverload as LeaFunction,
            reverse,
          };
        }
      }
    } else {
      throw new RuntimeError(`Cannot add reverse to '${name}' - existing binding is not a function`);
    }
  }

  // Check if a variable is defined (including parent scopes)
  has(name: string): boolean {
    if (this.values.has(name)) return true;
    if (this.parent) return this.parent.has(name);
    return false;
  }

  get(name: string): LeaValue {
    const entry = this.values.get(name);
    if (entry !== undefined) return entry.value;
    if (this.parent) return this.parent.get(name);
    throw new RuntimeError(`Undefined variable '${name}'`);
  }

  assign(name: string, value: LeaValue): void {
    const entry = this.values.get(name);
    if (entry !== undefined) {
      if (!entry.mutable) {
        throw new RuntimeError(`Cannot reassign immutable variable '${name}'`);
      }
      entry.value = value;
      // Mark any reactive values depending on this source as dirty
      this.markReactivesDirty(name);
      return;
    }
    if (this.parent) {
      this.parent.assign(name, value);
      return;
    }
    throw new RuntimeError(`Undefined variable '${name}'`);
  }
}

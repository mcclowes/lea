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
  overloads: LeaFunction[];
}

// A pipeline is a first-class value representing a composable chain of transformations
export interface LeaPipeline {
  kind: "pipeline";
  stages: AnyPipelineStage[];  // Each stage: regular expr or parallel branches
  closure: Environment;        // Captured environment for evaluating the stages
  decorators: Decorator[];     // Decorators applied to the pipeline
  memoCache?: Map<string, LeaValue>;  // Optional cache for #memo decorator
}

// A bidirectional pipeline that can be applied in either direction
export interface LeaBidirectionalPipeline {
  kind: "bidirectional_pipeline";
  stages: { expr: Expr }[];  // Each stage holds an AST expression to apply
  closure: Environment;       // Captured environment for evaluating the stages
  decorators: Decorator[];    // Decorators applied to the pipeline
}

// A reversible function that has both forward and reverse implementations
export interface LeaReversibleFunction {
  kind: "reversible_function";
  forward: LeaFunction;  // The forward transformation
  reverse: LeaFunction;  // The reverse transformation
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

  constructor(parent: Environment | null = null) {
    this.parent = parent;
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
      return;
    }
    if (this.parent) {
      this.parent.assign(name, value);
      return;
    }
    throw new RuntimeError(`Undefined variable '${name}'`);
  }
}

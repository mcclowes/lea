import { TokenType } from "./token";
import {
  Expr,
  Stmt,
  Program,
  CallExpr,
  FunctionExpr,
  Decorator,
  FunctionParam,
  BlockBody,
  TypeSignature,
} from "./ast";

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
  stages: { expr: Expr }[];  // Each stage holds an AST expression to apply
  closure: Environment;       // Captured environment for evaluating the stages
}

// A bidirectional pipeline that can be applied in either direction
export interface LeaBidirectionalPipeline {
  kind: "bidirectional_pipeline";
  stages: { expr: Expr }[];  // Each stage holds an AST expression to apply
  closure: Environment;       // Captured environment for evaluating the stages
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

type BuiltinFn = (args: LeaValue[]) => LeaValue | Promise<LeaValue>;

// Helper to check if a value is a LeaPromise
function isLeaPromise(val: LeaValue): val is LeaPromise {
  return val !== null && typeof val === "object" && "kind" in val && val.kind === "promise";
}

// Helper to check if a value is a LeaParallelResult
function isParallelResult(val: LeaValue): val is LeaParallelResult {
  return val !== null && typeof val === "object" && "kind" in val && val.kind === "parallel_result";
}

// Helper to check if a value is a LeaOverloadSet
function isOverloadSet(val: LeaValue): val is LeaOverloadSet {
  return val !== null && typeof val === "object" && "kind" in val && val.kind === "overload_set";
}

// Helper to check if a value is a LeaPipeline
function isPipeline(val: LeaValue): val is LeaPipeline {
  return val !== null && typeof val === "object" && "kind" in val && val.kind === "pipeline";
}

// Helper to check if a value is a LeaBidirectionalPipeline
function isBidirectionalPipeline(val: LeaValue): val is LeaBidirectionalPipeline {
  return val !== null && typeof val === "object" && "kind" in val && val.kind === "bidirectional_pipeline";
}

// Helper to check if a value is a LeaReversibleFunction
function isReversibleFunction(val: LeaValue): val is LeaReversibleFunction {
  return val !== null && typeof val === "object" && "kind" in val && val.kind === "reversible_function";
}

// Helper to unwrap a LeaPromise to its underlying value
async function unwrapPromise(val: LeaValue): Promise<LeaValue> {
  if (isLeaPromise(val)) {
    return val.promise;
  }
  return val;
}

// Helper to wrap a Promise in a LeaPromise
function wrapPromise(promise: Promise<LeaValue>): LeaPromise {
  return { kind: "promise", promise };
}

const builtins: Record<string, BuiltinFn> = {
  // Identity function - returns its argument unchanged (used by Pipeline.identity)
  __identity__: (args) => args[0] ?? null,

  print: (args) => {
    console.log(...args.map(stringify));
    return args[0] ?? null;
  },
  delay: (args) => {
    const ms = asNumber(args[0]);
    const value = args[1] ?? null;
    return {
      kind: "promise",
      promise: new Promise<LeaValue>((resolve) => setTimeout(() => resolve(value), ms)),
    } as LeaPromise;
  },
  sqrt: (args) => Math.sqrt(asNumber(args[0])),
  abs: (args) => Math.abs(asNumber(args[0])),
  floor: (args) => Math.floor(asNumber(args[0])),
  ceil: (args) => Math.ceil(asNumber(args[0])),
  round: (args) => Math.round(asNumber(args[0])),
  min: (args) => Math.min(...args.map(asNumber)),
  max: (args) => Math.max(...args.map(asNumber)),
  length: (args) => {
    const val = args[0];
    if (Array.isArray(val)) return val.length;
    if (typeof val === "string") return val.length;
    throw new RuntimeError("length requires a list or string");
  },
  head: (args) => {
    const list = asList(args[0]);
    if (list.length === 0) throw new RuntimeError("head of empty list");
    return list[0];
  },
  tail: (args) => {
    const list = asList(args[0]);
    return list.slice(1);
  },
  push: (args) => {
    const list = asList(args[0]);
    return [...list, args[1]];
  },
  concat: (args) => {
    const a = asList(args[0]);
    const b = asList(args[1]);
    return [...a, ...b];
  },
  reverse: (args) => {
    const list = asList(args[0]);
    return [...list].reverse();
  },
  isEmpty: (args) => {
    const val = args[0];
    if (Array.isArray(val)) return val.length === 0;
    if (typeof val === "string") return val.length === 0;
    return val === null;
  },
  fst: (args) => {
    const val = args[0];
    if (val && typeof val === "object" && "kind" in val && val.kind === "tuple") {
      return (val as LeaTuple).elements[0];
    }
    if (Array.isArray(val)) return val[0];
    throw new RuntimeError("fst expects a tuple or list");
  },
  snd: (args) => {
    const val = args[0];
    if (val && typeof val === "object" && "kind" in val && val.kind === "tuple") {
      return (val as LeaTuple).elements[1];
    }
    if (Array.isArray(val)) return val[1];
    throw new RuntimeError("snd expects a tuple or list");
  },
  zip: (args) => {
    // zip([[1,2,3], [4,5,6]]) => [[1,4], [2,5], [3,6]]
    const lists = asList(args[0]).map(asList);
    if (lists.length === 0) return [];
    const minLen = Math.min(...lists.map(l => l.length));
    const result: LeaValue[][] = [];
    for (let i = 0; i < minLen; i++) {
      result.push(lists.map(l => l[i]));
    }
    return result;
  },
  range: (args) => {
    const start = args.length === 1 ? 0 : asNumber(args[0]);
    const end = asNumber(args.length === 1 ? args[0] : args[1]);
    const result: number[] = [];
    for (let i = start; i < end; i++) result.push(i);
    return result;
  },
  iterations: (args) => {
    const count = asNumber(args[0]);
    const result: number[] = [];
    for (let i = 0; i < count; i++) result.push(i);
    return result;
  },
  map: (args) => {
    const list = asList(args[0]);
    const fn = asFunction(args[1]);
    return list.map((item) => fn([item]));
  },
  filter: (args) => {
    const list = asList(args[0]);
    const fn = asFunction(args[1]);
    return list.filter((item) => isTruthy(fn([item])));
  },
  reduce: (args) => {
    const list = asList(args[0]);
    const initial = args[1];
    const fn = asFunction(args[2]);
    return list.reduce((acc, item) => fn([acc, item]), initial);
  },
  toString: (args: LeaValue[]) => {
    const val = args[0];
    if (typeof val === "number") return String(val);
    if (typeof val === "string") return val;
    if (typeof val === "boolean") return String(val);
    if (val === null) return "null";
    return stringify(val);
  },
  take: (args: LeaValue[]) => {
    const list = asList(args[0]);
    const n = asNumber(args[1]);
    return list.slice(0, n);
  },
  at: (args: LeaValue[]) => {
    const list = asList(args[0]);
    const index = asNumber(args[1]);
    if (index < 0 || index >= list.length) {
      throw new RuntimeError(`Index ${index} out of bounds for list of length ${list.length}`);
    }
    return list[index];
  },
  // New concurrency builtins
  parallel: async (args) => {
    const list = asList(args[0]);
    const fn = asFunction(args[1]);
    const options = args[2];

    let limit = Infinity;
    if (options && typeof options === "object" && "kind" in options && options.kind === "record") {
      const record = options as LeaRecord;
      const limitVal = record.fields.get("limit");
      if (limitVal !== undefined && typeof limitVal === "number") {
        limit = limitVal;
      }
    }

    // Execute with concurrency limit
    const results: LeaValue[] = [];
    const executing: Promise<void>[] = [];

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const p = (async () => {
        const result = fn([item]);
        // If result is a promise, await it
        const unwrapped = await unwrapPromise(result);
        results[i] = unwrapped;
      })();

      executing.push(p);

      if (executing.length >= limit) {
        await Promise.race(executing);
        // Remove completed promises
        const completed = executing.filter(async (ep) => {
          try {
            await Promise.race([ep, Promise.resolve()]);
            return false;
          } catch {
            return false;
          }
        });
      }
    }

    await Promise.all(executing);
    return results;
  },
  race: async (args) => {
    const list = asList(args[0]);

    // Each element should be a function (thunk)
    const promises = list.map(async (item) => {
      const fn = asFunction(item);
      const result = fn([]);
      return unwrapPromise(result);
    });

    return Promise.race(promises);
  },
  then: (args) => {
    const promise = args[0];
    const fn = asFunction(args[1]);

    if (isLeaPromise(promise)) {
      return wrapPromise(
        promise.promise.then((val) => {
          const result = fn([val]);
          return unwrapPromise(result);
        })
      );
    }
    // If not a promise, just apply the function
    return fn([promise]);
  },
};

function asNumber(val: LeaValue): number {
  if (typeof val !== "number") throw new RuntimeError(`Expected number, got ${typeof val}`);
  return val;
}

function asList(val: LeaValue): LeaValue[] {
  if (!Array.isArray(val)) throw new RuntimeError(`Expected list, got ${typeof val}`);
  return val;
}

function asFunction(val: LeaValue): (args: LeaValue[]) => LeaValue {
  if (val && typeof val === "object" && "kind" in val && val.kind === "function") {
    const fn = val as LeaFunction;
    return (args: LeaValue[]) => {
      const env = new Environment(fn.closure);
      fn.params.forEach((param, i) => env.define(param.name, args[i] ?? null, false));
      const interp = new Interpreter();
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

function isTruthy(val: LeaValue): boolean {
  if (val === null) return false;
  if (typeof val === "boolean") return val;
  return true;
}

function stringify(val: LeaValue): string {
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
    return "<function>";
  }
  return String(val);
}

// Convert a LeaValue to a string for concatenation with ++
// Similar to stringify but designed for user-facing string coercion
function coerceToString(val: LeaValue): string {
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

export class Interpreter {
  private globals: Environment;
  private memoCache = new Map<string, Map<string, LeaValue>>();
  private traceDepth = 0;
  private contextRegistry = new Map<string, { default: LeaValue; current: LeaValue }>();
  private customDecorators = new Map<string, LeaFunction>();

  constructor() {
    this.globals = new Environment();
    for (const [name, fn] of Object.entries(builtins)) {
      this.globals.define(name, { kind: "builtin", fn } as LeaBuiltin, false);
    }

    // Define Pipeline global object with algebra operations
    this.globals.define("Pipeline", this.createPipelineGlobal(), false);
  }

  // Create the Pipeline global object with static methods and properties
  private createPipelineGlobal(): LeaRecord {
    const fields = new Map<string, LeaValue>();

    // Pipeline.identity - a no-op pipeline that passes values through unchanged
    fields.set("identity", {
      kind: "pipeline" as const,
      stages: [{ expr: { kind: "Identifier" as const, name: "__identity__" } }],
      closure: this.globals,
    } as LeaPipeline);

    // Pipeline.empty - a pipeline with no stages
    fields.set("empty", {
      kind: "pipeline" as const,
      stages: [],
      closure: this.globals,
    } as LeaPipeline);

    // Pipeline.from(list) - create pipeline from list of functions
    fields.set("from", {
      kind: "builtin" as const,
      fn: (args: LeaValue[]): LeaValue => {
        const list = asList(args[0]);
        const stages: { expr: Expr }[] = list.map((item, i) => {
          // Create a synthetic identifier that will resolve to this function
          const syntheticName = `__pipeline_stage_${i}__`;
          this.globals.define(syntheticName, item, false);
          return { expr: { kind: "Identifier" as const, name: syntheticName } };
        });
        return {
          kind: "pipeline" as const,
          stages,
          closure: this.globals,
        } as LeaPipeline;
      }
    } as LeaBuiltin);

    return { kind: "record", fields } as LeaRecord;
  }

  interpret(program: Program): LeaValue {
    let result: LeaValue = null;
    for (const stmt of program.statements) {
      result = this.executeStmt(stmt, this.globals);
    }
    return result;
  }

  // Async version of interpret for top-level await
  async interpretAsync(program: Program): Promise<LeaValue> {
    let result: LeaValue = null;
    for (const stmt of program.statements) {
      result = this.executeStmt(stmt, this.globals);
      // If result is a promise at top level, await it
      result = await unwrapPromise(result);
    }
    return result;
  }

  private executeStmt(stmt: Stmt, env: Environment): LeaValue {
    switch (stmt.kind) {
      case "LetStmt": {
        const value = this.evaluateExpr(stmt.value, env);

        // Check if this is a function
        const isFunction = value !== null && typeof value === "object" && "kind" in value && value.kind === "function";
        const fn = isFunction ? (value as LeaFunction) : null;
        const hasTypeSignature = fn && fn.typeSignature !== undefined;
        const isReverse = fn && fn.isReverse === true;

        if (isReverse && env.hasInCurrentScope(stmt.name)) {
          // This is a reverse function definition - add it to existing forward function
          env.addReverse(stmt.name, fn);
        } else if (hasTypeSignature && env.hasInCurrentScope(stmt.name)) {
          // This is a function with a type signature and the name already exists
          // Add it as an overload
          env.addOverload(stmt.name, fn);
        } else {
          env.define(stmt.name, value, stmt.mutable);
        }
        return value;
      }

      case "ExprStmt":
        return this.evaluateExpr(stmt.expression, env);

      case "ContextDefStmt": {
        const defaultValue = this.evaluateExpr(stmt.defaultValue, env);
        this.contextRegistry.set(stmt.name, { default: defaultValue, current: defaultValue });
        return defaultValue;
      }

      case "ProvideStmt": {
        const ctx = this.contextRegistry.get(stmt.contextName);
        if (!ctx) {
          throw new RuntimeError(`Context '${stmt.contextName}' is not defined`);
        }
        const newValue = this.evaluateExpr(stmt.value, env);
        ctx.current = newValue;
        return newValue;
      }

      case "DecoratorDefStmt": {
        const transformer = this.evaluateExpr(stmt.transformer, env);
        if (!transformer || typeof transformer !== "object" || !("kind" in transformer) || transformer.kind !== "function") {
          throw new RuntimeError("Decorator must be a function");
        }
        this.customDecorators.set(stmt.name, transformer as LeaFunction);
        return null;
      }

      case "CodeblockStmt": {
        // Codeblocks are transparent - just execute their statements
        let result: LeaValue = null;
        for (const innerStmt of stmt.statements) {
          result = this.executeStmt(innerStmt, env);
        }
        return result;
      }
    }
  }

  evaluateExpr(expr: Expr, env: Environment): LeaValue {
    switch (expr.kind) {
      case "NumberLiteral":
        return expr.value;

      case "StringLiteral":
        return expr.value;

      case "TemplateStringExpr": {
        // Evaluate template string parts and concatenate
        let result = "";
        for (const part of expr.parts) {
          if (typeof part === "string") {
            result += part;
          } else {
            const value = this.evaluateExpr(part, env);
            result += coerceToString(value);
          }
        }
        return result;
      }

      case "BooleanLiteral":
        return expr.value;

      case "Identifier":
        return env.get(expr.name);

      case "PlaceholderExpr":
        throw new RuntimeError("Placeholder '_' used outside of pipe context");

      case "ListExpr":
        return expr.elements.map((el) => this.evaluateExpr(el, env));

      case "IndexExpr": {
        const obj = this.evaluateExpr(expr.object, env);
        const idx = this.evaluateExpr(expr.index, env);
        if (Array.isArray(obj) && typeof idx === "number") {
          return obj[idx] ?? null;
        }
        if (typeof obj === "string" && typeof idx === "number") {
          return obj[idx] ?? null;
        }
        throw new RuntimeError("Invalid index operation");
      }

      case "UnaryExpr": {
        const operand = this.evaluateExpr(expr.operand, env);
        if (expr.operator.type === TokenType.MINUS) {
          return -asNumber(operand);
        }
        throw new RuntimeError(`Unknown unary operator: ${expr.operator.lexeme}`);
      }

      case "BinaryExpr": {
        const left = this.evaluateExpr(expr.left, env);
        const right = this.evaluateExpr(expr.right, env);
        return this.evaluateBinary(expr.operator.type, left, right);
      }

      case "PipeExpr":
        return this.evaluatePipe(expr.left, expr.right, env);

      case "ParallelPipeExpr":
        return this.evaluateParallelPipe(expr.input, expr.branches, env);

      case "CallExpr":
        return this.evaluateCall(expr, env);

      case "FunctionExpr":
        return this.createFunction(expr, env);

      case "AwaitExpr": {
        const operand = this.evaluateExpr(expr.operand, env);
        if (isLeaPromise(operand)) {
          // Return a LeaPromise that will be resolved when we're in async context
          // The actual awaiting happens at the call site or top level
          return operand;
        }
        // If not a promise, just return the value
        return operand;
      }

      case "RecordExpr": {
        const fields = new Map<string, LeaValue>();
        for (const field of expr.fields) {
          fields.set(field.key, this.evaluateExpr(field.value, env));
        }
        return { kind: "record", fields } as LeaRecord;
      }

      case "MemberExpr": {
        const obj = this.evaluateExpr(expr.object, env);
        if (obj && typeof obj === "object" && "kind" in obj && obj.kind === "record") {
          const record = obj as LeaRecord;
          if (!record.fields.has(expr.member)) {
            throw new RuntimeError(`Record has no field '${expr.member}'`);
          }
          return record.fields.get(expr.member)!;
        }
        // Handle pipeline members: .stages, .length, .visualize
        if (isPipeline(obj)) {
          return this.getPipelineMember(obj, expr.member, env);
        }
        throw new RuntimeError("Member access requires a record or pipeline");
      }

      case "TernaryExpr": {
        const condition = this.evaluateExpr(expr.condition, env);
        if (condition) {
          return this.evaluateExpr(expr.thenBranch, env);
        } else {
          return this.evaluateExpr(expr.elseBranch, env);
        }
      }

      case "ReturnExpr": {
        const value = this.evaluateExpr(expr.value, env);
        throw new ReturnValue(value);
      }

      case "TupleExpr": {
        const elements = expr.elements.map((e) => this.evaluateExpr(e, env));
        return { kind: "tuple" as const, elements };
      }

      case "PipelineLiteral": {
        // Create a pipeline value that captures the current environment
        return {
          kind: "pipeline" as const,
          stages: expr.stages,
          closure: env,
        } as LeaPipeline;
      }

      case "BidirectionalPipelineLiteral": {
        // Create a bidirectional pipeline that can be applied forward or in reverse
        return {
          kind: "bidirectional_pipeline" as const,
          stages: expr.stages,
          closure: env,
        } as LeaBidirectionalPipeline;
      }

      case "ReversePipeExpr": {
        // Apply value through pipeline/function in reverse
        // Syntax: value </ pipeline (like 5 </ double means apply 5 to double's reverse)
        const value = this.evaluateExpr(expr.left, env);     // The value to pipe
        const pipeline = this.evaluateExpr(expr.right, env); // The pipeline/function
        return this.applyReverse(pipeline, value, env);
      }
    }
  }

  private evaluateBinary(op: TokenType, left: LeaValue, right: LeaValue): LeaValue {
    switch (op) {
      case TokenType.PLUS:
        return asNumber(left) + asNumber(right);
      case TokenType.MINUS:
        return asNumber(left) - asNumber(right);
      case TokenType.STAR:
        return asNumber(left) * asNumber(right);
      case TokenType.SLASH:
        return asNumber(left) / asNumber(right);
      case TokenType.PERCENT:
        return asNumber(left) % asNumber(right);
      case TokenType.CONCAT:
        // String coercion: automatically convert non-strings to strings
        return coerceToString(left) + coerceToString(right);
      case TokenType.EQEQ:
        return this.isEqual(left, right);
      case TokenType.NEQ:
        return !this.isEqual(left, right);
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

  private isEqual(a: LeaValue, b: LeaValue): boolean {
    if (a === null && b === null) return true;
    if (a === null || b === null) return false;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((el, i) => this.isEqual(el, b[i]));
    }
    return a === b;
  }

  private evaluatePipe(left: Expr, right: Expr, env: Environment): LeaValue {
    const pipedValue = this.evaluateExpr(left, env);

    // Promise-aware pipe: if left side is a promise, return a promise that awaits it
    if (isLeaPromise(pipedValue)) {
      return wrapPromise(
        pipedValue.promise.then((resolved) => {
          return this.evaluatePipeWithValue(resolved, right, env);
        })
      );
    }

    return this.evaluatePipeWithValue(pipedValue, right, env);
  }

  private evaluatePipeWithValue(pipedValue: LeaValue, right: Expr, env: Environment): LeaValue {
    // If piped value is a parallel result, spread it as multiple arguments
    if (isParallelResult(pipedValue)) {
      // If right is a function expression, call it with spread values
      if (right.kind === "FunctionExpr") {
        const fn = this.createFunction(right, env);
        return this.callFunction(fn, pipedValue.values);
      }

      // If right is just an identifier, call it with spread values
      if (right.kind === "Identifier") {
        const callee = this.evaluateExpr(right, env);
        if (isOverloadSet(callee)) {
          const fn = this.resolveOverload(callee.overloads, pipedValue.values);
          return this.callFunction(fn, pipedValue.values);
        }
        if (callee && typeof callee === "object" && "kind" in callee && callee.kind === "function") {
          return this.callFunction(callee as LeaFunction, pipedValue.values);
        }
        if (callee && typeof callee === "object" && "kind" in callee && callee.kind === "builtin") {
          const result = (callee as LeaBuiltin).fn(pipedValue.values);
          if (result instanceof Promise) {
            return wrapPromise(result);
          }
          return result;
        }
        // If callee is a pipeline, run the parallel results through it
        if (isPipeline(callee)) {
          return this.applyPipeline(callee, pipedValue.values);
        }
      }

      // If right is a call expression, add spread values as additional args
      if (right.kind === "CallExpr") {
        const callee = this.evaluateExpr(right.callee, env);
        const additionalArgs = right.args.map((arg) => this.evaluateExpr(arg, env));
        const allArgs = [...pipedValue.values, ...additionalArgs];

        if (isOverloadSet(callee)) {
          const fn = this.resolveOverload(callee.overloads, allArgs);
          return this.callFunction(fn, allArgs);
        }
        if (callee && typeof callee === "object" && "kind" in callee && callee.kind === "function") {
          return this.callFunction(callee as LeaFunction, allArgs);
        }
        if (callee && typeof callee === "object" && "kind" in callee && callee.kind === "builtin") {
          const result = (callee as LeaBuiltin).fn(allArgs);
          if (result instanceof Promise) {
            return wrapPromise(result);
          }
          return result;
        }
      }
    }

    // If right is just an identifier, check if it resolves to a pipeline or reversible function
    if (right.kind === "Identifier") {
      const callee = this.evaluateExpr(right, env);
      // If the identifier refers to a pipeline, apply the pipeline to the piped value
      if (isPipeline(callee)) {
        return this.applyPipeline(callee, [pipedValue]);
      }
      // If the identifier refers to a bidirectional pipeline, apply forward
      if (isBidirectionalPipeline(callee)) {
        return this.applyBidirectionalPipelineForward(callee, [pipedValue]);
      }
      // If the identifier refers to a reversible function, call its forward
      if (isReversibleFunction(callee)) {
        return this.callFunction(callee.forward, [pipedValue]);
      }
      // Otherwise treat as a function call
      return this.evaluateCall(
        { kind: "CallExpr", callee: right, args: [] },
        env,
        pipedValue
      );
    }

    // If right is a call expression, check for placeholder
    if (right.kind === "CallExpr") {
      return this.evaluateCall(right, env, pipedValue);
    }

    // If right is a function expression, call it with piped value
    if (right.kind === "FunctionExpr") {
      const fn = this.createFunction(right, env);
      return this.callFunction(fn, [pipedValue]);
    }

    // If right is a pipe expression, pipe the value through the left side, then continue
    if (right.kind === "PipeExpr") {
      const intermediate = this.evaluatePipeWithValue(pipedValue, right.left, env);
      return this.evaluatePipeWithValue(intermediate, right.right, env);
    }

    // If right is a pipeline literal, evaluate it and apply it
    if (right.kind === "PipelineLiteral") {
      const pipeline = this.evaluateExpr(right, env) as LeaPipeline;
      return this.applyPipeline(pipeline, [pipedValue]);
    }

    // If right is a member expression, evaluate it and check if it's a pipeline or function
    if (right.kind === "MemberExpr") {
      const callee = this.evaluateExpr(right, env);
      if (isPipeline(callee)) {
        return this.applyPipeline(callee, [pipedValue]);
      }
      // If it's a function, call it with piped value
      if (callee && typeof callee === "object" && "kind" in callee && callee.kind === "function") {
        return this.callFunction(callee as LeaFunction, [pipedValue]);
      }
      if (callee && typeof callee === "object" && "kind" in callee && callee.kind === "builtin") {
        const result = (callee as LeaBuiltin).fn([pipedValue]);
        if (result instanceof Promise) {
          return wrapPromise(result);
        }
        return result;
      }
    }

    throw new RuntimeError("Right side of pipe must be a function or call");
  }

  // Apply a pipeline to an input value by running it through each stage
  private applyPipeline(pipeline: LeaPipeline, args: LeaValue[]): LeaValue {
    // Pipeline takes the first argument as input
    let current: LeaValue = args[0];

    for (const stage of pipeline.stages) {
      // Evaluate the stage expression and pipe the current value into it
      const stageExpr = stage.expr;

      // If the stage is an identifier that refers to another pipeline, compose them
      if (stageExpr.kind === "Identifier") {
        const stageVal = this.evaluateExpr(stageExpr, pipeline.closure);
        if (isPipeline(stageVal)) {
          current = this.applyPipeline(stageVal, [current]);
          continue;
        }
      }

      // Otherwise pipe the value through the stage normally
      current = this.evaluatePipeWithValue(current, stageExpr, pipeline.closure);
    }

    return current;
  }

  // Apply a value through a pipeline/function in reverse
  private applyReverse(target: LeaValue, value: LeaValue, env: Environment): LeaValue {
    // If target is a reversible function, call its reverse
    if (isReversibleFunction(target)) {
      return this.callFunction(target.reverse, [value]);
    }

    // If target is a bidirectional pipeline, apply stages in reverse order
    if (isBidirectionalPipeline(target)) {
      let current = value;
      // Iterate stages in reverse order
      for (let i = target.stages.length - 1; i >= 0; i--) {
        const stage = target.stages[i];
        current = this.applyReverseToStage(current, stage.expr, target.closure);
      }
      return current;
    }

    // If target is a regular function, check if it's reversible
    if (target !== null && typeof target === "object" && "kind" in target && target.kind === "function") {
      throw new RuntimeError("Cannot apply reverse to non-reversible function. Define a reverse with (x) <- expr");
    }

    // If target is a regular pipeline, apply in reverse (stages must be reversible)
    if (isPipeline(target)) {
      let current = value;
      for (let i = target.stages.length - 1; i >= 0; i--) {
        const stage = target.stages[i];
        current = this.applyReverseToStage(current, stage.expr, target.closure);
      }
      return current;
    }

    throw new RuntimeError("Cannot apply reverse pipe to this value");
  }

  // Apply reverse to a single stage expression
  private applyReverseToStage(value: LeaValue, stageExpr: Expr, closure: Environment): LeaValue {
    // Evaluate the stage to see what it is
    if (stageExpr.kind === "Identifier") {
      const stageVal = this.evaluateExpr(stageExpr, closure);

      // If it's a reversible function, call its reverse
      if (isReversibleFunction(stageVal)) {
        return this.callFunction(stageVal.reverse, [value]);
      }

      // If it's a bidirectional pipeline, apply in reverse
      if (isBidirectionalPipeline(stageVal)) {
        return this.applyReverse(stageVal, value, closure);
      }

      // If it's a regular pipeline, try to apply in reverse
      if (isPipeline(stageVal)) {
        return this.applyReverse(stageVal, value, closure);
      }

      throw new RuntimeError(`Cannot apply reverse to stage '${stageExpr.name}' - not reversible`);
    }

    // For function expressions in stages, we can't reverse them unless explicitly defined
    throw new RuntimeError("Cannot apply reverse to inline function in pipeline");
  }

  // Apply a bidirectional pipeline in the forward direction
  private applyBidirectionalPipelineForward(pipeline: LeaBidirectionalPipeline, args: LeaValue[]): LeaValue {
    let current: LeaValue = args[0];

    for (const stage of pipeline.stages) {
      const stageExpr = stage.expr;

      // If the stage is an identifier, resolve it
      if (stageExpr.kind === "Identifier") {
        const stageVal = this.evaluateExpr(stageExpr, pipeline.closure);

        // If it's a reversible function, call its forward
        if (isReversibleFunction(stageVal)) {
          current = this.callFunction(stageVal.forward, [current]);
          continue;
        }

        // If it's a bidirectional pipeline, apply forward recursively
        if (isBidirectionalPipeline(stageVal)) {
          current = this.applyBidirectionalPipelineForward(stageVal, [current]);
          continue;
        }

        // If it's a regular pipeline, apply it
        if (isPipeline(stageVal)) {
          current = this.applyPipeline(stageVal, [current]);
          continue;
        }
      }

      // Otherwise pipe the value through the stage normally
      current = this.evaluatePipeWithValue(current, stageExpr, pipeline.closure);
    }

    return current;
  }

  private evaluateParallelPipe(input: Expr, branches: Expr[], env: Environment): LeaValue {
    const inputValue = this.evaluateExpr(input, env);

    // If input is a promise, await it first
    if (isLeaPromise(inputValue)) {
      return wrapPromise(
        inputValue.promise.then((resolved) => {
          return this.evaluateParallelBranches(resolved, branches, env);
        })
      );
    }

    return this.evaluateParallelBranches(inputValue, branches, env);
  }

  private evaluateParallelBranches(inputValue: LeaValue, branches: Expr[], env: Environment): LeaValue {
    // Execute all branches in parallel
    const branchPromises = branches.map(async (branch) => {
      const result = this.evaluatePipeWithValue(inputValue, branch, env);
      return await unwrapPromise(result);
    });

    // Return a promise that resolves to a LeaParallelResult
    return wrapPromise(
      Promise.all(branchPromises).then((values) => ({
        kind: "parallel_result" as const,
        values,
      }))
    );
  }

  private evaluateCall(expr: CallExpr, env: Environment, pipedValue?: LeaValue): LeaValue {
    const callee = this.evaluateExpr(expr.callee, env);

    // Handle piped value
    let args: LeaValue[];
    if (pipedValue !== undefined) {
      // Check if any argument is a placeholder
      const hasPlaceholder = expr.args.some((arg) => arg.kind === "PlaceholderExpr");
      if (hasPlaceholder) {
        // Substitute placeholder with piped value
        args = expr.args.map((arg) =>
          arg.kind === "PlaceholderExpr" ? pipedValue : this.evaluateExpr(arg, env)
        );
      } else {
        // Prepend piped value
        args = [pipedValue, ...expr.args.map((arg) => this.evaluateExpr(arg, env))];
      }
    } else {
      args = expr.args.map((arg) => this.evaluateExpr(arg, env));
    }

    // Built-in function
    if (callee && typeof callee === "object" && "kind" in callee && (callee as LeaBuiltin | LeaFunction).kind === "builtin") {
      const builtin = callee as LeaBuiltin;
      const result = builtin.fn(args);
      // Handle async builtins
      if (result instanceof Promise) {
        return wrapPromise(result);
      }
      return result;
    }

    // Overload set - resolve the best matching overload
    if (isOverloadSet(callee)) {
      const fn = this.resolveOverload(callee.overloads, args);
      return this.callFunction(fn, args);
    }

    // User-defined function
    if (callee && typeof callee === "object" && "kind" in callee && (callee as LeaBuiltin | LeaFunction).kind === "function") {
      const fn = callee as LeaFunction;
      return this.callFunction(fn, args);
    }

    throw new RuntimeError("Can only call functions");
  }

  private createFunction(expr: FunctionExpr, env: Environment): LeaFunction {
    return {
      kind: "function",
      params: expr.params,
      attachments: expr.attachments,
      body: expr.body,
      closure: env,
      decorators: expr.decorators,
      returnType: expr.returnType,
      typeSignature: expr.typeSignature,
      isReverse: expr.isReverse,
    };
  }

  private callFunction(fn: LeaFunction, args: LeaValue[]): LeaValue {
    const isAsync = fn.decorators.some((d) => d.name === "async");

    // Apply decorators
    let executor = (fnArgs: LeaValue[]): LeaValue => {
      const localEnv = new Environment(fn.closure);

      // Bind parameters, using default values if argument not provided
      fn.params.forEach((param, i) => {
        let value = fnArgs[i];
        if ((value === undefined || value === null) && param.defaultValue) {
          // Evaluate default value in the closure environment
          value = this.evaluateExpr(param.defaultValue, fn.closure);
        }
        localEnv.define(param.name, value ?? null, false);
      });

      // Inject context attachments
      for (const attachment of fn.attachments) {
        const ctx = this.contextRegistry.get(attachment);
        if (!ctx) {
          throw new RuntimeError(`Context '${attachment}' is not defined`);
        }
        localEnv.define(attachment, ctx.current, false);
      }

      // Execute body
      if (isAsync) {
        return this.evaluateBodyAsync(fn.body, localEnv);
      }
      return this.evaluateBody(fn.body, localEnv);
    };

    // Wrap with decorators (applied in reverse order)
    for (const decorator of [...fn.decorators].reverse()) {
      executor = this.applyDecorator(decorator, executor, fn);
    }

    return executor(args);
  }

  private evaluateBody(body: Expr | BlockBody, env: Environment): LeaValue {
    try {
      if (body.kind === "BlockBody") {
        // Execute statements in order
        for (const stmt of body.statements) {
          this.executeStmt(stmt, env);
        }
        // Return the result expression
        return this.evaluateExpr(body.result, env);
      }
      // Single expression
      return this.evaluateExpr(body, env);
    } catch (e) {
      if (e instanceof ReturnValue) {
        return e.value;
      }
      throw e;
    }
  }

  private evaluateBodyAsync(body: Expr | BlockBody, env: Environment): LeaValue {
    // For async functions, we need to handle await expressions properly
    // Return a promise that executes the body
    return wrapPromise(this.evaluateBodyAsyncImpl(body, env));
  }

  private async evaluateBodyAsyncImpl(body: Expr | BlockBody, env: Environment): Promise<LeaValue> {
    try {
      if (body.kind === "BlockBody") {
        // Execute statements in order, awaiting any promises
        for (const stmt of body.statements) {
          await this.executeStmtAsync(stmt, env);
        }
        // Return the result expression, awaiting if needed
        let result = await this.evaluateExprAsync(body.result, env);
        return result;
      }
      // Single expression
      let result = await this.evaluateExprAsync(body, env);
      return result;
    } catch (e) {
      if (e instanceof ReturnValue) {
        return e.value;
      }
      throw e;
    }
  }

  private async executeStmtAsync(stmt: Stmt, env: Environment): Promise<LeaValue> {
    switch (stmt.kind) {
      case "LetStmt": {
        const value = await this.evaluateExprAsync(stmt.value, env);

        // Check if this is a function
        const isFunction = value !== null && typeof value === "object" && "kind" in value && value.kind === "function";
        const fn = isFunction ? (value as LeaFunction) : null;
        const hasTypeSignature = fn && fn.typeSignature !== undefined;
        const isReverse = fn && fn.isReverse === true;

        if (isReverse && env.hasInCurrentScope(stmt.name)) {
          // This is a reverse function definition - add it to existing forward function
          env.addReverse(stmt.name, fn);
        } else if (hasTypeSignature && env.hasInCurrentScope(stmt.name)) {
          // This is a function with a type signature and the name already exists
          // Add it as an overload
          env.addOverload(stmt.name, fn);
        } else {
          env.define(stmt.name, value, stmt.mutable);
        }
        return value;
      }

      case "ExprStmt":
        return this.evaluateExprAsync(stmt.expression, env);

      case "ContextDefStmt": {
        const defaultValue = await this.evaluateExprAsync(stmt.defaultValue, env);
        this.contextRegistry.set(stmt.name, { default: defaultValue, current: defaultValue });
        return defaultValue;
      }

      case "ProvideStmt": {
        const ctx = this.contextRegistry.get(stmt.contextName);
        if (!ctx) {
          throw new RuntimeError(`Context '${stmt.contextName}' is not defined`);
        }
        const newValue = await this.evaluateExprAsync(stmt.value, env);
        ctx.current = newValue;
        return newValue;
      }

      case "DecoratorDefStmt": {
        const transformer = await this.evaluateExprAsync(stmt.transformer, env);
        if (!transformer || typeof transformer !== "object" || !("kind" in transformer) || transformer.kind !== "function") {
          throw new RuntimeError("Decorator must be a function");
        }
        this.customDecorators.set(stmt.name, transformer as LeaFunction);
        return null;
      }

      case "CodeblockStmt": {
        // Codeblocks are transparent - just execute their statements
        let result: LeaValue = null;
        for (const innerStmt of stmt.statements) {
          result = await this.executeStmtAsync(innerStmt, env);
        }
        return result;
      }

      default:
        throw new RuntimeError(`Unknown statement kind: ${(stmt as Stmt).kind}`);
    }
  }

  private async evaluateExprAsync(expr: Expr, env: Environment): Promise<LeaValue> {
    switch (expr.kind) {
      case "NumberLiteral":
        return expr.value;

      case "StringLiteral":
        return expr.value;

      case "TemplateStringExpr": {
        // Evaluate template string parts and concatenate
        let result = "";
        for (const part of expr.parts) {
          if (typeof part === "string") {
            result += part;
          } else {
            const value = await this.evaluateExprAsync(part, env);
            result += coerceToString(value);
          }
        }
        return result;
      }

      case "BooleanLiteral":
        return expr.value;

      case "Identifier":
        return env.get(expr.name);

      case "PlaceholderExpr":
        throw new RuntimeError("Placeholder '_' used outside of pipe context");

      case "ListExpr": {
        const elements: LeaValue[] = [];
        for (const el of expr.elements) {
          elements.push(await this.evaluateExprAsync(el, env));
        }
        return elements;
      }

      case "IndexExpr": {
        const obj = await this.evaluateExprAsync(expr.object, env);
        const idx = await this.evaluateExprAsync(expr.index, env);
        if (Array.isArray(obj) && typeof idx === "number") {
          return obj[idx] ?? null;
        }
        if (typeof obj === "string" && typeof idx === "number") {
          return obj[idx] ?? null;
        }
        throw new RuntimeError("Invalid index operation");
      }

      case "UnaryExpr": {
        const operand = await this.evaluateExprAsync(expr.operand, env);
        if (expr.operator.type === TokenType.MINUS) {
          return -asNumber(operand);
        }
        throw new RuntimeError(`Unknown unary operator: ${expr.operator.lexeme}`);
      }

      case "BinaryExpr": {
        const left = await this.evaluateExprAsync(expr.left, env);
        const right = await this.evaluateExprAsync(expr.right, env);
        return this.evaluateBinary(expr.operator.type, left, right);
      }

      case "PipeExpr": {
        const pipedValue = await this.evaluateExprAsync(expr.left, env);
        return this.evaluatePipeWithValueAsync(pipedValue, expr.right, env);
      }

      case "ParallelPipeExpr": {
        const inputValue = await this.evaluateExprAsync(expr.input, env);
        return this.evaluateParallelBranchesAsync(inputValue, expr.branches, env);
      }

      case "CallExpr":
        return this.evaluateCallAsync(expr, env);

      case "FunctionExpr":
        return this.createFunction(expr, env);

      case "AwaitExpr": {
        // In async context, properly await the promise
        const operand = await this.evaluateExprAsync(expr.operand, env);
        // Already unwrapped by evaluateExprAsync recursively, but if it's still a promise, unwrap it
        return unwrapPromise(operand);
      }

      case "RecordExpr": {
        const fields = new Map<string, LeaValue>();
        for (const field of expr.fields) {
          fields.set(field.key, await this.evaluateExprAsync(field.value, env));
        }
        return { kind: "record", fields } as LeaRecord;
      }

      case "MemberExpr": {
        const obj = await this.evaluateExprAsync(expr.object, env);
        if (obj && typeof obj === "object" && "kind" in obj && obj.kind === "record") {
          const record = obj as LeaRecord;
          if (!record.fields.has(expr.member)) {
            throw new RuntimeError(`Record has no field '${expr.member}'`);
          }
          return record.fields.get(expr.member)!;
        }
        // Handle pipeline members: .stages, .length, .visualize
        if (isPipeline(obj)) {
          return this.getPipelineMember(obj, expr.member, env);
        }
        throw new RuntimeError("Member access requires a record or pipeline");
      }

      case "TernaryExpr": {
        const condition = await this.evaluateExprAsync(expr.condition, env);
        if (condition) {
          return this.evaluateExprAsync(expr.thenBranch, env);
        } else {
          return this.evaluateExprAsync(expr.elseBranch, env);
        }
      }

      case "ReturnExpr": {
        const value = await this.evaluateExprAsync(expr.value, env);
        throw new ReturnValue(value);
      }

      case "TupleExpr": {
        const elements = await Promise.all(expr.elements.map((e) => this.evaluateExprAsync(e, env)));
        return { kind: "tuple" as const, elements };
      }

      case "PipelineLiteral": {
        // Create a pipeline value that captures the current environment
        return {
          kind: "pipeline" as const,
          stages: expr.stages,
          closure: env,
        } as LeaPipeline;
      }

      case "BidirectionalPipelineLiteral": {
        // Create a bidirectional pipeline that can be applied forward or in reverse
        return {
          kind: "bidirectional_pipeline" as const,
          stages: expr.stages,
          closure: env,
        } as LeaBidirectionalPipeline;
      }

      case "ReversePipeExpr": {
        // Apply value through pipeline/function in reverse
        // Syntax: value </ pipeline (like 5 </ double means apply 5 to double's reverse)
        const value = await this.evaluateExprAsync(expr.left, env);     // The value to pipe
        const pipeline = await this.evaluateExprAsync(expr.right, env); // The pipeline/function
        return this.applyReverseAsync(pipeline, value, env);
      }

      default:
        throw new RuntimeError(`Unknown expression kind: ${(expr as Expr).kind}`);
    }
  }

  private async evaluatePipeWithValueAsync(pipedValue: LeaValue, right: Expr, env: Environment): Promise<LeaValue> {
    // If piped value is a parallel result, spread it as multiple arguments
    if (isParallelResult(pipedValue)) {
      // If right is a function expression, call it with spread values
      if (right.kind === "FunctionExpr") {
        const fn = this.createFunction(right, env);
        return this.callFunctionAsync(fn, pipedValue.values);
      }

      // If right is just an identifier, call it with spread values
      if (right.kind === "Identifier") {
        const callee = await this.evaluateExprAsync(right, env);
        if (isOverloadSet(callee)) {
          const fn = this.resolveOverload(callee.overloads, pipedValue.values);
          return this.callFunctionAsync(fn, pipedValue.values);
        }
        if (callee && typeof callee === "object" && "kind" in callee && callee.kind === "function") {
          return this.callFunctionAsync(callee as LeaFunction, pipedValue.values);
        }
        if (callee && typeof callee === "object" && "kind" in callee && callee.kind === "builtin") {
          const result = (callee as LeaBuiltin).fn(pipedValue.values);
          if (result instanceof Promise) return result;
          if (isLeaPromise(result)) return result.promise;
          return result;
        }
        // If callee is a pipeline, run the parallel results through it
        if (isPipeline(callee)) {
          return this.applyPipelineAsync(callee, pipedValue.values);
        }
      }

      // If right is a call expression, add spread values as additional args
      if (right.kind === "CallExpr") {
        const callee = await this.evaluateExprAsync(right.callee, env);
        const additionalArgs: LeaValue[] = [];
        for (const arg of right.args) {
          additionalArgs.push(await this.evaluateExprAsync(arg, env));
        }
        const allArgs = [...pipedValue.values, ...additionalArgs];

        if (isOverloadSet(callee)) {
          const fn = this.resolveOverload(callee.overloads, allArgs);
          return this.callFunctionAsync(fn, allArgs);
        }
        if (callee && typeof callee === "object" && "kind" in callee && callee.kind === "function") {
          return this.callFunctionAsync(callee as LeaFunction, allArgs);
        }
        if (callee && typeof callee === "object" && "kind" in callee && callee.kind === "builtin") {
          const result = (callee as LeaBuiltin).fn(allArgs);
          if (result instanceof Promise) return result;
          if (isLeaPromise(result)) return result.promise;
          return result;
        }
      }
    }

    // If right is just an identifier, check if it resolves to a pipeline or reversible function
    if (right.kind === "Identifier") {
      const callee = await this.evaluateExprAsync(right, env);
      // If the identifier refers to a pipeline, apply the pipeline to the piped value
      if (isPipeline(callee)) {
        return this.applyPipelineAsync(callee, [pipedValue]);
      }
      // If the identifier refers to a bidirectional pipeline, apply forward
      if (isBidirectionalPipeline(callee)) {
        return this.applyBidirectionalPipelineForwardAsync(callee, [pipedValue]);
      }
      // If the identifier refers to a reversible function, call its forward
      if (isReversibleFunction(callee)) {
        return this.callFunctionAsync(callee.forward, [pipedValue]);
      }
      // Otherwise treat as a function call
      return this.evaluateCallAsync(
        { kind: "CallExpr", callee: right, args: [] },
        env,
        pipedValue
      );
    }

    // If right is a call expression, check for placeholder
    if (right.kind === "CallExpr") {
      return this.evaluateCallAsync(right, env, pipedValue);
    }

    // If right is a function expression, call it with piped value
    if (right.kind === "FunctionExpr") {
      const fn = this.createFunction(right, env);
      return this.callFunctionAsync(fn, [pipedValue]);
    }

    // If right is a pipe expression, pipe the value through the left side, then continue
    if (right.kind === "PipeExpr") {
      const intermediate = await this.evaluatePipeWithValueAsync(pipedValue, right.left, env);
      return this.evaluatePipeWithValueAsync(intermediate, right.right, env);
    }

    // If right is a pipeline literal, evaluate it and apply it
    if (right.kind === "PipelineLiteral") {
      const pipeline = await this.evaluateExprAsync(right, env) as LeaPipeline;
      return this.applyPipelineAsync(pipeline, [pipedValue]);
    }

    // If right is a member expression, evaluate it and check if it's a pipeline or function
    if (right.kind === "MemberExpr") {
      const callee = await this.evaluateExprAsync(right, env);
      if (isPipeline(callee)) {
        return this.applyPipelineAsync(callee, [pipedValue]);
      }
      // If it's a function, call it with piped value
      if (callee && typeof callee === "object" && "kind" in callee && callee.kind === "function") {
        return this.callFunctionAsync(callee as LeaFunction, [pipedValue]);
      }
      if (callee && typeof callee === "object" && "kind" in callee && callee.kind === "builtin") {
        const result = (callee as LeaBuiltin).fn([pipedValue]);
        if (result instanceof Promise) return result;
        if (isLeaPromise(result)) return result.promise;
        return result;
      }
    }

    throw new RuntimeError("Right side of pipe must be a function or call");
  }

  // Async version of applyPipeline
  private async applyPipelineAsync(pipeline: LeaPipeline, args: LeaValue[]): Promise<LeaValue> {
    let current: LeaValue = args[0];

    for (const stage of pipeline.stages) {
      const stageExpr = stage.expr;

      // If the stage is an identifier that refers to another pipeline, compose them
      if (stageExpr.kind === "Identifier") {
        const stageVal = await this.evaluateExprAsync(stageExpr, pipeline.closure);
        if (isPipeline(stageVal)) {
          current = await this.applyPipelineAsync(stageVal, [current]);
          continue;
        }
      }

      // Otherwise pipe the value through the stage normally
      current = await this.evaluatePipeWithValueAsync(current, stageExpr, pipeline.closure);
    }

    return current;
  }

  // Async version of applyReverse
  private async applyReverseAsync(target: LeaValue, value: LeaValue, env: Environment): Promise<LeaValue> {
    // If target is a reversible function, call its reverse
    if (isReversibleFunction(target)) {
      return this.callFunctionAsync(target.reverse, [value]);
    }

    // If target is a bidirectional pipeline, apply stages in reverse order
    if (isBidirectionalPipeline(target)) {
      let current = value;
      for (let i = target.stages.length - 1; i >= 0; i--) {
        const stage = target.stages[i];
        current = await this.applyReverseToStageAsync(current, stage.expr, target.closure);
      }
      return current;
    }

    // If target is a regular function, check if it's reversible
    if (target !== null && typeof target === "object" && "kind" in target && target.kind === "function") {
      throw new RuntimeError("Cannot apply reverse to non-reversible function. Define a reverse with (x) <- expr");
    }

    // If target is a regular pipeline, apply in reverse (stages must be reversible)
    if (isPipeline(target)) {
      let current = value;
      for (let i = target.stages.length - 1; i >= 0; i--) {
        const stage = target.stages[i];
        current = await this.applyReverseToStageAsync(current, stage.expr, target.closure);
      }
      return current;
    }

    throw new RuntimeError("Cannot apply reverse pipe to this value");
  }

  // Async version of applyReverseToStage
  private async applyReverseToStageAsync(value: LeaValue, stageExpr: Expr, closure: Environment): Promise<LeaValue> {
    if (stageExpr.kind === "Identifier") {
      const stageVal = await this.evaluateExprAsync(stageExpr, closure);

      if (isReversibleFunction(stageVal)) {
        return this.callFunctionAsync(stageVal.reverse, [value]);
      }

      if (isBidirectionalPipeline(stageVal)) {
        return this.applyReverseAsync(stageVal, value, closure);
      }

      if (isPipeline(stageVal)) {
        return this.applyReverseAsync(stageVal, value, closure);
      }

      throw new RuntimeError(`Cannot apply reverse to stage '${stageExpr.name}' - not reversible`);
    }

    throw new RuntimeError("Cannot apply reverse to inline function in pipeline");
  }

  // Async version of applyBidirectionalPipelineForward
  private async applyBidirectionalPipelineForwardAsync(pipeline: LeaBidirectionalPipeline, args: LeaValue[]): Promise<LeaValue> {
    let current: LeaValue = args[0];

    for (const stage of pipeline.stages) {
      const stageExpr = stage.expr;

      if (stageExpr.kind === "Identifier") {
        const stageVal = await this.evaluateExprAsync(stageExpr, pipeline.closure);

        if (isReversibleFunction(stageVal)) {
          current = await this.callFunctionAsync(stageVal.forward, [current]);
          continue;
        }

        if (isBidirectionalPipeline(stageVal)) {
          current = await this.applyBidirectionalPipelineForwardAsync(stageVal, [current]);
          continue;
        }

        if (isPipeline(stageVal)) {
          current = await this.applyPipelineAsync(stageVal, [current]);
          continue;
        }
      }

      current = await this.evaluatePipeWithValueAsync(current, stageExpr, pipeline.closure);
    }

    return current;
  }

  // Get a member of a pipeline (.stages, .length, .visualize, etc.)
  private getPipelineMember(pipeline: LeaPipeline, member: string, env: Environment): LeaValue {
    switch (member) {
      case "length":
        return pipeline.stages.length;

      case "stages": {
        // Return a list of stage descriptions
        return pipeline.stages.map(stage => this.describeStage(stage.expr));
      }

      case "first": {
        // Return the first stage as a callable function
        if (pipeline.stages.length === 0) {
          return null;
        }
        return this.stageToFunction(pipeline.stages[0], pipeline.closure);
      }

      case "last": {
        // Return the last stage as a callable function
        if (pipeline.stages.length === 0) {
          return null;
        }
        return this.stageToFunction(pipeline.stages[pipeline.stages.length - 1], pipeline.closure);
      }

      case "isEmpty": {
        // Return a builtin that checks if pipeline has no stages
        return {
          kind: "builtin" as const,
          fn: (): LeaValue => pipeline.stages.length === 0
        } as LeaBuiltin;
      }

      case "equals": {
        // Return a builtin that compares two pipelines structurally
        return {
          kind: "builtin" as const,
          fn: (args: LeaValue[]): LeaValue => {
            const other = args[0];
            if (!isPipeline(other)) {
              return false;
            }
            return this.pipelinesEqual(pipeline, other);
          }
        } as LeaBuiltin;
      }

      case "at": {
        // Return a builtin that gets a stage at a specific index
        return {
          kind: "builtin" as const,
          fn: (args: LeaValue[]): LeaValue => {
            const index = asNumber(args[0]);
            if (index < 0 || index >= pipeline.stages.length) {
              return null;
            }
            return this.stageToFunction(pipeline.stages[index], pipeline.closure);
          }
        } as LeaBuiltin;
      }

      case "prepend": {
        // Return a builtin that adds a stage at the start
        return {
          kind: "builtin" as const,
          fn: (args: LeaValue[]): LeaValue => {
            const fn = args[0];
            const newStage = this.functionToStage(fn);
            return {
              kind: "pipeline" as const,
              stages: [newStage, ...pipeline.stages],
              closure: pipeline.closure,
            } as LeaPipeline;
          }
        } as LeaBuiltin;
      }

      case "append": {
        // Return a builtin that adds a stage at the end
        return {
          kind: "builtin" as const,
          fn: (args: LeaValue[]): LeaValue => {
            const fn = args[0];
            const newStage = this.functionToStage(fn);
            return {
              kind: "pipeline" as const,
              stages: [...pipeline.stages, newStage],
              closure: pipeline.closure,
            } as LeaPipeline;
          }
        } as LeaBuiltin;
      }

      case "reverse": {
        // Return a builtin that reverses stage order
        return {
          kind: "builtin" as const,
          fn: (): LeaValue => {
            return {
              kind: "pipeline" as const,
              stages: [...pipeline.stages].reverse(),
              closure: pipeline.closure,
            } as LeaPipeline;
          }
        } as LeaBuiltin;
      }

      case "slice": {
        // Return a builtin that extracts a sub-pipeline
        return {
          kind: "builtin" as const,
          fn: (args: LeaValue[]): LeaValue => {
            const start = asNumber(args[0]);
            const end = args[1] !== undefined && args[1] !== null ? asNumber(args[1]) : pipeline.stages.length;
            return {
              kind: "pipeline" as const,
              stages: pipeline.stages.slice(start, end),
              closure: pipeline.closure,
            } as LeaPipeline;
          }
        } as LeaBuiltin;
      }

      case "without": {
        // Return a builtin that removes stages appearing in another pipeline
        return {
          kind: "builtin" as const,
          fn: (args: LeaValue[]): LeaValue => {
            const other = args[0];
            if (!isPipeline(other)) {
              throw new RuntimeError("without requires a pipeline argument");
            }
            const otherStageNames = new Set(other.stages.map(s => this.describeStage(s.expr)));
            const filteredStages = pipeline.stages.filter(
              s => !otherStageNames.has(this.describeStage(s.expr))
            );
            return {
              kind: "pipeline" as const,
              stages: filteredStages,
              closure: pipeline.closure,
            } as LeaPipeline;
          }
        } as LeaBuiltin;
      }

      case "intersection": {
        // Return a builtin that keeps only common stages
        return {
          kind: "builtin" as const,
          fn: (args: LeaValue[]): LeaValue => {
            const other = args[0];
            if (!isPipeline(other)) {
              throw new RuntimeError("intersection requires a pipeline argument");
            }
            const otherStageNames = new Set(other.stages.map(s => this.describeStage(s.expr)));
            const commonStages = pipeline.stages.filter(
              s => otherStageNames.has(this.describeStage(s.expr))
            );
            return {
              kind: "pipeline" as const,
              stages: commonStages,
              closure: pipeline.closure,
            } as LeaPipeline;
          }
        } as LeaBuiltin;
      }

      case "union": {
        // Return a builtin that combines all stages (deduplicated)
        return {
          kind: "builtin" as const,
          fn: (args: LeaValue[]): LeaValue => {
            const other = args[0];
            if (!isPipeline(other)) {
              throw new RuntimeError("union requires a pipeline argument");
            }
            const seenNames = new Set<string>();
            const combinedStages: { expr: Expr }[] = [];

            // Add all stages from this pipeline
            for (const stage of pipeline.stages) {
              const name = this.describeStage(stage.expr);
              if (!seenNames.has(name)) {
                seenNames.add(name);
                combinedStages.push(stage);
              }
            }

            // Add stages from other pipeline not already present
            for (const stage of other.stages) {
              const name = this.describeStage(stage.expr);
              if (!seenNames.has(name)) {
                seenNames.add(name);
                combinedStages.push(stage);
              }
            }

            return {
              kind: "pipeline" as const,
              stages: combinedStages,
              closure: pipeline.closure,
            } as LeaPipeline;
          }
        } as LeaBuiltin;
      }

      case "difference": {
        // Return a builtin that returns stages in this pipeline but not in other
        // (same as 'without' - alias for clarity)
        return {
          kind: "builtin" as const,
          fn: (args: LeaValue[]): LeaValue => {
            const other = args[0];
            if (!isPipeline(other)) {
              throw new RuntimeError("difference requires a pipeline argument");
            }
            const otherStageNames = new Set(other.stages.map(s => this.describeStage(s.expr)));
            const filteredStages = pipeline.stages.filter(
              s => !otherStageNames.has(this.describeStage(s.expr))
            );
            return {
              kind: "pipeline" as const,
              stages: filteredStages,
              closure: pipeline.closure,
            } as LeaPipeline;
          }
        } as LeaBuiltin;
      }

      case "concat": {
        // Return a builtin that concatenates two pipelines (not deduplicated)
        return {
          kind: "builtin" as const,
          fn: (args: LeaValue[]): LeaValue => {
            const other = args[0];
            if (!isPipeline(other)) {
              throw new RuntimeError("concat requires a pipeline argument");
            }
            return {
              kind: "pipeline" as const,
              stages: [...pipeline.stages, ...other.stages],
              closure: pipeline.closure,
            } as LeaPipeline;
          }
        } as LeaBuiltin;
      }

      case "visualize": {
        // Return a builtin function that prints an ASCII diagram
        return {
          kind: "builtin" as const,
          fn: (): LeaValue => {
            const lines: string[] = [];
            lines.push("Pipeline:");
            lines.push("  ┌─────────────┐");
            lines.push("  │   input     │");
            lines.push("  └──────┬──────┘");

            for (let i = 0; i < pipeline.stages.length; i++) {
              const stage = pipeline.stages[i];
              const stageDesc = this.describeStage(stage.expr);
              const padded = stageDesc.length > 11
                ? stageDesc.substring(0, 11)
                : stageDesc.padStart(Math.floor((11 + stageDesc.length) / 2)).padEnd(11);
              lines.push("         │");
              lines.push("         ▼");
              lines.push("  ┌─────────────┐");
              lines.push(`  │ ${padded} │`);
              lines.push("  └──────┬──────┘");
            }

            lines.push("         │");
            lines.push("         ▼");
            lines.push("  ┌─────────────┐");
            lines.push("  │   output    │");
            lines.push("  └─────────────┘");

            console.log(lines.join("\n"));
            return null;
          }
        } as LeaBuiltin;
      }

      default:
        throw new RuntimeError(`Pipeline has no property '${member}'`);
    }
  }

  // Compare two pipelines for structural equality
  private pipelinesEqual(a: LeaPipeline, b: LeaPipeline): boolean {
    if (a.stages.length !== b.stages.length) {
      return false;
    }
    for (let i = 0; i < a.stages.length; i++) {
      const aName = this.describeStage(a.stages[i].expr);
      const bName = this.describeStage(b.stages[i].expr);
      if (aName !== bName) {
        return false;
      }
    }
    return true;
  }

  // Convert a stage to a callable function value
  private stageToFunction(stage: { expr: Expr }, closure: Environment): LeaValue {
    return this.evaluateExpr(stage.expr, closure);
  }

  // Convert a function value to a pipeline stage
  private functionToStage(fn: LeaValue): { expr: Expr } {
    // Create a synthetic identifier for this function
    const syntheticName = `__dynamic_stage_${Date.now()}_${Math.random().toString(36).slice(2)}__`;
    this.globals.define(syntheticName, fn, false);
    return { expr: { kind: "Identifier" as const, name: syntheticName } };
  }

  // Describe a stage expression for display purposes
  private describeStage(expr: Expr): string {
    switch (expr.kind) {
      case "Identifier":
        return expr.name;
      case "CallExpr":
        if (expr.callee.kind === "Identifier") {
          return expr.callee.name;
        }
        return "call";
      case "FunctionExpr":
        return "λ";
      case "PipelineLiteral":
        return `pipe[${expr.stages.length}]`;
      default:
        return "expr";
    }
  }

  private async evaluateParallelBranchesAsync(inputValue: LeaValue, branches: Expr[], env: Environment): Promise<LeaValue> {
    // Execute all branches in parallel
    const branchPromises = branches.map(async (branch) => {
      return this.evaluatePipeWithValueAsync(inputValue, branch, env);
    });

    // Return LeaParallelResult
    const values = await Promise.all(branchPromises);
    return { kind: "parallel_result" as const, values };
  }

  private async evaluateCallAsync(expr: CallExpr, env: Environment, pipedValue?: LeaValue): Promise<LeaValue> {
    const callee = await this.evaluateExprAsync(expr.callee, env);

    // Handle piped value
    let args: LeaValue[];
    if (pipedValue !== undefined) {
      // Check if any argument is a placeholder
      const hasPlaceholder = expr.args.some((arg) => arg.kind === "PlaceholderExpr");
      if (hasPlaceholder) {
        // Substitute placeholder with piped value
        const evaluatedArgs: LeaValue[] = [];
        for (const arg of expr.args) {
          if (arg.kind === "PlaceholderExpr") {
            evaluatedArgs.push(pipedValue);
          } else {
            evaluatedArgs.push(await this.evaluateExprAsync(arg, env));
          }
        }
        args = evaluatedArgs;
      } else {
        // Prepend piped value
        const evaluatedArgs: LeaValue[] = [];
        for (const arg of expr.args) {
          evaluatedArgs.push(await this.evaluateExprAsync(arg, env));
        }
        args = [pipedValue, ...evaluatedArgs];
      }
    } else {
      const evaluatedArgs: LeaValue[] = [];
      for (const arg of expr.args) {
        evaluatedArgs.push(await this.evaluateExprAsync(arg, env));
      }
      args = evaluatedArgs;
    }

    // Built-in function
    if (callee && typeof callee === "object" && "kind" in callee && (callee as LeaBuiltin | LeaFunction).kind === "builtin") {
      const builtin = callee as LeaBuiltin;
      const result = builtin.fn(args);
      // Handle async builtins
      if (result instanceof Promise) {
        return result;
      }
      if (isLeaPromise(result)) {
        return result.promise;
      }
      return result;
    }

    // Overload set - resolve the best matching overload
    if (isOverloadSet(callee)) {
      const fn = this.resolveOverload(callee.overloads, args);
      return this.callFunctionAsync(fn, args);
    }

    // User-defined function
    if (callee && typeof callee === "object" && "kind" in callee && (callee as LeaBuiltin | LeaFunction).kind === "function") {
      const fn = callee as LeaFunction;
      return this.callFunctionAsync(fn, args);
    }

    throw new RuntimeError("Can only call functions");
  }

  private async callFunctionAsync(fn: LeaFunction, args: LeaValue[]): Promise<LeaValue> {
    const localEnv = new Environment(fn.closure);

    // Bind parameters, using default values if argument not provided
    for (let i = 0; i < fn.params.length; i++) {
      const param = fn.params[i];
      let value = args[i];
      if ((value === undefined || value === null) && param.defaultValue) {
        // Evaluate default value in the closure environment
        value = await this.evaluateExprAsync(param.defaultValue, fn.closure);
      }
      localEnv.define(param.name, value ?? null, false);
    }

    // Inject context attachments
    for (const attachment of fn.attachments) {
      const ctx = this.contextRegistry.get(attachment);
      if (!ctx) {
        throw new RuntimeError(`Context '${attachment}' is not defined`);
      }
      localEnv.define(attachment, ctx.current, false);
    }

    // Execute body asynchronously
    return this.evaluateBodyAsyncImpl(fn.body, localEnv);
  }

  private applyDecorator(
    decorator: Decorator,
    executor: (args: LeaValue[]) => LeaValue,
    fn: LeaFunction
  ): (args: LeaValue[]) => LeaValue {
    switch (decorator.name) {
      case "log":
        return (args: LeaValue[]) => {
          console.log(`[log] Called with:`, args.map(stringify).join(", "));
          const result = executor(args);
          console.log(`[log] Returned:`, stringify(result));
          return result;
        };

      case "memo": {
        const fnKey = JSON.stringify(fn.params.map(p => p.name));
        if (!this.memoCache.has(fnKey)) {
          this.memoCache.set(fnKey, new Map());
        }
        const cache = this.memoCache.get(fnKey)!;
        return (args: LeaValue[]) => {
          const key = JSON.stringify(args);
          if (cache.has(key)) {
            return cache.get(key)!;
          }
          const result = executor(args);
          cache.set(key, result);
          return result;
        };
      }

      case "time":
        return (args: LeaValue[]) => {
          const start = performance.now();
          const result = executor(args);
          const elapsed = performance.now() - start;
          console.log(`[time] Execution took ${elapsed.toFixed(3)}ms`);
          return result;
        };

      case "retry": {
        const maxRetries = (decorator.args[0] as number) ?? 3;
        return (args: LeaValue[]) => {
          let lastError: Error | null = null;
          for (let i = 0; i <= maxRetries; i++) {
            try {
              return executor(args);
            } catch (e) {
              lastError = e as Error;
              if (i < maxRetries) {
                console.log(`[retry] Attempt ${i + 1} failed, retrying...`);
              }
            }
          }
          throw lastError;
        };
      }

      case "validate":
        return (args: LeaValue[]) => {
          // Validate argument types - support both old style and new typeSignature
          fn.params.forEach((param, i) => {
            const arg = args[i];

            // Get expected type from new typeSignature or old param.typeAnnotation
            const expectedType = fn.typeSignature?.paramTypes[i] ?? param.typeAnnotation;

            // Check for null/undefined (unless optional type)
            const isOptional = typeof expectedType === "string" && expectedType.startsWith("?") ||
                              typeof expectedType === "object" && expectedType.optional;

            if ((arg === null || arg === undefined) && !isOptional) {
              throw new RuntimeError(`[validate] Argument '${param.name}' is null/undefined`);
            }

            if (expectedType && !this.matchesType(arg, expectedType)) {
              throw new RuntimeError(
                `[validate] Argument '${param.name}' expected ${this.formatType(expectedType)}, got ${this.getLeaType(arg)}`
              );
            }
          });

          const result = executor(args);

          // Validate return type - support both old style and new typeSignature
          const expectedReturnType = fn.typeSignature?.returnType ?? fn.returnType;

          if (expectedReturnType) {
            const isOptional = typeof expectedReturnType === "string" && expectedReturnType.startsWith("?") ||
                              typeof expectedReturnType === "object" && (expectedReturnType as { optional?: boolean }).optional;

            if ((result === null || result === undefined) && !isOptional) {
              throw new RuntimeError(`[validate] Return value is null/undefined`);
            }

            if (!this.matchesType(result, expectedReturnType)) {
              throw new RuntimeError(
                `[validate] Expected return type ${this.formatType(expectedReturnType)}, got ${this.getLeaType(result)}`
              );
            }
          }

          return result;
        };

      case "pure": {
        return (args: LeaValue[]) => {
          const originalPrint = builtins.print;
          let sideEffectDetected = false;

          // Temporarily wrap print to detect side effects
          builtins.print = (printArgs) => {
            sideEffectDetected = true;
            return originalPrint(printArgs);
          };

          try {
            const result = executor(args);
            if (sideEffectDetected) {
              console.warn(`[pure] Warning: Side effect detected (print was called)`);
            }
            return result;
          } finally {
            builtins.print = originalPrint;
          }
        };
      }

      case "trace": {
        const indent = this.traceDepth;
        return (args: LeaValue[]) => {
          const prefix = "  ".repeat(indent);
          console.log(`${prefix}[trace] → Called with:`, args.map(stringify).join(", "));
          this.traceDepth++;
          try {
            const result = executor(args);
            console.log(`${prefix}[trace] ← Returned:`, stringify(result));
            return result;
          } finally {
            this.traceDepth--;
          }
        };
      }

      case "timeout": {
        const timeoutMs = (decorator.args[0] as number) ?? 1000;
        return (args: LeaValue[]) => {
          const result = executor(args);
          // If result is a promise, race with timeout
          if (isLeaPromise(result)) {
            const timeoutPromise = new Promise<LeaValue>((_, reject) => {
              setTimeout(() => reject(new RuntimeError(`[timeout] Function exceeded ${timeoutMs}ms`)), timeoutMs);
            });
            return wrapPromise(Promise.race([result.promise, timeoutPromise]));
          }
          return result;
        };
      }

      case "async": {
        // Already handled in callFunction - this just ensures the result is wrapped
        return (args: LeaValue[]) => {
          const result = executor(args);
          // If already a promise, return as-is
          if (isLeaPromise(result)) {
            return result;
          }
          // Otherwise wrap in resolved promise
          return wrapPromise(Promise.resolve(result));
        };
      }

      default: {
        // Check for custom decorator
        const customDecorator = this.customDecorators.get(decorator.name);
        if (customDecorator) {
          return (args: LeaValue[]) => {
            // Create a wrapped function that the decorator can call
            const wrappedFn: LeaFunction = {
              kind: "function",
              params: fn.params,
              attachments: [],
              body: fn.body,
              closure: fn.closure,
              decorators: [],
              returnType: fn.returnType,
            };

            // The custom decorator receives the wrapped function and returns a new function
            // Call the decorator with the wrapped function
            const transformedFn = this.callFunction(customDecorator, [wrappedFn]);

            // If it returns a function, call it with the args
            if (transformedFn && typeof transformedFn === "object" && "kind" in transformedFn && transformedFn.kind === "function") {
              return this.callFunction(transformedFn as LeaFunction, args);
            }

            // Otherwise just call the original with original behavior
            return executor(args);
          };
        }

        console.warn(`Unknown decorator: #${decorator.name}`);
        return executor;
      }
    }
  }

  private getLeaType(val: LeaValue): string {
    if (val === null) return "null";
    if (typeof val === "number") return "int"; // or "number"
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
    }
    return "unknown";
  }

  // Check if a value matches an expected type annotation
  private matchesType(val: LeaValue, expectedType: string | { tuple: string[]; optional?: boolean }): boolean {
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
      return expectedType.tuple.every((t, i) => this.matchesType(tuple.elements[i], t));
    }

    // Simple type comparison
    const actualType = this.getLeaType(val);
    return actualType === expectedType.toLowerCase();
  }

  // Format a type annotation for error messages
  private formatType(t: string | { tuple: string[]; optional?: boolean }): string {
    if (typeof t === "string") return t;
    const tupleStr = `(${t.tuple.join(", ")})`;
    return t.optional ? `?${tupleStr}` : tupleStr;
  }

  // Resolve the best matching overload from an overload set
  resolveOverload(overloads: LeaFunction[], args: LeaValue[]): LeaFunction {
    const candidates: { fn: LeaFunction; score: number }[] = [];

    for (const fn of overloads) {
      const score = this.scoreOverloadMatch(fn, args);
      if (score >= 0) {
        candidates.push({ fn, score });
      }
    }

    if (candidates.length === 0) {
      // No matching overload found - generate helpful error message
      const argTypes = args.map((a) => this.getLeaType(a)).join(", ");
      const availableSignatures = overloads
        .map((fn) => {
          if (fn.typeSignature) {
            const paramTypes = fn.typeSignature.paramTypes.map((t) => this.formatType(t)).join(", ");
            const returnType = fn.typeSignature.returnType ? this.formatType(fn.typeSignature.returnType) : "?";
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
      const argTypes = args.map((a) => this.getLeaType(a)).join(", ");
      throw new RuntimeError(
        `Ambiguous overload call for arguments (${argTypes}) - multiple overloads match equally well`
      );
    }

    return candidates[0].fn;
  }

  // Score how well a function matches the given arguments
  // Returns -1 if no match, higher positive score = better match
  private scoreOverloadMatch(fn: LeaFunction, args: LeaValue[]): number {
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

      if (!this.matchesType(arg, expectedType)) {
        return -1; // Type mismatch
      }

      // Exact type match gets bonus points
      score += 10;
    }

    return score;
  }
}

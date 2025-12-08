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
        env.define(stmt.name, value, stmt.mutable);
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
        throw new RuntimeError("Member access requires a record");
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
        if (typeof left === "string" && typeof right === "string") {
          return left + right;
        }
        throw new RuntimeError("++ requires two strings");
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
      }

      // If right is a call expression, add spread values as additional args
      if (right.kind === "CallExpr") {
        const callee = this.evaluateExpr(right.callee, env);
        const additionalArgs = right.args.map((arg) => this.evaluateExpr(arg, env));
        const allArgs = [...pipedValue.values, ...additionalArgs];

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

    // If right is just an identifier, call it with piped value
    if (right.kind === "Identifier") {
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

    throw new RuntimeError("Right side of pipe must be a function or call");
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
        env.define(stmt.name, value, stmt.mutable);
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
        throw new RuntimeError("Member access requires a record");
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
        if (callee && typeof callee === "object" && "kind" in callee && callee.kind === "function") {
          return this.callFunctionAsync(callee as LeaFunction, pipedValue.values);
        }
        if (callee && typeof callee === "object" && "kind" in callee && callee.kind === "builtin") {
          const result = (callee as LeaBuiltin).fn(pipedValue.values);
          if (result instanceof Promise) return result;
          if (isLeaPromise(result)) return result.promise;
          return result;
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

    // If right is just an identifier, call it with piped value
    if (right.kind === "Identifier") {
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

    throw new RuntimeError("Right side of pipe must be a function or call");
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
      if (val.kind === "tuple") return "tuple";
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
}

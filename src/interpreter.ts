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
} from "./ast";

export interface LeaFunction {
  kind: "function";
  params: FunctionParam[];
  attachments: string[];
  body: Expr | BlockBody;
  closure: Environment;
  decorators: Decorator[];
  returnType?: string;
}

export interface LeaRecord {
  kind: "record";
  fields: Map<string, LeaValue>;
}

export interface LeaBuiltin {
  kind: "builtin";
  fn: (args: LeaValue[]) => LeaValue;
}

export interface LeaPromise {
  kind: "promise";
  promise: Promise<LeaValue>;
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
  | null;

export class RuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeError";
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

type BuiltinFn = (args: LeaValue[]) => LeaValue;

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

      case "CallExpr":
        return this.evaluateCall(expr, env);

      case "FunctionExpr":
        return this.createFunction(expr, env);

      case "AwaitExpr": {
        const operand = this.evaluateExpr(expr.operand, env);
        if (operand && typeof operand === "object" && "kind" in operand && operand.kind === "promise") {
          // Return a marker that we need async resolution
          // The actual await is handled at the top level
          throw new RuntimeError("await can only be used in async context - use #async decorator");
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

    throw new RuntimeError("Right side of pipe must be a function or call");
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
      return builtin.fn(args);
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
    };
  }

  private callFunction(fn: LeaFunction, args: LeaValue[]): LeaValue {
    // Apply decorators
    let executor = (fnArgs: LeaValue[]): LeaValue => {
      const localEnv = new Environment(fn.closure);

      // Bind parameters
      fn.params.forEach((param, i) => localEnv.define(param.name, fnArgs[i] ?? null, false));

      // Inject context attachments
      for (const attachment of fn.attachments) {
        const ctx = this.contextRegistry.get(attachment);
        if (!ctx) {
          throw new RuntimeError(`Context '${attachment}' is not defined`);
        }
        localEnv.define(attachment, ctx.current, false);
      }

      // Execute body
      return this.evaluateBody(fn.body, localEnv);
    };

    // Wrap with decorators (applied in reverse order)
    for (const decorator of [...fn.decorators].reverse()) {
      executor = this.applyDecorator(decorator, executor, fn);
    }

    return executor(args);
  }

  private evaluateBody(body: Expr | BlockBody, env: Environment): LeaValue {
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
          // Validate argument types
          fn.params.forEach((param, i) => {
            const arg = args[i];
            if (arg === null || arg === undefined) {
              throw new RuntimeError(`[validate] Argument '${param.name}' is null/undefined`);
            }
            if (param.typeAnnotation) {
              const actualType = this.getLeaType(arg);
              if (actualType !== param.typeAnnotation.toLowerCase()) {
                throw new RuntimeError(
                  `[validate] Argument '${param.name}' expected ${param.typeAnnotation}, got ${actualType}`
                );
              }
            }
          });

          const result = executor(args);

          // Validate return type
          if (fn.returnType) {
            if (result === null || result === undefined) {
              throw new RuntimeError(`[validate] Return value is null/undefined`);
            }
            const actualType = this.getLeaType(result);
            if (actualType !== fn.returnType.toLowerCase()) {
              throw new RuntimeError(
                `[validate] Expected return type ${fn.returnType}, got ${actualType}`
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
          if (result && typeof result === "object" && "kind" in result && result.kind === "promise") {
            const timeoutPromise = new Promise<LeaValue>((_, reject) => {
              setTimeout(() => reject(new RuntimeError(`[timeout] Function exceeded ${timeoutMs}ms`)), timeoutMs);
            });
            return {
              kind: "promise",
              promise: Promise.race([result.promise, timeoutPromise]),
            } as LeaPromise;
          }
          return result;
        };
      }

      case "async": {
        return (args: LeaValue[]) => {
          // Wrap the executor to handle await expressions
          const result = executor(args);
          // If already a promise, return as-is
          if (result && typeof result === "object" && "kind" in result && result.kind === "promise") {
            return result;
          }
          // Otherwise wrap in resolved promise
          return {
            kind: "promise",
            promise: Promise.resolve(result),
          } as LeaPromise;
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
    }
    return "unknown";
  }
}

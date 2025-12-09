/**
 * Interpreter for the Lea language
 *
 * This module exports the Interpreter class which evaluates Lea programs.
 * The interpreter is split into several modules:
 * - types.ts: Value types, errors, and Environment
 * - helpers.ts: Type guards and utility functions
 * - builtins.ts: Built-in functions
 * - decorators.ts: Decorator implementations
 * - pipelines.ts: Pipeline evaluation helpers
 * - overloads.ts: Overload resolution
 */

import { TokenType } from "../token";
import {
  Expr,
  Stmt,
  Program,
  CallExpr,
  FunctionExpr,
  BlockBody,
  Decorator,
  AnyPipelineStage,
  ParallelPipelineStage,
  MatchCase,
} from "../ast";

// Re-export types for consumers
export {
  LeaValue,
  LeaFunction,
  LeaBuiltin,
  LeaPromise,
  LeaRecord,
  LeaParallelResult,
  LeaTuple,
  LeaOverloadSet,
  LeaPipeline,
  LeaBidirectionalPipeline,
  LeaReversibleFunction,
  RuntimeError,
  ReturnValue,
  Environment,
} from "./types";

import {
  LeaValue,
  LeaFunction,
  LeaBuiltin,
  LeaPromise,
  LeaRecord,
  LeaPipeline,
  LeaBidirectionalPipeline,
  RuntimeError,
  ReturnValue,
  Environment,
} from "./types";

import {
  isLeaPromise,
  isParallelResult,
  isParallelStage,
  isOverloadSet,
  isPipeline,
  isBidirectionalPipeline,
  isReversibleFunction,
  unwrapPromise,
  wrapPromise,
  asNumber,
  isTruthy,
  stringify,
  coerceToString,
  getLeaType,
} from "./helpers";

import { builtins } from "./builtins";

import {
  applyFunctionDecorator,
  applyPipelineDecorator,
  applyPipelineDecoratorAsync,
} from "./decorators";

import {
  getPipelineMember,
  createPipelineGlobal,
  describeAnyStage,
} from "./pipelines";

import {
  matchesType,
  formatType,
  resolveOverload,
} from "./overloads";

import { InterpreterContext } from "./context";

/**
 * Interpreter class - evaluates Lea programs
 */
export class Interpreter implements InterpreterContext {
  globals: Environment;
  memoCache = new Map<string, Map<string, LeaValue>>();
  traceDepth = 0;
  contextRegistry = new Map<string, { default: LeaValue; current: LeaValue }>();
  customDecorators = new Map<string, LeaFunction>();

  constructor() {
    this.globals = new Environment();
    for (const [name, fn] of Object.entries(builtins)) {
      this.globals.define(name, { kind: "builtin", fn } as LeaBuiltin, false);
    }

    // Define Pipeline global object with algebra operations
    this.globals.define("Pipeline", createPipelineGlobal(this.globals), false);
  }

  setTraceDepth(depth: number): void {
    this.traceDepth = depth;
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

  executeStmt(stmt: Stmt, env: Environment): LeaValue {
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

      case "AndStmt": {
        // 'and' extends an existing function definition (overload or reverse)
        const value = this.evaluateExpr(stmt.value, env);

        // The name must already exist
        if (!env.hasInCurrentScope(stmt.name)) {
          throw new RuntimeError(`Cannot use 'and' - '${stmt.name}' is not defined. Use 'let' to define it first.`);
        }

        // Must be a function
        const isFunction = value !== null && typeof value === "object" && "kind" in value && value.kind === "function";
        if (!isFunction) {
          throw new RuntimeError(`'and' can only be used with function definitions`);
        }

        const fn = value as LeaFunction;
        const isReverse = fn.isReverse === true;

        if (isReverse) {
          // Add reverse function definition
          env.addReverse(stmt.name, fn);
        } else {
          // Add as overload
          env.addOverload(stmt.name, fn);
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
        // In match guards, _ is bound to the matched value
        if (env.has("_")) {
          return env.get("_");
        }
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

      case "SpreadPipeExpr":
        return this.evaluateSpreadPipe(expr.left, expr.right, env);

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
          return getPipelineMember(this, obj, expr.member, env);
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
          decorators: expr.decorators,
        } as LeaPipeline;
      }

      case "BidirectionalPipelineLiteral": {
        // Create a bidirectional pipeline that can be applied forward or in reverse
        return {
          kind: "bidirectional_pipeline" as const,
          stages: expr.stages,
          closure: env,
          decorators: expr.decorators,
        } as LeaBidirectionalPipeline;
      }

      case "ReversePipeExpr": {
        // Apply value through pipeline/function in reverse
        const value = this.evaluateExpr(expr.left, env);
        const pipeline = this.evaluateExpr(expr.right, env);
        return this.applyReverse(pipeline, value, env);
      }

      case "MatchExpr": {
        const matchValue = this.evaluateExpr(expr.value, env);
        return this.evaluateMatch(matchValue, expr.cases, env);
      }
    }
  }

  // Evaluate a match expression by finding the first matching case
  private evaluateMatch(matchValue: LeaValue, cases: MatchCase[], env: Environment): LeaValue {
    for (const matchCase of cases) {
      // Check if this case matches
      if (matchCase.guard !== null) {
        // Guard case: | if condition -> result
        // Create an environment where _ refers to the matched value
        const guardEnv = new Environment(env);
        guardEnv.define("_", matchValue, false);
        const guardResult = this.evaluateExpr(matchCase.guard, guardEnv);
        if (isTruthy(guardResult)) {
          // Guard matched - evaluate body in same environment
          return this.evaluateExpr(matchCase.body, guardEnv);
        }
      } else if (matchCase.pattern !== null) {
        // Pattern case: | pattern -> result
        const patternValue = this.evaluateExpr(matchCase.pattern, env);
        if (this.isEqual(matchValue, patternValue)) {
          return this.evaluateExpr(matchCase.body, env);
        }
      } else {
        // Default case: | result (no pattern or guard)
        return this.evaluateExpr(matchCase.body, env);
      }
    }
    throw new RuntimeError("No matching case in match expression");
  }

  // Async version of evaluateMatch
  private async evaluateMatchAsync(matchValue: LeaValue, cases: MatchCase[], env: Environment): Promise<LeaValue> {
    for (const matchCase of cases) {
      // Check if this case matches
      if (matchCase.guard !== null) {
        // Guard case: | if condition -> result
        // Create an environment where _ refers to the matched value
        const guardEnv = new Environment(env);
        guardEnv.define("_", matchValue, false);
        const guardResult = await this.evaluateExprAsync(matchCase.guard, guardEnv);
        if (isTruthy(guardResult)) {
          // Guard matched - evaluate body in same environment
          return this.evaluateExprAsync(matchCase.body, guardEnv);
        }
      } else if (matchCase.pattern !== null) {
        // Pattern case: | pattern -> result
        const patternValue = await this.evaluateExprAsync(matchCase.pattern, env);
        if (this.isEqual(matchValue, patternValue)) {
          return this.evaluateExprAsync(matchCase.body, env);
        }
      } else {
        // Default case: | result (no pattern or guard)
        return this.evaluateExprAsync(matchCase.body, env);
      }
    }
    throw new RuntimeError("No matching case in match expression");
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

  private evaluateSpreadPipe(left: Expr, right: Expr, env: Environment): LeaValue {
    const leftValue = this.evaluateExpr(left, env);

    // Promise-aware spread pipe: if left side is a promise, return a promise that awaits it
    if (isLeaPromise(leftValue)) {
      return wrapPromise(
        leftValue.promise.then((resolved) => {
          return this.evaluateSpreadPipeWithValue(resolved, right, env);
        })
      );
    }

    return this.evaluateSpreadPipeWithValue(leftValue, right, env);
  }

  private evaluateSpreadPipeWithValue(leftValue: LeaValue, right: Expr, env: Environment): LeaValue {
    // Get the elements to spread over
    let elements: LeaValue[];

    if (Array.isArray(leftValue)) {
      // Left is a list - map over each element
      elements = leftValue;
    } else if (isParallelResult(leftValue)) {
      // Left is a parallel result - map over each branch result
      elements = leftValue.values;
    } else {
      throw new RuntimeError("Spread pipe />>> requires a list or parallel result on the left side");
    }

    // Map the right side function/pipeline over each element
    const results: LeaValue[] = [];
    for (const element of elements) {
      const result = this.evaluatePipeWithValue(element, right, env);
      results.push(result);
    }

    // If any result is a promise, return a promise that waits for all
    const hasPromise = results.some((r) => isLeaPromise(r));
    if (hasPromise) {
      return wrapPromise(
        Promise.all(
          results.map((r) => (isLeaPromise(r) ? r.promise : Promise.resolve(r)))
        )
      );
    }

    return results;
  }

  evaluatePipeWithValue(pipedValue: LeaValue, right: Expr, env: Environment): LeaValue {
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
  applyPipeline(pipeline: LeaPipeline, args: LeaValue[]): LeaValue {
    // Create the base executor that runs the pipeline stages
    let executor = (pipeArgs: LeaValue[]): LeaValue => {
      return this.executePipelineStages(pipeline, pipeArgs);
    };

    // Apply decorators in reverse order (like function decorators)
    for (const decorator of [...pipeline.decorators].reverse()) {
      executor = applyPipelineDecorator(this, decorator, executor, pipeline);
    }

    return executor(args);
  }

  // Execute the core pipeline stages without decorators
  private executePipelineStages(pipeline: LeaPipeline, args: LeaValue[]): LeaValue {
    let current: LeaValue = args[0];

    for (const stage of pipeline.stages) {
      // Check if this is a parallel stage
      if (stage.isParallel) {
        const parallelStage = stage as ParallelPipelineStage;
        // Execute each branch with the current value
        const branchResults: LeaValue[] = parallelStage.branches.map((branchExpr) => {
          return this.evaluatePipeWithValue(current, branchExpr, pipeline.closure);
        });
        // Wrap results as a parallel result for the next stage to spread
        current = { kind: "parallel_result" as const, values: branchResults };
        continue;
      }

      // Regular stage - evaluate the stage expression and pipe the current value into it
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
        if (isParallelStage(stage)) {
          throw new RuntimeError("Cannot apply reverse to pipeline with parallel stages");
        }
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

  evaluateCall(expr: CallExpr, env: Environment, pipedValue?: LeaValue): LeaValue {
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

  createFunction(expr: FunctionExpr, env: Environment): LeaFunction {
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

  callFunction(fn: LeaFunction, args: LeaValue[]): LeaValue {
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
      executor = applyFunctionDecorator(this, decorator, executor, fn);
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

  async executeStmtAsync(stmt: Stmt, env: Environment): Promise<LeaValue> {
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

      case "AndStmt": {
        // 'and' extends an existing function definition (overload or reverse)
        const value = await this.evaluateExprAsync(stmt.value, env);

        // The name must already exist
        if (!env.hasInCurrentScope(stmt.name)) {
          throw new RuntimeError(`Cannot use 'and' - '${stmt.name}' is not defined. Use 'let' to define it first.`);
        }

        // Must be a function
        const isFunction = value !== null && typeof value === "object" && "kind" in value && value.kind === "function";
        if (!isFunction) {
          throw new RuntimeError(`'and' can only be used with function definitions`);
        }

        const fn = value as LeaFunction;
        const isReverse = fn.isReverse === true;

        if (isReverse) {
          // Add reverse function definition
          env.addReverse(stmt.name, fn);
        } else {
          // Add as overload
          env.addOverload(stmt.name, fn);
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

  async evaluateExprAsync(expr: Expr, env: Environment): Promise<LeaValue> {
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
        // In match guards, _ is bound to the matched value
        if (env.has("_")) {
          return env.get("_");
        }
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

      case "SpreadPipeExpr": {
        const leftValue = await this.evaluateExprAsync(expr.left, env);
        return this.evaluateSpreadPipeWithValueAsync(leftValue, expr.right, env);
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
          return getPipelineMember(this, obj, expr.member, env);
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
          decorators: expr.decorators,
        } as LeaPipeline;
      }

      case "BidirectionalPipelineLiteral": {
        // Create a bidirectional pipeline that can be applied forward or in reverse
        return {
          kind: "bidirectional_pipeline" as const,
          stages: expr.stages,
          closure: env,
          decorators: expr.decorators,
        } as LeaBidirectionalPipeline;
      }

      case "ReversePipeExpr": {
        // Apply value through pipeline/function in reverse
        const value = await this.evaluateExprAsync(expr.left, env);
        const pipeline = await this.evaluateExprAsync(expr.right, env);
        return this.applyReverseAsync(pipeline, value, env);
      }

      case "MatchExpr": {
        const matchValue = await this.evaluateExprAsync(expr.value, env);
        return this.evaluateMatchAsync(matchValue, expr.cases, env);
      }

      default:
        throw new RuntimeError(`Unknown expression kind: ${(expr as Expr).kind}`);
    }
  }

  private async evaluateSpreadPipeWithValueAsync(leftValue: LeaValue, right: Expr, env: Environment): Promise<LeaValue> {
    // Get the elements to spread over
    let elements: LeaValue[];

    if (Array.isArray(leftValue)) {
      // Left is a list - map over each element
      elements = leftValue;
    } else if (isParallelResult(leftValue)) {
      // Left is a parallel result - map over each branch result
      elements = leftValue.values;
    } else {
      throw new RuntimeError("Spread pipe />>> requires a list or parallel result on the left side");
    }

    // Map the right side function/pipeline over each element (in parallel)
    const results = await Promise.all(
      elements.map((element) => this.evaluatePipeWithValueAsync(element, right, env))
    );

    return results;
  }

  async evaluatePipeWithValueAsync(pipedValue: LeaValue, right: Expr, env: Environment): Promise<LeaValue> {
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
  async applyPipelineAsync(pipeline: LeaPipeline, args: LeaValue[]): Promise<LeaValue> {
    // Create the base executor that runs the pipeline stages
    let executor = async (pipeArgs: LeaValue[]): Promise<LeaValue> => {
      return this.executePipelineStagesAsync(pipeline, pipeArgs);
    };

    // Apply decorators in reverse order (like function decorators)
    for (const decorator of [...pipeline.decorators].reverse()) {
      executor = applyPipelineDecoratorAsync(this, decorator, executor, pipeline);
    }

    return executor(args);
  }

  // Execute the core pipeline stages without decorators (async version)
  private async executePipelineStagesAsync(pipeline: LeaPipeline, args: LeaValue[]): Promise<LeaValue> {
    let current: LeaValue = args[0];

    for (const stage of pipeline.stages) {
      // Check if this is a parallel stage
      if (stage.isParallel) {
        const parallelStage = stage as ParallelPipelineStage;
        // Execute each branch with the current value (in parallel)
        const branchResults = await Promise.all(
          parallelStage.branches.map((branchExpr) => {
            return this.evaluatePipeWithValueAsync(current, branchExpr, pipeline.closure);
          })
        );
        // Wrap results as a parallel result for the next stage to spread
        current = { kind: "parallel_result" as const, values: branchResults };
        continue;
      }

      // Regular stage
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
        if (isParallelStage(stage)) {
          throw new RuntimeError("Cannot apply reverse to pipeline with parallel stages");
        }
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

  private async evaluateParallelBranchesAsync(inputValue: LeaValue, branches: Expr[], env: Environment): Promise<LeaValue> {
    // Execute all branches in parallel
    const branchPromises = branches.map(async (branch) => {
      return this.evaluatePipeWithValueAsync(inputValue, branch, env);
    });

    // Return LeaParallelResult
    const values = await Promise.all(branchPromises);
    return { kind: "parallel_result" as const, values };
  }

  async evaluateCallAsync(expr: CallExpr, env: Environment, pipedValue?: LeaValue): Promise<LeaValue> {
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

  async callFunctionAsync(fn: LeaFunction, args: LeaValue[]): Promise<LeaValue> {
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

  // Type helpers for InterpreterContext interface
  getLeaType(val: LeaValue): string {
    return getLeaType(val);
  }

  matchesType(val: LeaValue, expectedType: string | { tuple: string[]; optional?: boolean }): boolean {
    return matchesType(val, expectedType);
  }

  formatType(t: string | { tuple: string[]; optional?: boolean }): string {
    return formatType(t);
  }

  resolveOverload(overloads: LeaFunction[], args: LeaValue[]): LeaFunction {
    return resolveOverload(overloads, args);
  }

  describeAnyStage(stage: AnyPipelineStage): string {
    return describeAnyStage(stage);
  }
}

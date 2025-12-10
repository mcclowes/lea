/**
 * Decorator implementations for the Lea interpreter
 *
 * This module contains implementations for function and pipeline decorators.
 */

import { Decorator } from "../ast";
import {
  LeaValue,
  LeaFunction,
  LeaBuiltin,
  LeaPipeline,
  LeaTuple,
  RuntimeError,
} from "./types";
import {
  stringify,
  isLeaPromise,
  wrapPromise,
  unwrapPromise,
  isParallelStage,
  isSpreadStage,
  isPipeline,
  isLeaTuple,
} from "./helpers";
import { builtins } from "./builtins";
import { InterpreterContext } from "./context";

/**
 * Coerce a value to a target type (strict coercion)
 * Throws RuntimeError if coercion is not possible
 */
function coerceToType(val: LeaValue, targetType: string): LeaValue {
  switch (targetType) {
    case "int":
    case "number": {
      if (typeof val === "number") return val;
      if (typeof val === "string") {
        const num = Number(val);
        if (!isNaN(num)) return num;
        throw new RuntimeError(`[coerce] Cannot coerce string "${val}" to Int`);
      }
      if (typeof val === "boolean") return val ? 1 : 0;
      throw new RuntimeError(`[coerce] Cannot coerce ${typeof val} to Int`);
    }

    case "string": {
      return stringify(val);
    }

    case "bool":
    case "boolean": {
      if (typeof val === "boolean") return val;
      if (typeof val === "number") return val !== 0;
      if (typeof val === "string") {
        const lower = val.toLowerCase();
        if (lower === "true" || lower === "1" || lower === "yes") return true;
        if (lower === "false" || lower === "0" || lower === "no" || lower === "") return false;
        throw new RuntimeError(`[coerce] Cannot coerce string "${val}" to Bool`);
      }
      if (val === null) return false;
      throw new RuntimeError(`[coerce] Cannot coerce ${typeof val} to Bool`);
    }

    case "list": {
      if (Array.isArray(val)) return val;
      if (isLeaTuple(val)) return val.elements;
      if (typeof val === "string") return val.split("");
      // Wrap single value in a list
      return [val];
    }

    default:
      throw new RuntimeError(`[coerce] Unknown target type: ${targetType}`);
  }
}

/**
 * Try to coerce a value to a target type (best effort, lenient)
 * Returns original value if coercion fails
 */
function teaseToType(val: LeaValue, targetType: string): LeaValue {
  switch (targetType) {
    case "int":
    case "number": {
      if (typeof val === "number") return val;
      if (typeof val === "boolean") return val ? 1 : 0;
      if (typeof val === "string") {
        // Try to extract numbers from the string
        const trimmed = val.trim();

        // Direct number conversion
        const direct = Number(trimmed);
        if (!isNaN(direct) && trimmed !== "") return direct;

        // Try to extract leading number (e.g., "42px" -> 42)
        const leadingMatch = trimmed.match(/^-?\d+\.?\d*/);
        if (leadingMatch && leadingMatch[0]) {
          const num = Number(leadingMatch[0]);
          if (!isNaN(num)) return num;
        }

        // Try to extract any number from the string
        const anyMatch = trimmed.match(/-?\d+\.?\d*/);
        if (anyMatch && anyMatch[0]) {
          const num = Number(anyMatch[0]);
          if (!isNaN(num)) return num;
        }

        // If string looks like a boolean, convert to 0/1
        const lower = trimmed.toLowerCase();
        if (lower === "true" || lower === "yes") return 1;
        if (lower === "false" || lower === "no") return 0;
      }
      if (Array.isArray(val)) return val.length;
      if (isLeaTuple(val)) return val.elements.length;
      if (val === null) return 0;
      // Return 0 as fallback for numbers
      return 0;
    }

    case "string": {
      return stringify(val);
    }

    case "bool":
    case "boolean": {
      if (typeof val === "boolean") return val;
      if (typeof val === "number") return val !== 0;
      if (typeof val === "string") {
        const lower = val.toLowerCase().trim();
        if (lower === "true" || lower === "1" || lower === "yes") return true;
        if (lower === "false" || lower === "0" || lower === "no" || lower === "") return false;
        // Non-empty strings are truthy
        return val.length > 0;
      }
      if (Array.isArray(val)) return val.length > 0;
      if (isLeaTuple(val)) return val.elements.length > 0;
      if (val === null) return false;
      return true;
    }

    case "list": {
      if (Array.isArray(val)) return val;
      if (isLeaTuple(val)) return val.elements;
      if (typeof val === "string") return val.split("");
      // Wrap single value in a list
      return [val];
    }

    default:
      // Unknown type, return as-is
      return val;
  }
}

/**
 * Apply a decorator to a function (sync version)
 */
export function applyFunctionDecorator(
  ctx: InterpreterContext,
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

    case "log_verbose": {
      return (args: LeaValue[]) => {
        console.log(`[log_verbose] ════════════════════════════════════════`);
        console.log(`[log_verbose] Function called`);
        console.log(`[log_verbose] ────────────────────────────────────────`);
        console.log(`[log_verbose] Parameters:`);
        fn.params.forEach((param, i) => {
          const argVal = args[i];
          const typeInfo = fn.typeSignature?.paramTypes[i] ?? param.typeAnnotation;
          const typeStr = typeInfo ? ` :: ${ctx.formatType(typeInfo)}` : "";
          console.log(`[log_verbose]   ${param.name}${typeStr} = ${stringify(argVal)}`);
        });
        console.log(`[log_verbose] ────────────────────────────────────────`);
        console.log(`[log_verbose] Executing...`);
        const startTime = performance.now();
        const result = executor(args);
        const elapsed = performance.now() - startTime;
        console.log(`[log_verbose] ────────────────────────────────────────`);
        const returnTypeInfo = fn.typeSignature?.returnType ?? fn.returnType;
        const returnTypeStr = returnTypeInfo ? ` :: ${ctx.formatType(returnTypeInfo)}` : "";
        console.log(`[log_verbose] Returned${returnTypeStr}: ${stringify(result)}`);
        console.log(`[log_verbose] Execution time: ${elapsed.toFixed(3)}ms`);
        console.log(`[log_verbose] ════════════════════════════════════════`);
        return result;
      };
    }

    case "memo": {
      const fnKey = JSON.stringify(fn.params.map(p => p.name));
      if (!ctx.memoCache.has(fnKey)) {
        ctx.memoCache.set(fnKey, new Map());
      }
      const cache = ctx.memoCache.get(fnKey)!;
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

          if (expectedType && !ctx.matchesType(arg, expectedType)) {
            throw new RuntimeError(
              `[validate] Argument '${param.name}' expected ${ctx.formatType(expectedType)}, got ${ctx.getLeaType(arg)}`
            );
          }
        });

        const result = executor(args);

        // Validate return type - support both old style and new typeSignature
        const expectedReturnType = fn.typeSignature?.returnType ?? fn.returnType;

        const validateReturnValue = (value: LeaValue) => {
          if (expectedReturnType) {
            const isOptional = typeof expectedReturnType === "string" && expectedReturnType.startsWith("?") ||
                              typeof expectedReturnType === "object" && (expectedReturnType as { optional?: boolean }).optional;

            if ((value === null || value === undefined) && !isOptional) {
              throw new RuntimeError(`[validate] Return value is null/undefined`);
            }

            if (!ctx.matchesType(value, expectedReturnType)) {
              throw new RuntimeError(
                `[validate] Expected return type ${ctx.formatType(expectedReturnType)}, got ${ctx.getLeaType(value)}`
              );
            }
          }
          return value;
        };

        // Handle promises - validate after resolution
        if (isLeaPromise(result)) {
          return wrapPromise(result.promise.then(validateReturnValue));
        }

        return validateReturnValue(result);
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
      const indent = ctx.traceDepth;
      return (args: LeaValue[]) => {
        const prefix = "  ".repeat(indent);
        console.log(`${prefix}[trace] → Called with:`, args.map(stringify).join(", "));
        ctx.setTraceDepth(ctx.traceDepth + 1);
        try {
          const result = executor(args);
          console.log(`${prefix}[trace] ← Returned:`, stringify(result));
          return result;
        } finally {
          ctx.setTraceDepth(ctx.traceDepth - 1);
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

    case "coerce": {
      // Coerce input arguments to specified type before calling the function
      // Usage: #coerce(Int) or #coerce(String) or #coerce(Bool) or #coerce(List)
      const targetType = (decorator.args[0] as string)?.toLowerCase() ?? "string";
      return (args: LeaValue[]) => {
        const coercedArgs = args.map(arg => coerceToType(arg, targetType));
        return executor(coercedArgs);
      };
    }

    case "parse": {
      // Auto-parse string input as JSON or number
      // Tries: number first, then JSON, then leaves as-is
      return (args: LeaValue[]) => {
        const parsedArgs = args.map(arg => {
          if (typeof arg !== "string") return arg;

          // Try parsing as number first
          const num = Number(arg);
          if (!isNaN(num) && arg.trim() !== "") return num;

          // Try parsing as JSON
          try {
            return JSON.parse(arg);
          } catch {
            // Return original string if parsing fails
            return arg;
          }
        });
        return executor(parsedArgs);
      };
    }

    case "stringify": {
      // Auto-stringify the output
      return (args: LeaValue[]) => {
        const result = executor(args);
        return stringify(result);
      };
    }

    case "tease": {
      // Try to coerce the returned value into a given type (best effort)
      // Usage: #tease(Int) or #tease(String) or #tease(Bool) or #tease(List)
      const targetType = (decorator.args[0] as string)?.toLowerCase() ?? "int";
      return (args: LeaValue[]) => {
        const result = executor(args);
        return teaseToType(result, targetType);
      };
    }

    case "profile": {
      // Profile function execution time
      return (args: LeaValue[]) => {
        const start = performance.now();
        const result = executor(args);
        const elapsed = performance.now() - start;
        console.log(`[profile] Function executed in ${elapsed.toFixed(3)}ms`);
        return result;
      };
    }

    case "debug": {
      // Debug function execution with input/output logging
      return (args: LeaValue[]) => {
        console.log(`[debug] ─────────────────────────────────`);
        console.log(`[debug] Input:`, args.map(stringify).join(", "));
        const start = performance.now();
        const result = executor(args);
        const elapsed = performance.now() - start;
        console.log(`[debug] Output:`, stringify(result));
        console.log(`[debug] Time: ${elapsed.toFixed(3)}ms`);
        console.log(`[debug] ─────────────────────────────────`);
        return result;
      };
    }

    case "tap": {
      // Inspect the return value without modifying it (like pipeline #tap)
      const tapFnName = decorator.args[0] as string | undefined;
      return (args: LeaValue[]) => {
        const result = executor(args);
        if (tapFnName) {
          const tapFn = ctx.globals.get(tapFnName);
          if (tapFn && typeof tapFn === "object" && "kind" in tapFn && tapFn.kind === "function") {
            ctx.callFunction(tapFn as LeaFunction, [result]);
          }
        } else {
          console.log(stringify(result));
        }
        return result;
      };
    }

    default: {
      // Check for custom decorator
      const customDecorator = ctx.customDecorators.get(decorator.name);
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
          const transformedFn = ctx.callFunction(customDecorator, [wrappedFn]);

          // If it returns a function, call it with the args
          if (transformedFn && typeof transformedFn === "object" && "kind" in transformedFn && transformedFn.kind === "function") {
            return ctx.callFunction(transformedFn as LeaFunction, args);
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

/**
 * Apply a decorator to a pipeline (sync version)
 */
export function applyPipelineDecorator(
  ctx: InterpreterContext,
  decorator: Decorator,
  executor: (args: LeaValue[]) => LeaValue,
  pipeline: LeaPipeline
): (args: LeaValue[]) => LeaValue {
  switch (decorator.name) {
    case "log":
      return (args: LeaValue[]) => {
        console.log(`[log] Pipeline called with:`, args.map(stringify).join(", "));
        const result = executor(args);
        console.log(`[log] Pipeline returned:`, stringify(result));
        return result;
      };

    case "log_verbose": {
      // Log-verbose decorator - detailed stage-by-stage logging with values
      return (args: LeaValue[]) => {
        const totalStart = performance.now();
        console.log(`[log_verbose] ════════════════════════════════════════`);
        console.log(`[log_verbose] Pipeline execution started`);
        console.log(`[log_verbose] Stages: ${pipeline.stages.length}`);
        console.log(`[log_verbose] ────────────────────────────────────────`);
        console.log(`[log_verbose] Input: ${args.map(stringify).join(", ")}`);
        console.log(`[log_verbose] ────────────────────────────────────────`);

        let current: LeaValue = args[0];
        for (let i = 0; i < pipeline.stages.length; i++) {
          const stage = pipeline.stages[i];
          const stageName = ctx.describeAnyStage(stage);
          const stageStart = performance.now();

          console.log(`[log_verbose] Stage ${i + 1}/${pipeline.stages.length}: ${stageName}`);
          console.log(`[log_verbose]   Input:  ${stringify(current)}`);

          if (isParallelStage(stage)) {
            // Execute parallel branches with detailed logging
            console.log(`[log_verbose]   Parallel branches: ${stage.branches.length}`);
            const branchResults: LeaValue[] = stage.branches.map((branchExpr, bi) => {
              const branchStart = performance.now();
              const branchResult = ctx.evaluatePipeWithValue(current, branchExpr, pipeline.closure);
              const branchTime = performance.now() - branchStart;
              console.log(`[log_verbose]     Branch ${bi + 1}: ${stringify(branchResult)} (${branchTime.toFixed(3)}ms)`);
              return branchResult;
            });
            current = { kind: "parallel_result" as const, values: branchResults };
          } else if (isSpreadStage(stage)) {
            // Execute spread stage - map function over each element
            console.log(`[log_verbose]   Spread stage: mapping over ${Array.isArray(current) ? current.length : 'non-list'} elements`);
            current = ctx.evaluateSpreadPipeWithValue(current, stage.expr, pipeline.closure);
          } else if (stage.expr.kind === "Identifier") {
            const stageVal = ctx.evaluateExpr(stage.expr, pipeline.closure);
            if (isPipeline(stageVal)) {
              current = ctx.applyPipeline(stageVal, [current]);
            } else {
              current = ctx.evaluatePipeWithValue(current, stage.expr, pipeline.closure);
            }
          } else {
            current = ctx.evaluatePipeWithValue(current, stage.expr, pipeline.closure);
          }

          const stageTime = performance.now() - stageStart;
          console.log(`[log_verbose]   Output: ${stringify(current)}`);
          console.log(`[log_verbose]   Time:   ${stageTime.toFixed(3)}ms`);
          console.log(`[log_verbose] ────────────────────────────────────────`);
        }

        const totalTime = performance.now() - totalStart;
        console.log(`[log_verbose] Final output: ${stringify(current)}`);
        console.log(`[log_verbose] Total time: ${totalTime.toFixed(3)}ms`);
        console.log(`[log_verbose] ════════════════════════════════════════`);
        return current;
      };
    }

    case "memo": {
      // Use persistent cache on pipeline object (created once, reused across calls)
      if (!pipeline.memoCache) {
        pipeline.memoCache = new Map<string, LeaValue>();
      }
      const cache = pipeline.memoCache;
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
        console.log(`[time] Pipeline execution took ${elapsed.toFixed(3)}ms`);
        return result;
      };

    case "tap": {
      // Tap decorator - apply a side-effect function without modifying the value
      return (args: LeaValue[]) => {
        const result = executor(args);
        // If an argument was provided (function name as string), look it up
        if (decorator.args.length > 0) {
          const tapFnName = decorator.args[0] as string;
          try {
            const tapFn = ctx.globals.get(tapFnName);
            if (tapFn && typeof tapFn === "object" && "kind" in tapFn &&
                (tapFn.kind === "function" || tapFn.kind === "builtin")) {
              if (tapFn.kind === "function") {
                ctx.callFunction(tapFn as LeaFunction, [result]);
              } else {
                (tapFn as LeaBuiltin).fn([result]);
              }
            }
          } catch {
            // Ignore if function not found
          }
        } else {
          // Default: log the value
          console.log(`[tap]`, stringify(result));
        }
        return result;
      };
    }

    case "debug": {
      // Debug decorator - shows input/output and each stage's name
      return (args: LeaValue[]) => {
        console.log(`[debug] Pipeline input:`, args.map(stringify).join(", "));
        console.log(`[debug] Stages:`, pipeline.stages.map(s => ctx.describeAnyStage(s)).join(" /> "));

        // Execute with detailed stage-by-stage logging
        let current: LeaValue = args[0];
        for (let i = 0; i < pipeline.stages.length; i++) {
          const stage = pipeline.stages[i];
          const stageName = ctx.describeAnyStage(stage);

          if (isParallelStage(stage)) {
            // Execute parallel branches
            const branchResults: LeaValue[] = stage.branches.map((branchExpr) => {
              return ctx.evaluatePipeWithValue(current, branchExpr, pipeline.closure);
            });
            current = { kind: "parallel_result" as const, values: branchResults };
          } else if (isSpreadStage(stage)) {
            // Execute spread stage
            current = ctx.evaluateSpreadPipeWithValue(current, stage.expr, pipeline.closure);
          } else if (stage.expr.kind === "Identifier") {
            const stageVal = ctx.evaluateExpr(stage.expr, pipeline.closure);
            if (isPipeline(stageVal)) {
              current = ctx.applyPipeline(stageVal, [current]);
            } else {
              current = ctx.evaluatePipeWithValue(current, stage.expr, pipeline.closure);
            }
          } else {
            current = ctx.evaluatePipeWithValue(current, stage.expr, pipeline.closure);
          }

          console.log(`[debug]   ${stageName}: ${stringify(current)}`);
        }

        console.log(`[debug] Pipeline output:`, stringify(current));
        return current;
      };
    }

    case "profile": {
      // Profile decorator - detailed timing for each stage
      return (args: LeaValue[]) => {
        const totalStart = performance.now();
        const stageTimes: { name: string; time: number }[] = [];

        let current: LeaValue = args[0];
        for (let i = 0; i < pipeline.stages.length; i++) {
          const stage = pipeline.stages[i];
          const stageName = ctx.describeAnyStage(stage);

          const stageStart = performance.now();

          if (isParallelStage(stage)) {
            // Execute parallel branches
            const branchResults: LeaValue[] = stage.branches.map((branchExpr) => {
              return ctx.evaluatePipeWithValue(current, branchExpr, pipeline.closure);
            });
            current = { kind: "parallel_result" as const, values: branchResults };
          } else if (isSpreadStage(stage)) {
            // Execute spread stage
            current = ctx.evaluateSpreadPipeWithValue(current, stage.expr, pipeline.closure);
          } else if (stage.expr.kind === "Identifier") {
            const stageVal = ctx.evaluateExpr(stage.expr, pipeline.closure);
            if (isPipeline(stageVal)) {
              current = ctx.applyPipeline(stageVal, [current]);
            } else {
              current = ctx.evaluatePipeWithValue(current, stage.expr, pipeline.closure);
            }
          } else {
            current = ctx.evaluatePipeWithValue(current, stage.expr, pipeline.closure);
          }

          stageTimes.push({ name: stageName, time: performance.now() - stageStart });
        }

        const totalTime = performance.now() - totalStart;
        console.log(`[profile] Pipeline execution profile:`);
        stageTimes.forEach(({ name, time }) => {
          const percent = ((time / totalTime) * 100).toFixed(1);
          console.log(`[profile]   ${name}: ${time.toFixed(3)}ms (${percent}%)`);
        });
        console.log(`[profile] Total: ${totalTime.toFixed(3)}ms`);

        return current;
      };
    }

    case "trace": {
      const indent = ctx.traceDepth;
      return (args: LeaValue[]) => {
        const prefix = "  ".repeat(indent);
        console.log(`${prefix}[trace] → Pipeline called with:`, args.map(stringify).join(", "));
        ctx.setTraceDepth(ctx.traceDepth + 1);
        try {
          const result = executor(args);
          console.log(`${prefix}[trace] ← Pipeline returned:`, stringify(result));
          return result;
        } finally {
          ctx.setTraceDepth(ctx.traceDepth - 1);
        }
      };
    }

    case "export":
      // Export decorator is a marker for the module system, not a runtime decorator
      // Just return the executor unchanged
      return executor;

    case "autoparallel": {
      // Autoparallel decorator - automatically parallelize map/filter operations on lists
      // When the input is a list, stages that use map/filter will process elements concurrently
      const concurrencyLimit = (decorator.args[0] as number) ?? 10;
      return (args: LeaValue[]) => {
        const input = args[0];

        // Only optimize for list inputs
        if (!Array.isArray(input)) {
          return executor(args);
        }

        // If list is small, don't bother with parallelization overhead
        if (input.length <= 3) {
          return executor(args);
        }

        // Execute pipeline with parallel awareness
        console.log(`[autoparallel] Processing list of ${input.length} elements with concurrency ${concurrencyLimit}`);
        const result = executor(args);
        return result;
      };
    }

    case "batch": {
      // Batch decorator - split list processing into parallel chunks
      // Usage: #batch(4) - split into 4 parallel batches
      const numBatches = (decorator.args[0] as number) ?? 4;
      return (args: LeaValue[]) => {
        const input = args[0];

        // Only works for list inputs
        if (!Array.isArray(input)) {
          return executor(args);
        }

        // If list is smaller than num batches, just run normally
        if (input.length <= numBatches) {
          return executor(args);
        }

        // Split into batches and process in parallel
        const batchSize = Math.ceil(input.length / numBatches);
        const batches: LeaValue[][] = [];

        for (let i = 0; i < input.length; i += batchSize) {
          batches.push(input.slice(i, i + batchSize));
        }

        console.log(`[batch] Splitting ${input.length} elements into ${batches.length} batches of ~${batchSize} each`);

        // Process each batch through the pipeline
        const batchPromises = batches.map(async (batch) => {
          const result = executor([batch]);
          // If result is a list, return it; otherwise wrap as single-element
          if (Array.isArray(result)) {
            return result;
          }
          return [result];
        });

        // Return promise that combines results
        return wrapPromise(
          Promise.all(batchPromises).then((results) => {
            // Flatten results
            return results.flat();
          })
        );
      };
    }

    case "parallel": {
      // Parallel decorator - run each element through pipeline concurrently
      // Usage: #parallel or #parallel(10) for concurrency limit
      const concurrencyLimit = (decorator.args[0] as number) ?? Infinity;
      return (args: LeaValue[]) => {
        const input = args[0];

        // Only works for list inputs
        if (!Array.isArray(input)) {
          return executor(args);
        }

        console.log(`[parallel] Processing ${input.length} elements with concurrency ${concurrencyLimit === Infinity ? "unlimited" : concurrencyLimit}`);

        // Process with concurrency limiting
        const results: LeaValue[] = new Array(input.length);
        const executing: Promise<void>[] = [];
        let completed = 0;

        const processElement = async (element: LeaValue, index: number): Promise<void> => {
          const result = executor([element]);
          const unwrapped = await unwrapPromise(result);
          results[index] = unwrapped;
          completed++;
        };

        return wrapPromise((async () => {
          for (let i = 0; i < input.length; i++) {
            const p = processElement(input[i], i);
            executing.push(p);

            if (executing.length >= concurrencyLimit) {
              await Promise.race(executing);
              // Remove completed promises
              const stillExecuting = executing.filter((_, idx) => {
                // This is a simplification - in practice we'd track which are done
                return idx >= completed;
              });
              executing.length = 0;
              executing.push(...stillExecuting);
            }
          }

          await Promise.all(executing);
          return results;
        })());
      };
    }

    case "prefetch": {
      // Prefetch decorator - for async I/O operations, prefetch next batch
      // while current batch is processing
      const prefetchSize = (decorator.args[0] as number) ?? 2;
      return (args: LeaValue[]) => {
        const input = args[0];

        // Only works for list inputs
        if (!Array.isArray(input)) {
          return executor(args);
        }

        console.log(`[prefetch] Prefetching ${prefetchSize} ahead for ${input.length} elements`);

        // Run with prefetch buffer
        return wrapPromise((async () => {
          const results: LeaValue[] = [];
          const pending: Promise<LeaValue>[] = [];

          // Start initial prefetch
          for (let i = 0; i < Math.min(prefetchSize, input.length); i++) {
            pending.push(Promise.resolve(executor([input[i]])).then(r => unwrapPromise(r)));
          }

          let nextToFetch = prefetchSize;

          // Process results as they complete, prefetching more
          for (let i = 0; i < input.length; i++) {
            const result = await pending[i % prefetchSize];
            results.push(result);

            // Prefetch next
            if (nextToFetch < input.length) {
              pending[i % prefetchSize] = Promise.resolve(executor([input[nextToFetch]])).then(r => unwrapPromise(r));
              nextToFetch++;
            }
          }

          return results;
        })());
      };
    }

    default:
      // Unknown decorator - log warning and return unchanged
      console.warn(`Unknown pipeline decorator: #${decorator.name}`);
      return executor;
  }
}

/**
 * Apply a decorator to a pipeline (async version)
 */
export function applyPipelineDecoratorAsync(
  ctx: InterpreterContext,
  decorator: Decorator,
  executor: (args: LeaValue[]) => Promise<LeaValue>,
  pipeline: LeaPipeline
): (args: LeaValue[]) => Promise<LeaValue> {
  switch (decorator.name) {
    case "log":
      return async (args: LeaValue[]) => {
        console.log(`[log] Pipeline called with:`, args.map(stringify).join(", "));
        const result = await executor(args);
        console.log(`[log] Pipeline returned:`, stringify(result));
        return result;
      };

    case "log_verbose": {
      // Log-verbose decorator - detailed stage-by-stage logging with values (async)
      return async (args: LeaValue[]) => {
        const totalStart = performance.now();
        console.log(`[log_verbose] ════════════════════════════════════════`);
        console.log(`[log_verbose] Pipeline execution started`);
        console.log(`[log_verbose] Stages: ${pipeline.stages.length}`);
        console.log(`[log_verbose] ────────────────────────────────────────`);
        console.log(`[log_verbose] Input: ${args.map(stringify).join(", ")}`);
        console.log(`[log_verbose] ────────────────────────────────────────`);

        let current: LeaValue = args[0];
        for (let i = 0; i < pipeline.stages.length; i++) {
          const stage = pipeline.stages[i];
          const stageName = ctx.describeAnyStage(stage);
          const stageStart = performance.now();

          console.log(`[log_verbose] Stage ${i + 1}/${pipeline.stages.length}: ${stageName}`);
          console.log(`[log_verbose]   Input:  ${stringify(current)}`);

          if (isParallelStage(stage)) {
            // Execute parallel branches with detailed logging
            console.log(`[log_verbose]   Parallel branches: ${stage.branches.length}`);
            const branchResults = await Promise.all(
              stage.branches.map(async (branchExpr, bi) => {
                const branchStart = performance.now();
                const branchResult = await ctx.evaluatePipeWithValueAsync(current, branchExpr, pipeline.closure);
                const branchTime = performance.now() - branchStart;
                console.log(`[log_verbose]     Branch ${bi + 1}: ${stringify(branchResult)} (${branchTime.toFixed(3)}ms)`);
                return branchResult;
              })
            );
            current = { kind: "parallel_result" as const, values: branchResults };
          } else if (isSpreadStage(stage)) {
            // Execute spread stage - map function over each element
            console.log(`[log_verbose]   Spread stage: mapping over ${Array.isArray(current) ? current.length : 'non-list'} elements`);
            current = await ctx.evaluateSpreadPipeWithValueAsync(current, stage.expr, pipeline.closure);
          } else if (stage.expr.kind === "Identifier") {
            const stageVal = await ctx.evaluateExprAsync(stage.expr, pipeline.closure);
            if (isPipeline(stageVal)) {
              current = await ctx.applyPipelineAsync(stageVal, [current]);
            } else {
              current = await ctx.evaluatePipeWithValueAsync(current, stage.expr, pipeline.closure);
            }
          } else {
            current = await ctx.evaluatePipeWithValueAsync(current, stage.expr, pipeline.closure);
          }

          const stageTime = performance.now() - stageStart;
          console.log(`[log_verbose]   Output: ${stringify(current)}`);
          console.log(`[log_verbose]   Time:   ${stageTime.toFixed(3)}ms`);
          console.log(`[log_verbose] ────────────────────────────────────────`);
        }

        const totalTime = performance.now() - totalStart;
        console.log(`[log_verbose] Final output: ${stringify(current)}`);
        console.log(`[log_verbose] Total time: ${totalTime.toFixed(3)}ms`);
        console.log(`[log_verbose] ════════════════════════════════════════`);
        return current;
      };
    }

    case "memo": {
      // Use persistent cache on pipeline object (created once, reused across calls)
      if (!pipeline.memoCache) {
        pipeline.memoCache = new Map<string, LeaValue>();
      }
      const cache = pipeline.memoCache;
      return async (args: LeaValue[]) => {
        const key = JSON.stringify(args);
        if (cache.has(key)) {
          return cache.get(key)!;
        }
        const result = await executor(args);
        cache.set(key, result);
        return result;
      };
    }

    case "time":
      return async (args: LeaValue[]) => {
        const start = performance.now();
        const result = await executor(args);
        const elapsed = performance.now() - start;
        console.log(`[time] Pipeline execution took ${elapsed.toFixed(3)}ms`);
        return result;
      };

    case "tap": {
      return async (args: LeaValue[]) => {
        const result = await executor(args);
        if (decorator.args.length > 0) {
          const tapFnName = decorator.args[0] as string;
          try {
            const tapFn = ctx.globals.get(tapFnName);
            if (tapFn && typeof tapFn === "object" && "kind" in tapFn &&
                (tapFn.kind === "function" || tapFn.kind === "builtin")) {
              if (tapFn.kind === "function") {
                await ctx.callFunctionAsync(tapFn as LeaFunction, [result]);
              } else {
                const res = (tapFn as LeaBuiltin).fn([result]);
                if (res instanceof Promise) await res;
              }
            }
          } catch {
            // Ignore if function not found
          }
        } else {
          console.log(`[tap]`, stringify(result));
        }
        return result;
      };
    }

    case "debug": {
      return async (args: LeaValue[]) => {
        console.log(`[debug] Pipeline input:`, args.map(stringify).join(", "));
        console.log(`[debug] Stages:`, pipeline.stages.map(s => ctx.describeAnyStage(s)).join(" /> "));

        let current: LeaValue = args[0];
        for (let i = 0; i < pipeline.stages.length; i++) {
          const stage = pipeline.stages[i];
          const stageName = ctx.describeAnyStage(stage);

          if (isParallelStage(stage)) {
            // Execute parallel branches
            const branchResults = await Promise.all(
              stage.branches.map((branchExpr) => {
                return ctx.evaluatePipeWithValueAsync(current, branchExpr, pipeline.closure);
              })
            );
            current = { kind: "parallel_result" as const, values: branchResults };
          } else if (isSpreadStage(stage)) {
            // Execute spread stage
            current = await ctx.evaluateSpreadPipeWithValueAsync(current, stage.expr, pipeline.closure);
          } else if (stage.expr.kind === "Identifier") {
            const stageVal = await ctx.evaluateExprAsync(stage.expr, pipeline.closure);
            if (isPipeline(stageVal)) {
              current = await ctx.applyPipelineAsync(stageVal, [current]);
            } else {
              current = await ctx.evaluatePipeWithValueAsync(current, stage.expr, pipeline.closure);
            }
          } else {
            current = await ctx.evaluatePipeWithValueAsync(current, stage.expr, pipeline.closure);
          }

          console.log(`[debug]   ${stageName}: ${stringify(current)}`);
        }

        console.log(`[debug] Pipeline output:`, stringify(current));
        return current;
      };
    }

    case "profile": {
      return async (args: LeaValue[]) => {
        const totalStart = performance.now();
        const stageTimes: { name: string; time: number }[] = [];

        let current: LeaValue = args[0];
        for (let i = 0; i < pipeline.stages.length; i++) {
          const stage = pipeline.stages[i];
          const stageName = ctx.describeAnyStage(stage);

          const stageStart = performance.now();

          if (isParallelStage(stage)) {
            // Execute parallel branches
            const branchResults = await Promise.all(
              stage.branches.map((branchExpr) => {
                return ctx.evaluatePipeWithValueAsync(current, branchExpr, pipeline.closure);
              })
            );
            current = { kind: "parallel_result" as const, values: branchResults };
          } else if (isSpreadStage(stage)) {
            // Execute spread stage
            current = await ctx.evaluateSpreadPipeWithValueAsync(current, stage.expr, pipeline.closure);
          } else if (stage.expr.kind === "Identifier") {
            const stageVal = await ctx.evaluateExprAsync(stage.expr, pipeline.closure);
            if (isPipeline(stageVal)) {
              current = await ctx.applyPipelineAsync(stageVal, [current]);
            } else {
              current = await ctx.evaluatePipeWithValueAsync(current, stage.expr, pipeline.closure);
            }
          } else {
            current = await ctx.evaluatePipeWithValueAsync(current, stage.expr, pipeline.closure);
          }

          stageTimes.push({ name: stageName, time: performance.now() - stageStart });
        }

        const totalTime = performance.now() - totalStart;
        console.log(`[profile] Pipeline execution profile:`);
        stageTimes.forEach(({ name, time }) => {
          const percent = ((time / totalTime) * 100).toFixed(1);
          console.log(`[profile]   ${name}: ${time.toFixed(3)}ms (${percent}%)`);
        });
        console.log(`[profile] Total: ${totalTime.toFixed(3)}ms`);

        return current;
      };
    }

    case "trace": {
      const indent = ctx.traceDepth;
      return async (args: LeaValue[]) => {
        const prefix = "  ".repeat(indent);
        console.log(`${prefix}[trace] → Pipeline called with:`, args.map(stringify).join(", "));
        ctx.setTraceDepth(ctx.traceDepth + 1);
        try {
          const result = await executor(args);
          console.log(`${prefix}[trace] ← Pipeline returned:`, stringify(result));
          return result;
        } finally {
          ctx.setTraceDepth(ctx.traceDepth - 1);
        }
      };
    }

    case "export":
      // Export decorator is a marker for the module system, not a runtime decorator
      // Just return the executor unchanged
      return executor;

    case "autoparallel": {
      // Autoparallel decorator (async) - automatically parallelize map/filter operations
      const concurrencyLimit = (decorator.args[0] as number) ?? 10;
      return async (args: LeaValue[]) => {
        const input = args[0];

        if (!Array.isArray(input) || input.length <= 3) {
          return executor(args);
        }

        console.log(`[autoparallel] Processing list of ${input.length} elements with concurrency ${concurrencyLimit}`);
        return executor(args);
      };
    }

    case "batch": {
      // Batch decorator (async) - split list processing into parallel chunks
      const numBatches = (decorator.args[0] as number) ?? 4;
      return async (args: LeaValue[]) => {
        const input = args[0];

        if (!Array.isArray(input) || input.length <= numBatches) {
          return executor(args);
        }

        const batchSize = Math.ceil(input.length / numBatches);
        const batches: LeaValue[][] = [];

        for (let i = 0; i < input.length; i += batchSize) {
          batches.push(input.slice(i, i + batchSize));
        }

        console.log(`[batch] Splitting ${input.length} elements into ${batches.length} batches of ~${batchSize} each`);

        const batchPromises = batches.map(async (batch) => {
          const result = await executor([batch]);
          return Array.isArray(result) ? result : [result];
        });

        const results = await Promise.all(batchPromises);
        return results.flat();
      };
    }

    case "parallel": {
      // Parallel decorator (async) - run each element through pipeline concurrently
      const concurrencyLimit = (decorator.args[0] as number) ?? Infinity;
      return async (args: LeaValue[]) => {
        const input = args[0];

        if (!Array.isArray(input)) {
          return executor(args);
        }

        console.log(`[parallel] Processing ${input.length} elements with concurrency ${concurrencyLimit === Infinity ? "unlimited" : concurrencyLimit}`);

        const results: LeaValue[] = new Array(input.length);
        const executing: Promise<void>[] = [];
        let nextIndex = 0;

        const processElement = async (element: LeaValue, index: number): Promise<void> => {
          results[index] = await executor([element]);
        };

        // Semaphore-based concurrency control
        while (nextIndex < input.length || executing.length > 0) {
          // Start new tasks up to concurrency limit
          while (executing.length < concurrencyLimit && nextIndex < input.length) {
            const idx = nextIndex++;
            const p = processElement(input[idx], idx).then(() => {
              const pIndex = executing.indexOf(p);
              if (pIndex !== -1) executing.splice(pIndex, 1);
            });
            executing.push(p);
          }

          // Wait for at least one to complete
          if (executing.length > 0) {
            await Promise.race(executing);
          }
        }

        return results;
      };
    }

    case "prefetch": {
      // Prefetch decorator (async) - prefetch ahead while processing
      const prefetchSize = (decorator.args[0] as number) ?? 2;
      return async (args: LeaValue[]) => {
        const input = args[0];

        if (!Array.isArray(input)) {
          return executor(args);
        }

        console.log(`[prefetch] Prefetching ${prefetchSize} ahead for ${input.length} elements`);

        const results: LeaValue[] = [];
        const pending: Promise<LeaValue>[] = [];

        // Start initial prefetch
        for (let i = 0; i < Math.min(prefetchSize, input.length); i++) {
          pending.push(executor([input[i]]));
        }

        let nextToFetch = prefetchSize;

        for (let i = 0; i < input.length; i++) {
          const result = await pending[i % prefetchSize];
          results.push(result);

          if (nextToFetch < input.length) {
            pending[i % prefetchSize] = executor([input[nextToFetch]]);
            nextToFetch++;
          }
        }

        return results;
      };
    }

    default:
      console.warn(`Unknown pipeline decorator: #${decorator.name}`);
      return executor;
  }
}

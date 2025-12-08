/**
 * Pipeline helper functions for the Lea interpreter
 *
 * This module contains functions for working with pipelines,
 * including member access and algebra operations.
 */

import { Expr, AnyPipelineStage } from "../ast";
import {
  LeaValue,
  LeaFunction,
  LeaBuiltin,
  LeaPipeline,
  RuntimeError,
  Environment,
} from "./types";
import {
  stringify,
  asNumber,
  asList,
  isPipeline,
  isParallelStage,
} from "./helpers";
import { InterpreterContext } from "./context";

/**
 * Describe a stage expression for display purposes
 */
export function describeStage(expr: Expr): string {
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

/**
 * Describe any pipeline stage for display purposes
 */
export function describeAnyStage(stage: AnyPipelineStage): string {
  if (isParallelStage(stage)) {
    return `parallel[${stage.branches.length}]`;
  }
  return describeStage(stage.expr);
}

/**
 * Convert a stage to a callable function value
 */
export function stageToFunction(
  ctx: InterpreterContext,
  stage: AnyPipelineStage,
  closure: Environment
): LeaValue {
  if (isParallelStage(stage)) {
    throw new RuntimeError("Cannot convert parallel stage to function");
  }
  return ctx.evaluateExpr(stage.expr, closure);
}

/**
 * Convert a function value to a pipeline stage
 */
export function functionToStage(
  ctx: InterpreterContext,
  fn: LeaValue
): { expr: Expr } {
  // Create a synthetic identifier for this function
  const syntheticName = `__dynamic_stage_${Date.now()}_${Math.random().toString(36).slice(2)}__`;
  ctx.globals.define(syntheticName, fn, false);
  return { expr: { kind: "Identifier" as const, name: syntheticName } };
}

/**
 * Compare two pipelines for structural equality
 */
export function pipelinesEqual(a: LeaPipeline, b: LeaPipeline): boolean {
  if (a.stages.length !== b.stages.length) {
    return false;
  }
  for (let i = 0; i < a.stages.length; i++) {
    const aName = describeAnyStage(a.stages[i]);
    const bName = describeAnyStage(b.stages[i]);
    if (aName !== bName) {
      return false;
    }
  }
  return true;
}

/**
 * Get a member of a pipeline (.stages, .length, .visualize, etc.)
 */
export function getPipelineMember(
  ctx: InterpreterContext,
  pipeline: LeaPipeline,
  member: string,
  env: Environment
): LeaValue {
  switch (member) {
    case "length":
      return pipeline.stages.length;

    case "stages": {
      // Return a list of stage descriptions
      return pipeline.stages.map(stage => describeAnyStage(stage));
    }

    case "first": {
      // Return the first stage as a callable function
      if (pipeline.stages.length === 0) {
        return null;
      }
      return stageToFunction(ctx, pipeline.stages[0], pipeline.closure);
    }

    case "last": {
      // Return the last stage as a callable function
      if (pipeline.stages.length === 0) {
        return null;
      }
      return stageToFunction(ctx, pipeline.stages[pipeline.stages.length - 1], pipeline.closure);
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
          return pipelinesEqual(pipeline, other);
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
          return stageToFunction(ctx, pipeline.stages[index], pipeline.closure);
        }
      } as LeaBuiltin;
    }

    case "prepend": {
      // Return a builtin that adds a stage at the start
      return {
        kind: "builtin" as const,
        fn: (args: LeaValue[]): LeaValue => {
          const fn = args[0];
          const newStage = functionToStage(ctx, fn);
          return {
            kind: "pipeline" as const,
            stages: [newStage, ...pipeline.stages],
            closure: pipeline.closure,
            decorators: [],
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
          const newStage = functionToStage(ctx, fn);
          return {
            kind: "pipeline" as const,
            stages: [...pipeline.stages, newStage],
            closure: pipeline.closure,
            decorators: [],
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
            decorators: [],
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
            decorators: [],
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
          const otherStageNames = new Set(other.stages.map(s => describeAnyStage(s)));
          const filteredStages = pipeline.stages.filter(
            s => !otherStageNames.has(describeAnyStage(s))
          );
          return {
            kind: "pipeline" as const,
            stages: filteredStages,
            closure: pipeline.closure,
            decorators: [],
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
          const otherStageNames = new Set(other.stages.map(s => describeAnyStage(s)));
          const commonStages = pipeline.stages.filter(
            s => otherStageNames.has(describeAnyStage(s))
          );
          return {
            kind: "pipeline" as const,
            stages: commonStages,
            closure: pipeline.closure,
            decorators: [],
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
          const combinedStages: AnyPipelineStage[] = [];

          // Add all stages from this pipeline
          for (const stage of pipeline.stages) {
            const name = describeAnyStage(stage);
            if (!seenNames.has(name)) {
              seenNames.add(name);
              combinedStages.push(stage);
            }
          }

          // Add stages from other pipeline not already present
          for (const stage of other.stages) {
            const name = describeAnyStage(stage);
            if (!seenNames.has(name)) {
              seenNames.add(name);
              combinedStages.push(stage);
            }
          }

          return {
            kind: "pipeline" as const,
            stages: combinedStages,
            closure: pipeline.closure,
            decorators: [],
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
          const otherStageNames = new Set(other.stages.map(s => describeAnyStage(s)));
          const filteredStages = pipeline.stages.filter(
            s => !otherStageNames.has(describeAnyStage(s))
          );
          return {
            kind: "pipeline" as const,
            stages: filteredStages,
            closure: pipeline.closure,
            decorators: [],
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
            decorators: [],
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
            const stageDesc = describeAnyStage(stage);
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

/**
 * Create the Pipeline global object with static methods and properties
 */
export function createPipelineGlobal(globals: Environment): LeaValue {
  const fields = new Map<string, LeaValue>();

  // Pipeline.identity - a no-op pipeline that passes values through unchanged
  fields.set("identity", {
    kind: "pipeline" as const,
    stages: [{ expr: { kind: "Identifier" as const, name: "__identity__" } }],
    closure: globals,
    decorators: [],
  } as LeaPipeline);

  // Pipeline.empty - a pipeline with no stages
  fields.set("empty", {
    kind: "pipeline" as const,
    stages: [],
    closure: globals,
    decorators: [],
  } as LeaPipeline);

  // Pipeline.from(list) - create pipeline from list of functions
  fields.set("from", {
    kind: "builtin" as const,
    fn: (args: LeaValue[]): LeaValue => {
      const list = asList(args[0]);
      const stages: { expr: Expr }[] = list.map((item, i) => {
        // Create a synthetic identifier that will resolve to this function
        const syntheticName = `__pipeline_stage_${i}__`;
        globals.define(syntheticName, item, false);
        return { expr: { kind: "Identifier" as const, name: syntheticName } };
      });
      return {
        kind: "pipeline" as const,
        stages,
        closure: globals,
        decorators: [],
      } as LeaPipeline;
    }
  } as LeaBuiltin);

  return { kind: "record", fields };
}

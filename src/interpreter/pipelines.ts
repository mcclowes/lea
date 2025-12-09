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
      // Return a builtin function that prints an ASCII diagram with ANSI colors
      return {
        kind: "builtin" as const,
        fn: (): LeaValue => {
          const lines: string[] = [];
          const boxWidth = 15;

          // ANSI color codes
          const colors = {
            reset: "\x1b[0m",
            bold: "\x1b[1m",
            dim: "\x1b[2m",
            // Stage type colors
            function: "\x1b[36m",     // Cyan for named functions
            lambda: "\x1b[35m",       // Magenta for lambdas
            pipeline: "\x1b[34m",     // Blue for nested pipelines
            call: "\x1b[33m",         // Yellow for function calls
            spread: "\x1b[32m",       // Green for spread operations
            parallel: "\x1b[91m",     // Bright red for parallel fan-out/in
            // Structural colors
            box: "\x1b[37m",          // White for box borders
            connector: "\x1b[90m",    // Gray for connectors
            decorator: "\x1b[93m",    // Bright yellow for decorators
            io: "\x1b[94m",           // Bright blue for input/output
          };

          // Helper to get visible length (excluding ANSI codes)
          const visibleLength = (text: string): number => {
            return text.replace(/\x1b\[[0-9;]*m/g, "").length;
          };

          // Helper to pad text within box (accounting for ANSI codes)
          const padBox = (text: string, width: number = boxWidth - 2): string => {
            const visible = visibleLength(text);
            if (visible > width) {
              // Need to truncate carefully to not break ANSI codes
              let result = "";
              let count = 0;
              let i = 0;
              while (i < text.length && count < width - 1) {
                if (text[i] === "\x1b") {
                  // Copy ANSI sequence
                  const endIdx = text.indexOf("m", i);
                  if (endIdx !== -1) {
                    result += text.substring(i, endIdx + 1);
                    i = endIdx + 1;
                    continue;
                  }
                }
                result += text[i];
                count++;
                i++;
              }
              return result + "…" + colors.reset;
            }
            const leftPad = Math.floor((width - visible) / 2);
            const rightPad = width - visible - leftPad;
            return " ".repeat(leftPad) + text + " ".repeat(rightPad);
          };

          // Helper to describe a stage with color and decorators
          const describeStageColored = (expr: Expr): { text: string; decorators: string[] } => {
            let text = "";
            let decorators: string[] = [];

            switch (expr.kind) {
              case "Identifier":
                text = `${colors.function}${expr.name}${colors.reset}`;
                break;
              case "CallExpr":
                if (expr.callee.kind === "Identifier") {
                  text = `${colors.call}${expr.callee.name}()${colors.reset}`;
                } else {
                  text = `${colors.call}call${colors.reset}`;
                }
                break;
              case "FunctionExpr":
                text = `${colors.lambda}λ${colors.reset}`;
                decorators = expr.decorators.map(d => d.name);
                break;
              case "PipelineLiteral":
                text = `${colors.pipeline}pipe[${expr.stages.length}]${colors.reset}`;
                decorators = expr.decorators.map(d => d.name);
                break;
              case "SpreadPipeExpr":
                text = `${colors.spread}/>>>spread${colors.reset}`;
                break;
              default:
                text = `${colors.dim}expr${colors.reset}`;
            }

            return { text, decorators };
          };

          // Helper to create a box line
          const boxTop = (width: number = boxWidth): string =>
            `${colors.box}┌${"─".repeat(width)}┐${colors.reset}`;
          const boxMid = (content: string, width: number = boxWidth): string =>
            `${colors.box}│${colors.reset} ${padBox(content, width - 2)} ${colors.box}│${colors.reset}`;
          const boxBot = (width: number = boxWidth): string =>
            `${colors.box}└${"─".repeat(Math.floor(width / 2))}┬${"─".repeat(width - Math.floor(width / 2) - 1)}┘${colors.reset}`;
          const boxBotNoConnector = (width: number = boxWidth): string =>
            `${colors.box}└${"─".repeat(width)}┘${colors.reset}`;

          // Helper to format decorators
          const formatDecorators = (decorators: string[]): string => {
            if (decorators.length === 0) return "";
            return `${colors.decorator}#${decorators.join(" #")}${colors.reset}`;
          };

          // Calculate center position to align with box connector
          // Box is prefixed with 2 spaces, └ is 1 char, then floor(width/2) dashes to ┬
          // So connector is at: 2 + 1 + floor(width/2) = 3 + 7 = 10 (for width=15)
          // Arrow should be at same position, so padding is 10 - 1 = 9 (since │ is 1 char)
          const center = 2 + 1 + Math.floor(boxWidth / 2);  // position of ┬
          const centerPad = " ".repeat(center);

          // Pipeline header with decorators
          const pipelineDecoratorStr = pipeline.decorators.length > 0
            ? ` ${formatDecorators(pipeline.decorators.map(d => d.name))}`
            : "";
          lines.push(`${colors.bold}Pipeline:${colors.reset}${pipelineDecoratorStr}`);

          // Input box
          lines.push(`  ${boxTop()}`);
          lines.push(`  ${boxMid(`${colors.io}input${colors.reset}`)}`);
          lines.push(`  ${boxBot()}`);

          // Helper to get all stages from a branch expression (expands pipelines)
          const getBranchStages = (expr: Expr): { text: string; decorators: string[] }[] => {
            if (expr.kind === "PipelineLiteral") {
              // Expand pipeline into its individual stages
              return expr.stages.map(s => {
                if ("isParallel" in s && s.isParallel) {
                  return { text: `${colors.parallel}parallel${colors.reset}`, decorators: [] };
                }
                return describeStageColored(s.expr);
              });
            }
            // Single expression - just return it
            return [describeStageColored(expr)];
          };

          for (let i = 0; i < pipeline.stages.length; i++) {
            const stage = pipeline.stages[i];

            if (isParallelStage(stage)) {
              // Parallel stage - show each branch's stages vertically
              const numBranches = stage.branches.length;
              const branchStagesList = stage.branches.map(getBranchStages);
              const maxStages = Math.max(...branchStagesList.map(s => s.length));

              const branchBoxWidth = 13;
              const branchSpacing = 4;
              const totalWidth = numBranches * branchBoxWidth + (numBranches - 1) * branchSpacing;
              const startOffset = Math.max(2, Math.floor((boxWidth + 4 - totalWidth) / 2));

              // Helper to draw connector line at branch centers
              const drawConnectors = (char: string, color: string = colors.connector): string => {
                let line = " ".repeat(startOffset);
                for (let b = 0; b < numBranches; b++) {
                  const mid = Math.floor(branchBoxWidth / 2);
                  line += " ".repeat(mid) + `${color}${char}${colors.reset}` + " ".repeat(branchBoxWidth - mid - 1);
                  if (b < numBranches - 1) line += " ".repeat(branchSpacing);
                }
                return line;
              };

              // Helper to draw horizontal lines between branch centers
              const drawHorizontalJoin = (leftChar: string, midChar: string, rightChar: string, color: string): string => {
                let line = " ".repeat(startOffset);
                const mid = Math.floor(branchBoxWidth / 2);
                for (let b = 0; b < numBranches; b++) {
                  if (b === 0) {
                    line += " ".repeat(mid) + `${color}${leftChar}${colors.reset}`;
                  } else if (b === numBranches - 1) {
                    line += `${color}${"─".repeat(branchSpacing + branchBoxWidth - 1)}${rightChar}${colors.reset}`;
                  } else {
                    line += `${color}${"─".repeat(branchSpacing + mid)}${midChar}${"─".repeat(branchBoxWidth - mid - 1)}${colors.reset}`;
                  }
                }
                return line;
              };

              // Fan-out connector and diamond
              lines.push(`${centerPad}${colors.connector}│${colors.reset}`);
              lines.push(`${centerPad}${colors.connector}▼${colors.reset}`);
              lines.push(drawHorizontalJoin("◆", "┬", "◆", colors.parallel));
              lines.push(drawConnectors("│"));
              lines.push(drawConnectors("▼"));

              // Draw each row of stages across all branches
              for (let row = 0; row < maxStages; row++) {
                // Box top
                let topLine = " ".repeat(startOffset);
                for (let b = 0; b < numBranches; b++) {
                  if (row < branchStagesList[b].length) {
                    topLine += `${colors.box}┌${"─".repeat(branchBoxWidth - 2)}┐${colors.reset}`;
                  } else {
                    // Empty placeholder - just connector
                    const mid = Math.floor(branchBoxWidth / 2);
                    topLine += " ".repeat(mid) + `${colors.connector}│${colors.reset}` + " ".repeat(branchBoxWidth - mid - 1);
                  }
                  if (b < numBranches - 1) topLine += " ".repeat(branchSpacing);
                }
                lines.push(topLine);

                // Box content
                let contentLine = " ".repeat(startOffset);
                for (let b = 0; b < numBranches; b++) {
                  if (row < branchStagesList[b].length) {
                    const { text } = branchStagesList[b][row];
                    contentLine += `${colors.box}│${colors.reset}${padBox(text, branchBoxWidth - 2)}${colors.box}│${colors.reset}`;
                  } else {
                    const mid = Math.floor(branchBoxWidth / 2);
                    contentLine += " ".repeat(mid) + `${colors.connector}│${colors.reset}` + " ".repeat(branchBoxWidth - mid - 1);
                  }
                  if (b < numBranches - 1) contentLine += " ".repeat(branchSpacing);
                }
                lines.push(contentLine);

                // Box bottom
                let botLine = " ".repeat(startOffset);
                for (let b = 0; b < numBranches; b++) {
                  if (row < branchStagesList[b].length) {
                    const mid = Math.floor((branchBoxWidth - 2) / 2);
                    botLine += `${colors.box}└${"─".repeat(mid)}┬${"─".repeat(branchBoxWidth - 3 - mid)}┘${colors.reset}`;
                  } else {
                    const mid = Math.floor(branchBoxWidth / 2);
                    botLine += " ".repeat(mid) + `${colors.connector}│${colors.reset}` + " ".repeat(branchBoxWidth - mid - 1);
                  }
                  if (b < numBranches - 1) botLine += " ".repeat(branchSpacing);
                }
                lines.push(botLine);

                // Connector between rows (except after last row)
                if (row < maxStages - 1) {
                  lines.push(drawConnectors("│"));
                  lines.push(drawConnectors("▼"));
                }
              }

              // Fan-in connector and diamond
              lines.push(drawConnectors("│"));
              lines.push(drawHorizontalJoin("◆", "┴", "◆", colors.parallel));

            } else {
              // Regular stage or spread pipe - show as box
              const { text, decorators } = describeStageColored(stage.expr);

              // Check if this is a spread pipe stage by examining the expression
              const isSpread = stage.expr.kind === "SpreadPipeExpr";

              lines.push(`${centerPad}${colors.connector}│${colors.reset}`);
              lines.push(`${centerPad}${colors.connector}▼${colors.reset}`);

              if (isSpread) {
                // Spread pipe gets special treatment with spread indicator
                lines.push(`  ${colors.box}┌${colors.spread}>>>${"─".repeat(boxWidth - 4)}${colors.box}┐${colors.reset}`);
              } else {
                lines.push(`  ${boxTop()}`);
              }
              lines.push(`  ${boxMid(text)}`);

              // Show decorators if present
              if (decorators.length > 0) {
                lines.push(`  ${boxMid(formatDecorators(decorators))}`);
              }

              lines.push(`  ${boxBot()}`);
            }
          }

          // Output box
          lines.push(`${centerPad}${colors.connector}│${colors.reset}`);
          lines.push(`${centerPad}${colors.connector}▼${colors.reset}`);
          lines.push(`  ${boxTop()}`);
          lines.push(`  ${boxMid(`${colors.io}output${colors.reset}`)}`);
          lines.push(`  ${boxBotNoConnector()}`);

          console.log(lines.join("\n"));
          return lines.join("\n");
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

/**
 * Debugger for the Lea language
 *
 * Provides interactive debugging capabilities:
 * - Breakpoints (file:line based)
 * - Step through pipe stages
 * - Inspect intermediate values
 * - Continue/pause execution
 */

import * as readline from "readline";
import { Expr, AnyPipelineStage, ParallelPipelineStage } from "./ast";
import { LeaValue, LeaPipeline, Environment } from "./interpreter";
import { stringify } from "./interpreter/helpers";
import { describeAnyStage } from "./interpreter/pipelines";

/**
 * Breakpoint definition
 */
export interface Breakpoint {
  id: number;
  file?: string;
  line: number;
  enabled: boolean;
  hitCount: number;
  condition?: string;  // Optional condition expression
}

/**
 * Debug mode states
 */
export type DebugMode = "run" | "step" | "step_into" | "step_out" | "paused";

/**
 * Debug event types
 */
export type DebugEventType =
  | "breakpoint_hit"
  | "step_complete"
  | "pipe_stage"
  | "pipeline_start"
  | "pipeline_end"
  | "error";

/**
 * Debug event information
 */
export interface DebugEvent {
  type: DebugEventType;
  location?: { file?: string; line: number; column?: number };
  stageName?: string;
  stageIndex?: number;
  totalStages?: number;
  inputValue?: LeaValue;
  outputValue?: LeaValue;
  error?: Error;
}

/**
 * Callback for debug events - returns true to continue, false to pause
 */
export type DebugCallback = (event: DebugEvent) => Promise<boolean>;

/**
 * Debugger state and controls
 */
export class Debugger {
  private breakpoints: Map<number, Breakpoint> = new Map();
  private nextBreakpointId = 1;
  private mode: DebugMode = "run";
  private stepDepth = 0;
  private currentDepth = 0;
  private callback: DebugCallback | null = null;
  private enabled = false;

  // Current debug context
  private currentFile?: string;
  private currentLine?: number;
  private watchExpressions: string[] = [];

  // Value history for inspection
  private valueHistory: Array<{ name: string; value: LeaValue }> = [];
  private maxHistorySize = 100;

  /**
   * Enable debugging
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Disable debugging
   */
  disable(): void {
    this.enabled = false;
    this.mode = "run";
  }

  /**
   * Check if debugging is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Set the debug callback for handling events
   */
  setCallback(callback: DebugCallback): void {
    this.callback = callback;
  }

  /**
   * Clear the debug callback
   */
  clearCallback(): void {
    this.callback = null;
  }

  /**
   * Get current debug mode
   */
  getMode(): DebugMode {
    return this.mode;
  }

  /**
   * Set debug mode
   */
  setMode(mode: DebugMode): void {
    this.mode = mode;
    if (mode === "step" || mode === "step_into") {
      this.stepDepth = this.currentDepth;
    }
  }

  /**
   * Continue execution
   */
  continue(): void {
    this.mode = "run";
  }

  /**
   * Step to next stage
   */
  step(): void {
    this.mode = "step";
    this.stepDepth = this.currentDepth;
  }

  /**
   * Step into nested pipeline
   */
  stepInto(): void {
    this.mode = "step_into";
  }

  /**
   * Step out of current pipeline
   */
  stepOut(): void {
    this.mode = "step_out";
    this.stepDepth = this.currentDepth - 1;
  }

  /**
   * Pause execution
   */
  pause(): void {
    this.mode = "paused";
  }

  // ============================================================================
  // Breakpoint Management
  // ============================================================================

  /**
   * Add a breakpoint
   */
  addBreakpoint(line: number, file?: string, condition?: string): Breakpoint {
    const bp: Breakpoint = {
      id: this.nextBreakpointId++,
      file,
      line,
      enabled: true,
      hitCount: 0,
      condition,
    };
    this.breakpoints.set(bp.id, bp);
    return bp;
  }

  /**
   * Remove a breakpoint by ID
   */
  removeBreakpoint(id: number): boolean {
    return this.breakpoints.delete(id);
  }

  /**
   * Clear all breakpoints
   */
  clearBreakpoints(): void {
    this.breakpoints.clear();
  }

  /**
   * Enable a breakpoint
   */
  enableBreakpoint(id: number): boolean {
    const bp = this.breakpoints.get(id);
    if (bp) {
      bp.enabled = true;
      return true;
    }
    return false;
  }

  /**
   * Disable a breakpoint
   */
  disableBreakpoint(id: number): boolean {
    const bp = this.breakpoints.get(id);
    if (bp) {
      bp.enabled = false;
      return true;
    }
    return false;
  }

  /**
   * List all breakpoints
   */
  listBreakpoints(): Breakpoint[] {
    return Array.from(this.breakpoints.values());
  }

  /**
   * Check if a breakpoint exists at the given location
   */
  hasBreakpoint(line: number, file?: string): Breakpoint | null {
    for (const bp of this.breakpoints.values()) {
      if (bp.enabled && bp.line === line) {
        if (!bp.file || !file || bp.file === file) {
          return bp;
        }
      }
    }
    return null;
  }

  // ============================================================================
  // Watch Expressions
  // ============================================================================

  /**
   * Add a watch expression
   */
  addWatch(expression: string): void {
    if (!this.watchExpressions.includes(expression)) {
      this.watchExpressions.push(expression);
    }
  }

  /**
   * Remove a watch expression
   */
  removeWatch(expression: string): boolean {
    const index = this.watchExpressions.indexOf(expression);
    if (index !== -1) {
      this.watchExpressions.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * List watch expressions
   */
  listWatches(): string[] {
    return [...this.watchExpressions];
  }

  /**
   * Clear all watch expressions
   */
  clearWatches(): void {
    this.watchExpressions = [];
  }

  // ============================================================================
  // Value History
  // ============================================================================

  /**
   * Record a value in history
   */
  recordValue(name: string, value: LeaValue): void {
    this.valueHistory.push({ name, value });
    if (this.valueHistory.length > this.maxHistorySize) {
      this.valueHistory.shift();
    }
  }

  /**
   * Get value history
   */
  getValueHistory(): Array<{ name: string; value: LeaValue }> {
    return [...this.valueHistory];
  }

  /**
   * Clear value history
   */
  clearValueHistory(): void {
    this.valueHistory = [];
  }

  /**
   * Get the last recorded value
   */
  getLastValue(): { name: string; value: LeaValue } | null {
    return this.valueHistory.length > 0
      ? this.valueHistory[this.valueHistory.length - 1]
      : null;
  }

  // ============================================================================
  // Debug Events
  // ============================================================================

  /**
   * Notify about a debug event
   * Returns true if execution should continue, false if it should pause
   */
  async notify(event: DebugEvent): Promise<boolean> {
    if (!this.enabled) return true;

    // Update location
    if (event.location) {
      this.currentFile = event.location.file;
      this.currentLine = event.location.line;
    }

    // Record values
    if (event.inputValue !== undefined) {
      this.recordValue(`input@${event.stageName || "unknown"}`, event.inputValue);
    }
    if (event.outputValue !== undefined) {
      this.recordValue(`output@${event.stageName || "unknown"}`, event.outputValue);
    }

    // Check mode
    switch (this.mode) {
      case "run":
        // Check for breakpoints
        if (event.location) {
          const bp = this.hasBreakpoint(event.location.line, event.location.file);
          if (bp) {
            bp.hitCount++;
            this.mode = "paused";
            if (this.callback) {
              return this.callback({ ...event, type: "breakpoint_hit" });
            }
            return false;
          }
        }
        return true;

      case "step":
        // Stop at the current depth level
        if (this.currentDepth <= this.stepDepth) {
          this.mode = "paused";
          if (this.callback) {
            return this.callback({ ...event, type: "step_complete" });
          }
          return false;
        }
        return true;

      case "step_into":
        // Stop at next event
        this.mode = "paused";
        if (this.callback) {
          return this.callback({ ...event, type: "step_complete" });
        }
        return false;

      case "step_out":
        // Stop when we return to a lower depth
        if (this.currentDepth < this.stepDepth) {
          this.mode = "paused";
          if (this.callback) {
            return this.callback({ ...event, type: "step_complete" });
          }
          return false;
        }
        return true;

      case "paused":
        // Already paused - wait for callback
        if (this.callback) {
          return this.callback(event);
        }
        return false;
    }
  }

  /**
   * Enter a pipeline (increases depth)
   */
  enterPipeline(): void {
    this.currentDepth++;
  }

  /**
   * Exit a pipeline (decreases depth)
   */
  exitPipeline(): void {
    this.currentDepth--;
  }

  /**
   * Get current depth
   */
  getDepth(): number {
    return this.currentDepth;
  }

  // ============================================================================
  // Formatting Helpers
  // ============================================================================

  /**
   * Format a value for display
   */
  formatValue(value: LeaValue, maxLength: number = 80): string {
    const str = stringify(value);
    if (str.length > maxLength) {
      return str.substring(0, maxLength - 3) + "...";
    }
    return str;
  }

  /**
   * Format a breakpoint for display
   */
  formatBreakpoint(bp: Breakpoint): string {
    const status = bp.enabled ? "●" : "○";
    const location = bp.file ? `${bp.file}:${bp.line}` : `line ${bp.line}`;
    const condition = bp.condition ? ` if ${bp.condition}` : "";
    const hits = bp.hitCount > 0 ? ` (hit ${bp.hitCount}x)` : "";
    return `${status} #${bp.id}: ${location}${condition}${hits}`;
  }

  /**
   * Format a stage for display
   */
  formatStage(stage: AnyPipelineStage, index: number): string {
    const name = describeAnyStage(stage);
    return `[${index}] ${name}`;
  }
}

/**
 * Interactive debug session for REPL
 */
export class DebugSession {
  private debugger: Debugger;
  private rl: readline.Interface;
  private paused = false;
  private currentValue: LeaValue = null;
  private currentStage = 0;
  private totalStages = 0;
  private pipelineName = "";
  private env: Environment | null = null;
  private resolveWait: ((value: boolean) => void) | null = null;

  constructor(debuggerInstance: Debugger) {
    this.debugger = debuggerInstance;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * Start an interactive debug session
   */
  async start(pipelineName: string, pipeline: LeaPipeline): Promise<void> {
    this.pipelineName = pipelineName;
    this.totalStages = pipeline.stages.length;
    this.env = pipeline.closure;

    console.log("\n╔══════════════════════════════════════════════════════════════════════╗");
    console.log("║                        DEBUG SESSION                                  ║");
    console.log("╚══════════════════════════════════════════════════════════════════════╝\n");
    console.log(`Debugging pipeline: ${pipelineName}`);
    console.log(`Stages: ${this.totalStages}`);
    console.log("\nCommands:");
    console.log("  n, next     Step to next stage");
    console.log("  c, continue Continue execution");
    console.log("  i, inspect  Inspect current value");
    console.log("  s, stages   Show pipeline stages");
    console.log("  v, vars     Show variable bindings");
    console.log("  b, break    List breakpoints");
    console.log("  h, help     Show help");
    console.log("  q, quit     Quit debug session");
    console.log();
  }

  /**
   * Handle a debug event
   */
  async handleEvent(event: DebugEvent): Promise<boolean> {
    if (event.inputValue !== undefined) {
      this.currentValue = event.inputValue;
    }
    if (event.stageIndex !== undefined) {
      this.currentStage = event.stageIndex;
    }

    // Show current state
    this.showCurrentState(event);

    // Wait for user command
    return this.waitForCommand();
  }

  /**
   * Show current debug state
   */
  private showCurrentState(event: DebugEvent): void {
    console.log("\n─────────────────────────────────────────────────────────────────────");

    if (event.type === "breakpoint_hit") {
      console.log(`🔴 Breakpoint hit at line ${event.location?.line}`);
    }

    if (event.stageName) {
      console.log(`Stage ${event.stageIndex ?? "?"} of ${event.totalStages ?? "?"}: ${event.stageName}`);
    }

    if (event.inputValue !== undefined) {
      console.log(`Input:  ${this.debugger.formatValue(event.inputValue)}`);
    }

    if (event.outputValue !== undefined) {
      console.log(`Output: ${this.debugger.formatValue(event.outputValue)}`);
    }

    console.log("─────────────────────────────────────────────────────────────────────");
  }

  /**
   * Wait for user command
   */
  private waitForCommand(): Promise<boolean> {
    return new Promise((resolve) => {
      const prompt = () => {
        this.rl.question("debug> ", (answer) => {
          const cmd = answer.trim().toLowerCase();

          switch (cmd) {
            case "n":
            case "next":
              this.debugger.step();
              resolve(true);
              break;

            case "c":
            case "continue":
              this.debugger.continue();
              resolve(true);
              break;

            case "i":
            case "inspect":
              console.log("\nCurrent value:");
              console.log(stringify(this.currentValue));
              console.log();
              prompt();
              break;

            case "s":
            case "stages":
              console.log("\nPipeline stages:");
              for (let i = 0; i < this.totalStages; i++) {
                const marker = i === this.currentStage ? "→" : " ";
                console.log(`  ${marker} [${i}]`);
              }
              console.log();
              prompt();
              break;

            case "v":
            case "vars":
              this.showVariables();
              prompt();
              break;

            case "b":
            case "break":
              this.showBreakpoints();
              prompt();
              break;

            case "h":
            case "help":
              this.showHelp();
              prompt();
              break;

            case "q":
            case "quit":
              console.log("Quitting debug session.");
              this.debugger.disable();
              resolve(false);
              break;

            case "":
              // Empty input - repeat last command (default: step)
              this.debugger.step();
              resolve(true);
              break;

            default:
              console.log(`Unknown command: ${cmd}. Type 'h' for help.`);
              prompt();
          }
        });
      };

      prompt();
    });
  }

  /**
   * Show variable bindings
   */
  private showVariables(): void {
    console.log("\nVariable bindings:");
    if (!this.env) {
      console.log("  (no environment available)");
      return;
    }

    const history = this.debugger.getValueHistory();
    if (history.length === 0) {
      console.log("  (no values recorded)");
      return;
    }

    // Show last few values
    const recent = history.slice(-10);
    for (const entry of recent) {
      console.log(`  ${entry.name} = ${this.debugger.formatValue(entry.value)}`);
    }
    console.log();
  }

  /**
   * Show breakpoints
   */
  private showBreakpoints(): void {
    console.log("\nBreakpoints:");
    const bps = this.debugger.listBreakpoints();
    if (bps.length === 0) {
      console.log("  (no breakpoints set)");
    } else {
      for (const bp of bps) {
        console.log(`  ${this.debugger.formatBreakpoint(bp)}`);
      }
    }
    console.log();
  }

  /**
   * Show help
   */
  private showHelp(): void {
    console.log(`
Debug Commands:
  n, next       Step to next pipeline stage
  c, continue   Continue execution until next breakpoint
  i, inspect    Inspect current value in detail
  s, stages     Show all pipeline stages
  v, vars       Show recorded values
  b, break      List breakpoints
  h, help       Show this help
  q, quit       Quit debug session

Press Enter to repeat the last command.
`);
  }

  /**
   * Close the debug session
   */
  close(): void {
    this.rl.close();
  }
}

/**
 * Create a debug-wrapped pipeline executor
 */
export function createDebugExecutor(
  debugger_: Debugger,
  pipeline: LeaPipeline,
  evaluatePipeWithValue: (value: LeaValue, expr: Expr, env: Environment) => LeaValue
): (args: LeaValue[]) => Promise<LeaValue> {
  return async (args: LeaValue[]): Promise<LeaValue> => {
    const stages = pipeline.stages;
    let current: LeaValue = args[0];

    debugger_.enterPipeline();

    // Notify pipeline start
    await debugger_.notify({
      type: "pipeline_start",
      inputValue: current,
      totalStages: stages.length,
    });

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const stageName = describeAnyStage(stage);
      const inputValue = current;

      // Notify before stage execution
      const shouldContinue = await debugger_.notify({
        type: "pipe_stage",
        stageName,
        stageIndex: i,
        totalStages: stages.length,
        inputValue,
      });

      if (!shouldContinue) {
        debugger_.exitPipeline();
        throw new Error("Debug session terminated");
      }

      // Execute the stage
      if (stage.isParallel) {
        const parallelStage = stage as ParallelPipelineStage;
        const branchResults: LeaValue[] = parallelStage.branches.map((branchExpr) => {
          return evaluatePipeWithValue(current, branchExpr, pipeline.closure);
        });
        current = { kind: "parallel_result" as const, values: branchResults };
      } else {
        current = evaluatePipeWithValue(current, stage.expr, pipeline.closure);
      }

      // Record output
      debugger_.recordValue(`stage[${i}]:${stageName}`, current);
    }

    // Notify pipeline end
    await debugger_.notify({
      type: "pipeline_end",
      outputValue: current,
      totalStages: stages.length,
    });

    debugger_.exitPipeline();

    return current;
  };
}

// Global debugger instance
let globalDebugger: Debugger | null = null;

/**
 * Get or create the global debugger instance
 */
export function getDebugger(): Debugger {
  if (!globalDebugger) {
    globalDebugger = new Debugger();
  }
  return globalDebugger;
}

/**
 * Reset the global debugger
 */
export function resetDebugger(): void {
  globalDebugger = new Debugger();
}

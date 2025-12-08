// Execution Tracer - Captures runtime values during Lea program execution

import { Expr, Stmt, Program } from "../ast";
import { LeaValue, Interpreter, Environment } from "../interpreter";
import { FlowGraph, NodeId, RuntimeValue } from "./flowGraph";

// Trace event types
export type TraceEventType =
  | "eval_start"     // Started evaluating an expression
  | "eval_end"       // Finished evaluating an expression
  | "pipe_start"     // Started evaluating a pipe
  | "pipe_value"     // Value flowing through pipe
  | "pipe_end"       // Finished evaluating a pipe
  | "call_start"     // Started a function call
  | "call_end"       // Finished a function call
  | "binding"        // Variable binding
  | "branch_start"   // Started parallel branch
  | "branch_end"     // Finished parallel branch
  | "await_start"    // Started awaiting
  | "await_end"      // Finished awaiting
  | "decorator";     // Decorator applied

// A single trace event
export interface TraceEvent {
  id: number;
  type: TraceEventType;
  timestamp: number;
  expr?: Expr;
  stmt?: Stmt;
  value?: LeaValue;
  metadata?: Record<string, unknown>;
}

// Complete execution trace
export interface ExecutionTrace {
  events: TraceEvent[];
  startTime: number;
  endTime?: number;
  result?: LeaValue;
  error?: Error;
}

// Trace listener callback
export type TraceListener = (event: TraceEvent) => void;

// Tracer class that wraps interpreter execution
export class Tracer {
  private events: TraceEvent[] = [];
  private eventId = 0;
  private startTime: number = 0;
  private listeners: TraceListener[] = [];

  constructor() {}

  // Add a listener for trace events
  addListener(listener: TraceListener): void {
    this.listeners.push(listener);
  }

  // Remove a listener
  removeListener(listener: TraceListener): void {
    const idx = this.listeners.indexOf(listener);
    if (idx !== -1) {
      this.listeners.splice(idx, 1);
    }
  }

  // Record a trace event
  private recordEvent(
    type: TraceEventType,
    expr?: Expr,
    stmt?: Stmt,
    value?: LeaValue,
    metadata?: Record<string, unknown>
  ): TraceEvent {
    const event: TraceEvent = {
      id: ++this.eventId,
      type,
      timestamp: Date.now() - this.startTime,
      expr,
      stmt,
      value,
      metadata,
    };

    this.events.push(event);

    // Notify listeners
    for (const listener of this.listeners) {
      listener(event);
    }

    return event;
  }

  // Start tracing
  start(): void {
    this.events = [];
    this.eventId = 0;
    this.startTime = Date.now();
  }

  // Stop tracing and return the trace
  stop(result?: LeaValue, error?: Error): ExecutionTrace {
    return {
      events: this.events,
      startTime: this.startTime,
      endTime: Date.now(),
      result,
      error,
    };
  }

  // Get current events
  getEvents(): TraceEvent[] {
    return [...this.events];
  }

  // Record evaluation start
  evalStart(expr: Expr): void {
    this.recordEvent("eval_start", expr);
  }

  // Record evaluation end with result
  evalEnd(expr: Expr, value: LeaValue): void {
    this.recordEvent("eval_end", expr, undefined, value);
  }

  // Record pipe start
  pipeStart(left: Expr, right: Expr): void {
    this.recordEvent("pipe_start", undefined, undefined, undefined, {
      left: exprToString(left),
      right: exprToString(right),
    });
  }

  // Record value flowing through pipe
  pipeValue(value: LeaValue, stage: string): void {
    this.recordEvent("pipe_value", undefined, undefined, value, { stage });
  }

  // Record pipe end
  pipeEnd(result: LeaValue): void {
    this.recordEvent("pipe_end", undefined, undefined, result);
  }

  // Record function call start
  callStart(callee: string, args: LeaValue[]): void {
    this.recordEvent("call_start", undefined, undefined, undefined, {
      callee,
      args: args.map(valueToString),
    });
  }

  // Record function call end
  callEnd(callee: string, result: LeaValue): void {
    this.recordEvent("call_end", undefined, undefined, result, { callee });
  }

  // Record variable binding
  binding(name: string, value: LeaValue, mutable: boolean): void {
    this.recordEvent("binding", undefined, undefined, value, { name, mutable });
  }

  // Record parallel branch start
  branchStart(branchIndex: number): void {
    this.recordEvent("branch_start", undefined, undefined, undefined, { branchIndex });
  }

  // Record parallel branch end
  branchEnd(branchIndex: number, result: LeaValue): void {
    this.recordEvent("branch_end", undefined, undefined, result, { branchIndex });
  }

  // Record await start
  awaitStart(expr: Expr): void {
    this.recordEvent("await_start", expr);
  }

  // Record await end
  awaitEnd(expr: Expr, value: LeaValue): void {
    this.recordEvent("await_end", expr, undefined, value);
  }

  // Record decorator application
  decoratorApplied(name: string, input: LeaValue, output: LeaValue): void {
    this.recordEvent("decorator", undefined, undefined, output, {
      decoratorName: name,
      input: valueToString(input),
      output: valueToString(output),
    });
  }
}

// Create a tracing interpreter that hooks into execution
export function createTracingInterpreter(tracer: Tracer): TracingInterpreter {
  return new TracingInterpreter(tracer);
}

// Extended interpreter with tracing capabilities
export class TracingInterpreter extends Interpreter {
  private tracer: Tracer;

  constructor(tracer: Tracer) {
    super();
    this.tracer = tracer;
  }

  // Override interpret to add tracing
  interpret(program: Program): LeaValue {
    this.tracer.start();
    try {
      const result = super.interpret(program);
      this.tracer.stop(result);
      return result;
    } catch (error) {
      this.tracer.stop(undefined, error as Error);
      throw error;
    }
  }

  // Override interpretAsync to add tracing
  async interpretAsync(program: Program): Promise<LeaValue> {
    this.tracer.start();
    try {
      const result = await super.interpretAsync(program);
      this.tracer.stop(result);
      return result;
    } catch (error) {
      this.tracer.stop(undefined, error as Error);
      throw error;
    }
  }

  // Get the tracer
  getTracer(): Tracer {
    return this.tracer;
  }
}

// Apply trace data to a flow graph
export function applyTraceToGraph(trace: ExecutionTrace, graph: FlowGraph): void {
  // Map trace events to graph nodes by matching expressions
  for (const event of trace.events) {
    if (event.type === "eval_end" && event.value !== undefined) {
      // Find nodes that match this expression
      for (const [, node] of graph.nodes) {
        // Only match expressions, not statements
        const sourceExpr = node.sourceExpr;
        if (sourceExpr && isExpr(sourceExpr) && expressionsMatch(sourceExpr, event.expr)) {
          node.metadata.runtimeValue = {
            value: event.value,
            type: getValueType(event.value),
            timestamp: event.timestamp,
          };
        }
      }
    }

    if (event.type === "pipe_value" && event.value !== undefined) {
      // Update edges with pipe values
      const stage = event.metadata?.stage as string;
      for (const edge of graph.edges) {
        if (edge.type === "pipe" && edge.label === stage) {
          edge.metadata = edge.metadata || {};
          edge.metadata.runtimeValue = {
            value: event.value,
            type: getValueType(event.value),
            timestamp: event.timestamp,
          };
        }
      }
    }
  }
}

// Get statistics from a trace
export interface TraceStats {
  totalEvents: number;
  durationMs: number;
  pipelineStages: number;
  functionCalls: number;
  parallelBranches: number;
  awaitOperations: number;
  decoratorApplications: number;
}

export function getTraceStats(trace: ExecutionTrace): TraceStats {
  const counts = {
    pipe_start: 0,
    call_start: 0,
    branch_start: 0,
    await_start: 0,
    decorator: 0,
  };

  for (const event of trace.events) {
    if (event.type in counts) {
      counts[event.type as keyof typeof counts]++;
    }
  }

  return {
    totalEvents: trace.events.length,
    durationMs: (trace.endTime || Date.now()) - trace.startTime,
    pipelineStages: counts.pipe_start,
    functionCalls: counts.call_start,
    parallelBranches: counts.branch_start,
    awaitOperations: counts.await_start,
    decoratorApplications: counts.decorator,
  };
}

// Helper: Check if a node's source is an expression (not a statement)
function isExpr(source: Expr | Stmt): source is Expr {
  // Statements have kinds ending in "Stmt"
  return !source.kind.endsWith("Stmt");
}

// Helper: Convert expression to string representation
function exprToString(expr: Expr): string {
  switch (expr.kind) {
    case "NumberLiteral":
      return String(expr.value);
    case "StringLiteral":
      return `"${expr.value}"`;
    case "BooleanLiteral":
      return String(expr.value);
    case "Identifier":
      return expr.name;
    case "PipeExpr":
      return `${exprToString(expr.left)} /> ${exprToString(expr.right)}`;
    case "CallExpr":
      if (expr.callee.kind === "Identifier") {
        return `${expr.callee.name}(...)`;
      }
      return "call(...)";
    case "FunctionExpr":
      return `(${expr.params.map((p) => p.name).join(", ")}) -> ...`;
    case "ListExpr":
      return `[${expr.elements.length} items]`;
    case "RecordExpr":
      return `{ ${expr.fields.map((f) => f.key).join(", ")} }`;
    case "TupleExpr":
      return `(${expr.elements.length}-tuple)`;
    case "BinaryExpr":
      return `${exprToString(expr.left)} ${expr.operator.lexeme} ${exprToString(expr.right)}`;
    case "UnaryExpr":
      return `${expr.operator.lexeme}${exprToString(expr.operand)}`;
    case "AwaitExpr":
      return `await ${exprToString(expr.operand)}`;
    case "PlaceholderExpr":
      return "_";
    default:
      return expr.kind;
  }
}

// Helper: Convert value to string representation
function valueToString(value: LeaValue): string {
  if (value === null) return "null";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === "object") {
    if ("kind" in value) {
      switch (value.kind) {
        case "function":
          return "<function>";
        case "builtin":
          return "<builtin>";
        case "promise":
          return "<promise>";
        case "record":
          return `{ ${Array.from(value.fields.keys()).join(", ")} }`;
        case "parallel_result":
          return `[${value.values.length} parallel results]`;
        case "tuple":
          return `(${value.elements.length}-tuple)`;
      }
    }
  }
  return String(value);
}

// Helper: Get type name for a value
function getValueType(value: LeaValue): string {
  if (value === null) return "null";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) return "list";
  if (typeof value === "object" && "kind" in value) {
    return value.kind;
  }
  return "unknown";
}

// Helper: Check if two expressions match (for linking trace events to AST)
function expressionsMatch(a: Expr | undefined, b: Expr | undefined): boolean {
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case "NumberLiteral":
      return b.kind === "NumberLiteral" && a.value === b.value;
    case "StringLiteral":
      return b.kind === "StringLiteral" && a.value === b.value;
    case "BooleanLiteral":
      return b.kind === "BooleanLiteral" && a.value === b.value;
    case "Identifier":
      return b.kind === "Identifier" && a.name === b.name;
    default:
      // For complex expressions, use reference equality
      return a === b;
  }
}

// Export trace to JSON for serialization
export function traceToJSON(trace: ExecutionTrace): object {
  return {
    events: trace.events.map((e) => ({
      ...e,
      expr: e.expr ? exprToString(e.expr) : undefined,
      stmt: e.stmt ? e.stmt.kind : undefined,
      value: e.value !== undefined ? valueToString(e.value) : undefined,
    })),
    startTime: trace.startTime,
    endTime: trace.endTime,
    result: trace.result !== undefined ? valueToString(trace.result) : undefined,
    error: trace.error ? trace.error.message : undefined,
  };
}

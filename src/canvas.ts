/**
 * Interactive Canvas Visualization for Lea
 *
 * Provides an interactive SVG-based visualization canvas with:
 * - Zoom and pan
 * - Node dragging
 * - Data flow animation
 * - Node inspection
 * - Step-through execution
 */

import {
  Program,
  Stmt,
  Expr,
  LetStmt,
  ExprStmt,
  PipeExpr,
  ParallelPipeExpr,
  SpreadPipeExpr,
  CallExpr,
  FunctionExpr,
  Identifier,
  NumberLiteral,
  StringLiteral,
  BooleanLiteral,
  ListExpr,
  RecordExpr,
  TernaryExpr,
  AwaitExpr,
  ReturnExpr,
  PipelineLiteral,
  ReversePipeExpr,
  MatchExpr,
  ReactivePipeExpr,
  AnyPipelineStage,
  CodeblockStmt,
} from "./ast";

// Type guard for parallel pipeline stages
function isParallelStage(stage: AnyPipelineStage): stage is { isParallel: true; branches: Expr[] } {
  return "isParallel" in stage && stage.isParallel === true;
}

// ============================================================================
// Types
// ============================================================================

export type CanvasNodeType =
  | "data"        // Data values - purple
  | "operation"   // Operations - blue
  | "fanout"      // Fan-out - orange
  | "fanin"       // Fan-in - orange
  | "await"       // Await - green
  | "return"      // Return - green
  | "binding"     // Variable binding - gray
  | "pipeline"    // Pipeline - purple
  | "match"       // Match - purple
  | "condition"   // Conditional - yellow
  | "reactive";   // Reactive source - cyan

export interface CanvasNode {
  id: string;
  label: string;
  type: CanvasNodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  data?: Record<string, unknown>;  // Additional data for inspection
  subgraphId?: string;  // Parent subgraph
}

export interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  animated?: boolean;  // For data flow animation
  active?: boolean;    // Currently executing
}

export interface CanvasSubgraph {
  id: string;
  label: string;
  nodes: string[];  // Node IDs in this subgraph
  color?: string;
  collapsed?: boolean;
}

export interface CanvasGraph {
  nodes: Map<string, CanvasNode>;
  edges: CanvasEdge[];
  subgraphs: Map<string, CanvasSubgraph>;
  entryNode?: string;
  exitNode?: string;
}

export interface CanvasOptions {
  width?: number;
  height?: number;
  nodeSpacing?: number;
  levelSpacing?: number;
  direction?: "LR" | "TB";
  animate?: boolean;
  interactive?: boolean;
  theme?: "dark" | "light";
}

const DEFAULT_OPTIONS: Required<CanvasOptions> = {
  width: 1200,
  height: 800,
  nodeSpacing: 60,
  levelSpacing: 150,
  direction: "LR",
  animate: true,
  interactive: true,
  theme: "dark",
};

// ============================================================================
// Color themes
// ============================================================================

const THEMES = {
  dark: {
    background: "#1a1a2e",
    text: "#ffffff",
    nodeColors: {
      data: { fill: "#9b59b6", stroke: "#8e44ad" },
      operation: { fill: "#3498db", stroke: "#2980b9" },
      fanout: { fill: "#e67e22", stroke: "#d35400" },
      fanin: { fill: "#e67e22", stroke: "#d35400" },
      await: { fill: "#27ae60", stroke: "#1e8449" },
      return: { fill: "#27ae60", stroke: "#1e8449" },
      binding: { fill: "#95a5a6", stroke: "#7f8c8d" },
      pipeline: { fill: "#9b59b6", stroke: "#8e44ad" },
      match: { fill: "#9b59b6", stroke: "#8e44ad" },
      condition: { fill: "#f39c12", stroke: "#e67e22" },
      reactive: { fill: "#00bcd4", stroke: "#0097a7" },
    },
    edge: "#666",
    edgeActive: "#00ff88",
    subgraph: "rgba(255, 255, 255, 0.05)",
    inspectorBg: "#16213e",
  },
  light: {
    background: "#f5f5f5",
    text: "#333333",
    nodeColors: {
      data: { fill: "#ce93d8", stroke: "#9b59b6" },
      operation: { fill: "#64b5f6", stroke: "#2196f3" },
      fanout: { fill: "#ffb74d", stroke: "#ff9800" },
      fanin: { fill: "#ffb74d", stroke: "#ff9800" },
      await: { fill: "#81c784", stroke: "#4caf50" },
      return: { fill: "#81c784", stroke: "#4caf50" },
      binding: { fill: "#bdbdbd", stroke: "#9e9e9e" },
      pipeline: { fill: "#ce93d8", stroke: "#9b59b6" },
      match: { fill: "#ce93d8", stroke: "#9b59b6" },
      condition: { fill: "#fff176", stroke: "#ffc107" },
      reactive: { fill: "#4dd0e1", stroke: "#00bcd4" },
    },
    edge: "#999",
    edgeActive: "#00c853",
    subgraph: "rgba(0, 0, 0, 0.05)",
    inspectorBg: "#ffffff",
  },
};

// ============================================================================
// Canvas Graph Builder
// ============================================================================

export class CanvasGraphBuilder {
  private nodeCounter = 0;
  private edgeCounter = 0;
  private graph: CanvasGraph = {
    nodes: new Map(),
    edges: [],
    subgraphs: new Map(),
  };

  private genNodeId(prefix = "n"): string {
    return `${prefix}${this.nodeCounter++}`;
  }

  private genEdgeId(): string {
    return `e${this.edgeCounter++}`;
  }

  private truncate(text: string, max = 25): string {
    if (text.length <= max) return text;
    return text.substring(0, max - 3) + "...";
  }

  private describeExpr(expr: Expr): string {
    switch (expr.kind) {
      case "NumberLiteral":
        return String(expr.value);
      case "StringLiteral":
        return `"${this.truncate(expr.value, 20)}"`;
      case "BooleanLiteral":
        return String(expr.value);
      case "Identifier":
        return expr.name;
      case "CallExpr":
        if (expr.callee.kind === "Identifier") {
          return `${expr.callee.name}(...)`;
        }
        return "call(...)";
      case "FunctionExpr":
        const params = expr.params.map(p => p.name).join(", ");
        return `(${params}) -> ...`;
      case "ListExpr":
        return `[${expr.elements.length} items]`;
      case "RecordExpr":
        return `{${expr.fields.length} fields}`;
      case "TupleExpr":
        return `(${expr.elements.length})`;
      case "PipelineLiteral":
        return `pipeline(${expr.stages.length})`;
      case "MatchExpr":
        return `match(${expr.cases.length})`;
      default:
        return expr.kind.replace("Expr", "").toLowerCase();
    }
  }

  private addNode(
    type: CanvasNodeType,
    label: string,
    data?: Record<string, unknown>,
    prefix = "n"
  ): string {
    const id = this.genNodeId(prefix);
    const node: CanvasNode = {
      id,
      label: this.truncate(label),
      type,
      x: 0,
      y: 0,
      width: Math.max(80, label.length * 8 + 20),
      height: 40,
      data,
    };
    this.graph.nodes.set(id, node);
    return id;
  }

  private addEdge(from: string, to: string, label?: string): void {
    this.graph.edges.push({
      id: this.genEdgeId(),
      from,
      to,
      label,
    });
  }

  private buildExpr(expr: Expr): { entry?: string; exit?: string } {
    switch (expr.kind) {
      case "NumberLiteral":
      case "StringLiteral":
      case "BooleanLiteral": {
        const id = this.addNode("data", this.describeExpr(expr), { value: expr.kind === "NumberLiteral" ? expr.value : expr.kind === "StringLiteral" ? expr.value : expr.value }, "lit");
        return { entry: id, exit: id };
      }

      case "Identifier": {
        const id = this.addNode("data", expr.name, { name: expr.name }, "id");
        return { entry: id, exit: id };
      }

      case "PipeExpr":
        return this.buildPipe(expr);

      case "ParallelPipeExpr":
        return this.buildParallelPipe(expr);

      case "SpreadPipeExpr":
        return this.buildSpreadPipe(expr);

      case "CallExpr": {
        const label = expr.callee.kind === "Identifier"
          ? `${expr.callee.name}(${expr.args.map(a => this.describeExpr(a)).join(", ")})`
          : "call(...)";
        const id = this.addNode("operation", label, { callee: expr.callee.kind }, "call");
        return { entry: id, exit: id };
      }

      case "FunctionExpr": {
        const params = expr.params.map(p => p.name).join(", ");
        const decorators = expr.decorators.map(d => `#${d.name}`).join(" ");
        const label = `(${params}) -> ...${decorators ? " " + decorators : ""}`;
        const id = this.addNode("operation", label, { params: expr.params.map(p => p.name) }, "fn");
        return { entry: id, exit: id };
      }

      case "TernaryExpr":
        return this.buildTernary(expr);

      case "AwaitExpr": {
        const operand = this.buildExpr(expr.operand);
        const awaitId = this.addNode("await", "await", {}, "await");
        if (operand.exit) {
          this.addEdge(operand.exit, awaitId);
        }
        return { entry: operand.entry || awaitId, exit: awaitId };
      }

      case "ReturnExpr": {
        const value = this.buildExpr(expr.value);
        const returnId = this.addNode("return", "return", {}, "ret");
        if (value.exit) {
          this.addEdge(value.exit, returnId);
        }
        return { entry: value.entry || returnId, exit: returnId };
      }

      case "PipelineLiteral":
        return this.buildPipelineLiteral(expr);

      case "ReversePipeExpr":
        return this.buildReversePipe(expr);

      case "MatchExpr":
        return this.buildMatch(expr);

      case "ReactivePipeExpr":
        return this.buildReactivePipe(expr);

      default: {
        const id = this.addNode("operation", this.describeExpr(expr), {}, "expr");
        return { entry: id, exit: id };
      }
    }
  }

  private buildPipe(expr: PipeExpr): { entry?: string; exit?: string } {
    // Flatten pipe chain
    const chain: Expr[] = [];
    let current: Expr = expr;
    while (current.kind === "PipeExpr") {
      const pipe = current as PipeExpr;
      if (pipe.left.kind === "PipeExpr") {
        chain.push(...this.flattenPipeChain(pipe.left));
      } else {
        chain.push(pipe.left);
      }
      current = pipe.right;
    }
    chain.push(current);

    let prevExit: string | undefined;
    let firstEntry: string | undefined;

    for (const stage of chain) {
      const result = this.buildExpr(stage);
      if (!firstEntry) firstEntry = result.entry;
      if (prevExit && result.entry) {
        this.addEdge(prevExit, result.entry);
      }
      prevExit = result.exit;
    }

    return { entry: firstEntry, exit: prevExit };
  }

  private flattenPipeChain(expr: Expr): Expr[] {
    const chain: Expr[] = [];
    let current: Expr = expr;
    while (current.kind === "PipeExpr") {
      const pipe = current as PipeExpr;
      if (pipe.left.kind === "PipeExpr") {
        chain.push(...this.flattenPipeChain(pipe.left));
      } else {
        chain.push(pipe.left);
      }
      current = pipe.right;
    }
    chain.push(current);
    return chain;
  }

  private buildParallelPipe(expr: ParallelPipeExpr): { entry?: string; exit?: string } {
    const input = this.buildExpr(expr.input);

    // Fan-out node
    const fanoutId = this.addNode("fanout", "fan-out", { branches: expr.branches.length }, "fanout");
    if (input.exit) {
      this.addEdge(input.exit, fanoutId);
    }

    // Process branches
    const branchExits: string[] = [];
    for (let i = 0; i < expr.branches.length; i++) {
      const branch = this.buildExpr(expr.branches[i]);
      if (branch.entry) {
        this.addEdge(fanoutId, branch.entry, `branch ${i + 1}`);
      }
      if (branch.exit) {
        branchExits.push(branch.exit);
      }
    }

    // Fan-in node
    const faninId = this.addNode("fanin", "fan-in", {}, "fanin");
    for (const exit of branchExits) {
      this.addEdge(exit, faninId);
    }

    return { entry: input.entry || fanoutId, exit: faninId };
  }

  private buildSpreadPipe(expr: SpreadPipeExpr): { entry?: string; exit?: string } {
    const left = this.buildExpr(expr.left);

    const spreadId = this.addNode("fanout", "/>>> spread", {}, "spread");
    if (left.exit) {
      this.addEdge(left.exit, spreadId);
    }

    const right = this.buildExpr(expr.right);
    if (right.entry) {
      this.addEdge(spreadId, right.entry, "each");
    }

    const collectId = this.addNode("fanin", "collect", {}, "collect");
    if (right.exit) {
      this.addEdge(right.exit, collectId);
    }

    return { entry: left.entry || spreadId, exit: collectId };
  }

  private buildTernary(expr: TernaryExpr): { entry?: string; exit?: string } {
    const condId = this.addNode("condition", this.describeExpr(expr.condition), {}, "cond");

    const thenBranch = this.buildExpr(expr.thenBranch);
    const elseBranch = this.buildExpr(expr.elseBranch);

    if (thenBranch.entry) {
      this.addEdge(condId, thenBranch.entry, "true");
    }
    if (elseBranch.entry) {
      this.addEdge(condId, elseBranch.entry, "false");
    }

    const mergeId = this.addNode("fanin", "merge", {}, "merge");
    if (thenBranch.exit) {
      this.addEdge(thenBranch.exit, mergeId);
    }
    if (elseBranch.exit) {
      this.addEdge(elseBranch.exit, mergeId);
    }

    return { entry: condId, exit: mergeId };
  }

  private buildPipelineLiteral(expr: PipelineLiteral): { entry?: string; exit?: string } {
    const entryId = this.addNode("pipeline", "pipeline", { stages: expr.stages.length }, "pipe_entry");

    let prevExit = entryId;

    for (const stage of expr.stages) {
      if (isParallelStage(stage)) {
        const fanoutId = this.addNode("fanout", "fan-out", {}, "fanout");
        this.addEdge(prevExit, fanoutId);

        const branchExits: string[] = [];
        for (let i = 0; i < stage.branches.length; i++) {
          const branch = this.buildExpr(stage.branches[i]);
          if (branch.entry) {
            this.addEdge(fanoutId, branch.entry);
          }
          if (branch.exit) {
            branchExits.push(branch.exit);
          }
        }

        const faninId = this.addNode("fanin", "fan-in", {}, "fanin");
        for (const exit of branchExits) {
          this.addEdge(exit, faninId);
        }
        prevExit = faninId;
      } else {
        const stageResult = this.buildExpr(stage.expr);
        if (stageResult.entry) {
          this.addEdge(prevExit, stageResult.entry);
        }
        if (stageResult.exit) {
          prevExit = stageResult.exit;
        }
      }
    }

    return { entry: entryId, exit: prevExit };
  }

  private buildReversePipe(expr: ReversePipeExpr): { entry?: string; exit?: string } {
    const value = this.buildExpr(expr.right);
    const revId = this.addNode("operation", "reverse </ ", {}, "rev");
    if (value.exit) {
      this.addEdge(value.exit, revId);
    }

    const pipeline = this.buildExpr(expr.left);
    if (pipeline.entry) {
      this.addEdge(revId, pipeline.entry);
    }

    return { entry: value.entry || revId, exit: pipeline.exit || revId };
  }

  private buildMatch(expr: MatchExpr): { entry?: string; exit?: string } {
    const matchId = this.addNode("match", `match ${this.describeExpr(expr.value)}`, { cases: expr.cases.length }, "match");

    const caseExits: string[] = [];
    for (let i = 0; i < expr.cases.length; i++) {
      const c = expr.cases[i];
      let caseLabel: string;
      if (c.pattern) {
        caseLabel = `| ${this.describeExpr(c.pattern)}`;
      } else if (c.guard) {
        caseLabel = `| if ${this.describeExpr(c.guard)}`;
      } else {
        caseLabel = "| default";
      }

      const caseId = this.addNode("condition", caseLabel, {}, "case");
      this.addEdge(matchId, caseId, `case ${i + 1}`);

      const body = this.buildExpr(c.body);
      if (body.entry) {
        this.addEdge(caseId, body.entry);
      }
      if (body.exit) {
        caseExits.push(body.exit);
      }
    }

    const mergeId = this.addNode("fanin", "end match", {}, "merge");
    for (const exit of caseExits) {
      this.addEdge(exit, mergeId);
    }

    return { entry: matchId, exit: mergeId };
  }

  private buildReactivePipe(expr: ReactivePipeExpr): { entry?: string; exit?: string } {
    const sourceId = this.addNode("reactive", `@> ${expr.sourceName}`, { source: expr.sourceName }, "reactive");

    let prevExit = sourceId;

    for (const stage of expr.stages) {
      if (isParallelStage(stage)) {
        const fanoutId = this.addNode("fanout", "fan-out", {}, "fanout");
        this.addEdge(prevExit, fanoutId);

        const branchExits: string[] = [];
        for (let i = 0; i < stage.branches.length; i++) {
          const branch = this.buildExpr(stage.branches[i]);
          if (branch.entry) {
            this.addEdge(fanoutId, branch.entry);
          }
          if (branch.exit) {
            branchExits.push(branch.exit);
          }
        }

        const faninId = this.addNode("fanin", "fan-in", {}, "fanin");
        for (const exit of branchExits) {
          this.addEdge(exit, faninId);
        }
        prevExit = faninId;
      } else {
        const stageResult = this.buildExpr(stage.expr);
        if (stageResult.entry) {
          this.addEdge(prevExit, stageResult.entry);
        }
        if (stageResult.exit) {
          prevExit = stageResult.exit;
        }
      }
    }

    return { entry: sourceId, exit: prevExit };
  }

  private containsPipes(expr: Expr): boolean {
    switch (expr.kind) {
      case "PipeExpr":
      case "ParallelPipeExpr":
      case "ReversePipeExpr":
      case "SpreadPipeExpr":
      case "ReactivePipeExpr":
      case "PipelineLiteral":
      case "BidirectionalPipelineLiteral":
        return true;
      case "CallExpr":
        return expr.args.some(a => this.containsPipes(a)) || this.containsPipes(expr.callee);
      case "BinaryExpr":
        return this.containsPipes(expr.left) || this.containsPipes(expr.right);
      case "TernaryExpr":
        return this.containsPipes(expr.condition) ||
               this.containsPipes(expr.thenBranch) ||
               this.containsPipes(expr.elseBranch);
      case "ListExpr":
        return expr.elements.some(e => this.containsPipes(e.value));
      case "RecordExpr":
        return expr.fields.some(f => this.containsPipes(f.value));
      case "FunctionExpr":
        if (expr.body.kind === "BlockBody") {
          return expr.body.statements.some(s =>
            s.kind === "ExprStmt" && this.containsPipes(s.expression)) ||
            this.containsPipes(expr.body.result);
        }
        return this.containsPipes(expr.body);
      case "AwaitExpr":
        return this.containsPipes(expr.operand);
      case "ReturnExpr":
        return this.containsPipes(expr.value);
      case "MatchExpr":
        return this.containsPipes(expr.value) ||
               expr.cases.some(c => this.containsPipes(c.body));
      default:
        return false;
    }
  }

  private buildStmt(stmt: Stmt): { entry?: string; exit?: string } {
    switch (stmt.kind) {
      case "LetStmt": {
        if (!this.containsPipes(stmt.value)) {
          const label = `${stmt.mutable ? "maybe" : "let"} ${stmt.name} = ${this.describeExpr(stmt.value)}`;
          const id = this.addNode("binding", label, { name: stmt.name, mutable: stmt.mutable }, "let");
          return { entry: id, exit: id };
        }

        const subgraphId = this.genNodeId("sg");
        const value = this.buildExpr(stmt.value);

        const bindingId = this.addNode("binding", `${stmt.mutable ? "maybe" : "let"} ${stmt.name}`, { name: stmt.name }, "bind");
        if (value.exit) {
          this.addEdge(value.exit, bindingId);
        }

        // Add nodes to subgraph
        const nodeIds: string[] = [];
        for (const node of this.graph.nodes.values()) {
          if (!node.subgraphId) {
            nodeIds.push(node.id);
          }
        }

        this.graph.subgraphs.set(subgraphId, {
          id: subgraphId,
          label: stmt.name,
          nodes: nodeIds,
        });

        return { entry: value.entry, exit: bindingId };
      }

      case "ExprStmt":
        return this.buildExpr(stmt.expression);

      case "CodeblockStmt":
        return this.buildCodeblock(stmt);

      default:
        return {};
    }
  }

  private buildCodeblock(stmt: CodeblockStmt): { entry?: string; exit?: string } {
    let firstEntry: string | undefined;
    let prevExit: string | undefined;

    for (const s of stmt.statements) {
      const result = this.buildStmt(s);
      if (!firstEntry) firstEntry = result.entry;
      if (prevExit && result.entry) {
        this.addEdge(prevExit, result.entry);
      }
      if (result.exit) {
        prevExit = result.exit;
      }
    }

    return { entry: firstEntry, exit: prevExit };
  }

  build(program: Program): CanvasGraph {
    let firstEntry: string | undefined;
    let prevExit: string | undefined;

    for (const stmt of program.statements) {
      // Skip non-pipe statements for cleaner diagrams
      if (stmt.kind === "LetStmt" && !this.containsPipes(stmt.value)) {
        continue;
      }
      if (stmt.kind === "ExprStmt" && !this.containsPipes(stmt.expression)) {
        continue;
      }
      if (stmt.kind === "ContextDefStmt" || stmt.kind === "ProvideStmt" || stmt.kind === "DecoratorDefStmt") {
        continue;
      }

      const result = this.buildStmt(stmt);

      if (!firstEntry) firstEntry = result.entry;
      if (prevExit && result.entry) {
        this.addEdge(prevExit, result.entry, "then");
      }
      prevExit = result.exit;
    }

    this.graph.entryNode = firstEntry;
    this.graph.exitNode = prevExit;

    return this.graph;
  }
}

// ============================================================================
// Layout Algorithm (Simple Layered Graph Layout)
// ============================================================================

export function layoutGraph(graph: CanvasGraph, options: CanvasOptions = {}): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { nodeSpacing, levelSpacing, direction } = opts;

  // Build adjacency list
  const outEdges = new Map<string, string[]>();
  const inEdges = new Map<string, string[]>();

  for (const node of graph.nodes.keys()) {
    outEdges.set(node, []);
    inEdges.set(node, []);
  }

  for (const edge of graph.edges) {
    outEdges.get(edge.from)?.push(edge.to);
    inEdges.get(edge.to)?.push(edge.from);
  }

  // Assign layers using topological sort
  const layers = new Map<string, number>();
  const visited = new Set<string>();

  function assignLayer(nodeId: string, layer: number): void {
    if (visited.has(nodeId)) {
      layers.set(nodeId, Math.max(layers.get(nodeId) || 0, layer));
      return;
    }
    visited.add(nodeId);
    layers.set(nodeId, layer);

    for (const next of outEdges.get(nodeId) || []) {
      assignLayer(next, layer + 1);
    }
  }

  // Start from entry nodes (nodes with no incoming edges)
  for (const [nodeId] of graph.nodes) {
    const incoming = inEdges.get(nodeId) || [];
    if (incoming.length === 0) {
      assignLayer(nodeId, 0);
    }
  }

  // Handle any unvisited nodes (cycles or disconnected)
  for (const [nodeId] of graph.nodes) {
    if (!visited.has(nodeId)) {
      assignLayer(nodeId, 0);
    }
  }

  // Group nodes by layer
  const nodesByLayer = new Map<number, string[]>();
  for (const [nodeId, layer] of layers) {
    if (!nodesByLayer.has(layer)) {
      nodesByLayer.set(layer, []);
    }
    nodesByLayer.get(layer)!.push(nodeId);
  }

  // Assign positions
  const maxLayer = Math.max(...nodesByLayer.keys());

  for (let layer = 0; layer <= maxLayer; layer++) {
    const nodesInLayer = nodesByLayer.get(layer) || [];
    const layerHeight = nodesInLayer.length * nodeSpacing;

    for (let i = 0; i < nodesInLayer.length; i++) {
      const node = graph.nodes.get(nodesInLayer[i])!;

      if (direction === "LR") {
        node.x = 100 + layer * levelSpacing;
        node.y = 100 + i * nodeSpacing - layerHeight / 2 + opts.height / 2;
      } else {
        node.x = 100 + i * nodeSpacing - layerHeight / 2 + opts.width / 2;
        node.y = 100 + layer * levelSpacing;
      }
    }
  }
}

// ============================================================================
// SVG Generation
// ============================================================================

export function generateSVG(graph: CanvasGraph, options: CanvasOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const theme = THEMES[opts.theme];

  // Calculate bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of graph.nodes.values()) {
    minX = Math.min(minX, node.x - node.width / 2);
    minY = Math.min(minY, node.y - node.height / 2);
    maxX = Math.max(maxX, node.x + node.width / 2);
    maxY = Math.max(maxY, node.y + node.height / 2);
  }

  const padding = 50;
  const viewWidth = maxX - minX + padding * 2;
  const viewHeight = maxY - minY + padding * 2;

  const parts: string[] = [];

  // SVG header
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX - padding} ${minY - padding} ${viewWidth} ${viewHeight}" width="100%" height="100%">`);

  // Defs for markers and filters
  parts.push(`
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="${theme.edge}" />
    </marker>
    <marker id="arrowhead-active" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="${theme.edgeActive}" />
    </marker>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.3"/>
    </filter>
    <linearGradient id="flow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${theme.edgeActive};stop-opacity:0"/>
      <stop offset="50%" style="stop-color:${theme.edgeActive};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:${theme.edgeActive};stop-opacity:0"/>
    </linearGradient>
  </defs>
  `);

  // Background
  parts.push(`<rect x="${minX - padding}" y="${minY - padding}" width="${viewWidth}" height="${viewHeight}" fill="${theme.background}"/>`);

  // Render subgraphs
  for (const subgraph of graph.subgraphs.values()) {
    if (subgraph.nodes.length === 0) continue;

    let sgMinX = Infinity, sgMinY = Infinity, sgMaxX = -Infinity, sgMaxY = -Infinity;
    for (const nodeId of subgraph.nodes) {
      const node = graph.nodes.get(nodeId);
      if (node) {
        sgMinX = Math.min(sgMinX, node.x - node.width / 2);
        sgMinY = Math.min(sgMinY, node.y - node.height / 2);
        sgMaxX = Math.max(sgMaxX, node.x + node.width / 2);
        sgMaxY = Math.max(sgMaxY, node.y + node.height / 2);
      }
    }

    const sgPadding = 20;
    parts.push(`
      <rect x="${sgMinX - sgPadding}" y="${sgMinY - sgPadding - 25}"
            width="${sgMaxX - sgMinX + sgPadding * 2}" height="${sgMaxY - sgMinY + sgPadding * 2 + 25}"
            rx="10" fill="${theme.subgraph}" stroke="${theme.edge}" stroke-dasharray="5,5"/>
      <text x="${sgMinX - sgPadding + 10}" y="${sgMinY - sgPadding - 5}"
            fill="${theme.text}" font-size="12" font-family="monospace">${subgraph.label}</text>
    `);
  }

  // Render edges
  for (const edge of graph.edges) {
    const from = graph.nodes.get(edge.from);
    const to = graph.nodes.get(edge.to);
    if (!from || !to) continue;

    const x1 = from.x + from.width / 2;
    const y1 = from.y;
    const x2 = to.x - to.width / 2;
    const y2 = to.y;

    // Bezier curve for smooth edges
    const midX = (x1 + x2) / 2;
    const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;

    const edgeColor = edge.active ? theme.edgeActive : theme.edge;
    const marker = edge.active ? "arrowhead-active" : "arrowhead";

    parts.push(`
      <path d="${path}" fill="none" stroke="${edgeColor}" stroke-width="2"
            marker-end="url(#${marker})" class="edge" data-edge-id="${edge.id}"/>
    `);

    if (edge.label) {
      const labelX = midX;
      const labelY = (y1 + y2) / 2 - 10;
      parts.push(`
        <text x="${labelX}" y="${labelY}" fill="${theme.text}" font-size="10"
              text-anchor="middle" font-family="monospace">${edge.label}</text>
      `);
    }

    // Animation path for data flow
    if (opts.animate && edge.animated) {
      parts.push(`
        <circle r="4" fill="${theme.edgeActive}">
          <animateMotion dur="1s" repeatCount="indefinite" path="${path}"/>
        </circle>
      `);
    }
  }

  // Render nodes
  for (const node of graph.nodes.values()) {
    const colors = theme.nodeColors[node.type];
    const x = node.x - node.width / 2;
    const y = node.y - node.height / 2;

    let shape: string;
    switch (node.type) {
      case "data":
      case "reactive":
        // Stadium shape
        shape = `<rect x="${x}" y="${y}" width="${node.width}" height="${node.height}"
                       rx="${node.height / 2}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2"/>`;
        break;
      case "operation":
        // Parallelogram
        const offset = 10;
        shape = `<polygon points="${x + offset},${y} ${x + node.width},${y} ${x + node.width - offset},${y + node.height} ${x},${y + node.height}"
                          fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2"/>`;
        break;
      case "fanout":
      case "fanin":
      case "condition":
        // Diamond
        const cx = node.x;
        const cy = node.y;
        const hw = node.width / 2;
        const hh = node.height / 2;
        shape = `<polygon points="${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}"
                          fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2"/>`;
        break;
      case "await":
      case "return":
        // Subroutine (double rectangle)
        shape = `
          <rect x="${x}" y="${y}" width="${node.width}" height="${node.height}"
                rx="5" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2"/>
          <line x1="${x + 5}" y1="${y}" x2="${x + 5}" y2="${y + node.height}" stroke="${colors.stroke}" stroke-width="2"/>
          <line x1="${x + node.width - 5}" y1="${y}" x2="${x + node.width - 5}" y2="${y + node.height}" stroke="${colors.stroke}" stroke-width="2"/>
        `;
        break;
      case "pipeline":
      case "match":
        // Hexagon
        const hx = node.x;
        const hy = node.y;
        const w = node.width / 2;
        const h = node.height / 2;
        const indent = 15;
        shape = `<polygon points="${hx - w + indent},${hy - h} ${hx + w - indent},${hy - h} ${hx + w},${hy} ${hx + w - indent},${hy + h} ${hx - w + indent},${hy + h} ${hx - w},${hy}"
                          fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2"/>`;
        break;
      default:
        // Rectangle
        shape = `<rect x="${x}" y="${y}" width="${node.width}" height="${node.height}"
                       rx="5" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2"/>`;
    }

    parts.push(`
      <g class="node" data-node-id="${node.id}" data-node-type="${node.type}" filter="url(#shadow)" style="cursor: pointer;">
        ${shape}
        <text x="${node.x}" y="${node.y + 4}" fill="white" font-size="12"
              text-anchor="middle" font-family="monospace" pointer-events="none">${escapeXml(node.label)}</text>
      </g>
    `);
  }

  parts.push("</svg>");
  return parts.join("\n");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ============================================================================
// Interactive HTML Generation
// ============================================================================

export function generateInteractiveHTML(
  graph: CanvasGraph,
  sourceCode: string,
  title: string,
  options: CanvasOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const svg = generateSVG(graph, opts);
  const theme = THEMES[opts.theme];

  // Serialize graph data for JavaScript
  const graphData = {
    nodes: Array.from(graph.nodes.values()),
    edges: graph.edges,
    subgraphs: Array.from(graph.subgraphs.values()),
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeXml(title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${theme.background};
      color: ${theme.text};
      height: 100vh;
      overflow: hidden;
    }

    .container {
      display: grid;
      grid-template-columns: 1fr 300px;
      grid-template-rows: auto 1fr;
      height: 100vh;
    }

    .header {
      grid-column: 1 / -1;
      padding: 15px 20px;
      background: rgba(0, 0, 0, 0.2);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .header h1 {
      font-size: 1.2rem;
      color: #9b59b6;
    }

    .controls {
      display: flex;
      gap: 10px;
    }

    .controls button {
      background: #3498db;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 0.85rem;
      transition: background 0.2s;
    }

    .controls button:hover {
      background: #2980b9;
    }

    .controls button.active {
      background: #27ae60;
    }

    .canvas-container {
      position: relative;
      overflow: hidden;
      background: ${theme.background};
    }

    .canvas-wrapper {
      width: 100%;
      height: 100%;
      cursor: grab;
    }

    .canvas-wrapper.dragging {
      cursor: grabbing;
    }

    .canvas-wrapper svg {
      display: block;
    }

    .sidebar {
      background: ${theme.inspectorBg};
      border-left: 1px solid rgba(255, 255, 255, 0.1);
      overflow-y: auto;
    }

    .panel {
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .panel-header {
      padding: 12px 15px;
      background: rgba(0, 0, 0, 0.2);
      font-weight: 600;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .panel-header:hover {
      background: rgba(0, 0, 0, 0.3);
    }

    .panel-content {
      padding: 15px;
    }

    .panel-content.collapsed {
      display: none;
    }

    .inspector-empty {
      color: rgba(255, 255, 255, 0.5);
      font-style: italic;
      font-size: 0.9rem;
    }

    .inspector-item {
      margin-bottom: 12px;
    }

    .inspector-label {
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.6);
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .inspector-value {
      font-family: monospace;
      font-size: 0.9rem;
      padding: 8px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 4px;
      word-break: break-all;
    }

    .legend-grid {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 12px;
      font-size: 0.85rem;
    }

    .legend-color {
      width: 20px;
      height: 20px;
      border-radius: 4px;
    }

    .source-code {
      font-family: monospace;
      font-size: 0.8rem;
      white-space: pre-wrap;
      background: rgba(0, 0, 0, 0.3);
      padding: 10px;
      border-radius: 4px;
      max-height: 200px;
      overflow-y: auto;
    }

    .zoom-info {
      position: absolute;
      bottom: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.6);
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 0.8rem;
      font-family: monospace;
    }

    .node:hover {
      filter: url(#shadow) brightness(1.2);
    }

    .node.selected rect,
    .node.selected polygon {
      stroke-width: 3;
      stroke: #00ff88 !important;
    }

    .minimap {
      position: absolute;
      bottom: 10px;
      right: 10px;
      width: 150px;
      height: 100px;
      background: rgba(0, 0, 0, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      overflow: hidden;
    }

    .minimap svg {
      width: 100%;
      height: 100%;
    }

    .minimap-viewport {
      fill: rgba(255, 255, 255, 0.1);
      stroke: #00ff88;
      stroke-width: 2;
    }

    @keyframes flowAnimation {
      0% { stroke-dashoffset: 20; }
      100% { stroke-dashoffset: 0; }
    }

    .edge.animated {
      stroke-dasharray: 10, 10;
      animation: flowAnimation 0.5s linear infinite;
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <h1>${escapeXml(title)}</h1>
      <div class="controls">
        <button id="btn-zoom-in" title="Zoom In">+ Zoom</button>
        <button id="btn-zoom-out" title="Zoom Out">- Zoom</button>
        <button id="btn-fit" title="Fit to View">Fit</button>
        <button id="btn-animate" title="Toggle Animation">Animate</button>
        <button id="btn-download" title="Download SVG">Download SVG</button>
      </div>
    </header>

    <div class="canvas-container">
      <div class="canvas-wrapper" id="canvas-wrapper">
        ${svg}
      </div>
      <div class="zoom-info" id="zoom-info">100%</div>
      <div class="minimap" id="minimap"></div>
    </div>

    <aside class="sidebar">
      <div class="panel">
        <div class="panel-header" data-panel="inspector">
          Node Inspector
          <span>▼</span>
        </div>
        <div class="panel-content" id="inspector-content">
          <p class="inspector-empty">Click a node to inspect</p>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header" data-panel="legend">
          Legend
          <span>▼</span>
        </div>
        <div class="panel-content" id="legend-content">
          <div class="legend-grid">
            <div class="legend-color" style="background: #9b59b6;"></div>
            <span>Data Values</span>
            <div class="legend-color" style="background: #3498db;"></div>
            <span>Operations</span>
            <div class="legend-color" style="background: #e67e22;"></div>
            <span>Fan-out/Fan-in</span>
            <div class="legend-color" style="background: #27ae60;"></div>
            <span>Await/Return</span>
            <div class="legend-color" style="background: #f39c12;"></div>
            <span>Conditionals</span>
            <div class="legend-color" style="background: #00bcd4;"></div>
            <span>Reactive</span>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header" data-panel="source">
          Source Code
          <span>▼</span>
        </div>
        <div class="panel-content" id="source-content">
          <div class="source-code">${escapeXml(sourceCode)}</div>
        </div>
      </div>
    </aside>
  </div>

  <script>
    // Graph data
    const graphData = ${JSON.stringify(graphData)};

    // State
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let selectedNode = null;
    let animating = false;

    // DOM elements
    const wrapper = document.getElementById('canvas-wrapper');
    const svg = wrapper.querySelector('svg');
    const zoomInfo = document.getElementById('zoom-info');
    const inspectorContent = document.getElementById('inspector-content');
    const minimap = document.getElementById('minimap');

    // Initialize
    function init() {
      setupPanZoom();
      setupNodeInteraction();
      setupControls();
      setupPanels();
      setupMinimap();
      fitToView();
    }

    // Pan and zoom
    function setupPanZoom() {
      wrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.1, Math.min(5, scale * delta));

        // Zoom towards mouse position
        const rect = wrapper.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        translateX = mouseX - (mouseX - translateX) * (newScale / scale);
        translateY = mouseY - (mouseY - translateY) * (newScale / scale);
        scale = newScale;

        updateTransform();
      });

      wrapper.addEventListener('mousedown', (e) => {
        if (e.target.closest('.node')) return;
        isDragging = true;
        dragStartX = e.clientX - translateX;
        dragStartY = e.clientY - translateY;
        wrapper.classList.add('dragging');
      });

      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        translateX = e.clientX - dragStartX;
        translateY = e.clientY - dragStartY;
        updateTransform();
      });

      document.addEventListener('mouseup', () => {
        isDragging = false;
        wrapper.classList.remove('dragging');
      });
    }

    function updateTransform() {
      svg.style.transform = \`translate(\${translateX}px, \${translateY}px) scale(\${scale})\`;
      svg.style.transformOrigin = '0 0';
      zoomInfo.textContent = Math.round(scale * 100) + '%';
      updateMinimap();
    }

    function fitToView() {
      const rect = wrapper.getBoundingClientRect();
      const svgRect = svg.getBBox();

      const scaleX = rect.width / (svgRect.width + 100);
      const scaleY = rect.height / (svgRect.height + 100);
      scale = Math.min(scaleX, scaleY, 1);

      translateX = (rect.width - svgRect.width * scale) / 2 - svgRect.x * scale;
      translateY = (rect.height - svgRect.height * scale) / 2 - svgRect.y * scale;

      updateTransform();
    }

    // Node interaction
    function setupNodeInteraction() {
      svg.querySelectorAll('.node').forEach(node => {
        node.addEventListener('click', (e) => {
          e.stopPropagation();
          selectNode(node);
        });
      });

      svg.addEventListener('click', (e) => {
        if (!e.target.closest('.node')) {
          deselectNode();
        }
      });
    }

    function selectNode(nodeEl) {
      deselectNode();
      selectedNode = nodeEl;
      nodeEl.classList.add('selected');

      const nodeId = nodeEl.dataset.nodeId;
      const nodeData = graphData.nodes.find(n => n.id === nodeId);

      if (nodeData) {
        updateInspector(nodeData);
      }
    }

    function deselectNode() {
      if (selectedNode) {
        selectedNode.classList.remove('selected');
        selectedNode = null;
      }
      inspectorContent.innerHTML = '<p class="inspector-empty">Click a node to inspect</p>';
    }

    function updateInspector(node) {
      let html = '';

      html += '<div class="inspector-item">';
      html += '<div class="inspector-label">Node ID</div>';
      html += '<div class="inspector-value">' + node.id + '</div>';
      html += '</div>';

      html += '<div class="inspector-item">';
      html += '<div class="inspector-label">Type</div>';
      html += '<div class="inspector-value">' + node.type + '</div>';
      html += '</div>';

      html += '<div class="inspector-item">';
      html += '<div class="inspector-label">Label</div>';
      html += '<div class="inspector-value">' + escapeHtml(node.label) + '</div>';
      html += '</div>';

      html += '<div class="inspector-item">';
      html += '<div class="inspector-label">Position</div>';
      html += '<div class="inspector-value">x: ' + Math.round(node.x) + ', y: ' + Math.round(node.y) + '</div>';
      html += '</div>';

      if (node.data && Object.keys(node.data).length > 0) {
        html += '<div class="inspector-item">';
        html += '<div class="inspector-label">Data</div>';
        html += '<div class="inspector-value">' + JSON.stringify(node.data, null, 2) + '</div>';
        html += '</div>';
      }

      inspectorContent.innerHTML = html;
    }

    // Controls
    function setupControls() {
      document.getElementById('btn-zoom-in').addEventListener('click', () => {
        scale = Math.min(5, scale * 1.2);
        updateTransform();
      });

      document.getElementById('btn-zoom-out').addEventListener('click', () => {
        scale = Math.max(0.1, scale / 1.2);
        updateTransform();
      });

      document.getElementById('btn-fit').addEventListener('click', fitToView);

      document.getElementById('btn-animate').addEventListener('click', (e) => {
        animating = !animating;
        e.target.classList.toggle('active', animating);
        toggleAnimation(animating);
      });

      document.getElementById('btn-download').addEventListener('click', downloadSVG);
    }

    function toggleAnimation(enabled) {
      svg.querySelectorAll('.edge').forEach(edge => {
        edge.classList.toggle('animated', enabled);
      });
    }

    function downloadSVG() {
      const svgData = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lea-flow.svg';
      a.click();
      URL.revokeObjectURL(url);
    }

    // Panels
    function setupPanels() {
      document.querySelectorAll('.panel-header').forEach(header => {
        header.addEventListener('click', () => {
          const content = header.nextElementSibling;
          const arrow = header.querySelector('span');
          content.classList.toggle('collapsed');
          arrow.textContent = content.classList.contains('collapsed') ? '►' : '▼';
        });
      });
    }

    // Minimap
    function setupMinimap() {
      const minimapSvg = svg.cloneNode(true);
      minimapSvg.querySelectorAll('text').forEach(t => t.remove());
      minimap.appendChild(minimapSvg);
      updateMinimap();
    }

    function updateMinimap() {
      // Simplified minimap update
    }

    // Utility
    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    // Initialize on load
    document.addEventListener('DOMContentLoaded', init);
  </script>
</body>
</html>`;
}

// ============================================================================
// Main Export Functions
// ============================================================================

export function buildCanvasGraph(program: Program): CanvasGraph {
  const builder = new CanvasGraphBuilder();
  return builder.build(program);
}

export function visualizeToCanvas(
  program: Program,
  sourceCode: string,
  title: string,
  options: CanvasOptions = {}
): string {
  const graph = buildCanvasGraph(program);
  layoutGraph(graph, options);
  return generateInteractiveHTML(graph, sourceCode, title, options);
}

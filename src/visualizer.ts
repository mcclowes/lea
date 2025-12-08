/**
 * Mermaid Visualization for Lea AST
 *
 * This module generates Mermaid flowchart diagrams from Lea source code,
 * showing pipe chains, parallel execution, and data flow.
 */

import {
  Program,
  Stmt,
  Expr,
  LetStmt,
  ExprStmt,
  PipeExpr,
  ParallelPipeExpr,
  CallExpr,
  FunctionExpr,
  Identifier,
  NumberLiteral,
  StringLiteral,
  BooleanLiteral,
  ListExpr,
  RecordExpr,
  MemberExpr,
  BinaryExpr,
  UnaryExpr,
  TernaryExpr,
  AwaitExpr,
  ReturnExpr,
  IndexExpr,
  TupleExpr,
  PipelineLiteral,
  ReversePipeExpr,
  BidirectionalPipelineLiteral,
  MatchExpr,
  TemplateStringExpr,
  BlockBody,
  CodeblockStmt,
  AnyPipelineStage,
} from "./ast";

// Node types for styling
type NodeType =
  | "data"        // Data values (numbers, strings, lists) - purple stadium
  | "operation"   // Operations (functions, calls) - blue parallelogram
  | "fanout"      // Parallel fan-out - orange diamond
  | "fanin"       // Parallel fan-in - orange diamond
  | "await"       // Await/async - green subroutine
  | "return"      // Early return - green subroutine
  | "binding"     // Variable binding - rectangle
  | "pipeline"    // Pipeline literal - hexagon
  | "match"       // Match expression - hexagon
  | "condition";  // Ternary/conditional - diamond

interface MermaidNode {
  id: string;
  label: string;
  type: NodeType;
}

interface MermaidEdge {
  from: string;
  to: string;
  label?: string;
}

interface MermaidSubgraph {
  id: string;
  label: string;
  nodes: MermaidNode[];
  edges: MermaidEdge[];
  subgraphs: MermaidSubgraph[];
}

interface VisualizationResult {
  nodes: MermaidNode[];
  edges: MermaidEdge[];
  subgraphs: MermaidSubgraph[];
  entryNode?: string;
  exitNode?: string;
}

// Options for visualization
export interface VisualizerOptions {
  direction?: "TB" | "LR";  // Top-to-bottom or left-to-right
  showTypes?: boolean;       // Show type annotations
  showDecorators?: boolean;  // Show decorators
  maxLabelLength?: number;   // Truncate long labels
}

const DEFAULT_OPTIONS: VisualizerOptions = {
  direction: "LR",
  showTypes: false,
  showDecorators: true,
  maxLabelLength: 30,
};

/**
 * Main visualizer class that converts AST to Mermaid diagrams
 */
export class ASTVisualizer {
  private nodeCounter = 0;
  private options: VisualizerOptions;

  constructor(options: VisualizerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Generate a unique node ID
   */
  private genId(prefix = "n"): string {
    return `${prefix}${this.nodeCounter++}`;
  }

  /**
   * Truncate a label to the max length
   */
  private truncate(text: string): string {
    const max = this.options.maxLabelLength || 30;
    if (text.length <= max) return text;
    return text.substring(0, max - 3) + "...";
  }

  /**
   * Escape special characters for Mermaid labels
   */
  private escape(text: string): string {
    return text
      .replace(/"/g, "'")
      .replace(/\[/g, "&#91;")
      .replace(/\]/g, "&#93;")
      .replace(/\{/g, "&#123;")
      .replace(/\}/g, "&#125;")
      .replace(/\|/g, "&#124;")
      .replace(/>/g, "&gt;")
      .replace(/</g, "&lt;")
      .replace(/\n/g, " ");
  }

  /**
   * Get the shape syntax for a node type
   */
  private getShape(type: NodeType): { open: string; close: string } {
    switch (type) {
      case "data":
        return { open: "([", close: "])" };  // Stadium
      case "operation":
        return { open: "[/", close: "/]" }; // Parallelogram
      case "fanout":
      case "fanin":
      case "condition":
        return { open: "{", close: "}" };    // Diamond
      case "await":
      case "return":
        return { open: "[[", close: "]]" };  // Subroutine
      case "binding":
        return { open: "[", close: "]" };    // Rectangle
      case "pipeline":
      case "match":
        return { open: "{{", close: "}}" };  // Hexagon
    }
  }

  /**
   * Format a node for Mermaid output
   */
  private formatNode(node: MermaidNode): string {
    const shape = this.getShape(node.type);
    const label = this.escape(this.truncate(node.label));
    return `    ${node.id}${shape.open}"${label}"${shape.close}`;
  }

  /**
   * Format an edge for Mermaid output
   */
  private formatEdge(edge: MermaidEdge): string {
    if (edge.label) {
      const label = this.escape(this.truncate(edge.label));
      return `    ${edge.from} -->|"${label}"| ${edge.to}`;
    }
    return `    ${edge.from} --> ${edge.to}`;
  }

  /**
   * Describe an expression for use as a label
   */
  private describeExpr(expr: Expr): string {
    switch (expr.kind) {
      case "NumberLiteral":
        return String(expr.value);
      case "StringLiteral":
        return `"${expr.value}"`;
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
      case "PipeExpr":
        return "pipe";
      case "ParallelPipeExpr":
        return "parallel";
      case "ListExpr":
        return `[${expr.elements.length} items]`;
      case "RecordExpr":
        return `{${expr.fields.length} fields}`;
      case "TupleExpr":
        return `(${expr.elements.length} elements)`;
      case "MemberExpr":
        return `_.${expr.member}`;
      case "BinaryExpr":
        return expr.operator.lexeme;
      case "UnaryExpr":
        return expr.operator.lexeme;
      case "TernaryExpr":
        return "? :";
      case "AwaitExpr":
        return "await";
      case "ReturnExpr":
        return "return";
      case "IndexExpr":
        return "[index]";
      case "PipelineLiteral":
        return `pipeline(${expr.stages.length})`;
      case "ReversePipeExpr":
        return "reverse pipe";
      case "BidirectionalPipelineLiteral":
        return `bidi-pipeline(${expr.stages.length})`;
      case "MatchExpr":
        return `match(${expr.cases.length})`;
      case "TemplateStringExpr":
        return "template";
      case "PlaceholderExpr":
        return "_";
      default:
        return "expr";
    }
  }

  /**
   * Visualize an expression, returning nodes, edges, and entry/exit points
   */
  private visualizeExpr(expr: Expr): VisualizationResult {
    switch (expr.kind) {
      case "NumberLiteral":
      case "StringLiteral":
      case "BooleanLiteral":
        return this.visualizeLiteral(expr);
      case "Identifier":
        return this.visualizeIdentifier(expr);
      case "PipeExpr":
        return this.visualizePipe(expr);
      case "ParallelPipeExpr":
        return this.visualizeParallelPipe(expr);
      case "CallExpr":
        return this.visualizeCall(expr);
      case "FunctionExpr":
        return this.visualizeFunction(expr);
      case "ListExpr":
        return this.visualizeList(expr);
      case "RecordExpr":
        return this.visualizeRecord(expr);
      case "TupleExpr":
        return this.visualizeTuple(expr);
      case "BinaryExpr":
        return this.visualizeBinary(expr);
      case "UnaryExpr":
        return this.visualizeUnary(expr);
      case "TernaryExpr":
        return this.visualizeTernary(expr);
      case "AwaitExpr":
        return this.visualizeAwait(expr);
      case "ReturnExpr":
        return this.visualizeReturn(expr);
      case "MemberExpr":
        return this.visualizeMember(expr);
      case "IndexExpr":
        return this.visualizeIndex(expr);
      case "PipelineLiteral":
        return this.visualizePipelineLiteral(expr);
      case "ReversePipeExpr":
        return this.visualizeReversePipe(expr);
      case "BidirectionalPipelineLiteral":
        return this.visualizeBidiPipeline(expr);
      case "MatchExpr":
        return this.visualizeMatch(expr);
      case "TemplateStringExpr":
        return this.visualizeTemplate(expr);
      case "PlaceholderExpr":
        return this.visualizePlaceholder();
      default:
        // Generic fallback
        const id = this.genId();
        return {
          nodes: [{ id, label: this.describeExpr(expr), type: "operation" }],
          edges: [],
          subgraphs: [],
          entryNode: id,
          exitNode: id,
        };
    }
  }

  private visualizeLiteral(expr: NumberLiteral | StringLiteral | BooleanLiteral): VisualizationResult {
    const id = this.genId("lit");
    let label: string;
    if (expr.kind === "NumberLiteral") {
      label = String(expr.value);
    } else if (expr.kind === "StringLiteral") {
      label = `"${expr.value}"`;
    } else {
      label = String(expr.value);
    }
    return {
      nodes: [{ id, label, type: "data" }],
      edges: [],
      subgraphs: [],
      entryNode: id,
      exitNode: id,
    };
  }

  private visualizeIdentifier(expr: Identifier): VisualizationResult {
    const id = this.genId("id");
    return {
      nodes: [{ id, label: expr.name, type: "data" }],
      edges: [],
      subgraphs: [],
      entryNode: id,
      exitNode: id,
    };
  }

  private visualizePipe(expr: PipeExpr): VisualizationResult {
    const nodes: MermaidNode[] = [];
    const edges: MermaidEdge[] = [];
    const subgraphs: MermaidSubgraph[] = [];

    // Flatten pipe chain
    const chain = this.flattenPipeChain(expr);

    let prevExit: string | undefined;

    for (const stage of chain) {
      const result = this.visualizeExpr(stage);
      nodes.push(...result.nodes);
      edges.push(...result.edges);
      subgraphs.push(...result.subgraphs);

      if (prevExit && result.entryNode) {
        edges.push({ from: prevExit, to: result.entryNode });
      }

      prevExit = result.exitNode;
    }

    return {
      nodes,
      edges,
      subgraphs,
      entryNode: nodes.length > 0 ? nodes[0].id : undefined,
      exitNode: prevExit,
    };
  }

  /**
   * Flatten a chain of pipe expressions into an array
   */
  private flattenPipeChain(expr: Expr): Expr[] {
    const chain: Expr[] = [];
    let current: Expr = expr;

    while (current.kind === "PipeExpr") {
      const pipe = current as PipeExpr;
      // If left is also a pipe, recurse
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

  private visualizeParallelPipe(expr: ParallelPipeExpr): VisualizationResult {
    const nodes: MermaidNode[] = [];
    const edges: MermaidEdge[] = [];
    const subgraphs: MermaidSubgraph[] = [];

    // Input node
    const inputResult = this.visualizeExpr(expr.input);
    nodes.push(...inputResult.nodes);
    edges.push(...inputResult.edges);
    subgraphs.push(...inputResult.subgraphs);

    // Fan-out node
    const fanoutId = this.genId("fanout");
    nodes.push({ id: fanoutId, label: "fan-out", type: "fanout" });
    if (inputResult.exitNode) {
      edges.push({ from: inputResult.exitNode, to: fanoutId });
    }

    // Process each branch
    const branchExits: string[] = [];
    for (let i = 0; i < expr.branches.length; i++) {
      const branch = expr.branches[i];
      const branchResult = this.visualizeExpr(branch);

      // Create subgraph for branch
      const branchSubgraph: MermaidSubgraph = {
        id: this.genId("branch"),
        label: `Branch ${i + 1}`,
        nodes: branchResult.nodes,
        edges: branchResult.edges,
        subgraphs: branchResult.subgraphs,
      };
      subgraphs.push(branchSubgraph);

      if (branchResult.entryNode) {
        edges.push({ from: fanoutId, to: branchResult.entryNode });
      }
      if (branchResult.exitNode) {
        branchExits.push(branchResult.exitNode);
      }
    }

    // Fan-in node
    const faninId = this.genId("fanin");
    nodes.push({ id: faninId, label: "fan-in", type: "fanin" });
    for (const exit of branchExits) {
      edges.push({ from: exit, to: faninId });
    }

    return {
      nodes,
      edges,
      subgraphs,
      entryNode: inputResult.entryNode || fanoutId,
      exitNode: faninId,
    };
  }

  private visualizeCall(expr: CallExpr): VisualizationResult {
    const id = this.genId("call");
    let label: string;

    if (expr.callee.kind === "Identifier") {
      const argLabels = expr.args.map(a => this.describeExpr(a)).join(", ");
      label = `${expr.callee.name}(${argLabels})`;
    } else if (expr.callee.kind === "MemberExpr") {
      const member = expr.callee as MemberExpr;
      const objLabel = this.describeExpr(member.object);
      const argLabels = expr.args.map(a => this.describeExpr(a)).join(", ");
      label = `${objLabel}.${member.member}(${argLabels})`;
    } else {
      label = "call(...)";
    }

    return {
      nodes: [{ id, label, type: "operation" }],
      edges: [],
      subgraphs: [],
      entryNode: id,
      exitNode: id,
    };
  }

  private visualizeFunction(expr: FunctionExpr): VisualizationResult {
    const id = this.genId("fn");
    const params = expr.params.map(p => p.name).join(", ");
    let label = `(${params}) -> ...`;

    if (this.options.showDecorators && expr.decorators.length > 0) {
      const decorators = expr.decorators.map(d => `#${d.name}`).join(" ");
      label = `${label} ${decorators}`;
    }

    return {
      nodes: [{ id, label, type: "operation" }],
      edges: [],
      subgraphs: [],
      entryNode: id,
      exitNode: id,
    };
  }

  private visualizeList(expr: ListExpr): VisualizationResult {
    const id = this.genId("list");
    const items = expr.elements.length <= 3
      ? expr.elements.map(e => this.describeExpr(e)).join(", ")
      : `${expr.elements.length} items`;
    return {
      nodes: [{ id, label: `[${items}]`, type: "data" }],
      edges: [],
      subgraphs: [],
      entryNode: id,
      exitNode: id,
    };
  }

  private visualizeRecord(expr: RecordExpr): VisualizationResult {
    const id = this.genId("rec");
    const fields = expr.fields.length <= 3
      ? expr.fields.map(f => f.key).join(", ")
      : `${expr.fields.length} fields`;
    return {
      nodes: [{ id, label: `{${fields}}`, type: "data" }],
      edges: [],
      subgraphs: [],
      entryNode: id,
      exitNode: id,
    };
  }

  private visualizeTuple(expr: TupleExpr): VisualizationResult {
    const id = this.genId("tuple");
    const items = expr.elements.length <= 3
      ? expr.elements.map(e => this.describeExpr(e)).join(", ")
      : `${expr.elements.length} elements`;
    return {
      nodes: [{ id, label: `(${items})`, type: "data" }],
      edges: [],
      subgraphs: [],
      entryNode: id,
      exitNode: id,
    };
  }

  private visualizeBinary(expr: BinaryExpr): VisualizationResult {
    const id = this.genId("op");
    const left = this.describeExpr(expr.left);
    const right = this.describeExpr(expr.right);
    const op = expr.operator.lexeme;
    return {
      nodes: [{ id, label: `${left} ${op} ${right}`, type: "operation" }],
      edges: [],
      subgraphs: [],
      entryNode: id,
      exitNode: id,
    };
  }

  private visualizeUnary(expr: UnaryExpr): VisualizationResult {
    const id = this.genId("op");
    const operand = this.describeExpr(expr.operand);
    const op = expr.operator.lexeme;
    return {
      nodes: [{ id, label: `${op}${operand}`, type: "operation" }],
      edges: [],
      subgraphs: [],
      entryNode: id,
      exitNode: id,
    };
  }

  private visualizeTernary(expr: TernaryExpr): VisualizationResult {
    const nodes: MermaidNode[] = [];
    const edges: MermaidEdge[] = [];
    const subgraphs: MermaidSubgraph[] = [];

    // Condition node
    const condId = this.genId("cond");
    const condLabel = this.describeExpr(expr.condition);
    nodes.push({ id: condId, label: condLabel, type: "condition" });

    // Then branch
    const thenResult = this.visualizeExpr(expr.thenBranch);
    nodes.push(...thenResult.nodes);
    edges.push(...thenResult.edges);
    subgraphs.push(...thenResult.subgraphs);
    if (thenResult.entryNode) {
      edges.push({ from: condId, to: thenResult.entryNode, label: "true" });
    }

    // Else branch
    const elseResult = this.visualizeExpr(expr.elseBranch);
    nodes.push(...elseResult.nodes);
    edges.push(...elseResult.edges);
    subgraphs.push(...elseResult.subgraphs);
    if (elseResult.entryNode) {
      edges.push({ from: condId, to: elseResult.entryNode, label: "false" });
    }

    // Merge node
    const mergeId = this.genId("merge");
    nodes.push({ id: mergeId, label: "merge", type: "fanin" });
    if (thenResult.exitNode) {
      edges.push({ from: thenResult.exitNode, to: mergeId });
    }
    if (elseResult.exitNode) {
      edges.push({ from: elseResult.exitNode, to: mergeId });
    }

    return {
      nodes,
      edges,
      subgraphs,
      entryNode: condId,
      exitNode: mergeId,
    };
  }

  private visualizeAwait(expr: AwaitExpr): VisualizationResult {
    const nodes: MermaidNode[] = [];
    const edges: MermaidEdge[] = [];

    const operandResult = this.visualizeExpr(expr.operand);
    nodes.push(...operandResult.nodes);
    edges.push(...operandResult.edges);

    const awaitId = this.genId("await");
    nodes.push({ id: awaitId, label: "await", type: "await" });

    if (operandResult.exitNode) {
      edges.push({ from: operandResult.exitNode, to: awaitId });
    }

    return {
      nodes,
      edges,
      subgraphs: operandResult.subgraphs,
      entryNode: operandResult.entryNode || awaitId,
      exitNode: awaitId,
    };
  }

  private visualizeReturn(expr: ReturnExpr): VisualizationResult {
    const nodes: MermaidNode[] = [];
    const edges: MermaidEdge[] = [];

    const valueResult = this.visualizeExpr(expr.value);
    nodes.push(...valueResult.nodes);
    edges.push(...valueResult.edges);

    const returnId = this.genId("ret");
    nodes.push({ id: returnId, label: "return", type: "return" });

    if (valueResult.exitNode) {
      edges.push({ from: valueResult.exitNode, to: returnId });
    }

    return {
      nodes,
      edges,
      subgraphs: valueResult.subgraphs,
      entryNode: valueResult.entryNode || returnId,
      exitNode: returnId,
    };
  }

  private visualizeMember(expr: MemberExpr): VisualizationResult {
    const id = this.genId("mem");
    const obj = this.describeExpr(expr.object);
    return {
      nodes: [{ id, label: `${obj}.${expr.member}`, type: "operation" }],
      edges: [],
      subgraphs: [],
      entryNode: id,
      exitNode: id,
    };
  }

  private visualizeIndex(expr: IndexExpr): VisualizationResult {
    const id = this.genId("idx");
    const obj = this.describeExpr(expr.object);
    const idx = this.describeExpr(expr.index);
    return {
      nodes: [{ id, label: `${obj}[${idx}]`, type: "operation" }],
      edges: [],
      subgraphs: [],
      entryNode: id,
      exitNode: id,
    };
  }

  private visualizePipelineLiteral(expr: PipelineLiteral): VisualizationResult {
    const nodes: MermaidNode[] = [];
    const edges: MermaidEdge[] = [];
    const subgraphs: MermaidSubgraph[] = [];

    // Pipeline entry node
    const entryId = this.genId("pipe_entry");
    nodes.push({ id: entryId, label: "pipeline", type: "pipeline" });

    let prevExit = entryId;

    for (const stage of expr.stages) {
      if ("isParallel" in stage && stage.isParallel) {
        // Parallel stage within pipeline
        const fanoutId = this.genId("fanout");
        nodes.push({ id: fanoutId, label: "fan-out", type: "fanout" });
        edges.push({ from: prevExit, to: fanoutId });

        const branchExits: string[] = [];
        for (let i = 0; i < stage.branches.length; i++) {
          const branchResult = this.visualizeExpr(stage.branches[i]);
          nodes.push(...branchResult.nodes);
          edges.push(...branchResult.edges);
          subgraphs.push(...branchResult.subgraphs);

          if (branchResult.entryNode) {
            edges.push({ from: fanoutId, to: branchResult.entryNode });
          }
          if (branchResult.exitNode) {
            branchExits.push(branchResult.exitNode);
          }
        }

        const faninId = this.genId("fanin");
        nodes.push({ id: faninId, label: "fan-in", type: "fanin" });
        for (const exit of branchExits) {
          edges.push({ from: exit, to: faninId });
        }
        prevExit = faninId;
      } else {
        // Regular stage
        const stageResult = this.visualizeExpr(stage.expr);
        nodes.push(...stageResult.nodes);
        edges.push(...stageResult.edges);
        subgraphs.push(...stageResult.subgraphs);

        if (stageResult.entryNode) {
          edges.push({ from: prevExit, to: stageResult.entryNode });
        }
        if (stageResult.exitNode) {
          prevExit = stageResult.exitNode;
        }
      }
    }

    return {
      nodes,
      edges,
      subgraphs,
      entryNode: entryId,
      exitNode: prevExit,
    };
  }

  private visualizeReversePipe(expr: ReversePipeExpr): VisualizationResult {
    const nodes: MermaidNode[] = [];
    const edges: MermaidEdge[] = [];
    const subgraphs: MermaidSubgraph[] = [];

    // Value node
    const valueResult = this.visualizeExpr(expr.right);
    nodes.push(...valueResult.nodes);
    edges.push(...valueResult.edges);
    subgraphs.push(...valueResult.subgraphs);

    // Reverse indicator
    const revId = this.genId("rev");
    nodes.push({ id: revId, label: "reverse", type: "operation" });
    if (valueResult.exitNode) {
      edges.push({ from: valueResult.exitNode, to: revId });
    }

    // Pipeline/function
    const pipeResult = this.visualizeExpr(expr.left);
    nodes.push(...pipeResult.nodes);
    edges.push(...pipeResult.edges);
    subgraphs.push(...pipeResult.subgraphs);

    if (pipeResult.entryNode) {
      edges.push({ from: revId, to: pipeResult.entryNode });
    }

    return {
      nodes,
      edges,
      subgraphs,
      entryNode: valueResult.entryNode || revId,
      exitNode: pipeResult.exitNode || revId,
    };
  }

  private visualizeBidiPipeline(expr: BidirectionalPipelineLiteral): VisualizationResult {
    const nodes: MermaidNode[] = [];
    const edges: MermaidEdge[] = [];
    const subgraphs: MermaidSubgraph[] = [];

    const entryId = this.genId("bidi");
    nodes.push({ id: entryId, label: "bidirectional", type: "pipeline" });

    let prevExit = entryId;

    for (const stage of expr.stages) {
      const stageResult = this.visualizeExpr(stage.expr);
      nodes.push(...stageResult.nodes);
      edges.push(...stageResult.edges);
      subgraphs.push(...stageResult.subgraphs);

      if (stageResult.entryNode) {
        edges.push({ from: prevExit, to: stageResult.entryNode });
      }
      if (stageResult.exitNode) {
        prevExit = stageResult.exitNode;
      }
    }

    return {
      nodes,
      edges,
      subgraphs,
      entryNode: entryId,
      exitNode: prevExit,
    };
  }

  private visualizeMatch(expr: MatchExpr): VisualizationResult {
    const nodes: MermaidNode[] = [];
    const edges: MermaidEdge[] = [];
    const subgraphs: MermaidSubgraph[] = [];

    // Match expression entry
    const matchId = this.genId("match");
    const matchLabel = `match ${this.describeExpr(expr.value)}`;
    nodes.push({ id: matchId, label: matchLabel, type: "match" });

    // Case exits for merge
    const caseExits: string[] = [];

    for (let i = 0; i < expr.cases.length; i++) {
      const c = expr.cases[i];

      // Case condition node
      const caseId = this.genId("case");
      let caseLabel: string;
      if (c.pattern) {
        caseLabel = `| ${this.describeExpr(c.pattern)}`;
      } else if (c.guard) {
        caseLabel = `| if ${this.describeExpr(c.guard)}`;
      } else {
        caseLabel = "| default";
      }
      nodes.push({ id: caseId, label: caseLabel, type: "condition" });
      edges.push({ from: matchId, to: caseId, label: `case ${i + 1}` });

      // Case body
      const bodyResult = this.visualizeExpr(c.body);
      nodes.push(...bodyResult.nodes);
      edges.push(...bodyResult.edges);
      subgraphs.push(...bodyResult.subgraphs);

      if (bodyResult.entryNode) {
        edges.push({ from: caseId, to: bodyResult.entryNode });
      }
      if (bodyResult.exitNode) {
        caseExits.push(bodyResult.exitNode);
      }
    }

    // Merge node
    const mergeId = this.genId("merge");
    nodes.push({ id: mergeId, label: "end match", type: "fanin" });
    for (const exit of caseExits) {
      edges.push({ from: exit, to: mergeId });
    }

    return {
      nodes,
      edges,
      subgraphs,
      entryNode: matchId,
      exitNode: mergeId,
    };
  }

  private visualizeTemplate(expr: TemplateStringExpr): VisualizationResult {
    const id = this.genId("tpl");
    // Just show a simplified representation
    const hasExprs = expr.parts.some(p => typeof p !== "string");
    const label = hasExprs ? "template string" : `\`${expr.parts.join("")}\``;
    return {
      nodes: [{ id, label, type: "data" }],
      edges: [],
      subgraphs: [],
      entryNode: id,
      exitNode: id,
    };
  }

  private visualizePlaceholder(): VisualizationResult {
    const id = this.genId("ph");
    return {
      nodes: [{ id, label: "_", type: "data" }],
      edges: [],
      subgraphs: [],
      entryNode: id,
      exitNode: id,
    };
  }

  /**
   * Visualize a statement
   */
  private visualizeStmt(stmt: Stmt): VisualizationResult {
    switch (stmt.kind) {
      case "LetStmt":
        return this.visualizeLetStmt(stmt);
      case "ExprStmt":
        return this.visualizeExpr(stmt.expression);
      case "CodeblockStmt":
        return this.visualizeCodeblock(stmt);
      default:
        // Context, Provide, Decorator statements
        return { nodes: [], edges: [], subgraphs: [] };
    }
  }

  private visualizeLetStmt(stmt: LetStmt): VisualizationResult {
    const nodes: MermaidNode[] = [];
    const edges: MermaidEdge[] = [];
    const subgraphs: MermaidSubgraph[] = [];

    // Check if the value contains pipes (interesting to visualize)
    const hasPipes = this.containsPipes(stmt.value);

    if (hasPipes) {
      // Create a subgraph for this binding
      const valueResult = this.visualizeExpr(stmt.value);

      const bindingId = this.genId("bind");
      const mutLabel = stmt.mutable ? "maybe" : "let";
      nodes.push({ id: bindingId, label: `${mutLabel} ${stmt.name}`, type: "binding" });

      if (valueResult.exitNode) {
        edges.push({ from: valueResult.exitNode, to: bindingId });
      }

      const subgraph: MermaidSubgraph = {
        id: this.genId("let"),
        label: stmt.name,
        nodes: valueResult.nodes,
        edges: valueResult.edges,
        subgraphs: valueResult.subgraphs,
      };
      subgraphs.push(subgraph);

      return {
        nodes,
        edges,
        subgraphs,
        entryNode: valueResult.entryNode,
        exitNode: bindingId,
      };
    } else {
      // Simple binding, just show as a single node
      const id = this.genId("let");
      const mutLabel = stmt.mutable ? "maybe" : "let";
      const valueLabel = this.describeExpr(stmt.value);
      return {
        nodes: [{ id, label: `${mutLabel} ${stmt.name} = ${valueLabel}`, type: "binding" }],
        edges: [],
        subgraphs: [],
        entryNode: id,
        exitNode: id,
      };
    }
  }

  private visualizeCodeblock(stmt: CodeblockStmt): VisualizationResult {
    const nodes: MermaidNode[] = [];
    const edges: MermaidEdge[] = [];
    const subgraphs: MermaidSubgraph[] = [];

    const innerNodes: MermaidNode[] = [];
    const innerEdges: MermaidEdge[] = [];
    const innerSubgraphs: MermaidSubgraph[] = [];

    let firstEntry: string | undefined;
    let prevExit: string | undefined;

    for (const s of stmt.statements) {
      const result = this.visualizeStmt(s);
      innerNodes.push(...result.nodes);
      innerEdges.push(...result.edges);
      innerSubgraphs.push(...result.subgraphs);

      if (!firstEntry && result.entryNode) {
        firstEntry = result.entryNode;
      }
      if (prevExit && result.entryNode) {
        innerEdges.push({ from: prevExit, to: result.entryNode });
      }
      if (result.exitNode) {
        prevExit = result.exitNode;
      }
    }

    const subgraph: MermaidSubgraph = {
      id: this.genId("block"),
      label: stmt.label || "codeblock",
      nodes: innerNodes,
      edges: innerEdges,
      subgraphs: innerSubgraphs,
    };
    subgraphs.push(subgraph);

    return {
      nodes,
      edges,
      subgraphs,
      entryNode: firstEntry,
      exitNode: prevExit,
    };
  }

  /**
   * Check if an expression contains pipe operations
   */
  private containsPipes(expr: Expr): boolean {
    switch (expr.kind) {
      case "PipeExpr":
      case "ParallelPipeExpr":
      case "ReversePipeExpr":
        return true;
      case "PipelineLiteral":
      case "BidirectionalPipelineLiteral":
        return true;
      case "CallExpr":
        return expr.args.some(a => this.containsPipes(a)) || this.containsPipes(expr.callee);
      case "BinaryExpr":
        return this.containsPipes(expr.left) || this.containsPipes(expr.right);
      case "UnaryExpr":
        return this.containsPipes(expr.operand);
      case "TernaryExpr":
        return this.containsPipes(expr.condition) ||
               this.containsPipes(expr.thenBranch) ||
               this.containsPipes(expr.elseBranch);
      case "ListExpr":
        return expr.elements.some(e => this.containsPipes(e));
      case "RecordExpr":
        return expr.fields.some(f => this.containsPipes(f.value));
      case "TupleExpr":
        return expr.elements.some(e => this.containsPipes(e));
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
      case "MemberExpr":
        return this.containsPipes(expr.object);
      case "IndexExpr":
        return this.containsPipes(expr.object) || this.containsPipes(expr.index);
      case "MatchExpr":
        return this.containsPipes(expr.value) ||
               expr.cases.some(c => this.containsPipes(c.body));
      default:
        return false;
    }
  }

  /**
   * Visualize a complete program
   */
  visualizeProgram(program: Program): VisualizationResult {
    const nodes: MermaidNode[] = [];
    const edges: MermaidEdge[] = [];
    const subgraphs: MermaidSubgraph[] = [];

    let firstEntry: string | undefined;
    let prevExit: string | undefined;

    for (const stmt of program.statements) {
      // Skip statements without pipes for cleaner diagrams
      if (stmt.kind === "LetStmt" && !this.containsPipes(stmt.value)) {
        continue;
      }
      if (stmt.kind === "ExprStmt" && !this.containsPipes(stmt.expression)) {
        continue;
      }
      if (stmt.kind === "ContextDefStmt" || stmt.kind === "ProvideStmt" || stmt.kind === "DecoratorDefStmt") {
        continue;
      }

      const result = this.visualizeStmt(stmt);

      // Add to nodes/edges
      nodes.push(...result.nodes);
      edges.push(...result.edges);
      subgraphs.push(...result.subgraphs);

      if (!firstEntry && result.entryNode) {
        firstEntry = result.entryNode;
      }

      // Connect sequential statements
      if (prevExit && result.entryNode) {
        edges.push({ from: prevExit, to: result.entryNode, label: "then" });
      }

      prevExit = result.exitNode;
    }

    return {
      nodes,
      edges,
      subgraphs,
      entryNode: firstEntry,
      exitNode: prevExit,
    };
  }

  /**
   * Generate Mermaid markdown from visualization result
   */
  generateMermaid(result: VisualizationResult): string {
    const lines: string[] = [];
    const direction = this.options.direction || "LR";

    lines.push(`flowchart ${direction}`);
    lines.push("");

    // Add style classes
    lines.push("    %% Style definitions");
    lines.push("    classDef data fill:#9b59b6,stroke:#8e44ad,color:white");
    lines.push("    classDef operation fill:#3498db,stroke:#2980b9,color:white");
    lines.push("    classDef fanout fill:#e67e22,stroke:#d35400,color:white");
    lines.push("    classDef fanin fill:#e67e22,stroke:#d35400,color:white");
    lines.push("    classDef await fill:#27ae60,stroke:#1e8449,color:white");
    lines.push("    classDef return fill:#27ae60,stroke:#1e8449,color:white");
    lines.push("    classDef binding fill:#95a5a6,stroke:#7f8c8d,color:white");
    lines.push("    classDef pipeline fill:#9b59b6,stroke:#8e44ad,color:white");
    lines.push("    classDef match fill:#9b59b6,stroke:#8e44ad,color:white");
    lines.push("    classDef condition fill:#f39c12,stroke:#e67e22,color:white");
    lines.push("");

    // Render subgraphs recursively
    const renderSubgraph = (sg: MermaidSubgraph, indent = "    "): void => {
      lines.push(`${indent}subgraph ${sg.id}["${this.escape(sg.label)}"]`);

      // Nodes
      for (const node of sg.nodes) {
        lines.push(`${indent}${this.formatNode(node)}`);
      }

      // Nested subgraphs
      for (const nested of sg.subgraphs) {
        renderSubgraph(nested, indent + "    ");
      }

      lines.push(`${indent}end`);

      // Edges (after subgraph end)
      for (const edge of sg.edges) {
        lines.push(`${indent}${this.formatEdge(edge)}`);
      }
    };

    // Render top-level subgraphs
    for (const sg of result.subgraphs) {
      renderSubgraph(sg);
      lines.push("");
    }

    // Render top-level nodes
    for (const node of result.nodes) {
      lines.push(this.formatNode(node));
    }

    lines.push("");

    // Render top-level edges
    for (const edge of result.edges) {
      lines.push(this.formatEdge(edge));
    }

    lines.push("");

    // Apply style classes
    const nodesByType = new Map<NodeType, string[]>();
    const collectNodes = (ns: MermaidNode[]): void => {
      for (const n of ns) {
        if (!nodesByType.has(n.type)) {
          nodesByType.set(n.type, []);
        }
        nodesByType.get(n.type)!.push(n.id);
      }
    };

    collectNodes(result.nodes);
    const collectFromSubgraphs = (sgs: MermaidSubgraph[]): void => {
      for (const sg of sgs) {
        collectNodes(sg.nodes);
        collectFromSubgraphs(sg.subgraphs);
      }
    };
    collectFromSubgraphs(result.subgraphs);

    for (const [type, ids] of nodesByType) {
      if (ids.length > 0) {
        lines.push(`    class ${ids.join(",")} ${type}`);
      }
    }

    return lines.join("\n");
  }
}

/**
 * Generate HTML with embedded Mermaid diagram
 */
export function generateHTML(mermaidCode: string, title = "Lea Flow Visualization"): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #1a1a2e;
            color: #eee;
        }
        h1 {
            color: #9b59b6;
            margin-bottom: 10px;
        }
        .controls {
            margin-bottom: 20px;
        }
        button {
            background: #3498db;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            margin-right: 10px;
        }
        button:hover {
            background: #2980b9;
        }
        .mermaid {
            background: white;
            padding: 20px;
            border-radius: 10px;
        }
        .legend {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
            margin-top: 20px;
            padding: 10px;
            background: #16213e;
            border-radius: 5px;
        }
        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .legend-color {
            width: 20px;
            height: 20px;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <h1>${title}</h1>
    <div class="controls">
        <button onclick="downloadSVG()">Download SVG</button>
    </div>
    <div class="mermaid">
${mermaidCode}
    </div>
    <div class="legend">
        <div class="legend-item">
            <div class="legend-color" style="background: #9b59b6;"></div>
            <span>Data Values</span>
        </div>
        <div class="legend-item">
            <div class="legend-color" style="background: #3498db;"></div>
            <span>Operations</span>
        </div>
        <div class="legend-item">
            <div class="legend-color" style="background: #e67e22;"></div>
            <span>Fan-out/Fan-in</span>
        </div>
        <div class="legend-item">
            <div class="legend-color" style="background: #27ae60;"></div>
            <span>Await/Return</span>
        </div>
        <div class="legend-item">
            <div class="legend-color" style="background: #f39c12;"></div>
            <span>Conditionals</span>
        </div>
    </div>
    <script>
        mermaid.initialize({
            startOnLoad: true,
            theme: 'default',
            securityLevel: 'loose',
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'basis'
            }
        });

        function downloadSVG() {
            const svg = document.querySelector('.mermaid svg');
            if (!svg) {
                alert('Diagram not ready yet');
                return;
            }
            const svgData = new XMLSerializer().serializeToString(svg);
            const blob = new Blob([svgData], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'lea-flow.svg';
            a.click();
            URL.revokeObjectURL(url);
        }
    </script>
</body>
</html>`;
}

/**
 * Main function to visualize a Lea program
 */
export function visualizeProgram(
  program: Program,
  options: VisualizerOptions = {}
): string {
  const visualizer = new ASTVisualizer(options);
  const result = visualizer.visualizeProgram(program);
  return visualizer.generateMermaid(result);
}

/**
 * AST to Mermaid Flowchart Generator
 *
 * Generates Mermaid diagrams showing data flow through Lea programs,
 * with special handling for pipe chains and parallel execution.
 */

import {
  Program,
  Stmt,
  Expr,
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
  BinaryExpr,
  TernaryExpr,
  MemberExpr,
  IndexExpr,
  TupleExpr,
  AwaitExpr,
  BlockBody,
} from "./ast";

// ============================================
// Types
// ============================================

interface MermaidNode {
  id: string;
  label: string;
  shape: "stadium" | "parallelogram" | "diamond" | "subroutine" | "rect" | "circle";
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
}

interface VisualizerContext {
  nodeCounter: number;
  nodes: MermaidNode[];
  edges: MermaidEdge[];
  subgraphs: MermaidSubgraph[];
  direction: "LR" | "TB";
}

export interface VisualizerOptions {
  /** Direction of the flowchart: LR (left-right) or TB (top-bottom) */
  direction?: "LR" | "TB";
  /** Include variable bindings in the diagram */
  includeBindings?: boolean;
  /** Show function bodies as subgraphs */
  expandFunctions?: boolean;
  /** Maximum string length before truncation */
  maxLabelLength?: number;
}

// ============================================
// Main Entry Points
// ============================================

/**
 * Generate a Mermaid flowchart from a Lea program AST
 */
export function generateFlowchart(program: Program, options: VisualizerOptions = {}): string {
  const ctx = createContext(options);

  // Find all pipe expressions and visualize them
  const pipeChains = extractPipeChains(program);

  if (pipeChains.length === 0) {
    return "flowchart " + ctx.direction + "\n    empty[No pipe chains found]";
  }

  // Process each pipe chain
  pipeChains.forEach((chain, index) => {
    visualizePipeChain(chain.expr, chain.name, ctx, options);
  });

  return renderMermaid(ctx);
}

/**
 * Generate a Mermaid flowchart from a single expression
 */
export function generateExprFlowchart(expr: Expr, options: VisualizerOptions = {}): string {
  const ctx = createContext(options);
  visualizeExpr(expr, ctx, options);
  return renderMermaid(ctx);
}

/**
 * Generate HTML with embedded Mermaid diagram
 */
export function generateHTML(program: Program, options: VisualizerOptions = {}): string {
  const mermaidCode = generateFlowchart(program, options);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lea Pipeline Visualization</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background: #1a1a2e;
      color: #eee;
    }
    h1 {
      margin-bottom: 20px;
      color: #a855f7;
    }
    .mermaid {
      background: #16213e;
      padding: 20px;
      border-radius: 8px;
      overflow: auto;
    }
    .controls {
      margin-bottom: 20px;
    }
    button {
      background: #a855f7;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      margin-right: 8px;
    }
    button:hover {
      background: #9333ea;
    }
    pre {
      background: #16213e;
      padding: 16px;
      border-radius: 8px;
      overflow: auto;
      font-size: 12px;
    }
    .source-toggle {
      margin-top: 20px;
    }
    #source {
      display: none;
    }
  </style>
</head>
<body>
  <h1>Lea Pipeline Visualization</h1>

  <div class="controls">
    <button onclick="toggleSource()">Toggle Mermaid Source</button>
    <button onclick="downloadSVG()">Download SVG</button>
  </div>

  <div class="mermaid">
${mermaidCode}
  </div>

  <div class="source-toggle">
    <pre id="source">${escapeHtml(mermaidCode)}</pre>
  </div>

  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
      }
    });

    function toggleSource() {
      const source = document.getElementById('source');
      source.style.display = source.style.display === 'none' ? 'block' : 'none';
    }

    function downloadSVG() {
      const svg = document.querySelector('.mermaid svg');
      if (svg) {
        const data = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([data], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'lea-pipeline.svg';
        a.click();
        URL.revokeObjectURL(url);
      }
    }
  </script>
</body>
</html>`;
}

// ============================================
// Context Management
// ============================================

function createContext(options: VisualizerOptions): VisualizerContext {
  return {
    nodeCounter: 0,
    nodes: [],
    edges: [],
    subgraphs: [],
    direction: options.direction || "LR",
  };
}

function nextNodeId(ctx: VisualizerContext): string {
  return `n${ctx.nodeCounter++}`;
}

// ============================================
// AST Extraction
// ============================================

interface PipeChainInfo {
  name: string | null;
  expr: Expr;
}

/**
 * Extract all pipe chains from the program, associating them with variable names if bound
 */
function extractPipeChains(program: Program): PipeChainInfo[] {
  const chains: PipeChainInfo[] = [];

  for (const stmt of program.statements) {
    if (stmt.kind === "LetStmt") {
      if (containsPipe(stmt.value)) {
        chains.push({ name: stmt.name, expr: stmt.value });
      }
    } else if (stmt.kind === "ExprStmt") {
      if (containsPipe(stmt.expression)) {
        chains.push({ name: null, expr: stmt.expression });
      }
    } else if (stmt.kind === "CodeblockStmt") {
      // Recurse into codeblocks
      const innerChains = extractPipeChains({ kind: "Program", statements: stmt.statements });
      chains.push(...innerChains);
    }
  }

  return chains;
}

function containsPipe(expr: Expr): boolean {
  switch (expr.kind) {
    case "PipeExpr":
    case "ParallelPipeExpr":
      return true;
    case "BinaryExpr":
      return containsPipe(expr.left) || containsPipe(expr.right);
    case "CallExpr":
      return containsPipe(expr.callee) || expr.args.some(containsPipe);
    case "TernaryExpr":
      return containsPipe(expr.condition) || containsPipe(expr.thenBranch) || containsPipe(expr.elseBranch);
    default:
      return false;
  }
}

// ============================================
// Visualization Logic
// ============================================

function visualizePipeChain(
  expr: Expr,
  name: string | null,
  ctx: VisualizerContext,
  options: VisualizerOptions
): string {
  // If this is part of a named binding, create a subgraph
  if (name) {
    const subgraph: MermaidSubgraph = {
      id: `sg_${name}`,
      label: name,
      nodes: [],
      edges: [],
    };

    const subCtx: VisualizerContext = {
      ...ctx,
      nodes: subgraph.nodes,
      edges: subgraph.edges,
      subgraphs: [],
    };

    const resultId = visualizeExpr(expr, subCtx, options);
    ctx.subgraphs.push(subgraph);
    ctx.nodeCounter = subCtx.nodeCounter;

    return resultId;
  } else {
    return visualizeExpr(expr, ctx, options);
  }
}

function visualizeExpr(expr: Expr, ctx: VisualizerContext, options: VisualizerOptions): string {
  switch (expr.kind) {
    case "PipeExpr":
      return visualizePipe(expr, ctx, options);

    case "ParallelPipeExpr":
      return visualizeParallelPipe(expr, ctx, options);

    case "CallExpr":
      return visualizeCall(expr, ctx, options);

    case "Identifier":
      return addNode(ctx, expr.name, "stadium");

    case "NumberLiteral":
      return addNode(ctx, String(expr.value), "stadium");

    case "StringLiteral":
      return addNode(ctx, truncateLabel(`"${expr.value}"`, options.maxLabelLength), "stadium");

    case "BooleanLiteral":
      return addNode(ctx, String(expr.value), "stadium");

    case "ListExpr":
      return visualizeList(expr, ctx, options);

    case "RecordExpr":
      return visualizeRecord(expr, ctx, options);

    case "TupleExpr":
      return visualizeTuple(expr, ctx, options);

    case "FunctionExpr":
      return visualizeFunction(expr, ctx, options);

    case "BinaryExpr":
      return visualizeBinary(expr, ctx, options);

    case "TernaryExpr":
      return visualizeTernary(expr, ctx, options);

    case "MemberExpr":
      return visualizeMember(expr, ctx, options);

    case "IndexExpr":
      return visualizeIndex(expr, ctx, options);

    case "AwaitExpr":
      return visualizeAwait(expr, ctx, options);

    case "PlaceholderExpr":
      return addNode(ctx, "_", "circle");

    case "UnaryExpr":
      const operandId = visualizeExpr(expr.operand, ctx, options);
      const unaryId = addNode(ctx, expr.operator.lexeme, "parallelogram");
      addEdge(ctx, operandId, unaryId);
      return unaryId;

    case "ReturnExpr":
      const returnValueId = visualizeExpr(expr.value, ctx, options);
      const returnId = addNode(ctx, "return", "subroutine");
      addEdge(ctx, returnValueId, returnId, "←");
      return returnId;
  }
}

function visualizePipe(pipe: PipeExpr, ctx: VisualizerContext, options: VisualizerOptions): string {
  // Flatten the pipe chain
  const steps: Expr[] = flattenPipeChain(pipe);

  let prevId: string | null = null;

  for (const step of steps) {
    const stepId = visualizeExpr(step, ctx, options);

    if (prevId) {
      addEdge(ctx, prevId, stepId, "/>");
    }

    prevId = stepId;
  }

  return prevId!;
}

function flattenPipeChain(expr: Expr): Expr[] {
  if (expr.kind === "PipeExpr") {
    return [...flattenPipeChain(expr.left), ...flattenPipeChain(expr.right)];
  }
  return [expr];
}

function visualizeParallelPipe(
  parallel: ParallelPipeExpr,
  ctx: VisualizerContext,
  options: VisualizerOptions
): string {
  // Create input node
  const inputId = visualizeExpr(parallel.input, ctx, options);

  // Create fan-out diamond
  const fanOutId = addNode(ctx, "fan-out", "diamond");
  addEdge(ctx, inputId, fanOutId);

  // Create nodes for each branch
  const branchEndIds: string[] = [];

  for (let i = 0; i < parallel.branches.length; i++) {
    const branch = parallel.branches[i];
    const branchId = visualizeExpr(branch, ctx, options);
    addEdge(ctx, fanOutId, branchId, `\\> ${i + 1}`);
    branchEndIds.push(branchId);
  }

  // Create fan-in diamond
  const fanInId = addNode(ctx, "fan-in", "diamond");

  for (const branchId of branchEndIds) {
    addEdge(ctx, branchId, fanInId);
  }

  return fanInId;
}

function visualizeCall(call: CallExpr, ctx: VisualizerContext, options: VisualizerOptions): string {
  const calleeName = getCalleeName(call.callee);
  const argsPreview = call.args.map(arg => exprToShortString(arg, options)).join(", ");

  const label = argsPreview ? `${calleeName}(${argsPreview})` : calleeName;
  return addNode(ctx, truncateLabel(label, options.maxLabelLength), "parallelogram");
}

function visualizeList(list: ListExpr, ctx: VisualizerContext, options: VisualizerOptions): string {
  if (list.elements.length <= 5) {
    const preview = list.elements.map(e => exprToShortString(e, options)).join(", ");
    return addNode(ctx, truncateLabel(`[${preview}]`, options.maxLabelLength), "stadium");
  } else {
    return addNode(ctx, `[...${list.elements.length} items]`, "stadium");
  }
}

function visualizeRecord(record: RecordExpr, ctx: VisualizerContext, options: VisualizerOptions): string {
  if (record.fields.length <= 3) {
    const preview = record.fields.map(f => f.key).join(", ");
    return addNode(ctx, truncateLabel(`{${preview}}`, options.maxLabelLength), "stadium");
  } else {
    return addNode(ctx, `{...${record.fields.length} fields}`, "stadium");
  }
}

function visualizeTuple(tuple: TupleExpr, ctx: VisualizerContext, options: VisualizerOptions): string {
  const preview = tuple.elements.map(e => exprToShortString(e, options)).join(", ");
  return addNode(ctx, truncateLabel(`(${preview})`, options.maxLabelLength), "stadium");
}

function visualizeFunction(fn: FunctionExpr, ctx: VisualizerContext, options: VisualizerOptions): string {
  const params = fn.params.map(p => p.name).join(", ");
  const decorators = fn.decorators.length > 0
    ? " " + fn.decorators.map(d => `#${d.name}`).join(" ")
    : "";

  const label = `(${params}) ->${decorators}`;

  if (options.expandFunctions && fn.body.kind === "BlockBody") {
    // Create subgraph for function body
    const fnId = nextNodeId(ctx);
    const subgraph: MermaidSubgraph = {
      id: `fn_${fnId}`,
      label: label,
      nodes: [],
      edges: [],
    };
    ctx.subgraphs.push(subgraph);
    return fnId;
  }

  return addNode(ctx, truncateLabel(label, options.maxLabelLength), "parallelogram");
}

function visualizeBinary(binary: BinaryExpr, ctx: VisualizerContext, options: VisualizerOptions): string {
  const leftId = visualizeExpr(binary.left, ctx, options);
  const rightId = visualizeExpr(binary.right, ctx, options);
  const opId = addNode(ctx, binary.operator.lexeme, "circle");

  addEdge(ctx, leftId, opId);
  addEdge(ctx, rightId, opId);

  return opId;
}

function visualizeTernary(ternary: TernaryExpr, ctx: VisualizerContext, options: VisualizerOptions): string {
  const condId = visualizeExpr(ternary.condition, ctx, options);
  const condNode = addNode(ctx, "?", "diamond");
  addEdge(ctx, condId, condNode);

  const thenId = visualizeExpr(ternary.thenBranch, ctx, options);
  const elseId = visualizeExpr(ternary.elseBranch, ctx, options);

  addEdge(ctx, condNode, thenId, "true");
  addEdge(ctx, condNode, elseId, "false");

  // Create merge node
  const mergeId = addNode(ctx, "merge", "circle");
  addEdge(ctx, thenId, mergeId);
  addEdge(ctx, elseId, mergeId);

  return mergeId;
}

function visualizeMember(member: MemberExpr, ctx: VisualizerContext, options: VisualizerOptions): string {
  const objId = visualizeExpr(member.object, ctx, options);
  const accessId = addNode(ctx, `.${member.member}`, "parallelogram");
  addEdge(ctx, objId, accessId);
  return accessId;
}

function visualizeIndex(index: IndexExpr, ctx: VisualizerContext, options: VisualizerOptions): string {
  const objId = visualizeExpr(index.object, ctx, options);
  const indexStr = exprToShortString(index.index, options);
  const accessId = addNode(ctx, `[${indexStr}]`, "parallelogram");
  addEdge(ctx, objId, accessId);
  return accessId;
}

function visualizeAwait(awaitExpr: AwaitExpr, ctx: VisualizerContext, options: VisualizerOptions): string {
  const operandId = visualizeExpr(awaitExpr.operand, ctx, options);
  const awaitId = addNode(ctx, "await", "subroutine");
  addEdge(ctx, operandId, awaitId);
  return awaitId;
}

// ============================================
// Helper Functions
// ============================================

function addNode(ctx: VisualizerContext, label: string, shape: MermaidNode["shape"]): string {
  const id = nextNodeId(ctx);
  ctx.nodes.push({ id, label: sanitizeLabel(label), shape });
  return id;
}

function addEdge(ctx: VisualizerContext, from: string, to: string, label?: string): void {
  ctx.edges.push({ from, to, label: label ? sanitizeLabel(label) : undefined });
}

function getCalleeName(callee: Expr): string {
  if (callee.kind === "Identifier") {
    return callee.name;
  } else if (callee.kind === "MemberExpr") {
    return `${getCalleeName(callee.object)}.${callee.member}`;
  }
  return "fn";
}

function exprToShortString(expr: Expr, options: VisualizerOptions): string {
  switch (expr.kind) {
    case "NumberLiteral":
      return String(expr.value);
    case "StringLiteral":
      return `"${truncateLabel(expr.value, 10)}"`;
    case "BooleanLiteral":
      return String(expr.value);
    case "Identifier":
      return expr.name;
    case "PlaceholderExpr":
      return "_";
    case "FunctionExpr":
      return `(${expr.params.map(p => p.name).join(", ")}) -> ...`;
    case "ListExpr":
      return `[${expr.elements.length}]`;
    case "RecordExpr":
      return `{${expr.fields.length}}`;
    default:
      return "...";
  }
}

function truncateLabel(label: string, maxLength: number = 30): string {
  if (label.length <= maxLength) return label;
  return label.slice(0, maxLength - 3) + "...";
}

function sanitizeLabel(label: string): string {
  // Escape special Mermaid characters
  return label
    .replace(/"/g, "'")
    .replace(/\[/g, "⟦")
    .replace(/\]/g, "⟧")
    .replace(/\{/g, "⟨")
    .replace(/\}/g, "⟩")
    .replace(/</g, "‹")
    .replace(/>/g, "›")
    .replace(/\|/g, "│")
    .replace(/&/g, "&amp;");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ============================================
// Mermaid Rendering
// ============================================

function renderMermaid(ctx: VisualizerContext): string {
  const lines: string[] = [];

  lines.push(`flowchart ${ctx.direction}`);

  // Render subgraphs first
  for (const subgraph of ctx.subgraphs) {
    lines.push(`    subgraph ${subgraph.id}["${subgraph.label}"]`);

    for (const node of subgraph.nodes) {
      lines.push(`        ${renderNode(node)}`);
    }

    for (const edge of subgraph.edges) {
      lines.push(`        ${renderEdge(edge)}`);
    }

    lines.push(`    end`);
  }

  // Render top-level nodes
  for (const node of ctx.nodes) {
    lines.push(`    ${renderNode(node)}`);
  }

  // Render top-level edges
  for (const edge of ctx.edges) {
    lines.push(`    ${renderEdge(edge)}`);
  }

  // Add styling
  lines.push("");
  lines.push("    %% Styling");
  lines.push("    classDef data fill:#a855f7,stroke:#9333ea,color:#fff");
  lines.push("    classDef operation fill:#3b82f6,stroke:#2563eb,color:#fff");
  lines.push("    classDef branch fill:#f59e0b,stroke:#d97706,color:#fff");
  lines.push("    classDef result fill:#10b981,stroke:#059669,color:#fff");

  // Apply classes based on shape
  const dataNodes = ctx.nodes.filter(n => n.shape === "stadium").map(n => n.id);
  const opNodes = ctx.nodes.filter(n => n.shape === "parallelogram" || n.shape === "circle").map(n => n.id);
  const branchNodes = ctx.nodes.filter(n => n.shape === "diamond").map(n => n.id);
  const resultNodes = ctx.nodes.filter(n => n.shape === "subroutine").map(n => n.id);

  if (dataNodes.length > 0) lines.push(`    class ${dataNodes.join(",")} data`);
  if (opNodes.length > 0) lines.push(`    class ${opNodes.join(",")} operation`);
  if (branchNodes.length > 0) lines.push(`    class ${branchNodes.join(",")} branch`);
  if (resultNodes.length > 0) lines.push(`    class ${resultNodes.join(",")} result`);

  return lines.join("\n");
}

function renderNode(node: MermaidNode): string {
  const { id, label, shape } = node;

  switch (shape) {
    case "stadium":
      return `${id}(["${label}"])`;
    case "parallelogram":
      return `${id}[/"${label}"/]`;
    case "diamond":
      return `${id}{"${label}"}`;
    case "subroutine":
      return `${id}[["${label}"]]`;
    case "circle":
      return `${id}(("${label}"))`;
    case "rect":
    default:
      return `${id}["${label}"]`;
  }
}

function renderEdge(edge: MermaidEdge): string {
  const { from, to, label } = edge;

  if (label) {
    return `${from} -->|"${label}"| ${to}`;
  }
  return `${from} --> ${to}`;
}

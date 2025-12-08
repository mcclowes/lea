// Flow Graph Data Structures for Lea Pipeline Visualization

import { Expr, Stmt, Decorator, TypeSignature } from "../ast";

// Unique identifier for nodes
export type NodeId = string;

// Node types in the flow graph
export type FlowNodeType =
  | "data"        // Data source (literal, variable)
  | "transform"   // Transformation (function call, operator)
  | "branch"      // Fan-out point (parallel pipe start)
  | "merge"       // Fan-in point (parallel pipe end)
  | "input"       // Program/function input
  | "output"      // Program/function output
  | "binding"     // Variable binding (let statement)
  | "condition"   // Conditional branch (ternary)
  | "await"       // Async boundary
  | "decorator";  // Decorator application

// Base node interface
export interface FlowNodeBase {
  id: NodeId;
  type: FlowNodeType;
  label: string;
  sourceExpr?: Expr | Stmt;  // Link back to AST
  position?: { x: number; y: number };  // For layout
  metadata: NodeMetadata;
}

// Metadata for rich visualization
export interface NodeMetadata {
  typeAnnotation?: string;
  decorators?: Decorator[];
  isAsync?: boolean;
  isMutable?: boolean;
  runtimeValue?: RuntimeValue;
}

// Runtime value captured during execution
export interface RuntimeValue {
  value: unknown;
  type: string;
  timestamp?: number;
}

// Specific node types
export interface DataNode extends FlowNodeBase {
  type: "data";
  dataType: "number" | "string" | "boolean" | "list" | "record" | "tuple" | "null" | "identifier";
  value?: unknown;
  variableName?: string;
}

export interface TransformNode extends FlowNodeBase {
  type: "transform";
  transformType: "call" | "operator" | "map" | "filter" | "reduce" | "builtin" | "user-function";
  functionName?: string;
  operator?: string;
  params?: string[];
  typeSignature?: TypeSignature;
}

export interface BranchNode extends FlowNodeBase {
  type: "branch";
  branchCount: number;
}

export interface MergeNode extends FlowNodeBase {
  type: "merge";
  inputCount: number;
}

export interface BindingNode extends FlowNodeBase {
  type: "binding";
  variableName: string;
  isMutable: boolean;
}

export interface ConditionNode extends FlowNodeBase {
  type: "condition";
  conditionExpr: string;
}

export interface AwaitNode extends FlowNodeBase {
  type: "await";
}

export interface DecoratorNode extends FlowNodeBase {
  type: "decorator";
  decoratorName: string;
  decoratorArgs: (number | string | boolean)[];
}

export interface InputNode extends FlowNodeBase {
  type: "input";
  inputName?: string;
}

export interface OutputNode extends FlowNodeBase {
  type: "output";
  outputType?: string;
}

// Union of all node types
export type FlowNode =
  | DataNode
  | TransformNode
  | BranchNode
  | MergeNode
  | BindingNode
  | ConditionNode
  | AwaitNode
  | DecoratorNode
  | InputNode
  | OutputNode;

// Edge types
export type EdgeType =
  | "pipe"       // Normal pipe flow
  | "parallel"   // Parallel branch
  | "argument"   // Function argument
  | "binding"    // Variable binding reference
  | "condition"  // Conditional flow
  | "merge";     // Merge from parallel

export interface FlowEdge {
  id: string;
  type: EdgeType;
  source: NodeId;
  target: NodeId;
  label?: string;
  metadata?: EdgeMetadata;
}

export interface EdgeMetadata {
  argumentIndex?: number;  // For argument edges
  branchIndex?: number;    // For parallel branches
  isElseBranch?: boolean;  // For condition edges
  runtimeValue?: RuntimeValue;
}

// The complete flow graph
export interface FlowGraph {
  nodes: Map<NodeId, FlowNode>;
  edges: FlowEdge[];
  metadata: GraphMetadata;
}

export interface GraphMetadata {
  sourceFile?: string;
  programName?: string;
  createdAt: Date;
  hasAsyncFlow: boolean;
  hasParallelFlow: boolean;
  variableBindings: Map<string, NodeId>;  // Track variable -> node mapping
}

// Flow graph builder helpers
let nodeIdCounter = 0;

export function generateNodeId(prefix: string = "node"): NodeId {
  return `${prefix}_${++nodeIdCounter}`;
}

export function resetNodeIdCounter(): void {
  nodeIdCounter = 0;
}

export function createFlowGraph(): FlowGraph {
  return {
    nodes: new Map(),
    edges: [],
    metadata: {
      createdAt: new Date(),
      hasAsyncFlow: false,
      hasParallelFlow: false,
      variableBindings: new Map(),
    },
  };
}

export function addNode(graph: FlowGraph, node: FlowNode): void {
  graph.nodes.set(node.id, node);
}

export function addEdge(graph: FlowGraph, edge: FlowEdge): void {
  graph.edges.push(edge);
}

export function createDataNode(
  label: string,
  dataType: DataNode["dataType"],
  value?: unknown,
  variableName?: string,
  sourceExpr?: Expr
): DataNode {
  return {
    id: generateNodeId("data"),
    type: "data",
    label,
    dataType,
    value,
    variableName,
    sourceExpr,
    metadata: {},
  };
}

export function createTransformNode(
  label: string,
  transformType: TransformNode["transformType"],
  functionName?: string,
  operator?: string,
  sourceExpr?: Expr
): TransformNode {
  return {
    id: generateNodeId("transform"),
    type: "transform",
    label,
    transformType,
    functionName,
    operator,
    sourceExpr,
    metadata: {},
  };
}

export function createBranchNode(branchCount: number, sourceExpr?: Expr): BranchNode {
  return {
    id: generateNodeId("branch"),
    type: "branch",
    label: `Branch (${branchCount})`,
    branchCount,
    sourceExpr,
    metadata: {},
  };
}

export function createMergeNode(inputCount: number, sourceExpr?: Expr): MergeNode {
  return {
    id: generateNodeId("merge"),
    type: "merge",
    label: `Merge (${inputCount})`,
    inputCount,
    sourceExpr,
    metadata: {},
  };
}

export function createBindingNode(
  variableName: string,
  isMutable: boolean,
  sourceStmt?: Stmt
): BindingNode {
  return {
    id: generateNodeId("binding"),
    type: "binding",
    label: `${isMutable ? "mut " : ""}${variableName}`,
    variableName,
    isMutable,
    sourceExpr: sourceStmt as unknown as Expr,
    metadata: { isMutable },
  };
}

export function createConditionNode(conditionExpr: string, sourceExpr?: Expr): ConditionNode {
  return {
    id: generateNodeId("condition"),
    type: "condition",
    label: `if ${conditionExpr}`,
    conditionExpr,
    sourceExpr,
    metadata: {},
  };
}

export function createAwaitNode(sourceExpr?: Expr): AwaitNode {
  return {
    id: generateNodeId("await"),
    type: "await",
    label: "await",
    sourceExpr,
    metadata: { isAsync: true },
  };
}

export function createDecoratorNode(
  decoratorName: string,
  decoratorArgs: (number | string | boolean)[],
  sourceExpr?: Expr
): DecoratorNode {
  const argsStr = decoratorArgs.length > 0 ? `(${decoratorArgs.join(", ")})` : "";
  return {
    id: generateNodeId("decorator"),
    type: "decorator",
    label: `#${decoratorName}${argsStr}`,
    decoratorName,
    decoratorArgs,
    sourceExpr,
    metadata: {},
  };
}

export function createInputNode(inputName?: string): InputNode {
  return {
    id: generateNodeId("input"),
    type: "input",
    label: inputName ? `Input: ${inputName}` : "Input",
    inputName,
    metadata: {},
  };
}

export function createOutputNode(outputType?: string): OutputNode {
  return {
    id: generateNodeId("output"),
    type: "output",
    label: outputType ? `Output: ${outputType}` : "Output",
    outputType,
    metadata: {},
  };
}

export function createPipeEdge(source: NodeId, target: NodeId, label?: string): FlowEdge {
  return {
    id: `edge_${source}_${target}`,
    type: "pipe",
    source,
    target,
    label,
  };
}

export function createParallelEdge(
  source: NodeId,
  target: NodeId,
  branchIndex: number
): FlowEdge {
  return {
    id: `edge_${source}_${target}_${branchIndex}`,
    type: "parallel",
    source,
    target,
    metadata: { branchIndex },
  };
}

export function createArgumentEdge(
  source: NodeId,
  target: NodeId,
  argumentIndex: number
): FlowEdge {
  return {
    id: `edge_${source}_${target}_arg${argumentIndex}`,
    type: "argument",
    source,
    target,
    metadata: { argumentIndex },
  };
}

export function createMergeEdge(source: NodeId, target: NodeId): FlowEdge {
  return {
    id: `edge_${source}_${target}_merge`,
    type: "merge",
    source,
    target,
  };
}

// Utility functions for graph traversal
export function getIncomingEdges(graph: FlowGraph, nodeId: NodeId): FlowEdge[] {
  return graph.edges.filter((edge) => edge.target === nodeId);
}

export function getOutgoingEdges(graph: FlowGraph, nodeId: NodeId): FlowEdge[] {
  return graph.edges.filter((edge) => edge.source === nodeId);
}

export function getSourceNodes(graph: FlowGraph): FlowNode[] {
  const targetIds = new Set(graph.edges.map((e) => e.target));
  return Array.from(graph.nodes.values()).filter((node) => !targetIds.has(node.id));
}

export function getSinkNodes(graph: FlowGraph): FlowNode[] {
  const sourceIds = new Set(graph.edges.map((e) => e.source));
  return Array.from(graph.nodes.values()).filter((node) => !sourceIds.has(node.id));
}

// Export graph to JSON for serialization
export function graphToJSON(graph: FlowGraph): object {
  return {
    nodes: Array.from(graph.nodes.entries()).map(([, node]) => ({
      ...node,
      sourceExpr: undefined,  // Don't serialize AST
    })),
    edges: graph.edges,
    metadata: {
      ...graph.metadata,
      variableBindings: Array.from(graph.metadata.variableBindings.entries()),
    },
  };
}

// Import graph from JSON
export function graphFromJSON(json: {
  nodes: Array<{ id: string } & FlowNode>;
  edges: FlowEdge[];
  metadata: GraphMetadata & { variableBindings: Array<[string, string]> };
}): FlowGraph {
  const graph = createFlowGraph();

  for (const node of json.nodes) {
    graph.nodes.set(node.id, node);
  }

  graph.edges = json.edges;
  graph.metadata = {
    ...json.metadata,
    variableBindings: new Map(json.metadata.variableBindings),
  };

  return graph;
}

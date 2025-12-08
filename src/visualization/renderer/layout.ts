// Graph Layout Algorithm for Flow Visualization
// Implements a simple layered (Sugiyama-style) layout

import { FlowGraph, FlowNode, FlowEdge, NodeId, getIncomingEdges, getOutgoingEdges } from "../flowGraph";

export interface LayoutConfig {
  nodeWidth: number;
  nodeHeight: number;
  horizontalSpacing: number;
  verticalSpacing: number;
  margin: number;
}

export const defaultLayoutConfig: LayoutConfig = {
  nodeWidth: 140,
  nodeHeight: 50,
  horizontalSpacing: 60,
  verticalSpacing: 80,
  margin: 40,
};

export interface LayoutResult {
  width: number;
  height: number;
  nodes: Map<NodeId, { x: number; y: number; width: number; height: number }>;
  edges: Array<{
    edge: FlowEdge;
    path: Array<{ x: number; y: number }>;
  }>;
}

// Compute layout for the flow graph
export function computeLayout(graph: FlowGraph, config: LayoutConfig = defaultLayoutConfig): LayoutResult {
  if (graph.nodes.size === 0) {
    return {
      width: config.margin * 2,
      height: config.margin * 2,
      nodes: new Map(),
      edges: [],
    };
  }

  // Step 1: Assign layers using longest path from sources
  const layers = assignLayers(graph);

  // Step 2: Order nodes within layers to minimize crossings
  const orderedLayers = orderLayers(layers, graph);

  // Step 3: Compute positions
  const nodePositions = computePositions(orderedLayers, config);

  // Step 4: Compute edge paths
  const edgePaths = computeEdgePaths(graph, nodePositions, config);

  // Compute overall dimensions
  let maxX = 0;
  let maxY = 0;
  for (const pos of nodePositions.values()) {
    maxX = Math.max(maxX, pos.x + pos.width);
    maxY = Math.max(maxY, pos.y + pos.height);
  }

  return {
    width: maxX + config.margin,
    height: maxY + config.margin,
    nodes: nodePositions,
    edges: edgePaths,
  };
}

// Assign nodes to layers based on longest path from sources
function assignLayers(graph: FlowGraph): Map<number, NodeId[]> {
  const layers = new Map<number, NodeId[]>();
  const nodeLayer = new Map<NodeId, number>();

  // Find source nodes (no incoming edges)
  const sourceIds = new Set(graph.nodes.keys());
  for (const edge of graph.edges) {
    sourceIds.delete(edge.target);
  }

  // BFS from sources to assign layers
  const queue: Array<{ nodeId: NodeId; layer: number }> = [];

  // Initialize sources at layer 0
  for (const sourceId of sourceIds) {
    queue.push({ nodeId: sourceId, layer: 0 });
  }

  // If no sources found, start from first node
  if (queue.length === 0 && graph.nodes.size > 0) {
    const firstNode = graph.nodes.keys().next().value;
    if (firstNode) {
      queue.push({ nodeId: firstNode, layer: 0 });
    }
  }

  // Process queue
  while (queue.length > 0) {
    const { nodeId, layer } = queue.shift()!;

    // Update layer (use max to ensure proper ordering)
    const currentLayer = nodeLayer.get(nodeId);
    if (currentLayer === undefined || layer > currentLayer) {
      nodeLayer.set(nodeId, layer);

      // Add to layers map
      if (!layers.has(layer)) {
        layers.set(layer, []);
      }
      const layerNodes = layers.get(layer)!;
      if (!layerNodes.includes(nodeId)) {
        layerNodes.push(nodeId);
      }

      // Queue successors
      const outEdges = getOutgoingEdges(graph, nodeId);
      for (const edge of outEdges) {
        queue.push({ nodeId: edge.target, layer: layer + 1 });
      }
    }
  }

  // Handle any disconnected nodes
  for (const nodeId of graph.nodes.keys()) {
    if (!nodeLayer.has(nodeId)) {
      const maxLayer = Math.max(0, ...layers.keys());
      const layer = maxLayer + 1;
      nodeLayer.set(nodeId, layer);
      if (!layers.has(layer)) {
        layers.set(layer, []);
      }
      layers.get(layer)!.push(nodeId);
    }
  }

  return layers;
}

// Order nodes within layers to minimize edge crossings
function orderLayers(layers: Map<number, NodeId[]>, graph: FlowGraph): NodeId[][] {
  const sortedLayerKeys = Array.from(layers.keys()).sort((a, b) => a - b);
  const result: NodeId[][] = [];

  for (const layerKey of sortedLayerKeys) {
    const layerNodes = layers.get(layerKey)!;

    if (result.length === 0) {
      // First layer - no reordering needed
      result.push([...layerNodes]);
    } else {
      // Order based on average position of predecessors
      const prevLayer = result[result.length - 1];
      const prevPositions = new Map<NodeId, number>();
      prevLayer.forEach((id, idx) => prevPositions.set(id, idx));

      const nodeScores = new Map<NodeId, number>();

      for (const nodeId of layerNodes) {
        const inEdges = getIncomingEdges(graph, nodeId);
        let sum = 0;
        let count = 0;

        for (const edge of inEdges) {
          const pos = prevPositions.get(edge.source);
          if (pos !== undefined) {
            sum += pos;
            count++;
          }
        }

        nodeScores.set(nodeId, count > 0 ? sum / count : 0);
      }

      // Sort by average predecessor position
      const sorted = [...layerNodes].sort((a, b) => {
        return (nodeScores.get(a) || 0) - (nodeScores.get(b) || 0);
      });

      result.push(sorted);
    }
  }

  return result;
}

// Compute actual x,y positions for nodes
function computePositions(
  layers: NodeId[][],
  config: LayoutConfig
): Map<NodeId, { x: number; y: number; width: number; height: number }> {
  const positions = new Map<NodeId, { x: number; y: number; width: number; height: number }>();

  for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
    const layer = layers[layerIdx];
    const layerWidth = layer.length * (config.nodeWidth + config.horizontalSpacing) - config.horizontalSpacing;

    for (let nodeIdx = 0; nodeIdx < layer.length; nodeIdx++) {
      const nodeId = layer[nodeIdx];

      // Center the layer
      const startX = config.margin;
      const x = startX + nodeIdx * (config.nodeWidth + config.horizontalSpacing);
      const y = config.margin + layerIdx * (config.nodeHeight + config.verticalSpacing);

      positions.set(nodeId, {
        x,
        y,
        width: config.nodeWidth,
        height: config.nodeHeight,
      });
    }
  }

  return positions;
}

// Compute paths for edges
function computeEdgePaths(
  graph: FlowGraph,
  nodePositions: Map<NodeId, { x: number; y: number; width: number; height: number }>,
  config: LayoutConfig
): Array<{ edge: FlowEdge; path: Array<{ x: number; y: number }> }> {
  const result: Array<{ edge: FlowEdge; path: Array<{ x: number; y: number }> }> = [];

  for (const edge of graph.edges) {
    const sourcePos = nodePositions.get(edge.source);
    const targetPos = nodePositions.get(edge.target);

    if (!sourcePos || !targetPos) continue;

    // Calculate connection points
    const sourceCenter = {
      x: sourcePos.x + sourcePos.width / 2,
      y: sourcePos.y + sourcePos.height / 2,
    };
    const targetCenter = {
      x: targetPos.x + targetPos.width / 2,
      y: targetPos.y + targetPos.height / 2,
    };

    // Determine edge direction and connection points
    let startPoint: { x: number; y: number };
    let endPoint: { x: number; y: number };

    if (targetCenter.y > sourceCenter.y + config.nodeHeight / 2) {
      // Target is below source
      startPoint = { x: sourceCenter.x, y: sourcePos.y + sourcePos.height };
      endPoint = { x: targetCenter.x, y: targetPos.y };
    } else if (targetCenter.y < sourceCenter.y - config.nodeHeight / 2) {
      // Target is above source
      startPoint = { x: sourceCenter.x, y: sourcePos.y };
      endPoint = { x: targetCenter.x, y: targetPos.y + targetPos.height };
    } else if (targetCenter.x > sourceCenter.x) {
      // Target is to the right
      startPoint = { x: sourcePos.x + sourcePos.width, y: sourceCenter.y };
      endPoint = { x: targetPos.x, y: targetCenter.y };
    } else {
      // Target is to the left
      startPoint = { x: sourcePos.x, y: sourceCenter.y };
      endPoint = { x: targetPos.x + targetPos.width, y: targetCenter.y };
    }

    // Create path with optional control points for curves
    const path: Array<{ x: number; y: number }> = [];
    path.push(startPoint);

    // Add midpoint for smoother curves
    const midY = (startPoint.y + endPoint.y) / 2;
    if (Math.abs(startPoint.x - endPoint.x) > config.nodeWidth) {
      // Add control points for curved path
      path.push({ x: startPoint.x, y: midY });
      path.push({ x: endPoint.x, y: midY });
    }

    path.push(endPoint);

    result.push({ edge, path });
  }

  return result;
}

// Generate SVG path string from points
export function pathToSVG(path: Array<{ x: number; y: number }>, curved: boolean = true): string {
  if (path.length < 2) return "";

  const start = path[0];
  let d = `M ${start.x} ${start.y}`;

  if (curved && path.length > 2) {
    // Use quadratic bezier curves
    for (let i = 1; i < path.length - 1; i++) {
      const current = path[i];
      const next = path[i + 1];
      const midX = (current.x + next.x) / 2;
      const midY = (current.y + next.y) / 2;
      d += ` Q ${current.x} ${current.y} ${midX} ${midY}`;
    }
    const last = path[path.length - 1];
    d += ` L ${last.x} ${last.y}`;
  } else {
    // Straight lines
    for (let i = 1; i < path.length; i++) {
      d += ` L ${path[i].x} ${path[i].y}`;
    }
  }

  return d;
}

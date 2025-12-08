// Flow Graph Renderer - Generates HTML/SVG visualization

import { FlowGraph, FlowNode, NodeId, graphToJSON } from "../flowGraph";
import { ExecutionTrace, traceToJSON } from "../tracer";
import { computeLayout, defaultLayoutConfig, LayoutConfig, LayoutResult, pathToSVG } from "./layout";

export interface RenderOptions {
  title?: string;
  layout?: LayoutConfig;
  showTypes?: boolean;
  showValues?: boolean;
  interactive?: boolean;
  theme?: "light" | "dark";
  animate?: boolean;
}

const defaultOptions: RenderOptions = {
  title: "Lea Flow Visualization",
  layout: defaultLayoutConfig,
  showTypes: true,
  showValues: true,
  interactive: true,
  theme: "light",
  animate: false,
};

// Node colors by type
const nodeColors: Record<string, { fill: string; stroke: string; text: string }> = {
  data: { fill: "#e3f2fd", stroke: "#1976d2", text: "#0d47a1" },
  transform: { fill: "#fff3e0", stroke: "#f57c00", text: "#e65100" },
  branch: { fill: "#f3e5f5", stroke: "#9c27b0", text: "#6a1b9a" },
  merge: { fill: "#f3e5f5", stroke: "#9c27b0", text: "#6a1b9a" },
  binding: { fill: "#e8f5e9", stroke: "#43a047", text: "#2e7d32" },
  condition: { fill: "#fff8e1", stroke: "#ffa000", text: "#ff6f00" },
  await: { fill: "#e0f7fa", stroke: "#00acc1", text: "#006064" },
  decorator: { fill: "#fce4ec", stroke: "#e91e63", text: "#c2185b" },
  input: { fill: "#eceff1", stroke: "#607d8b", text: "#37474f" },
  output: { fill: "#ffebee", stroke: "#e53935", text: "#c62828" },
};

// Dark theme colors
const darkNodeColors: Record<string, { fill: string; stroke: string; text: string }> = {
  data: { fill: "#1e3a5f", stroke: "#64b5f6", text: "#90caf9" },
  transform: { fill: "#4a3000", stroke: "#ffb74d", text: "#ffe0b2" },
  branch: { fill: "#4a1f5e", stroke: "#ce93d8", text: "#e1bee7" },
  merge: { fill: "#4a1f5e", stroke: "#ce93d8", text: "#e1bee7" },
  binding: { fill: "#1b4332", stroke: "#81c784", text: "#a5d6a7" },
  condition: { fill: "#4a3800", stroke: "#ffd54f", text: "#ffecb3" },
  await: { fill: "#004d5a", stroke: "#4dd0e1", text: "#80deea" },
  decorator: { fill: "#5d1a36", stroke: "#f48fb1", text: "#f8bbd9" },
  input: { fill: "#37474f", stroke: "#90a4ae", text: "#cfd8dc" },
  output: { fill: "#5d1a1a", stroke: "#ef5350", text: "#ef9a9a" },
};

// Edge colors by type
const edgeColors: Record<string, string> = {
  pipe: "#666",
  parallel: "#9c27b0",
  argument: "#999",
  binding: "#43a047",
  condition: "#ffa000",
  merge: "#9c27b0",
};

const darkEdgeColors: Record<string, string> = {
  pipe: "#aaa",
  parallel: "#ce93d8",
  argument: "#777",
  binding: "#81c784",
  condition: "#ffd54f",
  merge: "#ce93d8",
};

// Render a flow graph to HTML
export function renderToHTML(
  graph: FlowGraph,
  trace?: ExecutionTrace,
  options: RenderOptions = {}
): string {
  const opts = { ...defaultOptions, ...options };
  const layout = computeLayout(graph, opts.layout);
  const colors = opts.theme === "dark" ? darkNodeColors : nodeColors;
  const edgeClrs = opts.theme === "dark" ? darkEdgeColors : edgeColors;

  const bgColor = opts.theme === "dark" ? "#1e1e1e" : "#ffffff";
  const textColor = opts.theme === "dark" ? "#ffffff" : "#333333";

  // Generate SVG content
  const svgContent = generateSVG(graph, layout, colors, edgeClrs, opts);

  // Generate HTML
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(opts.title || "Lea Flow")}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${bgColor};
      color: ${textColor};
      overflow: hidden;
    }
    .container {
      width: 100vw;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .header {
      padding: 12px 20px;
      background: ${opts.theme === "dark" ? "#2d2d2d" : "#f5f5f5"};
      border-bottom: 1px solid ${opts.theme === "dark" ? "#444" : "#ddd"};
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header h1 {
      font-size: 18px;
      font-weight: 500;
    }
    .stats {
      font-size: 13px;
      color: ${opts.theme === "dark" ? "#aaa" : "#666"};
    }
    .canvas-container {
      flex: 1;
      overflow: auto;
      position: relative;
    }
    .canvas {
      min-width: 100%;
      min-height: 100%;
    }
    svg {
      display: block;
    }
    .node {
      cursor: pointer;
      transition: transform 0.1s ease;
    }
    .node:hover {
      transform: scale(1.02);
    }
    .node-rect {
      rx: 6;
      ry: 6;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
    }
    .node-label {
      font-size: 12px;
      font-weight: 500;
      pointer-events: none;
    }
    .node-type {
      font-size: 10px;
      opacity: 0.7;
      pointer-events: none;
    }
    .node-value {
      font-size: 10px;
      font-family: 'Monaco', 'Menlo', monospace;
      pointer-events: none;
    }
    .edge {
      fill: none;
      stroke-width: 2;
      marker-end: url(#arrowhead);
    }
    .edge-parallel {
      stroke-dasharray: 5,5;
    }
    .edge-argument {
      stroke-dasharray: 2,2;
      stroke-width: 1;
    }
    .tooltip {
      position: absolute;
      background: ${opts.theme === "dark" ? "#333" : "#fff"};
      border: 1px solid ${opts.theme === "dark" ? "#555" : "#ddd"};
      border-radius: 6px;
      padding: 10px;
      font-size: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
      max-width: 300px;
      z-index: 1000;
    }
    .tooltip.visible {
      opacity: 1;
    }
    .tooltip-title {
      font-weight: 600;
      margin-bottom: 6px;
    }
    .tooltip-row {
      display: flex;
      margin: 3px 0;
    }
    .tooltip-label {
      color: ${opts.theme === "dark" ? "#888" : "#666"};
      margin-right: 8px;
      min-width: 60px;
    }
    .tooltip-value {
      font-family: 'Monaco', 'Menlo', monospace;
      word-break: break-all;
    }
    .legend {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${opts.theme === "dark" ? "#2d2d2d" : "#fff"};
      border: 1px solid ${opts.theme === "dark" ? "#444" : "#ddd"};
      border-radius: 8px;
      padding: 12px;
      font-size: 11px;
    }
    .legend-title {
      font-weight: 600;
      margin-bottom: 8px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      margin: 4px 0;
    }
    .legend-color {
      width: 16px;
      height: 16px;
      border-radius: 3px;
      margin-right: 8px;
    }
    ${opts.animate ? `
    @keyframes flowPulse {
      0% { stroke-dashoffset: 20; }
      100% { stroke-dashoffset: 0; }
    }
    .edge {
      stroke-dasharray: 10,10;
      animation: flowPulse 1s linear infinite;
    }
    ` : ""}
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <h1>${escapeHtml(opts.title || "Lea Flow")}</h1>
      <div class="stats">
        ${graph.nodes.size} nodes · ${graph.edges.length} edges
        ${graph.metadata.hasParallelFlow ? " · parallel" : ""}
        ${graph.metadata.hasAsyncFlow ? " · async" : ""}
      </div>
    </header>
    <div class="canvas-container" id="canvasContainer">
      <div class="canvas">
        ${svgContent}
      </div>
    </div>
    <div class="tooltip" id="tooltip"></div>
    <div class="legend">
      <div class="legend-title">Node Types</div>
      ${generateLegend(colors)}
    </div>
  </div>
  <script>
    const graphData = ${JSON.stringify(graphToJSON(graph))};
    ${trace ? `const traceData = ${JSON.stringify(traceToJSON(trace))};` : "const traceData = null;"}

    // Tooltip handling
    const tooltip = document.getElementById('tooltip');
    const nodes = document.querySelectorAll('.node');

    nodes.forEach(node => {
      node.addEventListener('mouseenter', (e) => {
        const data = JSON.parse(node.dataset.info || '{}');
        showTooltip(e, data);
      });
      node.addEventListener('mousemove', (e) => {
        positionTooltip(e);
      });
      node.addEventListener('mouseleave', () => {
        hideTooltip();
      });
    });

    function showTooltip(e, data) {
      let html = '<div class="tooltip-title">' + escapeHtml(data.label || 'Node') + '</div>';
      if (data.type) {
        html += '<div class="tooltip-row"><span class="tooltip-label">Type:</span><span class="tooltip-value">' + data.type + '</span></div>';
      }
      if (data.typeAnnotation) {
        html += '<div class="tooltip-row"><span class="tooltip-label">Signature:</span><span class="tooltip-value">' + escapeHtml(data.typeAnnotation) + '</span></div>';
      }
      if (data.value !== undefined) {
        html += '<div class="tooltip-row"><span class="tooltip-label">Value:</span><span class="tooltip-value">' + escapeHtml(String(data.value)) + '</span></div>';
      }
      if (data.decorators && data.decorators.length > 0) {
        html += '<div class="tooltip-row"><span class="tooltip-label">Decorators:</span><span class="tooltip-value">' + data.decorators.map(d => '#' + d.name).join(' ') + '</span></div>';
      }
      tooltip.innerHTML = html;
      tooltip.classList.add('visible');
      positionTooltip(e);
    }

    function positionTooltip(e) {
      const x = e.clientX + 10;
      const y = e.clientY + 10;
      tooltip.style.left = x + 'px';
      tooltip.style.top = y + 'px';
    }

    function hideTooltip() {
      tooltip.classList.remove('visible');
    }

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    // Pan and zoom (simple implementation)
    const container = document.getElementById('canvasContainer');
    let isPanning = false;
    let startX, startY, scrollLeft, scrollTop;

    container.addEventListener('mousedown', (e) => {
      if (e.target.closest('.node')) return;
      isPanning = true;
      startX = e.pageX - container.offsetLeft;
      startY = e.pageY - container.offsetTop;
      scrollLeft = container.scrollLeft;
      scrollTop = container.scrollTop;
      container.style.cursor = 'grabbing';
    });

    container.addEventListener('mouseup', () => {
      isPanning = false;
      container.style.cursor = 'default';
    });

    container.addEventListener('mousemove', (e) => {
      if (!isPanning) return;
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      const y = e.pageY - container.offsetTop;
      container.scrollLeft = scrollLeft - (x - startX);
      container.scrollTop = scrollTop - (y - startY);
    });
  </script>
</body>
</html>`;
}

// Generate SVG content
function generateSVG(
  graph: FlowGraph,
  layout: LayoutResult,
  colors: Record<string, { fill: string; stroke: string; text: string }>,
  edgeColors: Record<string, string>,
  options: RenderOptions
): string {
  const { width, height, nodes, edges } = layout;

  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

  // Defs for arrow markers
  svg += `
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
    </marker>
    <marker id="arrowhead-parallel" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#9c27b0" />
    </marker>
  </defs>`;

  // Draw edges first (behind nodes)
  for (const { edge, path } of edges) {
    const pathStr = pathToSVG(path, true);
    const color = edgeColors[edge.type] || edgeColors.pipe;
    const className = `edge edge-${edge.type}`;
    const markerId = edge.type === "parallel" ? "arrowhead-parallel" : "arrowhead";

    svg += `<path class="${className}" d="${pathStr}" stroke="${color}" marker-end="url(#${markerId})" />`;

    // Edge label
    if (edge.label) {
      const midIdx = Math.floor(path.length / 2);
      const mid = path[midIdx];
      svg += `<text x="${mid.x}" y="${mid.y - 5}" text-anchor="middle" font-size="10" fill="${color}">${escapeHtml(edge.label)}</text>`;
    }
  }

  // Draw nodes
  for (const [nodeId, pos] of nodes) {
    const node = graph.nodes.get(nodeId);
    if (!node) continue;

    const color = colors[node.type] || colors.data;
    const tooltipData = {
      label: node.label,
      type: node.type,
      typeAnnotation: node.metadata.typeAnnotation,
      value: node.metadata.runtimeValue?.value,
      decorators: node.metadata.decorators,
    };

    svg += `<g class="node" data-id="${nodeId}" data-info='${escapeHtml(JSON.stringify(tooltipData))}' transform="translate(${pos.x}, ${pos.y})">`;
    svg += `<rect class="node-rect" width="${pos.width}" height="${pos.height}" fill="${color.fill}" stroke="${color.stroke}" stroke-width="2" />`;

    // Node icon based on type
    const icon = getNodeIcon(node.type);
    svg += `<text x="10" y="20" font-size="14">${icon}</text>`;

    // Node label
    const labelText = truncateText(node.label, 15);
    svg += `<text class="node-label" x="30" y="20" fill="${color.text}">${escapeHtml(labelText)}</text>`;

    // Type annotation
    if (options.showTypes && node.metadata.typeAnnotation) {
      const typeText = truncateText(node.metadata.typeAnnotation, 20);
      svg += `<text class="node-type" x="10" y="38" fill="${color.text}">${escapeHtml(typeText)}</text>`;
    }

    // Runtime value
    if (options.showValues && node.metadata.runtimeValue) {
      const valueStr = String(node.metadata.runtimeValue.value);
      const valueText = truncateText(valueStr, 18);
      svg += `<text class="node-value" x="${pos.width - 10}" y="38" text-anchor="end" fill="${color.text}">${escapeHtml(valueText)}</text>`;
    }

    svg += `</g>`;
  }

  svg += `</svg>`;
  return svg;
}

// Generate legend HTML
function generateLegend(colors: Record<string, { fill: string; stroke: string; text: string }>): string {
  const types = [
    { key: "data", label: "Data" },
    { key: "transform", label: "Transform" },
    { key: "branch", label: "Branch" },
    { key: "merge", label: "Merge" },
    { key: "binding", label: "Binding" },
    { key: "await", label: "Await" },
  ];

  return types
    .map(
      (t) =>
        `<div class="legend-item">
          <div class="legend-color" style="background: ${colors[t.key].fill}; border: 2px solid ${colors[t.key].stroke}"></div>
          <span>${t.label}</span>
        </div>`
    )
    .join("");
}

// Get icon for node type
function getNodeIcon(type: string): string {
  const icons: Record<string, string> = {
    data: "📦",
    transform: "⚡",
    branch: "🔀",
    merge: "🔗",
    binding: "📌",
    condition: "❓",
    await: "⏳",
    decorator: "🎨",
    input: "➡️",
    output: "✅",
  };
  return icons[type] || "●";
}

// Helper: escape HTML
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Helper: truncate text
function truncateText(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + "...";
}

// Render to standalone SVG (no HTML wrapper)
export function renderToSVG(graph: FlowGraph, options: RenderOptions = {}): string {
  const opts = { ...defaultOptions, ...options };
  const layout = computeLayout(graph, opts.layout);
  const colors = opts.theme === "dark" ? darkNodeColors : nodeColors;
  const edgeClrs = opts.theme === "dark" ? darkEdgeColors : edgeColors;

  return generateSVG(graph, layout, colors, edgeClrs, opts);
}

// Export layout result for custom rendering
export { computeLayout, LayoutResult, LayoutConfig };

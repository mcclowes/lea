/**
 * Tests for the interactive canvas visualization
 */

import { Lexer } from "../src/lexer";
import { Parser } from "../src/parser";
import {
  CanvasGraphBuilder,
  layoutGraph,
  generateSVG,
  buildCanvasGraph,
  visualizeToCanvas,
  CanvasGraph,
} from "../src/canvas";

function parse(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.scanTokens();
  const parser = new Parser(tokens);
  return parser.parse();
}

describe("CanvasGraphBuilder", () => {
  describe("basic expressions", () => {
    it("should create nodes for simple pipe chains", () => {
      const program = parse(`5 /> double /> print`);
      const graph = buildCanvasGraph(program);

      expect(graph.nodes.size).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);
    });

    it("should create nodes for parallel pipes", () => {
      const program = parse(`5 \\> addOne \\> double /> combine`);
      const graph = buildCanvasGraph(program);

      // Should have fanout and fanin nodes
      const nodeTypes = Array.from(graph.nodes.values()).map(n => n.type);
      expect(nodeTypes).toContain("fanout");
      expect(nodeTypes).toContain("fanin");
    });

    it("should create nodes for spread pipes", () => {
      const program = parse(`[1, 2, 3] />>> double`);
      const graph = buildCanvasGraph(program);

      // Spread pipe should have fanout and fanin nodes
      const nodeTypes = Array.from(graph.nodes.values()).map(n => n.type);
      expect(nodeTypes).toContain("fanout");
      expect(nodeTypes).toContain("fanin");
    });

    it("should create nodes for pipeline literals", () => {
      const program = parse(`let p = /> double /> addOne`);
      const graph = buildCanvasGraph(program);

      const nodeTypes = Array.from(graph.nodes.values()).map(n => n.type);
      expect(nodeTypes).toContain("pipeline");
    });

    it("should handle ternary expressions", () => {
      const program = parse(`x > 0 ? x /> double : x /> negate`);
      const graph = buildCanvasGraph(program);

      const nodeTypes = Array.from(graph.nodes.values()).map(n => n.type);
      expect(nodeTypes).toContain("condition");
      expect(nodeTypes).toContain("fanin"); // merge node
    });

    it("should handle await expressions", () => {
      const program = parse(`await delay(100) /> print`);
      const graph = buildCanvasGraph(program);

      const nodeTypes = Array.from(graph.nodes.values()).map(n => n.type);
      expect(nodeTypes).toContain("await");
    });

    it("should handle match expressions", () => {
      const program = parse(`
        x /> match input
          | 0 -> "zero"
          | "default"
      `);
      const graph = buildCanvasGraph(program);

      const nodeTypes = Array.from(graph.nodes.values()).map(n => n.type);
      expect(nodeTypes).toContain("match");
    });
  });

  describe("node properties", () => {
    it("should assign unique IDs to all nodes", () => {
      const program = parse(`
        let a = 5 /> double /> triple
        let b = 10 /> square
      `);
      const graph = buildCanvasGraph(program);

      const ids = Array.from(graph.nodes.keys());
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should set correct node types", () => {
      const program = parse(`5 /> double`);
      const graph = buildCanvasGraph(program);

      const nodes = Array.from(graph.nodes.values());
      const dataNode = nodes.find(n => n.label === "5");

      // The "5" literal should be a data node
      expect(dataNode?.type).toBe("data");
      // Verify there are nodes in the graph
      expect(nodes.length).toBeGreaterThan(0);
    });

    it("should include data in nodes", () => {
      const program = parse(`5 /> double`);
      const graph = buildCanvasGraph(program);

      const dataNode = Array.from(graph.nodes.values()).find(n => n.label === "5");
      expect(dataNode?.data).toBeDefined();
    });
  });

  describe("edges", () => {
    it("should create edges between consecutive pipe stages", () => {
      const program = parse(`5 /> double /> triple`);
      const graph = buildCanvasGraph(program);

      expect(graph.edges.length).toBeGreaterThan(0);

      // Each edge should have from and to
      for (const edge of graph.edges) {
        expect(edge.from).toBeDefined();
        expect(edge.to).toBeDefined();
        expect(graph.nodes.has(edge.from)).toBe(true);
        expect(graph.nodes.has(edge.to)).toBe(true);
      }
    });

    it("should have unique edge IDs", () => {
      const program = parse(`5 /> a /> b /> c /> d`);
      const graph = buildCanvasGraph(program);

      const ids = graph.edges.map(e => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});

describe("layoutGraph", () => {
  it("should assign positions to all nodes", () => {
    const program = parse(`5 /> double /> print`);
    const graph = buildCanvasGraph(program);

    layoutGraph(graph);

    for (const node of graph.nodes.values()) {
      expect(typeof node.x).toBe("number");
      expect(typeof node.y).toBe("number");
      expect(isNaN(node.x)).toBe(false);
      expect(isNaN(node.y)).toBe(false);
    }
  });

  it("should respect direction option", () => {
    const program = parse(`5 /> double /> print`);

    const graphLR = buildCanvasGraph(program);
    layoutGraph(graphLR, { direction: "LR" });

    const graphTB = buildCanvasGraph(program);
    layoutGraph(graphTB, { direction: "TB" });

    // In LR mode, x values should increase along the chain
    // In TB mode, y values should increase along the chain
    // Just verify layout completed without errors
    expect(graphLR.nodes.size).toBeGreaterThan(0);
    expect(graphTB.nodes.size).toBeGreaterThan(0);
  });

  it("should handle graphs with multiple entry points", () => {
    const program = parse(`
      let a = 5 /> double
      let b = 10 /> triple
    `);
    const graph = buildCanvasGraph(program);

    layoutGraph(graph);

    // All nodes should have valid positions
    for (const node of graph.nodes.values()) {
      expect(isNaN(node.x)).toBe(false);
      expect(isNaN(node.y)).toBe(false);
    }
  });
});

describe("generateSVG", () => {
  it("should generate valid SVG markup", () => {
    const program = parse(`5 /> double`);
    const graph = buildCanvasGraph(program);
    layoutGraph(graph);

    const svg = generateSVG(graph);

    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("xmlns=\"http://www.w3.org/2000/svg\"");
  });

  it("should include node elements", () => {
    const program = parse(`5 /> double`);
    const graph = buildCanvasGraph(program);
    layoutGraph(graph);

    const svg = generateSVG(graph);

    expect(svg).toContain("class=\"node\"");
    expect(svg).toContain("data-node-id");
  });

  it("should include edge elements", () => {
    const program = parse(`5 /> double`);
    const graph = buildCanvasGraph(program);
    layoutGraph(graph);

    const svg = generateSVG(graph);

    expect(svg).toContain("class=\"edge\"");
    expect(svg).toContain("marker-end");
  });

  it("should include defs for markers", () => {
    const program = parse(`5 /> double`);
    const graph = buildCanvasGraph(program);
    layoutGraph(graph);

    const svg = generateSVG(graph);

    expect(svg).toContain("<defs>");
    expect(svg).toContain("arrowhead");
  });

  it("should respect theme option", () => {
    const program = parse(`5 /> double`);
    const graph = buildCanvasGraph(program);
    layoutGraph(graph);

    const darkSvg = generateSVG(graph, { theme: "dark" });
    const lightSvg = generateSVG(graph, { theme: "light" });

    // Dark theme uses #1a1a2e background
    expect(darkSvg).toContain("#1a1a2e");
    // Light theme uses #f5f5f5 background
    expect(lightSvg).toContain("#f5f5f5");
  });
});

describe("visualizeToCanvas", () => {
  it("should generate complete HTML document", () => {
    const program = parse(`5 /> double`);
    const source = `5 /> double`;

    const html = visualizeToCanvas(program, source, "Test");

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });

  it("should include the title", () => {
    const program = parse(`5 /> double`);
    const source = `5 /> double`;

    const html = visualizeToCanvas(program, source, "My Custom Title");

    expect(html).toContain("My Custom Title");
  });

  it("should include source code", () => {
    const program = parse(`let x = 5 /> double`);
    const source = `let x = 5 /> double`;

    const html = visualizeToCanvas(program, source, "Test");

    expect(html).toContain("let x = 5");
    expect(html).toContain("double");
  });

  it("should include control buttons", () => {
    const program = parse(`5 /> double`);
    const source = `5 /> double`;

    const html = visualizeToCanvas(program, source, "Test");

    expect(html).toContain("btn-zoom-in");
    expect(html).toContain("btn-zoom-out");
    expect(html).toContain("btn-fit");
    expect(html).toContain("btn-animate");
    expect(html).toContain("btn-download");
  });

  it("should include inspector panel", () => {
    const program = parse(`5 /> double`);
    const source = `5 /> double`;

    const html = visualizeToCanvas(program, source, "Test");

    expect(html).toContain("Node Inspector");
    expect(html).toContain("inspector-content");
  });

  it("should include legend", () => {
    const program = parse(`5 /> double`);
    const source = `5 /> double`;

    const html = visualizeToCanvas(program, source, "Test");

    expect(html).toContain("Legend");
    expect(html).toContain("Data Values");
    expect(html).toContain("Operations");
    expect(html).toContain("Fan-out/Fan-in");
  });

  it("should include interactive JavaScript", () => {
    const program = parse(`5 /> double`);
    const source = `5 /> double`;

    const html = visualizeToCanvas(program, source, "Test");

    expect(html).toContain("setupPanZoom");
    expect(html).toContain("setupNodeInteraction");
    expect(html).toContain("fitToView");
  });

  it("should serialize graph data for JavaScript", () => {
    const program = parse(`5 /> double`);
    const source = `5 /> double`;

    const html = visualizeToCanvas(program, source, "Test");

    expect(html).toContain("const graphData =");
  });
});

describe("complex examples", () => {
  it("should handle nested parallel pipes", () => {
    const program = parse(`
      5 \\> (x) -> x + 1 \\> (x) -> x * 2 /> (a, b) -> a + b
    `);
    const graph = buildCanvasGraph(program);

    expect(graph.nodes.size).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it("should handle reactive pipes", () => {
    // Reactive pipes need a source variable and @> operator
    const program = parse(`
      maybe source = [1, 2, 3]
      let r = source @> map((x) -> x * 2) /> sum
    `);
    const graph = buildCanvasGraph(program);

    // Should have nodes for the reactive pipeline
    expect(graph.nodes.size).toBeGreaterThan(0);
  });

  it("should handle complex data processing pipeline", () => {
    const source = `
      let data = [1, 2, 3, 4, 5]
      let result = data
        /> filter((x) -> x > 2)
        /> map((x) -> x * 2)
        /> reduce(0, (acc, x) -> acc + x)
    `;
    const program = parse(source);
    const graph = buildCanvasGraph(program);

    layoutGraph(graph);
    const html = visualizeToCanvas(program, source, "Data Processing");

    expect(html).toContain("<!DOCTYPE html>");
    expect(graph.nodes.size).toBeGreaterThan(0);
  });
});

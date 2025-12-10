/**
 * CLI entry point for Lea visualization
 *
 * Usage:
 *   npm run visualize -- <file.lea>              # Output Mermaid markdown
 *   npm run visualize -- <file.lea> --html       # Output HTML with embedded diagram
 *   npm run visualize -- <file.lea> --canvas     # Output interactive canvas HTML
 *   npm run visualize -- <file.lea> -o out.html  # Write to file
 *   npm run visualize -- <file.lea> --tb         # Top-to-bottom layout
 */

import * as fs from "fs";
import * as path from "path";
import { Lexer, LexerError } from "./lexer";
import { Parser, ParseError } from "./parser";
import { visualizeProgram, generateHTML, VisualizerOptions } from "./visualizer";
import { visualizeToCanvas, CanvasOptions } from "./canvas";

interface CLIOptions {
  inputFile: string;
  outputFile?: string;
  html: boolean;
  canvas: boolean;
  direction: "TB" | "LR";
  showTypes: boolean;
  showDecorators: boolean;
  theme: "dark" | "light";
  animate: boolean;
}

function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {
    inputFile: "",
    html: false,
    canvas: false,
    direction: "LR",
    showTypes: false,
    showDecorators: true,
    theme: "dark",
    animate: true,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--html" || arg === "-h") {
      options.html = true;
    } else if (arg === "--canvas" || arg === "-c") {
      options.canvas = true;
    } else if (arg === "-o" || arg === "--output") {
      i++;
      if (i >= args.length) {
        console.error("Error: -o requires an output file path");
        process.exit(1);
      }
      options.outputFile = args[i];
    } else if (arg === "--tb" || arg === "--top-bottom") {
      options.direction = "TB";
    } else if (arg === "--lr" || arg === "--left-right") {
      options.direction = "LR";
    } else if (arg === "--types") {
      options.showTypes = true;
    } else if (arg === "--no-decorators") {
      options.showDecorators = false;
    } else if (arg === "--light") {
      options.theme = "light";
    } else if (arg === "--dark") {
      options.theme = "dark";
    } else if (arg === "--no-animate") {
      options.animate = false;
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else if (!arg.startsWith("-")) {
      options.inputFile = arg;
    } else {
      console.error(`Unknown option: ${arg}`);
      printHelp();
      process.exit(1);
    }

    i++;
  }

  return options;
}

function printHelp(): void {
  console.log(`
Lea Visualizer - Generate flowcharts from Lea source code

Usage:
  npm run visualize -- <file.lea> [options]

Output Modes:
  (default)             Output Mermaid markdown
  --html, -h            Output HTML with embedded Mermaid diagram
  --canvas, -c          Output interactive canvas HTML (recommended)

Options:
  -o, --output FILE     Write output to FILE instead of stdout
  --tb, --top-bottom    Use top-to-bottom layout (default: left-to-right)
  --lr, --left-right    Use left-to-right layout (default)
  --types               Show type annotations in diagram
  --no-decorators       Hide decorators in diagram
  --light               Use light theme (canvas mode only)
  --dark                Use dark theme (default, canvas mode only)
  --no-animate          Disable animations (canvas mode only)
  --help                Show this help message

Examples:
  npm run visualize -- examples/09-pipeline.lea
  npm run visualize -- examples/09-pipeline.lea --html -o flow.html
  npm run visualize -- examples/09-pipeline.lea --canvas -o canvas.html
  npm run visualize -- examples/09-pipeline.lea --canvas --light --tb

Output Formats:

  Mermaid (default):
    Outputs Mermaid flowchart markdown that can be rendered in any
    Mermaid-compatible viewer (GitHub, VSCode, etc.)

  HTML (--html):
    Self-contained HTML file with embedded Mermaid.js and SVG download.

  Canvas (--canvas, recommended):
    Interactive visualization with:
    - Pan and zoom (scroll wheel, drag)
    - Node inspection (click to view details)
    - Data flow animation
    - SVG export
    - Light/dark themes

Node Colors:
  Purple (stadium)      - Data values (numbers, strings, lists)
  Blue (parallelogram)  - Operations (functions, calls)
  Orange (diamond)      - Fan-out/Fan-in (parallel pipes)
  Green (subroutine)    - Await/Return
  Yellow (diamond)      - Conditionals
  Cyan (stadium)        - Reactive sources
`);
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Error: No input file specified");
    printHelp();
    process.exit(1);
  }

  const options = parseArgs(args);

  if (!options.inputFile) {
    console.error("Error: No input file specified");
    printHelp();
    process.exit(1);
  }

  // Resolve input file path
  const inputPath = path.resolve(options.inputFile);

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: File not found: ${inputPath}`);
    process.exit(1);
  }

  // Read source file
  const source = fs.readFileSync(inputPath, "utf-8");

  try {
    // Parse the source
    const lexer = new Lexer(source);
    const tokens = lexer.scanTokens();
    const parser = new Parser(tokens);
    const program = parser.parse();

    let output: string;

    if (options.canvas) {
      // Interactive canvas visualization
      const canvasOptions: CanvasOptions = {
        direction: options.direction,
        theme: options.theme,
        animate: options.animate,
      };
      const title = `Lea Flow: ${path.basename(inputPath)}`;
      output = visualizeToCanvas(program, source, title, canvasOptions);
    } else {
      // Mermaid-based visualization
      const vizOptions: VisualizerOptions = {
        direction: options.direction,
        showTypes: options.showTypes,
        showDecorators: options.showDecorators,
      };
      const mermaid = visualizeProgram(program, vizOptions);

      if (options.html) {
        const title = `Lea Flow: ${path.basename(inputPath)}`;
        output = generateHTML(mermaid, title);
      } else {
        output = mermaid;
      }
    }

    // Write or print output
    if (options.outputFile) {
      const outputPath = path.resolve(options.outputFile);
      fs.writeFileSync(outputPath, output, "utf-8");
      console.error(`Visualization written to: ${outputPath}`);
    } else {
      console.log(output);
    }
  } catch (err) {
    if (err instanceof LexerError) {
      console.error(`Lexer error: ${err.message}`);
      process.exit(1);
    }
    if (err instanceof ParseError) {
      console.error(`Parse error: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}

main();

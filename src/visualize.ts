#!/usr/bin/env ts-node
/**
 * CLI entry point for Lea pipeline visualization
 *
 * Usage:
 *   npm run visualize file.lea              # Output Mermaid markdown
 *   npm run visualize file.lea --html       # Output HTML with embedded diagram
 *   npm run visualize file.lea --tb         # Top-to-bottom layout
 */

import * as fs from "fs";
import * as path from "path";
import { Lexer } from "./lexer";
import { Parser } from "./parser";
import { generateFlowchart, generateHTML, VisualizerOptions } from "./visualizer";

// ============================================
// CLI Argument Parsing
// ============================================

interface CLIOptions {
  inputFile: string;
  outputFormat: "mermaid" | "html";
  direction: "LR" | "TB";
  includeBindings: boolean;
  expandFunctions: boolean;
  outputFile?: string;
}

function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {
    inputFile: "",
    outputFormat: "mermaid",
    direction: "LR",
    includeBindings: true,
    expandFunctions: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--html" || arg === "-h") {
      options.outputFormat = "html";
    } else if (arg === "--tb" || arg === "--top-bottom") {
      options.direction = "TB";
    } else if (arg === "--lr" || arg === "--left-right") {
      options.direction = "LR";
    } else if (arg === "--expand" || arg === "-e") {
      options.expandFunctions = true;
    } else if (arg === "--no-bindings") {
      options.includeBindings = false;
    } else if (arg === "--output" || arg === "-o") {
      options.outputFile = args[++i];
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
  }

  if (!options.inputFile) {
    console.error("Error: No input file specified");
    printHelp();
    process.exit(1);
  }

  return options;
}

function printHelp(): void {
  console.log(`
Lea Pipeline Visualizer

Usage: npm run visualize <file.lea> [options]

Options:
  --html, -h           Output HTML with embedded Mermaid diagram
  --tb, --top-bottom   Use top-to-bottom layout (default: left-to-right)
  --lr, --left-right   Use left-to-right layout (default)
  --expand, -e         Expand function bodies as subgraphs
  --no-bindings        Don't show variable bindings
  --output, -o <file>  Write output to file instead of stdout
  --help               Show this help message

Examples:
  npm run visualize examples/09-pipeline.lea
  npm run visualize examples/10-concurrency.lea --html --tb
  npm run visualize examples/09-pipeline.lea --html -o flow.html
`);
}

// ============================================
// Main
// ============================================

function main(): void {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  // Read input file
  const inputPath = path.resolve(options.inputFile);

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: File not found: ${inputPath}`);
    process.exit(1);
  }

  const source = fs.readFileSync(inputPath, "utf-8");

  // Parse
  const lexer = new Lexer(source);
  const tokens = lexer.scanTokens();

  const parser = new Parser(tokens);
  const program = parser.parse();

  // Generate visualization
  const vizOptions: VisualizerOptions = {
    direction: options.direction,
    includeBindings: options.includeBindings,
    expandFunctions: options.expandFunctions,
  };

  let output: string;

  if (options.outputFormat === "html") {
    output = generateHTML(program, vizOptions);
  } else {
    output = generateFlowchart(program, vizOptions);
  }

  // Output
  if (options.outputFile) {
    fs.writeFileSync(options.outputFile, output, "utf-8");
    console.log(`Written to: ${options.outputFile}`);
  } else {
    console.log(output);
  }
}

main();

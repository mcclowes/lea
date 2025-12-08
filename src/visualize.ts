/**
 * CLI entry point for Lea visualization
 *
 * Usage:
 *   npm run visualize -- <file.lea>              # Output Mermaid markdown
 *   npm run visualize -- <file.lea> --html       # Output HTML with embedded diagram
 *   npm run visualize -- <file.lea> -o out.html  # Write to file
 *   npm run visualize -- <file.lea> --tb         # Top-to-bottom layout
 */

import * as fs from "fs";
import * as path from "path";
import { Lexer, LexerError } from "./lexer";
import { Parser, ParseError } from "./parser";
import { visualizeProgram, generateHTML, VisualizerOptions } from "./visualizer";

interface CLIOptions {
  inputFile: string;
  outputFile?: string;
  html: boolean;
  direction: "TB" | "LR";
  showTypes: boolean;
  showDecorators: boolean;
}

function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {
    inputFile: "",
    html: false,
    direction: "LR",
    showTypes: false,
    showDecorators: true,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--html" || arg === "-h") {
      options.html = true;
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
Lea Visualizer - Generate Mermaid flowcharts from Lea source code

Usage:
  npm run visualize -- <file.lea> [options]

Options:
  --html, -h          Output HTML with embedded Mermaid diagram
  -o, --output FILE   Write output to FILE instead of stdout
  --tb, --top-bottom  Use top-to-bottom layout (default: left-to-right)
  --lr, --left-right  Use left-to-right layout (default)
  --types             Show type annotations in diagram
  --no-decorators     Hide decorators in diagram
  --help              Show this help message

Examples:
  npm run visualize -- examples/09-pipeline.lea
  npm run visualize -- examples/09-pipeline.lea --html -o flow.html
  npm run visualize -- examples/09-pipeline.lea --tb

Output:
  By default, outputs Mermaid markdown to stdout.
  With --html, outputs a self-contained HTML file with an interactive viewer.

Node Colors:
  Purple (stadium)      - Data values (numbers, strings, lists)
  Blue (parallelogram)  - Operations (functions, calls)
  Orange (diamond)      - Fan-out/Fan-in (parallel pipes)
  Green (subroutine)    - Await/Return
  Yellow (diamond)      - Conditionals
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

    // Visualization options
    const vizOptions: VisualizerOptions = {
      direction: options.direction,
      showTypes: options.showTypes,
      showDecorators: options.showDecorators,
    };

    // Generate Mermaid diagram
    const mermaid = visualizeProgram(program, vizOptions);

    // Generate output
    let output: string;
    if (options.html) {
      const title = `Lea Flow: ${path.basename(inputPath)}`;
      output = generateHTML(mermaid, title);
    } else {
      output = mermaid;
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

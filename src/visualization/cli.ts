#!/usr/bin/env node
// CLI for Lea Flow Visualization

import * as fs from "fs";
import * as path from "path";
import { Lexer } from "../lexer";
import { Parser } from "../parser";
import { analyzeProgram, getAnalysisSummary } from "./astAnalyzer";
import { renderToHTML, renderToSVG, RenderOptions } from "./renderer";
import { Tracer, TracingInterpreter, traceToJSON } from "./tracer";
import { graphToJSON } from "./flowGraph";

interface CLIOptions {
  input: string;
  output?: string;
  format: "html" | "svg" | "json";
  trace: boolean;
  theme: "light" | "dark";
  title?: string;
  open: boolean;
  summary: boolean;
}

function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {
    input: "",
    format: "html",
    trace: false,
    theme: "light",
    open: false,
    summary: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--output" || arg === "-o") {
      options.output = args[++i];
    } else if (arg === "--format" || arg === "-f") {
      const fmt = args[++i];
      if (fmt === "html" || fmt === "svg" || fmt === "json") {
        options.format = fmt;
      }
    } else if (arg === "--trace" || arg === "-t") {
      options.trace = true;
    } else if (arg === "--theme") {
      const theme = args[++i];
      if (theme === "light" || theme === "dark") {
        options.theme = theme;
      }
    } else if (arg === "--title") {
      options.title = args[++i];
    } else if (arg === "--open") {
      options.open = true;
    } else if (arg === "--summary" || arg === "-s") {
      options.summary = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (!arg.startsWith("-")) {
      options.input = arg;
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Lea Flow Visualization

Usage: npx ts-node src/visualization/cli.ts <file.lea> [options]

Options:
  -o, --output <file>    Output file path (default: <input>.html)
  -f, --format <format>  Output format: html, svg, json (default: html)
  -t, --trace            Include runtime trace data
  --theme <theme>        Color theme: light, dark (default: light)
  --title <title>        Custom title for the visualization
  --open                 Open the output file after generation
  -s, --summary          Print analysis summary to console
  -h, --help             Show this help message

Examples:
  npx ts-node src/visualization/cli.ts examples/09-pipeline.lea
  npx ts-node src/visualization/cli.ts examples/10-concurrency.lea --trace --theme dark
  npx ts-node src/visualization/cli.ts program.lea -o flow.html --open
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (!options.input) {
    console.error("Error: No input file specified");
    printHelp();
    process.exit(1);
  }

  // Read input file
  const inputPath = path.resolve(options.input);
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: File not found: ${inputPath}`);
    process.exit(1);
  }

  const source = fs.readFileSync(inputPath, "utf-8");
  const fileName = path.basename(inputPath, ".lea");

  console.log(`📊 Analyzing ${path.basename(inputPath)}...`);

  // Parse the source
  const lexer = new Lexer(source);
  const tokens = lexer.scanTokens();
  const parser = new Parser(tokens);
  const program = parser.parse();

  // Analyze the AST
  const analysisResult = analyzeProgram(program, inputPath);

  // Print summary if requested
  if (options.summary) {
    console.log("\n" + getAnalysisSummary(analysisResult));
  }

  // Run with tracing if requested
  let trace;
  if (options.trace) {
    console.log("🔍 Running with trace...");
    const tracer = new Tracer();
    const interpreter = new TracingInterpreter(tracer);

    try {
      await interpreter.interpretAsync(program);
      trace = tracer.stop();
      console.log(`   Captured ${trace.events.length} trace events`);
    } catch (error) {
      trace = tracer.stop(undefined, error as Error);
      console.warn(`   Warning: Execution error - ${(error as Error).message}`);
    }
  }

  // Determine output path
  const outputPath = options.output || `${fileName}.${options.format}`;

  // Generate output
  const renderOptions: RenderOptions = {
    title: options.title || `${fileName} - Lea Flow`,
    theme: options.theme,
    showTypes: true,
    showValues: options.trace,
    interactive: true,
    animate: false,
  };

  let output: string;

  switch (options.format) {
    case "html":
      output = renderToHTML(analysisResult.graph, trace, renderOptions);
      break;
    case "svg":
      output = renderToSVG(analysisResult.graph, renderOptions);
      break;
    case "json":
      output = JSON.stringify(
        {
          graph: graphToJSON(analysisResult.graph),
          trace: trace ? traceToJSON(trace) : null,
          analysis: {
            pipelineCount: analysisResult.pipelineCount,
            parallelBranchCount: analysisResult.parallelBranchCount,
            asyncOperationCount: analysisResult.asyncOperationCount,
            warnings: analysisResult.warnings,
          },
        },
        null,
        2
      );
      break;
  }

  // Write output
  fs.writeFileSync(outputPath, output);
  console.log(`✅ Generated ${outputPath}`);

  // Open if requested
  if (options.open && options.format === "html") {
    const { exec } = await import("child_process");
    const command =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
        ? "start"
        : "xdg-open";

    exec(`${command} ${outputPath}`, (error) => {
      if (error) {
        console.warn("Could not open file automatically");
      }
    });
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});

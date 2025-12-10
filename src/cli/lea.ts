#!/usr/bin/env node
/**
 * Lea CLI - Run Lea files or start the REPL
 *
 * Usage:
 *   lea <file.lea> [--strict]  - Run a Lea file
 *   lea --repl [--strict]      - Start interactive REPL
 *   lea --help                 - Show help
 *   lea --version              - Show version
 */

import * as fs from "fs";
import * as path from "path";
import { Lexer, LexerError } from "../lexer";
import { Parser, ParseError } from "../parser";
import { Interpreter, RuntimeError } from "../interpreter";
import { formatError } from "../errors";

const VERSION = require("../../package.json").version;

function showHelp(): void {
  console.log(`
Lea v${VERSION} - A pipe-oriented functional programming language

Usage:
  lea <file.lea> [options]    Run a Lea file
  lea --repl [options]        Start interactive REPL
  lea --init [name]           Initialize a new Lea project

Options:
  --strict      Enable strict type checking
  --help, -h    Show this help message
  --version     Show version number

Examples:
  lea hello.lea               Run a Lea file
  lea script.lea --strict     Run with strict type checking
  lea --repl                  Start the REPL
  lea --init my-project       Create a new project

Documentation: https://github.com/mcclowes/lea
`);
}

async function runFile(
  filename: string,
  strictMode: boolean
): Promise<void> {
  if (!fs.existsSync(filename)) {
    console.error(`Error: File not found: ${filename}`);
    process.exit(1);
  }

  const source = fs.readFileSync(filename, "utf-8");
  const lexer = new Lexer(source);
  const tokens = lexer.scanTokens();
  const parser = new Parser(tokens);
  const program = parser.parse();

  // CLI --strict flag or file #strict pragma
  const isStrict = strictMode || program.strict;

  const interpreter = new Interpreter(isStrict);
  interpreter.setCurrentFile(path.resolve(filename));
  await interpreter.interpretAsync(program);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle flags
  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    showHelp();
    process.exit(0);
  }

  if (args.includes("--version")) {
    console.log(`lea v${VERSION}`);
    process.exit(0);
  }

  const strictFlag = args.includes("--strict");

  // REPL mode
  if (args.includes("--repl")) {
    // Dynamically import REPL to avoid loading it when not needed
    const { startRepl } = await import("../repl");
    startRepl(strictFlag);
    return;
  }

  // Init mode
  if (args.includes("--init")) {
    const { runInit } = await import("../init");
    const nameIndex = args.indexOf("--init") + 1;
    const projectName = args[nameIndex] && !args[nameIndex].startsWith("--")
      ? args[nameIndex]
      : undefined;
    runInit(projectName);
    return;
  }

  // File execution mode
  const filename = args.find((arg) => !arg.startsWith("--"));

  if (!filename) {
    console.error("Error: No file specified");
    showHelp();
    process.exit(1);
  }

  try {
    await runFile(filename, strictFlag);
  } catch (err) {
    if (
      err instanceof LexerError ||
      err instanceof ParseError ||
      err instanceof RuntimeError
    ) {
      console.error(formatError(err));
      process.exit(1);
    }
    throw err;
  }
}

main();

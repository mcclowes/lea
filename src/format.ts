/**
 * CLI entry point for Lea formatter
 *
 * Usage:
 *   npm run format -- <file.lea>              # Print formatted code to stdout
 *   npm run format -- <file.lea> -w           # Format file in place
 *   npm run format -- <file.lea> --check      # Check if file is formatted
 *   npm run format -- <dir>                   # Format all .lea files in directory
 */

import * as fs from "fs";
import * as path from "path";
import { Lexer, LexerError } from "./lexer";
import { Parser, ParseError } from "./parser";
import { format, FormatterOptions } from "./formatter";

interface CLIOptions {
  files: string[];
  write: boolean;
  check: boolean;
  indentSize: number;
  printWidth: number;
  trailingCommas: boolean;
}

function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {
    files: [],
    write: false,
    check: false,
    indentSize: 2,
    printWidth: 80,
    trailingCommas: true,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "-w" || arg === "--write") {
      options.write = true;
    } else if (arg === "--check") {
      options.check = true;
    } else if (arg === "--indent") {
      i++;
      if (i >= args.length) {
        console.error("Error: --indent requires a number");
        process.exit(1);
      }
      options.indentSize = parseInt(args[i], 10);
    } else if (arg === "--print-width") {
      i++;
      if (i >= args.length) {
        console.error("Error: --print-width requires a number");
        process.exit(1);
      }
      options.printWidth = parseInt(args[i], 10);
    } else if (arg === "--no-trailing-commas") {
      options.trailingCommas = false;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (!arg.startsWith("-")) {
      options.files.push(arg);
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
Lea Formatter - Format Lea source code

Usage:
  npm run format -- <file.lea> [options]
  npm run format -- <directory> [options]

Options:
  -w, --write           Format file(s) in place
  --check               Check if file(s) are formatted (exit with error if not)
  --indent <n>          Number of spaces for indentation (default: 2)
  --print-width <n>     Maximum line width (default: 80)
  --no-trailing-commas  Don't use trailing commas in multi-line lists/records
  -h, --help            Show this help message

Examples:
  npm run format -- examples/01-basics.lea
  npm run format -- examples/01-basics.lea -w
  npm run format -- examples/ -w
  npm run format -- src/ --check

Output:
  By default, prints formatted code to stdout.
  With -w, modifies files in place.
  With --check, exits with code 1 if any file is not formatted.
`);
}

function collectLeaFiles(filePath: string): string[] {
  const resolved = path.resolve(filePath);
  const stat = fs.statSync(resolved);

  if (stat.isFile()) {
    if (resolved.endsWith(".lea")) {
      return [resolved];
    }
    console.error(`Warning: Skipping non-.lea file: ${resolved}`);
    return [];
  }

  if (stat.isDirectory()) {
    const files: string[] = [];
    const entries = fs.readdirSync(resolved);
    for (const entry of entries) {
      const entryPath = path.join(resolved, entry);
      files.push(...collectLeaFiles(entryPath));
    }
    return files;
  }

  return [];
}

function formatFile(
  filePath: string,
  options: FormatterOptions
): { formatted: string; original: string } {
  const source = fs.readFileSync(filePath, "utf-8");

  const lexer = new Lexer(source);
  const tokens = lexer.scanTokens();
  const parser = new Parser(tokens);
  const program = parser.parse();

  const formatted = format(program, options);

  return { formatted, original: source };
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Error: No input file(s) specified");
    printHelp();
    process.exit(1);
  }

  const options = parseArgs(args);

  if (options.files.length === 0) {
    console.error("Error: No input file(s) specified");
    printHelp();
    process.exit(1);
  }

  // Collect all .lea files
  const allFiles: string[] = [];
  for (const file of options.files) {
    const resolved = path.resolve(file);
    if (!fs.existsSync(resolved)) {
      console.error(`Error: File not found: ${resolved}`);
      process.exit(1);
    }
    allFiles.push(...collectLeaFiles(resolved));
  }

  if (allFiles.length === 0) {
    console.error("Error: No .lea files found");
    process.exit(1);
  }

  const formatterOptions: Partial<FormatterOptions> = {
    indentSize: options.indentSize,
    printWidth: options.printWidth,
    trailingCommas: options.trailingCommas,
  };

  let hasErrors = false;
  let unformattedCount = 0;

  for (const filePath of allFiles) {
    try {
      const { formatted, original } = formatFile(filePath, formatterOptions as FormatterOptions);

      if (options.check) {
        // Check mode: compare formatted with original
        if (formatted !== original) {
          console.error(`Not formatted: ${filePath}`);
          unformattedCount++;
        }
      } else if (options.write) {
        // Write mode: update file if changed
        if (formatted !== original) {
          fs.writeFileSync(filePath, formatted, "utf-8");
          console.log(`Formatted: ${filePath}`);
        } else {
          console.log(`Unchanged: ${filePath}`);
        }
      } else {
        // Default: print to stdout
        if (allFiles.length > 1) {
          console.log(`\n=== ${filePath} ===`);
        }
        process.stdout.write(formatted);
      }
    } catch (err) {
      hasErrors = true;
      if (err instanceof LexerError) {
        console.error(`Lexer error in ${filePath}: ${err.message}`);
      } else if (err instanceof ParseError) {
        console.error(`Parse error in ${filePath}: ${err.message}`);
      } else {
        console.error(`Error in ${filePath}: ${(err as Error).message}`);
      }
    }
  }

  if (options.check && unformattedCount > 0) {
    console.error(`\n${unformattedCount} file(s) need formatting`);
    process.exit(1);
  }

  if (hasErrors) {
    process.exit(1);
  }
}

main();

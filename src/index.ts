import * as fs from "fs";
import { Lexer, LexerError } from "./lexer";
import { Parser, ParseError } from "./parser";
import { Interpreter, RuntimeError } from "./interpreter";

async function run(source: string, filename: string, cliStrict: boolean = false): Promise<void> {
  const lexer = new Lexer(source);
  const tokens = lexer.scanTokens();
  const parser = new Parser(tokens);
  const program = parser.parse();

  // CLI --strict flag overrides, but file #strict pragma also enables strict mode
  const strictMode = cliStrict || program.strict;

  const interpreter = new Interpreter(strictMode);
  // Set the current file for module resolution
  interpreter.setCurrentFile(filename);
  // Use interpretAsync to properly handle top-level await and promises
  await interpreter.interpretAsync(program);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: npm run lea <filename.lea> [--strict]");
    process.exit(1);
  }

  // Parse CLI arguments
  const strictFlag = args.includes("--strict");
  const filename = args.find(arg => !arg.startsWith("--"));

  if (!filename) {
    console.error("Usage: npm run lea <filename.lea> [--strict]");
    process.exit(1);
  }

  if (!fs.existsSync(filename)) {
    console.error(`File not found: ${filename}`);
    process.exit(1);
  }

  const source = fs.readFileSync(filename, "utf-8");

  try {
    await run(source, filename, strictFlag);
  } catch (err) {
    if (err instanceof LexerError || err instanceof ParseError || err instanceof RuntimeError) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}

main();

import * as fs from "fs";
import { Lexer, LexerError } from "./lexer";
import { Parser, ParseError } from "./parser";
import { Interpreter, RuntimeError, LeaValue, LeaPromise } from "./interpreter";

async function run(source: string): Promise<void> {
  const lexer = new Lexer(source);
  const tokens = lexer.scanTokens();
  const parser = new Parser(tokens);
  const program = parser.parse();
  const interpreter = new Interpreter();
  const result = interpreter.interpret(program);

  // If the final result is a promise, await it
  if (result && typeof result === "object" && "kind" in result && (result as LeaPromise).kind === "promise") {
    await (result as LeaPromise).promise;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: npm run run <filename.lea>");
    process.exit(1);
  }

  const filename = args[0];

  if (!fs.existsSync(filename)) {
    console.error(`File not found: ${filename}`);
    process.exit(1);
  }

  const source = fs.readFileSync(filename, "utf-8");

  try {
    await run(source);
  } catch (err) {
    if (err instanceof LexerError || err instanceof ParseError || err instanceof RuntimeError) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}

main();

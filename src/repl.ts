import * as readline from "readline";
import { Lexer, LexerError } from "./lexer";
import { Parser, ParseError } from "./parser";
import { Interpreter, RuntimeError } from "./interpreter";

// Parse CLI arguments for --strict flag
const strictFlag = process.argv.includes("--strict");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const interpreter = new Interpreter(strictFlag);

function run(source: string): void {
  try {
    const lexer = new Lexer(source);
    const tokens = lexer.scanTokens();
    const parser = new Parser(tokens);
    const program = parser.parse();

    // File-level #strict pragma can also enable strict mode
    if (program.strict && !interpreter.strictMode) {
      interpreter.strictMode = true;
    }

    const result = interpreter.interpret(program);
    if (result !== null) {
      console.log(formatValue(result));
    }
  } catch (err) {
    if (err instanceof LexerError || err instanceof ParseError || err instanceof RuntimeError) {
      console.error(`Error: ${err.message}`);
    } else {
      throw err;
    }
  }
}

function formatValue(val: unknown): string {
  if (val === null) return "null";
  if (Array.isArray(val)) return `[${val.map(formatValue).join(", ")}]`;
  if (typeof val === "object" && val !== null && "kind" in val) {
    const obj = val as { kind: string; elements?: unknown[]; fields?: Map<string, unknown> };
    if (obj.kind === "tuple" && obj.elements) {
      return `(${obj.elements.map(formatValue).join(", ")})`;
    }
    if (obj.kind === "record" && obj.fields) {
      const entries = Array.from(obj.fields.entries())
        .map(([k, v]) => `${k}: ${formatValue(v)}`)
        .join(", ");
      return `{ ${entries} }`;
    }
    return "<function>";
  }
  return String(val);
}

function prompt(): void {
  rl.question("lea> ", (line) => {
    if (line === null || line === ".exit" || line === "exit") {
      console.log("Goodbye!");
      rl.close();
      return;
    }

    if (line.trim()) {
      run(line);
    }

    prompt();
  });
}

console.log("Lea Language REPL" + (strictFlag ? " (strict mode)" : ""));
console.log("Type expressions or statements. Type 'exit' to quit.\n");
prompt();

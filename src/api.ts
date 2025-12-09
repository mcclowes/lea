/**
 * TypeScript API for Lea
 *
 * Provides a tagged template literal for embedding Lea code in TypeScript
 * with support for JavaScript value and function interpolation.
 *
 * @example
 * ```typescript
 * import { lea } from 'lea-lang';
 *
 * const data = [1, 2, 3, 4, 5];
 * const threshold = 2;
 *
 * const result = lea`
 *   ${data}
 *     /> filter((x) -> x > ${threshold})
 *     /> map((x) -> x * x)
 *     /> reduce(0, (acc, x) -> acc + x)
 * `;
 * // result = 50
 * ```
 */

import { Lexer, LexerError } from "./lexer";
import { Parser, ParseError } from "./parser";
import { Interpreter, RuntimeError, Environment, LeaValue, LeaBuiltin } from "./interpreter";

/**
 * Convert a JavaScript value to a Lea value
 */
function jsToLea(value: unknown): LeaValue {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "function") {
    // Wrap JS function as a Lea builtin
    const builtin: LeaBuiltin = {
      kind: "builtin",
      fn: (args: LeaValue[]) => {
        const jsArgs = args.map(leaToJs);
        const result = (value as Function)(...jsArgs);
        return jsToLea(result);
      },
    };
    return builtin;
  }

  if (Array.isArray(value)) {
    return value.map(jsToLea);
  }

  if (typeof value === "object") {
    // Convert plain object to Lea record
    const fields = new Map<string, LeaValue>();
    for (const [key, val] of Object.entries(value)) {
      fields.set(key, jsToLea(val));
    }
    return { kind: "record", fields };
  }

  // Fallback - return as-is and hope for the best
  return value as LeaValue;
}

/**
 * Convert a Lea value to a JavaScript value
 */
function leaToJs(value: LeaValue): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(leaToJs);
  }

  if (typeof value === "object" && "kind" in value) {
    switch (value.kind) {
      case "record":
        const obj: Record<string, unknown> = {};
        for (const [key, val] of value.fields) {
          obj[key] = leaToJs(val);
        }
        return obj;

      case "tuple":
        return value.elements.map(leaToJs);

      case "promise":
        return value.promise.then(leaToJs);

      case "function":
      case "builtin":
        // Return a JS wrapper function
        return (...args: unknown[]) => {
          // This is a simplified wrapper - full implementation would need interpreter context
          console.warn("Calling Lea functions from JS is not fully supported yet");
          return null;
        };

      default:
        return value;
    }
  }

  return value;
}

/**
 * Tagged template literal for Lea code with JS interpolation
 *
 * @example
 * ```typescript
 * const nums = [1, 2, 3];
 * const result = lea`${nums} /> map((x) -> x * 2) /> print`;
 * ```
 */
export function lea(strings: TemplateStringsArray, ...values: unknown[]): unknown {
  // Generate unique placeholder names for interpolated values
  const placeholders: string[] = values.map((_, i) => `__lea_interop_${i}__`);

  // Build the Lea source by interleaving strings and placeholder names
  let source = "";
  for (let i = 0; i < strings.length; i++) {
    source += strings[i];
    if (i < placeholders.length) {
      source += placeholders[i];
    }
  }

  // Parse and run
  const lexer = new Lexer(source);
  const tokens = lexer.scanTokens();
  const parser = new Parser(tokens);
  const program = parser.parse();

  const interpreter = new Interpreter(false);

  // Inject interpolated values into the environment
  for (let i = 0; i < values.length; i++) {
    interpreter.defineGlobal(placeholders[i], jsToLea(values[i]));
  }

  // Execute and return result
  const result = interpreter.interpret(program);
  return leaToJs(result);
}

/**
 * Async version of lea tagged template for code with await
 *
 * @example
 * ```typescript
 * const result = await leaAsync`
 *   await delay(100)
 *   "done" /> print
 * `;
 * ```
 */
export async function leaAsync(strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown> {
  const placeholders: string[] = values.map((_, i) => `__lea_interop_${i}__`);

  let source = "";
  for (let i = 0; i < strings.length; i++) {
    source += strings[i];
    if (i < placeholders.length) {
      source += placeholders[i];
    }
  }

  const lexer = new Lexer(source);
  const tokens = lexer.scanTokens();
  const parser = new Parser(tokens);
  const program = parser.parse();

  const interpreter = new Interpreter(false);

  for (let i = 0; i < values.length; i++) {
    interpreter.defineGlobal(placeholders[i], jsToLea(values[i]));
  }

  const result = await interpreter.interpretAsync(program);
  return leaToJs(result);
}

/**
 * Create a Lea execution context with pre-defined bindings
 *
 * @example
 * ```typescript
 * const ctx = createLea({
 *   data: [1, 2, 3],
 *   double: (x: number) => x * 2,
 * });
 *
 * const result = ctx.run(`data /> map(double)`);
 * ```
 */
export function createLea(bindings: Record<string, unknown> = {}) {
  return {
    /**
     * Run Lea code synchronously
     */
    run(source: string): unknown {
      const lexer = new Lexer(source);
      const tokens = lexer.scanTokens();
      const parser = new Parser(tokens);
      const program = parser.parse();

      const interpreter = new Interpreter(false);

      // Inject bindings
      for (const [name, value] of Object.entries(bindings)) {
        interpreter.defineGlobal(name, jsToLea(value));
      }

      const result = interpreter.interpret(program);
      return leaToJs(result);
    },

    /**
     * Run Lea code asynchronously (supports await)
     */
    async runAsync(source: string): Promise<unknown> {
      const lexer = new Lexer(source);
      const tokens = lexer.scanTokens();
      const parser = new Parser(tokens);
      const program = parser.parse();

      const interpreter = new Interpreter(false);

      for (const [name, value] of Object.entries(bindings)) {
        interpreter.defineGlobal(name, jsToLea(value));
      }

      const result = await interpreter.interpretAsync(program);
      return leaToJs(result);
    },

    /**
     * Add a binding to the context
     */
    set(name: string, value: unknown): void {
      bindings[name] = value;
    },

    /**
     * Get current bindings
     */
    get bindings(): Record<string, unknown> {
      return { ...bindings };
    },
  };
}

// Re-export error types for consumers
export { LexerError } from "./lexer";
export { ParseError } from "./parser";
export { RuntimeError } from "./interpreter";

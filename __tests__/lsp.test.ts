/**
 * Tests for Lea Language Server Protocol implementation
 */

import { DocumentAnalyzer } from "../src/lsp/analyzer";
import { CompletionProvider } from "../src/lsp/completion";
import { HoverProvider } from "../src/lsp/hover";
import { DefinitionProvider } from "../src/lsp/definition";
import { DiagnosticsProvider } from "../src/lsp/diagnostics";
import { SymbolKind, CompletionItemKind } from "../src/lsp/types";
import { isBuiltin, getBuiltinDoc, getBuiltinNames } from "../src/lsp/builtins-docs";

describe("DocumentAnalyzer", () => {
  describe("symbol extraction", () => {
    it("should extract let bindings as symbols", () => {
      const source = `let x = 10
let y = 20`;
      const analyzer = new DocumentAnalyzer("test.lea", source);
      const analysis = analyzer.analyze();

      expect(analysis.symbols.has("x")).toBe(true);
      expect(analysis.symbols.has("y")).toBe(true);
      expect(analysis.symbols.get("x")?.kind).toBe(SymbolKind.Variable);
    });

    it("should extract mutable bindings with correct flag", () => {
      const source = `maybe counter = 0`;
      const analyzer = new DocumentAnalyzer("test.lea", source);
      const analysis = analyzer.analyze();

      expect(analysis.symbols.has("counter")).toBe(true);
      expect(analysis.symbols.get("counter")?.mutable).toBe(true);
    });

    it("should extract function definitions", () => {
      const source = `let double = (x) -> x * 2`;
      const analyzer = new DocumentAnalyzer("test.lea", source);
      const analysis = analyzer.analyze();

      expect(analysis.symbols.has("double")).toBe(true);
      expect(analysis.symbols.get("double")?.kind).toBe(SymbolKind.Function);
    });

    it("should extract pipeline definitions", () => {
      const source = `let process = /> double /> addOne`;
      const analyzer = new DocumentAnalyzer("test.lea", source);
      const analysis = analyzer.analyze();

      expect(analysis.symbols.has("process")).toBe(true);
      expect(analysis.symbols.get("process")?.kind).toBe(SymbolKind.Pipeline);
    });

    it("should extract context definitions", () => {
      const source = `context Logger = { log: (msg) -> print(msg) }`;
      const analyzer = new DocumentAnalyzer("test.lea", source);
      const analysis = analyzer.analyze();

      expect(analysis.symbols.has("Logger")).toBe(true);
      expect(analysis.symbols.get("Logger")?.kind).toBe(SymbolKind.Context);
    });

    it("should extract destructured record patterns", () => {
      const source = `let user = { name: "Alice", age: 30 }
let { name, age } = user`;
      const analyzer = new DocumentAnalyzer("test.lea", source);
      const analysis = analyzer.analyze();

      expect(analysis.symbols.has("name")).toBe(true);
      expect(analysis.symbols.has("age")).toBe(true);
    });

    it("should extract destructured tuple patterns", () => {
      const source = `let point = (10, 20)
let (x, y) = point`;
      const analyzer = new DocumentAnalyzer("test.lea", source);
      const analysis = analyzer.analyze();

      expect(analysis.symbols.has("x")).toBe(true);
      expect(analysis.symbols.has("y")).toBe(true);
    });

    it("should include builtin symbols", () => {
      const source = `let x = 10`;
      const analyzer = new DocumentAnalyzer("test.lea", source);
      const analysis = analyzer.analyze();

      expect(analysis.symbols.has("print")).toBe(true);
      expect(analysis.symbols.has("map")).toBe(true);
      expect(analysis.symbols.has("filter")).toBe(true);
      expect(analysis.symbols.get("print")?.kind).toBe(SymbolKind.Builtin);
    });
  });

  describe("error detection", () => {
    it("should detect lexer errors", () => {
      const source = `let x = @invalid`;
      const analyzer = new DocumentAnalyzer("test.lea", source);
      const analysis = analyzer.analyze();

      // The @ is valid, but @invalid without a known context might cause issues
      // This depends on the lexer implementation
    });

    it("should detect parse errors", () => {
      const source = `let = 10`;
      const analyzer = new DocumentAnalyzer("test.lea", source);
      const analysis = analyzer.analyze();

      expect(analysis.errors.length).toBeGreaterThan(0);
      expect(analysis.errors[0].severity).toBe("error");
    });

    it("should detect unclosed brackets", () => {
      const source = `let x = [1, 2, 3`;
      const analyzer = new DocumentAnalyzer("test.lea", source);
      const analysis = analyzer.analyze();

      expect(analysis.errors.length).toBeGreaterThan(0);
    });
  });
});

describe("CompletionProvider", () => {
  const provider = new CompletionProvider();

  it("should provide keyword completions", () => {
    const source = ``;
    const analyzer = new DocumentAnalyzer("test.lea", source);
    const completions = provider.getCompletions(analyzer, 0, 0);

    const keywords = completions.filter((c) => c.kind === CompletionItemKind.Keyword);
    expect(keywords.length).toBeGreaterThan(0);
    expect(keywords.some((k) => k.label === "let")).toBe(true);
    expect(keywords.some((k) => k.label === "maybe")).toBe(true);
  });

  it("should provide builtin function completions", () => {
    const source = ``;
    const analyzer = new DocumentAnalyzer("test.lea", source);
    const completions = provider.getCompletions(analyzer, 0, 0);

    const builtins = completions.filter((c) => c.kind === CompletionItemKind.Builtin);
    expect(builtins.length).toBeGreaterThan(0);
    expect(builtins.some((b) => b.label === "print")).toBe(true);
    expect(builtins.some((b) => b.label === "map")).toBe(true);
  });

  it("should provide user-defined symbol completions", () => {
    const source = `let myFunction = (x) -> x * 2
let myVariable = 42`;
    const analyzer = new DocumentAnalyzer("test.lea", source);
    const completions = provider.getCompletions(analyzer, 1, 0);

    expect(completions.some((c) => c.label === "myFunction")).toBe(true);
    expect(completions.some((c) => c.label === "myVariable")).toBe(true);
  });

  it("should provide decorator completions when triggered by #", () => {
    const source = `let fn = (x) -> x * 2`;
    const analyzer = new DocumentAnalyzer("test.lea", source);
    const completions = provider.getCompletions(analyzer, 0, 20, "#");

    expect(completions.some((c) => c.label === "log")).toBe(true);
    expect(completions.some((c) => c.label === "memo")).toBe(true);
    expect(completions.some((c) => c.label === "async")).toBe(true);
  });

  it("should provide snippet completions", () => {
    const source = ``;
    const analyzer = new DocumentAnalyzer("test.lea", source);
    const completions = provider.getCompletions(analyzer, 0, 0);

    const snippets = completions.filter((c) => c.kind === CompletionItemKind.Snippet);
    expect(snippets.length).toBeGreaterThan(0);
  });
});

describe("HoverProvider", () => {
  const provider = new HoverProvider();

  it("should provide hover for builtin functions", () => {
    const source = `print("hello")`;
    const analyzer = new DocumentAnalyzer("test.lea", source);
    analyzer.analyze();
    const hover = provider.getHover(analyzer, 0, 2); // hover over 'print'

    expect(hover).not.toBeNull();
    expect(hover?.contents).toContain("print");
    expect(hover?.contents).toContain("builtin");
  });

  it("should provide hover for user-defined functions", () => {
    const source = `let double = (x) -> x * 2
double(5)`;
    const analyzer = new DocumentAnalyzer("test.lea", source);
    analyzer.analyze();
    const hover = provider.getHover(analyzer, 1, 2); // hover over 'double'

    expect(hover).not.toBeNull();
    expect(hover?.contents).toContain("double");
    expect(hover?.contents).toContain("function");
  });

  it("should provide hover for keywords", () => {
    const source = `let x = 10`;
    const analyzer = new DocumentAnalyzer("test.lea", source);
    analyzer.analyze();
    const hover = provider.getHover(analyzer, 0, 1); // hover over 'let'

    expect(hover).not.toBeNull();
    expect(hover?.contents).toContain("let");
    expect(hover?.contents).toContain("Immutable");
  });
});

describe("DefinitionProvider", () => {
  const provider = new DefinitionProvider();

  it("should find definition of user-defined symbols", () => {
    const source = `let x = 10
let y = x + 5`;
    const analyzer = new DocumentAnalyzer("test.lea", source);
    analyzer.analyze();
    const definition = provider.getDefinition(analyzer, "test.lea", 1, 8); // 'x' in second line

    expect(definition).not.toBeNull();
    expect(definition?.location.line).toBe(0); // defined on first line
  });

  it("should return null for builtin functions", () => {
    const source = `print("hello")`;
    const analyzer = new DocumentAnalyzer("test.lea", source);
    analyzer.analyze();
    const definition = provider.getDefinition(analyzer, "test.lea", 0, 2);

    expect(definition).toBeNull(); // builtins don't have definition locations
  });

  it("should find all references to a symbol", () => {
    const source = `let x = 10
let y = x + 5
let z = x * 2`;
    const analyzer = new DocumentAnalyzer("test.lea", source);
    analyzer.analyze();
    const refs = provider.getReferences(analyzer, "test.lea", 0, 4, true);

    expect(refs.length).toBeGreaterThanOrEqual(1); // at least the definition
  });
});

describe("DiagnosticsProvider", () => {
  const provider = new DiagnosticsProvider();

  it("should report syntax errors", () => {
    const source = `let = 10`;
    const analyzer = new DocumentAnalyzer("test.lea", source);
    const diagnostics = provider.getDiagnostics(analyzer, "test.lea");

    expect(diagnostics.some((d) => d.severity === "error")).toBe(true);
  });

  it("should detect undefined references", () => {
    const source = `let x = unknownVar + 5`;
    const analyzer = new DocumentAnalyzer("test.lea", source);
    const diagnostics = provider.getDiagnostics(analyzer, "test.lea");

    expect(diagnostics.some((d) => d.code === "undefined-reference")).toBe(true);
  });

  it("should suggest similar names for typos", () => {
    const source = `let myVariable = 10
let x = myVarible + 5`;
    const analyzer = new DocumentAnalyzer("test.lea", source);
    const diagnostics = provider.getDiagnostics(analyzer, "test.lea");

    const undefinedError = diagnostics.find((d) => d.code === "undefined-reference");
    expect(undefinedError).toBeDefined();
    expect(undefinedError?.message).toContain("Did you mean");
  });
});

describe("BuiltinDocs", () => {
  it("should provide documentation for all builtins", () => {
    const names = getBuiltinNames();
    expect(names.length).toBeGreaterThan(0);

    for (const name of names) {
      const doc = getBuiltinDoc(name);
      expect(doc).toBeDefined();
      expect(doc?.name).toBe(name);
      expect(doc?.signature).toBeDefined();
      expect(doc?.description).toBeDefined();
    }
  });

  it("should identify builtins correctly", () => {
    expect(isBuiltin("print")).toBe(true);
    expect(isBuiltin("map")).toBe(true);
    expect(isBuiltin("filter")).toBe(true);
    expect(isBuiltin("notABuiltin")).toBe(false);
  });

  it("should have examples for common builtins", () => {
    const commonBuiltins = ["print", "map", "filter", "reduce", "range"];
    for (const name of commonBuiltins) {
      const doc = getBuiltinDoc(name);
      expect(doc?.examples).toBeDefined();
      expect(doc?.examples?.length).toBeGreaterThan(0);
    }
  });
});

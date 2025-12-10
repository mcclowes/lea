/**
 * Lea Language Server
 *
 * Main entry point for the Lea Language Server Protocol implementation.
 * This server provides IDE features for Lea:
 * - Autocomplete for builtins and user definitions
 * - Go-to-definition
 * - Hover documentation
 * - Real-time error diagnostics
 */

import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  CompletionItem,
  CompletionItemKind as VSCodeCompletionItemKind,
  Hover,
  MarkupKind,
  Definition,
  Location,
  Range,
  Position,
  Diagnostic as VSCodeDiagnostic,
  DiagnosticSeverity,
  DocumentHighlight,
  DocumentHighlightKind,
  TextEdit,
  WorkspaceEdit,
  RenameParams,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import { DocumentAnalyzer } from "./analyzer";
import { CompletionProvider } from "./completion";
import { HoverProvider } from "./hover";
import { DefinitionProvider } from "./definition";
import { DiagnosticsProvider } from "./diagnostics";
import { CompletionItemKind, SymbolKind } from "./types";

// Create a connection for the server using Node's IPC
const connection = createConnection(ProposedFeatures.all);

// Create a document manager
const documents = new TextDocuments(TextDocument);

// Create providers
const completionProvider = new CompletionProvider();
const hoverProvider = new HoverProvider();
const definitionProvider = new DefinitionProvider();
const diagnosticsProvider = new DiagnosticsProvider();

// Cache of document analyzers
const analyzerCache = new Map<string, { analyzer: DocumentAnalyzer; version: number }>();

/**
 * Get or create an analyzer for a document
 */
function getAnalyzer(document: TextDocument): DocumentAnalyzer {
  const cached = analyzerCache.get(document.uri);
  if (cached && cached.version === document.version) {
    return cached.analyzer;
  }

  const analyzer = new DocumentAnalyzer(document.uri, document.getText(), document.version);
  analyzerCache.set(document.uri, { analyzer, version: document.version });
  return analyzer;
}

/**
 * Convert our completion kind to VSCode completion kind
 */
function toVSCodeCompletionKind(kind: CompletionItemKind): VSCodeCompletionItemKind {
  switch (kind) {
    case CompletionItemKind.Function:
      return VSCodeCompletionItemKind.Function;
    case CompletionItemKind.Variable:
      return VSCodeCompletionItemKind.Variable;
    case CompletionItemKind.Keyword:
      return VSCodeCompletionItemKind.Keyword;
    case CompletionItemKind.Operator:
      return VSCodeCompletionItemKind.Operator;
    case CompletionItemKind.Snippet:
      return VSCodeCompletionItemKind.Snippet;
    case CompletionItemKind.Builtin:
      return VSCodeCompletionItemKind.Function;
    case CompletionItemKind.Module:
      return VSCodeCompletionItemKind.Module;
    case CompletionItemKind.Property:
      return VSCodeCompletionItemKind.Property;
    case CompletionItemKind.Decorator:
      return VSCodeCompletionItemKind.Keyword;
    default:
      return VSCodeCompletionItemKind.Text;
  }
}

/**
 * Convert diagnostic severity
 */
function toVSCodeSeverity(severity: "error" | "warning" | "info" | "hint"): DiagnosticSeverity {
  switch (severity) {
    case "error":
      return DiagnosticSeverity.Error;
    case "warning":
      return DiagnosticSeverity.Warning;
    case "info":
      return DiagnosticSeverity.Information;
    case "hint":
      return DiagnosticSeverity.Hint;
  }
}

// Initialize the server
connection.onInitialize((params: InitializeParams): InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: [".", "#", "@", "/"],
      },
      hoverProvider: true,
      definitionProvider: true,
      referencesProvider: true,
      documentHighlightProvider: true,
      renameProvider: {
        prepareProvider: true,
      },
    },
  };
});

// Handle completion requests
connection.onCompletion((params): CompletionItem[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  const analyzer = getAnalyzer(document);
  const line = params.position.line;
  const column = params.position.character;

  // Get trigger character if any
  const text = document.getText();
  const offset = document.offsetAt(params.position);
  const triggerChar = offset > 0 ? text[offset - 1] : undefined;

  const completions = completionProvider.getCompletions(analyzer, line, column, triggerChar);

  return completions.map((item) => ({
    label: item.label,
    kind: toVSCodeCompletionKind(item.kind),
    detail: item.detail,
    documentation: item.documentation
      ? { kind: MarkupKind.Markdown, value: item.documentation }
      : undefined,
    insertText: item.insertText,
    sortText: item.sortText,
    filterText: item.filterText,
  }));
});

// Handle hover requests
connection.onHover((params): Hover | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  const analyzer = getAnalyzer(document);
  const hoverInfo = hoverProvider.getHover(analyzer, params.position.line, params.position.character);

  if (!hoverInfo) return null;

  return {
    contents: { kind: MarkupKind.Markdown, value: hoverInfo.contents },
    range: hoverInfo.range
      ? Range.create(
          Position.create(hoverInfo.range.line, hoverInfo.range.column),
          Position.create(
            hoverInfo.range.endLine ?? hoverInfo.range.line,
            hoverInfo.range.endColumn ?? hoverInfo.range.column + 1
          )
        )
      : undefined,
  };
});

// Handle go-to-definition requests
connection.onDefinition((params): Definition | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  const analyzer = getAnalyzer(document);
  const definition = definitionProvider.getDefinition(
    analyzer,
    params.textDocument.uri,
    params.position.line,
    params.position.character
  );

  if (!definition) return null;

  return Location.create(
    definition.uri,
    Range.create(
      Position.create(definition.location.line, definition.location.column),
      Position.create(
        definition.location.endLine ?? definition.location.line,
        definition.location.endColumn ?? definition.location.column + 1
      )
    )
  );
});

// Handle find references requests
connection.onReferences((params): Location[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  const analyzer = getAnalyzer(document);
  const references = definitionProvider.getReferences(
    analyzer,
    params.textDocument.uri,
    params.position.line,
    params.position.character,
    params.context.includeDeclaration
  );

  return references.map((ref) =>
    Location.create(
      ref.uri,
      Range.create(
        Position.create(ref.location.line, ref.location.column),
        Position.create(
          ref.location.endLine ?? ref.location.line,
          ref.location.endColumn ?? ref.location.column + 1
        )
      )
    )
  );
});

// Handle document highlight requests
connection.onDocumentHighlight((params): DocumentHighlight[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  const analyzer = getAnalyzer(document);
  const highlights = definitionProvider.getDocumentHighlights(
    analyzer,
    params.position.line,
    params.position.character
  );

  return highlights.map((h) => ({
    range: Range.create(
      Position.create(h.location.line, h.location.column),
      Position.create(
        h.location.endLine ?? h.location.line,
        h.location.endColumn ?? h.location.column + 1
      )
    ),
    kind: h.kind === "write" ? DocumentHighlightKind.Write : DocumentHighlightKind.Read,
  }));
});

// Handle prepare rename requests
connection.onPrepareRename((params): Range | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  const analyzer = getAnalyzer(document);
  const locations = definitionProvider.getRenameLocations(
    analyzer,
    params.position.line,
    params.position.character
  );

  if (!locations || locations.length === 0) return null;

  // Return the range of the symbol being renamed
  const firstLoc = locations[0];
  return Range.create(
    Position.create(firstLoc.location.line, firstLoc.location.column),
    Position.create(firstLoc.location.line, firstLoc.location.column + firstLoc.length)
  );
});

// Handle rename requests
connection.onRenameRequest((params: RenameParams): WorkspaceEdit | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  const analyzer = getAnalyzer(document);
  const locations = definitionProvider.getRenameLocations(
    analyzer,
    params.position.line,
    params.position.character
  );

  if (!locations || locations.length === 0) return null;

  const edits: TextEdit[] = locations.map((loc) => ({
    range: Range.create(
      Position.create(loc.location.line, loc.location.column),
      Position.create(loc.location.line, loc.location.column + loc.length)
    ),
    newText: params.newName,
  }));

  return {
    changes: {
      [params.textDocument.uri]: edits,
    },
  };
});

// Validate documents when they change
async function validateDocument(document: TextDocument): Promise<void> {
  const analyzer = getAnalyzer(document);
  const diagnostics = diagnosticsProvider.getDiagnostics(analyzer, document.uri);

  const vscodeDiagnostics: VSCodeDiagnostic[] = diagnostics.map((d) => ({
    range: Range.create(
      Position.create(d.range.start.line, d.range.start.character),
      Position.create(d.range.end.line, d.range.end.character)
    ),
    message: d.message,
    severity: toVSCodeSeverity(d.severity),
    code: d.code,
    source: d.source,
  }));

  connection.sendDiagnostics({ uri: document.uri, diagnostics: vscodeDiagnostics });
}

// Document change handlers
documents.onDidChangeContent((change) => {
  // Clear the analyzer cache for this document
  analyzerCache.delete(change.document.uri);
  validateDocument(change.document);
});

documents.onDidClose((event) => {
  // Clear diagnostics and cache when a document is closed
  analyzerCache.delete(event.document.uri);
  connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

// Start listening
documents.listen(connection);
connection.listen();

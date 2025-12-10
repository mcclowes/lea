/**
 * Lea Language Server Protocol (LSP) Implementation
 *
 * This module provides IDE features for Lea:
 * - Autocomplete for builtins and user definitions
 * - Go-to-definition
 * - Hover documentation
 * - Real-time error diagnostics
 *
 * Usage:
 *   Start the server:
 *     node dist/lsp/server.js --stdio
 *
 *   Or use programmatically:
 *     import { DocumentAnalyzer, CompletionProvider, HoverProvider } from './lsp';
 */

// Export types
export * from "./types";

// Export providers
export { DocumentAnalyzer } from "./analyzer";
export { CompletionProvider } from "./completion";
export { HoverProvider } from "./hover";
export { DefinitionProvider } from "./definition";
export { DiagnosticsProvider, Diagnostic, DiagnosticSeverity } from "./diagnostics";

// Export builtin documentation
export { BUILTIN_DOCS, getBuiltinDoc, getBuiltinNames, isBuiltin } from "./builtins-docs";

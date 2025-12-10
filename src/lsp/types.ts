/**
 * LSP Types and Interfaces for Lea Language Server
 *
 * This module defines the core types used by the Lea LSP server.
 */

import { Expr, Stmt, FunctionExpr, TypeSignature, Decorator } from "../ast";

/**
 * Source location information for a symbol
 */
export interface SourceLocation {
  line: number;      // 0-indexed line number
  column: number;    // 0-indexed column number
  endLine?: number;
  endColumn?: number;
}

/**
 * Represents a symbol (variable, function, etc.) in the document
 */
export interface LeaSymbol {
  name: string;
  kind: SymbolKind;
  location: SourceLocation;
  type?: string;                    // Type annotation if available
  typeSignature?: TypeSignature;    // Full type signature for functions
  documentation?: string;           // Documentation/comments
  mutable?: boolean;                // For variables: is it mutable (maybe)?
  decorators?: Decorator[];         // Decorators attached to the symbol
  params?: FunctionParam[];         // For functions: parameter info
  exported?: boolean;               // Is this symbol exported?
  definitionLocation?: SourceLocation;  // Where this symbol is defined
}

/**
 * Function parameter information
 */
export interface FunctionParam {
  name: string;
  type?: string;
  defaultValue?: string;  // String representation of default value
}

/**
 * Symbol kinds in Lea
 */
export enum SymbolKind {
  Variable = "variable",
  Function = "function",
  Parameter = "parameter",
  Context = "context",
  Builtin = "builtin",
  Pipeline = "pipeline",
  Record = "record",
  Module = "module",
  Decorator = "decorator",
}

/**
 * Built-in function documentation
 */
export interface BuiltinDoc {
  name: string;
  signature: string;
  description: string;
  params: { name: string; type: string; description: string }[];
  returns: { type: string; description: string };
  examples?: string[];
}

/**
 * Analysis result for a document
 */
export interface DocumentAnalysis {
  uri: string;
  version: number;
  symbols: Map<string, LeaSymbol>;     // All symbols defined in the document
  references: SymbolReference[];        // All symbol references
  scopes: Scope[];                      // Scope information
  errors: DiagnosticError[];            // Parse/analysis errors
  imports: ImportInfo[];                // Module imports
}

/**
 * A reference to a symbol in the document
 */
export interface SymbolReference {
  name: string;
  location: SourceLocation;
  definitionLocation?: SourceLocation;
  isDefinition: boolean;
}

/**
 * Scope information for nested scopes
 */
export interface Scope {
  start: SourceLocation;
  end: SourceLocation;
  parent?: Scope;
  symbols: Map<string, LeaSymbol>;
}

/**
 * Module import information
 */
export interface ImportInfo {
  path: string;
  location: SourceLocation;
  importedNames: string[];
  isReexport: boolean;
}

/**
 * Diagnostic error information
 */
export interface DiagnosticError {
  message: string;
  location: SourceLocation;
  severity: "error" | "warning" | "info" | "hint";
  code?: string;
  suggestions?: string[];
}

/**
 * Completion item with Lea-specific information
 */
export interface LeaCompletionItem {
  label: string;
  kind: CompletionItemKind;
  detail?: string;
  documentation?: string;
  insertText?: string;
  sortText?: string;
  filterText?: string;
}

/**
 * Completion item kinds
 */
export enum CompletionItemKind {
  Function = "function",
  Variable = "variable",
  Keyword = "keyword",
  Operator = "operator",
  Snippet = "snippet",
  Builtin = "builtin",
  Module = "module",
  Property = "property",
  Decorator = "decorator",
}

/**
 * Hover information
 */
export interface HoverInfo {
  contents: string;        // Markdown content
  range?: SourceLocation;  // Range of the hovered element
}

/**
 * Definition location
 */
export interface DefinitionInfo {
  uri: string;
  location: SourceLocation;
}

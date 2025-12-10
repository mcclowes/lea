/**
 * Diagnostics Provider for Lea Language Server
 *
 * Provides real-time error diagnostics for Lea code.
 */

import { DocumentAnalyzer } from "./analyzer";
import { DiagnosticError, SourceLocation, SymbolKind } from "./types";
import { isBuiltin } from "./builtins-docs";

/**
 * Diagnostic severity levels
 */
export type DiagnosticSeverity = "error" | "warning" | "info" | "hint";

/**
 * A diagnostic message
 */
export interface Diagnostic {
  message: string;
  severity: DiagnosticSeverity;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  code?: string;
  source: string;
  relatedInformation?: {
    location: { uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } };
    message: string;
  }[];
}

/**
 * Provides diagnostics for Lea code
 */
export class DiagnosticsProvider {
  /**
   * Get all diagnostics for a document
   */
  getDiagnostics(analyzer: DocumentAnalyzer, uri: string): Diagnostic[] {
    const analysis = analyzer.analyze();
    const diagnostics: Diagnostic[] = [];

    // Convert analysis errors to diagnostics
    for (const error of analysis.errors) {
      diagnostics.push(this.errorToDiagnostic(error));
    }

    // Add semantic diagnostics
    diagnostics.push(...this.getSemanticDiagnostics(analysis, uri));

    return diagnostics;
  }

  /**
   * Convert an analysis error to a diagnostic
   */
  private errorToDiagnostic(error: DiagnosticError): Diagnostic {
    return {
      message: error.message,
      severity: error.severity,
      range: {
        start: { line: error.location.line, character: error.location.column },
        end: {
          line: error.location.endLine ?? error.location.line,
          character: error.location.endColumn ?? error.location.column + 1,
        },
      },
      code: error.code,
      source: "lea",
    };
  }

  /**
   * Get semantic diagnostics (warnings, hints)
   */
  private getSemanticDiagnostics(
    analysis: {
      symbols: Map<string, { name: string; kind: SymbolKind; mutable?: boolean; exported?: boolean; location: SourceLocation }>;
      references: { name: string; location: SourceLocation; isDefinition: boolean }[];
    },
    uri: string
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Check for unused variables
    diagnostics.push(...this.checkUnusedVariables(analysis));

    // Check for undefined references
    diagnostics.push(...this.checkUndefinedReferences(analysis));

    // Check for shadowed variables
    diagnostics.push(...this.checkShadowedVariables(analysis));

    return diagnostics;
  }

  /**
   * Check for unused variables
   */
  private checkUnusedVariables(analysis: {
    symbols: Map<string, { name: string; kind: SymbolKind; location: SourceLocation }>;
    references: { name: string; isDefinition: boolean }[];
  }): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const referenced = new Set<string>();

    // Collect all referenced names
    for (const ref of analysis.references) {
      if (!ref.isDefinition) {
        referenced.add(ref.name);
      }
    }

    // Check each symbol
    for (const [name, symbol] of analysis.symbols) {
      // Skip builtins, parameters, and exported symbols
      if (symbol.kind === SymbolKind.Builtin) continue;
      if (symbol.kind === SymbolKind.Parameter) continue;
      if ((symbol as { exported?: boolean }).exported) continue;
      if (name.startsWith("_")) continue; // Underscore prefix means intentionally unused

      // Check if the symbol is referenced
      if (!referenced.has(name)) {
        diagnostics.push({
          message: `'${name}' is declared but never used`,
          severity: "hint",
          range: {
            start: { line: symbol.location.line, character: symbol.location.column },
            end: {
              line: symbol.location.line,
              character: symbol.location.column + name.length,
            },
          },
          code: "unused-variable",
          source: "lea",
        });
      }
    }

    return diagnostics;
  }

  /**
   * Check for undefined references
   */
  private checkUndefinedReferences(analysis: {
    symbols: Map<string, { name: string }>;
    references: { name: string; location: SourceLocation; isDefinition: boolean }[];
  }): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const knownNames = new Set<string>([
      ...analysis.symbols.keys(),
      // Built-in names that aren't in symbols
      "input",
      "true",
      "false",
      "null",
      "Pipeline",
    ]);

    for (const ref of analysis.references) {
      if (ref.isDefinition) continue;

      if (!knownNames.has(ref.name) && !isBuiltin(ref.name)) {
        // Check if it might be a typo
        const suggestion = this.findSimilarName(ref.name, knownNames);

        let message = `Cannot find name '${ref.name}'`;
        if (suggestion) {
          message += `. Did you mean '${suggestion}'?`;
        }

        diagnostics.push({
          message,
          severity: "error",
          range: {
            start: { line: ref.location.line, character: ref.location.column },
            end: {
              line: ref.location.line,
              character: ref.location.column + ref.name.length,
            },
          },
          code: "undefined-reference",
          source: "lea",
        });
      }
    }

    return diagnostics;
  }

  /**
   * Check for shadowed variables
   */
  private checkShadowedVariables(analysis: {
    symbols: Map<string, { name: string; kind: SymbolKind; location: SourceLocation }>;
  }): Diagnostic[] {
    // For now, just return empty - proper shadowing detection requires scope analysis
    // which we simplified in the analyzer
    return [];
  }

  /**
   * Find a similar name using Levenshtein distance
   */
  private findSimilarName(name: string, knownNames: Set<string>): string | null {
    let bestMatch: string | null = null;
    let bestDistance = Infinity;
    const maxDistance = Math.floor(name.length / 2) + 1;

    for (const known of knownNames) {
      const distance = this.levenshteinDistance(name.toLowerCase(), known.toLowerCase());
      if (distance < bestDistance && distance <= maxDistance) {
        bestDistance = distance;
        bestMatch = known;
      }
    }

    return bestMatch;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }
}

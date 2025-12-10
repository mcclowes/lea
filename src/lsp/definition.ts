/**
 * Definition Provider for Lea Language Server
 *
 * Provides go-to-definition functionality for Lea code.
 */

import { Token, TokenType } from "../token";
import { DocumentAnalyzer } from "./analyzer";
import { DefinitionInfo, SourceLocation, SymbolKind } from "./types";
import { isBuiltin } from "./builtins-docs";

/**
 * Provides go-to-definition functionality for Lea code
 */
export class DefinitionProvider {
  /**
   * Get the definition location for a symbol at a position
   */
  getDefinition(
    analyzer: DocumentAnalyzer,
    uri: string,
    line: number,
    column: number
  ): DefinitionInfo | null {
    const analysis = analyzer.analyze();
    const token = analyzer.getTokenAtPosition(line, column);

    if (!token) {
      return null;
    }

    // Only provide definitions for identifiers
    if (token.type !== TokenType.IDENTIFIER) {
      return null;
    }

    const name = token.lexeme;

    // Builtins don't have definition locations (they're native)
    if (isBuiltin(name)) {
      return null;
    }

    // Look up the symbol
    const symbol = analysis.symbols.get(name);
    if (!symbol) {
      return null;
    }

    // Return the definition location
    if (symbol.definitionLocation) {
      return {
        uri,
        location: symbol.definitionLocation,
      };
    }

    // Fall back to symbol location
    return {
      uri,
      location: symbol.location,
    };
  }

  /**
   * Get all references to a symbol at a position
   */
  getReferences(
    analyzer: DocumentAnalyzer,
    uri: string,
    line: number,
    column: number,
    includeDeclaration: boolean = true
  ): DefinitionInfo[] {
    const analysis = analyzer.analyze();
    const token = analyzer.getTokenAtPosition(line, column);

    if (!token || token.type !== TokenType.IDENTIFIER) {
      return [];
    }

    const name = token.lexeme;
    const results: DefinitionInfo[] = [];

    // Find all references to this symbol
    for (const ref of analysis.references) {
      if (ref.name === name) {
        if (!includeDeclaration && ref.isDefinition) {
          continue;
        }
        results.push({
          uri,
          location: ref.location,
        });
      }
    }

    // Also include the definition if requested
    if (includeDeclaration) {
      const symbol = analysis.symbols.get(name);
      if (symbol && symbol.definitionLocation) {
        // Check if definition is already in results
        const defLoc = symbol.definitionLocation;
        const alreadyIncluded = results.some(
          (r) => r.location.line === defLoc.line && r.location.column === defLoc.column
        );
        if (!alreadyIncluded) {
          results.unshift({
            uri,
            location: defLoc,
          });
        }
      }
    }

    return results;
  }

  /**
   * Highlight all occurrences of a symbol in the document
   */
  getDocumentHighlights(
    analyzer: DocumentAnalyzer,
    line: number,
    column: number
  ): { location: SourceLocation; kind: "read" | "write" }[] {
    const analysis = analyzer.analyze();
    const token = analyzer.getTokenAtPosition(line, column);

    if (!token || token.type !== TokenType.IDENTIFIER) {
      return [];
    }

    const name = token.lexeme;
    const results: { location: SourceLocation; kind: "read" | "write" }[] = [];

    // Add the definition location
    const symbol = analysis.symbols.get(name);
    if (symbol && symbol.definitionLocation) {
      results.push({
        location: symbol.definitionLocation,
        kind: "write",
      });
    }

    // Add all references
    for (const ref of analysis.references) {
      if (ref.name === name && !ref.isDefinition) {
        results.push({
          location: ref.location,
          kind: "read",
        });
      }
    }

    return results;
  }

  /**
   * Rename a symbol and all its references
   */
  getRenameLocations(
    analyzer: DocumentAnalyzer,
    line: number,
    column: number
  ): { location: SourceLocation; length: number }[] | null {
    const analysis = analyzer.analyze();
    const token = analyzer.getTokenAtPosition(line, column);

    if (!token || token.type !== TokenType.IDENTIFIER) {
      return null;
    }

    const name = token.lexeme;

    // Cannot rename builtins
    if (isBuiltin(name)) {
      return null;
    }

    const symbol = analysis.symbols.get(name);
    if (!symbol || symbol.kind === SymbolKind.Builtin) {
      return null;
    }

    const results: { location: SourceLocation; length: number }[] = [];

    // Add the definition
    if (symbol.definitionLocation) {
      results.push({
        location: symbol.definitionLocation,
        length: name.length,
      });
    }

    // Add all references
    for (const ref of analysis.references) {
      if (ref.name === name) {
        results.push({
          location: ref.location,
          length: name.length,
        });
      }
    }

    return results;
  }
}

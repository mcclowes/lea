/**
 * Module loader for the Lea interpreter
 *
 * Handles module resolution, caching, and loading.
 * Supports circular dependency detection and the #export decorator.
 */

import * as fs from "fs";
import * as path from "path";
import { Lexer } from "../lexer";
import { Parser } from "../parser";
import { Expr, Stmt } from "../ast";
import {
  LeaValue,
  LeaBuiltin,
  LeaRecord,
  RuntimeError,
  Environment,
} from "./types";
import { builtins } from "./builtins";
import { createPipelineGlobal } from "./pipelines";

/**
 * Interface for the interpreter methods needed by the module loader.
 * This avoids circular dependencies.
 */
export interface ModuleExecutor {
  executeStmtAsync(stmt: Stmt, env: Environment): Promise<LeaValue>;
}

/**
 * Module loader class - handles module resolution and loading.
 */
export class ModuleLoader {
  private moduleCache = new Map<string, LeaRecord>();
  private currentFilePath: string | null = null;
  private loadingModules = new Set<string>();
  private executor: ModuleExecutor;

  constructor(executor: ModuleExecutor) {
    this.executor = executor;
  }

  /**
   * Set the current file path for relative module resolution
   */
  setCurrentFile(filePath: string): void {
    this.currentFilePath = path.resolve(filePath);
  }

  /**
   * Get the current file path
   */
  getCurrentFile(): string | null {
    return this.currentFilePath;
  }

  /**
   * Resolve a module path relative to the current file
   */
  resolveModulePath(modulePath: string): string {
    // Add .lea extension if not present
    if (!modulePath.endsWith(".lea")) {
      modulePath = modulePath + ".lea";
    }

    // Resolve relative to current file's directory
    if (this.currentFilePath) {
      const currentDir = path.dirname(this.currentFilePath);
      return path.resolve(currentDir, modulePath);
    }

    // No current file, resolve relative to cwd
    return path.resolve(process.cwd(), modulePath);
  }

  /**
   * Load a module and return its exports as a record
   */
  async loadModule(modulePath: string): Promise<LeaRecord> {
    const resolvedPath = this.resolveModulePath(modulePath);

    // Check cache first
    if (this.moduleCache.has(resolvedPath)) {
      return this.moduleCache.get(resolvedPath)!;
    }

    // Check for circular dependency
    if (this.loadingModules.has(resolvedPath)) {
      throw new RuntimeError(
        `Circular dependency detected: ${modulePath} is already being loaded`
      );
    }

    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      throw new RuntimeError(
        `Module not found: ${modulePath} (resolved to ${resolvedPath})`
      );
    }

    // Mark as loading
    this.loadingModules.add(resolvedPath);

    // Save and update current file
    const previousFilePath = this.currentFilePath;
    this.currentFilePath = resolvedPath;

    try {
      // Read and parse the module
      const source = fs.readFileSync(resolvedPath, "utf-8");
      const lexer = new Lexer(source);
      const tokens = lexer.scanTokens();
      const parser = new Parser(tokens);
      const program = parser.parse();

      // Create a fresh environment for the module
      const moduleEnv = new Environment();

      // Copy builtins to module environment
      for (const [name, fn] of Object.entries(builtins)) {
        moduleEnv.define(name, { kind: "builtin", fn } as LeaBuiltin, false);
      }

      // Add Pipeline global
      moduleEnv.define("Pipeline", createPipelineGlobal(moduleEnv), false);

      // Execute the module's statements and collect exports
      const exports = new Map<string, LeaValue>();

      for (const stmt of program.statements) {
        await this.executor.executeStmtAsync(stmt, moduleEnv);

        // Check if this statement has #export decorator
        if (stmt.kind === "LetStmt" && this.isExported(stmt)) {
          // Handle destructured exports
          if (stmt.pattern) {
            if (stmt.pattern.kind === "RecordPattern") {
              for (const field of stmt.pattern.fields) {
                exports.set(field, moduleEnv.get(field));
              }
            } else if (stmt.pattern.kind === "TuplePattern") {
              for (const name of stmt.pattern.names) {
                exports.set(name, moduleEnv.get(name));
              }
            }
          } else {
            exports.set(stmt.name, moduleEnv.get(stmt.name));
          }
        }
      }

      // Create the module record
      const moduleRecord: LeaRecord = {
        kind: "record",
        fields: exports,
      };

      // Cache the module
      this.moduleCache.set(resolvedPath, moduleRecord);

      return moduleRecord;
    } finally {
      // Restore previous file and remove from loading set
      this.currentFilePath = previousFilePath;
      this.loadingModules.delete(resolvedPath);
    }
  }

  /**
   * Check if a let statement is exported
   * Checks both the statement decorators and the value expression's decorators
   */
  private isExported(stmt: {
    decorators?: { name: string }[];
    value: Expr;
  }): boolean {
    // Check statement-level decorators
    if (stmt.decorators?.some((d) => d.name === "export")) {
      return true;
    }
    // Check expression-level decorators (for functions and pipelines)
    const expr = stmt.value;
    if (
      expr.kind === "FunctionExpr" &&
      expr.decorators.some((d) => d.name === "export")
    ) {
      return true;
    }
    if (
      expr.kind === "PipelineLiteral" &&
      expr.decorators.some((d) => d.name === "export")
    ) {
      return true;
    }
    if (
      expr.kind === "BidirectionalPipelineLiteral" &&
      expr.decorators.some((d) => d.name === "export")
    ) {
      return true;
    }
    return false;
  }

  /**
   * Clear the module cache (useful for testing or hot reloading)
   */
  clearCache(): void {
    this.moduleCache.clear();
  }
}

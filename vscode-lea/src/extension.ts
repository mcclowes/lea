/**
 * Lea Language VSCode Extension
 *
 * This extension provides language support for Lea through the
 * Language Server Protocol (LSP).
 *
 * Features:
 * - Autocomplete for builtins and user definitions
 * - Go-to-definition
 * - Hover documentation
 * - Real-time error diagnostics
 * - Find references
 * - Rename symbol
 * - Document highlighting
 */

import * as path from "path";
import { workspace, ExtensionContext, window } from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  // The server is implemented in the parent lea-lang package
  // Look for the compiled LSP server
  const serverModule = context.asAbsolutePath(
    path.join("..", "dist", "lsp", "server.js")
  );

  // Fallback: try looking in node_modules if installed as a dependency
  const fallbackServerModule = context.asAbsolutePath(
    path.join("node_modules", "lea-lang", "dist", "lsp", "server.js")
  );

  // Check which server path exists
  const fs = require("fs");
  const serverPath = fs.existsSync(serverModule) ? serverModule : fallbackServerModule;

  // Debug output for development
  const outputChannel = window.createOutputChannel("Lea Language Server");
  outputChannel.appendLine(`Lea Language Server starting...`);
  outputChannel.appendLine(`Server path: ${serverPath}`);

  // Server options - run the server as a Node process
  const serverOptions: ServerOptions = {
    run: {
      module: serverPath,
      transport: TransportKind.ipc,
    },
    debug: {
      module: serverPath,
      transport: TransportKind.ipc,
      options: {
        execArgv: ["--nolazy", "--inspect=6009"],
      },
    },
  };

  // Client options - define which documents the server handles
  const clientOptions: LanguageClientOptions = {
    // Register the server for Lea documents
    documentSelector: [{ scheme: "file", language: "lea" }],
    synchronize: {
      // Notify the server about file changes to .lea files
      fileEvents: workspace.createFileSystemWatcher("**/*.lea"),
    },
    outputChannel,
  };

  // Create the language client and start the client
  client = new LanguageClient(
    "leaLanguageServer",
    "Lea Language Server",
    serverOptions,
    clientOptions
  );

  // Start the client, which will also launch the server
  client.start();

  outputChannel.appendLine("Lea Language Server started successfully!");
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

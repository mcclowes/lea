# Server Capabilities

## Initialization Response

```typescript
connection.onInitialize((params: InitializeParams): InitializeResult => {
  return {
    capabilities: {
      // Document sync
      textDocumentSync: TextDocumentSyncKind.Incremental,

      // Completions
      completionProvider: {
        triggerCharacters: [".", "/", "#"],
        resolveProvider: true,
      },

      // Hover
      hoverProvider: true,

      // Signature help
      signatureHelpProvider: {
        triggerCharacters: ["(", ","],
      },

      // Navigation
      definitionProvider: true,
      referencesProvider: true,
      documentHighlightProvider: true,

      // Symbols
      documentSymbolProvider: true,
      workspaceSymbolProvider: true,

      // Formatting
      documentFormattingProvider: true,
      documentRangeFormattingProvider: true,
      documentOnTypeFormattingProvider: {
        firstTriggerCharacter: "}",
        moreTriggerCharacter: [";", "\n"],
      },

      // Code actions
      codeActionProvider: {
        codeActionKinds: [
          CodeActionKind.QuickFix,
          CodeActionKind.Refactor,
        ],
      },

      // Rename
      renameProvider: {
        prepareProvider: true,
      },

      // Folding
      foldingRangeProvider: true,

      // Semantic tokens
      semanticTokensProvider: {
        legend: {
          tokenTypes: ["keyword", "variable", "function"],
          tokenModifiers: ["declaration", "definition"],
        },
        full: true,
        delta: true,
      },
    },
  };
});
```

## Capability Details

### Text Document Sync

```typescript
// Full sync - send entire document on change
textDocumentSync: TextDocumentSyncKind.Full

// Incremental - send only changes
textDocumentSync: TextDocumentSyncKind.Incremental

// Detailed options
textDocumentSync: {
  openClose: true,
  change: TextDocumentSyncKind.Incremental,
  save: { includeText: true },
}
```

### Completion Provider

```typescript
completionProvider: {
  // Characters that trigger completion
  triggerCharacters: [".", "#"],

  // Support resolving additional info
  resolveProvider: true,

  // All commit characters
  allCommitCharacters: ["\t", "\n"],
}
```

### Code Action Provider

```typescript
codeActionProvider: {
  codeActionKinds: [
    CodeActionKind.QuickFix,        // Fix errors
    CodeActionKind.Refactor,        // Refactorings
    CodeActionKind.RefactorExtract, // Extract method/variable
    CodeActionKind.Source,          // Source actions
    CodeActionKind.SourceOrganizeImports,
  ],
  resolveProvider: true,
}
```

## Dynamic Registration

```typescript
// Register capability dynamically
connection.client.register(CompletionRequest.type, {
  documentSelector: [{ language: "lea" }],
  triggerCharacters: ["."],
});
```

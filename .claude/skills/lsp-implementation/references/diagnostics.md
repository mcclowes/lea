# Diagnostic Reporting

## Basic Diagnostics

```typescript
import {
  Diagnostic,
  DiagnosticSeverity,
  Position,
  Range,
} from "vscode-languageserver/node";

function createDiagnostic(
  message: string,
  line: number,
  startChar: number,
  endChar: number,
  severity: DiagnosticSeverity = DiagnosticSeverity.Error
): Diagnostic {
  return {
    severity,
    range: {
      start: { line, character: startChar },
      end: { line, character: endChar },
    },
    message,
    source: "lea",
  };
}
```

## Severity Levels

```typescript
DiagnosticSeverity.Error       // 1 - Red squiggle
DiagnosticSeverity.Warning     // 2 - Yellow squiggle
DiagnosticSeverity.Information // 3 - Blue squiggle
DiagnosticSeverity.Hint        // 4 - Faded text (3 dots)
```

## Publishing Diagnostics

```typescript
documents.onDidChangeContent((change) => {
  validateDocument(change.document);
});

async function validateDocument(document: TextDocument): Promise<void> {
  const diagnostics: Diagnostic[] = [];
  const text = document.getText();

  try {
    parse(text);
  } catch (error) {
    if (error instanceof ParseError) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start: { line: error.line - 1, character: error.column - 1 },
          end: { line: error.line - 1, character: error.column + 10 },
        },
        message: error.message,
        source: "lea",
        code: error.code,
      });
    }
  }

  // Send diagnostics to client
  connection.sendDiagnostics({
    uri: document.uri,
    diagnostics,
  });
}
```

## Diagnostic Tags

```typescript
{
  severity: DiagnosticSeverity.Hint,
  range: unusedVarRange,
  message: "Variable is declared but never used",
  tags: [DiagnosticTag.Unnecessary], // Faded text
}

{
  severity: DiagnosticSeverity.Warning,
  range: deprecatedFnRange,
  message: "Function is deprecated",
  tags: [DiagnosticTag.Deprecated], // Strikethrough
}
```

## Related Information

```typescript
{
  severity: DiagnosticSeverity.Error,
  range: errorRange,
  message: "Type mismatch",
  relatedInformation: [
    {
      location: {
        uri: document.uri,
        range: declarationRange,
      },
      message: "Variable declared as Number here",
    },
  ],
}
```

## Code Actions for Diagnostics

```typescript
connection.onCodeAction((params) => {
  const diagnostics = params.context.diagnostics;
  const actions: CodeAction[] = [];

  for (const diagnostic of diagnostics) {
    if (diagnostic.code === "undeclared-variable") {
      actions.push({
        title: `Declare variable '${diagnostic.data?.name}'`,
        kind: CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        edit: {
          changes: {
            [params.textDocument.uri]: [
              TextEdit.insert(
                { line: 0, character: 0 },
                `let ${diagnostic.data?.name} = undefined\n`
              ),
            ],
          },
        },
      });
    }
  }

  return actions;
});
```

## Clearing Diagnostics

```typescript
// Clear all diagnostics for a document
connection.sendDiagnostics({
  uri: document.uri,
  diagnostics: [],
});
```

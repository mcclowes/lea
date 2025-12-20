# Command Registration

## Defining Commands

### In package.json

```json
{
  "contributes": {
    "commands": [
      {
        "command": "lea.runFile",
        "title": "Run Lea File",
        "category": "Lea",
        "icon": "$(play)"
      },
      {
        "command": "lea.formatDocument",
        "title": "Format Document",
        "category": "Lea"
      }
    ]
  }
}
```

### In extension.ts

```typescript
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  // Simple command
  const runFile = vscode.commands.registerCommand("lea.runFile", () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const code = editor.document.getText();
      // Execute code...
    }
  });

  // Command with arguments
  const runSelection = vscode.commands.registerCommand(
    "lea.runSelection",
    (text?: string) => {
      const code = text || vscode.window.activeTextEditor?.document.getText();
      // Execute code...
    }
  );

  context.subscriptions.push(runFile, runSelection);
}
```

## Keybindings

```json
{
  "contributes": {
    "keybindings": [
      {
        "command": "lea.runFile",
        "key": "ctrl+shift+r",
        "mac": "cmd+shift+r",
        "when": "editorLangId == lea"
      }
    ]
  }
}
```

## Menu Contributions

```json
{
  "contributes": {
    "menus": {
      "editor/context": [
        {
          "command": "lea.runFile",
          "when": "editorLangId == lea",
          "group": "navigation"
        }
      ],
      "editor/title": [
        {
          "command": "lea.runFile",
          "when": "editorLangId == lea",
          "group": "navigation"
        }
      ]
    }
  }
}
```

## Command Palette

Commands automatically appear in Command Palette. Control visibility:

```json
{
  "contributes": {
    "menus": {
      "commandPalette": [
        {
          "command": "lea.runFile",
          "when": "editorLangId == lea"
        }
      ]
    }
  }
}
```

## Executing Commands

```typescript
// Execute your own command
await vscode.commands.executeCommand("lea.runFile");

// Execute built-in command
await vscode.commands.executeCommand("editor.action.formatDocument");

// With arguments
await vscode.commands.executeCommand("lea.runSelection", "print(42)");
```

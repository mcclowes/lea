# Activation Events

## Common Activation Events

```json
{
  "activationEvents": [
    "onLanguage:lea",
    "onCommand:lea.runFile",
    "workspaceContains:**/*.lea",
    "onStartupFinished"
  ]
}
```

## Event Types

### onLanguage

Activates when a file of the specified language is opened.

```json
"activationEvents": ["onLanguage:lea"]
```

### onCommand

Activates when a command is invoked.

```json
"activationEvents": ["onCommand:lea.runFile"]
```

### workspaceContains

Activates when workspace contains matching files.

```json
"activationEvents": ["workspaceContains:**/*.lea"]
```

### onFileSystem

Activates when a file system scheme is accessed.

```json
"activationEvents": ["onFileSystem:lea-virtual"]
```

### onView

Activates when a view is expanded.

```json
"activationEvents": ["onView:leaOutline"]
```

### onUri

Activates when a URI is opened.

```json
"activationEvents": ["onUri"]
```

### onStartupFinished

Activates after VSCode startup is complete.

```json
"activationEvents": ["onStartupFinished"]
```

## Implicit Activation

As of VSCode 1.74+, many contributions implicitly activate:

- `languages` - Files matching the language
- `commands` - When command is invoked
- `grammars` - When grammar is needed

You often don't need explicit activationEvents for these.

## Best Practices

1. **Be specific** - Avoid `*` activation
2. **Lazy load** - Only activate when needed
3. **Combine events** - List multiple for flexibility

```json
{
  "activationEvents": [
    "onLanguage:lea",
    "workspaceContains:**/*.lea"
  ]
}
```

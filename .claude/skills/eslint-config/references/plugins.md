# Popular ESLint Plugins

## TypeScript

### typescript-eslint

The essential TypeScript integration.

```bash
npm install -D @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

```javascript
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...tseslint.configs.recommended,
  // Or stricter
  ...tseslint.configs.strictTypeChecked,
);
```

## Import Management

### eslint-plugin-import

Import/export linting.

```bash
npm install -D eslint-plugin-import
```

```javascript
import importPlugin from "eslint-plugin-import";

export default [
  importPlugin.flatConfigs.recommended,
  {
    rules: {
      "import/order": "error",
      "import/no-cycle": "error",
    },
  },
];
```

## Testing

### eslint-plugin-jest

Jest-specific rules.

```bash
npm install -D eslint-plugin-jest
```

```javascript
import jest from "eslint-plugin-jest";

export default [
  {
    files: ["**/*.test.ts"],
    ...jest.configs["flat/recommended"],
  },
];
```

## Node.js

### eslint-plugin-n

Node.js specific rules.

```bash
npm install -D eslint-plugin-n
```

```javascript
import n from "eslint-plugin-n";

export default [
  n.configs["flat/recommended"],
  {
    rules: {
      "n/no-missing-import": "error",
      "n/no-unsupported-features/es-syntax": "off",
    },
  },
];
```

## Prettier Integration

### eslint-config-prettier

Disables conflicting rules.

```bash
npm install -D eslint-config-prettier
```

```javascript
import prettier from "eslint-config-prettier";

export default [
  // Your rules...
  prettier, // Must be last
];
```

## Unicorn

### eslint-plugin-unicorn

Various powerful rules.

```bash
npm install -D eslint-plugin-unicorn
```

```javascript
import unicorn from "eslint-plugin-unicorn";

export default [
  unicorn.configs["flat/recommended"],
  {
    rules: {
      "unicorn/prevent-abbreviations": "off",
      "unicorn/no-null": "off",
    },
  },
];
```

## Security

### eslint-plugin-security

Security-focused rules.

```bash
npm install -D eslint-plugin-security
```

```javascript
import security from "eslint-plugin-security";

export default [
  security.configs.recommended,
];
```

## JSDoc

### eslint-plugin-jsdoc

JSDoc comment validation.

```bash
npm install -D eslint-plugin-jsdoc
```

```javascript
import jsdoc from "eslint-plugin-jsdoc";

export default [
  jsdoc.configs["flat/recommended-typescript"],
];
```

## Complete Example

```javascript
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
import jest from "eslint-plugin-jest";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  importPlugin.flatConfigs.recommended,
  {
    files: ["**/*.test.ts"],
    ...jest.configs["flat/recommended"],
  },
  prettier,
);
```

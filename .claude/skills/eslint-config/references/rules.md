# Common Rule Configurations

## Code Quality

```javascript
{
  rules: {
    // Enforce consistent code style
    "prefer-const": "error",
    "no-var": "error",
    "eqeqeq": ["error", "always"],

    // Prevent errors
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["error", {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
    }],

    // Code complexity
    "complexity": ["warn", 15],
    "max-depth": ["warn", 4],
    "max-lines-per-function": ["warn", { max: 100 }],
  }
}
```

## TypeScript Specific

```javascript
{
  rules: {
    // Type safety
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-non-null-assertion": "warn",
    "@typescript-eslint/strict-boolean-expressions": "error",

    // Async/Promise handling
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/await-thenable": "error",
    "@typescript-eslint/no-misused-promises": "error",

    // Consistency
    "@typescript-eslint/consistent-type-imports": "error",
    "@typescript-eslint/consistent-type-definitions": ["error", "interface"],

    // Return types
    "@typescript-eslint/explicit-function-return-type": ["error", {
      allowExpressions: true,
      allowTypedFunctionExpressions: true,
    }],
  }
}
```

## Naming Conventions

```javascript
{
  rules: {
    "@typescript-eslint/naming-convention": [
      "error",
      // Interfaces
      { selector: "interface", format: ["PascalCase"] },

      // Type aliases
      { selector: "typeAlias", format: ["PascalCase"] },

      // Enums
      { selector: "enum", format: ["PascalCase"] },
      { selector: "enumMember", format: ["UPPER_CASE"] },

      // Variables
      { selector: "variable", format: ["camelCase", "UPPER_CASE"] },
      { selector: "variable", modifiers: ["const"], format: ["camelCase", "UPPER_CASE", "PascalCase"] },

      // Parameters
      { selector: "parameter", format: ["camelCase"], leadingUnderscore: "allow" },

      // Private members
      { selector: "memberLike", modifiers: ["private"], format: ["camelCase"], leadingUnderscore: "require" },
    ],
  }
}
```

## Import Rules

```javascript
{
  rules: {
    // Import order
    "import/order": ["error", {
      groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
      "newlines-between": "always",
      alphabetize: { order: "asc" },
    }],

    // No default exports
    "import/prefer-default-export": "off",
    "import/no-default-export": "error",

    // Circular dependencies
    "import/no-cycle": "error",
  }
}
```

## Language Interpreter Specific

```javascript
{
  rules: {
    // Allow switch fallthrough for token parsing
    "no-fallthrough": ["error", {
      commentPattern: "falls?\\s*through",
    }],

    // Allow bitwise for flags
    "no-bitwise": "off",

    // Complex functions in interpreters
    "complexity": ["warn", 25],
    "max-depth": ["warn", 6],

    // Large switch statements for AST
    "max-lines-per-function": ["warn", { max: 200 }],
  }
}
```

## Disabling Rules

```javascript
// Inline disable
/* eslint-disable @typescript-eslint/no-explicit-any */
const value: any = something;
/* eslint-enable @typescript-eslint/no-explicit-any */

// Single line
const value: any = something; // eslint-disable-line

// Next line
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const value: any = something;
```

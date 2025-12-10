# Contributing to Lea

Thank you for your interest in contributing to Lea! This guide will help you get started with contributing to this pipe-oriented functional programming language.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

By participating in this project, you agree to maintain a welcoming, inclusive, and harassment-free environment. Be respectful, constructive, and collaborative in all interactions.

## Ways to Contribute

There are many ways to contribute to Lea:

- **Report bugs** — Found something broken? Open an issue
- **Suggest features** — Have an idea? We'd love to hear it
- **Fix bugs** — Browse open issues and submit fixes
- **Add features** — Implement new language features or builtins
- **Improve documentation** — Help make Lea easier to learn
- **Write examples** — Create example programs showcasing Lea's capabilities
- **Add tests** — Improve test coverage
- **Improve the VSCode extension** — Enhance syntax highlighting

## Development Setup

### Prerequisites

- Node.js 18 or higher
- npm

### Getting Started

```bash
# Clone the repository
git clone https://github.com/mcclowes/lea.git
cd lea

# Install dependencies
npm install

# Run the REPL to verify everything works
npm run repl

# Run tests
npm test
```

### Useful Commands

```bash
npm run repl              # Interactive REPL
npm run repl -- --strict  # REPL with strict type checking
npm run lea file.lea      # Run a Lea file
npm run lea file.lea --strict  # Run with strict type checking

npm test                  # Run unit tests
npm run test:integration  # Run integration tests
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Run tests with coverage

npm run examples          # Run all example files
npm run format -- file.lea -w  # Format a Lea file
npm run visualize -- file.lea  # Generate flow diagram
```

## Project Structure

```
lea/
├── src/                    # TypeScript source code
│   ├── token.ts            # Token types and keywords
│   ├── lexer.ts            # Tokenizer
│   ├── ast.ts              # AST node definitions
│   ├── parser.ts           # Recursive descent parser
│   ├── interpreter.ts      # Tree-walk interpreter
│   ├── repl.ts             # Interactive REPL
│   ├── index.ts            # File runner entry point
│   ├── formatter.ts        # Code formatter
│   ├── visualizer.ts       # AST to Mermaid diagrams
│   └── api.ts              # Public TypeScript API
├── __tests__/              # Unit tests (Jest)
│   ├── lexer.test.ts
│   ├── parser.test.ts
│   ├── interpreter.test.ts
│   └── api.test.ts
├── tests/                  # Integration tests (.lea files)
├── examples/               # Example Lea programs
├── docs/                   # Documentation
├── vscode-lea/             # VSCode extension
├── CLAUDE.md               # Development guidelines
└── package.json
```

### Architecture

```
Source → Lexer → Tokens → Parser → AST → Interpreter → Result
```

The interpreter follows a classic tree-walk architecture:

1. **Lexer** (`lexer.ts`) — Converts source code into tokens
2. **Parser** (`parser.ts`) — Builds an AST from tokens using recursive descent
3. **Interpreter** (`interpreter.ts`) — Evaluates the AST

## Making Changes

### Coding Standards

- Write clear, readable TypeScript code
- Follow existing code style and patterns
- Add JSDoc comments for public functions
- Keep functions focused and single-purpose

### When Adding New Functionality

After modifying or adding functionality, always update:

1. **Documentation** — Update `CLAUDE.md` and relevant docs in `docs/`
2. **Examples** — Add or update files in `examples/`
3. **Tests** — Add unit tests in `__tests__/` and integration tests in `tests/`
4. **Syntax highlighting** — Update the VSCode extension if syntax changes

### Adding a New Builtin Function

1. Add the function to `src/interpreter.ts` in the builtins section
2. Add documentation to `docs/BUILTINS.md`
3. Add tests in `__tests__/interpreter.test.ts`
4. Add an integration test in `tests/` if appropriate
5. Update `CLAUDE.md` with the builtin reference

### Adding a New Language Feature

1. Add new token types to `src/token.ts` if needed
2. Update the lexer in `src/lexer.ts` to recognize new syntax
3. Add AST node types to `src/ast.ts`
4. Update the parser in `src/parser.ts` to parse the new syntax
5. Implement evaluation in `src/interpreter.ts`
6. Update syntax highlighting in `vscode-lea/`
7. Add comprehensive tests
8. Document in `docs/SYNTAX.md` and `CLAUDE.md`

## Testing

### Unit Tests

Unit tests use Jest and are located in `__tests__/`:

```bash
npm test                  # Run all unit tests
npm run test:watch        # Run in watch mode
npm run test:coverage     # Generate coverage report
```

When writing unit tests:

- Test edge cases and error conditions
- Use descriptive test names
- Group related tests using `describe` blocks

### Integration Tests

Integration tests are `.lea` files in `tests/` that verify end-to-end behavior:

```bash
npm run test:integration  # Run all integration tests
```

When adding integration tests:

- Create a new `.lea` file in `tests/`
- Use `print` statements to output expected values
- Name files descriptively (e.g., `test-feature-name.lea`)

### Running Examples

Examples in `examples/` serve as both documentation and smoke tests:

```bash
npm run examples  # Run all examples
```

## Documentation

Documentation is crucial for Lea's usability. Key files:

| File | Purpose |
|------|---------|
| `docs/GETTING-STARTED.md` | Beginner tutorial |
| `docs/SYNTAX.md` | Complete syntax reference |
| `docs/BUILTINS.md` | Builtin functions reference |
| `docs/PIPELINES.md` | Pipeline documentation |
| `docs/CHEATSHEET.md` | Quick reference |
| `CLAUDE.md` | Development guidelines and full reference |

When updating documentation:

- Use clear, concise language
- Include code examples
- Keep the cheatsheet up to date
- Ensure examples are correct and runnable

## Pull Request Process

1. **Fork the repository** and create a feature branch
2. **Make your changes** following the guidelines above
3. **Run tests** to ensure nothing is broken:
   ```bash
   npm test
   npm run test:integration
   npm run examples
   ```
4. **Commit your changes** with clear, descriptive messages
5. **Push to your fork** and open a pull request
6. **Describe your changes** in the PR description:
   - What problem does this solve?
   - How did you solve it?
   - Any breaking changes?

### PR Checklist

Before submitting, verify:

- [ ] Tests pass (`npm test` and `npm run test:integration`)
- [ ] Examples run successfully (`npm run examples`)
- [ ] Documentation is updated if needed
- [ ] Code follows existing style
- [ ] Commit messages are clear and descriptive

### CI Pipeline

Pull requests trigger automated CI that:

- Runs unit tests on Node 18, 20, and 22
- Runs integration tests
- Runs all examples

All checks must pass before merging.

## Reporting Issues

### Bug Reports

When reporting a bug, please include:

- **Lea version** — `npm list lea-lang` or commit hash
- **Node.js version** — `node --version`
- **Operating system**
- **Minimal reproduction** — Smallest code that shows the bug
- **Expected behavior** — What should happen
- **Actual behavior** — What actually happens
- **Error messages** — Include full stack traces

### Feature Requests

When suggesting a feature:

- **Describe the problem** — What are you trying to do?
- **Proposed solution** — How would you like it to work?
- **Alternatives considered** — Other approaches you thought of
- **Code examples** — Show how the feature would be used

## Questions?

If you have questions about contributing:

- Open a [GitHub Discussion](https://github.com/mcclowes/lea/discussions)
- Check existing issues for similar questions
- Review the [documentation](docs/)

Thank you for contributing to Lea!

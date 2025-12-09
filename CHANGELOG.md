# Changelog

All notable changes to the Lea programming language are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- Explicit pipeline type annotations (`:: [Int]` or `:: Type /> Type`)

### Fixed
- **Parser**: Inline lambdas in pipe operands now correctly stop at pipe operators, allowing natural chaining like `[1,2,3] />>> (x) -> x * 2 /> print`
- Git tracking issue with duplicate TODO.md/todo.md files on case-insensitive filesystems

## [1.0.0] - 2024

### Added

#### Language Features
- **Module system** with `#export` decorator and `use` imports
- **Pattern matching** with `match` expression and guards
- **Function overloading** via `and` keyword with type-based dispatch
- **Reversible functions** with forward (`->`) and reverse (`<-`) definitions
- **Bidirectional pipelines** (`</>`) for encoding/decoding patterns
- **Reactive pipelines** (`@>`) with lazy evaluation and dirty tracking
- **Spread pipe operator** (`/>>>`) for mapping over list elements
- **Parallel pipe operator** (`\>`) for fan-out concurrent execution
- **Type annotations** with trailing `:: Type :> ReturnType` syntax
- **Strict mode** via `#strict` pragma or `--strict` CLI flag
- **Tuples** as first-class values with destructuring
- **Record spread operator** (`...`) for merging and extending records
- **List spread operator** for concatenating lists
- **Template strings** with `{expr}` interpolation
- **Early return** with `return` keyword
- **Codeblocks** (`{-- label --}` / `{/--}`) for code organization
- **Default parameters** in function definitions
- **Ignored parameters** with underscore (`_`)

#### Decorators
- `#log` - logs function inputs/outputs
- `#log_verbose` - detailed logging with types and timing
- `#memo` - result caching by arguments
- `#time` - execution time logging
- `#retry(n)` - retry on failure
- `#timeout(ms)` - async timeout handling
- `#validate` - runtime type checking
- `#pure` - side effect warnings
- `#async` - mark function as async
- `#trace` - deep logging with call depth
- `#coerce(Type)` - input type coercion
- `#parse` - auto-parse JSON/numbers from strings
- `#stringify` - convert output to string
- `#tease(Type)` - best-effort output coercion
- `#export` - export from module

#### Pipeline Features
- Pipeline as first-class values with `.length`, `.stages`, `.visualize()`
- Pipeline algebra: `.prepend()`, `.append()`, `.reverse()`, `.slice()`
- Set operations: `.without()`, `.intersection()`, `.union()`, `.concat()`
- `Pipeline.identity`, `Pipeline.empty`, `Pipeline.from()`

#### Builtins
- **Math**: `sqrt`, `abs`, `floor`, `ceil`, `round`, `min`, `max`
- **List**: `length`, `head`, `tail`, `push`, `concat`, `reverse`, `zip`, `isEmpty`, `take`, `at`, `partition`, `range`
- **Higher-order**: `map`, `filter`, `reduce` (all with index access)
- **Tuple**: `fst`, `snd`
- **String**: `split`, `lines`, `charAt`, `join`, `padEnd`, `padStart`, `trim`, `trimEnd`, `indexOf`, `includes`, `repeat`, `slice`, `chars`
- **Set**: `listSet`, `setAdd`, `setHas`
- **Random**: `random`, `randomInt`, `randomFloat`, `randomChoice`, `shuffle`
- **I/O**: `readFile`, `writeFile`, `appendFile`, `fileExists`, `deleteFile`, `readDir`, `fetch`
- **Async**: `delay`, `parallel`, `race`, `then`, `iterations`
- **Utility**: `print`, `toString`, `breakPieces` (ASCII diagram parser)

#### Tooling
- Mermaid flowchart visualization (`npm run visualize`)
- Prettier-style code formatter (`npm run format`)
- VS Code extension with syntax highlighting
- REPL with strict mode support
- Jest unit tests for lexer, parser, interpreter
- Integration tests in `tests/` directory
- CI workflow with test automation

### Changed
- Replaced `<-` early return syntax with `return` keyword

### VS Code Extension

#### [0.2.3]
- Improved pipeline type annotation highlighting for `:: [Int] /> [Int]`

#### [0.2.2]
- Added `use` keyword highlighting for module imports
- Added `#export` decorator highlighting

#### [0.2.1]
- Added sticky scroll support for codeblocks
- Added Lea syntax highlighting in Markdown code blocks

#### [0.2.0]
- Added codeblock highlighting (`{-- --}` / `{/--}`)
- Added template string interpolation highlighting
- Added spread operator highlighting
- Added pattern matching highlighting
- Added parallel pipe operator highlighting

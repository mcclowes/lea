# Changelog

All notable changes to the Lea programming language are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- **Pipelines can start with spread pipe**: `/>>> double /> sum` - first stage can now be a spread operation

## [1.1.3] - 2025-12-10

### Added
- **Spread pipe in pipeline literals**: `/>>>` now works inside first-class pipeline literals
  - `let p = /> filter((x) -> x > 0) />>> double /> sum` - spread stages preserved for visualization
- **Comprehensive standard library**: 60+ new builtins including:
  - Collection: `find`, `findIndex`, `some`, `every`, `sort`, `flatten`, `flatMap`, `last`, `drop`, `takeWhile`, `dropWhile`, `count`, `intersperse`, `enumerate`, `transpose`
  - Statistics: `sum`, `product`, `mean`, `median`, `variance`, `stdDev`
  - Number theory: `gcd`, `lcm`, `isPrime`, `factorial`, `fibonacci`, `isEven`, `isOdd`, `mod`, `divInt`
  - Bitwise: `bitAnd`, `bitOr`, `bitXor`, `bitNot`, `bitShiftLeft`, `bitShiftRight`
  - Regex: `regexTest`, `regexMatch`, `regexMatchAll`, `regexReplace`, `regexSplit`
  - Case conversion: `toCamelCase`, `toPascalCase`, `toSnakeCase`, `toKebabCase`, `toConstantCase`, `capitalize`, `titleCase`
  - Encoding: `base64Encode`, `base64Decode`, `urlEncode`, `urlDecode`, `hexEncode`, `hexDecode`
  - Path utilities: `pathJoin`, `pathDirname`, `pathBasename`, `pathExtname`, `pathIsAbsolute`
  - Environment: `cwd`, `platform`

### Fixed
- **Parser**: Single-line parallel pipes in pipeline literals now work correctly
  - `let p = /> double \> addOne \> square />>> fn` - parallel branches collected properly on same line
- **Parser**: Async decorator application and parser context issues

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

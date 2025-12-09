# Changelog

## [0.2.1] - 2024-12-09

### Added
- Sticky scroll support for codeblocks
- Unified pipe operator highlighting (all pipe variants now share same color)

### Changed
- Codeblock syntax changed from `<> </>` to `{-- label --}` / `{/--}`
- Updated folding markers for new codeblock syntax

### Fixed
- Removed outdated `<>` auto-closing pair

## [0.1.0] - 2024-12-08

### Added
- Initial release
- Syntax highlighting for Lea language
- Support for keywords: `let`, `maybe`, `await`, `context`, `provide`, `match`, `if`
- Pipe operators: `/>`, `/>>>`, `\>`, `</>`, `</`, `@>`
- Arrow operators: `->`, `<-`
- Decorator highlighting (`#log`, `#memo`, `#time`, `#retry`, `#async`, `#validate`, etc.)
- Context attachment highlighting (`@Context`)
- Type annotation support (`:: Type :> ReturnType`)
- Builtin function recognition
- Template string support with interpolation
- String, number, and boolean literal highlighting
- Comment support (`--`)
- Auto-closing brackets and quotes
- Indentation rules for function bodies

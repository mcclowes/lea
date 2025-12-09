# Module System Implementation

## Design Decisions

- **Export syntax**: `#export` decorator on let bindings
- **Import syntax**: `let { a, b } = use "./path"` (destructuring required)
- **No namespace imports**: No `let math = use "./math"` for now (can add later)
- **Resolution**: Relative paths only, resolved from the importing file's location
- **Implicit extension**: `use "./math"` resolves to `./math.lea`
- **Named exports only**: No default exports
- **Re-exports allowed**: `let { foo } = use "./a" #export`
- **No `as` syntax**: Rename by rebinding manually
- **Pipelines**: Export/import like any value (closures preserved)
- **Decorators**: Can decorate imported values

## Implementation Checklist

### Phase 1: Core Infrastructure
- [x] Add `USE` token to lexer (`use` keyword)
- [x] Add `UseExpr` AST node
- [x] Update parser to handle `use` expressions
- [x] Add `#export` decorator support in interpreter

### Phase 2: Module Loader
- [x] Implement path resolution (relative to importing file)
- [x] Add module cache (avoid re-evaluating same file)
- [x] Circular dependency detection
- [x] Module exports as LeaRecord

### Phase 3: Environment Integration
- [x] Module-scoped environments
- [x] Export registry via `#export` decorator check
- [x] Import linking via destructuring

### Phase 4: Error Handling
- [x] File not found errors
- [x] Circular import errors
- [x] Clear error messages with file paths

### Phase 5: Testing & Documentation
- [x] Integration tests for import/export (tests/modules/)
- [x] Update CLAUDE.md with module syntax
- [x] Add examples in `examples/modules/`
- [x] Update VS Code syntax highlighting

## Critical TODOs

- [ ] **CRITICAL: Context system across modules** - How should `context` and `provide` work across module boundaries? Options:
  - Contexts are module-scoped (isolated)
  - Contexts can be exported/imported explicitly
  - Global context registry with module namespacing
  - `provide` affects only current module's imports

  This needs careful design to avoid unexpected behavior.

## Syntax Reference

```lea
-- Exporting (in math.lea)
let double = (x) -> x * 2 #export
let add = (a, b) -> a + b #export
let private = (x) -> x  -- not exported

let processNumbers = /> double /> add(10) #export

-- Importing (in main.lea)
let { double, add } = use "./math"
double(5)  -- 10

-- Re-export
let { double } = use "./math" #export

-- Decorate imported function
let { double } = use "./math"
let loggedDouble = double #log
5 /> loggedDouble

-- Rename by rebinding
let { double } = use "./math"
let dbl = double
```

## Future Considerations

- Namespace imports: `let math = use "./math"` then `math.double(5)`
- Package resolution: `use "std:list"` or similar
- Async module loading
- URL imports

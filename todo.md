# Module System Implementation

## Design Decisions

- **Export syntax**: `#export` decorator on let bindings
- **Import syntax**: `let x = use "./path.lea"` or `let { a, b } = use "./path.lea"`
- **Resolution**: Relative paths only, resolved from the importing file's location
- **Named exports only**: No default exports
- **Pipelines**: Export/import like any value (closures preserved)
- **Decorators**: Can decorate imported values

## Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Add `USE` token to lexer (`use` keyword)
- [ ] Add `EXPORT` token for `#export` decorator recognition
- [ ] Add `UseExpr` AST node
- [ ] Update parser to handle `use` expressions
- [ ] Add `#export` decorator support

### Phase 2: Module Loader
- [ ] Create `src/interpreter/modules.ts` for module loading logic
- [ ] Implement path resolution (relative to importing file)
- [ ] Add module cache (avoid re-evaluating same file)
- [ ] Circular dependency detection
- [ ] Create `LeaModule` value type for module namespaces

### Phase 3: Environment Integration
- [ ] Module-scoped environments
- [ ] Export registry in Environment
- [ ] Import linking (bind imported names to local scope)

### Phase 4: Error Handling
- [ ] File not found errors
- [ ] Circular import errors
- [ ] Missing export errors
- [ ] Clear error messages with file paths and line numbers

### Phase 5: Testing & Documentation
- [ ] Unit tests for module loading
- [ ] Integration tests for import/export
- [ ] Update CLAUDE.md with module syntax
- [ ] Add examples in `examples/`
- [ ] Update VS Code syntax highlighting

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
let math = use "./math.lea"
math.double(5)  -- 10

-- Destructured import
let { double, add } = use "./math.lea"
double(5)  -- 10

-- Decorate imported function
let { double } = use "./math.lea"
let loggedDouble = double #log
5 /> loggedDouble
```

## Open Questions

1. Should `use` be an expression or statement? (Expression allows `let x = use ...`)
2. Re-exports: `let { foo } = use "./a.lea" #export` - allow this?
3. Should we support `use "./file.lea" as math` syntax sugar?
4. How to handle async module loading if needed in future?

# Pipelines in Lea

Pipelines are first-class values in Lea, enabling composition, inspection, and reuse of data transformation chains.

## Creating pipelines

Define a pipeline with `/>` at the start:

```lea
let processNumbers = /> double /> addOne
```

Apply a pipeline by piping into it:

```lea
5 /> processNumbers     -- 11
```

### Starting with spread pipe

Pipelines can also start with `/>>>` when the first operation should map over list elements:

```lea
let doubleAll = />>> double /> sum
[1, 2, 3] /> doubleAll  -- 12 (2+4+6)
```

## Pipeline properties

```lea
let p = /> double /> addOne /> toString

p.length                -- 3 (number of stages)
p.stages                -- ["double", "addOne", "toString"]
p.first                 -- double (first stage as function)
p.last                  -- toString (last stage as function)
p.isEmpty()             -- false
```

## Visualization

```lea
p.visualize()
```

Outputs an ASCII diagram:

```
─── double ─── addOne ─── toString ───
```

## Pipeline composition

Pipelines compose naturally:

```lea
let pipeA = /> filter((x) -> x > 0)
let pipeB = /> map((x) -> x * 2)
let combined = /> pipeA /> pipeB
```

## Pipeline algebra

### Identity and empty

```lea
5 /> Pipeline.identity      -- 5 (passes through unchanged)
5 /> Pipeline.empty         -- 5 (no stages)
```

### Creating from functions

```lea
let p = Pipeline.from([fn1, fn2, fn3])
```

### Stage access

```lea
p.at(0)                 -- Get stage at index as callable function
p.first                 -- First stage
p.last                  -- Last stage
```

### Manipulation (returns new pipeline)

```lea
p.prepend(fn)           -- Add stage at start
p.append(fn)            -- Add stage at end
p.reverse()             -- Reverse stage order
p.slice(0, 2)           -- Extract sub-pipeline
```

### Set operations (returns new pipeline)

```lea
pipeA.without(pipeB)        -- Remove stages appearing in pipeB
pipeA.intersection(pipeB)   -- Keep only stages common to both
pipeA.union(pipeB)          -- Combine all stages (deduplicated)
pipeA.difference(pipeB)     -- Stages in pipeA but not pipeB
pipeA.concat(pipeB)         -- Concatenate (preserves duplicates)
```

### Comparison

```lea
pipeA.equals(pipeB)     -- Structural equality
```

## Reversible functions

Define both forward and reverse transformations:

```lea
let double = (x) -> x * 2
and double = (x) <- x / 2
```

Apply in either direction:

```lea
5 /> double             -- 10 (forward: 5 * 2)
10 </ double            -- 5 (reverse: 10 / 2)

-- Roundtrip preserves value
5 /> double </ double   -- 5
```

## Bidirectional pipelines

Pipelines that work in both directions:

```lea
let transform = </> double </> addTen

5 /> transform          -- 20 (forward: 5 -> 10 -> 20)
20 </ transform         -- 5 (reverse: 20 -> 10 -> 5)
```

All stages should be reversible functions for reverse to work correctly.

## Pipeline decorators

```lea
let debugPipeline = /> double /> addOne #debug
let profiledPipeline = /> double /> addOne #profile
let loggedPipeline = /> double /> addOne #log
```

| Decorator | Description |
|-----------|-------------|
| `#log` | Log pipeline input/output |
| `#log_verbose` | Detailed stage-by-stage logging |
| `#memo` | Cache results by input |
| `#time` | Log total execution time |
| `#debug` | Step-by-step execution logging |
| `#profile` | Timing breakdown per stage |
| `#trace` | Nested call tracing |

## Reactive pipelines

Pipelines that automatically recompute when their source changes:

```lea
maybe source = [1, 2, 3]
let reactive = source @> map(double) /> sum

reactive.value          -- 12 (computed on first access)

source = [1, 2, 3, 4]   -- Mutation marks reactive as dirty
reactive.value          -- 20 (recomputed)
reactive.value          -- 20 (cached, not recomputed)
```

Key behaviors:
- **Lazy**: Computes on `.value` access, not on creation
- **Dirty tracking**: Source mutation marks reactive as dirty
- **Caching**: Subsequent `.value` accesses return cached result if clean
- **Auto-unwrap**: Reactives unwrap in expressions: `(reactive + 10)`
- **Static optimization**: Primitive sources compute immediately (no wrapper)

## Examples

### Data processing pipeline

```lea
let cleanData = />
  filter((x) -> x != null) />
  map((x) -> trim(x)) />
  filter((x) -> length(x) > 0)

let processCSV = />
  lines />
  map((line) -> split(line, ",")) />
  cleanData

rawCSV /> processCSV /> print
```

### Encoding/decoding with bidirectional pipelines

```lea
let encode = (s) -> s ++ "!"
and encode = (s) <- slice(s, 0, length(s) - 1)

let wrap = (s) -> "[" ++ s ++ "]"
and wrap = (s) <- slice(s, 1, length(s) - 1)

let codec = </> encode </> wrap

"hello" /> codec        -- "[hello!]"
"[hello!]" </ codec     -- "hello"
```

### Reusable transformations

```lea
let normalizeNumbers = />
  filter((x) -> x > 0) />
  map((x) -> round(x)) />
  listSet

let statistics = />
  (nums) -> {
    count: length(nums),
    sum: reduce(nums, 0, (a, x) -> a + x),
    avg: reduce(nums, 0, (a, x) -> a + x) / length(nums)
  }

[3.2, -1, 5.8, 3.2, 7.1]
  /> normalizeNumbers
  /> statistics
  /> print
-- { count: 3, sum: 16, avg: 5.33... }
```

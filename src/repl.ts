import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Lexer, LexerError } from "./lexer";
import { Parser, ParseError } from "./parser";
import {
  Interpreter,
  RuntimeError,
  Environment,
  LeaValue,
  LeaPipeline,
  LeaBidirectionalPipeline,
  LeaReactiveValue,
  LeaTuple,
} from "./interpreter";
import { formatError } from "./errors";
import { stringify } from "./interpreter/helpers";
import {
  Debugger,
  DebugSession,
  getDebugger,
  DebugEvent,
  Breakpoint,
} from "./debugger";

// Parse CLI arguments
const args = process.argv.slice(2);
const strictFlag = args.includes("--strict");
const tutorialFlag = args.includes("--tutorial");

// ============================================================================
// Constants for persistence
// ============================================================================

const LEA_DIR = path.join(os.homedir(), ".lea");
const HISTORY_FILE = path.join(LEA_DIR, "history");
const WORKSPACE_DIR = path.join(LEA_DIR, "workspaces");
const MAX_HISTORY_LINES = 1000;

// Ensure directories exist
function ensureDirectories(): void {
  if (!fs.existsSync(LEA_DIR)) {
    fs.mkdirSync(LEA_DIR, { recursive: true });
  }
  if (!fs.existsSync(WORKSPACE_DIR)) {
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  }
}

// ============================================================================
// Help Topics
// ============================================================================

const HELP_TOPICS: Record<string, string> = {
  main: `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                           Lea Language REPL                                    ║
╚═══════════════════════════════════════════════════════════════════════════════╝

COMMANDS:
  .help [topic]     Show help (topics: pipes, functions, lists, decorators,
                    types, async, patterns, contexts, pipelines, debug)
  .examples         Show example snippets
  .example <n>      Run example number n
  .type <expr>      Show the type of an expression
  .bindings         List all current bindings
  .clear            Clear the screen
  .reset            Reset the interpreter state
  .multiline        Toggle multi-line input mode
  .tutorial         Start interactive tutorial
  .exit             Exit the REPL

DEBUGGER:
  .debug <expr>     Debug an expression step-by-step
  .break <line>     Set breakpoint at line number
  .breaks           List all breakpoints
  .delbreak <id>    Delete breakpoint by ID
  .watch <expr>     Add a watch expression
  .watches          List watch expressions

SESSION:
  .save [name]      Save workspace state
  .load <name>      Load workspace state
  .workspaces       List saved workspaces
  .export [file]    Export session to .lea file
  .history [n]      Show last n commands (default: 20)

QUICK START:
  let x = 10                    -- immutable binding
  maybe y = 20                  -- mutable binding
  5 /> sqrt /> print            -- pipe value through functions
  [1,2,3] /> map((x) -> x * 2)  -- transform lists

Type .help <topic> for detailed help on a specific topic.
`,

  pipes: `
═══════════════════════════════════════════════════════════════════════════════
PIPES - The core of Lea
═══════════════════════════════════════════════════════════════════════════════

Pipes flow data through transformations using the /> operator.

BASIC PIPES:
  16 /> sqrt                     -- passes 16 to sqrt → 4
  5 /> add(3)                    -- becomes add(5, 3) → 8

PLACEHOLDER (input):
  5 /> add(3, input)             -- becomes add(3, 5) → 8

CHAINING:
  [1, 2, 3]
    /> filter((x) -> x > 1)
    /> map((x) -> x * 2)
    /> reduce(0, (acc, x) -> acc + x)

PARALLEL PIPES (fan-out/fan-in):
  10 \\> addOne \\> double /> combine
  -- Runs addOne and double concurrently, combines results

SPREAD PIPE (map over list):
  [1, 2, 3] />>>double           -- [2, 4, 6]

REVERSE PIPE:
  10 </ double                   -- calls reverse of double (if defined)

TIP: Pipe binds tighter than arithmetic, so:
  a /> b + c  parses as  (a /> b) + c
`,

  functions: `
═══════════════════════════════════════════════════════════════════════════════
FUNCTIONS
═══════════════════════════════════════════════════════════════════════════════

BASIC SYNTAX:
  let double = (x) -> x * 2
  let add = (a, b) -> a + b
  let greet = (name) -> "Hello " ++ name

MULTI-LINE BODY:
  let process = (x) ->
    let y = x * 2
    let z = y + 1
    z

DEFAULT PARAMETERS:
  let greet = (name, greeting = "Hello") -> greeting ++ " " ++ name
  greet("World")                 -- "Hello World"
  greet("World", "Hi")           -- "Hi World"

IGNORED PARAMETERS:
  let first = (x, _) -> x        -- _ ignores second param

TYPE ANNOTATIONS:
  let double = (x) -> x * 2 :: Int :> Int
  let add = (a, b) -> a + b :: (Int, Int) :> Int

DECORATORS:
  let logged = (x) -> x * 2 #log #memo #time

REVERSIBLE FUNCTIONS:
  let double = (x) -> x * 2
  and double = (x) <- x / 2      -- adds reverse
  5 /> double                    -- 10
  10 </ double                   -- 5

FUNCTION OVERLOADING:
  let add = (a, b) -> a + b :: (Int, Int) :> Int
  and add = (a, b) -> a ++ b :: (String, String) :> String
`,

  lists: `
═══════════════════════════════════════════════════════════════════════════════
LISTS & COLLECTIONS
═══════════════════════════════════════════════════════════════════════════════

LIST LITERALS:
  let nums = [1, 2, 3, 4, 5]
  let mixed = [1, "two", true]

TRANSFORMATIONS:
  nums /> map((x) -> x * 2)           -- [2, 4, 6, 8, 10]
  nums /> filter((x) -> x > 2)        -- [3, 4, 5]
  nums /> reduce(0, (acc, x) -> acc + x)  -- 15

INDEX ACCESS IN CALLBACKS:
  ["a", "b"] /> map((x, i) -> \`\${i}: \${x}\`)  -- ["0: a", "1: b"]

LIST OPERATIONS:
  length([1, 2, 3])              -- 3
  head([1, 2, 3])                -- 1
  tail([1, 2, 3])                -- [2, 3]
  push([1, 2], 3)                -- [1, 2, 3]
  concat([1, 2], [3, 4])         -- [1, 2, 3, 4]
  reverse([1, 2, 3])             -- [3, 2, 1]
  take([1, 2, 3, 4], 2)          -- [1, 2]
  at([1, 2, 3], 1)               -- 2
  range(1, 5)                    -- [1, 2, 3, 4]

SPREAD OPERATOR:
  let a = [1, 2]
  let b = [3, 4]
  [...a, ...b]                   -- [1, 2, 3, 4]

DESTRUCTURING:
  let (first, second) = [1, 2, 3]
`,

  decorators: `
═══════════════════════════════════════════════════════════════════════════════
DECORATORS
═══════════════════════════════════════════════════════════════════════════════

Decorators modify function/pipeline behavior. Add after the body with #.

FUNCTION DECORATORS:
  #log              Log inputs/outputs
  #log_verbose      Detailed logging with timing
  #memo             Cache results by arguments
  #time             Log execution time
  #retry(n)         Retry on failure up to n times
  #timeout(ms)      Fail if exceeds time (async only)
  #validate         Runtime type checking
  #pure             Warn if side effects detected
  #async            Mark as async (returns promise)
  #trace            Deep logging with call depth

TYPE COERCION DECORATORS:
  #coerce(Type)     Coerce inputs (Int, String, Bool, List)
  #parse            Parse JSON/numbers from strings
  #stringify        Convert output to string
  #tease(Type)      Best-effort extraction ("42px" → 42)

EXAMPLES:
  let cached = (x) -> expensiveOp(x) #memo
  let safe = (x) -> x * 2 :: Int :> Int #validate
  let retry3 = (x) -> riskyOp(x) #retry(3)

PIPELINE DECORATORS:
  let debugPipe = /> fn1 /> fn2 #debug    -- Stage-by-stage logging
  let profiled = /> fn1 /> fn2 #profile   -- Timing breakdown
`,

  types: `
═══════════════════════════════════════════════════════════════════════════════
TYPE SYSTEM
═══════════════════════════════════════════════════════════════════════════════

TYPE ANNOTATIONS (trailing ::):
  let double = (x) -> x * 2 :: Int :> Int
  let add = (a, b) -> a + b :: (Int, Int) :> Int

AVAILABLE TYPES:
  Int          Integers
  String       Strings
  Bool         Booleans
  List         Generic lists
  [Int]        Typed lists (list of Int)
  [[Int]]      Nested lists
  Function     Any function
  Tuple        Tuples like (1, "a")
  Pipeline     First-class pipelines
  ?Type        Optional (allows null)

TUPLES:
  let point = (10, 20)
  let pair = (1, "hello")        -- mixed types OK
  let (x, y) = point             -- destructuring

RECORDS:
  let user = { name: "Max", age: 99 }
  user.name                      -- "Max"
  let { name, age } = user       -- destructuring
  { ...user, age: 100 }          -- spread with override

RUNTIME VALIDATION:
  let safe = (x) -> x * 2 :: Int :> Int #validate
  safe("oops")                   -- RuntimeError!

STRICT MODE:
  #strict                        -- At top of file
  npm run repl -- --strict       -- CLI flag
`,

  async: `
═══════════════════════════════════════════════════════════════════════════════
ASYNC & CONCURRENCY
═══════════════════════════════════════════════════════════════════════════════

ASYNC FUNCTIONS:
  let fetchData = () -> delay(100) #async
  await fetchData() /> print

DELAY (returns promise):
  await delay(1000, "done")      -- resolves to "done" after 1s

PARALLEL EXECUTION:
  let urls = ["url1", "url2", "url3"]
  urls /> parallel((url) -> fetch(url))

  -- With concurrency limit:
  urls /> parallel((url) -> fetch(url), { limit: 2 })

PROMISE CHAINING:
  delay(100, 5)
    /> then((x) -> x * 2)
    /> then((x) -> print(x))

RACE:
  race([
    delay(100, "first"),
    delay(200, "second")
  ])                             -- resolves to "first"

PARALLEL PIPES:
  10 \\> fetchA \\> fetchB /> combine
  -- Runs fetchA and fetchB concurrently
`,

  patterns: `
═══════════════════════════════════════════════════════════════════════════════
PATTERN MATCHING
═══════════════════════════════════════════════════════════════════════════════

BASIC SYNTAX:
  let describe = (x) -> match x
    | 0 -> "zero"
    | 1 -> "one"
    | "default"

GUARDS (using 'input'):
  let describe = (x) -> match x
    | if input < 0 -> "negative"
    | if input > 100 -> "big"
    | "normal"

USING INPUT IN BODY:
  let double = (x) -> match x
    | if input > 0 -> input * 2
    | 0

COMBINING PATTERNS AND GUARDS:
  let fizzbuzz = (n) -> match n
    | if input % 15 == 0 -> "FizzBuzz"
    | if input % 3 == 0 -> "Fizz"
    | if input % 5 == 0 -> "Buzz"
    | toString(input)

WITH PIPES:
  5 /> match
    | if input > 10 -> "big"
    | "small"
`,

  contexts: `
═══════════════════════════════════════════════════════════════════════════════
CONTEXT SYSTEM (Dependency Injection)
═══════════════════════════════════════════════════════════════════════════════

DEFINING A CONTEXT:
  context Logger = { log: (msg) -> print("[DEFAULT] " ++ msg) }

PROVIDING A VALUE:
  provide Logger { log: (msg) -> print("[PROD] " ++ msg) }

USING IN FUNCTIONS:
  let greet = (name) ->
    @Logger
    Logger.log("Hello " ++ name)

FULL EXAMPLE:
  -- Define context with default
  context Config = { debug: false, env: "dev" }

  -- Override in production
  provide Config { debug: false, env: "prod" }

  -- Use in function
  let doSomething = () ->
    @Config
    Config.debug ? print("Debug mode") : 0
`,

  pipelines: `
═══════════════════════════════════════════════════════════════════════════════
FIRST-CLASS PIPELINES
═══════════════════════════════════════════════════════════════════════════════

DEFINING PIPELINES:
  let process = /> double /> addOne
  5 /> process                   -- 11

PIPELINE PROPERTIES:
  process.length                 -- 2
  process.stages                 -- ["double", "addOne"]
  process.visualize()            -- ASCII diagram

COMPOSITION:
  let pipeA = /> filter((x) -> x > 0)
  let pipeB = /> map((x) -> x * 2)
  let combined = /> pipeA /> pipeB

PIPELINE ALGEBRA:
  Pipeline.identity              -- No-op pipeline
  Pipeline.empty                 -- Zero stages
  pipeA.prepend(fn)              -- Add at start
  pipeA.append(fn)               -- Add at end
  pipeA.reverse()                -- Reverse order
  pipeA.slice(0, 2)              -- Sub-pipeline
  pipeA.concat(pipeB)            -- Concatenate
  pipeA.union(pipeB)             -- Deduplicated combination
  pipeA.equals(pipeB)            -- Structural equality

BIDIRECTIONAL PIPELINES:
  let transform = </> double </> addTen
  5 /> transform                 -- forward
  20 </ transform                -- reverse

REACTIVE PIPELINES:
  maybe source = [1, 2, 3]
  let r = source @> map(double) /> sum
  r.value                        -- 12 (lazy evaluation)
  source = [1, 2, 3, 4]          -- marks r as dirty
  r.value                        -- 20 (recomputed)
`,

  debug: `
═══════════════════════════════════════════════════════════════════════════════
DEBUGGER
═══════════════════════════════════════════════════════════════════════════════

The Lea REPL includes an interactive debugger for stepping through pipelines
and inspecting intermediate values.

STARTING A DEBUG SESSION:
  .debug [1, 2, 3] /> map((x) -> x * 2) /> sum

DEBUG COMMANDS (while in debug mode):
  n, next       Step to next pipeline stage
  c, continue   Continue execution until next breakpoint
  i, inspect    Inspect current value in detail
  s, stages     Show all pipeline stages
  v, vars       Show recorded values
  b, break      List breakpoints
  h, help       Show debug help
  q, quit       Quit debug session

BREAKPOINTS:
  .break 10              Set breakpoint at line 10
  .break 10 file.lea     Set breakpoint at line 10 in file.lea
  .breaks                List all breakpoints
  .delbreak 1            Delete breakpoint #1
  .clearbreaks           Clear all breakpoints

WATCH EXPRESSIONS:
  .watch x               Watch variable x
  .watch x * 2           Watch expression
  .watches               List all watch expressions
  .delwatch x            Remove watch expression

SESSION MANAGEMENT:
  .save mywork           Save current workspace as "mywork"
  .load mywork           Load workspace "mywork"
  .workspaces            List all saved workspaces
  .export session.lea    Export session history to file

TIP: Use #debug decorator on pipelines for automatic stage-by-stage logging:
  let process = /> double /> addOne #debug
  5 /> process           -- shows each stage's input/output
`,

  session: `
═══════════════════════════════════════════════════════════════════════════════
SESSION MANAGEMENT
═══════════════════════════════════════════════════════════════════════════════

Save, load, and export your REPL sessions.

SAVING WORKSPACE:
  .save                  Save with auto-generated name (timestamp)
  .save mywork           Save as "mywork"

LOADING WORKSPACE:
  .load mywork           Load workspace "mywork"
  .workspaces            List all saved workspaces

EXPORTING SESSION:
  .export                Export to session.lea in current directory
  .export mycode.lea     Export to specified file

HISTORY:
  .history               Show last 20 commands
  .history 50            Show last 50 commands

History is automatically persisted across sessions in ~/.lea/history

WORKSPACE FILES:
  Workspaces are stored in ~/.lea/workspaces/
  Each workspace contains variable bindings and can be reloaded later.
`,
};

// ============================================================================
// Example Snippets
// ============================================================================

const EXAMPLES: Array<{ title: string; code: string; description: string }> = [
  {
    title: "Basic Pipes",
    description: "Chain transformations with />",
    code: `16 /> sqrt /> print`,
  },
  {
    title: "List Transformation",
    description: "Filter, map, and reduce a list",
    code: `[1, 2, 3, 4, 5] /> filter((x) -> x > 2) /> map((x) -> x * 2) /> print`,
  },
  {
    title: "Functions with Decorators",
    description: "Create a memoized function",
    code: `let fib = (n) -> n <= 1 ? n : fib(n - 1) + fib(n - 2) #memo
fib(20) /> print`,
  },
  {
    title: "Records and Destructuring",
    description: "Work with structured data",
    code: `let user = { name: "Alice", age: 30 }
let { name, age } = user
"Name: " ++ name ++ ", Age: " ++ age /> print`,
  },
  {
    title: "Pattern Matching",
    description: "Match values with guards",
    code: `let fizzbuzz = (n) -> match n
  | if input % 15 == 0 -> "FizzBuzz"
  | if input % 3 == 0 -> "Fizz"
  | if input % 5 == 0 -> "Buzz"
  | toString(input)
range(1, 16) /> map(fizzbuzz) /> print`,
  },
  {
    title: "Pipeline as Value",
    description: "First-class pipeline composition",
    code: `let double = (x) -> x * 2
let addOne = (x) -> x + 1
let process = /> double /> addOne
[1, 2, 3] /> map((x) -> x /> process) /> print`,
  },
  {
    title: "Parallel Computation",
    description: "Fan-out and fan-in",
    code: `let addOne = (x) -> x + 1
let double = (x) -> x * 2
let combine = (a, b) -> [a, b]
5 \\> addOne \\> double /> combine /> print`,
  },
  {
    title: "String Templates",
    description: "Interpolation with backticks",
    code: `let name = "World"
let count = 42
\`Hello \${name}! Count: \${count}\` /> print`,
  },
];

// ============================================================================
// Interactive Tutorial
// ============================================================================

interface TutorialStep {
  title: string;
  explanation: string;
  task: string;
  hint: string;
  validator: (result: LeaValue, input: string) => boolean;
  example?: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: "Welcome to Lea!",
    explanation: `
Lea is a pipe-oriented functional language where data flows through
transformations. Let's start with the basics!

In Lea, we use 'let' to create immutable bindings.`,
    task: "Create a variable 'x' with the value 42",
    hint: "Use: let x = 42",
    validator: (_, input) => input.includes("let x = 42") || input.includes("let x=42"),
    example: "let x = 42",
  },
  {
    title: "Pipes - The Heart of Lea",
    explanation: `
Great! The pipe operator '/>' is the core of Lea. It passes a value
as the first argument to the next function.

16 /> sqrt    means    sqrt(16)`,
    task: "Calculate the square root of 25 using a pipe",
    hint: "Use: 25 /> sqrt",
    validator: (result) => result === 5,
    example: "25 /> sqrt",
  },
  {
    title: "Chaining Pipes",
    explanation: `
Pipes can be chained to create transformation pipelines.

5 /> double /> addOne    means    addOne(double(5))

Let's use the print function which outputs a value and returns it.`,
    task: "Pipe the number 4, get its square root, and print it",
    hint: "Use: 4 /> sqrt /> print",
    validator: (result) => result === 2,
    example: "4 /> sqrt /> print",
  },
  {
    title: "Creating Functions",
    explanation: `
Functions use arrow syntax: (params) -> body

let double = (x) -> x * 2

The function takes x and returns x * 2.`,
    task: "Create a function 'triple' that multiplies by 3, then use it on 10",
    hint: "Define: let triple = (x) -> x * 3, then: 10 /> triple",
    validator: (result) => result === 30,
    example: "let triple = (x) -> x * 3\n10 /> triple",
  },
  {
    title: "Working with Lists",
    explanation: `
Lists are written with square brackets: [1, 2, 3]

Use 'map' to transform each element:
[1, 2, 3] /> map((x) -> x * 2)    →    [2, 4, 6]`,
    task: "Create a list [1, 2, 3, 4] and double each element",
    hint: "Use: [1, 2, 3, 4] /> map((x) -> x * 2)",
    validator: (result) =>
      Array.isArray(result) &&
      result.length === 4 &&
      result[0] === 2 &&
      result[3] === 8,
    example: "[1, 2, 3, 4] /> map((x) -> x * 2)",
  },
  {
    title: "Filtering Lists",
    explanation: `
Use 'filter' to keep elements matching a condition:
[1, 2, 3, 4] /> filter((x) -> x > 2)    →    [3, 4]`,
    task: "Filter the list [1, 2, 3, 4, 5] to keep only numbers greater than 2",
    hint: "Use: [1, 2, 3, 4, 5] /> filter((x) -> x > 2)",
    validator: (result) =>
      Array.isArray(result) &&
      result.length === 3 &&
      result[0] === 3 &&
      result[2] === 5,
    example: "[1, 2, 3, 4, 5] /> filter((x) -> x > 2)",
  },
  {
    title: "Reducing Lists",
    explanation: `
Use 'reduce' to combine all elements into one value:
[1, 2, 3] /> reduce(0, (acc, x) -> acc + x)    →    6

The first argument (0) is the initial accumulator value.`,
    task: "Sum the list [1, 2, 3, 4, 5] using reduce",
    hint: "Use: [1, 2, 3, 4, 5] /> reduce(0, (acc, x) -> acc + x)",
    validator: (result) => result === 15,
    example: "[1, 2, 3, 4, 5] /> reduce(0, (acc, x) -> acc + x)",
  },
  {
    title: "Congratulations!",
    explanation: `
🎉 You've completed the Lea tutorial!

You've learned:
  ✓ Creating bindings with 'let'
  ✓ Piping values with '/>'
  ✓ Chaining transformations
  ✓ Creating functions with '->'
  ✓ Transforming lists with 'map'
  ✓ Filtering with 'filter'
  ✓ Reducing with 'reduce'

Explore more with:
  .help pipes       - Learn about all pipe operators
  .help functions   - Advanced function features
  .help decorators  - Function modifiers
  .examples         - See more code examples

Happy coding!`,
    task: "Type 'done' to exit the tutorial",
    hint: "Just type: done",
    validator: (_, input) => input.trim().toLowerCase() === "done",
  },
];

// ============================================================================
// REPL State
// ============================================================================

interface ReplState {
  interpreter: Interpreter;
  multilineMode: boolean;
  multilineBuffer: string[];
  tutorialStep: number;
  inTutorial: boolean;
  history: string[];
  historyIndex: number;
  // Session tracking for export
  sessionCommands: string[];
  sessionResults: Array<{ command: string; result: string }>;
  // Debug state
  debugger: Debugger;
  debugSession: DebugSession | null;
  inDebugMode: boolean;
}

const state: ReplState = {
  interpreter: new Interpreter(strictFlag),
  multilineMode: false,
  multilineBuffer: [],
  tutorialStep: 0,
  inTutorial: tutorialFlag,
  history: [],
  historyIndex: -1,
  sessionCommands: [],
  sessionResults: [],
  debugger: getDebugger(),
  debugSession: null,
  inDebugMode: false,
};

// ============================================================================
// History Persistence
// ============================================================================

function loadHistory(): string[] {
  ensureDirectories();
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const content = fs.readFileSync(HISTORY_FILE, "utf-8");
      return content.split("\n").filter((line) => line.trim());
    }
  } catch {
    // Ignore errors reading history
  }
  return [];
}

function saveHistory(history: string[]): void {
  ensureDirectories();
  try {
    // Keep only the last MAX_HISTORY_LINES
    const toSave = history.slice(-MAX_HISTORY_LINES);
    fs.writeFileSync(HISTORY_FILE, toSave.join("\n"), "utf-8");
  } catch {
    // Ignore errors writing history
  }
}

function appendToHistory(line: string): void {
  ensureDirectories();
  try {
    fs.appendFileSync(HISTORY_FILE, line + "\n", "utf-8");
  } catch {
    // Ignore errors
  }
}

// ============================================================================
// Workspace Management
// ============================================================================

interface WorkspaceData {
  name: string;
  createdAt: string;
  bindings: Record<string, string>;  // name -> serialized value
  history: string[];
}

function serializeValue(val: LeaValue): string {
  // Serialize Lea values to JSON-compatible format
  if (val === null) return "null";
  if (typeof val === "number") return JSON.stringify(val);
  if (typeof val === "string") return JSON.stringify(val);
  if (typeof val === "boolean") return JSON.stringify(val);
  if (Array.isArray(val)) return JSON.stringify(val);
  if (typeof val === "object" && "kind" in val) {
    switch (val.kind) {
      case "tuple":
        return `(${(val as LeaTuple).elements.map((e) => serializeValue(e)).join(", ")})`;
      case "record":
        return `<record>`;
      case "function":
        return `<function>`;
      case "builtin":
        return `<builtin>`;
      case "pipeline":
        return `<pipeline:${(val as LeaPipeline).stages.length} stages>`;
      case "bidirectional_pipeline":
        return `<bidirectional-pipeline>`;
      case "reversible_function":
        return `<reversible-function>`;
      case "reactive":
        return `<reactive>`;
      default:
        return `<${val.kind}>`;
    }
  }
  return String(val);
}

function saveWorkspace(name?: string): string {
  ensureDirectories();
  const workspaceName = name || `workspace-${Date.now()}`;
  const workspacePath = path.join(WORKSPACE_DIR, `${workspaceName}.json`);

  // Get all user-defined bindings
  const globals = (state.interpreter as unknown as { globals: Environment }).globals;
  const values = (globals as unknown as { values: Map<string, { value: LeaValue; mutable: boolean }> }).values;

  const bindings: Record<string, string> = {};
  if (values) {
    for (const [bindingName, entry] of values) {
      // Skip built-ins
      if (bindingName === "Pipeline") continue;
      if (typeof entry.value === "object" && entry.value !== null && "kind" in entry.value && entry.value.kind === "builtin") continue;
      bindings[bindingName] = serializeValue(entry.value);
    }
  }

  const data: WorkspaceData = {
    name: workspaceName,
    createdAt: new Date().toISOString(),
    bindings,
    history: state.sessionCommands.slice(-100),  // Last 100 commands
  };

  fs.writeFileSync(workspacePath, JSON.stringify(data, null, 2), "utf-8");
  return workspaceName;
}

function loadWorkspace(name: string): boolean {
  const workspacePath = path.join(WORKSPACE_DIR, `${name}.json`);
  if (!fs.existsSync(workspacePath)) {
    return false;
  }

  try {
    const content = fs.readFileSync(workspacePath, "utf-8");
    const data: WorkspaceData = JSON.parse(content);

    // Re-execute the history to restore state
    console.log(`\nLoading workspace "${data.name}"...`);
    console.log(`Created: ${data.createdAt}`);
    console.log(`Restoring ${data.history.length} commands...`);

    // Reset interpreter
    state.interpreter = new Interpreter(strictFlag);

    // Re-run all historical commands (silently)
    for (const cmd of data.history) {
      try {
        runCode(cmd, true);  // Silent mode
      } catch {
        // Skip commands that fail
      }
    }

    console.log(`Workspace "${name}" loaded successfully.`);
    console.log(`Use .bindings to see restored variables.\n`);
    return true;
  } catch (err) {
    console.error(`Error loading workspace: ${err}`);
    return false;
  }
}

function listWorkspaces(): string[] {
  ensureDirectories();
  try {
    const files = fs.readdirSync(WORKSPACE_DIR);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  } catch {
    return [];
  }
}

// ============================================================================
// Session Export
// ============================================================================

function exportSession(filename?: string): string {
  const outputFile = filename || "session.lea";
  const outputPath = path.resolve(outputFile);

  // Build Lea source from session commands
  const lines: string[] = [
    "-- Lea session export",
    `-- Exported: ${new Date().toISOString()}`,
    "",
  ];

  for (const cmd of state.sessionCommands) {
    // Skip REPL commands
    if (cmd.startsWith(".")) continue;
    lines.push(cmd);
  }

  fs.writeFileSync(outputPath, lines.join("\n"), "utf-8");
  return outputPath;
}

// ============================================================================
// Value Formatting
// ============================================================================

function formatValue(val: LeaValue): string {
  if (val === null) return "null";
  if (Array.isArray(val)) return `[${val.map(formatValue).join(", ")}]`;
  if (typeof val === "object" && val !== null && "kind" in val) {
    const obj = val as { kind: string; elements?: unknown[]; fields?: Map<string, unknown> };
    if (obj.kind === "tuple" && obj.elements) {
      return `(${(obj.elements as LeaValue[]).map(formatValue).join(", ")})`;
    }
    if (obj.kind === "record" && obj.fields) {
      const entries = Array.from(obj.fields.entries())
        .map(([k, v]) => `${k}: ${formatValue(v as LeaValue)}`)
        .join(", ");
      return `{ ${entries} }`;
    }
    if (obj.kind === "pipeline") {
      return `<pipeline:${(obj as LeaPipeline).stages.length} stages>`;
    }
    if (obj.kind === "bidirectional_pipeline") {
      return `<bidirectional-pipeline:${(obj as LeaBidirectionalPipeline).stages.length} stages>`;
    }
    if (obj.kind === "reversible_function") {
      return "<reversible-function>";
    }
    if (obj.kind === "reactive") {
      return `<reactive:${(obj as LeaReactiveValue).sourceName}>`;
    }
    if (obj.kind === "overload_set") {
      return "<overloaded-function>";
    }
    if (obj.kind === "promise") {
      return "<promise>";
    }
    return "<function>";
  }
  return String(val);
}

function getValueType(val: LeaValue): string {
  if (val === null) return "Null";
  if (typeof val === "number") return Number.isInteger(val) ? "Int" : "Float";
  if (typeof val === "string") return "String";
  if (typeof val === "boolean") return "Bool";
  if (Array.isArray(val)) {
    if (val.length === 0) return "List";
    const firstType = getValueType(val[0]);
    const allSame = val.every((v) => getValueType(v) === firstType);
    return allSame ? `[${firstType}]` : "List";
  }
  if (typeof val === "object" && "kind" in val) {
    switch (val.kind) {
      case "tuple":
        return `(${(val as LeaTuple).elements.map(getValueType).join(", ")})`;
      case "record":
        return "Record";
      case "function":
        return "Function";
      case "builtin":
        return "Builtin";
      case "pipeline":
        return "Pipeline";
      case "bidirectional_pipeline":
        return "BidirectionalPipeline";
      case "reversible_function":
        return "ReversibleFunction";
      case "reactive":
        return "Reactive";
      case "overload_set":
        return "OverloadedFunction";
      case "promise":
        return "Promise";
      default:
        return "Unknown";
    }
  }
  return "Unknown";
}

// ============================================================================
// Command Handlers
// ============================================================================

function showHelp(topic?: string): void {
  const key = topic?.toLowerCase() || "main";
  const content = HELP_TOPICS[key];
  if (content) {
    console.log(content);
  } else {
    console.log(`Unknown help topic: '${topic}'`);
    console.log("Available topics: pipes, functions, lists, decorators, types, async, patterns, contexts, pipelines");
  }
}

function showExamples(): void {
  console.log("\n═══════════════════════════════════════════════════════════════════════════════");
  console.log("EXAMPLES");
  console.log("═══════════════════════════════════════════════════════════════════════════════\n");
  EXAMPLES.forEach((ex, i) => {
    console.log(`${i + 1}. ${ex.title}`);
    console.log(`   ${ex.description}`);
    console.log(`   ${ex.code.split("\n")[0]}${ex.code.includes("\n") ? " ..." : ""}`);
    console.log();
  });
  console.log("Run an example with: .example <number>");
  console.log();
}

function runExample(num: number): void {
  if (num < 1 || num > EXAMPLES.length) {
    console.log(`Example ${num} not found. Use .examples to see available examples.`);
    return;
  }
  const example = EXAMPLES[num - 1];
  console.log(`\n── ${example.title} ──`);
  console.log(`${example.description}\n`);
  console.log(`> ${example.code.replace(/\n/g, "\n> ")}\n`);
  runCode(example.code);
  console.log();
}

function showBindings(): void {
  console.log("\nCurrent bindings:");
  // Access the global environment
  const globals = (state.interpreter as unknown as { globals: Environment }).globals;
  if (!globals) {
    console.log("  (none)");
    return;
  }

  // Get all user-defined bindings (skip builtins by checking if they're functions with bodies)
  const values = (globals as unknown as { values: Map<string, { value: LeaValue; mutable: boolean }> }).values;
  if (!values || values.size === 0) {
    console.log("  (none)");
    return;
  }

  let count = 0;
  for (const [name, entry] of values) {
    // Skip internal Pipeline object
    if (name === "Pipeline") continue;
    const typeStr = getValueType(entry.value);
    const mutStr = entry.mutable ? " (mutable)" : "";
    console.log(`  ${name}: ${typeStr}${mutStr} = ${formatValue(entry.value)}`);
    count++;
  }

  if (count === 0) {
    console.log("  (none)");
  }
  console.log();
}

function showType(expr: string): void {
  try {
    const lexer = new Lexer(expr);
    const tokens = lexer.scanTokens();
    const parser = new Parser(tokens);
    const program = parser.parse();
    const result = state.interpreter.interpret(program);
    const typeStr = getValueType(result);
    console.log(`${expr} : ${typeStr}`);
  } catch (err) {
    if (err instanceof LexerError || err instanceof ParseError || err instanceof RuntimeError) {
      console.error(formatError(err));
    } else {
      throw err;
    }
  }
}

// ============================================================================
// Tutorial Mode
// ============================================================================

function showTutorialStep(): void {
  const step = TUTORIAL_STEPS[state.tutorialStep];
  console.log("\n" + "═".repeat(79));
  console.log(`TUTORIAL (${state.tutorialStep + 1}/${TUTORIAL_STEPS.length}): ${step.title}`);
  console.log("═".repeat(79));
  console.log(step.explanation);
  console.log("\n📝 TASK: " + step.task);
  console.log("💡 HINT: " + step.hint);
  if (step.example) {
    console.log(`📋 EXAMPLE: ${step.example}`);
  }
  console.log();
}

function checkTutorialAnswer(input: string, result: LeaValue): boolean {
  const step = TUTORIAL_STEPS[state.tutorialStep];
  if (step.validator(result, input)) {
    state.tutorialStep++;
    if (state.tutorialStep >= TUTORIAL_STEPS.length) {
      state.inTutorial = false;
      console.log("\n🎉 Tutorial complete! You're now ready to explore Lea on your own.");
      console.log("Type .help for more commands.\n");
    } else {
      console.log("\n✅ Correct!\n");
      showTutorialStep();
    }
    return true;
  }
  return false;
}

// ============================================================================
// Code Execution
// ============================================================================

function runCode(source: string, silent: boolean = false): LeaValue | null {
  try {
    const lexer = new Lexer(source);
    const tokens = lexer.scanTokens();
    const parser = new Parser(tokens);
    const program = parser.parse();

    if (program.strict && !state.interpreter.strictMode) {
      state.interpreter.strictMode = true;
    }

    const result = state.interpreter.interpret(program);
    return result;
  } catch (err) {
    if (err instanceof LexerError || err instanceof ParseError || err instanceof RuntimeError) {
      if (!silent) {
        console.error(formatError(err));
      }
    } else {
      throw err;
    }
    return null;
  }
}

// ============================================================================
// Debug Commands
// ============================================================================

async function debugExpression(expr: string): Promise<void> {
  console.log("\n╔══════════════════════════════════════════════════════════════════════╗");
  console.log("║                        DEBUG MODE                                     ║");
  console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

  // Enable debugger
  state.debugger.enable();
  state.inDebugMode = true;

  // Set up debug callback
  state.debugger.setCallback(async (event: DebugEvent): Promise<boolean> => {
    // Display event info
    console.log("\n─────────────────────────────────────────────────────────────────────");

    if (event.type === "breakpoint_hit") {
      console.log(`🔴 Breakpoint hit at line ${event.location?.line}`);
    } else if (event.type === "pipe_stage") {
      console.log(`Stage ${(event.stageIndex ?? 0) + 1}/${event.totalStages}: ${event.stageName}`);
    } else if (event.type === "pipeline_start") {
      console.log(`Pipeline started with ${event.totalStages} stages`);
    } else if (event.type === "pipeline_end") {
      console.log(`Pipeline completed`);
    }

    if (event.inputValue !== undefined) {
      console.log(`Input:  ${state.debugger.formatValue(event.inputValue)}`);
    }
    if (event.outputValue !== undefined) {
      console.log(`Output: ${state.debugger.formatValue(event.outputValue)}`);
    }

    console.log("─────────────────────────────────────────────────────────────────────");

    // Show watch expressions
    const watches = state.debugger.listWatches();
    if (watches.length > 0) {
      console.log("\nWatch expressions:");
      for (const watchExpr of watches) {
        try {
          const val = runCode(watchExpr, true);
          console.log(`  ${watchExpr} = ${formatValue(val)}`);
        } catch {
          console.log(`  ${watchExpr} = <error>`);
        }
      }
    }

    // Interactive prompt
    return new Promise((resolve) => {
      const debugPrompt = (): void => {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        rl.question("debug> ", (answer) => {
          rl.close();
          const cmd = answer.trim().toLowerCase();

          switch (cmd) {
            case "n":
            case "next":
              state.debugger.step();
              resolve(true);
              break;

            case "c":
            case "continue":
              state.debugger.continue();
              resolve(true);
              break;

            case "i":
            case "inspect":
              const lastVal = state.debugger.getLastValue();
              if (lastVal) {
                console.log("\nCurrent value:");
                console.log(stringify(lastVal.value));
              } else {
                console.log("\nNo value to inspect.");
              }
              console.log();
              debugPrompt();
              break;

            case "v":
            case "vars":
              console.log("\nRecorded values:");
              const history = state.debugger.getValueHistory();
              if (history.length === 0) {
                console.log("  (none)");
              } else {
                for (const entry of history.slice(-10)) {
                  console.log(`  ${entry.name} = ${state.debugger.formatValue(entry.value)}`);
                }
              }
              console.log();
              debugPrompt();
              break;

            case "b":
            case "breaks":
              console.log("\nBreakpoints:");
              const bps = state.debugger.listBreakpoints();
              if (bps.length === 0) {
                console.log("  (none)");
              } else {
                for (const bp of bps) {
                  console.log(`  ${state.debugger.formatBreakpoint(bp)}`);
                }
              }
              console.log();
              debugPrompt();
              break;

            case "h":
            case "help":
              console.log(`
Debug Commands:
  n, next       Step to next pipeline stage
  c, continue   Continue execution until next breakpoint
  i, inspect    Inspect current value in detail
  v, vars       Show recorded values
  b, breaks     List breakpoints
  h, help       Show this help
  q, quit       Quit debug session

Press Enter to step to next stage.
`);
              debugPrompt();
              break;

            case "q":
            case "quit":
              console.log("Quitting debug session.");
              state.debugger.disable();
              state.inDebugMode = false;
              resolve(false);
              break;

            case "":
              // Empty input - step
              state.debugger.step();
              resolve(true);
              break;

            default:
              // Try to evaluate as expression
              const val = runCode(cmd, true);
              if (val !== null) {
                console.log(formatValue(val));
              } else {
                console.log(`Unknown command. Type 'h' for help.`);
              }
              debugPrompt();
          }
        });
      };

      debugPrompt();
    });
  });

  // Parse and run with debug mode
  try {
    console.log(`Debugging: ${expr}\n`);
    console.log("Commands: n(ext), c(ontinue), i(nspect), v(ars), b(reaks), h(elp), q(uit)");
    console.log("Press Enter to step.\n");

    // Run the expression - the debugger callback will be triggered for pipeline stages
    const result = runCode(expr);
    if (result !== null) {
      console.log(`\nResult: ${formatValue(result)}`);
    }
  } finally {
    state.debugger.disable();
    state.debugger.clearCallback();
    state.inDebugMode = false;
  }
}

function showHistory(count: number = 20): void {
  const hist = state.history.slice(-count);
  console.log(`\nLast ${hist.length} commands:`);
  hist.forEach((cmd, i) => {
    console.log(`  ${state.history.length - hist.length + i + 1}: ${cmd}`);
  });
  console.log();
}

function handleInput(line: string): void {
  const trimmed = line.trim();

  // Handle empty input
  if (!trimmed) {
    return;
  }

  // Add to history (both in-memory and persisted)
  if (trimmed && !trimmed.startsWith(".")) {
    state.history.push(trimmed);
    state.historyIndex = state.history.length;
    appendToHistory(trimmed);  // Persist immediately
  }

  // Handle multiline mode
  if (state.multilineMode) {
    if (trimmed === ".done" || trimmed === ";;") {
      const code = state.multilineBuffer.join("\n");
      state.multilineBuffer = [];
      if (code.trim()) {
        const result = runCode(code);
        if (result !== null) {
          console.log(formatValue(result));
        }
        if (state.inTutorial && result !== null) {
          checkTutorialAnswer(code, result);
        }
      }
      return;
    }
    state.multilineBuffer.push(line);
    return;
  }

  // Handle commands
  if (trimmed.startsWith(".")) {
    const parts = trimmed.slice(1).split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const cmdArgs = parts.slice(1);

    switch (cmd) {
      case "help":
        showHelp(cmdArgs[0]);
        break;
      case "examples":
        showExamples();
        break;
      case "example":
        runExample(parseInt(cmdArgs[0], 10));
        break;
      case "type":
        showType(cmdArgs.join(" "));
        break;
      case "bindings":
        showBindings();
        break;
      case "clear":
        console.clear();
        break;
      case "reset":
        state.interpreter = new Interpreter(strictFlag);
        state.sessionCommands = [];
        state.sessionResults = [];
        console.log("Interpreter state reset.");
        break;
      case "multiline":
        state.multilineMode = !state.multilineMode;
        console.log(`Multi-line mode: ${state.multilineMode ? "ON (type .done or ;; to execute)" : "OFF"}`);
        break;
      case "tutorial":
        state.inTutorial = true;
        state.tutorialStep = 0;
        showTutorialStep();
        break;

      // Debug commands
      case "debug":
        if (cmdArgs.length === 0) {
          console.log("Usage: .debug <expression>");
          console.log("Example: .debug [1, 2, 3] /> map((x) -> x * 2) /> sum");
        } else {
          const expr = cmdArgs.join(" ");
          debugExpression(expr);
        }
        break;
      case "break":
        if (cmdArgs.length === 0) {
          console.log("Usage: .break <line> [file]");
        } else {
          const line = parseInt(cmdArgs[0], 10);
          const file = cmdArgs[1];
          if (isNaN(line)) {
            console.log("Invalid line number.");
          } else {
            const bp = state.debugger.addBreakpoint(line, file);
            console.log(`Breakpoint #${bp.id} set at ${file ? `${file}:` : "line "}${line}`);
          }
        }
        break;
      case "breaks":
        const breakpoints = state.debugger.listBreakpoints();
        if (breakpoints.length === 0) {
          console.log("No breakpoints set.");
        } else {
          console.log("\nBreakpoints:");
          for (const bp of breakpoints) {
            console.log(`  ${state.debugger.formatBreakpoint(bp)}`);
          }
          console.log();
        }
        break;
      case "delbreak":
        if (cmdArgs.length === 0) {
          console.log("Usage: .delbreak <id>");
        } else {
          const id = parseInt(cmdArgs[0], 10);
          if (state.debugger.removeBreakpoint(id)) {
            console.log(`Breakpoint #${id} deleted.`);
          } else {
            console.log(`Breakpoint #${id} not found.`);
          }
        }
        break;
      case "clearbreaks":
        state.debugger.clearBreakpoints();
        console.log("All breakpoints cleared.");
        break;
      case "watch":
        if (cmdArgs.length === 0) {
          console.log("Usage: .watch <expression>");
        } else {
          const watchExpr = cmdArgs.join(" ");
          state.debugger.addWatch(watchExpr);
          console.log(`Watching: ${watchExpr}`);
        }
        break;
      case "watches":
        const watches = state.debugger.listWatches();
        if (watches.length === 0) {
          console.log("No watch expressions.");
        } else {
          console.log("\nWatch expressions:");
          for (const w of watches) {
            try {
              const val = runCode(w, true);
              console.log(`  ${w} = ${formatValue(val)}`);
            } catch {
              console.log(`  ${w} = <error>`);
            }
          }
          console.log();
        }
        break;
      case "delwatch":
        if (cmdArgs.length === 0) {
          console.log("Usage: .delwatch <expression>");
        } else {
          const expr = cmdArgs.join(" ");
          if (state.debugger.removeWatch(expr)) {
            console.log(`Watch removed: ${expr}`);
          } else {
            console.log(`Watch not found: ${expr}`);
          }
        }
        break;
      case "clearwatches":
        state.debugger.clearWatches();
        console.log("All watches cleared.");
        break;

      // Session commands
      case "save":
        try {
          const workspaceName = saveWorkspace(cmdArgs[0]);
          console.log(`Workspace saved as "${workspaceName}"`);
        } catch (err) {
          console.error(`Error saving workspace: ${err}`);
        }
        break;
      case "load":
        if (cmdArgs.length === 0) {
          console.log("Usage: .load <workspace-name>");
          console.log("Use .workspaces to list available workspaces.");
        } else {
          if (!loadWorkspace(cmdArgs[0])) {
            console.log(`Workspace "${cmdArgs[0]}" not found.`);
            console.log("Use .workspaces to list available workspaces.");
          }
        }
        break;
      case "workspaces":
        const workspaceList = listWorkspaces();
        if (workspaceList.length === 0) {
          console.log("No saved workspaces.");
          console.log("Use .save [name] to save the current workspace.");
        } else {
          console.log("\nSaved workspaces:");
          for (const w of workspaceList) {
            console.log(`  ${w}`);
          }
          console.log();
        }
        break;
      case "export":
        try {
          const outputPath = exportSession(cmdArgs[0]);
          console.log(`Session exported to: ${outputPath}`);
        } catch (err) {
          console.error(`Error exporting session: ${err}`);
        }
        break;
      case "history":
        const count = parseInt(cmdArgs[0], 10) || 20;
        showHistory(count);
        break;

      case "exit":
        saveHistory(state.history);
        console.log("Goodbye!");
        process.exit(0);
      default:
        console.log(`Unknown command: .${cmd}`);
        console.log("Type .help for available commands.");
    }
    return;
  }

  // Handle tutorial 'done' command
  if (state.inTutorial && trimmed.toLowerCase() === "done") {
    checkTutorialAnswer(trimmed, null);
    return;
  }

  // Track session commands
  state.sessionCommands.push(line);

  // Execute code
  const result = runCode(line);
  if (result !== null) {
    const formatted = formatValue(result);
    console.log(formatted);
    state.sessionResults.push({ command: line, result: formatted });
  }

  // Check tutorial answer
  if (state.inTutorial && result !== null) {
    checkTutorialAnswer(line, result);
  }
}

// ============================================================================
// Tab Completion
// ============================================================================

const KEYWORDS = [
  "let", "maybe", "and", "true", "false", "await", "context", "provide",
  "match", "if", "return", "input", "null",
];

const BUILTINS = [
  "print", "sqrt", "abs", "floor", "ceil", "round", "min", "max",
  "length", "head", "tail", "push", "concat", "reverse", "zip", "isEmpty",
  "map", "filter", "reduce", "partition", "range", "iterations",
  "fst", "snd", "take", "at", "toString",
  "delay", "parallel", "race", "then",
  "random", "randomInt", "randomFloat", "randomChoice", "shuffle",
  "split", "lines", "charAt", "join", "padEnd", "padStart", "trim", "trimEnd",
  "indexOf", "includes", "repeat", "slice", "chars",
  "listSet", "setAdd", "setHas",
  "readFile", "writeFile", "appendFile", "fileExists", "deleteFile", "readDir", "fetch",
];

const COMMANDS = [
  ".help", ".examples", ".example", ".type", ".bindings", ".clear",
  ".reset", ".multiline", ".tutorial", ".exit",
  // Debugger commands
  ".debug", ".break", ".breaks", ".delbreak", ".clearbreaks",
  ".watch", ".watches", ".delwatch", ".clearwatches",
  // Session commands
  ".save", ".load", ".workspaces", ".export", ".history",
];

const HELP_TOPIC_NAMES = Object.keys(HELP_TOPICS).filter(k => k !== "main");

function completer(line: string): [string[], string] {
  const trimmed = line.trim();

  // Command completion
  if (trimmed.startsWith(".")) {
    const matches = COMMANDS.filter(c => c.startsWith(trimmed));

    // If typing .help, also suggest topics
    if (trimmed.startsWith(".help ")) {
      const partial = trimmed.slice(6);
      const topicMatches = HELP_TOPIC_NAMES.filter(t => t.startsWith(partial))
        .map(t => `.help ${t}`);
      return [topicMatches, line];
    }

    return [matches, line];
  }

  // Get the last word being typed
  const words = trimmed.split(/\s+/);
  const lastWord = words[words.length - 1] || "";

  // Complete keywords and builtins
  const allCompletions = [...KEYWORDS, ...BUILTINS];
  const matches = allCompletions.filter(c => c.startsWith(lastWord));

  return [matches, lastWord];
}

// ============================================================================
// Main REPL Loop
// ============================================================================

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  completer,
  historySize: 100,
});

// Handle up/down arrows for history
rl.on("line", () => {
  state.historyIndex = state.history.length;
});

function getPrompt(): string {
  if (state.inTutorial) {
    return "tutorial> ";
  }
  if (state.multilineMode) {
    return "... ";
  }
  return "lea> ";
}

function prompt(): void {
  rl.question(getPrompt(), (line) => {
    if (line === null) {
      console.log("\nGoodbye!");
      rl.close();
      return;
    }

    // Handle exit
    if (line.trim() === "exit" || line.trim() === ".exit") {
      console.log("Goodbye!");
      rl.close();
      return;
    }

    handleInput(line);
    prompt();
  });
}

// ============================================================================
// Startup
// ============================================================================

function printBanner(): void {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║   ██╗     ███████╗ █████╗                                                     ║
║   ██║     ██╔════╝██╔══██╗    Pipe-oriented functional language               ║
║   ██║     █████╗  ███████║    Type .help for commands                         ║
║   ██║     ██╔══╝  ██╔══██║    Type .tutorial for interactive guide            ║
║   ███████╗███████╗██║  ██║                                                    ║
║   ╚══════╝╚══════╝╚═╝  ╚═╝    ${strictFlag ? "(strict mode)" : "            "}                            ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
`);
}

// Initialize and load history
ensureDirectories();
state.history = loadHistory();

// Handle graceful shutdown
process.on("SIGINT", () => {
  saveHistory(state.history);
  console.log("\nGoodbye!");
  process.exit(0);
});

process.on("exit", () => {
  saveHistory(state.history);
});

printBanner();

if (state.inTutorial) {
  showTutorialStep();
}

prompt();

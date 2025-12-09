#!/usr/bin/env node

/**
 * Lea Project Initializer
 *
 * Creates a new Lea project with a basic structure and starter files.
 *
 * Usage:
 *   npm run lea:init                    # Initialize in current directory
 *   npm run lea:init my-project         # Create new directory 'my-project'
 *   npm run lea:init --template minimal # Use minimal template
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

// Templates
const TEMPLATES = {
  default: {
    description: "Standard project with examples and tests",
    files: {
      "main.lea": `-- Main entry point for your Lea project
-- Run with: npm run lea main.lea

-- Define some helper functions
let double = (x) -> x * 2
let addOne = (x) -> x + 1

-- Create a processing pipeline
let process = /> double /> addOne

-- Use it!
let result = 5 /> process
"Result: " ++ result /> print

-- Work with lists
let numbers = [1, 2, 3, 4, 5]
numbers
  /> filter((x) -> x > 2)
  /> map(double)
  /> print
`,
      "src/utils.lea": `-- Utility functions for your project

-- Math utilities
let square = (x) -> x * x
let cube = (x) -> x * x * x
let clamp = (x, min, max) ->
  x < min ? min : (x > max ? max : x)

-- List utilities
let sum = (list) -> list /> reduce(0, (acc, x) -> acc + x)
let average = (list) -> sum(list) / length(list)
let unique = (list) -> list /> listSet

-- String utilities
let capitalize = (s) ->
  let first = charAt(s, 0)
  let rest = slice(s, 1)
  first ++ rest

-- Export by just defining them (they're available when this file is loaded)
`,
      "tests/test-main.lea": `-- Tests for main.lea functionality

-- Simple assertions
let assertEqual = (actual, expected, msg) ->
  actual == expected
    ? print("PASS: " ++ msg)
    : print("FAIL: " ++ msg ++ " - Expected " ++ expected ++ " but got " ++ actual)

-- Test double function
let double = (x) -> x * 2
assertEqual(double(5), 10, "double(5) should be 10")
assertEqual(double(0), 0, "double(0) should be 0")

-- Test filter and map
let numbers = [1, 2, 3, 4, 5]
let result = numbers /> filter((x) -> x > 2) /> map((x) -> x * 2)
assertEqual(length(result), 3, "filtered list should have 3 elements")

print("")
print("All tests completed!")
`,
      "README.md": `# My Lea Project

A project built with [Lea](https://github.com/mcclowes/lea), a pipe-oriented functional language.

## Getting Started

\`\`\`bash
# Run the main file
npm run lea main.lea

# Run tests
npm run lea tests/test-main.lea

# Start the REPL
npm run repl
\`\`\`

## Project Structure

\`\`\`
.
├── main.lea           # Main entry point
├── src/
│   └── utils.lea      # Utility functions
├── tests/
│   └── test-main.lea  # Test file
└── README.md
\`\`\`

## Learning Resources

- [Getting Started Guide](https://github.com/mcclowes/lea/blob/main/docs/GETTING-STARTED.md)
- [Cheat Sheet](https://github.com/mcclowes/lea/blob/main/docs/CHEATSHEET.md)
- [FAQ](https://github.com/mcclowes/lea/blob/main/docs/FAQ.md)
- Start the REPL and type \`.tutorial\` for an interactive guide
`,
    },
  },
  minimal: {
    description: "Minimal project with just main.lea",
    files: {
      "main.lea": `-- Minimal Lea project
-- Run with: npm run lea main.lea

"Hello, Lea!" /> print
`,
    },
  },
  "data-processing": {
    description: "Data processing project with pipelines and async",
    files: {
      "main.lea": `-- Data Processing Pipeline
-- Run with: npm run lea main.lea

-- Sample data
let users = [
  { name: "Alice", age: 28, department: "Engineering", salary: 95000 },
  { name: "Bob", age: 35, department: "Marketing", salary: 75000 },
  { name: "Charlie", age: 42, department: "Engineering", salary: 120000 },
  { name: "Diana", age: 31, department: "HR", salary: 65000 },
  { name: "Eve", age: 26, department: "Engineering", salary: 85000 },
]

-- Pipeline to analyze engineering salaries
let analyzeEngineering = (users) ->
  users
    /> filter((u) -> u.department == "Engineering")
    /> map((u) -> u.salary)

let engSalaries = users /> analyzeEngineering
let total = engSalaries /> reduce(0, (acc, x) -> acc + x)
let avg = total / length(engSalaries)

"Engineering Salaries: " ++ engSalaries /> print
"Total: $" ++ total /> print
"Average: $" ++ avg /> print

-- Group by department
let countByDept = (users) ->
  let depts = users /> map((u) -> u.department) /> listSet
  depts /> map((dept) -> {
    department: dept,
    count: length(users /> filter((u) -> u.department == dept))
  })

"" /> print
"Employees by Department:" /> print
users /> countByDept /> print
`,
      "src/pipelines.lea": `-- Reusable data processing pipelines

-- Filter pipeline builder
let whereField = (field, predicate) ->
  (list) -> list /> filter((item) -> predicate(item.field))

-- Select specific fields
let selectFields = (fields) ->
  (list) -> list /> map((item) ->
    fields /> reduce({}, (acc, f) -> { ...acc, [f]: item[f] })
  )

-- Sort by field (simple bubble sort for demo)
let sortBy = (field, ascending = true) ->
  (list) ->
    let sorted = list /> reduce([], (acc, item) ->
      -- Simple insertion
      push(acc, item)
    )
    ascending ? sorted : reverse(sorted)

-- Aggregate functions
let sumBy = (field) ->
  (list) -> list /> map((item) -> item[field]) /> reduce(0, (a, b) -> a + b)

let avgBy = (field) ->
  (list) ->
    let values = list /> map((item) -> item[field])
    values /> reduce(0, (a, b) -> a + b) / length(values)
`,
      "README.md": `# Data Processing Project

A Lea project for data transformation and analysis.

## Usage

\`\`\`bash
npm run lea main.lea
\`\`\`

## Features

- Pipeline-based data processing
- Filtering and mapping
- Aggregation functions
- Grouping operations
`,
    },
  },
  async: {
    description: "Async/concurrent project with API calls",
    files: {
      "main.lea": `-- Async Lea Project
-- Demonstrates async operations, parallel execution, and error handling

-- Simulate async data fetching
let fetchUser = (id) ->
  delay(100, { id: id, name: "User " ++ id, active: true }) #async

let fetchPosts = (userId) ->
  delay(150, [
    { id: 1, userId: userId, title: "First Post" },
    { id: 2, userId: userId, title: "Second Post" },
  ]) #async

-- Sequential fetching
"Fetching user 1 sequentially..." /> print
let user = await fetchUser(1)
"Got user: " ++ user.name /> print

let posts = await fetchPosts(1)
"Got " ++ length(posts) ++ " posts" /> print

-- Parallel fetching
"" /> print
"Fetching multiple users in parallel..." /> print

let userIds = [1, 2, 3, 4, 5]
let users = userIds /> parallel((id) -> fetchUser(id))
"Got " ++ length(users) ++ " users in parallel" /> print
users /> map((u) -> u.name) /> print

-- With concurrency limit
"" /> print
"Fetching with concurrency limit of 2..." /> print
let limitedUsers = userIds /> parallel((id) -> fetchUser(id), { limit: 2 })
"Done!" /> print

-- Race example
"" /> print
"Racing two operations..." /> print
let winner = await race([
  delay(100, "Fast"),
  delay(200, "Slow"),
])
"Winner: " ++ winner /> print
`,
      "README.md": `# Async Project

A Lea project demonstrating async/await and concurrency.

## Features

- Async functions with \`#async\` decorator
- \`await\` for sequential async operations
- \`parallel()\` for concurrent execution
- \`race()\` for first-to-complete
- Concurrency limiting

## Usage

\`\`\`bash
npm run lea main.lea
\`\`\`
`,
    },
  },
};

// Colors for terminal output
const colors = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

function printBanner(): void {
  console.log(`
${colors.cyan("╔═══════════════════════════════════════════════════════════════╗")}
${colors.cyan("║")}                     ${colors.green("Lea Project Initializer")}                   ${colors.cyan("║")}
${colors.cyan("╚═══════════════════════════════════════════════════════════════╝")}
`);
}

function printTemplates(): void {
  console.log(colors.blue("Available templates:\n"));
  for (const [name, template] of Object.entries(TEMPLATES)) {
    console.log(`  ${colors.green(name.padEnd(20))} ${template.description}`);
  }
  console.log();
}

function createDirectory(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  createDirectory(dir);
  fs.writeFileSync(filePath, content);
  console.log(`  ${colors.green("+")} ${filePath}`);
}

function initProject(projectDir: string, templateName: string): void {
  const template = TEMPLATES[templateName as keyof typeof TEMPLATES];
  if (!template) {
    console.error(`Unknown template: ${templateName}`);
    console.log(`Available templates: ${Object.keys(TEMPLATES).join(", ")}`);
    process.exit(1);
  }

  // Create project directory if specified
  if (projectDir !== ".") {
    if (fs.existsSync(projectDir)) {
      console.error(`Directory already exists: ${projectDir}`);
      process.exit(1);
    }
    createDirectory(projectDir);
  }

  console.log(colors.blue(`\nCreating Lea project with '${templateName}' template...\n`));

  // Write all template files
  for (const [relativePath, content] of Object.entries(template.files)) {
    const fullPath = path.join(projectDir, relativePath);
    writeFile(fullPath, content);
  }

  console.log(`
${colors.green("Project created successfully!")}

${colors.blue("Next steps:")}
${projectDir !== "." ? `  cd ${projectDir}` : ""}
  npm run lea main.lea     ${colors.dim("# Run the main file")}
  npm run repl             ${colors.dim("# Start interactive REPL")}
  npm run repl -- --tutorial  ${colors.dim("# Interactive tutorial")}

${colors.blue("Learn more:")}
  .help                    ${colors.dim("# In REPL: show help")}
  .examples                ${colors.dim("# In REPL: show examples")}
`);
}

function showHelp(): void {
  console.log(`
${colors.blue("Usage:")}
  npm run lea:init [project-name] [--template <name>]

${colors.blue("Options:")}
  project-name         Name of the project directory (default: current directory)
  --template <name>    Template to use (default: default)
  --list               List available templates
  --help               Show this help message

${colors.blue("Examples:")}
  npm run lea:init                        ${colors.dim("# Init in current directory")}
  npm run lea:init my-project             ${colors.dim("# Create 'my-project' directory")}
  npm run lea:init --template minimal     ${colors.dim("# Use minimal template")}
  npm run lea:init my-app --template async  ${colors.dim("# Async template in 'my-app'")}
`);
  printTemplates();
}

async function interactiveInit(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  try {
    const projectName = await question(
      colors.blue("Project name (. for current directory): ")
    );

    console.log();
    printTemplates();

    const templateName = await question(
      colors.blue("Template (default): ")
    );

    rl.close();

    const name = projectName.trim() || ".";
    const template = templateName.trim() || "default";

    initProject(name, template);
  } catch (err) {
    rl.close();
    throw err;
  }
}

async function main(): Promise<void> {
  printBanner();

  const args = process.argv.slice(2);

  // Handle flags
  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    return;
  }

  if (args.includes("--list") || args.includes("-l")) {
    printTemplates();
    return;
  }

  // Parse arguments
  let projectDir = ".";
  let templateName = "default";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--template" || args[i] === "-t") {
      templateName = args[i + 1] || "default";
      i++;
    } else if (!args[i].startsWith("-")) {
      projectDir = args[i];
    }
  }

  // If no arguments, run interactive mode
  if (args.length === 0) {
    await interactiveInit();
  } else {
    initProject(projectDir, templateName);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});

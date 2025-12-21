#!/usr/bin/env node
/**
 * Sync documentation from /docs to /docusaurus/docs
 *
 * This script ensures that the docusaurus documentation stays in sync with
 * the source docs in /docs. It adds necessary frontmatter and handles
 * naming conventions.
 *
 * Usage: node scripts/sync-docs.js
 */

const fs = require("fs");
const path = require("path");

const DOCS_DIR = path.join(__dirname, "..", "docs");
const DOCUSAURUS_DOCS = path.join(__dirname, "..", "docusaurus", "docs");
const GUIDES_DIR = path.join(DOCUSAURUS_DOCS, "guides");

// Map source docs to docusaurus destinations with frontmatter
const DOC_MAPPING = {
  "BUILTINS.md": {
    dest: "builtins.md",
    frontmatter: { sidebar_position: 4 },
  },
  "CHEATSHEET.md": {
    dest: "cheatsheet.md",
    frontmatter: { sidebar_position: 8 },
  },
  "CONCURRENCY.md": {
    dest: "concurrency.md",
    frontmatter: { sidebar_position: 6 },
  },
  "FAQ.md": {
    dest: "faq.md",
    frontmatter: { sidebar_position: 9 },
  },
  "GETTING-STARTED.md": {
    dest: "getting-started.md",
    frontmatter: { sidebar_position: 2 },
  },
  "PIPELINES.md": {
    dest: "pipelines.md",
    frontmatter: { sidebar_position: 5 },
  },
  "SYNTAX.md": {
    dest: "syntax.md",
    frontmatter: { sidebar_position: 3 },
  },
  "LEA-FOR-JAVASCRIPT-DEVELOPERS.md": {
    dest: "guides/javascript-developers.md",
    frontmatter: { sidebar_position: 1 },
  },
  "LEA-FOR-PYTHON-DEVELOPERS.md": {
    dest: "guides/python-developers.md",
    frontmatter: { sidebar_position: 2 },
  },
};

function formatFrontmatter(fm) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(fm)) {
    lines.push(`${key}: ${value}`);
  }
  lines.push("---", "");
  return lines.join("\n");
}

function syncDoc(sourceName, config) {
  const sourcePath = path.join(DOCS_DIR, sourceName);
  const destPath = path.join(DOCUSAURUS_DOCS, config.dest);

  if (!fs.existsSync(sourcePath)) {
    console.warn(`  ⚠️  Source not found: ${sourceName}`);
    return false;
  }

  // Read source content
  let content = fs.readFileSync(sourcePath, "utf-8");

  // Add frontmatter
  const frontmatter = formatFrontmatter(config.frontmatter);
  content = frontmatter + content;

  // Ensure destination directory exists
  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // Write to destination
  fs.writeFileSync(destPath, content);
  console.log(`  ✓ ${sourceName} → ${config.dest}`);
  return true;
}

function main() {
  console.log("Syncing documentation from /docs to /docusaurus/docs...\n");

  let synced = 0;
  let failed = 0;

  for (const [source, config] of Object.entries(DOC_MAPPING)) {
    if (syncDoc(source, config)) {
      synced++;
    } else {
      failed++;
    }
  }

  console.log(`\nDone: ${synced} synced, ${failed} failed`);
}

main();

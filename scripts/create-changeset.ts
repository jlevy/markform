#!/usr/bin/env npx tsx
/**
 * Create a changeset file for the markform package.
 *
 * Usage: pnpm changeset:add <bump> <version> <summary>
 *
 * Examples:
 *   pnpm changeset:add patch 0.1.1 "Fix parsing bug"
 *   pnpm changeset:add minor 0.2.0 "Add new export format"
 *   pnpm changeset:add major 1.0.0 "Breaking API changes"
 */

import { writeFile } from "atomically";
import { join } from "path";

const [bump, version, summary] = process.argv.slice(2);

if (!bump || !version || !summary) {
  console.error("Usage: pnpm changeset:add <bump> <version> <summary>");
  console.error("  bump: patch | minor | major");
  console.error("  version: target version (e.g., 0.2.0)");
  console.error("  summary: changelog description");
  process.exit(1);
}

if (!["patch", "minor", "major"].includes(bump)) {
  console.error(`Invalid bump type: ${bump}`);
  console.error("Must be one of: patch, minor, major");
  process.exit(1);
}

const content = `---
"markform": ${bump}
---

${summary}
`;

const filename = `v${version}.md`;
const filepath = join(process.cwd(), ".changeset", filename);

await writeFile(filepath, content);
console.log(`Created .changeset/${filename}`);

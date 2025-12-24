/**
 * Example form registry.
 * Provides form content from the examples directory for the examples CLI command.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Example definition for the examples command. */
export interface ExampleDefinition {
  /** Machine-readable identifier (e.g., 'simple', 'political-research'). */
  id: string;
  /** Human-readable title for menu display. */
  title: string;
  /** One-line description of the example. */
  description: string;
  /** Default output filename (e.g., 'simple.form.md'). */
  filename: string;
  /** Relative path within examples directory. */
  path: string;
}

/** Example definitions without content - content is loaded lazily. */
export const EXAMPLE_DEFINITIONS: ExampleDefinition[] = [
  {
    id: "simple",
    title: "Simple Test Form",
    description:
      "Minimal form demonstrating all Markform v0.1 field types. Good for learning the basics.",
    filename: "simple.form.md",
    path: "simple/simple.form.md",
  },
  {
    id: "political-research",
    title: "Political Research",
    description:
      "Biographical form for researching political figures using web search. Includes repeating groups for offices held.",
    filename: "political-research.form.md",
    path: "political-research/political-research.form.md",
  },
  {
    id: "earnings-analysis",
    title: "Company Quarterly Analysis",
    description:
      "Extensive financial analysis worksheet with company profile and quarterly analysis sections.",
    filename: "earnings-analysis.form.md",
    path: "earnings-analysis/earnings-analysis.form.md",
  },
];

/**
 * Get the path to the examples directory.
 * Works both during development and when installed as a package.
 */
function getExamplesDir(): string {
  // Get the directory of this file (dist/cli-*.mjs or src/cli/examples/index.ts)
  const thisDir = dirname(fileURLToPath(import.meta.url));

  // Navigate up to package root (from dist/ or src/cli/examples/)
  // When bundled: dist/cli-*.mjs -> dist -> package root
  // We need to find the examples directory relative to package root
  const distDir = thisDir.includes("dist") ? dirname(thisDir) : thisDir;

  // If we're in dist, go up one level to package root
  // If we're in src/cli/examples, go up three levels
  let packageRoot: string;
  if (distDir.endsWith("dist")) {
    packageRoot = dirname(distDir);
  } else {
    // Development mode: src/cli/examples -> src/cli -> src -> package root
    packageRoot = dirname(dirname(dirname(thisDir)));
  }

  return join(packageRoot, "examples");
}

/**
 * Load the content of an example form.
 * @param exampleId - The example ID (e.g., 'simple', 'political-research')
 * @returns The form content as a string
 * @throws Error if the example is not found
 */
export function loadExampleContent(exampleId: string): string {
  const example = EXAMPLE_DEFINITIONS.find((e) => e.id === exampleId);
  if (!example) {
    throw new Error(`Unknown example: ${exampleId}`);
  }

  const examplesDir = getExamplesDir();
  const filePath = join(examplesDir, example.path);

  try {
    return readFileSync(filePath, "utf-8");
  } catch (error) {
    throw new Error(
      `Failed to load example '${exampleId}' from ${filePath}: ${error}`,
    );
  }
}

/**
 * Get all example IDs.
 */
export function getExampleIds(): string[] {
  return EXAMPLE_DEFINITIONS.map((e) => e.id);
}

/**
 * Get an example definition by ID.
 */
export function getExampleById(id: string): ExampleDefinition | undefined {
  return EXAMPLE_DEFINITIONS.find((e) => e.id === id);
}

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
      "User and agent roles for testing full workflow. User fills required fields, agent fills optional.",
    filename: "simple.form.md",
    path: "simple/simple.form.md",
  },
  {
    id: "political-research",
    title: "Political Research",
    description:
      "Biographical research form with one user field (name) and agent-filled details. Uses web search.",
    filename: "political-research.form.md",
    path: "political-research/political-research.form.md",
  },
  {
    id: "earnings-analysis",
    title: "Company Quarterly Analysis",
    description:
      "Financial analysis with one user field (company) and agent-filled quarterly analysis sections.",
    filename: "earnings-analysis.form.md",
    path: "earnings-analysis/earnings-analysis.form.md",
  },
];

/**
 * Get the path to the examples directory.
 * Works both during development and when installed as a package.
 */
function getExamplesDir(): string {
  // Get the directory of this file
  // - Bundled mode: thisDir is /path/to/package/dist
  // - Dev mode: thisDir is /path/to/package/src/cli/examples
  const thisDir = dirname(fileURLToPath(import.meta.url));

  // Check if we're in the dist directory (bundled mode)
  // Use basename to check the directory name, not a substring match
  const dirName = thisDir.split(/[/\\]/).pop();
  if (dirName === "dist") {
    // Bundled: dist -> package root -> examples
    return join(dirname(thisDir), "examples");
  }

  // Development mode: src/cli/examples -> src/cli -> src -> package root -> examples
  return join(dirname(dirname(dirname(thisDir))), "examples");
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

/**
 * Example form registry.
 * Provides form content from the examples directory for the examples CLI command.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ExampleDefinition } from '../lib/cliTypes.js';

// Re-export types for backwards compatibility
export type { ExampleDefinition } from '../lib/cliTypes.js';

/** Example definitions without content - content is loaded lazily. */
export const EXAMPLE_DEFINITIONS: ExampleDefinition[] = [
  {
    id: 'simple',
    title: 'Simple Test Form',
    description:
      'User and agent roles for testing full workflow. User fills required fields, agent fills optional.',
    filename: 'simple.form.md',
    path: 'simple/simple.form.md',
    type: 'fill',
  },
  {
    id: 'political-research',
    title: 'Political Research',
    description:
      'Biographical research form with one user field (name) and agent-filled details. Uses web search.',
    filename: 'political-research.form.md',
    path: 'political-research/political-research.form.md',
    type: 'research',
  },
  {
    id: 'earnings-analysis',
    title: 'Company Quarterly Analysis',
    description:
      'Financial analysis with one user field (company) and agent-filled quarterly analysis sections.',
    filename: 'earnings-analysis.form.md',
    path: 'earnings-analysis/earnings-analysis.form.md',
    type: 'research',
  },
  {
    id: 'startup-deep-research',
    title: 'Startup Deep Research',
    description:
      'Comprehensive startup intelligence gathering with company info, founders, funding, competitors, social media, and community presence.',
    filename: 'startup-deep-research.form.md',
    path: 'startup-deep-research/startup-deep-research.form.md',
    type: 'research',
  },
  {
    id: 'celebrity-deep-research',
    title: 'Celebrity Deep Research',
    description:
      'Comprehensive celebrity intelligence covering biography, career, relationships, controversies, social media, and hard-to-find details.',
    filename: 'celebrity-deep-research.form.md',
    path: 'celebrity-deep-research/celebrity-deep-research.form.md',
    type: 'research',
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
  if (dirName === 'dist') {
    // Bundled: dist -> package root -> examples
    return join(dirname(thisDir), 'examples');
  }

  // Development mode: src/cli/examples -> src/cli -> src -> package root -> examples
  return join(dirname(dirname(dirname(thisDir))), 'examples');
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
    return readFileSync(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to load example '${exampleId}' from ${filePath}: ${error}`);
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

/**
 * Get the absolute path to an example's source file.
 * @param exampleId - The example ID (e.g., 'simple', 'political-research')
 * @returns The absolute path to the example form file
 * @throws Error if the example is not found
 */
export function getExamplePath(exampleId: string): string {
  const example = EXAMPLE_DEFINITIONS.find((e) => e.id === exampleId);
  if (!example) {
    throw new Error(`Unknown example: ${exampleId}`);
  }
  return join(getExamplesDir(), example.path);
}

/**
 * Example form registry.
 * Provides form content from the examples directory for the examples CLI command.
 *
 * Metadata (title, description) is loaded dynamically from the form's YAML frontmatter
 * rather than being duplicated here, following the single source of truth principle.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import YAML from 'yaml';

import type { ExampleDefinition } from '../lib/cliTypes.js';

// Re-export types for backwards compatibility
export type { ExampleDefinition } from '../lib/cliTypes.js';

/**
 * Example definitions without content or metadata.
 * Title and description are loaded dynamically from frontmatter.
 */
export const EXAMPLE_DEFINITIONS: ExampleDefinition[] = [
  {
    id: 'movie-research-demo',
    filename: 'movie-research-demo.form.md',
    path: 'movie-research/movie-research-demo.form.md',
    type: 'research',
  },
  {
    id: 'simple',
    filename: 'simple.form.md',
    path: 'simple/simple.form.md',
    type: 'fill',
  },
  {
    id: 'movie-research-deep',
    filename: 'movie-research-deep.form.md',
    path: 'movie-research/movie-research-deep.form.md',
    type: 'research',
  },
  {
    id: 'startup-deep-research',
    filename: 'startup-deep-research.form.md',
    path: 'startup-deep-research/startup-deep-research.form.md',
    type: 'research',
  },
  {
    id: 'earnings-analysis',
    filename: 'earnings-analysis.form.md',
    path: 'earnings-analysis/earnings-analysis.form.md',
    type: 'research',
  },
];

/** Default example ID for menus (movie-research-demo, index 0) */
export const DEFAULT_EXAMPLE_ID = 'movie-research-demo';

/**
 * Get the canonical order index for an example by filename.
 * Returns -1 if not found (unknown files sort to the end).
 */
export function getExampleOrder(filename: string): number {
  const index = EXAMPLE_DEFINITIONS.findIndex((e) => e.filename === filename);
  return index >= 0 ? index : EXAMPLE_DEFINITIONS.length;
}

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
 * @param exampleId - The example ID (e.g., 'simple', 'movie-research-deep')
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
 * @param exampleId - The example ID (e.g., 'simple', 'movie-research-deep')
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

/**
 * Extract YAML frontmatter from a markdown file content.
 * @param content - The markdown file content
 * @returns The parsed frontmatter object or null if no frontmatter found
 */
function extractFrontmatter(content: string): Record<string, unknown> | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch || !frontmatterMatch[1]) {
    return null;
  }
  try {
    return YAML.parse(frontmatterMatch[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Load metadata (title, description) from an example's YAML frontmatter.
 * @param exampleId - The example ID (e.g., 'simple', 'movie-research-deep')
 * @returns Object with title and description from frontmatter
 */
export function loadExampleMetadata(exampleId: string): { title?: string; description?: string } {
  const content = loadExampleContent(exampleId);
  const frontmatter = extractFrontmatter(content);

  if (!frontmatter || !frontmatter.markform) {
    return {};
  }

  const markform = frontmatter.markform as Record<string, unknown>;
  return {
    title: typeof markform.title === 'string' ? markform.title : undefined,
    description: typeof markform.description === 'string' ? markform.description : undefined,
  };
}

/**
 * Get an example definition with metadata loaded from frontmatter.
 * @param id - The example ID
 * @returns ExampleDefinition with title and description populated
 */
export function getExampleWithMetadata(id: string): ExampleDefinition | undefined {
  const example = getExampleById(id);
  if (!example) {
    return undefined;
  }

  const metadata = loadExampleMetadata(id);
  return {
    ...example,
    title: metadata.title,
    description: metadata.description,
  };
}

/**
 * Get all example definitions with metadata loaded from frontmatter.
 * @returns Array of ExampleDefinition with title and description populated
 */
export function getAllExamplesWithMetadata(): ExampleDefinition[] {
  return EXAMPLE_DEFINITIONS.map((example) => {
    const metadata = loadExampleMetadata(example.id);
    return {
      ...example,
      title: metadata.title,
      description: metadata.description,
    };
  });
}

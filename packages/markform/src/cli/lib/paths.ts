/**
 * Path utilities for CLI commands.
 *
 * This module contains Node.js-dependent path utilities that are only used
 * by CLI code. Keeping these separate from settings.ts allows the core
 * library to remain Node.js-free.
 */

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_FORMS_DIR } from '../../settings.js';

// Re-export for convenience - CLI code can import all path-related things from here
export { DEFAULT_FORMS_DIR };

/**
 * Resolve a path relative to the package root, handling both dev and dist modes.
 *
 * In dist mode, commands run from `<pkg>/dist/` (1 level below root).
 * In dev mode, commands run from `<pkg>/src/cli/commands/` or `<pkg>/src/cli/examples/`
 * (3 levels below root).
 *
 * @param callerMetaUrl - The `import.meta.url` of the calling module
 * @param relativePath - Path relative to the package root (e.g. 'docs/markform-reference.md')
 */
export function resolvePackagePath(callerMetaUrl: string, relativePath: string): string {
  const thisDir = dirname(fileURLToPath(callerMetaUrl));
  const dirName = thisDir.split(/[/\\]/).pop();

  if (dirName === 'dist') {
    return join(dirname(thisDir), relativePath);
  }

  // Dev: src/cli/commands or src/cli/examples — 3 levels up to package root
  return join(dirname(dirname(dirname(thisDir))), relativePath);
}

/**
 * Resolve the forms directory path to an absolute path.
 * Uses the provided override or falls back to DEFAULT_FORMS_DIR.
 *
 * @param override Optional override path from CLI --forms-dir option
 * @param cwd Base directory for resolving relative paths (defaults to process.cwd())
 * @returns Absolute path to the forms directory
 */
export function getFormsDir(override?: string, cwd: string = process.cwd()): string {
  const formsDir = override ?? DEFAULT_FORMS_DIR;
  return resolve(cwd, formsDir);
}

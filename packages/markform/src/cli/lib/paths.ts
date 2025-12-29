/**
 * Path utilities for CLI commands.
 *
 * This module contains Node.js-dependent path utilities that are only used
 * by CLI code. Keeping these separate from settings.ts allows the core
 * library to remain Node.js-free.
 */

import { resolve } from 'node:path';

/**
 * Default forms directory for CLI output (relative to cwd).
 * Commands write form outputs here to avoid cluttering the workspace.
 */
export const DEFAULT_FORMS_DIR = './forms';

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

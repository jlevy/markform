/**
 * Versioned filename utilities for form output.
 *
 * Generates versioned filenames to avoid overwriting existing files.
 * Pattern: name.form.md → name-filled1.form.md → name-filled2.form.md
 */

import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';

/**
 * Version pattern that matches -filledN or _filledN before the extension.
 * Also matches legacy -vN pattern for backwards compatibility.
 */
const VERSION_PATTERN = /^(.+?)(?:[-_]?(?:filled|v)(\d+))?(\.form\.md)$/i;

/**
 * Extension pattern for fallback matching.
 */
const EXTENSION_PATTERN = /^(.+)(\.form\.md)$/i;

/**
 * Parse a versioned filename into its components.
 *
 * @param filePath - Path to parse
 * @returns Parsed components or null if not a valid form file
 */
export function parseVersionedPath(filePath: string): {
  base: string;
  version: number | null;
  extension: string;
} | null {
  const match = VERSION_PATTERN.exec(filePath);
  if (match) {
    const base = match[1];
    const versionStr = match[2];
    const ext = match[3];
    // The regex guarantees base and ext are defined when match succeeds
    if (base !== undefined && ext !== undefined) {
      return {
        base,
        version: versionStr ? parseInt(versionStr, 10) : null,
        extension: ext,
      };
    }
  }

  const extMatch = EXTENSION_PATTERN.exec(filePath);
  if (extMatch) {
    const base = extMatch[1];
    const ext = extMatch[2];
    // The regex guarantees both groups are defined when match succeeds
    if (base !== undefined && ext !== undefined) {
      return {
        base,
        version: null,
        extension: ext,
      };
    }
  }

  return null;
}

/**
 * Generate the next versioned filename.
 *
 * If the file has no version, adds -filled1.
 * If the file has a version, increments it.
 *
 * @param filePath - Original file path
 * @returns Next versioned filename
 */
export function incrementVersion(filePath: string): string {
  const parsed = parseVersionedPath(filePath);

  if (parsed) {
    const newVersion = parsed.version !== null ? parsed.version + 1 : 1;
    return `${parsed.base}-filled${newVersion}${parsed.extension}`;
  }

  // Fallback for non-.form.md files
  return `${filePath}-filled1`;
}

/**
 * Generate a versioned filename that doesn't conflict with existing files.
 *
 * Starts from the incremented version and keeps incrementing until
 * a non-existent filename is found.
 *
 * @param filePath - Original file path
 * @returns Path to a non-existent versioned file
 */
export function generateVersionedPath(filePath: string): string {
  const parsed = parseVersionedPath(filePath);

  if (!parsed) {
    // Fallback for non-.form.md files
    let candidate = `${filePath}-filled1`;
    let version = 1;
    while (existsSync(candidate)) {
      version++;
      candidate = `${filePath}-filled${version}`;
    }
    return candidate;
  }

  // Start from version 1 or increment existing version
  let version = parsed.version !== null ? parsed.version + 1 : 1;
  let candidate = `${parsed.base}-filled${version}${parsed.extension}`;

  // Find next available version
  while (existsSync(candidate)) {
    version++;
    candidate = `${parsed.base}-filled${version}${parsed.extension}`;
  }

  return candidate;
}

/**
 * Generate a versioned filename within the forms directory.
 *
 * Derives the base name from the input path and creates a versioned
 * output path within the specified forms directory.
 *
 * @param inputPath - Original input file path (used to derive basename)
 * @param formsDir - Absolute path to the forms directory
 * @returns Absolute path to a non-existent versioned file in formsDir
 */
export function generateVersionedPathInFormsDir(inputPath: string, formsDir: string): string {
  // Get the filename from the input path
  const inputFilename = basename(inputPath);

  // Parse to get base name without version
  const parsed = parseVersionedPath(inputFilename);

  // Use the base name (stripped of any existing version) or the full filename
  const baseName = parsed?.base ?? inputFilename.replace(/\.form\.md$/i, '');
  const extension = parsed?.extension ?? '.form.md';

  // Start from version 1 and find next available
  let version = 1;
  let candidate = join(formsDir, `${baseName}-filled${version}${extension}`);

  while (existsSync(candidate)) {
    version++;
    candidate = join(formsDir, `${baseName}-filled${version}${extension}`);
  }

  return candidate;
}

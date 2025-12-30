/**
 * Guard tests to ensure the core library remains Node.js-free.
 *
 * These tests prevent accidental introduction of Node.js dependencies
 * into the core library, which would break use in browsers, edge runtimes,
 * and other non-Node environments.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, '../../src');
const DIST_DIR = join(__dirname, '../../dist');

// Directories that ARE allowed to use Node.js
const NODE_ALLOWED_DIRS = ['cli'];

// Pattern to detect Node.js imports
const NODE_IMPORT_PATTERN = /from\s+['"]node:/g;

/**
 * Recursively get all TypeScript source files (excluding test files).
 */
function getAllTsFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      getAllTsFiles(fullPath, files);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Check if a file path is in one of the allowed directories.
 */
function isInAllowedDir(filePath: string): boolean {
  const rel = relative(SRC_DIR, filePath);
  return NODE_ALLOWED_DIRS.some((dir) => rel.startsWith(dir + '/') || rel.startsWith(dir + '\\'));
}

describe('Node-free core library', () => {
  it('source files outside cli/ should not import from node:', () => {
    const violations: string[] = [];

    for (const file of getAllTsFiles(SRC_DIR)) {
      if (isInAllowedDir(file)) continue;

      const content = readFileSync(file, 'utf-8');
      const matches = content.match(NODE_IMPORT_PATTERN);
      if (matches) {
        const rel = relative(SRC_DIR, file);
        violations.push(`${rel}: ${matches.join(', ')}`);
      }
    }

    expect(
      violations,
      `Node.js imports found outside cli/:\n${violations.join('\n')}`,
    ).toHaveLength(0);
  });

  it('dist/index.mjs should not reference node: modules', () => {
    const indexPath = join(DIST_DIR, 'index.mjs');
    const content = readFileSync(indexPath, 'utf-8');
    const matches = content.match(NODE_IMPORT_PATTERN);
    expect(matches, 'index.mjs contains node: imports').toBeNull();
  });

  it('dist/ai-sdk.mjs should not reference node: modules', () => {
    const aiSdkPath = join(DIST_DIR, 'ai-sdk.mjs');
    const content = readFileSync(aiSdkPath, 'utf-8');
    const matches = content.match(NODE_IMPORT_PATTERN);
    expect(matches, 'ai-sdk.mjs contains node: imports').toBeNull();
  });

  it('built VERSION should be valid semver derived from git tags', async () => {
    // Dynamic import to get built output
    const { VERSION } = await import('../../dist/index.mjs');

    // VERSION can be:
    // - Exact tag version: "1.2.3"
    // - Dev version: "1.2.4-dev.12.a1b2c3d" (bumped patch + commits + hash)
    // - Dirty dev: "1.2.4-dev.12.a1b2c3d-dirty"
    // - Fallback: package.json version

    // Must be a non-empty string
    expect(typeof VERSION).toBe('string');
    expect(VERSION.length).toBeGreaterThan(0);

    // Must match semver-like pattern (X.Y.Z with optional pre-release)
    const semverPattern = /^\d+\.\d+\.\d+(-dev\.\d+\.[a-f0-9]+(-dirty)?)?$/;
    expect(VERSION).toMatch(semverPattern);
  });
});

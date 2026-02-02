/**
 * Golden Test Sensitivity Validation
 *
 * Verifies that the golden test comparison catches various types of mutations.
 * Each test applies a mutation to a golden file and verifies that the
 * regenerated session does NOT match the mutated version.
 *
 * This ensures the byte-for-byte comparison is working correctly.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { normalizeSession, regenerateSession } from './helpers.js';

// =============================================================================
// Configuration
// =============================================================================

const EXAMPLES_DIR = join(__dirname, '../../examples');
const GOLDEN_PATH = join(EXAMPLES_DIR, 'simple/simple.session.yaml');

// =============================================================================
// Mutation Definitions
// =============================================================================

interface Mutation {
  name: string;
  description: string;
  find: string | RegExp;
  replace: string;
}

/**
 * Mutations that should cause test failures.
 * Each represents a type of drift that the golden tests should catch.
 */
const MUTATIONS: Mutation[] = [
  {
    name: 'operation type change',
    description: 'Change op type (set_number → set_string)',
    find: 'op: set_number',
    replace: 'op: set_string',
  },
  {
    name: 'field id typo',
    description: 'Typo in field reference (age → agee)',
    find: 'ref: age',
    replace: 'ref: agee',
  },
  {
    name: 'issue severity change',
    description: 'Change severity level (required → optional)',
    find: 'severity: required',
    replace: 'severity: optional',
  },
  {
    name: 'issue message text change',
    description: 'Subtle text change in issue message',
    find: 'is empty',
    replace: 'is Empty',
  },
  {
    name: 'patch value change',
    description: 'Change a patch value (32 → 33)',
    find: 'value: 32',
    replace: 'value: 33',
  },
  {
    name: 'system prompt change',
    description: 'Modify system prompt content',
    find: 'Address required fields first',
    replace: 'Address optional fields first',
  },
  {
    name: 'hash change',
    description: 'Corrupt the SHA256 hash',
    find: /markdown_sha256: ([a-f0-9]+)/,
    replace: 'markdown_sha256: 0000000000000000000000000000000000000000000000000000000000000000',
  },
  {
    name: 'tool schema $ref change',
    description: 'Modify tool schema reference',
    find: '$ref: "#/$defs/patch"',
    replace: '$ref: "#/$defs/patches"',
  },
  {
    name: 'fill mode change',
    description: 'Change fill mode configuration',
    find: 'fill_mode: continue',
    replace: 'fill_mode: complete',
  },
  {
    name: 'priority change',
    description: 'Change issue priority',
    find: 'priority: 1',
    replace: 'priority: 2',
  },
];

// =============================================================================
// Validation Tests
// =============================================================================

describe('Golden Test Sensitivity', () => {
  for (const mutation of MUTATIONS) {
    it(`detects: ${mutation.name}`, async () => {
      // Load the golden file
      const golden = readFileSync(GOLDEN_PATH, 'utf-8');

      // Apply the mutation
      const mutated =
        mutation.find instanceof RegExp
          ? golden.replace(mutation.find, mutation.replace)
          : golden.replace(mutation.find, mutation.replace);

      // Verify the mutation was actually applied
      expect(mutated).not.toBe(golden);

      // Regenerate the session from scratch
      const regenerated = await regenerateSession(GOLDEN_PATH);

      // The regenerated version should NOT match the mutated version
      // This verifies that the golden test would catch this mutation
      expect(normalizeSession(regenerated)).not.toBe(normalizeSession(mutated));
    });
  }
});

describe('Golden Test Idempotency', () => {
  it('regeneration produces identical output', async () => {
    // Load the current golden file
    const golden = readFileSync(GOLDEN_PATH, 'utf-8');

    // Regenerate
    const regenerated = await regenerateSession(GOLDEN_PATH);

    // After normalization (token counts), they should be identical
    expect(normalizeSession(regenerated)).toBe(normalizeSession(golden));
  });

  it('double regeneration is stable', async () => {
    // Regenerate twice and verify identical output
    const first = await regenerateSession(GOLDEN_PATH);
    const second = await regenerateSession(GOLDEN_PATH);

    expect(normalizeSession(first)).toBe(normalizeSession(second));
  });
});

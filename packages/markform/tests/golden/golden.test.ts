/**
 * Golden Session Tests
 *
 * These tests replay recorded session transcripts and verify:
 * - Issues match at each turn
 * - Form state (SHA256 hash) matches after each turn
 * - Final form matches the expected completed form
 */

import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { findSessionFiles, runGoldenTest } from './runner.js';

// =============================================================================
// Configuration
// =============================================================================

const EXAMPLES_DIR = join(__dirname, '../../examples');

// =============================================================================
// Golden Session Tests
// =============================================================================

describe('Golden Session Tests', () => {
  // Find all session files
  const sessionFiles = findSessionFiles(EXAMPLES_DIR);

  if (sessionFiles.length === 0) {
    it.skip('no session files found', () => {
      // Skip if no session files exist yet
    });
  } else {
    // Create a test for each session file
    for (const sessionPath of sessionFiles) {
      const relativePath = sessionPath.replace(EXAMPLES_DIR + '/', '');

      it(`replays ${relativePath}`, () => {
        const result = runGoldenTest(sessionPath);

        // Log details on failure
        if (!result.success) {
          console.log('Golden test failed:', relativePath);
          console.log('Errors:', result.errors);
          console.log('Final result:', result.finalResult);
          for (const turn of result.turns) {
            console.log(`Turn ${turn.turn}:`, {
              issuesMatch: turn.issuesMatch,
              hashMatch: turn.hashMatch,
              expectedHash: turn.expectedHash.slice(0, 16) + '...',
              actualHash: turn.actualHash.slice(0, 16) + '...',
              issuesDiff: turn.issuesDiff,
            });
          }
        }

        expect(result.success).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.finalResult.formMatches).toBe(true);
      });
    }
  }
});

// =============================================================================
// Individual Form Tests
// =============================================================================

describe('Simple Form Golden Test', () => {
  const sessionPath = join(EXAMPLES_DIR, 'simple/simple.session.yaml');

  it('replays simple form session', async () => {
    // Check if session file exists
    const { existsSync } = await import('node:fs');
    if (!existsSync(sessionPath)) {
      // Skip if session file doesn't exist yet
      console.log('Skipping: simple.session.yaml not found');
      return;
    }

    const result = runGoldenTest(sessionPath);

    expect(result.success).toBe(true);
    // Check that completion matches expectations from session
    // Note: This session leaves optional_number empty, so isComplete is false
    expect(result.finalResult.formMatches).toBe(true);
  });
});

/**
 * Tests for harness configuration resolution.
 */
import { describe, expect, it } from 'vitest';

import { resolveHarnessConfig } from '../../../src/harness/harnessConfigResolver.js';
import {
  DEFAULT_MAX_ISSUES_PER_TURN,
  DEFAULT_MAX_PATCHES_PER_TURN,
  DEFAULT_MAX_TURNS,
} from '../../../src/settings.js';
import type { ParsedForm } from '../../../src/engine/coreTypes.js';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockForm(harnessConfig?: Record<string, unknown>): ParsedForm {
  // Minimal mock form for testing config resolution
  // Uses type assertion since we only need metadata access
  return {
    schema: { id: 'test', title: 'Test', groups: [] },
    responsesByFieldId: {},
    isComplete: false,
    issues: [],
    metadata: harnessConfig ? { harnessConfig } : undefined,
  } as unknown as ParsedForm;
}

// =============================================================================
// Tests
// =============================================================================

describe('harnessConfigResolver', () => {
  describe('resolveHarnessConfig', () => {
    it('uses defaults when no config provided', () => {
      const form = createMockForm();
      const config = resolveHarnessConfig(form);

      expect(config.maxTurns).toBe(DEFAULT_MAX_TURNS);
      expect(config.maxPatchesPerTurn).toBe(DEFAULT_MAX_PATCHES_PER_TURN);
      expect(config.maxIssuesPerTurn).toBe(DEFAULT_MAX_ISSUES_PER_TURN);
    });

    it('uses frontmatter config over defaults', () => {
      const form = createMockForm({
        maxTurns: 5,
        maxPatchesPerTurn: 3,
        maxIssuesPerTurn: 2,
      });
      const config = resolveHarnessConfig(form);

      expect(config.maxTurns).toBe(5);
      expect(config.maxPatchesPerTurn).toBe(3);
      expect(config.maxIssuesPerTurn).toBe(2);
    });

    it('uses options over frontmatter', () => {
      const form = createMockForm({
        maxTurns: 5,
        maxPatchesPerTurn: 3,
      });
      const options = {
        maxTurns: 10,
        maxPatchesPerTurn: 8,
      };
      const config = resolveHarnessConfig(form, options);

      expect(config.maxTurns).toBe(10);
      expect(config.maxPatchesPerTurn).toBe(8);
    });

    it('merges partial options with frontmatter', () => {
      const form = createMockForm({
        maxTurns: 5,
        maxPatchesPerTurn: 3,
        maxIssuesPerTurn: 2,
      });
      const options = {
        maxTurns: 10, // Override only this
      };
      const config = resolveHarnessConfig(form, options);

      expect(config.maxTurns).toBe(10); // From options
      expect(config.maxPatchesPerTurn).toBe(3); // From frontmatter
      expect(config.maxIssuesPerTurn).toBe(2); // From frontmatter
    });

    it('includes targetRoles from options', () => {
      const form = createMockForm();
      const options = {
        targetRoles: ['user', 'assistant'],
      };
      const config = resolveHarnessConfig(form, options);

      expect(config.targetRoles).toEqual(['user', 'assistant']);
    });

    it('includes fillMode from options', () => {
      const form = createMockForm();
      const options = {
        fillMode: 'continue' as const,
      };
      const config = resolveHarnessConfig(form, options);

      expect(config.fillMode).toBe('continue');
    });

    it('handles form without metadata', () => {
      const form = { ...createMockForm(), metadata: undefined };
      const config = resolveHarnessConfig(form);

      expect(config.maxTurns).toBe(DEFAULT_MAX_TURNS);
    });

    it('handles form with empty metadata', () => {
      const form = { ...createMockForm(), metadata: {} };
      const config = resolveHarnessConfig(form as unknown as ParsedForm);

      expect(config.maxTurns).toBe(DEFAULT_MAX_TURNS);
    });
  });
});

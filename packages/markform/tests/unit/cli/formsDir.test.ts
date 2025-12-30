/**
 * Tests for forms directory utilities.
 */

import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { getFormsDir, DEFAULT_FORMS_DIR } from '../../../src/cli/lib/paths.js';
import { ensureFormsDir } from '../../../src/cli/lib/shared.js';

// Mock fs/promises for testing ensureFormsDir
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
}));

describe('forms directory utilities', () => {
  describe('getFormsDir', () => {
    const testCwd = '/home/user/project';

    it('returns default forms dir when no override provided', () => {
      const result = getFormsDir(undefined, testCwd);
      expect(result).toBe(resolve(testCwd, DEFAULT_FORMS_DIR));
    });

    it('uses override when provided', () => {
      const result = getFormsDir('./custom-output', testCwd);
      expect(result).toBe(resolve(testCwd, './custom-output'));
    });

    it('handles absolute override path', () => {
      const result = getFormsDir('/tmp/my-forms', testCwd);
      expect(result).toBe('/tmp/my-forms');
    });

    it('resolves relative paths correctly', () => {
      const result = getFormsDir('../shared-forms', testCwd);
      expect(result).toBe(resolve(testCwd, '../shared-forms'));
    });
  });

  describe('ensureFormsDir', () => {
    const mockMkdir = vi.mocked(mkdir);

    it('creates directory with recursive option', async () => {
      await ensureFormsDir('/tmp/test-forms');
      expect(mockMkdir).toHaveBeenCalledWith('/tmp/test-forms', { recursive: true });
    });

    it('handles nested paths', async () => {
      await ensureFormsDir('/tmp/deep/nested/forms');
      expect(mockMkdir).toHaveBeenCalledWith('/tmp/deep/nested/forms', { recursive: true });
    });
  });

  describe('DEFAULT_FORMS_DIR', () => {
    it('is set to ./forms', () => {
      expect(DEFAULT_FORMS_DIR).toBe('./forms');
    });
  });
});

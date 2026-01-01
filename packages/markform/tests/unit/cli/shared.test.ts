/**
 * Unit tests for shared CLI utilities.
 *
 * Tests pure functions that don't require Commander or TTY infrastructure.
 */

import { describe, it, expect } from 'vitest';
import { formatPath, createNoOpSpinner, OUTPUT_FORMATS } from '../../../src/cli/lib/shared.js';

describe('shared utilities', () => {
  describe('OUTPUT_FORMATS', () => {
    it('includes console format', () => {
      expect(OUTPUT_FORMATS).toContain('console');
    });

    it('includes plaintext format', () => {
      expect(OUTPUT_FORMATS).toContain('plaintext');
    });

    it('includes yaml format', () => {
      expect(OUTPUT_FORMATS).toContain('yaml');
    });

    it('includes json format', () => {
      expect(OUTPUT_FORMATS).toContain('json');
    });

    it('includes markform format', () => {
      expect(OUTPUT_FORMATS).toContain('markform');
    });

    it('includes markdown format', () => {
      expect(OUTPUT_FORMATS).toContain('markdown');
    });

    it('has exactly 6 formats', () => {
      expect(OUTPUT_FORMATS).toHaveLength(6);
    });
  });

  describe('formatPath', () => {
    it('formats path within cwd as relative with ./ prefix', () => {
      const result = formatPath('/home/user/project/file.md', '/home/user/project');
      // Strip ANSI codes for comparison
      // eslint-disable-next-line no-control-regex
      const stripped = result.replace(/\x1b\[[0-9;]*m/g, '');
      expect(stripped).toBe('./file.md');
    });

    it('formats path in subdirectory with relative path', () => {
      const result = formatPath('/home/user/project/src/file.ts', '/home/user/project');
      // Strip ANSI codes for comparison
      // eslint-disable-next-line no-control-regex
      const stripped = result.replace(/\x1b\[[0-9;]*m/g, '');
      expect(stripped).toBe('./src/file.ts');
    });

    it('formats path outside cwd as absolute path', () => {
      const result = formatPath('/other/path/file.md', '/home/user/project');
      // Strip ANSI codes for comparison
      // eslint-disable-next-line no-control-regex
      const stripped = result.replace(/\x1b\[[0-9;]*m/g, '');
      expect(stripped).toBe('/other/path/file.md');
    });

    it('formats path in parent directory as absolute path', () => {
      const result = formatPath('/home/user/file.md', '/home/user/project');
      // Strip ANSI codes for comparison
      // eslint-disable-next-line no-control-regex
      const stripped = result.replace(/\x1b\[[0-9;]*m/g, '');
      expect(stripped).toBe('/home/user/file.md');
    });

    it('returns string containing the path', () => {
      const result = formatPath('/home/user/project/file.md', '/home/user/project');
      // In non-TTY environments, picocolors may not add ANSI codes
      // Just verify the path content is present
      // eslint-disable-next-line no-control-regex
      const stripped = result.replace(/\x1b\[[0-9;]*m/g, '');
      expect(stripped).toContain('file.md');
    });

    it('formats current directory file correctly', () => {
      const result = formatPath('/test/cwd/myfile.txt', '/test/cwd');
      // Strip ANSI codes for comparison
      // eslint-disable-next-line no-control-regex
      const stripped = result.replace(/\x1b\[[0-9;]*m/g, '');
      expect(stripped).toBe('./myfile.txt');
    });
  });

  describe('createNoOpSpinner', () => {
    it('returns a SpinnerHandle object', () => {
      const spinner = createNoOpSpinner();
      expect(spinner).toHaveProperty('message');
      expect(spinner).toHaveProperty('update');
      expect(spinner).toHaveProperty('stop');
      expect(spinner).toHaveProperty('error');
      expect(spinner).toHaveProperty('getElapsedMs');
    });

    it('has message function that is callable', () => {
      const spinner = createNoOpSpinner();
      expect(() => {
        spinner.message('test');
      }).not.toThrow();
    });

    it('has update function that is callable', () => {
      const spinner = createNoOpSpinner();
      expect(() => {
        spinner.update({ type: 'api', provider: 'test', model: 'test' });
      }).not.toThrow();
    });

    it('has stop function that is callable', () => {
      const spinner = createNoOpSpinner();
      expect(() => {
        spinner.stop('done');
      }).not.toThrow();
    });

    it('has error function that is callable', () => {
      const spinner = createNoOpSpinner();
      expect(() => {
        spinner.error('error occurred');
      }).not.toThrow();
    });

    it('getElapsedMs returns a number', () => {
      const spinner = createNoOpSpinner();
      const elapsed = spinner.getElapsedMs();
      expect(typeof elapsed).toBe('number');
      expect(elapsed).toBeGreaterThanOrEqual(0);
    });

    it('getElapsedMs increases over time', async () => {
      const spinner = createNoOpSpinner();
      const start = spinner.getElapsedMs();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const end = spinner.getElapsedMs();
      expect(end).toBeGreaterThan(start);
    });
  });
});

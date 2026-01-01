/**
 * Unit tests for shared CLI utilities.
 * Tests pure functions that don't require Commander or TTY infrastructure.
 */

import { describe, it, expect } from 'vitest';
import { formatPath, createNoOpSpinner, OUTPUT_FORMATS } from '../../../src/cli/lib/shared.js';

/** Strip ANSI codes from string for comparison */
// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

describe('shared utilities', () => {
  it('OUTPUT_FORMATS includes all expected formats', () => {
    expect(OUTPUT_FORMATS).toEqual([
      'console',
      'plaintext',
      'yaml',
      'json',
      'markform',
      'markdown',
    ]);
  });

  // formatPath: [absolutePath, cwd, expected]
  const FORMAT_PATH_CASES: [string, string, string][] = [
    ['/home/user/project/file.md', '/home/user/project', './file.md'],
    ['/home/user/project/src/file.ts', '/home/user/project', './src/file.ts'],
    ['/other/path/file.md', '/home/user/project', '/other/path/file.md'],
    ['/home/user/file.md', '/home/user/project', '/home/user/file.md'],
    ['/test/cwd/myfile.txt', '/test/cwd', './myfile.txt'],
  ];

  it.each(FORMAT_PATH_CASES)('formatPath(%s, %s) → %s', (path, cwd, expected) => {
    expect(stripAnsi(formatPath(path, cwd))).toBe(expected);
  });

  describe('createNoOpSpinner', () => {
    it('returns SpinnerHandle with all required methods', () => {
      const spinner = createNoOpSpinner();
      expect(spinner).toMatchObject({
        message: expect.any(Function),
        update: expect.any(Function),
        stop: expect.any(Function),
        error: expect.any(Function),
        getElapsedMs: expect.any(Function),
      });
    });

    it('all methods are callable without throwing', () => {
      const spinner = createNoOpSpinner();
      expect(() => { spinner.message('test'); }).not.toThrow();
      expect(() => { spinner.update({ type: 'api', provider: 'test', model: 'test' }); }).not.toThrow();
      expect(() => { spinner.stop('done'); }).not.toThrow();
      expect(() => { spinner.error('error'); }).not.toThrow();
    });

    it('getElapsedMs tracks time', async () => {
      const spinner = createNoOpSpinner();
      const start = spinner.getElapsedMs();
      expect(start).toBeGreaterThanOrEqual(0);
      await new Promise((r) => setTimeout(r, 50));
      expect(spinner.getElapsedMs()).toBeGreaterThan(start);
    });
  });
});

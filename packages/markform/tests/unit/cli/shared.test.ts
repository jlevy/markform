/**
 * Unit tests for shared CLI utilities.
 * Tests pure functions that don't require Commander or TTY infrastructure.
 */

import { join } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import {
  formatPath,
  createNoOpSpinner,
  OUTPUT_FORMATS,
  formatOutput,
  shouldUseColors,
  logDryRun,
  logVerbose,
  logInfo,
  logError,
  logSuccess,
  logTiming,
  logWarn,
  readFile,
  ensureFormsDir,
} from '../../../src/cli/lib/shared.js';
import { stripAnsi } from '../../utils/ansi.js';
import type { CommandContext } from '../../../src/cli/lib/cliTypes.js';

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
      expect(() => {
        spinner.message('test');
      }).not.toThrow();
      expect(() => {
        spinner.update({ type: 'api', provider: 'test', model: 'test' });
      }).not.toThrow();
      expect(() => {
        spinner.stop('done');
      }).not.toThrow();
      expect(() => {
        spinner.error('error');
      }).not.toThrow();
    });

    it('getElapsedMs tracks time', async () => {
      const spinner = createNoOpSpinner();
      const start = spinner.getElapsedMs();
      expect(start).toBeGreaterThanOrEqual(0);
      await new Promise((r) => setTimeout(r, 50));
      expect(spinner.getElapsedMs()).toBeGreaterThan(start);
    });
  });

  describe('formatOutput', () => {
    const baseCtx: CommandContext = {
      dryRun: false,
      verbose: false,
      quiet: false,
      format: 'console',
      overwrite: false,
    };

    it('formats data as JSON with snake_case keys', () => {
      const ctx = { ...baseCtx, format: 'json' as const };
      const data = { fieldName: 'value', nestedObj: { innerKey: 123 } };
      const result = formatOutput(ctx, data);
      expect(JSON.parse(result)).toEqual({
        field_name: 'value',
        nested_obj: { inner_key: 123 },
      });
    });

    it('formats data as YAML with snake_case keys', () => {
      const ctx = { ...baseCtx, format: 'yaml' as const };
      const data = { fieldName: 'value' };
      const result = formatOutput(ctx, data);
      expect(result).toContain('field_name: value');
    });

    it('uses console formatter when provided', () => {
      const ctx = { ...baseCtx, format: 'console' as const };
      const data = { test: true };
      const formatter = (d: unknown, _useColors: boolean) => `Custom: ${JSON.stringify(d)}`;
      const result = formatOutput(ctx, data, formatter);
      expect(result).toBe('Custom: {"test":true}');
    });

    it('falls back to YAML for console format without formatter', () => {
      const ctx = { ...baseCtx, format: 'console' as const };
      const data = { testValue: 42 };
      const result = formatOutput(ctx, data);
      expect(result).toContain('test_value: 42');
    });
  });

  describe('shouldUseColors', () => {
    const baseCtx: CommandContext = {
      dryRun: false,
      verbose: false,
      quiet: false,
      format: 'console',
      overwrite: false,
    };

    it('returns false for json format', () => {
      expect(shouldUseColors({ ...baseCtx, format: 'json' })).toBe(false);
    });

    it('returns false for yaml format', () => {
      expect(shouldUseColors({ ...baseCtx, format: 'yaml' })).toBe(false);
    });

    it('returns false for plaintext format', () => {
      expect(shouldUseColors({ ...baseCtx, format: 'plaintext' })).toBe(false);
    });
  });

  describe('log functions', () => {
    const baseCtx: CommandContext = {
      dryRun: false,
      verbose: false,
      quiet: false,
      format: 'console',
      overwrite: false,
    };

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const noop = (): void => {};

    it('logDryRun outputs message', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(noop);
      logDryRun('test message');
      expect(spy).toHaveBeenCalled();
      const output = spy.mock.calls[0]?.[0] as string;
      expect(output).toContain('[DRY RUN]');
      expect(output).toContain('test message');
      spy.mockRestore();
    });

    it('logDryRun outputs details when provided', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(noop);
      logDryRun('test', { key: 'value' });
      expect(spy).toHaveBeenCalledTimes(2);
      spy.mockRestore();
    });

    it('logVerbose only outputs in verbose mode', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(noop);
      logVerbose(baseCtx, 'not shown');
      expect(spy).not.toHaveBeenCalled();
      logVerbose({ ...baseCtx, verbose: true }, 'shown');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('logInfo respects quiet mode', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(noop);
      logInfo(baseCtx, 'shown');
      expect(spy).toHaveBeenCalled();
      spy.mockClear();
      logInfo({ ...baseCtx, quiet: true }, 'not shown');
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('logError always outputs', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(noop);
      logError('error message');
      expect(spy).toHaveBeenCalled();
      const output = spy.mock.calls[0]?.[0] as string;
      expect(output).toContain('error message');
      spy.mockRestore();
    });

    it('logSuccess respects quiet mode', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(noop);
      logSuccess(baseCtx, 'success');
      expect(spy).toHaveBeenCalled();
      spy.mockClear();
      logSuccess({ ...baseCtx, quiet: true }, 'not shown');
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('logTiming respects quiet mode and formats duration', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(noop);
      logTiming(baseCtx, 'operation', 1500);
      expect(spy).toHaveBeenCalled();
      const output = spy.mock.calls[0]?.[0] as string;
      expect(output).toContain('operation');
      expect(output).toContain('1.5s');
      spy.mockClear();
      logTiming({ ...baseCtx, quiet: true }, 'op', 1000);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('logWarn respects quiet mode', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(noop);
      logWarn(baseCtx, 'warning');
      expect(spy).toHaveBeenCalled();
      spy.mockClear();
      logWarn({ ...baseCtx, quiet: true }, 'not shown');
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('file utilities', () => {
    it('readFile reads file contents', async () => {
      const content = await readFile(join(__dirname, '../../../package.json'));
      expect(content).toContain('"name"');
      expect(content).toContain('markform');
    });

    it('ensureFormsDir creates directory', async () => {
      const testDir = join(__dirname, '../../../coverage/test-forms-dir');
      await ensureFormsDir(testDir);
      const { existsSync } = await import('node:fs');
      expect(existsSync(testDir)).toBe(true);
      // Cleanup
      const { rmdir } = await import('node:fs/promises');
      await rmdir(testDir);
    });
  });
});

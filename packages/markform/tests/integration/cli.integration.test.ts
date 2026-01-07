/**
 * CLI integration tests that spawn the markform CLI as a subprocess.
 *
 * Purpose:
 * 1. **Regression tests** - Vitest-based tests for CLI commands (easier to debug than golden tests)
 * 2. **Subprocess coverage** - When run under `tryscript coverage`, spawns are captured via
 *    NODE_V8_COVERAGE (for dist/, remapped to src/ via sourcemaps)
 *
 * Coverage Architecture (per tryscript docs):
 * - Vitest uses `node:inspector` for coverage, NOT NODE_V8_COVERAGE
 * - Unit tests importing directly from src/ → captured by vitest --coverage
 * - CLI subprocess spawns → captured by NODE_V8_COVERAGE (tryscript coverage)
 * - For projects like markform (mostly programmatic imports), use vitest --coverage
 *   as primary, with optional LCOV merge for CLI coverage
 *
 * See: tryscript docs/tryscript-reference.md and PR #97
 *
 * Pattern copied from tryscript's cli.integration.test.ts.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, beforeAll } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('markform CLI integration', () => {
  const pkgDir = join(__dirname, '../..');
  const binPath = join(pkgDir, 'dist/bin.mjs');
  const examplesDir = join(pkgDir, 'examples');

  beforeAll(() => {
    // Skip tests if the CLI isn't built
    if (!existsSync(binPath)) {
      throw new Error(`CLI not built. Run 'pnpm build' first. Expected: ${binPath}`);
    }
  });

  /**
   * Run the CLI and capture output.
   * This spawns a subprocess which NODE_V8_COVERAGE will capture.
   */
  const runCli = (args: string): { output: string; exitCode: number } => {
    const result = spawnSync('node', [binPath, ...args.split(' ').filter(Boolean)], {
      cwd: pkgDir,
      encoding: 'utf-8',
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    });

    const output = (result.stdout ?? '') + (result.stderr ?? '');
    return {
      output,
      exitCode: result.status ?? 1,
    };
  };

  describe('help and version', () => {
    it('shows help with --help', () => {
      const result = runCli('--help');
      expect(result.output).toContain('markform');
      expect(result.output).toContain('Commands:');
      expect(result.exitCode).toBe(0);
    });

    it('shows version with --version', () => {
      const result = runCli('--version');
      expect(result.output.trim()).toMatch(/^\d+\.\d+\.\d+/);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('inspect command', () => {
    it('shows form structure for simple.form.md', () => {
      const formPath = join(examplesDir, 'simple/simple.form.md');
      const result = runCli(`inspect ${formPath}`);
      expect(result.output).toContain('Form Inspection Report');
      expect(result.output).toContain('Title:');
      expect(result.exitCode).toBe(0);
    });

    it('shows JSON format with --format json', () => {
      const formPath = join(examplesDir, 'simple/simple.form.md');
      const result = runCli(`inspect --format json ${formPath}`);
      expect(result.output).toContain('"title"');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('validate command', () => {
    it('validates a form file', () => {
      const formPath = join(examplesDir, 'simple/simple.form.md');
      const result = runCli(`validate ${formPath}`);
      // Validate should complete (may have warnings but shouldn't crash)
      expect(result.exitCode).toBe(0);
    });

    it('shows verbose output with --verbose', () => {
      const formPath = join(examplesDir, 'simple/simple.form.md');
      const result = runCli(`validate --verbose ${formPath}`);
      expect(result.output).toContain('Reading');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('status command', () => {
    it('shows status for empty form', () => {
      const formPath = join(examplesDir, 'simple/simple.form.md');
      const result = runCli(`status ${formPath}`);
      expect(result.output).toContain('filled');
      expect(result.exitCode).toBe(0);
    });

    it('shows JSON format with --format json', () => {
      const formPath = join(examplesDir, 'simple/simple.form.md');
      const result = runCli(`status --format json ${formPath}`);
      expect(result.output).toContain('"overall"');
      expect(result.output).toContain('"total"');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('dump command', () => {
    it('dumps form values', () => {
      const formPath = join(examplesDir, 'simple/simple.form.md');
      const result = runCli(`dump ${formPath}`);
      // Dump should work even for empty/partial forms
      expect(result.exitCode).toBe(0);
    });
  });

  describe('export command', () => {
    it('exports as YAML', () => {
      const formPath = join(examplesDir, 'simple/simple.form.md');
      const result = runCli(`export --format yaml ${formPath}`);
      expect(result.output).toContain('title:');
      expect(result.exitCode).toBe(0);
    });

    it('exports as JSON', () => {
      const formPath = join(examplesDir, 'simple/simple.form.md');
      const result = runCli(`export --format json ${formPath}`);
      expect(result.output).toContain('"title"');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('schema command', () => {
    it('generates JSON Schema', () => {
      const formPath = join(examplesDir, 'simple/simple.form.md');
      const result = runCli(`schema ${formPath}`);
      expect(result.output).toContain('$schema');
      expect(result.exitCode).toBe(0);
    });

    it('supports --pure flag', () => {
      const formPath = join(examplesDir, 'simple/simple.form.md');
      const result = runCli(`schema --pure ${formPath}`);
      expect(result.output).toContain('$schema');
      expect(result.output).not.toContain('x-markform');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('docs command', () => {
    it('shows documentation', () => {
      const result = runCli('docs');
      expect(result.output).toContain('Markform');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('readme command', () => {
    it('shows README', () => {
      const result = runCli('readme');
      expect(result.output).toContain('Markform');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('examples command', () => {
    it('lists examples with --list', () => {
      const result = runCli('examples --list');
      expect(result.output).toContain('simple');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('error handling', () => {
    it('returns error for nonexistent file', () => {
      const result = runCli('inspect nonexistent-file.form.md');
      expect(result.exitCode).toBe(1);
    });

    it('returns error for invalid command', () => {
      const result = runCli('invalid-command');
      expect(result.exitCode).toBe(1);
    });
  });
});

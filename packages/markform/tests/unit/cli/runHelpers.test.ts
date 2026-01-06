/**
 * Tests for runHelpers - pure functions extracted from run command.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  scanFormsDirectory,
  enrichFormEntry,
  buildModelOptions,
  type FormEntry,
} from '../../../src/cli/lib/runHelpers.js';

describe('runHelpers', () => {
  describe('scanFormsDirectory', () => {
    let testDir: string;

    beforeEach(() => {
      testDir = join(tmpdir(), `run-helpers-test-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(testDir, { recursive: true, force: true });
    });

    it('returns empty array for non-existent directory', () => {
      const entries = scanFormsDirectory('/non/existent/path');
      expect(entries).toEqual([]);
    });

    it('only finds .form.md files', () => {
      writeFileSync(join(testDir, 'test.form.md'), '# Form');
      writeFileSync(join(testDir, 'test.report.md'), '# Report');
      writeFileSync(join(testDir, 'readme.md'), '# README');

      const entries = scanFormsDirectory(testDir);
      expect(entries.length).toBe(1);
      expect(entries[0]?.filename).toBe('test.form.md');
    });

    it('includes path and mtime in entries', () => {
      writeFileSync(join(testDir, 'test.form.md'), '# Form');

      const entries = scanFormsDirectory(testDir);
      expect(entries[0]?.path).toBe(join(testDir, 'test.form.md'));
      expect(entries[0]?.mtime).toBeInstanceOf(Date);
    });

    it('sorts alphabetically when no example ordering', () => {
      writeFileSync(join(testDir, 'beta.form.md'), '# Beta');
      writeFileSync(join(testDir, 'alpha.form.md'), '# Alpha');
      writeFileSync(join(testDir, 'gamma.form.md'), '# Gamma');

      const entries = scanFormsDirectory(testDir);
      expect(entries.map((e) => e.filename)).toEqual([
        'alpha.form.md',
        'beta.form.md',
        'gamma.form.md',
      ]);
    });
  });

  describe('enrichFormEntry', () => {
    let testDir: string;

    beforeEach(() => {
      testDir = join(tmpdir(), `run-helpers-enrich-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(testDir, { recursive: true, force: true });
    });

    it('extracts title and description from valid form', async () => {
      const formContent = `---
markform:
  spec: MF/0.1
  title: Test Form Title
  description: A test description
  roles:
    - user
---

{% form id="test_form" title="Test Form Title" %}

{% field kind="string" id="field1" label="Field 1" role="user" %}{% /field %}

{% /form %}
`;
      writeFileSync(join(testDir, 'test.form.md'), formContent);

      const entry: FormEntry = {
        path: join(testDir, 'test.form.md'),
        filename: 'test.form.md',
        mtime: new Date(),
      };

      const enriched = await enrichFormEntry(entry);
      expect(enriched.title).toBe('Test Form Title');
      expect(enriched.description).toBe('A test description');
    });

    it('returns original entry on parse error', async () => {
      writeFileSync(join(testDir, 'invalid.form.md'), 'not valid markform');

      const entry: FormEntry = {
        path: join(testDir, 'invalid.form.md'),
        filename: 'invalid.form.md',
        mtime: new Date(),
      };

      const enriched = await enrichFormEntry(entry);
      expect(enriched.filename).toBe('invalid.form.md');
      expect(enriched.title).toBeUndefined();
    });

    it('returns original entry for non-existent file', async () => {
      const entry: FormEntry = {
        path: join(testDir, 'nonexistent.form.md'),
        filename: 'nonexistent.form.md',
        mtime: new Date(),
      };

      const enriched = await enrichFormEntry(entry);
      expect(enriched.filename).toBe('nonexistent.form.md');
    });
  });

  describe('buildModelOptions', () => {
    it('returns array of model options', () => {
      const options = buildModelOptions(false);
      expect(Array.isArray(options)).toBe(true);
      expect(options.length).toBeGreaterThan(0);
    });

    it('includes custom model option at end', () => {
      const options = buildModelOptions(false);
      const lastOption = options.at(-1);
      expect(lastOption?.value).toBe('custom');
      expect(lastOption?.label).toContain('custom');
    });

    it('each option has value and label', () => {
      const options = buildModelOptions(false);
      for (const opt of options) {
        expect(opt.value).toBeDefined();
        expect(opt.label).toBeDefined();
      }
    });

    it('filters for web search only when requested', () => {
      const webSearchOptions = buildModelOptions(true);

      // Web search options should have custom option
      expect(webSearchOptions.some((o) => o.value === 'custom')).toBe(true);
      // Should have at least some model options plus custom
      expect(webSearchOptions.length).toBeGreaterThanOrEqual(1);
    });

    it('options have provider/model format', () => {
      const options = buildModelOptions(false);
      // All non-custom options should have provider/model format
      for (const opt of options) {
        if (opt.value !== 'custom') {
          expect(opt.value).toMatch(/^[a-z]+\/.+/);
        }
      }
    });
  });
});

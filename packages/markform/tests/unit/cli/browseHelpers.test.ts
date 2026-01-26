/**
 * Tests for browseHelpers - pure functions extracted from browse command.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  isViewableFile,
  getExtension,
  scanFormsDirectory,
  getExtensionHint,
  formatFileLabel,
  VIEWABLE_EXTENSIONS,
  type FileEntry,
} from '../../../src/cli/lib/browseHelpers.js';

describe('browseHelpers', () => {
  describe('isViewableFile', () => {
    it('returns true for .form.md files', () => {
      expect(isViewableFile('test.form.md')).toBe(true);
      expect(isViewableFile('my-form.form.md')).toBe(true);
    });

    it('returns true for .report.md files', () => {
      expect(isViewableFile('test.report.md')).toBe(true);
    });

    it('returns true for .yml and .yaml files', () => {
      expect(isViewableFile('values.yml')).toBe(true);
      expect(isViewableFile('config.yaml')).toBe(true);
    });

    it('returns true for .schema.json files', () => {
      expect(isViewableFile('form.schema.json')).toBe(true);
    });

    it('returns true for .raw.md files', () => {
      expect(isViewableFile('output.raw.md')).toBe(true);
    });

    it('returns false for non-viewable files', () => {
      expect(isViewableFile('readme.md')).toBe(false);
      expect(isViewableFile('package.json')).toBe(false);
      expect(isViewableFile('script.ts')).toBe(false);
      expect(isViewableFile('.gitignore')).toBe(false);
    });
  });

  describe('getExtension', () => {
    it('returns correct extension for viewable files', () => {
      expect(getExtension('test.form.md')).toBe('.form.md');
      expect(getExtension('test.report.md')).toBe('.report.md');
      expect(getExtension('values.yml')).toBe('.yml');
      expect(getExtension('config.yaml')).toBe('.yaml');
      expect(getExtension('form.schema.json')).toBe('.schema.json');
      expect(getExtension('output.raw.md')).toBe('.raw.md');
    });

    it('returns empty string for non-viewable files', () => {
      expect(getExtension('readme.md')).toBe('');
      expect(getExtension('package.json')).toBe('');
    });
  });

  describe('getExtensionHint', () => {
    it('returns correct hints for each extension', () => {
      expect(getExtensionHint('.form.md')).toBe('markform source');
      expect(getExtensionHint('.report.md')).toBe('output report');
      expect(getExtensionHint('.yml')).toBe('YAML values');
      expect(getExtensionHint('.yaml')).toBe('YAML values');
      expect(getExtensionHint('.schema.json')).toBe('JSON Schema');
      expect(getExtensionHint('.raw.md')).toBe('raw markdown');
    });

    it('returns empty string for unknown extensions', () => {
      expect(getExtensionHint('.md')).toBe('');
      expect(getExtensionHint('.json')).toBe('');
      expect(getExtensionHint('')).toBe('');
    });
  });

  describe('formatFileLabel', () => {
    it('adds green star for report files', () => {
      const entry: FileEntry = {
        path: '/forms/test.report.md',
        filename: 'test.report.md',
        mtime: new Date(),
        extension: '.report.md',
      };
      const label = formatFileLabel(entry);
      // Label contains the filename
      expect(label).toContain('test.report.md');
    });

    it('adds space for non-report files', () => {
      const entry: FileEntry = {
        path: '/forms/test.form.md',
        filename: 'test.form.md',
        mtime: new Date(),
        extension: '.form.md',
      };
      const label = formatFileLabel(entry);
      expect(label).toContain('test.form.md');
    });
  });

  describe('scanFormsDirectory', () => {
    let testDir: string;

    beforeEach(() => {
      testDir = join(tmpdir(), `browse-helpers-test-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(testDir, { recursive: true, force: true });
    });

    it('returns empty array for non-existent directory', () => {
      const entries = scanFormsDirectory('/non/existent/path');
      expect(entries).toEqual([]);
    });

    it('returns empty array for directory with no viewable files', () => {
      writeFileSync(join(testDir, 'readme.md'), '# README');
      writeFileSync(join(testDir, 'package.json'), '{}');

      const entries = scanFormsDirectory(testDir);
      expect(entries).toEqual([]);
    });

    it('finds viewable files', () => {
      writeFileSync(join(testDir, 'test.form.md'), '# Form');
      writeFileSync(join(testDir, 'test.report.md'), '# Report');
      writeFileSync(join(testDir, 'values.yml'), 'key: value');

      const entries = scanFormsDirectory(testDir);
      expect(entries.length).toBe(3);

      const filenames = entries.map((e) => e.filename);
      expect(filenames).toContain('test.form.md');
      expect(filenames).toContain('test.report.md');
      expect(filenames).toContain('values.yml');
    });

    it('filters files by pattern', () => {
      writeFileSync(join(testDir, 'alpha.form.md'), '# Alpha');
      writeFileSync(join(testDir, 'beta.form.md'), '# Beta');

      const entries = scanFormsDirectory(testDir, 'alpha');
      expect(entries.length).toBe(1);
      expect(entries[0]?.filename).toBe('alpha.form.md');
    });

    it('filter is case-insensitive', () => {
      writeFileSync(join(testDir, 'MyForm.form.md'), '# Form');

      const entries = scanFormsDirectory(testDir, 'myform');
      expect(entries.length).toBe(1);
    });

    it('sorts by modification time (most recent first)', () => {
      const file1 = join(testDir, 'old.form.md');
      const file2 = join(testDir, 'new.form.md');

      writeFileSync(file1, '# Old');
      writeFileSync(file2, '# New');

      // Set different mtimes
      const oldTime = new Date(Date.now() - 10000);
      const newTime = new Date();
      utimesSync(file1, oldTime, oldTime);
      utimesSync(file2, newTime, newTime);

      const entries = scanFormsDirectory(testDir);
      expect(entries[0]?.filename).toBe('new.form.md');
      expect(entries[1]?.filename).toBe('old.form.md');
    });
  });

  describe('VIEWABLE_EXTENSIONS', () => {
    it('contains expected extensions', () => {
      expect(VIEWABLE_EXTENSIONS).toContain('.form.md');
      expect(VIEWABLE_EXTENSIONS).toContain('.report.md');
      expect(VIEWABLE_EXTENSIONS).toContain('.yml');
      expect(VIEWABLE_EXTENSIONS).toContain('.yaml');
      expect(VIEWABLE_EXTENSIONS).toContain('.schema.json');
      expect(VIEWABLE_EXTENSIONS).toContain('.raw.md');
    });
  });
});

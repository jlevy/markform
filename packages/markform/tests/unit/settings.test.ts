/**
 * Tests for settings.ts file extension constants and helpers.
 */

import { describe, expect, it } from 'vitest';
import {
  ALL_EXTENSIONS,
  deriveExportPath,
  deriveReportPath,
  detectFileType,
  EXPORT_EXTENSIONS,
  REPORT_EXTENSION,
} from '../../src/settings.js';

describe('File Extension Constants', () => {
  it('EXPORT_EXTENSIONS has correct values', () => {
    expect(EXPORT_EXTENSIONS.form).toBe('.form.md');
    expect(EXPORT_EXTENSIONS.raw).toBe('.raw.md');
    expect(EXPORT_EXTENSIONS.yaml).toBe('.yml');
    expect(EXPORT_EXTENSIONS.json).toBe('.json');
  });

  it('REPORT_EXTENSION is correct', () => {
    expect(REPORT_EXTENSION).toBe('.report.md');
  });

  it('ALL_EXTENSIONS includes all formats', () => {
    expect(ALL_EXTENSIONS.form).toBe('.form.md');
    expect(ALL_EXTENSIONS.raw).toBe('.raw.md');
    expect(ALL_EXTENSIONS.yaml).toBe('.yml');
    expect(ALL_EXTENSIONS.json).toBe('.json');
    expect(ALL_EXTENSIONS.report).toBe('.report.md');
  });
});

describe('detectFileType', () => {
  it('detects .form.md as form', () => {
    expect(detectFileType('/path/to/file.form.md')).toBe('form');
    expect(detectFileType('simple.form.md')).toBe('form');
  });

  it('detects .raw.md as raw', () => {
    expect(detectFileType('/path/to/file.raw.md')).toBe('raw');
  });

  it('detects .report.md as report', () => {
    expect(detectFileType('/path/to/file.report.md')).toBe('report');
  });

  it('detects .yml as yaml', () => {
    expect(detectFileType('/path/to/file.yml')).toBe('yaml');
  });

  it('detects .json as json', () => {
    expect(detectFileType('/path/to/file.json')).toBe('json');
  });

  it('detects generic .md as raw', () => {
    expect(detectFileType('/path/to/README.md')).toBe('raw');
    expect(detectFileType('notes.md')).toBe('raw');
  });

  it('returns unknown for unrecognized extensions', () => {
    expect(detectFileType('/path/to/file.txt')).toBe('unknown');
    expect(detectFileType('/path/to/file.html')).toBe('unknown');
    expect(detectFileType('/path/to/file')).toBe('unknown');
  });

  it('handles priority correctly (.form.md before .md)', () => {
    // .form.md should be detected as form, not raw
    expect(detectFileType('test.form.md')).toBe('form');
  });
});

describe('deriveExportPath', () => {
  it('converts .form.md to other export formats', () => {
    expect(deriveExportPath('/path/file.form.md', 'form')).toBe('/path/file.form.md');
    expect(deriveExportPath('/path/file.form.md', 'raw')).toBe('/path/file.raw.md');
    expect(deriveExportPath('/path/file.form.md', 'yaml')).toBe('/path/file.yml');
    expect(deriveExportPath('/path/file.form.md', 'json')).toBe('/path/file.json');
  });

  it('converts .raw.md to other formats', () => {
    expect(deriveExportPath('/path/file.raw.md', 'form')).toBe('/path/file.form.md');
    expect(deriveExportPath('/path/file.raw.md', 'yaml')).toBe('/path/file.yml');
  });

  it('converts .yml to other formats', () => {
    expect(deriveExportPath('/path/file.yml', 'form')).toBe('/path/file.form.md');
    expect(deriveExportPath('/path/file.yml', 'raw')).toBe('/path/file.raw.md');
  });

  it('converts .report.md to export formats', () => {
    expect(deriveExportPath('/path/file.report.md', 'form')).toBe('/path/file.form.md');
    expect(deriveExportPath('/path/file.report.md', 'yaml')).toBe('/path/file.yml');
  });

  it('handles paths without known extensions', () => {
    expect(deriveExportPath('/path/file', 'form')).toBe('/path/file.form.md');
    expect(deriveExportPath('/path/file', 'yaml')).toBe('/path/file.yml');
  });
});

describe('deriveReportPath', () => {
  it('converts .form.md to .report.md', () => {
    expect(deriveReportPath('/path/file.form.md')).toBe('/path/file.report.md');
  });

  it('converts .raw.md to .report.md', () => {
    expect(deriveReportPath('/path/file.raw.md')).toBe('/path/file.report.md');
  });

  it('converts .yml to .report.md', () => {
    expect(deriveReportPath('/path/file.yml')).toBe('/path/file.report.md');
  });

  it('converts .json to .report.md', () => {
    expect(deriveReportPath('/path/file.json')).toBe('/path/file.report.md');
  });

  it('handles paths without known extensions', () => {
    expect(deriveReportPath('/path/file')).toBe('/path/file.report.md');
  });

  it('replaces existing .report.md correctly', () => {
    expect(deriveReportPath('/path/file.report.md')).toBe('/path/file.report.md');
  });
});

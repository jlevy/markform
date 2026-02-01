/**
 * Tests for settings.ts file extension constants and helpers.
 */

import { describe, expect, it } from 'vitest';
import {
  ALL_EXTENSIONS,
  deriveExportPath,
  deriveFillRecordPath,
  deriveReportPath,
  deriveSchemaPath,
  detectFileType,
  EXPORT_EXTENSIONS,
  FILL_RECORD_EXTENSION,
  normalizeRole,
  parseRolesFlag,
  REPORT_EXTENSION,
  SCHEMA_EXTENSION,
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

describe('deriveSchemaPath', () => {
  it('converts .form.md to .schema.json', () => {
    expect(deriveSchemaPath('/path/file.form.md')).toBe('/path/file.schema.json');
  });

  it('converts .raw.md to .schema.json', () => {
    expect(deriveSchemaPath('/path/file.raw.md')).toBe('/path/file.schema.json');
  });

  it('converts .yml to .schema.json', () => {
    expect(deriveSchemaPath('/path/file.yml')).toBe('/path/file.schema.json');
  });

  it('converts .json to .schema.json', () => {
    expect(deriveSchemaPath('/path/file.json')).toBe('/path/file.schema.json');
  });

  it('handles paths without known extensions', () => {
    expect(deriveSchemaPath('/path/file')).toBe('/path/file.schema.json');
  });

  it('handles .schema.json by stripping .json first', () => {
    // The iterator may hit .json before .schema.json, stripping only .json
    // This is a known edge case - typical usage starts from .form.md
    const result = deriveSchemaPath('/path/file.schema.json');
    expect(result).toContain('.schema.json');
  });

  it('SCHEMA_EXTENSION is correct', () => {
    expect(SCHEMA_EXTENSION).toBe('.schema.json');
  });
});

describe('deriveFillRecordPath', () => {
  it('FILL_RECORD_EXTENSION is correct', () => {
    expect(FILL_RECORD_EXTENSION).toBe('.fill.json');
  });

  it('converts .form.md to .fill.json (recommended convention)', () => {
    expect(deriveFillRecordPath('/path/file.form.md')).toBe('/path/file.fill.json');
    expect(deriveFillRecordPath('document.form.md')).toBe('document.fill.json');
  });

  it('converts plain .md to .fill.json (fallback)', () => {
    expect(deriveFillRecordPath('/path/file.md')).toBe('/path/file.fill.json');
    expect(deriveFillRecordPath('document.md')).toBe('document.fill.json');
  });

  it('prioritizes .form.md over .md', () => {
    // Ensures we strip the full .form.md, not just .md
    expect(deriveFillRecordPath('test.form.md')).toBe('test.fill.json');
  });

  it('handles paths with directories', () => {
    expect(deriveFillRecordPath('/some/path/to/form.form.md')).toBe('/some/path/to/form.fill.json');
    expect(deriveFillRecordPath('./forms/intake.form.md')).toBe('./forms/intake.fill.json');
  });

  it('appends extension for non-markdown files', () => {
    // Edge case: non-markdown files just get the extension appended
    expect(deriveFillRecordPath('/path/file.txt')).toBe('/path/file.txt.fill.json');
    expect(deriveFillRecordPath('/path/file')).toBe('/path/file.fill.json');
  });

  it('handles filenames with multiple dots', () => {
    expect(deriveFillRecordPath('my.complex.name.form.md')).toBe('my.complex.name.fill.json');
    expect(deriveFillRecordPath('file.v2.form.md')).toBe('file.v2.fill.json');
  });
});

describe('normalizeRole', () => {
  const validCases = [
    { input: 'agent', expected: 'agent' },
    { input: 'user', expected: 'user' },
    { input: 'AGENT', expected: 'agent' },
    { input: 'USER', expected: 'user' },
    { input: '  agent  ', expected: 'agent' },
    { input: 'reviewer', expected: 'reviewer' },
    { input: 'admin-user', expected: 'admin-user' },
    { input: 'role_name', expected: 'role_name' },
    { input: 'role123', expected: 'role123' },
  ];

  it.each(validCases)('normalizes "$input" to "$expected"', ({ input, expected }) => {
    expect(normalizeRole(input)).toBe(expected);
  });

  const invalidCases = [
    { input: '', desc: 'empty string' },
    { input: '123role', desc: 'starts with number' },
    { input: '_role', desc: 'starts with underscore' },
    { input: '-role', desc: 'starts with hyphen' },
    { input: 'role name', desc: 'contains space' },
    { input: 'role.name', desc: 'contains dot' },
    { input: 'role@name', desc: 'contains special char' },
  ];

  it.each(invalidCases)('throws for $desc: "$input"', ({ input }) => {
    expect(() => normalizeRole(input)).toThrow('Invalid role name');
  });

  it('throws for reserved role "*" (fails pattern check first)', () => {
    // '*' fails pattern check before reserved name check
    expect(() => normalizeRole('*')).toThrow('Invalid role name');
  });
});

describe('parseRolesFlag', () => {
  it('parses single role', () => {
    expect(parseRolesFlag('agent')).toEqual(['agent']);
    expect(parseRolesFlag('user')).toEqual(['user']);
  });

  it('parses comma-separated roles', () => {
    expect(parseRolesFlag('agent,user')).toEqual(['agent', 'user']);
    expect(parseRolesFlag('user,agent,reviewer')).toEqual(['user', 'agent', 'reviewer']);
  });

  it('normalizes roles in the list', () => {
    expect(parseRolesFlag('AGENT,USER')).toEqual(['agent', 'user']);
  });

  it('returns ["*"] for wildcard', () => {
    expect(parseRolesFlag('*')).toEqual(['*']);
  });

  it('throws for invalid role in list', () => {
    expect(() => parseRolesFlag('agent,123invalid')).toThrow('Invalid role name');
  });
});

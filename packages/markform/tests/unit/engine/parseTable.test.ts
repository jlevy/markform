/**
 * Tests for markdown table parsing.
 */
import { describe, expect, it } from 'vitest';

import {
  parseCellValue,
  extractTableHeaderLabels,
  parseRawTable,
  parseMarkdownTable,
  extractColumnsFromTable,
  parseInlineTable,
} from '../../../src/engine/table/parseTable.js';
import type { TableColumn, ColumnTypeName } from '../../../src/engine/coreTypes.js';

describe('parseTable', () => {
  describe('parseCellValue', () => {
    // [rawValue, columnType, expectedState, expectedValue]
    type CellCase = [
      string,
      ColumnTypeName,
      'answered' | 'skipped' | 'aborted',
      (string | number)?,
    ];

    const CASES: CellCase[] = [
      // Empty values
      ['', 'string', 'skipped'],
      ['  ', 'string', 'skipped'],

      // String values
      ['hello', 'string', 'answered', 'hello'],
      ['  trimmed  ', 'string', 'answered', 'trimmed'],

      // Number values
      ['42', 'number', 'answered', 42],
      ['3.14', 'number', 'answered', 3.14],
      ['-10', 'number', 'answered', -10],
      ['not a number', 'number', 'answered', 'not a number'], // Invalid stored as string

      // URL values
      ['https://example.com', 'url', 'answered', 'https://example.com'],

      // Date values
      ['2024-01-15', 'date', 'answered', '2024-01-15'],

      // Year values
      ['2024', 'year', 'answered', 2024],
      ['invalid', 'year', 'answered', 'invalid'], // Invalid stored as string

      // Sentinels
      ['%SKIP%', 'string', 'skipped'],
      ['%skip%', 'string', 'skipped'],
      ['%SKIP:reason%', 'string', 'skipped'],
      ['%ABORT%', 'string', 'aborted'],
      ['%abort%', 'string', 'aborted'],
      ['%ABORT:reason%', 'string', 'aborted'],
    ];

    for (const [raw, type, expectedState, expectedValue] of CASES) {
      const valueStr = expectedValue !== undefined ? ` (${String(expectedValue)})` : '';
      const desc = `${type}: "${raw}" → ${expectedState}${valueStr}`;
      it(desc, () => {
        const result = parseCellValue(raw, type);
        expect(result.state).toBe(expectedState);
        if (expectedValue !== undefined && result.state === 'answered') {
          expect(result.value).toBe(expectedValue);
        }
      });
    }
  });

  describe('extractTableHeaderLabels', () => {
    const CASES: [string | null, string[]][] = [
      [null, []],
      ['', []],
      ['| Name | Age |', ['Name', 'Age']],
      ['Name | Age', ['Name', 'Age']],
      ['| Single |', ['Single']],
      ['| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |', ['A', 'B', 'C']],
    ];

    for (const [content, expected] of CASES) {
      it(`extracts headers from ${content === null ? 'null' : `"${content.slice(0, 20)}..."`}`, () => {
        expect(extractTableHeaderLabels(content)).toEqual(expected);
      });
    }
  });

  describe('parseRawTable', () => {
    it('parses empty content', () => {
      const result = parseRawTable('');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.headers).toEqual([]);
        expect(result.rows).toEqual([]);
      }
    });

    it('parses table with no data rows', () => {
      const content = `
| Name | Age |
|------|-----|`;
      const result = parseRawTable(content);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.headers).toEqual(['Name', 'Age']);
        expect(result.rows).toEqual([]);
      }
    });

    it('parses table with data rows', () => {
      const content = `
| Name | Age |
|------|-----|
| Alice | 30 |
| Bob | 25 |`;
      const result = parseRawTable(content);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.headers).toEqual(['Name', 'Age']);
        expect(result.rows).toEqual([
          ['Alice', '30'],
          ['Bob', '25'],
        ]);
      }
    });

    it('normalizes row lengths', () => {
      const content = `
| A | B | C |
|---|---|---|
| 1 |
| 1 | 2 | 3 | 4 | 5 |`;
      const result = parseRawTable(content);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.rows[0]).toEqual(['1', '', '']);
        expect(result.rows[1]).toEqual(['1', '2', '3']);
      }
    });

    it('rejects missing separator', () => {
      const content = '| Name | Age |';
      const result = parseRawTable(content);
      expect(result.ok).toBe(false);
    });

    it('rejects invalid separator', () => {
      const content = `
| Name | Age |
| not | separator |`;
      const result = parseRawTable(content);
      expect(result.ok).toBe(false);
    });
  });

  describe('parseMarkdownTable with columns', () => {
    const COLUMNS: TableColumn[] = [
      { id: 'name', label: 'Name', type: 'string', required: true },
      { id: 'age', label: 'Age', type: 'number', required: false },
    ];

    it('parses valid table', () => {
      const content = `
| Name | Age |
|------|-----|
| Alice | 30 |
| Bob | 25 |`;
      const result = parseMarkdownTable(content, COLUMNS);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.rows).toHaveLength(2);
        expect(result.value.rows[0]?.name?.state).toBe('answered');
        expect(result.value.rows[0]?.age?.state).toBe('answered');
        expect(result.value.rows[0]?.age?.value).toBe(30);
      }
    });

    it('handles empty table', () => {
      const result = parseMarkdownTable('', COLUMNS);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.rows).toEqual([]);
      }
    });

    it('matches columns by label', () => {
      const content = `
| Name | Age |
|------|-----|
| Alice | 30 |`;
      const result = parseMarkdownTable(content, COLUMNS);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.rows[0]?.name?.value).toBe('Alice');
      }
    });

    it('matches columns by id', () => {
      const content = `
| name | age |
|------|-----|
| Alice | 30 |`;
      const result = parseMarkdownTable(content, COLUMNS);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.rows[0]?.name?.value).toBe('Alice');
      }
    });
  });

  describe('extractColumnsFromTable', () => {
    it('extracts columns from simple format', () => {
      const content = `
| Name | Age |
|------|-----|
| Alice | 30 |`;
      const result = extractColumnsFromTable(content);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.columns).toHaveLength(2);
        expect(result.columns[0]?.id).toBe('name');
        expect(result.columns[0]?.type).toBe('string');
        expect(result.columns[1]?.id).toBe('age');
        expect(result.dataStartLine).toBe(2);
      }
    });

    it('extracts columns with type row', () => {
      const content = `
| Name | Age |
| string,required | number |
|------|-----|
| Alice | 30 |`;
      const result = extractColumnsFromTable(content);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.columns[0]?.type).toBe('string');
        expect(result.columns[0]?.required).toBe(true);
        expect(result.columns[1]?.type).toBe('number');
        expect(result.columns[1]?.required).toBe(false);
        expect(result.dataStartLine).toBe(3);
      }
    });

    it('slugifies header labels to IDs', () => {
      const content = `
| Start Date | End Date |
|------------|----------|`;
      const result = extractColumnsFromTable(content);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.columns[0]?.id).toBe('start_date');
        expect(result.columns[1]?.id).toBe('end_date');
      }
    });

    it('rejects mismatched type row length', () => {
      const content = `
| Name | Age |
| string |
|------|-----|`;
      const result = extractColumnsFromTable(content);
      expect(result.ok).toBe(false);
    });
  });

  describe('parseInlineTable', () => {
    it('parses simple inline table', () => {
      const content = `
| Name | Age |
|------|-----|
| Alice | 30 |
| Bob | 25 |`;
      const result = parseInlineTable(content);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.rows).toHaveLength(2);
        // Default type is string
        expect(result.value.rows[0]?.name?.value).toBe('Alice');
        expect(result.value.rows[0]?.age?.value).toBe('30');
      }
    });

    it('parses inline table with type row', () => {
      const content = `
| Name | Age |
| string | number |
|------|-----|
| Alice | 30 |`;
      const result = parseInlineTable(content);
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Number type coercion
        expect(result.value.rows[0]?.age?.value).toBe(30);
      }
    });

    it('handles empty cells', () => {
      const content = `
| Name | Age |
|------|-----|
| Alice | |`;
      const result = parseInlineTable(content);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.rows[0]?.name?.state).toBe('answered');
        expect(result.value.rows[0]?.age?.state).toBe('skipped');
      }
    });
  });
});

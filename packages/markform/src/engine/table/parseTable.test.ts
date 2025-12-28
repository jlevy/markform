import { describe, it, expect } from 'vitest';

import {
  parseMarkdownTable,
  escapeTableCell,
  unescapeTableCell,
  parseTableCell,
} from './parseTable.js';

describe('parseMarkdownTable', () => {
  // Helper to create a mock node with text content
  function createTextNode(content: string) {
    return {
      type: 'text',
      attributes: { content },
    };
  }

  it('parses simple table', () => {
    const node = createTextNode(
      `
| Name | Age | City |
|------|-----|------|
| John | 25  | NYC  |
| Jane | 30  | LA   |
`.trim(),
    );

    const result = parseMarkdownTable(node);
    expect(result.headers).toEqual(['Name', 'Age', 'City']);
    expect(result.rows).toEqual([
      ['John', '25', 'NYC'],
      ['Jane', '30', 'LA'],
    ]);
  });

  it('handles empty table', () => {
    const node = createTextNode(
      `
| Name | Age |
|------|-----|
`.trim(),
    );

    const result = parseMarkdownTable(node);
    expect(result.headers).toEqual(['Name', 'Age']);
    expect(result.rows).toEqual([]);
  });

  it('handles single row', () => {
    const node = createTextNode(
      `
| Name | Age |
|------|-----|
| John | 25  |
`.trim(),
    );

    const result = parseMarkdownTable(node);
    expect(result.headers).toEqual(['Name', 'Age']);
    expect(result.rows).toEqual([['John', '25']]);
  });

  it('handles missing separator row', () => {
    const node = createTextNode(
      `
| Name | Age |
| John | 25  |
`.trim(),
    );

    const result = parseMarkdownTable(node);
    expect(result.headers).toEqual(['Name', 'Age']);
    expect(result.rows).toEqual([['John', '25']]);
  });

  it('trims whitespace from cells', () => {
    const node = createTextNode(
      `
| Name  | Age |
|-------|-----|
|  John |  25 |
`.trim(),
    );

    const result = parseMarkdownTable(node);
    expect(result.headers).toEqual(['Name', 'Age']);
    expect(result.rows).toEqual([['John', '25']]);
  });

  it('handles escaped pipes', () => {
    const node = createTextNode(
      `
| Expression | Result |
|------------|--------|
| A\\|B      | A|B    |
`.trim(),
    );

    const result = parseMarkdownTable(node);
    expect(result.headers).toEqual(['Expression', 'Result']);
    expect(result.rows).toEqual([['A\\|B', 'A|B']]);
  });
});

describe('escapeTableCell', () => {
  it('escapes pipes', () => {
    expect(escapeTableCell('A|B')).toBe('A\\|B');
  });

  it('escapes backslash-pipe sequences', () => {
    expect(escapeTableCell('A\\|B')).toBe('A\\\\|B');
  });

  it('leaves normal text unchanged', () => {
    expect(escapeTableCell('Hello')).toBe('Hello');
  });

  it('rejects newlines', () => {
    expect(() => escapeTableCell('Hello\nWorld')).toThrow('Cell value cannot contain newlines');
  });

  it('rejects control characters', () => {
    expect(() => escapeTableCell('Hello\x00World')).toThrow(
      'Cell value contains invalid control characters',
    );
  });
});

describe('unescapeTableCell', () => {
  it('unescapes pipes', () => {
    expect(unescapeTableCell('A\\|B')).toBe('A|B');
  });

  it('unescapes backslash-pipe sequences', () => {
    expect(unescapeTableCell('A\\\\|B')).toBe('A\\|B');
  });

  it('leaves normal text unchanged', () => {
    expect(unescapeTableCell('Hello')).toBe('Hello');
  });

  it('round-trips complex escaping', () => {
    const original = 'A\\|B|C\\|D';
    const escaped = escapeTableCell(original);
    const unescaped = unescapeTableCell(escaped);
    expect(unescaped).toBe(original);
  });
});

describe('parseTableCell', () => {
  describe('sentinel values', () => {
    it('parses %SKIP%', () => {
      const result = parseTableCell('%SKIP%', 'string');
      expect(result).toEqual({ state: 'skipped' });
    });

    it('parses %SKIP% with reason', () => {
      const result = parseTableCell('%SKIP% (No data)', 'string');
      expect(result).toEqual({ state: 'skipped', reason: 'No data' });
    });

    it('parses %ABORT%', () => {
      const result = parseTableCell('%ABORT%', 'string');
      expect(result).toEqual({ state: 'aborted' });
    });

    it('parses %ABORT% with reason', () => {
      const result = parseTableCell('%ABORT% (Error)', 'string');
      expect(result).toEqual({ state: 'aborted', reason: 'Error' });
    });
  });

  describe('empty cells', () => {
    it('treats empty string as null value', () => {
      const result = parseTableCell('', 'string');
      expect(result).toEqual({ state: 'answered', value: null });
    });

    it('treats whitespace-only as null value', () => {
      const result = parseTableCell('   ', 'string');
      expect(result).toEqual({ state: 'answered', value: null });
    });
  });

  describe('typed values', () => {
    it('parses string values', () => {
      const result = parseTableCell('Hello World', 'string');
      expect(result).toEqual({ state: 'answered', value: 'Hello World' });
    });

    it('parses number values', () => {
      const result = parseTableCell('42.5', 'number');
      expect(result).toEqual({ state: 'answered', value: 42.5 });
    });

    it('rejects invalid numbers', () => {
      expect(() => parseTableCell('not-a-number', 'number')).toThrow('Invalid number');
    });

    it('parses URL values', () => {
      const result = parseTableCell('https://example.com', 'url');
      expect(result).toEqual({ state: 'answered', value: 'https://example.com' });
    });

    it('rejects invalid URLs', () => {
      expect(() => parseTableCell('not-a-url', 'url')).toThrow('Invalid URL');
    });

    it('parses date values', () => {
      const result = parseTableCell('2024-01-15', 'date');
      expect(result).toEqual({ state: 'answered', value: '2024-01-15' });
    });

    it('rejects invalid date formats', () => {
      expect(() => parseTableCell('Jan 15, 2024', 'date')).toThrow('Invalid date format');
    });

    it('parses year values', () => {
      const result = parseTableCell('2024', 'year');
      expect(result).toEqual({ state: 'answered', value: 2024 });
    });

    it('rejects invalid years', () => {
      expect(() => parseTableCell('2024.5', 'year')).toThrow('Invalid year');
    });

    it('rejects unknown column types', () => {
      expect(() => parseTableCell('value', 'unknown')).toThrow('Unknown column type');
    });
  });
});

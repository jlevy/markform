import { describe, it, expect } from 'vitest';

import { parseTableField } from './parseFields.js';
import { createMockNode } from './testUtils.js';

describe('parseTableField', () => {
  it('parses basic table field', () => {
    const node = createMockNode(
      'table-field',
      {
        id: 'films',
        label: 'Films',
        columnIds: ['title', 'year'],
      },
      `
| Title | Year |
|-------|------|
| Inception | 2010 |
| Interstellar | 2014 |
`.trim(),
    );

    const result = parseTableField(node);
    expect(result.field).toMatchObject({
      kind: 'table',
      id: 'films',
      label: 'Films',
      columns: [
        { id: 'title', label: 'Title', type: 'string' },
        { id: 'year', label: 'Year', type: 'string' },
      ],
    });
    expect(result.response.state).toBe('answered');
    expect(result.response.value).toMatchObject({
      kind: 'table',
      rows: [
        {
          title: { state: 'answered', value: 'Inception' },
          year: { state: 'answered', value: '2010' },
        },
        {
          title: { state: 'answered', value: 'Interstellar' },
          year: { state: 'answered', value: '2014' },
        },
      ],
    });
  });

  it('validates required attributes', () => {
    expect(() => parseTableField(createMockNode('table-field', { label: 'Test' }))).toThrow(
      "missing required 'id'",
    );
    expect(() => parseTableField(createMockNode('table-field', { id: 'test' }))).toThrow(
      "missing required 'label'",
    );
  });

  it('validates columnIds is required', () => {
    const node = createMockNode('table-field', {
      id: 'test',
      label: 'Test',
    });
    expect(() => parseTableField(node)).toThrow("missing required 'columnIds'");
  });

  it('validates column ID format', () => {
    const node = createMockNode('table-field', {
      id: 'test',
      label: 'Test',
      columnIds: ['First Name'],
    });
    expect(() => parseTableField(node)).toThrow('not a valid identifier');
  });

  it('validates unique column IDs', () => {
    const node = createMockNode('table-field', {
      id: 'test',
      label: 'Test',
      columnIds: ['name', 'name'],
    });
    expect(() => parseTableField(node)).toThrow('Duplicate column ID "name"');
  });

  it('validates columnLabels length matches columnIds', () => {
    const node = createMockNode('table-field', {
      id: 'test',
      label: 'Test',
      columnIds: ['name', 'age'],
      columnLabels: ['Name'],
    });
    expect(() => parseTableField(node)).toThrow('columnLabels has 1 entries but columnIds has 2');
  });

  it('validates columnTypes length matches columnIds', () => {
    const node = createMockNode('table-field', {
      id: 'test',
      label: 'Test',
      columnIds: ['name', 'age'],
      columnTypes: ['string'],
    });
    expect(() => parseTableField(node)).toThrow('columnTypes has 1 entries but columnIds has 2');
  });

  it('validates column types', () => {
    const node = createMockNode('table-field', {
      id: 'test',
      label: 'Test',
      columnIds: ['name'],
      columnTypes: ['invalid'],
    });
    expect(() => parseTableField(node)).toThrow('Column type "invalid" is not valid');
  });

  it('back-fills labels from headers', () => {
    const node = createMockNode(
      'table-field',
      {
        id: 'films',
        label: 'Films',
        columnIds: ['title', 'year'],
      },
      `
| Movie Title | Release Year |
|-------------|--------------|
| Inception | 2010 |
`.trim(),
    );

    const result = parseTableField(node);
    expect(result.field.columns).toEqual([
      { id: 'title', label: 'Movie Title', type: 'string' },
      { id: 'year', label: 'Release Year', type: 'string' },
    ]);
  });

  it('validates header count matches columnIds when back-filling', () => {
    const node = createMockNode(
      'table-field',
      {
        id: 'films',
        label: 'Films',
        columnIds: ['title', 'year'],
      },
      `
| Title |
|-------|
| Inception |
`.trim(),
    );

    expect(() => parseTableField(node)).toThrow('Table has 1 headers but columnIds has 2');
  });

  it('uses explicit columnLabels over headers', () => {
    const node = createMockNode(
      'table-field',
      {
        id: 'films',
        label: 'Films',
        columnIds: ['title', 'year'],
        columnLabels: ['Film Title', 'Year'],
      },
      `
| Different Header | Other Header |
|------------------|--------------|
| Inception | 2010 |
`.trim(),
    );

    const result = parseTableField(node);
    expect(result.field.columns).toEqual([
      { id: 'title', label: 'Film Title', type: 'string' },
      { id: 'year', label: 'Year', type: 'string' },
    ]);
  });

  it('handles typed columns', () => {
    const node = createMockNode(
      'table-field',
      {
        id: 'films',
        label: 'Films',
        columnIds: ['title', 'year', 'rating'],
        columnTypes: ['string', 'year', 'number'],
      },
      `
| Title | Year | Rating |
|-------|------|--------|
| Inception | 2010 | 8.8 |
`.trim(),
    );

    const result = parseTableField(node);
    expect(result.field.columns).toEqual([
      { id: 'title', label: 'Title', type: 'string' },
      { id: 'year', label: 'Year', type: 'year' },
      { id: 'rating', label: 'Rating', type: 'number' },
    ]);
    expect(result.response.value).toMatchObject({
      kind: 'table',
      rows: [
        {
          title: { state: 'answered', value: 'Inception' },
          year: { state: 'answered', value: 2010 },
          rating: { state: 'answered', value: 8.8 },
        },
      ],
    });
  });

  it('validates cell types', () => {
    const node = createMockNode(
      'table-field',
      {
        id: 'films',
        label: 'Films',
        columnIds: ['year'],
        columnTypes: ['year'],
      },
      `
| Year |
|------|
| invalid |
`.trim(),
    );

    expect(() => parseTableField(node)).toThrow('not a valid year');
  });

  it('handles sentinel values in cells', () => {
    const node = createMockNode(
      'table-field',
      {
        id: 'films',
        label: 'Films',
        columnIds: ['title', 'year'],
      },
      `
| Title | Year |
|-------|------|
| Inception | %SKIP% (No year) |
`.trim(),
    );

    const result = parseTableField(node);
    expect(result.response.value).toMatchObject({
      kind: 'table',
      rows: [
        {
          title: { state: 'answered', value: 'Inception' },
          year: { state: 'skipped', reason: 'No year' },
        },
      ],
    });
  });

  it('handles empty cells as unanswered', () => {
    const node = createMockNode(
      'table-field',
      {
        id: 'films',
        label: 'Films',
        columnIds: ['title', 'year'],
      },
      `
| Title | Year |
|-------|------|
| Inception |  |
`.trim(),
    );

    expect(() => parseTableField(node)).toThrow('Cell "" at row 1, column "year" is empty');
  });

  it('validates row cell count matches column count', () => {
    const node = createMockNode(
      'table-field',
      {
        id: 'films',
        label: 'Films',
        columnIds: ['title', 'year'],
      },
      `
| Title | Year |
|-------|------|
| Inception | 2010 | Extra |
`.trim(),
    );

    expect(() => parseTableField(node)).toThrow('Row 1 has 3 cells but expected 2');
  });

  it('handles field-level sentinels', () => {
    const node = createMockNode(
      'table-field',
      {
        id: 'films',
        label: 'Films',
        columnIds: ['title', 'year'],
        state: 'skipped',
      },
      `
| Title | Year |
|-------|------|
`.trim(),
    );

    const result = parseTableField(node);
    expect(result.response).toEqual({ state: 'skipped' });
  });
});

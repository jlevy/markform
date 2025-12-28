import { describe, it, expect } from 'vitest';

import { serializeTableField } from './serializeTable.js';
import type { TableField, TableRowResponse } from '../coreTypes.js';

describe('serializeTableField', () => {
  const basicField: TableField = {
    kind: 'table',
    id: 'films',
    label: 'Films',
    required: false,
    priority: 'medium',
    role: 'agent',
    columns: [
      { id: 'title', label: 'Title', type: 'string' },
      { id: 'year', label: 'Year', type: 'year' },
    ],
  };

  const basicRows: TableRowResponse[] = [
    {
      title: { state: 'answered', value: 'Inception' },
      year: { state: 'answered', value: 2010 },
    },
    {
      title: { state: 'answered', value: 'Interstellar' },
      year: { state: 'answered', value: 2014 },
    },
  ];

  it('serializes basic table', () => {
    const result = serializeTableField(basicField, basicRows);
    expect(result)
      .toBe(`{% table-field id="films" label="Films" columnIds=["title", "year"] columnLabels=["Title", "Year"] columnTypes=["string", "year"] %}
| Title | Year |
| --- | --- |
| Inception | 2010 |
| Interstellar | 2014 |
{% /table-field %}`);
  });

  it('omits columnTypes when all strings', () => {
    const stringField: TableField = {
      ...basicField,
      columns: [
        { id: 'name', label: 'Name', type: 'string' },
        { id: 'desc', label: 'Description', type: 'string' },
      ],
    };

    const result = serializeTableField(stringField, []);
    expect(result).not.toContain('columnTypes');
  });

  it('includes required and constraints', () => {
    const constrainedField: TableField = {
      ...basicField,
      required: true,
      minRows: 1,
      maxRows: 10,
    };

    const result = serializeTableField(constrainedField, []);
    expect(result).toContain('required=true');
    expect(result).toContain('minRows=1');
    expect(result).toContain('maxRows=10');
  });

  it('handles sentinel values', () => {
    const rowsWithSentinels: TableRowResponse[] = [
      {
        title: { state: 'answered', value: 'Inception' },
        year: { state: 'skipped', reason: 'No data' },
      },
      {
        title: { state: 'aborted', reason: 'Error' },
        year: { state: 'answered', value: 2014 },
      },
    ];

    const result = serializeTableField(basicField, rowsWithSentinels);
    expect(result).toContain('| Inception | %SKIP% (No data) |');
    expect(result).toContain('| %ABORT% (Error) | 2014 |');
  });

  it('escapes pipes in cell values', () => {
    const rowsWithPipes: TableRowResponse[] = [
      {
        title: { state: 'answered', value: 'Film | Sequel' },
        year: { state: 'answered', value: 2010 },
      },
    ];

    const result = serializeTableField(basicField, rowsWithPipes);
    expect(result).toContain('| Film \\| Sequel | 2010 |');
  });

  it('handles empty table', () => {
    const result = serializeTableField(basicField, []);
    expect(result)
      .toBe(`{% table-field id="films" label="Films" columnIds=["title", "year"] columnLabels=["Title", "Year"] columnTypes=["string", "year"] %}
| Title | Year |
| --- | --- |
{% /table-field %}`);
  });

  it('includes custom role and priority', () => {
    const customField: TableField = {
      ...basicField,
      role: 'user',
      priority: 'high',
    };

    const result = serializeTableField(customField, []);
    expect(result).toContain('role="user"');
    expect(result).toContain('priority="high"');
  });

  it('includes report=false when specified', () => {
    const noReportField: TableField = {
      ...basicField,
      report: false,
    };

    const result = serializeTableField(noReportField, []);
    expect(result).toContain('report=false');
  });
});

import { describe, it, expect } from 'vitest';

import { validateTableField } from './validateTable.js';
import type { TableField, TableValue } from '../coreTypes.js';

describe('validateTableField', () => {
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

  it('validates valid table', () => {
    const validValue: TableValue = {
      kind: 'table',
      rows: [
        {
          title: { state: 'answered', value: 'Inception' },
          year: { state: 'answered', value: 2010 },
        },
        {
          title: { state: 'answered', value: 'Interstellar' },
          year: { state: 'skipped', reason: 'No data' },
        },
      ],
    };

    const errors = validateTableField(basicField, validValue);
    expect(errors).toEqual([]);
  });

  it('validates minRows constraint', () => {
    const fieldWithMinRows: TableField = {
      ...basicField,
      minRows: 2,
    };

    const tooFewRows: TableValue = {
      kind: 'table',
      rows: [
        {
          title: { state: 'answered', value: 'Inception' },
          year: { state: 'answered', value: 2010 },
        },
      ],
    };

    const errors = validateTableField(fieldWithMinRows, tooFewRows);
    expect(errors).toEqual([
      {
        code: 'MIN_ROWS_NOT_MET',
        message: 'Table "films" has 1 rows but requires at least 2.',
        fieldId: 'films',
      },
    ]);
  });

  it('validates maxRows constraint', () => {
    const fieldWithMaxRows: TableField = {
      ...basicField,
      maxRows: 1,
    };

    const tooManyRows: TableValue = {
      kind: 'table',
      rows: [
        {
          title: { state: 'answered', value: 'Inception' },
          year: { state: 'answered', value: 2010 },
        },
        {
          title: { state: 'answered', value: 'Interstellar' },
          year: { state: 'answered', value: 2014 },
        },
      ],
    };

    const errors = validateTableField(fieldWithMaxRows, tooManyRows);
    expect(errors).toEqual([
      {
        code: 'MAX_ROWS_EXCEEDED',
        message: 'Table "films" has 2 rows but maximum is 1.',
        fieldId: 'films',
      },
    ]);
  });

  it('validates required=true implies minRows >= 1', () => {
    const requiredField: TableField = {
      ...basicField,
      required: true,
    };

    const emptyTable: TableValue = {
      kind: 'table',
      rows: [],
    };

    const errors = validateTableField(requiredField, emptyTable);
    expect(errors).toEqual([
      {
        code: 'MIN_ROWS_NOT_MET',
        message: 'Table "films" has 0 rows but requires at least 1.',
        fieldId: 'films',
      },
    ]);
  });

  it('validates unanswered cells', () => {
    const valueWithEmptyCell: TableValue = {
      kind: 'table',
      rows: [
        {
          title: { state: 'answered', value: 'Inception' },
          year: { state: 'unanswered' }, // This should be an error
        },
      ],
    };

    const errors = validateTableField(basicField, valueWithEmptyCell);
    expect(errors).toEqual([
      {
        code: 'CELL_EMPTY',
        message: 'Cell at row 1, column "year" is empty. Provide a value or use %SKIP%.',
        fieldId: 'films',
        rowIndex: 0,
        columnId: 'year',
      },
    ]);
  });

  it('validates cell type - invalid number', () => {
    const valueWithInvalidNumber: TableValue = {
      kind: 'table',
      rows: [
        {
          title: { state: 'answered', value: 'Inception' },
          year: { state: 'answered', value: 'not-a-number' },
        },
      ],
    };

    const errors = validateTableField(basicField, valueWithInvalidNumber);
    expect(errors).toEqual([
      {
        code: 'CELL_TYPE_MISMATCH',
        message: 'Cell "not-a-number" at row 1, column "year" is not a valid year.',
        fieldId: 'films',
        rowIndex: 0,
        columnId: 'year',
      },
    ]);
  });

  it('validates cell type - invalid URL', () => {
    const urlField: TableField = {
      ...basicField,
      columns: [
        { id: 'name', label: 'Name', type: 'string' },
        { id: 'website', label: 'Website', type: 'url' },
      ],
    };

    const valueWithInvalidUrl: TableValue = {
      kind: 'table',
      rows: [
        {
          name: { state: 'answered', value: 'Example' },
          website: { state: 'answered', value: 'not-a-url' },
        },
      ],
    };

    const errors = validateTableField(urlField, valueWithInvalidUrl);
    expect(errors).toEqual([
      {
        code: 'CELL_TYPE_MISMATCH',
        message: 'Cell "not-a-url" at row 1, column "website" is not a valid url.',
        fieldId: 'films',
        rowIndex: 0,
        columnId: 'website',
      },
    ]);
  });

  it('validates cell type - invalid date', () => {
    const dateField: TableField = {
      ...basicField,
      columns: [
        { id: 'event', label: 'Event', type: 'string' },
        { id: 'date', label: 'Date', type: 'date' },
      ],
    };

    const valueWithInvalidDate: TableValue = {
      kind: 'table',
      rows: [
        {
          event: { state: 'answered', value: 'Release' },
          date: { state: 'answered', value: 'Jan 15, 2024' },
        },
      ],
    };

    const errors = validateTableField(dateField, valueWithInvalidDate);
    expect(errors).toEqual([
      {
        code: 'CELL_TYPE_MISMATCH',
        message: 'Cell "Jan 15, 2024" at row 1, column "date" is not a valid date.',
        fieldId: 'films',
        rowIndex: 0,
        columnId: 'date',
      },
    ]);
  });

  it('allows skipped and aborted cells', () => {
    const valueWithSentinels: TableValue = {
      kind: 'table',
      rows: [
        {
          title: { state: 'answered', value: 'Inception' },
          year: { state: 'skipped', reason: 'No data' },
        },
        {
          title: { state: 'aborted', reason: 'Error' },
          year: { state: 'answered', value: 2014 },
        },
      ],
    };

    const errors = validateTableField(basicField, valueWithSentinels);
    expect(errors).toEqual([]);
  });

  it('validates missing cells in row', () => {
    const incompleteRow: TableValue = {
      kind: 'table',
      rows: [
        {
          title: { state: 'answered', value: 'Inception' },
          // Missing year cell
        },
      ],
    };

    const errors = validateTableField(basicField, incompleteRow);
    expect(errors).toEqual([
      {
        code: 'CELL_MISSING',
        message: 'Row 1 is missing cell for column "year".',
        fieldId: 'films',
        rowIndex: 0,
        columnId: 'year',
      },
    ]);
  });
});

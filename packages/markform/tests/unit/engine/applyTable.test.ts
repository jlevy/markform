import { describe, it, expect, beforeEach } from 'vitest';

import { applyPatches } from '../../../src/engine/apply.js';
import type { SetTablePatch, ParsedForm, FormSchema } from '../../../src/engine/coreTypes.js';

describe('set_table patch', () => {
  const mockForm: ParsedForm = {
    schema: {} as FormSchema,
    responsesByFieldId: {},
    notes: [],
    docs: [],
    orderIndex: [],
    idIndex: new Map(),
  };

  beforeEach(() => {
    mockForm.responsesByFieldId = {};
  });

  it('applies table patch with regular values', () => {
    const patch: SetTablePatch = {
      op: 'set_table',
      fieldId: 'films',
      rows: [
        {
          title: 'Inception',
          year: 2010,
        },
        {
          title: 'Interstellar',
          year: 2014,
        },
      ],
    };

    const result = applyPatches(mockForm, [patch]);
    expect(result.applyStatus).toBe(true);

    expect(mockForm.responsesByFieldId.films!).toEqual({
      state: 'answered',
      value: {
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
      },
    });
  });

  it('handles sentinel strings in cells', () => {
    const patch: SetTablePatch = {
      op: 'set_table',
      fieldId: 'films',
      rows: [
        {
          title: 'Inception',
          year: '%SKIP% (No data)',
        },
        {
          title: '%ABORT%',
          year: 2014,
        },
      ],
    };

    const result = applyPatches(mockForm, [patch]);
    expect(result.applyStatus).toBe(true);

    expect(mockForm.responsesByFieldId.films!).toEqual({
      state: 'answered',
      value: {
        kind: 'table',
        rows: [
          {
            title: { state: 'answered', value: 'Inception' },
            year: { state: 'skipped', reason: 'No data' },
          },
          {
            title: { state: 'aborted' },
            year: { state: 'answered', value: 2014 },
          },
        ],
      },
    });
  });

  it('handles null values', () => {
    const patch: SetTablePatch = {
      op: 'set_table',
      fieldId: 'films',
      rows: [
        {
          title: 'Inception',
          year: null,
        },
      ],
    };

    const result = applyPatches(mockForm, [patch]);
    expect(result.applyStatus).toBe(true);

    expect((mockForm.responsesByFieldId.films!.value as any).rows[0].year).toEqual({
      state: 'answered',
      value: null,
    });
  });

  it('handles empty table', () => {
    const patch: SetTablePatch = {
      op: 'set_table',
      fieldId: 'films',
      rows: [],
    };

    const result = applyPatches(mockForm, [patch]);
    expect(result.applyStatus).toBe(true);

    expect(mockForm.responsesByFieldId.films!).toEqual({
      state: 'answered',
      value: {
        kind: 'table',
        rows: [],
      },
    });
  });
});

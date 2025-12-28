import { describe, expect, it } from 'vitest';

import {
  CheckboxModeSchema,
  CheckboxValueSchema,
  FieldKindSchema,
  FieldSchema,
  FieldValueSchema,
  FormSchemaSchema,
  InspectIssueSchema,
  PatchSchema,
  ProgressStateSchema,
  SessionTranscriptSchema,
  StructureSummarySchema,
  ValidationIssueSchema,
} from '../../../src/engine/coreTypes.js';

describe('engine/coreTypes', () => {
  describe('CheckboxValueSchema', () => {
    it('accepts multi mode states', () => {
      expect(CheckboxValueSchema.parse('todo')).toBe('todo');
      expect(CheckboxValueSchema.parse('done')).toBe('done');
      expect(CheckboxValueSchema.parse('incomplete')).toBe('incomplete');
      expect(CheckboxValueSchema.parse('active')).toBe('active');
      expect(CheckboxValueSchema.parse('na')).toBe('na');
    });

    it('accepts explicit mode values', () => {
      expect(CheckboxValueSchema.parse('unfilled')).toBe('unfilled');
      expect(CheckboxValueSchema.parse('yes')).toBe('yes');
      expect(CheckboxValueSchema.parse('no')).toBe('no');
    });

    it('rejects invalid values', () => {
      expect(() => CheckboxValueSchema.parse('invalid')).toThrow();
    });
  });

  describe('CheckboxModeSchema', () => {
    it('accepts valid modes', () => {
      expect(CheckboxModeSchema.parse('multi')).toBe('multi');
      expect(CheckboxModeSchema.parse('simple')).toBe('simple');
      expect(CheckboxModeSchema.parse('explicit')).toBe('explicit');
    });
  });

  describe('FieldKindSchema', () => {
    it('accepts all field kinds', () => {
      const kinds = [
        'string',
        'number',
        'string_list',
        'checkboxes',
        'single_select',
        'multi_select',
      ];
      for (const kind of kinds) {
        expect(FieldKindSchema.parse(kind)).toBe(kind);
      }
    });
  });

  describe('FieldSchema', () => {
    it('parses string field', () => {
      const field = {
        kind: 'string',
        id: 'company_name',
        label: 'Company Name',
        required: true,
        priority: 'high',
        role: 'agent',
        pattern: '^[A-Z].*',
        minLength: 1,
        maxLength: 100,
      };
      const result = FieldSchema.parse(field);
      expect(result.kind).toBe('string');
      expect(result.id).toBe('company_name');
    });

    it('parses number field', () => {
      const field = {
        kind: 'number',
        id: 'revenue',
        label: 'Revenue',
        required: false,
        priority: 'medium',
        role: 'agent',
        min: 0,
        max: 1000000,
        integer: true,
      };
      const result = FieldSchema.parse(field);
      expect(result.kind).toBe('number');
    });

    it('parses checkboxes field', () => {
      const field = {
        kind: 'checkboxes',
        id: 'tasks',
        label: 'Tasks',
        required: false,
        priority: 'medium',
        role: 'agent',
        checkboxMode: 'multi',
        options: [
          { id: 'task_a', label: 'Task A' },
          { id: 'task_b', label: 'Task B' },
        ],
        approvalMode: 'none',
      };
      const result = FieldSchema.parse(field);
      expect(result.kind).toBe('checkboxes');
      if (result.kind === 'checkboxes') {
        expect(result.options).toHaveLength(2);
      }
    });

    it('parses single-select field', () => {
      const field = {
        kind: 'single_select',
        id: 'rating',
        label: 'Rating',
        required: false,
        priority: 'medium',
        role: 'agent',
        options: [
          { id: 'bullish', label: 'Bullish' },
          { id: 'neutral', label: 'Neutral' },
          { id: 'bearish', label: 'Bearish' },
        ],
      };
      const result = FieldSchema.parse(field);
      expect(result.kind).toBe('single_select');
    });

    it('parses multi-select field', () => {
      const field = {
        kind: 'multi_select',
        id: 'categories',
        label: 'Categories',
        required: false,
        priority: 'medium',
        role: 'agent',
        minSelections: 1,
        maxSelections: 3,
        options: [
          { id: 'tech', label: 'Technology' },
          { id: 'health', label: 'Healthcare' },
        ],
      };
      const result = FieldSchema.parse(field);
      expect(result.kind).toBe('multi_select');
    });

    it('parses string-list field', () => {
      const field = {
        kind: 'string_list',
        id: 'risks',
        label: 'Risks',
        required: false,
        priority: 'medium',
        role: 'agent',
        minItems: 3,
        maxItems: 10,
        itemMinLength: 10,
        uniqueItems: true,
      };
      const result = FieldSchema.parse(field);
      expect(result.kind).toBe('string_list');
    });
  });

  describe('FormSchemaSchema', () => {
    it('parses a complete form schema', () => {
      const schema = {
        id: 'quarterly_earnings',
        title: 'Quarterly Earnings Analysis',
        groups: [
          {
            id: 'company_info',
            title: 'Company Info',
            children: [
              {
                kind: 'string',
                id: 'company_name',
                label: 'Company Name',
                required: true,
                priority: 'high',
                role: 'user',
              },
              {
                kind: 'string',
                id: 'ticker',
                label: 'Ticker',
                required: true,
                priority: 'high',
                role: 'agent',
              },
            ],
          },
        ],
      };
      const result = FormSchemaSchema.parse(schema);
      expect(result.id).toBe('quarterly_earnings');
      expect(result.groups).toHaveLength(1);
      const firstGroup = result.groups[0];
      expect(firstGroup).toBeDefined();
      expect(firstGroup?.children).toHaveLength(2);
    });
  });

  describe('FieldValueSchema', () => {
    it('parses string value', () => {
      const value = { kind: 'string', value: 'ACME Corp' };
      const result = FieldValueSchema.parse(value);
      expect(result.kind).toBe('string');
      if (result.kind === 'string') {
        expect(result.value).toBe('ACME Corp');
      }
    });

    it('parses null string value', () => {
      const value = { kind: 'string', value: null };
      const result = FieldValueSchema.parse(value);
      if (result.kind === 'string') {
        expect(result.value).toBeNull();
      }
    });

    it('parses number value', () => {
      const value = { kind: 'number', value: 1234.56 };
      const result = FieldValueSchema.parse(value);
      if (result.kind === 'number') {
        expect(result.value).toBe(1234.56);
      }
    });

    it('parses checkboxes value', () => {
      const value = {
        kind: 'checkboxes',
        values: { task_a: 'done', task_b: 'todo' },
      };
      const result = FieldValueSchema.parse(value);
      if (result.kind === 'checkboxes') {
        expect(result.values.task_a).toBe('done');
      }
    });

    it('parses single-select value', () => {
      const value = { kind: 'single_select', selected: 'bullish' };
      const result = FieldValueSchema.parse(value);
      if (result.kind === 'single_select') {
        expect(result.selected).toBe('bullish');
      }
    });

    it('parses multi-select value', () => {
      const value = { kind: 'multi_select', selected: ['tech', 'health'] };
      const result = FieldValueSchema.parse(value);
      if (result.kind === 'multi_select') {
        expect(result.selected).toEqual(['tech', 'health']);
      }
    });

    it('parses string-list value', () => {
      const value = { kind: 'string_list', items: ['Risk 1', 'Risk 2'] };
      const result = FieldValueSchema.parse(value);
      if (result.kind === 'string_list') {
        expect(result.items).toEqual(['Risk 1', 'Risk 2']);
      }
    });
  });

  describe('ValidationIssueSchema', () => {
    it('parses validation issue', () => {
      const issue = {
        severity: 'error',
        message: 'Field is required',
        code: 'REQUIRED_MISSING',
        ref: 'company_name',
        source: 'builtin',
      };
      const result = ValidationIssueSchema.parse(issue);
      expect(result.severity).toBe('error');
      expect(result.code).toBe('REQUIRED_MISSING');
    });
  });

  describe('InspectIssueSchema', () => {
    it('parses inspect issue', () => {
      const issue = {
        ref: 'company_name',
        scope: 'field',
        reason: 'required_missing',
        message: "Required field 'Company name' has no value",
        severity: 'required',
        priority: 2,
      };
      const result = InspectIssueSchema.parse(issue);
      expect(result.reason).toBe('required_missing');
      expect(result.priority).toBe(2);
    });
  });

  describe('ProgressStateSchema', () => {
    it('accepts all progress states', () => {
      const states = ['empty', 'incomplete', 'invalid', 'complete'];
      for (const state of states) {
        expect(ProgressStateSchema.parse(state)).toBe(state);
      }
    });
  });

  describe('StructureSummarySchema', () => {
    it('parses structure summary', () => {
      const summary = {
        groupCount: 2,
        fieldCount: 5,
        optionCount: 10,
        fieldCountByKind: {
          string: 2,
          number: 1,
          string_list: 0,
          checkboxes: 1,
          single_select: 1,
          multi_select: 0,
        },
        groupsById: { company_info: 'field_group' },
        fieldsById: { company_name: 'string', ticker: 'string' },
        optionsById: {
          'rating.bullish': {
            parentFieldId: 'rating',
            parentFieldKind: 'single_select',
          },
        },
      };
      const result = StructureSummarySchema.parse(summary);
      expect(result.groupCount).toBe(2);
      expect(result.fieldCount).toBe(5);
    });
  });

  describe('PatchSchema', () => {
    it('parses set_string patch', () => {
      const patch = { op: 'set_string', fieldId: 'name', value: 'ACME' };
      const result = PatchSchema.parse(patch);
      expect(result.op).toBe('set_string');
    });

    it('parses set_number patch', () => {
      const patch = { op: 'set_number', fieldId: 'revenue', value: 1000 };
      const result = PatchSchema.parse(patch);
      expect(result.op).toBe('set_number');
    });

    it('parses set_checkboxes patch', () => {
      const patch = {
        op: 'set_checkboxes',
        fieldId: 'tasks',
        values: { task_a: 'done' },
      };
      const result = PatchSchema.parse(patch);
      expect(result.op).toBe('set_checkboxes');
    });

    it('parses clear_field patch', () => {
      const patch = { op: 'clear_field', fieldId: 'name' };
      const result = PatchSchema.parse(patch);
      expect(result.op).toBe('clear_field');
    });

    it('rejects invalid patch operation', () => {
      const patch = { op: 'invalid_op', fieldId: 'name' };
      expect(() => PatchSchema.parse(patch)).toThrow();
    });
  });

  describe('SessionTranscriptSchema', () => {
    it('parses a complete session transcript', () => {
      const session = {
        sessionVersion: '0.1',
        mode: 'mock',
        form: { path: 'examples/simple/simple.form.md' },
        validators: { code: 'examples/simple/simple.valid.ts' },
        mock: { completedMock: 'examples/simple/simple-mock-filled.form.md' },
        harness: {
          maxIssuesPerTurn: 5,
          maxPatchesPerTurn: 3,
          maxTurns: 100,
        },
        turns: [
          {
            turn: 1,
            inspect: {
              issues: [
                {
                  ref: 'company_name',
                  scope: 'field',
                  reason: 'required_missing',
                  message: 'Required field has no value',
                  severity: 'required',
                  priority: 2,
                },
              ],
            },
            apply: {
              patches: [{ op: 'set_string', fieldId: 'company_name', value: 'ACME' }],
            },
            after: {
              requiredIssueCount: 0,
              markdownSha256: 'abc123',
              answeredFieldCount: 1,
              skippedFieldCount: 0,
            },
          },
        ],
        final: {
          expectComplete: true,
          expectedCompletedForm: 'examples/simple/simple-mock-filled.form.md',
        },
      };
      const result = SessionTranscriptSchema.parse(session);
      expect(result.sessionVersion).toBe('0.1');
      expect(result.turns).toHaveLength(1);
    });
  });
});
